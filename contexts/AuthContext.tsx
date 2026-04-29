import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
// FIX: Import User and Session types from '@supabase/auth-js' as they may not be exported from the main supabase-js package in this version.
import type { Session, User } from '@supabase/auth-js';
import { supabase, getUserProfile, getBusinessesForOwner, getNotifications } from '../services/supabaseService';
import type { Profile, Review, Business, UserRole, Notification } from '../types';

interface AuthContextType {
    user: User | null;
    profile: Profile | null;
    session: Session | null;
    loading: boolean;
    // FIX: Changed from singular 'business' to plural 'businesses' to support multiple businesses per owner.
    businesses: Business[];
    notifications: Notification[];
    setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
    setProfile: React.Dispatch<React.SetStateAction<Profile | null>>;
    // FIX: Changed from 'setBusiness' to 'setBusinesses'.
    setBusinesses: React.Dispatch<React.SetStateAction<Business[]>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{children: ReactNode}> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    // FIX: Changed state to handle an array of businesses.
    const [businesses, setBusinesses] = useState<Business[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);

    useEffect(() => {
        // This function encapsulates all logic for fetching and setting user-related data.
        // It's designed to be atomic and robust, ensuring the loading state is handled correctly.
        const syncUserAndData = async (session: Session | null) => {
            // REMOVED: setLoading(true) was here, causing the loading screen on tab focus.
            try {
                setSession(session);
                const currentUser = session?.user ?? null;
                setUser(currentUser);

                // If user is logged out, clear all associated data and exit.
                if (!currentUser) {
                    setProfile(null);
                    // FIX: Clear businesses array on logout.
                    setBusinesses([]);
                    setNotifications([]);
                    return;
                }

                // 1. Fetch profile - wrapped in its own try/catch to isolate errors
                let userProfile: Profile | null = null;
                try {
                    userProfile = await getUserProfile(currentUser);

                    // 2. If profile doesn't exist (e.g., new OAuth user), create it.
                    if (!userProfile) {
                        console.log("Profile not found, creating new profile for user:", currentUser.id);
                        const { data: newProfile, error: insertError} = await supabase
                            .from('profiles')
                            .insert({
                                id: currentUser.id,
                                name: currentUser.user_metadata.full_name || currentUser.user_metadata.name || 'Nuevo Usuario',
                                username: currentUser.user_metadata.username || null,
                                avatar_url: currentUser.user_metadata.avatar_url || null,
                                role: 'authenticated',
                                helpful_review_count: 0,
                                plan: 'free'
                            })
                            .select()
                            .single();

                        if (insertError) {
                            // Handle a race condition where a DB trigger might have created the profile
                            // between our check and our insert attempt. Re-fetching is a safe recovery.
                            if (insertError.code === '23505') {
                                console.log("Profile already exists (race condition), re-fetching...");
                                userProfile = await getUserProfile(currentUser);
                            } else {
                                // A different, unexpected error occurred - log but don't throw
                                console.error("Error creating profile:", insertError);
                            }
                        } else {
                            userProfile = newProfile as Profile;
                            console.log("New profile created successfully");
                        }
                    }
                } catch (profileError) {
                    console.error("Error fetching/creating profile:", profileError);
                    // Don't throw - continue with null profile
                }

                setProfile(userProfile);

                // 3. If profile exists, fetch secondary data (notifications, business info) in parallel.
                if (userProfile) {
                    try {
                        const notificationsPromise = getNotifications(currentUser.id);
                        // FIX: Fetch multiple businesses instead of a single one.
                        const businessPromise = userProfile.role === 'business_owner'
                            ? getBusinessesForOwner(userProfile.id)
                            : Promise.resolve([]);

                        // Use Promise.allSettled to handle potential failures gracefully
                        const [notificationsResult, businessResult] = await Promise.allSettled([notificationsPromise, businessPromise]);

                        if (notificationsResult.status === 'fulfilled') {
                            setNotifications(notificationsResult.value);
                        } else {
                            console.error("Failed to fetch notifications:", notificationsResult.reason);
                            setNotifications([]);
                        }

                        if (businessResult.status === 'fulfilled') {
                            // FIX: Set businesses array.
                            setBusinesses(businessResult.value);
                        } else {
                            console.error("Failed to fetch businesses:", businessResult.reason);
                            // FIX: Set businesses to empty array on error.
                            setBusinesses([]);
                        }
                    } catch (secondaryError) {
                        console.error("Error fetching secondary data:", secondaryError);
                        setNotifications([]);
                        setBusinesses([]);
                    }
                } else {
                    // If profile is still null after all attempts, clear related data.
                    console.warn("User is authenticated but profile could not be fetched or created.");
                    // FIX: Clear businesses array.
                    setBusinesses([]);
                    setNotifications([]);
                }

            } catch (error) {
                console.error("Critical error during auth state processing:", error);
                // Only reset profile-related data, keep user and session if they exist
                setProfile(null);
                setBusinesses([]);
                setNotifications([]);
            } finally {
                // This is crucial: setLoading(false) is always called at the very end,
                // ensuring the app becomes interactive only when the initial data load is settled.
                setLoading(false);
            }
        };
    
        // The Supabase auth listener triggers our robust sync function on any auth event.
        const { data: authListener } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                syncUserAndData(session);
            }
        );
    
        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);
    
    // --- Realtime Notification Subscription ---
    useEffect(() => {
        if (!user) return;

        const notificationsChannel = supabase
            .channel('realtime-notifications')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`,
                },
                (payload) => {
                    setNotifications(currentNotifications => [payload.new as Notification, ...currentNotifications]);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(notificationsChannel);
        };

    }, [user]);

    // --- Realtime Subscription for Profile Role Changes ---
    useEffect(() => {
        if (!user) return;

        // This subscription listens for changes to the user's own profile.
        // This is the most reliable way to detect when an admin changes a user's role.
        const profileChannel = supabase
            .channel(`profile-updates-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${user.id}`,
                },
                async (payload) => {
                    const newProfile = payload.new as Profile;

                    // Always update the profile in the context to reflect any change (name, avatar, etc.).
                    setProfile(newProfile);

                    // If the role was just changed to business_owner, we now need to fetch the business
                    // that was assigned. This solves the race condition where the business assignment
                    // notification might arrive before the role change is complete.
                    if (newProfile.role === 'business_owner') {
                        // FIX: Fetch multiple businesses.
                        const businessesData = await getBusinessesForOwner(user.id);
                        if (businessesData) {
                            // FIX: Set businesses array.
                            setBusinesses(businessesData);
                        }
                    // Fix: Changed `else if` to `else` to remove a redundant condition that caused a TypeScript error.
                    // The original check was always true inside the `else` branch.
                    } else {
                        // If the role changed *away* from business owner, clear the business data.
                        // FIX: Set businesses to empty array.
                        setBusinesses([]);
                    }
                }
            )
            .subscribe();

        // Subscription for new businesses assigned to this user (INSERT or UPDATE)
        const businessChannel = supabase
            .channel(`business-updates-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'businesses',
                    filter: `owner_id=eq.${user.id}`,
                },
                async (payload) => {
                    // When a new business is created for this user, reload all businesses
                    const businessesData = await getBusinessesForOwner(user.id);
                    if (businessesData) {
                        setBusinesses(businessesData);
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'businesses',
                    filter: `owner_id=eq.${user.id}`,
                },
                async (payload) => {
                    // When a business is assigned to this user via claim approval
                    console.log('📊 Business assigned via UPDATE:', payload);
                    const businessesData = await getBusinessesForOwner(user.id);
                    if (businessesData) {
                        setBusinesses(businessesData);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(profileChannel);
            supabase.removeChannel(businessChannel);
        };
    }, [user]);


    const value = {
        user,
        profile,
        session,
        loading,
        // FIX: Provide businesses array in context.
        businesses,
        notifications,
        setNotifications,
        setProfile,
        // FIX: Provide setBusinesses in context.
        setBusinesses,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
