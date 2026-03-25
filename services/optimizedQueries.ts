import { supabase } from './supabaseService';

// Optimized query for latest businesses with minimal data
export const getLatestBusinessesOptimized = async (limit: number = 5, country?: string) => {
  let query = supabase
    .from('businesses')
    .select('id, name, category, country, created_at, sedes')
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (country) {
    query = query.eq('country', country);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

// Optimized query for featured/all companies by country
// Returns ALL companies for the country (no limit), shuffled for variety in the slider
export const getFeaturedCompaniesOptimized = async (country?: string) => {
  return getRandomCompaniesOptimized(undefined, country);
};

// Optimized query for random/all companies by country
// Returns companies with reviews first, shuffled, limited to 20 for performance
// Uses a single batch query instead of individual queries per business
export const getRandomCompaniesOptimized = async (limit: number = 20, country?: string) => {
  // Step 1: Get businesses filtered by country
  let businessQuery = supabase
    .from('businesses')
    .select('id, name, country, logo_url, category, sedes')
    .limit(50);

  if (country) {
    businessQuery = businessQuery.eq('country', country);
  }

  const { data: businesses, error: businessError } = await businessQuery;

  if (businessError) {
    console.error('❌ Error fetching companies:', businessError);
    return [];
  }

  if (!businesses || businesses.length === 0) {
    return [];
  }

  // Step 2: Get ALL reviews for these businesses in ONE query (much faster!)
  const businessIds = businesses.map(b => b.id);
  const { data: allReviews, error: reviewsError } = await supabase
    .from('reviews')
    .select('business_id, rating')
    .in('business_id', businessIds)
    .eq('status', 'approved')
    .lte('created_at', new Date().toISOString());

  if (reviewsError) {
    console.error('❌ Error fetching reviews:', reviewsError);
    // Continue without review data
  }

  // Step 3: Calculate stats from the batch results
  const reviewsByBusiness = new Map<string, number[]>();
  (allReviews || []).forEach(review => {
    const ratings = reviewsByBusiness.get(review.business_id) || [];
    ratings.push(review.rating || 0);
    reviewsByBusiness.set(review.business_id, ratings);
  });

  const enrichedBusinesses = businesses.map(business => {
    const ratings = reviewsByBusiness.get(business.id) || [];
    const reviewCount = ratings.length;
    const ratingSum = ratings.reduce((sum, r) => sum + r, 0);
    const avgRating = reviewCount > 0 ? ratingSum / reviewCount : 0;

    return {
      ...business,
      review_count: reviewCount,
      avg_rating: Math.round(avgRating * 10) / 10
    };
  });

  // Step 4: Separate businesses WITH reviews and WITHOUT
  const withReviews = enrichedBusinesses.filter(b => b.review_count > 0);
  const withoutReviews = enrichedBusinesses.filter(b => b.review_count === 0);

  // Shuffle both arrays
  const shuffleArray = <T>(arr: T[]): T[] => {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const shuffledWithReviews = shuffleArray(withReviews);
  const shuffledWithoutReviews = shuffleArray(withoutReviews);

  // Prioritize businesses with reviews, then fill with others
  const result = [...shuffledWithReviews, ...shuffledWithoutReviews].slice(0, limit);

  console.log('📊 Companies:', {
    total: result.length,
    withReviews: shuffledWithReviews.length,
    sample: result.slice(0, 3).map(b => ({ name: b.name, rating: b.avg_rating, count: b.review_count }))
  });

  return result;
};

// Optimized query for featured reviews - simplified to avoid timeouts
export const getFeaturedReviewsOptimized = async (country?: string, limit: number = 10) => {
  try {
    // Step 1: Get businesses first (optionally filtered by country)
    let businessQuery = supabase
      .from('businesses')
      .select('id, name, country, category, logo_url')
      .limit(50); // Limit businesses to avoid large IN clauses

    if (country) {
      businessQuery = businessQuery.eq('country', country);
    }

    const { data: businesses, error: bizError } = await businessQuery;

    if (bizError) {
      console.error('Error fetching businesses for reviews:', bizError);
      throw bizError;
    }

    if (!businesses || businesses.length === 0) {
      return [];
    }

    const businessIds = businesses.map(b => b.id);

    // Step 2: Get reviews for these businesses - simple query without joins
    const { data: reviews, error: reviewError } = await supabase
      .from('reviews')
      .select('id, rating, review_text, created_at, user_id, business_id, title, image_urls, audio_url, source, original_author_name, helpful_votes, not_helpful_votes')
      .eq('status', 'approved')
      .lte('created_at', new Date().toISOString())
      .in('business_id', businessIds)
      .order('created_at', { ascending: false })
      .limit(limit * 2); // Get extra to filter

    if (reviewError) {
      console.error('Error fetching reviews:', reviewError);
      throw reviewError;
    }

    if (!reviews || reviews.length === 0) {
      return [];
    }

    // Step 3: Create business map and enrich reviews
    const businessMap = new Map(businesses.map(b => [b.id, b]));

    const enrichedReviews = reviews.map(review => ({
      ...review,
      businesses: businessMap.get(review.business_id) || null
    }));

    // Return limited results
    return enrichedReviews.slice(0, limit);
  } catch (error) {
    console.error('Error in getFeaturedReviewsOptimized:', error);
    throw error;
  }
};

// Optimized query for getting latest businesses (legacy compatibility)
export const getLatestBusinesses = getLatestBusinessesOptimized;

// Optimized query for getting featured reviews (legacy compatibility)
export const getFeaturedReviews = getFeaturedReviewsOptimized;

// Optimized query for getting featured companies (legacy compatibility)
export const getFeaturedCompanies = getFeaturedCompaniesOptimized;

// Optimized query for reviews with pagination
export const getReviewsOptimized = async (
  businessId: string, 
  page: number = 1, 
  limit: number = 20, 
  source: string = 'all',
  ratingFilter: 'all' | '5' | '4+' | '3-' = 'all'
) => {
  try {
    const offset = (page - 1) * limit;
    
    // Optimized field selection - only fetch what we need
    const reviewFields = 'id, rating, title, review_text, audio_url, image_urls, tags, category, created_at, user_id, business_id, status, source, helpful_votes, not_helpful_votes, is_verified_purchase, original_author_name, original_response_text, original_response_date, rejection_reason';

    // First, fetch reviews without the problematic joins
    let query = supabase
      .from('reviews')
      .select(reviewFields)
      .eq('business_id', businessId)
      .eq('status', 'approved')
      .lte('created_at', new Date().toISOString());

    // Apply source filter
    if (source !== 'all') {
      query = query.eq('source', source);
    }

    // Apply rating filter
    if (ratingFilter === '5') {
      query = query.eq('rating', 5);
    } else if (ratingFilter === '4+') {
      query = query.gte('rating', 4);
    } else if (ratingFilter === '3-') {
      query = query.lte('rating', 3);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: reviews, error } = await query;
    
    if (error) {
      console.error('Error fetching reviews:', error);
      throw error;
    }

    if (!reviews || reviews.length === 0) {
      return [];
    }

    // Get unique user IDs and fetch profiles separately
    const userIds = [...new Set(reviews.map(r => r.user_id).filter(Boolean))];
    let profileMap = new Map();
    
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', userIds);
      
      if (profiles) {
        profileMap = new Map(profiles.map(p => [p.id, p]));
      }
    }

    // Get review responses separately
    const reviewIds = reviews.map(r => r.id);
    let responsesMap = new Map();

    if (reviewIds.length > 0) {
      const { data: responses } = await supabase
        .from('review_responses')
        .select('id, review_id, response_text, created_at')
        .in('review_id', reviewIds);

      if (responses) {
        responsesMap = new Map(responses.map(r => [r.review_id, r]));
      }
    }

    // Get business data separately (minimal query with required fields)
    const { data: businessData } = await supabase
      .from('businesses')
      .select('id, name, country, category')
      .eq('id', businessId)
      .single();

    // Enrich reviews with profile, response data, and business data
    const enrichedReviews = reviews.map(review => ({
      ...review,
      profiles: profileMap.get(review.user_id) || null,
      review_responses: responsesMap.get(review.id) ? [responsesMap.get(review.id)] : [],
      businesses: businessData ? {
        name: businessData.name,
        country: businessData.country,
        category: businessData.category
      } : null
    }));

    return enrichedReviews;
  } catch (error) {
    console.error('Error in getReviewsOptimized:', error);
    throw error;
  }
};

// Helper function to remove accents from text
const removeAccents = (text: string): string => {
  return text
    .normalize('NFD') // Descompone caracteres acentuados
    .replace(/[\u0300-\u036f]/g, '') // Elimina los diacríticos
    .toLowerCase();
};

// Optimized query for searching businesses (accent-insensitive)
export const searchBusinessesOptimized = async (searchTerm: string, filters: any = {}) => {
  let query = supabase
    .from('businesses')
    .select('id, name, category, country, logo_url, description, sedes')
    .order('name');

  // Aplicar filtros primero para reducir el conjunto de datos
  if (filters.country) {
    query = query.eq('country', filters.country);
  }

  if (filters.category) {
    // Categories in DB are stored as "Parent Category: Subcategory"
    query = query.ilike('category', `${filters.category}%`);
  }

  // Obtener TODOS los resultados para filtrar en el cliente (sin límite)
  const { data, error } = await query;
  if (error) throw error;

  // Si hay término de búsqueda, filtrar en el cliente para búsqueda sin acentos
  if (searchTerm && data) {
    const normalizedSearch = removeAccents(searchTerm);

    const filtered = data.filter(business => {
      const normalizedName = removeAccents(business.name || '');
      const normalizedCategory = removeAccents(business.category || '');
      const normalizedDescription = removeAccents(business.description || '');

      return (
        normalizedName.includes(normalizedSearch) ||
        normalizedCategory.includes(normalizedSearch) ||
        normalizedDescription.includes(normalizedSearch)
      );
    });

    return filtered.slice(0, 50); // Limitar a 50 resultados finales
  }

  return (data || []).slice(0, 50);
};

export default {
  getLatestBusinessesOptimized,
  getFeaturedCompaniesOptimized,
  getFeaturedReviewsOptimized,
  getLatestBusinesses,
  getFeaturedReviews,
  getFeaturedCompanies,
  getReviewsOptimized,
  searchBusinessesOptimized,
};
