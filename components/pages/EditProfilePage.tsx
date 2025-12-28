import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { updateUserProfile, savePushSubscription, deletePushSubscription, isUsernameTaken } from '../../services/supabaseService';
// FIX: Changed react-router-dom imports to a namespace import to resolve module resolution issues.
import * as ReactRouterDOM from 'react-router-dom';
import Spinner from '../Spinner';
import { VAPID_PUBLIC_KEY } from '../../constants';
import { urlBase64ToUint8Array } from '../../utils/urlBase64ToUint8Array';
import { Json } from '../../types';
import Meta from '../Meta';
import { useTranslation, pathTranslations, useI18n } from '../../contexts/i18nContext';

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken';

const EditProfilePage: React.FC = () => {
    const { user, profile, loading: authLoading, setProfile } = useAuth();
    // FIX: Using namespace import from react-router-dom v6
    const navigate = ReactRouterDOM.useNavigate();
    const t = useTranslation();
    const { language } = useI18n();

    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [isPushSubscribed, setIsPushSubscribed] = useState(false);
    const [pushLoading, setPushLoading] = useState(true);

    useEffect(() => {
        if (profile) {
            setName(profile.name || '');
            setUsername(profile.username || '');
            setAvatarPreview(profile.avatar_url || null);
        }
    }, [profile]);
    
    // Debounced username check
    useEffect(() => {
        // Only check if username is being created for the first time
        if (profile?.username) {
            setUsernameStatus('idle');
            return;
        }

        const usernameToCheck = username.trim();
        if (usernameToCheck.length < 3) {
            setUsernameStatus('idle');
            return;
        }

        setUsernameStatus('checking');
        const debounceId = setTimeout(async () => {
            try {
                const taken = await isUsernameTaken(usernameToCheck);
                setUsernameStatus(taken ? 'taken' : 'available');
            } catch (err) {
                console.error("Username check failed:", err);
                setUsernameStatus('idle'); // Reset on error
            }
        }, 500);

        return () => clearTimeout(debounceId);
    }, [username, profile?.username]);


    useEffect(() => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            setPushLoading(false);
            return;
        }
        navigator.serviceWorker.ready.then(reg => {
            reg.pushManager.getSubscription().then(sub => {
                setIsPushSubscribed(!!sub);
                setPushLoading(false);
            });
        });
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        setAvatarFile(file);
        if (avatarPreview && avatarPreview.startsWith('blob:')) {
            URL.revokeObjectURL(avatarPreview);
        }
        if (file) {
            setAvatarPreview(URL.createObjectURL(file));
        } else {
            setAvatarPreview(profile?.avatar_url || null);
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!user) return;

        if (!profile?.username) {
            if (username.trim().length < 3) {
                setError(t('editProfile.usernameMinChars'));
                return;
            }
            if (usernameStatus !== 'available') {
                setError(t('editProfile.usernameNotAvailable'));
                return;
            }
        }
        
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const updates: { name: string, username?: string, avatarFile?: File } = {
                name: name.trim(),
            };
            if (avatarFile) {
                updates.avatarFile = avatarFile;
            }
            if (!profile?.username && username.trim()) {
                updates.username = username.trim();
            }

            const updatedProfile = await updateUserProfile(user.id, updates);
            // Manually update the profile in the auth context to avoid stale data on redirect.
            if (updatedProfile) {
                setProfile(updatedProfile);
            }
            setSuccess(t('editProfile.changesSaved'));
            setTimeout(() => {
                navigate(`/${pathTranslations[language].profile}`);
            }, 1500);
        } catch (err: any) {
            setError(err.message || t('editProfile.errorUpdating'));
        } finally {
            setLoading(false);
        }
    };

    const handleTogglePushNotifications = async () => {
        setPushLoading(true);
        setError(null);
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                await deletePushSubscription(subscription.endpoint);
                const unsubscribed = await subscription.unsubscribe();
                if (unsubscribed) {
                    setIsPushSubscribed(false);
                }
            } else if (user) {
                 const permission = await Notification.requestPermission();
                 if (permission !== 'granted') throw new Error(t('editProfile.notificationPermissionDenied'));

                const newSubscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
                });
                // FIX: The PushSubscriptionJSON type from the browser API is not directly assignable to the generic Json type.
                // Casting it to `unknown` first and then to `Json` resolves the type mismatch.
                await savePushSubscription(user.id, newSubscription.toJSON() as unknown as Json);
                setIsPushSubscribed(true);
            }
        } catch (error: any) {
            console.error("Error toggling push notifications", error);
            setError(error.message || t('editProfile.notificationError'));
        } finally {
            setPushLoading(false);
        }
    };
    
    const UsernameFeedback = () => {
        switch(usernameStatus) {
            case 'checking':
                return <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>;
            case 'available':
                return <i className="fa-solid fa-check-circle text-green-500 absolute right-3 top-1/2 -translate-y-1/2"></i>;
            case 'taken':
                 return <i className="fa-solid fa-times-circle text-red-500 absolute right-3 top-1/2 -translate-y-1/2"></i>;
            default:
                return null;
        }
    };


    if (authLoading) {
        return <div className="flex justify-center items-center h-64"><Spinner /></div>;
    }

    return (
        <>
            <Meta
                title={t('editProfile.metaTitle')}
                description={t('editProfile.metaDescription')}
                noindex={true}
            />
            <div className="max-w-xl mx-auto bg-white dark:bg-zinc-800 p-8 rounded-xl shadow-lg">
                <h1 className="text-3xl font-bold mb-2 dark:text-gray-100">{t('editProfile.title')}</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-8">{t('editProfile.subtitle')}</p>

                {error && (
                    <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg mb-6" role="alert">
                        <span>{error}</span>
                    </div>
                )}
                {success && (
                    <div className="bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg mb-6" role="alert">
                        <span>{success}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('editProfile.nameLabel')}</label>
                        <input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-transparent text-gray-900 dark:text-gray-100"
                        />
                    </div>

                    <div>
                        <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('editProfile.usernameLabel')}</label>
                        <div className="relative">
                            <input
                                id="username"
                                type="text"
                                value={username}
                                onChange={(e) => {
                                    const sanitizedValue = e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
                                    setUsername(sanitizedValue);
                                }}
                                disabled={!!profile?.username}
                                className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-transparent text-gray-900 dark:text-gray-100 disabled:bg-gray-100 disabled:dark:bg-zinc-700 disabled:text-gray-500 disabled:cursor-not-allowed"
                            />
                             {!profile?.username && <UsernameFeedback />}
                        </div>
                        {profile?.username ? (
                             <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('editProfile.usernameCannotChange')}</p>
                        ) : (
                             <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('editProfile.usernameChoose')}</p>
                        )}
                        {!profile?.username && usernameStatus === 'taken' && <p className="text-xs text-red-600 mt-1">{t('editProfile.usernameTaken')}</p>}
                    </div>


                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('editProfile.profilePhoto')}</label>
                        <div className="flex items-center gap-4">
                            <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-zinc-700 flex-shrink-0 overflow-hidden">
                                 {avatarPreview ? (
                                    <img src={avatarPreview} alt={t('editProfile.profilePhoto')} width={80} height={80} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                        <i className="fa-solid fa-user text-3xl"></i>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="py-2 px-4 rounded-full text-sm font-semibold bg-green-50 dark:bg-green-900/50 text-brand-green dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900 cursor-pointer transition-colors">
                                    {t('editProfile.chooseFile')}
                                    <input
                                        type="file"
                                        accept="image/png, image/jpeg"
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />
                                </label>
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                    {avatarFile ? avatarFile.name : t('editProfile.noFileChosen')}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex items-center justify-end gap-4">
                         <button type="button" onClick={() => navigate(`/${pathTranslations[language].profile}`)} className="text-sm font-semibold text-gray-600 dark:text-gray-300 hover:underline">
                            {t('editProfile.cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={loading || (!profile?.username && usernameStatus !== 'available')}
                            className="bg-brand-green text-white font-bold py-2 px-6 rounded-lg hover:bg-opacity-90 transition-colors shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading && <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                            <span>{loading ? t('editProfile.saving') : t('editProfile.saveChanges')}</span>
                        </button>
                    </div>
                </form>

                <div className="mt-8 pt-6 border-t dark:border-zinc-700">
                    <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">{t('editProfile.pushNotifications')}</h2>
                    <div className="flex items-center justify-between mt-2">
                        <p className="text-sm text-gray-600 dark:text-gray-400">{t('editProfile.pushNotificationsDesc')}</p>
                        <button
                            onClick={handleTogglePushNotifications}
                            disabled={pushLoading}
                            className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors disabled:opacity-50 ${
                                isPushSubscribed
                                ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300 dark:hover:bg-red-900'
                                : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-300 dark:hover:bg-green-900'
                            }`}
                        >
                            {pushLoading ? t('editProfile.loading') : isPushSubscribed ? t('editProfile.deactivate') : t('editProfile.activate')}
                        </button>
                    </div>
                </div>

            </div>
        </>
    );
};

export default EditProfilePage;