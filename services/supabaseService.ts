import { createClient } from '@supabase/supabase-js';
import { slugify } from '../utils/slugify';

// Initialize Supabase client - Updated 2025-12-16 with performance optimizations
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: {
      'x-client-info': 'opynio-web',
    },
  },
  db: {
    schema: 'public',
  },
  realtime: {
    params: {
      eventsPerSecond: 2,
    },
  },
});

// ==================== SIMPLE IN-MEMORY CACHE ====================
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes default
const SHORT_CACHE_TTL = 60 * 1000; // 1 minute for frequently changing data

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(key: string, data: T, ttl: number = CACHE_TTL): void {
  cache.set(key, { data, timestamp: Date.now() });
  // Clean old entries periodically
  if (cache.size > 100) {
    const now = Date.now();
    for (const [k, v] of cache.entries()) {
      if (now - v.timestamp > ttl) cache.delete(k);
    }
  }
}

export function clearCache(pattern?: string): void {
  if (!pattern) {
    cache.clear();
  } else {
    for (const key of cache.keys()) {
      if (key.includes(pattern)) cache.delete(key);
    }
  }
}

// ==================== AUTH FUNCTIONS ====================

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
};

export const signInWithGoogle = async () => {
  // IMPORTANTE: la ruta tiene que coincidir con el path en español ("post-acceso").
  // En el dominio raíz, LanguagePathValidator SOLO acepta paths en español; si
  // pasamos "/post-login" (literal en inglés/it/br) el validator dispara
  // window.location.replace('/404') antes de que PostLoginRedirect pueda correr.
  const redirectTo = `${window.location.origin}/post-acceso`;
  console.log('[signInWithGoogle] starting OAuth', { redirectTo });
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });
  if (error) {
    console.error('[signInWithGoogle] OAuth init error', error);
    throw error;
  }
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const signUp = async (email: string, password: string, fullName: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });
  if (error) throw error;
  return data;
};

export const resetPassword = async (email: string) => {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
  return data;
};

export const updatePassword = async (newPassword: string) => {
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
  return data;
};

export const signUpUser = async (email: string, password: string, fullName: string, username: string) => {
  console.log('[signUpUser] auth.signUp', { email, fullName, username });
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        username: username,
        role: 'user',
      },
    },
  });
  if (error) {
    console.error('[signUpUser] auth.signUp error', error);
    throw error;
  }
  console.log('[signUpUser] auth.signUp ok', { userId: data.user?.id, hasSession: !!data.session });
  return data;
};

export const signUpBusiness = async (
  email: string,
  password: string,
  businessName: string,
  username: string,
  country?: string,
  contactName?: string,
) => {
  // role/business_name/country viajan en raw_user_meta_data sólo para que
  // PostLoginRedirect detecte la intención de signup-empresa cuando el usuario
  // confirma el email en otro dispositivo (donde localStorage no llega).
  // El profile siempre se crea como 'authenticated'; la promoción a
  // 'business_owner' ocurre explícitamente en CompleteBusinessRegistrationPage.
  const metadata = {
    full_name: contactName?.trim() || businessName,
    username,
    intended_role: 'business_owner',
    business_name: businessName,
    ...(country ? { country } : {}),
  };
  console.log('[signUpBusiness] auth.signUp', { email, metadata });
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: metadata },
  });
  if (error) {
    console.error('[signUpBusiness] auth.signUp error', error);
    throw error;
  }
  console.log('[signUpBusiness] auth.signUp ok', { userId: data.user?.id, hasSession: !!data.session });
  return data;
};

export const signInWithGoogleForBusiness = async () => {
  // Misma razón que en signInWithGoogle: usar el path en español ("post-acceso")
  // o LanguagePathValidator nos vota a /404 antes de que PostLoginRedirect arranque.
  // El query ?type=business viaja con el redirect y le dice a PostLoginRedirect
  // que debe enrutarse a CompleteBusinessRegistrationPage. Esto es resistente
  // a que localStorage se pierda durante el OAuth (Edge a veces lo limpia, y
  // Google OAuth no permite custom user_metadata como en email signup).
  const redirectTo = `${window.location.origin}/post-acceso?type=business`;
  console.log('[signInWithGoogleForBusiness] starting OAuth', { redirectTo });
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });
  if (error) {
    console.error('[signInWithGoogleForBusiness] OAuth init error', error);
    throw error;
  }
  return data;
};

export const sendPasswordResetEmail = async (email: string) => {
  return resetPassword(email);
};

export const updateUserPassword = async (newPassword: string) => {
  return updatePassword(newPassword);
};

export const isUsernameTaken = async (username: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('username')
    .eq('username', username)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
};

// ==================== USER PROFILE FUNCTIONS ====================

export const getUserProfile = async (userIdOrUser: string | { id: string }) => {
  // Handle both string userId and User object
  const userId = typeof userIdOrUser === 'string' ? userIdOrUser : userIdOrUser.id;

  // Check cache first (short TTL for user data)
  const cacheKey = `profile_${userId}`;
  const cached = getCached<any>(cacheKey);
  if (cached !== null) return cached;

  // Use maybeSingle() instead of single() to return null instead of error when profile doesn't exist
  // This allows AuthContext to create a new profile for new users
  // Use select('*') to avoid errors from non-existent columns (email, bio don't exist in profiles table)
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;

  // Only cache if we found data
  if (data) {
    setCache(cacheKey, data, SHORT_CACHE_TTL);
  }
  return data;
};

export const updateUserProfile = async (userId: string, updates: any) => {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  // Clear cache after update
  clearCache(`profile_${userId}`);
  return data;
};

export const updateUserRole = async (userId: string, role: string, businessName?: string) => {
  // If upgrading to business_owner and businessName is provided, create the business first
  if (role === 'business_owner' && businessName) {
    // Generar slug automáticamente
    const slug = await generateUniqueSlug(businessName);

    // Create the business
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .insert([{
        name: businessName,
        slug: slug || null,
        category: 'General', // Default category when admin assigns
        country: 'ES', // Default country - can be updated later
        owner_id: userId,
      }])
      .select()
      .single();

    if (businessError) throw businessError;
  }

  // Update the user's role
  const { data, error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Old function signature - kept for backward compatibility
export const upgradeUserToBusinessOwnerLegacy = async (userId: string, businessId: string, plan: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      role: 'business_owner',
      plan,
    })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

// Calls the SECURITY DEFINER RPC that creates the business and promotes the user to
// business_owner atomically. Plan changes are server-controlled (only Stripe webhook
// can set paid plans), and the role-change trigger guard accepts the call because the
// RPC runs as postgres. Direct UPDATE on profiles.role from the client is blocked.
export const upgradeUserToBusinessOwner = async (params: {
  businessName: string;
  category: string;
  plan: string;
  country: string;
  description?: string;
  logo_url?: string;
  google_maps_url?: string;
  latitude?: number;
  longitude?: number;
}): Promise<string> => {
  const { data, error } = await supabase.rpc('upgrade_user_to_business_owner', {
    p_business_name: params.businessName,
    p_category: params.category,
    p_plan: params.plan, // server-side ignored; kept for signature compatibility
    p_country: params.country,
    p_description: params.description ?? null,
    p_logo_url: params.logo_url ?? null,
    p_google_maps_url: params.google_maps_url ?? null,
    p_latitude: params.latitude ?? null,
    p_longitude: params.longitude ?? null,
  });
  if (error) throw error;
  return data as string;
};

// ==================== BUSINESS FUNCTIONS ====================

export const getBusinessByName = async (name: string) => {
  try {
    // Check cache first
    const cacheKey = `business_name_${name.toLowerCase().trim()}`;
    const cached = getCached<any>(cacheKey);
    if (cached !== null) return cached;

    // Normalize the name
    const normalizedName = name
      .replace(/[\u2502\u00A6\u2758]/g, '|')
      .normalize('NFC')
      .trim();

    // Try exact match first (most common case)
    const { data: exactMatch, error: exactError } = await supabase
      .from('businesses')
      .select('*')
      .eq('name', normalizedName)
      .maybeSingle();

    if (exactMatch) {
      setCache(cacheKey, exactMatch);
      return exactMatch;
    }

    // Try case-insensitive match
    const { data: ilikeResults, error: ilikeError } = await supabase
      .from('businesses')
      .select('*')
      .ilike('name', normalizedName)
      .limit(1);

    if (ilikeResults && ilikeResults.length > 0) {
      setCache(cacheKey, ilikeResults[0]);
      return ilikeResults[0];
    }

    // Try partial match with wildcards
    const escapedName = normalizedName.replace(/[%_\\]/g, '\\$&');
    const { data: partialResults, error: partialError } = await supabase
      .from('businesses')
      .select('*')
      .ilike('name', `%${escapedName}%`)
      .limit(3);

    if (partialResults && partialResults.length > 0) {
      // Find best match
      const lowerName = normalizedName.toLowerCase();
      const bestMatch = partialResults.find(b => b.name.toLowerCase() === lowerName) || partialResults[0];
      setCache(cacheKey, bestMatch);
      return bestMatch;
    }

    // Try partial match with first part of name (for names with separators)
    const firstPart = normalizedName.split(/[|,]/)[0].trim();
    if (firstPart && firstPart.length > 3 && firstPart !== normalizedName) {
      const escapedFirstPart = firstPart.replace(/[%_\\]/g, '\\$&');
      const { data: firstPartResults } = await supabase
        .from('businesses')
        .select('*')
        .ilike('name', `${escapedFirstPart}%`)
        .limit(3);

      if (firstPartResults && firstPartResults.length > 0) {
        setCache(cacheKey, firstPartResults[0]);
        return firstPartResults[0];
      }
    }

    setCache(cacheKey, null);
    return null;
  } catch (error) {
    console.error('Error in getBusinessByName:', error);
    return null;
  }
};

export const getBusinessById = async (id: string) => {
  // Check cache first
  const cacheKey = `business_id_${id}`;
  const cached = getCached<any>(cacheKey);
  if (cached !== null) return cached;

  // Use select('*') to avoid errors from non-existent columns
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;

  setCache(cacheKey, data);
  return data;
};

export const getBusinessesForOwner = async (userId: string) => {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', userId);
  if (error) throw error;
  return data || [];
};

export const getBusinessListItemById = async (id: string) => {
  const { data, error } = await supabase
    .from('businesses')
    .select('id, name, category, country, logo_url')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
};

export const searchBusinessList = async (searchTerm: string) => {
  // Helper function for accent-insensitive search
  const removeAccents = (text: string): string => {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  };

  // Fetch all businesses (or limit to reasonable amount)
  const { data, error } = await supabase
    .from('businesses')
    .select('id, name, category, country, description')
    .limit(200);

  if (error) throw error;
  if (!data) return [];

  // Apply client-side accent-insensitive search
  const normalizedSearch = removeAccents(searchTerm);
  const filtered = data.filter(business => {
    const normalizedName = removeAccents(business.name || '');
    const normalizedCategory = removeAccents(business.category || '');
    const normalizedDescription = removeAccents(business.description || '');
    return normalizedName.includes(normalizedSearch) ||
           normalizedCategory.includes(normalizedSearch) ||
           normalizedDescription.includes(normalizedSearch);
  });

  return filtered.slice(0, 10); // Return top 10 results
};

export const getBusinessIdAndNameList = async (searchTerm: string = '') => {
  // Helper function for accent-insensitive search
  const removeAccents = (text: string): string => {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  };

  let query = supabase
    .from('businesses')
    .select('id, name, country, category, description')
    .order('name');

  const { data, error } = await query.limit(200);
  if (error) throw error;
  if (!data) return [];

  // If no search term, return all results (up to limit)
  if (!searchTerm) {
    return data.slice(0, 50);
  }

  // Apply client-side accent-insensitive search
  const normalizedSearch = removeAccents(searchTerm);
  const filtered = data.filter(business => {
    const normalizedName = removeAccents(business.name || '');
    const normalizedCategory = removeAccents(business.category || '');
    const normalizedDescription = removeAccents(business.description || '');
    return normalizedName.includes(normalizedSearch) ||
           normalizedCategory.includes(normalizedSearch) ||
           normalizedDescription.includes(normalizedSearch);
  });

  return filtered.slice(0, 50);
};

export const getBusinessesWithLocations = async (country?: string) => {
  let query = supabase
    .from('businesses')
    .select('id, name, category, country, latitude, longitude, sedes, logo_url')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);

  if (country) {
    query = query.eq('country', country);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const updateBusinessProfile = async (businessId: string, updates: any) => {
  const { data, error } = await supabase
    .from('businesses')
    .update(updates)
    .eq('id', businessId)
    .select()
    .single();
  if (error) throw error;
  // Clear business cache after update
  clearCache(`business_id_${businessId}`);
  clearCache('business_name_');
  return data;
};

export const userCreateBusiness = async (businessData: any) => {
  // Generar slug automáticamente si no viene en los datos y hay nombre
  if (!businessData.slug && businessData.name) {
    businessData.slug = await generateUniqueSlug(businessData.name);
  }

  const { data, error } = await supabase
    .from('businesses')
    .insert([businessData])
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const getAllPublicBusinessesForDirectory = async () => {
  try {
    // Use the optimized RPC function to get businesses with review stats
    const { data: businesses, error } = await supabase
      .rpc('get_businesses_with_review_stats');

    if (error) {
      console.error('Error calling RPC function:', error);
      throw error;
    }

    if (!businesses || businesses.length === 0) {
      console.log('No businesses found');
      return [];
    }

    // Convert numeric types to numbers and add average_rating for compatibility
    const enrichedBusinesses = businesses.map(b => ({
      ...b,
      avg_rating: Number(b.avg_rating) || 0,
      average_rating: Number(b.avg_rating) || 0,
      review_count: Number(b.review_count) || 0
    }));

    console.log(`✅ Loaded ${enrichedBusinesses.length} businesses`);
    console.log(`✅ With reviews: ${enrichedBusinesses.filter(b => b.review_count > 0).length}`);
    // console.log(`✅ Businesses marked for monthly scrape: ${enrichedBusinesses.filter(b => b.is_selected_for_monthly_scrape).length}`);

    // Log first 5 businesses to check ordering
    console.log('📋 First 5 businesses:', enrichedBusinesses.slice(0, 5).map(b => ({
      name: b.name,
      // is_monthly: b.is_selected_for_monthly_scrape, // DEPRECATED
      reviews: b.review_count
    })));

    return enrichedBusinesses;
  } catch (error) {
    console.error('Error in getAllPublicBusinessesForDirectory:', error);
    throw error;
  }
};

// Paginated version for directory - loads businesses in batches to avoid timeouts
export const getBusinessesForDirectoryPaginated = async (
  page: number = 1,
  pageSize: number = 10,
  filters?: {
    searchTerm?: string;
    category?: string;
    countries?: string[];
    minRating?: number;
    maxRating?: number;
    serviceType?: 'all' | 'local' | 'international';
    sortOrder?: 'relevance' | 'alphabetical' | 'rating' | 'reviews';
  }
): Promise<{ businesses: any[]; totalCount: number; hasMore: boolean }> => {
  try {
    const offset = (page - 1) * pageSize;

    // Helper function for accent-insensitive search
    const removeAccents = (text: string): string => {
      return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    };

    // Build query - Note: 'city' doesn't exist as a column, it's derived from sedes
    let query = supabase
      .from('businesses')
      .select(`
        id, name, country, logo_url, category, description,
        latitude, longitude, sedes, offers_international_services
      `, { count: 'exact' });

    // Apply filters
    // NOTE: searchTerm filter is applied client-side for accent-insensitive search
    // We don't apply .ilike() here to fetch more results

    if (filters?.category) {
      query = query.ilike('category', `${filters.category}%`);
    }

    if (filters?.countries && filters.countries.length > 0) {
      query = query.in('country', filters.countries);
    }

    if (filters?.serviceType === 'international') {
      query = query.eq('offers_international_services', true);
    }

    // Apply sorting
    switch (filters?.sortOrder) {
      case 'alphabetical':
        query = query.order('name', { ascending: true });
        break;
      case 'rating':
        // Note: avg_rating may not be in the table, will need to handle this
        query = query.order('name', { ascending: true });
        break;
      case 'reviews':
        query = query.order('name', { ascending: true });
        break;
      default:
        // relevance - order by most reviews (name as fallback since review_count isn't a column)
        query = query.order('name', { ascending: true });
    }

    // When searching or filtering by rating, fetch ALL results to filter client-side
    // This is necessary because avg_rating is calculated from reviews, not stored in businesses table
    const hasRatingFilterQuery = (filters?.minRating !== undefined && filters.minRating > 1) ||
                                  (filters?.maxRating !== undefined && filters.maxRating < 5);
    const needsAllResults = filters?.searchTerm || hasRatingFilterQuery;

    if (!needsAllResults) {
      // Apply normal pagination only when NOT searching and NOT filtering by rating
      query = query.range(offset, offset + pageSize - 1);
    }
    // If searchTerm or rating filter exists, we fetch all results (no range limit)

    const { data: businesses, error, count } = await query;

    if (error) {
      console.error('Error fetching paginated businesses:', error);
      throw error;
    }

    if (!businesses) {
      return { businesses: [], totalCount: 0, hasMore: false };
    }

    // Apply client-side accent-insensitive search filter
    let filteredBusinesses = businesses;
    if (filters?.searchTerm) {
      const normalizedSearch = removeAccents(filters.searchTerm);

      // Filter businesses that match name OR description
      filteredBusinesses = businesses.filter(b => {
        const normalizedName = removeAccents(b.name || '');
        const normalizedDescription = removeAccents(b.description || '');
        return normalizedName.includes(normalizedSearch) ||
               normalizedDescription.includes(normalizedSearch);
      });

      // Sort results: prioritize name matches over description matches
      filteredBusinesses.sort((a, b) => {
        const aNameMatch = removeAccents(a.name || '').includes(normalizedSearch);
        const bNameMatch = removeAccents(b.name || '').includes(normalizedSearch);

        // Name matches come first
        if (aNameMatch && !bNameMatch) return -1;
        if (!aNameMatch && bNameMatch) return 1;

        // Among name matches, prioritize those that START with the search term
        if (aNameMatch && bNameMatch) {
          const aStartsWith = removeAccents(a.name || '').startsWith(normalizedSearch);
          const bStartsWith = removeAccents(b.name || '').startsWith(normalizedSearch);
          if (aStartsWith && !bStartsWith) return -1;
          if (!aStartsWith && bStartsWith) return 1;
        }

        return 0;
      });
    }

    // Get review stats for these businesses (both Opynio and Google reviews are in the same table)
    const businessIds = filteredBusinesses.map(b => b.id);
    const statsMap = new Map<string, { count: number; totalRating: number }>();

    // Only fetch review stats if we have business IDs
    if (businessIds.length > 0) {
      // Fetch reviews in batches to avoid URL length limits
      // Reduced batch size to 25 to ensure we don't hit row limits when businesses have many reviews
      const BATCH_SIZE = 25;
      const batches = [];
      for (let i = 0; i < businessIds.length; i += BATCH_SIZE) {
        batches.push(businessIds.slice(i, i + BATCH_SIZE));
      }

      for (const batch of batches) {
        // IMPORTANT: Supabase has a default limit of 1000 rows per query
        // We need to set a higher limit to get all reviews for businesses with many reviews
        // Using 10000 as limit to ensure we get all reviews for each batch
        const { data: reviewStats, error: reviewError } = await supabase
          .from('reviews')
          .select('business_id, rating')
          .in('business_id', batch)
          .eq('status', 'approved')
          .lte('created_at', new Date().toISOString())
          .gt('rating', 0)
          .limit(10000);

        if (reviewError) {
          console.error('Error fetching review stats:', reviewError);
          continue;
        }

        // Calculate avg_rating and review_count for each business (includes all sources: Opynio + Google)
        if (reviewStats) {
          reviewStats.forEach(r => {
            // Only count reviews that have a valid rating (not null, not 0)
            if (r.rating && r.rating > 0) {
              const current = statsMap.get(r.business_id) || { count: 0, totalRating: 0 };
              statsMap.set(r.business_id, {
                count: current.count + 1,
                totalRating: current.totalRating + r.rating
              });
            }
          });
        }
      }
    }

    const enrichedBusinesses = filteredBusinesses.map(b => {
      const stats = statsMap.get(b.id);
      const reviewCount = stats?.count || 0;
      const avgRating = reviewCount > 0 ? stats!.totalRating / reviewCount : 0;
      return {
        ...b,
        avg_rating: avgRating,
        average_rating: avgRating,
        review_count: reviewCount
      };
    });

    // Sort by rating or reviews if needed (after enrichment)
    if (filters?.sortOrder === 'rating') {
      enrichedBusinesses.sort((a, b) => b.avg_rating - a.avg_rating);
    } else if (filters?.sortOrder === 'reviews') {
      enrichedBusinesses.sort((a, b) => b.review_count - a.review_count);
    }

    // Apply rating filter AFTER enrichment (since avg_rating comes from reviews)
    // This must happen BEFORE pagination to get correct counts
    let ratingFilteredBusinesses = enrichedBusinesses;
    if (filters?.minRating !== undefined || filters?.maxRating !== undefined) {
      const minRating = filters?.minRating ?? 0;
      const maxRating = filters?.maxRating ?? 5;
      // Only apply filter if it's not the full range (0-5 or 1-5)
      if (minRating > 1 || maxRating < 5) {
        ratingFilteredBusinesses = enrichedBusinesses.filter(b => {
          const rating = b.avg_rating || 0;
          return rating >= minRating && rating <= maxRating;
        });
      }
    }

    // Apply pagination to filtered results
    // When we have a searchTerm or rating filter, we need client-side pagination
    let paginatedBusinesses = ratingFilteredBusinesses;
    let finalTotalCount = count || 0;

    // Check if rating filter is active (not full range)
    const hasRatingFilter = (filters?.minRating !== undefined && filters?.minRating > 1) ||
                            (filters?.maxRating !== undefined && filters?.maxRating < 5);
    const needsClientSidePagination = filters?.searchTerm || hasRatingFilter;

    if (needsClientSidePagination) {
      // Use filtered count and apply pagination client-side
      finalTotalCount = ratingFilteredBusinesses.length;
      const startIdx = offset;
      const endIdx = offset + pageSize;
      paginatedBusinesses = ratingFilteredBusinesses.slice(startIdx, endIdx);
    }

    const hasMore = needsClientSidePagination
      ? offset + paginatedBusinesses.length < finalTotalCount
      : offset + filteredBusinesses.length < (count || 0);

    console.log(`📋 Loaded page ${page}: ${paginatedBusinesses.length} businesses (${offset + 1}-${offset + paginatedBusinesses.length} of ${finalTotalCount})`);

    return { businesses: paginatedBusinesses, totalCount: finalTotalCount, hasMore };
  } catch (error) {
    console.error('Error in getBusinessesForDirectoryPaginated:', error);
    throw error;
  }
};

// Get total count of businesses with optional filters (for progress bar)
export const getTotalBusinessCount = async (
  filters?: {
    searchTerm?: string;
    category?: string;
    countries?: string[];
    serviceType?: 'all' | 'local' | 'international';
  }
): Promise<number> => {
  try {
    // Helper function for accent-insensitive search
    const removeAccents = (text: string): string => {
      return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    };

    // When searching, we need to fetch and filter client-side
    if (filters?.searchTerm) {
      let query = supabase
        .from('businesses')
        .select('id, name, description');

      if (filters?.category) {
        query = query.ilike('category', `${filters.category}%`);
      }

      if (filters?.countries && filters.countries.length > 0) {
        query = query.in('country', filters.countries);
      }

      if (filters?.serviceType === 'international') {
        query = query.eq('offers_international_services', true);
      }

      // Fetch ALL results when searching (no limit)
      const { data, error } = await query;

      if (error) {
        console.error('Error getting total business count:', error);
        return 0;
      }

      if (!data) return 0;

      // Apply accent-insensitive filter
      const normalizedSearch = removeAccents(filters.searchTerm);
      const filtered = data.filter(b => {
        const normalizedName = removeAccents(b.name || '');
        const normalizedDescription = removeAccents(b.description || '');
        return normalizedName.includes(normalizedSearch) ||
               normalizedDescription.includes(normalizedSearch);
      });

      return filtered.length;
    }

    // No search term - use regular count query
    let query = supabase
      .from('businesses')
      .select('id', { count: 'exact', head: true });

    if (filters?.category) {
      query = query.ilike('category', `${filters.category}%`);
    }

    if (filters?.countries && filters.countries.length > 0) {
      query = query.in('country', filters.countries);
    }

    if (filters?.serviceType === 'international') {
      query = query.eq('offers_international_services', true);
    }

    const { count, error } = await query;

    if (error) {
      console.error('Error getting total business count:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('Error in getTotalBusinessCount:', error);
    return 0;
  }
};

// New function: Get businesses paginated with their reviews (for ExplorePage)
export const getBusinessesWithReviewsPaginated = async (
  filters: {
    category?: string;
    country?: string;
    searchTerm?: string;
    businessIds?: string[]; // For location-based filtering
    // Review filters
    minRating?: number;
    dateFilter?: { type: string; startDate?: string; endDate?: string };
    verifiedFilter?: 'all' | 'verified' | 'unverified';
    formatFilter?: string[]; // 'text', 'images', 'audio', 'with_response'
    sortOrder?: string;
  } = {},
  page: number = 1,
  pageSize: number = 10,
  excludeIds: string[] = []
) => {
  try {
    // Helper function for accent-insensitive search
    const removeAccents = (text: string): string => {
      return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    };

    // Build business query - only select columns that exist in the table
    // review_count, avg_rating, and offers_international_services don't exist as columns
    let businessQuery = supabase
      .from('businesses')
      .select('id, name, country, logo_url, category, sedes, description');

    // NOTE: searchTerm filter will be applied client-side for accent-insensitive search
    // We don't apply .ilike() here

    // Apply category filter
    if (filters.category) {
      businessQuery = businessQuery.ilike('category', `${filters.category}%`);
    }

    // Apply businessIds filter (for location-based)
    if (filters.businessIds && filters.businessIds.length > 0) {
      businessQuery = businessQuery.in('id', filters.businessIds);
    }

    // Exclude already loaded businesses
    if (excludeIds.length > 0) {
      businessQuery = businessQuery.not('id', 'in', `(${excludeIds.join(',')})`);
    }

    // Get all matching businesses first
    const { data: allBusinesses, error: businessError } = await businessQuery;

    if (businessError) {
      console.error('Error fetching businesses:', businessError);
      throw businessError;
    }

    if (!allBusinesses || allBusinesses.length === 0) {
      return { businesses: [], hasMore: false };
    }

    // Apply client-side accent-insensitive search filter
    let filteredBusinesses = allBusinesses;
    if (filters.searchTerm) {
      const normalizedSearch = removeAccents(filters.searchTerm);
      filteredBusinesses = allBusinesses.filter(b => {
        const normalizedName = removeAccents(b.name || '');
        const normalizedCategory = removeAccents(b.category || '');
        const normalizedDescription = removeAccents(b.description || '');
        return normalizedName.includes(normalizedSearch) ||
               normalizedCategory.includes(normalizedSearch) ||
               normalizedDescription.includes(normalizedSearch);
      });
    }

    // Filter by country (including sedes) if specified
    if (filters.country) {
      filteredBusinesses = filteredBusinesses.filter(business => {
        // Check if main country matches
        if (business.country === filters.country) {
          return true;
        }
        // Check if any sede has this country_code
        const sedes = business.sedes as any[] || [];
        return sedes.some(sede => sede.country_code === filters.country);
      });
    }

    // Sort by name for consistent ordering (no shuffle - pagination needs consistent order)
    filteredBusinesses.sort((a, b) => a.name.localeCompare(b.name));

    // Simple pagination: just take pageSize items
    // excludeIds is already used above to filter out loaded businesses
    const paginatedBusinesses = filteredBusinesses.slice(0, pageSize);
    const hasMore = filteredBusinesses.length > pageSize;

    if (paginatedBusinesses.length === 0) {
      return { businesses: [], hasMore: false };
    }

    // Get reviews for these businesses (all approved reviews for counting, but we'll only display 3)
    const businessIds = paginatedBusinesses.map(b => b.id);
    let reviewQuery = supabase
      .from('reviews')
      .select('*, profiles:user_id(id, name, avatar_url)')
      .in('business_id', businessIds)
      .eq('status', 'approved')
      .lte('created_at', new Date().toISOString());

    // Apply rating filter
    if (filters.minRating && filters.minRating > 0) {
      reviewQuery = reviewQuery.gte('rating', filters.minRating);
    }

    // Note: verified filter disabled - is_verified column doesn't exist, use is_verified_purchase instead
    // Note: format filters disabled - has_images, has_audio, business_response columns don't exist

    // Apply date filter
    if (filters.dateFilter && filters.dateFilter.type !== 'all') {
      const now = new Date();
      let startDate: Date | null = null;

      switch (filters.dateFilter.type) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          break;
        case 'year':
          startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
          break;
        case 'custom':
          if (filters.dateFilter.startDate) {
            startDate = new Date(filters.dateFilter.startDate);
          }
          if (filters.dateFilter.endDate) {
            reviewQuery = reviewQuery.lte('created_at', filters.dateFilter.endDate + 'T23:59:59');
          }
          break;
      }

      if (startDate) {
        reviewQuery = reviewQuery.gte('created_at', startDate.toISOString());
      }
    }

    // Apply sort order
    if (filters.sortOrder === 'oldest') {
      reviewQuery = reviewQuery.order('created_at', { ascending: true });
    } else if (filters.sortOrder === 'highest') {
      reviewQuery = reviewQuery.order('rating', { ascending: false });
    } else if (filters.sortOrder === 'lowest') {
      reviewQuery = reviewQuery.order('rating', { ascending: true });
    } else {
      reviewQuery = reviewQuery.order('created_at', { ascending: false });
    }

    const { data: reviews, error: reviewsError } = await reviewQuery;

    if (reviewsError) {
      console.error('Error fetching reviews:', reviewsError);
    }

    // Group all reviews by business to calculate totals, but limit display to 3
    const reviewsByBusiness = new Map<string, any[]>();
    const reviewCountByBusiness = new Map<string, number>();
    const ratingTotalByBusiness = new Map<string, number>();

    (reviews || []).forEach(review => {
      // Count all reviews
      const currentCount = reviewCountByBusiness.get(review.business_id) || 0;
      reviewCountByBusiness.set(review.business_id, currentCount + 1);

      // Sum ratings for average
      const currentRatingTotal = ratingTotalByBusiness.get(review.business_id) || 0;
      ratingTotalByBusiness.set(review.business_id, currentRatingTotal + (review.rating || 0));

      // Keep only first 3 reviews for display
      const businessReviews = reviewsByBusiness.get(review.business_id) || [];
      if (businessReviews.length < 3) {
        businessReviews.push(review);
        reviewsByBusiness.set(review.business_id, businessReviews);
      }
    });

    // Combine businesses with their reviews and calculated stats
    const businessesWithReviews = paginatedBusinesses.map(business => {
      const reviewCount = reviewCountByBusiness.get(business.id) || 0;
      const ratingTotal = ratingTotalByBusiness.get(business.id) || 0;
      const avgRating = reviewCount > 0 ? ratingTotal / reviewCount : 0;

      return {
        business: {
          ...business,
          review_count: reviewCount,
          avg_rating: Math.round(avgRating * 10) / 10 // Round to 1 decimal
        },
        reviews: reviewsByBusiness.get(business.id) || []
      };
    });

    return { businesses: businessesWithReviews, hasMore };
  } catch (error) {
    console.error('Error in getBusinessesWithReviewsPaginated:', error);
    throw error;
  }
};

// Lightweight function: Get businesses with stats only (no full reviews) - for HomePage slider
export const getBusinessesWithStatsOnly = async (
  country?: string,
  limit: number = 10
) => {
  try {
    // Step 1: Get LIMITED businesses (max 50 to avoid query issues)
    // We'll shuffle them first on the server side with random order
    let businessQuery = supabase
      .from('businesses')
      .select('id, name, country, logo_url, category, sedes')
      .limit(50); // Limit to prevent too many IDs in .in() clause

    if (country) {
      businessQuery = businessQuery.eq('country', country);
    }

    const { data: businesses, error: businessError } = await businessQuery;

    if (businessError) {
      console.error('Error fetching businesses:', businessError);
      throw businessError;
    }

    if (!businesses || businesses.length === 0) {
      return [];
    }

    // Step 2: Shuffle businesses FIRST, then take only what we need for review query
    const shuffleArray = <T>(arr: T[]): T[] => {
      const shuffled = [...arr];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };

    const shuffledBusinesses = shuffleArray(businesses);
    // Take more than limit to have backup options if some don't have reviews
    const businessesToQuery = shuffledBusinesses.slice(0, Math.min(30, shuffledBusinesses.length));

    // Step 3: Get review stats ONLY for limited businesses
    const businessIds = businessesToQuery.map(b => b.id);
    const { data: reviews, error: reviewsError } = await supabase
      .from('reviews')
      .select('business_id, rating')
      .in('business_id', businessIds)
      .eq('status', 'approved')
      .lte('created_at', new Date().toISOString());

    if (reviewsError) {
      console.error('Error fetching review stats:', reviewsError);
      // Return businesses without stats
      return businessesToQuery.slice(0, limit).map(b => ({
        ...b,
        review_count: 0,
        avg_rating: 0
      }));
    }

    // Step 4: Calculate stats per business
    const reviewCountByBusiness = new Map<string, number>();
    const ratingTotalByBusiness = new Map<string, number>();

    (reviews || []).forEach(review => {
      const currentCount = reviewCountByBusiness.get(review.business_id) || 0;
      reviewCountByBusiness.set(review.business_id, currentCount + 1);

      const currentRatingTotal = ratingTotalByBusiness.get(review.business_id) || 0;
      ratingTotalByBusiness.set(review.business_id, currentRatingTotal + (review.rating || 0));
    });

    // Step 5: Enrich businesses with calculated stats
    const enrichedBusinesses = businessesToQuery.map(business => {
      const reviewCount = reviewCountByBusiness.get(business.id) || 0;
      const ratingTotal = ratingTotalByBusiness.get(business.id) || 0;
      const avgRating = reviewCount > 0 ? ratingTotal / reviewCount : 0;

      return {
        ...business,
        review_count: reviewCount,
        avg_rating: Math.round(avgRating * 10) / 10
      };
    });

    // Step 6: Prioritize businesses WITH reviews, then fill with others
    const withReviews = enrichedBusinesses.filter(b => b.review_count > 0);
    const withoutReviews = enrichedBusinesses.filter(b => b.review_count === 0);

    // Already shuffled, just combine with priority
    const result = [...withReviews, ...withoutReviews].slice(0, limit);

    console.log('📊 BusinessesWithStats:', {
      total: result.length,
      withReviews: withReviews.length,
      sample: result.slice(0, 3).map(b => ({ name: b.name, rating: b.avg_rating, count: b.review_count }))
    });

    return result;
  } catch (error) {
    console.error('Error in getBusinessesWithStatsOnly:', error);
    return [];
  }
};

// Get featured businesses (is_featured=true) with calculated stats from reviews
export const getFeaturedBusinessesWithStats = async (
  country?: string,
  limit: number = 10
) => {
  try {
    // Step 1: Get featured businesses (limited to avoid timeout)
    let businessQuery = supabase
      .from('businesses')
      .select('id, name, country, logo_url, category, sedes, is_featured')
      .eq('is_featured', true)
      .limit(30); // Limit to avoid timeout

    if (country) {
      businessQuery = businessQuery.eq('country', country);
    }

    const { data: featuredBusinesses, error: featuredError } = await businessQuery;

    if (featuredError) {
      console.error('Error fetching featured businesses:', featuredError);
    }

    // Shuffle featured businesses
    const shuffledFeatured = (featuredBusinesses || []).sort(() => Math.random() - 0.5);

    // If we have enough featured businesses, return them
    if (shuffledFeatured.length >= limit) {
      return await enrichBusinessesWithStats(shuffledFeatured.slice(0, limit));
    }

    // Step 2: If not enough featured, fill with random businesses
    const featuredIds = shuffledFeatured.map(b => b.id);
    const remaining = limit - shuffledFeatured.length;

    let randomQuery = supabase
      .from('businesses')
      .select('id, name, country, logo_url, category, sedes, is_featured');

    if (country) {
      randomQuery = randomQuery.eq('country', country);
    }

    // Exclude already fetched featured businesses and limit to avoid timeout
    if (featuredIds.length > 0) {
      randomQuery = randomQuery.not('id', 'in', `(${featuredIds.join(',')})`);
    }
    randomQuery = randomQuery.limit(50); // Limit to avoid timeout

    const { data: randomBusinesses, error: randomError } = await randomQuery;

    if (randomError) {
      console.error('Error fetching random businesses:', randomError);
      // Return what we have
      if (shuffledFeatured.length > 0) {
        return await enrichBusinessesWithStats(shuffledFeatured);
      }
      return [];
    }

    // Shuffle random businesses and take what we need
    const shuffledRandom = (randomBusinesses || []).sort(() => Math.random() - 0.5).slice(0, remaining);

    // Combine featured + random
    const combined = [...shuffledFeatured, ...shuffledRandom];

    if (combined.length === 0) {
      return [];
    }

    return await enrichBusinessesWithStats(combined);
  } catch (error) {
    console.error('Error in getFeaturedBusinessesWithStats:', error);
    return [];
  }
};

// Helper function to enrich businesses with stats from reviews
// Uses individual queries per business to match BusinessPage logic exactly
const enrichBusinessesWithStats = async (businesses: any[]) => {
  if (!businesses || businesses.length === 0) return [];

  // Get stats for each business individually (matches BusinessPage logic)
  const enrichedBusinesses = await Promise.all(
    businesses.map(async (business) => {
      try {
        // Use the EXACT same function as BusinessPage
        const distribution = await getReviewRatingDistribution(business.id);

        // Calculate total and average exactly like BusinessPage does
        const totalReviews = Object.values(distribution).reduce((sum: number, count) => sum + (count as number), 0);
        let avgRating = 0;

        if (totalReviews > 0) {
          const ratingSum = Object.entries(distribution).reduce((acc, [rating, count]) => {
            return acc + (parseInt(rating, 10) * (count as number));
          }, 0);
          avgRating = ratingSum / totalReviews;
        }

        return {
          ...business,
          review_count: totalReviews,
          avg_rating: Math.round(avgRating * 10) / 10
        };
      } catch (error) {
        console.error(`Error fetching stats for ${business.name}:`, error);
        return {
          ...business,
          review_count: 0,
          avg_rating: 0
        };
      }
    })
  );

  return enrichedBusinesses;
};

// Routes through the SECURITY DEFINER RPC so the role/plan triggers don't reject the
// call. The userId arg is kept for backward-compatibility with existing callers, but
// the RPC ignores it and uses auth.uid() server-side.
export const finishBusinessSignup = async (_userId: string, businessData: any) => {
  const { data: businessId, error } = await supabase.rpc('upgrade_user_to_business_owner', {
    p_business_name: businessData.name,
    p_category: businessData.category ?? 'General',
    p_plan: 'free', // ignored server-side; paid plans flow through Stripe webhook
    p_country: businessData.country,
    p_description: businessData.description ?? null,
    p_logo_url: businessData.logo_url ?? null,
    p_google_maps_url: businessData.google_maps_url ?? null,
    p_latitude: businessData.latitude ?? null,
    p_longitude: businessData.longitude ?? null,
  });
  if (error) throw error;
  return { id: businessId };
};

export const checkGoogleMapsUrlIsTaken = async (googleMapsUrl: string) => {
  const { data, error } = await supabase
    .from('businesses')
    .select('id')
    .eq('google_maps_url', googleMapsUrl)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
};

export const checkGoogleMapsUrlExists = async (googleMapsUrl: string) => {
  return checkGoogleMapsUrlIsTaken(googleMapsUrl);
};

// ==================== REVIEW FUNCTIONS ====================

export const createReview = async (reviewData: any) => {
  const { data, error } = await supabase
    .from('reviews')
    .insert([reviewData])
    .select()
    .single();
  if (error) throw error;
  return data;
};

// Get detailed business counts for banner display
export const getBusinessCountByFilters = async (
  filters: {
    searchTerm?: string;
    category?: string;
    country?: string;
  } = {}
): Promise<{
  totalGlobal: number;       // All businesses (no filters)
  totalInCountry: number;    // Businesses in country (regardless of category)
  totalInCategory: number;   // Businesses in category (regardless of country)
  matchingAll: number;       // Businesses matching all filters
}> => {
  try {
    // Get all businesses with category, country and sedes
    const { data: allBusinesses, error: allError } = await supabase
      .from('businesses')
      .select('id, country, sedes, category');

    if (allError) {
      console.error('Error fetching all businesses:', allError);
      throw allError;
    }

    if (!allBusinesses || allBusinesses.length === 0) {
      return { totalGlobal: 0, totalInCountry: 0, totalInCategory: 0, matchingAll: 0 };
    }

    const totalGlobal = allBusinesses.length;

    // Helper to check if business is in country
    const isInCountry = (business: any, countryCode: string) => {
      if (business.country === countryCode) return true;
      const sedes = business.sedes as any[] || [];
      return sedes.some(sede => sede?.country_code === countryCode);
    };

    // Helper to check if business is in category
    const isInCategory = (business: any, category: string) => {
      return business.category && business.category.toLowerCase().startsWith(category.toLowerCase());
    };

    // Count by country only
    let totalInCountry = totalGlobal;
    if (filters.country) {
      totalInCountry = allBusinesses.filter(b => isInCountry(b, filters.country!)).length;
    }

    // Count by category only
    let totalInCategory = totalGlobal;
    if (filters.category) {
      totalInCategory = allBusinesses.filter(b => isInCategory(b, filters.category!)).length;
    }

    // Count matching all filters
    let matchingAll = allBusinesses;

    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      matchingAll = matchingAll.filter(b => b.name?.toLowerCase().includes(term));
    }

    if (filters.category) {
      matchingAll = matchingAll.filter(b => isInCategory(b, filters.category!));
    }

    if (filters.country) {
      matchingAll = matchingAll.filter(b => isInCountry(b, filters.country!));
    }

    return {
      totalGlobal,
      totalInCountry,
      totalInCategory,
      matchingAll: matchingAll.length
    };
  } catch (error) {
    console.error('Error in getBusinessCountByFilters:', error);
    return { totalGlobal: 0, totalInCountry: 0, totalInCategory: 0, matchingAll: 0 };
  }
};

// Get total count of approved reviews with optional filters
// Uses count: 'exact' for efficient counting without fetching all data
export const getTotalReviewCount = async (
  filters: {
    searchTerm?: string;
    category?: string;
    country?: string;
  } = {}
): Promise<number> => {
  try {
    // If no filters, just count all approved reviews (fast query)
    if (!filters.searchTerm && !filters.category && !filters.country) {
      const { count, error } = await supabase
        .from('reviews')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved')
        .lte('created_at', new Date().toISOString());

      if (error) {
        console.error('Error counting reviews:', error);
        return 0;
      }
      return count || 0;
    }

    // If filters are provided, first get matching business IDs
    let businessQuery = supabase
      .from('businesses')
      .select('id, country, sedes, category');

    if (filters.searchTerm) {
      const escapedTerm = filters.searchTerm.replace(/[%_\\]/g, '\\$&');
      businessQuery = businessQuery.ilike('name', `%${escapedTerm}%`);
    }

    if (filters.category) {
      businessQuery = businessQuery.ilike('category', `${filters.category}%`);
    }

    const { data: businesses, error: bizError } = await businessQuery;

    if (bizError || !businesses || businesses.length === 0) {
      return 0;
    }

    // Filter by country (including sedes)
    let filteredBusinesses = businesses;
    if (filters.country) {
      filteredBusinesses = businesses.filter(b => {
        if (b.country === filters.country) return true;
        const sedes = b.sedes as any[] || [];
        return sedes.some(sede => sede?.country_code === filters.country);
      });
    }

    if (filteredBusinesses.length === 0) {
      return 0;
    }

    // Count reviews for these businesses
    const businessIds = filteredBusinesses.map(b => b.id);

    // For large lists, we need to count in batches
    if (businessIds.length > 100) {
      let totalCount = 0;
      const BATCH_SIZE = 100;

      for (let i = 0; i < businessIds.length; i += BATCH_SIZE) {
        const batchIds = businessIds.slice(i, i + BATCH_SIZE);
        const { count, error } = await supabase
          .from('reviews')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'approved')
          .lte('created_at', new Date().toISOString())
          .in('business_id', batchIds);

        if (!error && count) {
          totalCount += count;
        }
      }
      return totalCount;
    }

    // For smaller lists, single query
    const { count, error } = await supabase
      .from('reviews')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')
      .lte('created_at', new Date().toISOString())
      .in('business_id', businessIds);

    if (error) {
      console.error('Error counting filtered reviews:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('Error in getTotalReviewCount:', error);
    return 0;
  }
};

// Helper function to get one review per business with round-robin pagination
// Creates an infinite feed where businesses repeat with different reviews
// Returns { reviews, totalCount, hasMore } for proper pagination display
const getOneReviewPerBusiness = async (
  filters: {
    searchTerm?: string;
    reviewTextSearch?: string;
    category?: string;
    rating?: { min?: number; max?: number };
    sortBy?: 'newest' | 'oldest' | 'most_helpful' | 'least_helpful';
    country?: string;
    dateFilter?: { type: string; startDate?: string; endDate?: string };
    verifiedFilter?: 'all' | 'verified' | 'unverified';
    formatFilters?: string[];
    excludeBusinessIds?: string[];
    skipCountryFilter?: boolean;
  },
  page: number,
  pageSize: number
): Promise<{ reviews: any[]; totalCount: number; hasMore: boolean }> => {
  try {
    // Step 1: Get businesses with filters (limit to avoid too many queries)
    let businessQuery = supabase
      .from('businesses')
      .select('id, name, country, logo_url, category, sedes')
      .limit(100); // Limit businesses to avoid timeout

    if (filters.searchTerm) {
      const escapedTerm = filters.searchTerm.replace(/[%_\\]/g, '\\$&');
      businessQuery = businessQuery.ilike('name', `%${escapedTerm}%`);
    }

    if (filters.category) {
      businessQuery = businessQuery.ilike('category', `${filters.category}%`);
    }

    const { data: allBusinesses, error: businessError } = await businessQuery;

    if (businessError) {
      console.error('Error fetching businesses:', businessError);
      throw businessError;
    }

    if (!allBusinesses || allBusinesses.length === 0) {
      return { reviews: [], totalCount: 0, hasMore: false };
    }

    // Step 2: Filter by country if needed
    let filteredBusinesses = allBusinesses;
    if (filters.country && !filters.skipCountryFilter) {
      const countryFiltered = allBusinesses.filter(business => {
        if (business.country === filters.country) return true;
        const sedes = business.sedes as any[] || [];
        return sedes.some(sede => sede.country_code === filters.country);
      });
      if (countryFiltered.length > 0) {
        filteredBusinesses = countryFiltered;
      }
    }

    // Exclude already loaded businesses if specified
    if (filters.excludeBusinessIds && filters.excludeBusinessIds.length > 0) {
      filteredBusinesses = filteredBusinesses.filter(b => !filters.excludeBusinessIds!.includes(b.id));
    }

    const businessIds = filteredBusinesses.map(b => b.id);
    if (businessIds.length === 0) return { reviews: [], totalCount: 0, hasMore: false };

    // Step 3: Fetch reviews in batches to avoid timeout
    // Process businesses in chunks of 20 to avoid large IN clauses
    const BATCH_SIZE = 20;
    const allReviews: any[] = [];

    for (let i = 0; i < businessIds.length; i += BATCH_SIZE) {
      const batchIds = businessIds.slice(i, i + BATCH_SIZE);

      let reviewQuery = supabase
        .from('reviews')
        .select('id, business_id, rating, created_at, review_text, user_id, helpful_votes, not_helpful_votes, title, image_urls, audio_url, source, original_author_name')
        .eq('status', 'approved')
        .lte('created_at', new Date().toISOString())
        .in('business_id', batchIds);

      // Apply rating filter only if specified
      if (filters.rating?.min) {
        reviewQuery = reviewQuery.gte('rating', filters.rating.min);
      }

      // Order reviews
      const ascending = filters.sortBy === 'oldest';
      reviewQuery = reviewQuery.order('created_at', { ascending });

      const { data: batchReviews, error: reviewError } = await reviewQuery;

      if (reviewError) {
        console.error('Error fetching reviews batch:', reviewError);
        // Continue with other batches instead of failing completely
        continue;
      }

      if (batchReviews && batchReviews.length > 0) {
        allReviews.push(...batchReviews);
      }
    }

    if (allReviews.length === 0) {
      return { reviews: [], totalCount: 0, hasMore: false };
    }

    // TOTAL COUNT = all reviews fetched (this is the real number)
    const totalCount = allReviews.length;

    // Step 4: Group reviews by business
    const reviewsByBusiness = new Map<string, any[]>();
    allReviews.forEach(review => {
      const list = reviewsByBusiness.get(review.business_id) || [];
      list.push(review);
      reviewsByBusiness.set(review.business_id, list);
    });

    // Get businesses that have reviews
    const businessIdsWithReviews = [...reviewsByBusiness.keys()];
    if (businessIdsWithReviews.length === 0) return { reviews: [], totalCount: 0, hasMore: false };

    // Step 5: Build flat list in round-robin order
    // [b1r1, b2r1, b3r1, b1r2, b2r2, b3r2, ...]
    let maxReviews = 0;
    reviewsByBusiness.forEach(reviews => {
      maxReviews = Math.max(maxReviews, reviews.length);
    });

    const flatReviews: any[] = [];
    for (let i = 0; i < maxReviews; i++) {
      for (const bizId of businessIdsWithReviews) {
        const reviews = reviewsByBusiness.get(bizId) || [];
        if (i < reviews.length) {
          flatReviews.push(reviews[i]);
        }
      }
    }

    // Step 6: Paginate
    const startIndex = (page - 1) * pageSize;
    const paginatedReviews = flatReviews.slice(startIndex, startIndex + pageSize);
    const hasMore = startIndex + pageSize < flatReviews.length;

    // Step 7: Create business map and enrich reviews
    const businessMap = new Map(filteredBusinesses.map(b => [b.id, {
      id: b.id,
      name: b.name,
      country: b.country,
      logo_url: b.logo_url,
      category: b.category
    }]));

    const enrichedReviews = paginatedReviews.map(review => ({
      ...review,
      businesses: businessMap.get(review.business_id) || null
    }));

    console.log(`getOneReviewPerBusiness: page ${page}, returned ${enrichedReviews.length}, total: ${totalCount}, hasMore: ${hasMore}`);
    return { reviews: enrichedReviews, totalCount, hasMore };

  } catch (error) {
    console.error('Error in getOneReviewPerBusiness:', error);
    throw error;
  }
};

// Helper function to get varied reviews from multiple businesses
// Loads reviews from multiple businesses and interleaves them BEFORE pagination
// This ensures each page has reviews from different businesses dispersed
// Returns { reviews, totalCount, hasMore } for proper pagination display
const getVariedReviews = async (
  filters: {
    searchTerm?: string;
    reviewTextSearch?: string;
    category?: string;
    rating?: { min?: number; max?: number };
    sortBy?: 'newest' | 'oldest' | 'most_helpful' | 'least_helpful';
    country?: string;
    dateFilter?: { type: string; startDate?: string; endDate?: string };
    verifiedFilter?: 'all' | 'verified' | 'unverified';
    formatFilters?: string[];
  },
  page: number,
  pageSize: number
): Promise<{ reviews: any[]; totalCount: number; hasMore: boolean }> => {
  try {
    // Helper function for accent-insensitive search
    const removeAccents = (text: string): string => {
      return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    };

    // Step 1: Get ALL businesses (no limit when filtering by category to ensure we get all)
    // The limit was causing issues when there are many businesses in a category
    let businessQuery = supabase
      .from('businesses')
      .select('id, name, country, logo_url, category, sedes, description');

    // Only apply limit when no category filter (general browse)
    if (!filters.category && !filters.searchTerm) {
      businessQuery = businessQuery.limit(100);
    }

    // NOTE: searchTerm filter will be applied client-side for accent-insensitive search
    // We don't apply .ilike() here

    if (filters.category) {
      // Use ilike with % to match category prefix (e.g., "Restaurantes y Ocio" matches "Restaurantes y Ocio: Catering")
      businessQuery = businessQuery.ilike('category', `${filters.category}%`);
    }

    const { data: allBusinesses, error: businessError } = await businessQuery;

    console.log(`🔍 getVariedReviews: Found ${allBusinesses?.length || 0} businesses for category: ${filters.category || 'all'}, country: ${filters.country || 'all'}`);

    if (businessError) {
      console.error('Error fetching businesses:', businessError);
      throw businessError;
    }

    if (!allBusinesses || allBusinesses.length === 0) {
      return { reviews: [], totalCount: 0, hasMore: false, businessCount: 0 };
    }

    // Step 1.5: Apply client-side accent-insensitive search filter
    let searchFilteredBusinesses = allBusinesses;
    if (filters.searchTerm) {
      const normalizedSearch = removeAccents(filters.searchTerm);
      searchFilteredBusinesses = allBusinesses.filter(business => {
        const normalizedName = removeAccents(business.name || '');
        const normalizedCategory = removeAccents(business.category || '');
        const normalizedDescription = removeAccents(business.description || '');
        return normalizedName.includes(normalizedSearch) ||
               normalizedCategory.includes(normalizedSearch) ||
               normalizedDescription.includes(normalizedSearch);
      });

      console.log(`🔍 Search filter "${filters.searchTerm}": ${searchFilteredBusinesses.length} of ${allBusinesses.length} businesses match`);

      if (searchFilteredBusinesses.length === 0) {
        return { reviews: [], totalCount: 0, hasMore: false, businessCount: 0 };
      }
    }

    // Step 2: Filter by country if needed (client-side because sedes is JSONB)
    // IMPORTANT: If country filter is set and no businesses match, return empty - NOT fallback to all
    let filteredBusinesses = searchFilteredBusinesses;
    if (filters.country) {
      filteredBusinesses = searchFilteredBusinesses.filter(business => {
        // Check main country field
        if (business.country === filters.country) return true;
        // Check sedes array for country_code
        const sedes = business.sedes as any[] || [];
        return sedes.some(sede => sede.country_code === filters.country);
      });

      console.log(`🌍 Country filter "${filters.country}": ${filteredBusinesses.length} of ${searchFilteredBusinesses.length} businesses match`);

      // If no businesses in this country, return empty results (don't fallback to all)
      if (filteredBusinesses.length === 0) {
        return { reviews: [], totalCount: 0, hasMore: false, businessCount: 0 };
      }
    }

    // Log unique categories found for debugging
    const uniqueCategories = [...new Set(filteredBusinesses.map(b => b.category))];
    console.log(`🏢 After country filter: ${filteredBusinesses.length} businesses. Categories found:`, uniqueCategories.slice(0, 5));

    const businessIds = filteredBusinesses.map(b => b.id);
    if (businessIds.length === 0) return { reviews: [], totalCount: 0, hasMore: false, businessCount: 0 };

    // Step 3: Get total count of all approved reviews
    let countQuery = supabase
      .from('reviews')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')
      .lte('created_at', new Date().toISOString())
      .in('business_id', businessIds.slice(0, 100));

    // Apply same filters for count (min and max for range)
    if (filters.rating?.min) {
      countQuery = countQuery.gte('rating', filters.rating.min);
    }
    if (filters.rating?.max) {
      countQuery = countQuery.lte('rating', filters.rating.max);
    }
    if (filters.dateFilter && filters.dateFilter.type !== 'all') {
      if (filters.dateFilter.type === 'last_month') {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        countQuery = countQuery.gte('created_at', oneMonthAgo.toISOString());
      } else if (filters.dateFilter.type === 'last_3_months') {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        countQuery = countQuery.gte('created_at', threeMonthsAgo.toISOString());
      } else if (filters.dateFilter.type === 'last_year') {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        countQuery = countQuery.gte('created_at', oneYearAgo.toISOString());
      }
    }

    const { count: totalCount, error: countError } = await countQuery;

    if (countError) {
      console.error('Error getting total count:', countError);
    }

    // Step 4: NEW APPROACH - Fetch limited reviews PER BUSINESS for true variety
    // Instead of fetching bulk reviews (which one business dominates),
    // we fetch a few reviews from EACH business to ensure fair distribution
    const REVIEWS_PER_BUSINESS = 3; // Get up to 3 reviews per business
    const totalNeeded = page * pageSize;

    // Prepare date filter for queries
    let dateFilter: Date | null = null;
    if (filters.dateFilter && filters.dateFilter.type !== 'all') {
      dateFilter = new Date();
      if (filters.dateFilter.type === 'last_month') {
        dateFilter.setMonth(dateFilter.getMonth() - 1);
      } else if (filters.dateFilter.type === 'last_3_months') {
        dateFilter.setMonth(dateFilter.getMonth() - 3);
      } else if (filters.dateFilter.type === 'last_year') {
        dateFilter.setFullYear(dateFilter.getFullYear() - 1);
      }
    }

    // Apply sorting config
    const sortField = filters.sortBy === 'most_helpful' || filters.sortBy === 'least_helpful'
      ? 'helpful_votes'
      : 'created_at';
    const ascending = filters.sortBy === 'oldest' || filters.sortBy === 'least_helpful';

    // Fetch reviews from each business individually (limited per business)
    console.log(`📥 Fetching up to ${REVIEWS_PER_BUSINESS} reviews from each of ${businessIds.length} businesses...`);

    const reviewPromises = businessIds.map(async (bizId) => {
      try {
        let query = supabase
          .from('reviews')
          .select('*')
          .eq('status', 'approved')
          .lte('created_at', new Date().toISOString())
          .eq('business_id', bizId)
          .order(sortField, { ascending })
          .limit(REVIEWS_PER_BUSINESS);

        // Apply rating filter (min and max for range)
        if (filters.rating?.min) {
          query = query.gte('rating', filters.rating.min);
        }
        if (filters.rating?.max) {
          query = query.lte('rating', filters.rating.max);
        }

        // Apply date filter
        if (dateFilter) {
          query = query.gte('created_at', dateFilter.toISOString());
        }

        const { data, error } = await query;
        if (error) {
          console.error(`Error fetching reviews for business ${bizId}:`, error);
          return [];
        }
        return data || [];
      } catch (err) {
        console.error(`Exception fetching reviews for business ${bizId}:`, err);
        return [];
      }
    });

    // Execute all queries in parallel (batched to avoid too many concurrent requests)
    const BATCH_SIZE = 20;
    const allReviews: any[] = [];

    for (let i = 0; i < reviewPromises.length; i += BATCH_SIZE) {
      const batch = reviewPromises.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch);
      batchResults.forEach(reviews => allReviews.push(...reviews));
    }

    console.log(`📥 Total reviews fetched from all businesses: ${allReviews.length}`);

    if (allReviews.length === 0) {
      return { reviews: [], totalCount: totalCount || 0, hasMore: false, businessCount: filteredBusinesses.length };
    }

    // Use allReviews instead of the old reviews variable
    const reviews = allReviews;

    // Step 5: INTERLEAVE FIRST - Group reviews by business, then round-robin
    // Reviews are already limited per business from the fetch step
    const reviewsByBusiness = new Map<string, any[]>();
    reviews.forEach(review => {
      const bizId = review.business_id;
      if (!reviewsByBusiness.has(bizId)) {
        reviewsByBusiness.set(bizId, []);
      }
      reviewsByBusiness.get(bizId)!.push(review);
    });

    console.log(`🔄 Interleaving: ${reviewsByBusiness.size} businesses with reviews`);

    // Round-robin interleaving: take one from each business in turn
    const interleavedReviews: any[] = [];
    const businessArrays = Array.from(reviewsByBusiness.values());
    const maxLength = Math.max(...businessArrays.map(arr => arr.length), 0);

    for (let i = 0; i < maxLength; i++) {
      for (const bizReviews of businessArrays) {
        if (i < bizReviews.length) {
          interleavedReviews.push(bizReviews[i]);
        }
      }
    }

    // Step 6: NOW PAGINATE from the interleaved list
    const startIndex = (page - 1) * pageSize;
    const paginatedReviews = interleavedReviews.slice(startIndex, startIndex + pageSize);

    // Step 7: Create business map for enrichment
    const businessMap = new Map(filteredBusinesses.map(b => [b.id, {
      id: b.id,
      name: b.name,
      logo_url: b.logo_url,
      country: b.country,
      category: b.category
    }]));

    const enrichedReviews = paginatedReviews.map(review => ({
      ...review,
      businesses: businessMap.get(review.business_id) || null
    }));

    // Calculate hasMore based on interleaved reviews (limited per business)
    // Since we limit to REVIEWS_PER_BUSINESS per company, hasMore is based on that
    const hasMore = startIndex + pageSize < interleavedReviews.length;

    // Count unique businesses in the results
    const businessCount = filteredBusinesses.length;

    // Effective total is limited by REVIEWS_PER_BUSINESS * businessCount
    const effectiveTotal = interleavedReviews.length;

    console.log(`📋 getVariedReviews: page ${page}, businesses: ${businessCount}, interleaved: ${effectiveTotal}, returned: ${enrichedReviews.length}, hasMore: ${hasMore}`);

    // Log sample of business names for debugging
    const sampleBusinesses = enrichedReviews.slice(0, 5).map(r => r.businesses?.name || 'Unknown');
    console.log(`📋 Sample businesses on page ${page}:`, sampleBusinesses);

    return { reviews: enrichedReviews, totalCount: effectiveTotal, hasMore, businessCount };

  } catch (error) {
    console.error('Error in getVariedReviews:', error);
    throw error;
  }
};

export const getPublicReviews = async (
  filters: {
    searchTerm?: string; // Search by business name
    reviewTextSearch?: string; // NEW: Search within review text
    category?: string;
    rating?: { min?: number; max?: number };
    sortBy?: 'newest' | 'oldest' | 'most_helpful' | 'least_helpful';
    businessId?: string;
    businessIds?: string[];
    country?: string;
    dateFilter?: { type: string; startDate?: string; endDate?: string };
    verifiedFilter?: 'all' | 'verified' | 'unverified';
    formatFilters?: string[];
    excludeBusinessIds?: string[]; // Excluir empresas ya cargadas
    skipCountryFilter?: boolean; // Para cargar de otros países
    onePerBusiness?: boolean; // Only return one review per business (for feed variety)
    variedFeed?: boolean; // Load varied reviews from multiple businesses (interleaved)
  } = {},
  page: number = 1,
  pageSize: number = 10
) => {
  try {
    // SPECIAL CASE: onePerBusiness - Get businesses first, then fetch 1 review per business
    if (filters.onePerBusiness) {
      return await getOneReviewPerBusiness(filters, page, pageSize);
    }

    // SPECIAL CASE: variedFeed - Get varied reviews from multiple businesses interleaved
    // Use this for the general explore feed when no specific business is selected
    if (filters.variedFeed && !filters.businessId) {
      return await getVariedReviews(filters, page, pageSize);
    }

    // If searchTerm, category, or country filter is provided, first get matching business IDs
    let filteredBusinessIds: string[] | undefined = filters.businessIds;

    if (filters.searchTerm || filters.category || filters.country) {
      // Helper function to remove accents
      const removeAccents = (text: string): string => {
        return text
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();
      };

      // Need to fetch full business data to check sedes JSONB array
      let businessQuery = supabase
        .from('businesses')
        .select('id, name, category, country, sedes, description');

      if (filters.category) {
        // Categories in DB are stored as "Parent Category: Subcategory"
        // So we filter by categories that START WITH the parent category name
        businessQuery = businessQuery.ilike('category', `${filters.category}%`);
      }

      const { data: matchingBusinesses, error: businessSearchError } = await businessQuery;

      // Filtrar por searchTerm en el cliente para búsqueda sin acentos
      let filteredBySearch = matchingBusinesses;
      if (filters.searchTerm && matchingBusinesses) {
        const normalizedSearch = removeAccents(filters.searchTerm);
        filteredBySearch = matchingBusinesses.filter(business => {
          const normalizedName = removeAccents(business.name || '');
          const normalizedCategory = removeAccents(business.category || '');
          const normalizedDescription = removeAccents(business.description || '');
          return normalizedName.includes(normalizedSearch) ||
                 normalizedCategory.includes(normalizedSearch) ||
                 normalizedDescription.includes(normalizedSearch);
        });
      }

      // Usar los resultados filtrados
      const finalMatchingBusinesses = filteredBySearch;

      if (businessSearchError) {
        console.error('Error searching businesses:', businessSearchError);
        throw businessSearchError;
      }

      if (!finalMatchingBusinesses || finalMatchingBusinesses.length === 0) {
        // No businesses match the search - return empty array
        return [];
      }

      // Filter by country/sede if specified (unless skipCountryFilter is true)
      let countryFilteredBusinesses = finalMatchingBusinesses;
      if (filters.country && !filters.skipCountryFilter) {
        const countryMatches = finalMatchingBusinesses.filter(business => {
          // Check if main country matches
          if (business.country === filters.country) {
            return true;
          }
          // Check if any sede has this country_code
          const sedes = business.sedes as any[] || [];
          return sedes.some(sede => sede.country_code === filters.country);
        });

        // If there are country matches, use them. Otherwise, fall back to all matches
        if (countryMatches.length > 0) {
          countryFilteredBusinesses = countryMatches;
        }
      } else if (filters.skipCountryFilter && filters.country) {
        // When loading from other countries, EXCLUDE the country businesses
        countryFilteredBusinesses = finalMatchingBusinesses.filter(business => {
          const sedes = business.sedes as any[] || [];
          const isInCountry = business.country === filters.country ||
                              sedes.some(sede => sede.country_code === filters.country);
          return !isInCountry; // Exclude businesses from the selected country
        });
      }

      // Exclude already loaded businesses if specified
      if (filters.excludeBusinessIds && filters.excludeBusinessIds.length > 0) {
        countryFilteredBusinesses = countryFilteredBusinesses.filter(
          b => !filters.excludeBusinessIds!.includes(b.id)
        );
      }

      const searchBusinessIds = countryFilteredBusinesses.map(b => b.id);

      // Combine with existing businessIds filter if present
      if (filteredBusinessIds && filteredBusinessIds.length > 0) {
        filteredBusinessIds = filteredBusinessIds.filter(id => searchBusinessIds.includes(id));
      } else {
        filteredBusinessIds = searchBusinessIds;
      }

      // If after filtering we have no matching IDs, return empty
      if (filteredBusinessIds.length === 0) {
        return [];
      }
    }

    // Now query reviews with all filters
    let query = supabase
      .from('reviews')
      .select('*')
      .eq('status', 'approved')
      .lte('created_at', new Date().toISOString());

    // Business ID filter (single) - most common filter
    if (filters.businessId) {
      query = query.eq('business_id', filters.businessId);
    }
    // Business IDs filter (multiple) - including filtered IDs from search
    else if (filteredBusinessIds && filteredBusinessIds.length > 0) {
      // Supabase has a limit on IN clause size - split into chunks if needed
      // For large lists, we'll limit to first 100 to avoid Bad Request errors
      const limitedIds = filteredBusinessIds.slice(0, 100);
      query = query.in('business_id', limitedIds);
    }

    // Rating filter
    if (filters.rating?.min) {
      query = query.gte('rating', filters.rating.min);
    }
    if (filters.rating?.max) {
      query = query.lte('rating', filters.rating.max);
    }

    // Date filter
    if (filters.dateFilter && filters.dateFilter.type !== 'all') {
      if (filters.dateFilter.type === 'custom' && filters.dateFilter.startDate && filters.dateFilter.endDate) {
        query = query.gte('created_at', filters.dateFilter.startDate).lte('created_at', filters.dateFilter.endDate);
      } else if (filters.dateFilter.type === 'last_month') {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        query = query.gte('created_at', oneMonthAgo.toISOString());
      } else if (filters.dateFilter.type === 'last_3_months') {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        query = query.gte('created_at', threeMonthsAgo.toISOString());
      } else if (filters.dateFilter.type === 'last_year') {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        query = query.gte('created_at', oneYearAgo.toISOString());
      }
    }

    // Note: verified and format filters disabled - columns don't exist in reviews table

    // Review text search - search within review content
    if (filters.reviewTextSearch && filters.reviewTextSearch.trim()) {
      const escapedSearch = filters.reviewTextSearch.replace(/[%_\\]/g, '\\$&');
      query = query.ilike('review_text', `%${escapedSearch}%`);
    }

    // Sorting - always apply to avoid errors
    const sortBy = filters.sortBy || 'newest';
    if (sortBy === 'oldest') {
      query = query.order('created_at', { ascending: true });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    // Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data: reviews, error } = await query;
    if (error) {
      console.error('Supabase error in getPublicReviews:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Error details:', error.details);
      throw error;
    }

    if (!reviews || reviews.length === 0) {
      return [];
    }

    // Get unique business IDs from reviews
    const businessIds = [...new Set(reviews.map(r => r.business_id))];
    console.log('Fetching business data for IDs:', businessIds);

    // Fetch business data separately
    const { data: businesses, error: businessError } = await supabase
      .from('businesses')
      .select('id, name, country, logo_url, category')
      .in('id', businessIds);

    if (businessError) {
      console.error('Error fetching businesses for reviews:', businessError);
      console.error('Business IDs that failed:', businessIds);
      // Don't return reviews without business data - throw error instead
      throw new Error(`Failed to fetch business data: ${businessError.message}`);
    }

    console.log('Successfully fetched businesses:', businesses?.length, 'out of', businessIds.length, 'requested');

    if (!businesses || businesses.length === 0) {
      console.warn('No businesses found for IDs:', businessIds);
      throw new Error('No business data found for reviews');
    }

    // Create a map of business data
    const businessMap = new Map(businesses?.map(b => [b.id, b]) || []);

    // Enrich reviews with business data
    let enrichedReviews = reviews.map(review => {
      const business = businessMap.get(review.business_id);
      if (!business) {
        console.warn('No business found for review', review.id, 'with business_id', review.business_id);
      }
      return {
        ...review,
        businesses: business || null
      };
    });

    // Apply country-based sorting if country filter is active
    if (filters.country) {
      enrichedReviews = enrichedReviews.sort((a, b) => {
        const aMatchesCountry = a.businesses?.country === filters.country;
        const bMatchesCountry = b.businesses?.country === filters.country;

        // Primary sort: reviews from selected country first
        if (aMatchesCountry && !bMatchesCountry) return -1;
        if (!aMatchesCountry && bMatchesCountry) return 1;

        // Secondary sort: by rating (descending - higher ratings first)
        const ratingDiff = (b.rating || 0) - (a.rating || 0);
        if (ratingDiff !== 0) return ratingDiff;

        // Tertiary sort: by date (based on sortBy parameter)
        const aTime = new Date(a.created_at).getTime();
        const bTime = new Date(b.created_at).getTime();
        return filters.sortBy === 'oldest' ? aTime - bTime : bTime - aTime;
      });
    }

    console.log('Enriched reviews with business data:', enrichedReviews.length);
    return enrichedReviews;
  } catch (error) {
    console.error('Caught error in getPublicReviews:', error);
    throw error;
  }
};

export const voteOnReview = async (reviewId: string, userId: string, voteType: 'helpful' | 'not_helpful') => {
  // Upsert the vote (insert or update if user already voted)
  // The database trigger will automatically update the vote counts
  const { error: voteError } = await supabase
    .from('review_votes')
    .upsert(
      {
        review_id: reviewId,
        user_id: userId,
        is_helpful: voteType === 'helpful',
        updated_at: new Date().toISOString()
      },
      {
        onConflict: 'review_id,user_id'
      }
    );

  if (voteError) throw voteError;

  // Fetch the updated vote counts (the trigger has already updated them)
  const { data: reviewData, error: reviewError } = await supabase
    .from('reviews')
    .select('helpful_votes, not_helpful_votes')
    .eq('id', reviewId)
    .single();

  if (reviewError) throw reviewError;

  return {
    helpful_votes: reviewData.helpful_votes || 0,
    not_helpful_votes: reviewData.not_helpful_votes || 0
  };
};

export const getUserVoteOnReview = async (reviewId: string, userId: string) => {
  const { data, error } = await supabase
    .from('review_votes')
    .select('is_helpful')
    .eq('review_id', reviewId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  return data ? { hasVoted: true, isHelpful: data.is_helpful } : { hasVoted: false, isHelpful: null };
};

export const removeVoteOnReview = async (reviewId: string, userId: string) => {
  const { error } = await supabase
    .from('review_votes')
    .delete()
    .eq('review_id', reviewId)
    .eq('user_id', userId);

  if (error) throw error;

  // Fetch the updated vote counts
  const { data: reviewData, error: reviewError } = await supabase
    .from('reviews')
    .select('helpful_votes, not_helpful_votes')
    .eq('id', reviewId)
    .single();

  if (reviewError) throw reviewError;

  return {
    helpful_votes: reviewData.helpful_votes || 0,
    not_helpful_votes: reviewData.not_helpful_votes || 0
  };
};

export const getRejectedReviewsForUser = async (userId: string) => {
  try {
    // Fetch reviews without the join
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'rejected')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching rejected reviews:', error);
      throw error;
    }

    if (!reviews || reviews.length === 0) {
      return [];
    }

    // Get unique business IDs
    const businessIds = [...new Set(reviews.map(r => r.business_id))];

    // Fetch business data separately
    const { data: businesses, error: businessError } = await supabase
      .from('businesses')
      .select('id, name')
      .in('id', businessIds);

    if (businessError) {
      console.error('Error fetching businesses:', businessError);
      return reviews;
    }

    // Create a map of business data
    const businessMap = new Map(businesses?.map(b => [b.id, { name: b.name }]) || []);

    // Enrich reviews with business data
    const enrichedReviews = reviews.map(review => ({
      ...review,
      businesses: businessMap.get(review.business_id) || null
    }));

    return enrichedReviews;
  } catch (error) {
    console.error('Caught error in getRejectedReviewsForUser:', error);
    throw error;
  }
};

export const getReviewsForUser = async (userId: string) => {
  try {
    // Fetch reviews without the join
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user reviews:', error);
      throw error;
    }

    if (!reviews || reviews.length === 0) {
      return [];
    }

    // Get unique business IDs
    const businessIds = [...new Set(reviews.map(r => r.business_id))];

    // Fetch business data separately
    const { data: businesses, error: businessError } = await supabase
      .from('businesses')
      .select('id, name')
      .in('id', businessIds);

    if (businessError) {
      console.error('Error fetching businesses:', businessError);
      return reviews;
    }

    // Create a map of business data
    const businessMap = new Map(businesses?.map(b => [b.id, { name: b.name }]) || []);

    // Enrich reviews with business data
    const enrichedReviews = reviews.map(review => ({
      ...review,
      businesses: businessMap.get(review.business_id) || null
    }));

    return enrichedReviews;
  } catch (error) {
    console.error('Caught error in getReviewsForUser:', error);
    throw error;
  }
};

export const getReviewsForBusiness = async (businessId: string) => {
  try {
    // Fetch reviews without the problematic join
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('business_id', businessId)
      .eq('status', 'approved')
      .lte('created_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reviews for business:', error);
      throw error;
    }

    if (!reviews || reviews.length === 0) {
      return [];
    }

    // Get unique user IDs, filtering out null values
    const userIds = [...new Set(reviews.map(r => r.user_id).filter(id => id !== null))];

    // Only fetch profiles if we have valid user IDs
    if (userIds.length === 0) {
      return reviews;
    }

    // Fetch profile data separately
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .in('id', userIds);

    if (profileError) {
      console.error('Error fetching profiles:', profileError);
      // Return reviews without profile data if there's an error
      return reviews;
    }

    // Create a map of profile data
    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    // Enrich reviews with profile data
    const enrichedReviews = reviews.map(review => ({
      ...review,
      profiles: profileMap.get(review.user_id) || null
    }));

    return enrichedReviews;
  } catch (error) {
    console.error('Caught error in getReviewsForBusiness:', error);
    throw error;
  }
};

export const getReviewRatingDistribution = async (businessId: string) => {
  const { data, error } = await supabase
    .from('reviews')
    .select('rating')
    .eq('business_id', businessId)
    .eq('status', 'approved')
    .lte('created_at', new Date().toISOString());
  if (error) throw error;

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  data?.forEach(review => {
    if (review.rating >= 1 && review.rating <= 5) {
      distribution[review.rating as keyof typeof distribution]++;
    }
  });
  return distribution;
};

export const getReviewSourceCounts = async (businessId: string) => {
  const { data, error } = await supabase
    .from('reviews')
    .select('source, rating')
    .eq('business_id', businessId)
    .eq('status', 'approved')
    .lte('created_at', new Date().toISOString());
  if (error) throw error;

  const counts = { opynio: 0, google: 0, trustindex: 0 };
  data?.forEach(review => {
    // Count ALL approved reviews, but only if they have valid rating (matching distribution logic)
    if (review.rating >= 1 && review.rating <= 5) {
      const source = review.source || 'opynio';
      if (source === 'opynio' || source === 'google' || source === 'trustindex') {
        counts[source] = (counts[source] || 0) + 1;
      }
    }
  });
  return counts;
};

export const submitReviewResponse = async (reviewId: string, responseText: string, businessId: string) => {
  const { data, error } = await supabase
    .from('review_responses')
    .insert([{ review_id: reviewId, response_text: responseText, business_id: businessId }])
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateReviewResponse = async (responseId: string, responseText: string) => {
  const { data, error } = await supabase
    .from('review_responses')
    .update({ response_text: responseText, updated_at: new Date().toISOString() })
    .eq('id', responseId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteReviewResponse = async (responseId: string) => {
  const { error } = await supabase
    .from('review_responses')
    .delete()
    .eq('id', responseId);
  if (error) throw error;
};

// ai_credits_used vive en `profiles` (no en `businesses`). La RPC
// public.increment_ai_credits(p_user_id, p_credits_used) suma de forma atómica
// y aplica el reset mensual cuando corresponde.
export const incrementAiCredits = async (userId: string, amount: number) => {
  if (amount <= 0) throw new Error('amount must be positive');
  const { error } = await supabase.rpc('increment_ai_credits', {
    p_user_id: userId,
    p_credits_used: amount,
  });
  if (error) throw error;
};

// ==================== NOTIFICATION FUNCTIONS ====================

export const getNotifications = async (userId: string) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
};

export const markNotificationsAsRead = async (userId: string, notificationIds: string[]) => {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .in('id', notificationIds);
  if (error) throw error;
};

export const savePushSubscription = async (userId: string, subscription: any) => {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .upsert({ user_id: userId, subscription })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deletePushSubscription = async (userId: string) => {
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId);
  if (error) throw error;
};

// ==================== ADMIN FUNCTIONS ====================

export const getAdminBusinessesPaginated = async (page: number, pageSize: number, filters: any = {}) => {
  let query = supabase
    .from('businesses')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  
  if (filters.search) {
    // Escape special characters for ILIKE pattern matching
    const escapedSearch = filters.search.replace(/[%_\\]/g, '\\$&');
    query = query.ilike('name', `%${escapedSearch}%`);
  }
  if (filters.country) {
    query = query.eq('country', filters.country);
  }
  
  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data || [], count: count || 0 };
};

export const adminBulkUpdateBusinesses = async (updates: Array<{ id: string; payload: Partial<any> }>) => {
  // Transformar el formato { id, payload } a objetos planos para upsert
  const businessUpdates = updates.map(({ id, payload }) => ({
    id,
    ...payload
  }));

  const { data, error } = await supabase
    .from('businesses')
    .upsert(businessUpdates)
    .select();
  if (error) throw error;
  return data;
};

export const getAdminUsersPaginated = async (page: number, pageSize: number) => {
  const { data, error, count } = await supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw error;
  return { data: data || [], count: count || 0 };
};

export const adminGetFeaturedCompanies = async () => {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('is_featured', true)
    .order('name');
  if (error) throw error;
  return data || [];
};

export const adminSetFeaturedCompanies = async (businessIds: string[]) => {
  // First, unfeature all current featured businesses
  const { error: unfeatureError } = await supabase
    .from('businesses')
    .update({ is_featured: false })
    .eq('is_featured', true);

  if (unfeatureError) {
    console.error('Error unfeaturing businesses:', unfeatureError);
    throw unfeatureError;
  }

  // Then feature the selected ones
  if (businessIds.length > 0) {
    const { error } = await supabase
      .from('businesses')
      .update({ is_featured: true })
      .in('id', businessIds);
    if (error) {
      console.error('Error featuring businesses:', error);
      throw error;
    }
  }
};

export const getAdminReviewAppeals = async () => {
  const { data, error } = await supabase
    .from('review_appeals')
    .select('*, reviews(*, businesses(name)), profiles!review_appeals_user_id_fkey(name, username)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const resolveReviewAppeal = async (appealId: string, resolution: string, adminNotes: string) => {
  const { data, error } = await supabase
    .from('review_appeals')
    .update({ status: resolution, admin_notes: adminNotes, resolved_at: new Date().toISOString() })
    .eq('id', appealId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const getAdminReviews = async (
  filters: { status?: string } = {},
  page: number = 1,
  limit: number = 50
) => {
  const offset = (page - 1) * limit;

  let query = supabase
    .from('reviews')
    .select('*, businesses(name), profiles(id, name, avatar_url)')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const adminUpdateReviewStatus = async (reviewId: string, status: string, adminNotes?: string) => {
  const updates: any = { status };
  if (adminNotes) {
    updates.admin_notes = adminNotes;
  }

  const { data, error } = await supabase
    .from('reviews')
    .update(updates)
    .eq('id', reviewId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const getAdminDashboardStats = async () => {
  const [businessesRes, usersRes, reviewsRes] = await Promise.all([
    supabase.from('businesses').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('reviews').select('*', { count: 'exact', head: true }),
  ]);

  if (businessesRes.error) throw businessesRes.error;
  if (usersRes.error) throw usersRes.error;
  if (reviewsRes.error) throw reviewsRes.error;

  return {
    users: usersRes.count ?? 0,
    businesses: businessesRes.count ?? 0,
    reviews: reviewsRes.count ?? 0,
  };
};

export const deleteBusinessesWithoutReviews = async () => {
  const { data: businessesWithReviews } = await supabase
    .from('reviews')
    .select('business_id');

  const businessIds = [...new Set(businessesWithReviews?.map(r => r.business_id))];

  const { error } = await supabase
    .from('businesses')
    .delete()
    .not('id', 'in', `(${businessIds.join(',')})`);

  if (error) throw error;
};

export const getAdminBugReports = async (status?: string) => {
  console.log('getAdminBugReports called with status:', status);
  let query = supabase
    .from('bug_reports')
    .select('*, profiles(name, username)')
    .order('created_at', { ascending: false });

  if (status) {
    console.log('Filtering by status:', status);
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  console.log('Bug reports query result:', { data, error, count: data?.length });
  if (error) throw error;
  return data || [];
};

export const updateBugReport = async (bugId: string, updates: any) => {
  const { data, error } = await supabase
    .from('bug_reports')
    .update(updates)
    .eq('id', bugId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const getAdminClaims = async (options?: { status?: string }) => {
  let query = supabase
    .from('claims')
    .select(`
      *,
      businesses(name, country),
      profiles!claims_user_id_fkey(name, username)
    `)
    .order('created_at', { ascending: false });

  if (options?.status && options.status !== 'all') {
    query = query.eq('status', options.status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const resolveClaim = async (claimId: number, status: string, adminNotes: string) => {
  const { data: { user } } = await supabase.auth.getUser();

  // Primero obtener el claim para saber el business_id y user_id
  const { data: claim, error: claimError } = await supabase
    .from('claims')
    .select('business_id, user_id')
    .eq('id', claimId)
    .single();

  if (claimError) throw claimError;

  // Si se aprueba, asignar la empresa al usuario y actualizar su rol
  if (status === 'approved' && claim) {
    console.log('🔄 Asignando empresa:', { business_id: claim.business_id, user_id: claim.user_id });

    // 1. Asignar la empresa al usuario
    const { data: updateData, error: updateError } = await supabase
      .from('businesses')
      .update({ owner_id: claim.user_id })
      .eq('id', claim.business_id)
      .select('id, owner_id');

    console.log('📊 Resultado update empresa:', { updateData, updateError });

    if (updateError) throw updateError;
    if (!updateData || updateData.length === 0) {
      throw new Error('No se pudo asignar la empresa. Verifica los permisos RLS en Supabase.');
    }

    // 2. Actualizar el rol del usuario a business_owner para que pueda acceder al dashboard
    const { error: roleError } = await supabase
      .from('profiles')
      .update({ role: 'business_owner' })
      .eq('id', claim.user_id);

    console.log('📊 Resultado update rol:', { roleError });

    if (roleError) throw roleError;
  }

  // Actualizar el claim
  const { data, error } = await supabase
    .from('claims')
    .update({
      status,
      admin_notes: adminNotes,
      resolved_at: new Date().toISOString(),
      resolved_by: user?.id || null
    })
    .eq('id', claimId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const adminCreateBusiness = async (businessData: any) => {
  // Generar slug automáticamente si no viene en los datos y hay nombre
  if (!businessData.slug && businessData.name) {
    businessData.slug = await generateUniqueSlug(businessData.name);
  }

  const { data, error } = await supabase
    .from('businesses')
    .insert([businessData])
    .select()
    .single();
  if (error) throw error;
  return data;
};

export async function getBusinessAnalytics(businessId: string, days: 30 | 90 | 3650) {
  try {
    // Calculate date range
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);

    // Fetch reviews within the date range
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('rating, created_at, source, review_responses(id)')
      .eq('business_id', businessId)
      .eq('status', 'approved')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', new Date().toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    if (!reviews || reviews.length === 0) {
      return {
        totalReviews: 0,
        averageRating: 0,
        responseRate: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        reviewsBySource: {},
        reviewsOverTime: []
      };
    }

    // Calculate metrics
    const totalReviews = reviews.length;
    const averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews;
    const reviewsWithResponse = reviews.filter(r => r.review_responses && r.review_responses.length > 0).length;
    const responseRate = (reviewsWithResponse / totalReviews) * 100;

    // Rating distribution
    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach(r => {
      if (r.rating >= 1 && r.rating <= 5) {
        ratingDistribution[r.rating]++;
      }
    });

    // Reviews by source
    const reviewsBySource: Record<string, number> = {};
    reviews.forEach(r => {
      const source = r.source || 'opynio';
      reviewsBySource[source] = (reviewsBySource[source] || 0) + 1;
    });

    // Reviews over time - aggregate by day, week, or month depending on range
    const reviewsOverTime: { date: string; count: number }[] = [];

    if (days <= 90) {
      // For short ranges (30-90 days), show daily data
      const dateMap = new Map<string, number>();
      reviews.forEach(r => {
        const date = new Date(r.created_at).toISOString().split('T')[0];
        dateMap.set(date, (dateMap.get(date) || 0) + 1);
      });

      // If there are many reviews (>10), fill in all dates to show density
      // Otherwise, only show days with reviews to avoid sparse/invisible bars
      if (totalReviews > 10) {
        const currentDate = new Date(startDate);
        while (currentDate <= now) {
          const dateStr = currentDate.toISOString().split('T')[0];
          reviewsOverTime.push({
            date: dateStr,
            count: dateMap.get(dateStr) || 0
          });
          currentDate.setDate(currentDate.getDate() + 1);
        }
      } else {
        // Show only days with reviews for better visibility
        const sortedDates = Array.from(dateMap.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([date, count]) => ({ date, count }));
        reviewsOverTime.push(...sortedDates);
      }
    } else {
      // For long ranges (all time), aggregate by week
      const weekMap = new Map<string, number>();

      reviews.forEach(r => {
        const date = new Date(r.created_at);
        // Get Monday of the week (ISO week)
        const dayOfWeek = date.getDay();
        const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const monday = new Date(date.setDate(diff));
        const weekKey = monday.toISOString().split('T')[0];
        weekMap.set(weekKey, (weekMap.get(weekKey) || 0) + 1);
      });

      // Convert to sorted array
      const sortedWeeks = Array.from(weekMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, count]) => ({ date, count }));

      reviewsOverTime.push(...sortedWeeks);
    }

    return {
      totalReviews,
      averageRating,
      responseRate,
      ratingDistribution,
      reviewsBySource,
      reviewsOverTime
    };
  } catch (error) {
    console.error('Error fetching business analytics:', error);
    throw error;
  }
}

// ==================== SUPPORT FUNCTIONS ====================

export const createClaim = async (claimData: any) => {
  const { data, error } = await supabase
    .from('claims')
    .insert([claimData])
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const createBugReport = async (bugData: any) => {
  const { data, error } = await supabase
    .from('bug_reports')
    .insert([bugData])
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const createReviewAppeal = async (appealData: any) => {
  const { data, error} = await supabase
    .from('review_appeals')
    .insert([appealData])
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const sendSupportEmail = async (emailData: any) => {
  // This would typically call an edge function or API endpoint
  const { data, error } = await supabase.functions.invoke('send-support-email', {
    body: emailData,
  });
  if (error) throw error;
  return data;
};

// ==================== ENTERPRISE FUNCTIONS ====================

export const getEnterpriseUsers = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('plan', 'enterprise')
    .order('name');
  if (error) throw error;
  return data || [];
};

export const searchAssignableUsers = async (searchTerm: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, username')
    .or(`name.ilike.%${searchTerm}%,username.ilike.%${searchTerm}%`)
    .limit(20);
  if (error) throw error;
  return data || [];
};

// ==================== SCRAPING FUNCTIONS ====================

export interface InstantFullScrapeResult {
  success: boolean;
  business?: any;
  reviews?: any[];
  error?: string;
}

export interface ScrapingSession {
  id: string;
  business_id: string;
  status: string;
  total_reviews: number;
  scraped_reviews: number;
  created_at: string;
  updated_at: string;
}

export const importSerpApiGoogleReviews = async (businessId: string, googleMapsUrl: string) => {
  const { data, error } = await supabase.functions.invoke('import-google-reviews', {
    body: { businessId, googleMapsUrl },
  });
  if (error) throw error;
  return data;
};

export const getScrapingQueue = async () => {
  const { data, error } = await supabase
    .from('scraping_queue')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const startScrapingSearch = async (searchTerm: string, country: string) => {
  const { data, error } = await supabase
    .from('scraping_queue')
    .insert([{ search_term: searchTerm, country, status: 'pending' }])
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteScrapingQueueItems = async (ids: string[]) => {
  const { error } = await supabase
    .from('scraping_queue')
    .delete()
    .in('id', ids);
  if (error) throw error;
};

export const updateScrapingQueueItem = async (id: string, updates: any) => {
  const { data, error } = await supabase
    .from('scraping_queue')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const instantFullScrape = async (googleMapsUrl: string): Promise<InstantFullScrapeResult> => {
  try {
    const { data, error } = await supabase.functions.invoke('instant-full-scrape', {
      body: { googleMapsUrl },
    });
    if (error) throw error;
    return data as InstantFullScrapeResult;
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
    };
  }
};

export const getScrapingSession = async (sessionId: string): Promise<ScrapingSession | null> => {
  const { data, error } = await supabase
    .from('scraping_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();
  if (error) return null;
  return data as ScrapingSession;
};

// ==================== SLUG & URL REDIRECT FUNCTIONS ====================

/**
 * Buscar empresa por slug exacto
 */
export const getBusinessBySlug = async (slug: string) => {
  try {
    const cacheKey = `business_slug_${slug.toLowerCase()}`;
    const cached = getCached<any>(cacheKey);
    if (cached !== null) return cached;

    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('slug', slug.toLowerCase())
      .maybeSingle();

    if (error) {
      console.error('Error in getBusinessBySlug:', error);
      return null;
    }

    setCache(cacheKey, data);
    return data;
  } catch (error) {
    console.error('Error in getBusinessBySlug:', error);
    return null;
  }
};

/**
 * Generar un slug único para una empresa
 * Si el slug base ya existe, agrega un sufijo numérico
 */
export const generateUniqueSlug = async (businessName: string): Promise<string> => {
  const baseSlug = slugify(businessName);
  if (!baseSlug) return '';

  // Verificar si el slug base está disponible
  const isAvailable = await isSlugAvailable(baseSlug);
  if (isAvailable) return baseSlug;

  // Si no está disponible, buscar un sufijo único
  let counter = 2;
  let newSlug = `${baseSlug}_${counter}`;

  while (!(await isSlugAvailable(newSlug)) && counter < 100) {
    counter++;
    newSlug = `${baseSlug}_${counter}`;
  }

  return newSlug;
};

/**
 * Verificar si un slug está disponible
 */
export const isSlugAvailable = async (slug: string, excludeBusinessId?: string): Promise<boolean> => {
  try {
    let query = supabase
      .from('businesses')
      .select('id')
      .eq('slug', slug.toLowerCase());

    if (excludeBusinessId) {
      query = query.neq('id', excludeBusinessId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error('Error checking slug availability:', error);
      return false;
    }

    // También verificar en redirecciones
    const { data: redirectData } = await supabase
      .from('url_redirects')
      .select('id')
      .eq('old_slug', slug.toLowerCase())
      .maybeSingle();

    return !data && !redirectData;
  } catch (error) {
    console.error('Error in isSlugAvailable:', error);
    return false;
  }
};

/**
 * Actualizar slug de empresa y opcionalmente crear redirección
 */
export const updateBusinessSlug = async (
  businessId: string,
  newSlug: string,
  createRedirect: boolean = true,
  originalUrlSlug?: string // URL original exacta para la redirección (con caracteres especiales)
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Obtener el slug actual
    const { data: currentBusiness } = await supabase
      .from('businesses')
      .select('slug, name')
      .eq('id', businessId)
      .single();

    // Usar la URL original si se proporciona explícitamente
    // Esto permite crear redirecciones desde URLs con caracteres especiales
    // aunque el negocio ya tenga un slug limpio guardado
    const oldSlug = originalUrlSlug || currentBusiness?.slug || currentBusiness?.name?.replace(/ /g, '_');

    // Para la comparación, necesitamos decodificar la URL si está encoded
    // para evitar comparar "Cerrajeros%20Madrid" con "cerrajeros_madrid"
    const decodedOldSlug = oldSlug ? decodeURIComponent(oldSlug).replace(/ /g, '_') : null;

    // Verificar disponibilidad del nuevo slug
    const available = await isSlugAvailable(newSlug, businessId);
    if (!available) {
      return { success: false, error: 'El slug ya está en uso' };
    }

    // Actualizar el slug
    const { error: updateError } = await supabase
      .from('businesses')
      .update({ slug: newSlug.toLowerCase() })
      .eq('id', businessId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Crear redirección si se solicita y hay un slug anterior diferente
    // Comparamos el oldSlug original (que puede tener caracteres especiales/encoded)
    // con el newSlug normalizado. Si son diferentes, creamos la redirección.
    // Esto permite crear redirecciones desde URLs como "Cerrajeros%C3%A1" a "cerrajeros"
    const slugsAreDifferent = oldSlug !== newSlug && oldSlug !== newSlug.toLowerCase();

    if (createRedirect && oldSlug && slugsAreDifferent) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('[updateBusinessSlug] ✅ Intentando crear redirección:', {
        businessId,
        oldSlug,
        newSlug,
        createRedirect,
        slugsAreDifferent,
        conditionMet: true
      });
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      // Verificar si ya existe una redirección para ESTA EMPRESA con ese old_slug
      // La verificación debe ser por business_id + old_slug, no solo old_slug
      const { data: exactMatch } = await supabase
        .from('url_redirects')
        .select('id')
        .eq('business_id', businessId)
        .eq('old_slug', oldSlug)
        .maybeSingle();

      let existingRedirect = exactMatch;

      // Si no hay match exacto, buscar con case-insensitive para esta empresa
      if (!existingRedirect && oldSlug !== oldSlug.toLowerCase()) {
        const { data: caseInsensitiveMatch } = await supabase
          .from('url_redirects')
          .select('id')
          .eq('business_id', businessId)
          .eq('old_slug', oldSlug.toLowerCase())
          .maybeSingle();

        existingRedirect = caseInsensitiveMatch;
      }

      if (!existingRedirect) {
        console.log('[updateBusinessSlug] 🔄 Creando nueva redirección...');
        // Admin-only flow; policy "Only admins can manage redirects" allows this
        // via the regular client when caller is admin.
        const { data: insertedData, error: insertError } = await supabase
          .from('url_redirects')
          .insert({
            old_slug: oldSlug, // Sin .toLowerCase() - mantener original
            business_id: businessId,
            hits: 0
          })
          .select();

        if (insertError) {
          console.error('❌ [updateBusinessSlug] ERROR al crear redirección:', {
            error: insertError,
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint,
            code: insertError.code
          });

          // Si el error es de RLS, mostrar mensaje específico
          if (insertError.code === '42501' || insertError.message?.includes('row-level security')) {
            console.error('🔒 ERROR RLS: necesitas iniciar sesión como admin para gestionar redirecciones.');
            return { success: false, error: 'Error de permisos al crear redirección. Contacta al administrador.' };
          }
          return { success: false, error: `Error al crear redirección: ${insertError.message}` };
        } else {
          console.log('✅ [updateBusinessSlug] Redirección creada EXITOSAMENTE:', insertedData);
        }
      } else {
        console.log('⏭️ [updateBusinessSlug] Redirección ya existe, saltando:', existingRedirect);
      }
      // Nota: Si la redirección ya existe para esta empresa, no la duplicamos
    } else {
      console.log('[updateBusinessSlug] No se creará redirección:', {
        createRedirect,
        hasOldSlug: !!oldSlug,
        oldSlug,
        newSlug,
        slugsAreDifferent: oldSlug !== newSlug && oldSlug !== newSlug.toLowerCase()
      });
    }

    // Limpiar caché
    clearCache('business_');

    return { success: true };
  } catch (error: any) {
    console.error('Error in updateBusinessSlug:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Eliminar el slug de una empresa (vuelve a usar URL basada en nombre)
 * Útil cuando quieres deshacer una redirección y que la URL original funcione
 */
export const removeBusinessSlug = async (businessId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error: updateError } = await supabase
      .from('businesses')
      .update({ slug: null })
      .eq('id', businessId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Limpiar caché
    clearCache('business_');

    return { success: true };
  } catch (error: any) {
    console.error('Error in removeBusinessSlug:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Buscar redirección por slug antiguo
 * Busca tanto la URL exacta como versión case-insensitive
 */
export const getRedirectByOldSlug = async (oldSlug: string): Promise<{ business_id: string; new_slug: string } | null> => {
  try {
    // Primero intentar búsqueda exacta, luego case-insensitive
    let redirect = null;

    // 1. Búsqueda exacta
    const { data: exactMatch } = await supabase
      .from('url_redirects')
      .select('business_id, old_slug')
      .eq('old_slug', oldSlug)
      .maybeSingle();

    if (exactMatch) {
      redirect = exactMatch;
    } else {
      // 2. Búsqueda case-insensitive (ilike)
      const { data: insensitiveMatch } = await supabase
        .from('url_redirects')
        .select('business_id, old_slug')
        .ilike('old_slug', oldSlug)
        .maybeSingle();

      redirect = insensitiveMatch;
    }

    if (!redirect) return null;

    // Obtener el nuevo slug de la empresa
    const { data: business } = await supabase
      .from('businesses')
      .select('slug, name')
      .eq('id', redirect.business_id)
      .single();

    if (!business) return null;

    // Incrementar hits en background (no esperar)
    incrementRedirectHits(redirect.old_slug);

    return {
      business_id: redirect.business_id,
      new_slug: business.slug || business.name?.replace(/ /g, '_') || ''
    };
  } catch (error) {
    console.error('Error in getRedirectByOldSlug:', error);
    return null;
  }
};

/**
 * Incrementar contador de hits de redirección
 */
export const incrementRedirectHits = async (oldSlug: string): Promise<void> => {
  try {
    await supabase.rpc('increment_redirect_hits', { slug_param: oldSlug.toLowerCase() });
  } catch (error) {
    // Fallback: actualizar manualmente si la función RPC no existe
    try {
      const { data } = await supabase
        .from('url_redirects')
        .select('hits')
        .eq('old_slug', oldSlug.toLowerCase())
        .single();

      if (data) {
        await supabase
          .from('url_redirects')
          .update({ hits: (data.hits || 0) + 1 })
          .eq('old_slug', oldSlug.toLowerCase());
      }
    } catch {
      // Silently fail - hits tracking is not critical
    }
  }
};

/**
 * Obtener todas las redirecciones (para admin).
 * Admin-only flow; covered by "Only admins can manage redirects" policy.
 */
export const getUrlRedirects = async () => {
  try {
    const { data, error } = await supabase
      .from('url_redirects')
      .select(`
        *,
        businesses:business_id (id, name, slug, country, logo_url)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching redirects:', error);
      throw error;
    }
    return data || [];
  } catch (error) {
    console.error('Error in getUrlRedirects:', error);
    return [];
  }
};

/**
 * Eliminar una redirección.
 * Admin-only flow; covered by "Only admins can manage redirects" policy.
 */
export const deleteUrlRedirect = async (id: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('url_redirects')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting redirect:', error);
    }
    return !error;
  } catch (error) {
    console.error('Error in deleteUrlRedirect:', error);
    return false;
  }
};

/**
 * Obtener empresas con URLs problemáticas (para admin)
 * @param page - Número de página (1-indexed)
 * @param pageSize - Tamaño de página
 * @param searchTerm - Término de búsqueda opcional para filtrar por nombre
 *                     Si hay searchTerm, busca en TODAS las empresas (para poder editar cualquiera)
 *                     Si no hay searchTerm, solo muestra las que no tienen slug
 */
export const getBusinessesWithProblematicUrls = async (
  page: number = 1,
  pageSize: number = 50,
  searchTerm?: string
) => {
  try {
    const offset = (page - 1) * pageSize;
    const hasSearch = searchTerm && searchTerm.trim();

    // Conteo de empresas SIN slug (siempre mostrar este número en el tab)
    const { count: problematicCount, error: problemCountError } = await supabase
      .from('businesses')
      .select('id', { count: 'exact', head: true })
      .is('slug', null);

    if (problemCountError) throw problemCountError;

    // Si hay búsqueda, buscar en TODAS las empresas
    // Si no hay búsqueda, solo mostrar las que no tienen slug
    let countQuery = supabase
      .from('businesses')
      .select('id', { count: 'exact', head: true });

    if (hasSearch) {
      // Buscar en todas las empresas
      countQuery = countQuery.ilike('name', `%${searchTerm!.trim()}%`);
    } else {
      // Solo empresas sin slug
      countQuery = countQuery.is('slug', null);
    }

    const { count: totalCount, error: countError } = await countQuery;
    if (countError) throw countError;

    // Obtener datos
    let dataQuery = supabase
      .from('businesses')
      .select('id, name, slug, country, logo_url, created_at');

    if (hasSearch) {
      // Buscar en todas las empresas
      dataQuery = dataQuery.ilike('name', `%${searchTerm!.trim()}%`);
    } else {
      // Solo empresas sin slug
      dataQuery = dataQuery.is('slug', null);
    }

    const { data, error } = await dataQuery
      .order('name', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;

    return {
      data: data || [],
      total: totalCount || 0,
      problematicCount: problematicCount || 0
    };
  } catch (error) {
    console.error('Error in getBusinessesWithProblematicUrls:', error);
    return { data: [], total: 0, problematicCount: 0 };
  }
};

/**
 * Actualizar múltiples slugs en batch
 */
export const batchUpdateSlugs = async (
  updates: Array<{ businessId: string; newSlug: string; createRedirect: boolean; originalUrlSlug?: string }>
): Promise<{ success: number; failed: number; errors: string[] }> => {
  const results = { success: 0, failed: 0, errors: [] as string[] };

  console.log(`[batchUpdateSlugs] Iniciando batch de ${updates.length} empresas`);

  for (let i = 0; i < updates.length; i++) {
    const update = updates[i];
    console.log(`[batchUpdateSlugs] Procesando ${i + 1}/${updates.length}:`, update.originalUrlSlug);

    try {
      const result = await updateBusinessSlug(
        update.businessId,
        update.newSlug,
        update.createRedirect,
        update.originalUrlSlug
      );

      if (result.success) {
        results.success++;
        console.log(`[batchUpdateSlugs] ✓ ${i + 1}/${updates.length} exitoso`);
      } else {
        results.failed++;
        results.errors.push(`${update.originalUrlSlug}: ${result.error}`);
        console.error(`[batchUpdateSlugs] ✗ ${i + 1}/${updates.length} falló:`, result.error);
      }
    } catch (error: any) {
      results.failed++;
      const errorMsg = error?.message || 'Error desconocido';
      results.errors.push(`${update.originalUrlSlug}: ${errorMsg}`);
      console.error(`[batchUpdateSlugs] ✗ ${i + 1}/${updates.length} excepción:`, error);
    }
  }

  console.log(`[batchUpdateSlugs] Finalizado: ${results.success} exitosos, ${results.failed} fallidos`);
  if (results.errors.length > 0) {
    console.error('[batchUpdateSlugs] Errores:', results.errors);
  }

  return results;
};

// Export a default object with all functions for convenience
export default {
  supabase,
  signIn,
  signInWithGoogle,
  signOut,
  signUp,
  resetPassword,
  updatePassword,
  getUserProfile,
  updateUserProfile,
  updateUserRole,
  upgradeUserToBusinessOwner,
  getBusinessByName,
  getBusinessById,
  getBusinessesForOwner,
  getBusinessListItemById,
  searchBusinessList,
  getBusinessIdAndNameList,
  getBusinessesWithLocations,
  updateBusinessProfile,
  userCreateBusiness,
  createReview,
  getPublicReviews,
  getBusinessCountByFilters,
  voteOnReview,
  getRejectedReviewsForUser,
  getNotifications,
  markNotificationsAsRead,
  savePushSubscription,
  getAdminBusinessesPaginated,
  adminBulkUpdateBusinesses,
  getAdminUsersPaginated,
  adminGetFeaturedCompanies,
  adminSetFeaturedCompanies,
  getAdminReviewAppeals,
  resolveReviewAppeal,
  createClaim,
  createBugReport,
  createReviewAppeal,
  sendSupportEmail,
  getEnterpriseUsers,
  searchAssignableUsers,
  getCachedTranslation,
  setCachedTranslation,
};

// ==================== Translation Cache ====================

async function getCachedTranslation(textHash: string, targetLang: string): Promise<string | null> {
  const { data } = await supabase
    .from('translation_cache')
    .select('translated_text')
    .eq('text_hash', textHash)
    .eq('target_lang', targetLang)
    .single();
  return data?.translated_text || null;
}

async function setCachedTranslation(textHash: string, sourceText: string, targetLang: string, translatedText: string): Promise<void> {
  await supabase
    .from('translation_cache')
    .upsert({
      text_hash: textHash,
      source_text: sourceText.slice(0, 500),
      target_lang: targetLang,
      translated_text: translatedText,
    }, { onConflict: 'text_hash,target_lang' });
}
