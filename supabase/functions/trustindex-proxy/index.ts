// supabase/functions/multi-source-reviews/index.ts

// FIX: Add Deno type declarations for the Supabase Edge Function environment.
// This resolves the "Property 'env' does not exist on type 'typeof Deno'" error.
declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
};

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

interface ReviewSource {
  platform: string;
  query: string;
  location?: string;
  data_id?: string;
}

interface MultiSourceReview {
  review_id: string;
  platform: string;
  user?: {
    name?: string;
    thumbnail?: string;
    reviews?: number;
  };
  rating?: number;
  snippet?: string;
  iso_date?: string;
  likes?: number;
  response?: {
    snippet?: string;
    iso_date?: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { 
      business_name, 
      location = "España",
      sources = ['google', 'facebook', 'yelp'],
      max_reviews_per_source = 20
    } = await req.json();

    if (!business_name) {
      throw new Error('business_name es requerido');
    }

    const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY');
    if (!SERPAPI_KEY) {
      throw new Error('SERPAPI_KEY no configurada');
    }

    console.log(`Extrayendo reseñas para: ${business_name} en ${location}`);
    
    let allReviews: MultiSourceReview[] = [];
    let businessInfo: any = null;

    // 1. GOOGLE MAPS REVIEWS
    if (sources.includes('google')) {
      try {
        console.log('Extrayendo de Google Maps...');
        
        // Primero buscar el negocio
        const searchParams = new URLSearchParams({
          engine: 'google_maps',
          q: business_name,
          ll: location,
          type: 'search',
          api_key: SERPAPI_KEY
        });

        const searchResponse = await fetch(`https://serpapi.com/search?${searchParams}`);
        const searchData = await searchResponse.json();

        if (searchData.local_results && searchData.local_results.length > 0) {
          const firstResult = searchData.local_results[0];
          businessInfo = businessInfo || {
            title: firstResult.title,
            address: firstResult.address,
            rating: firstResult.rating,
            type: firstResult.type || 'Negocio'
          };

          if (firstResult.data_id) {
            // Extraer reseñas usando el data_id
            const reviewsParams = new URLSearchParams({
              engine: 'google_maps_reviews',
              data_id: firstResult.data_id,
              api_key: SERPAPI_KEY,
              sort_by: 'qualityScore'
            });

            const reviewsResponse = await fetch(`https://serpapi.com/search?${reviewsParams}`);
            const reviewsData = await reviewsResponse.json();

            if (reviewsData.reviews) {
              const googleReviews = reviewsData.reviews.slice(0, max_reviews_per_source).map((review: any) => ({
                review_id: `google_${review.date}_${review.user?.name || 'unknown'}`.replace(/\s+/g, '_'),
                platform: 'google',
                user: review.user,
                rating: review.rating,
                snippet: review.snippet,
                iso_date: review.iso_date,
                likes: review.likes,
                response: review.response
              }));
              
              allReviews = allReviews.concat(googleReviews);
              console.log(`Google: ${googleReviews.length} reseñas extraídas`);
            }
          }
        }
      } catch (error) {
        console.error('Error extrayendo de Google:', error);
      }
    }

    // 2. YELP REVIEWS
    if (sources.includes('yelp')) {
      try {
        console.log('Extrayendo de Yelp...');
        
        const yelpParams = new URLSearchParams({
          engine: 'yelp',
          find_desc: business_name,
          find_loc: location,
          api_key: SERPAPI_KEY
        });

        const yelpResponse = await fetch(`https://serpapi.com/search?${yelpParams}`);
        const yelpData = await yelpResponse.json();

        if (yelpData.organic_results && yelpData.organic_results.length > 0) {
          const firstYelpResult = yelpData.organic_results[0];
          
          if (firstYelpResult.reviews) {
            const yelpReviews = firstYelpResult.reviews.slice(0, max_reviews_per_source).map((review: any, index: number) => ({
              review_id: `yelp_${index}_${review.user?.name || 'unknown'}`.replace(/\s+/g, '_'),
              platform: 'yelp',
              user: {
                name: review.user?.name,
                thumbnail: review.user?.thumbnail
              },
              rating: review.rating,
              snippet: review.comment,
              iso_date: review.date ? new Date(review.date).toISOString() : new Date().toISOString()
            }));
            
            allReviews = allReviews.concat(yelpReviews);
            console.log(`Yelp: ${yelpReviews.length} reseñas extraídas`);
          }
        }
      } catch (error) {
        console.error('Error extrayendo de Yelp:', error);
      }
    }

    // 3. FACEBOOK REVIEWS (si está disponible)
    if (sources.includes('facebook')) {
      try {
        console.log('Buscando en Facebook...');
        
        // Buscar en Google por reseñas de Facebook
        const fbSearchParams = new URLSearchParams({
          engine: 'google',
          q: `"${business_name}" site:facebook.com reseñas`,
          api_key: SERPAPI_KEY
        });

        const fbSearchResponse = await fetch(`https://serpapi.com/search?${fbSearchParams}`);
        const fbSearchData = await fbSearchResponse.json();

        // Nota: Facebook reviews son más difíciles de extraer directamente
        // Este es un enfoque básico que podría necesitar mejoras
        console.log('Facebook search completed (limited data available)');
      } catch (error) {
        console.error('Error buscando en Facebook:', error);
      }
    }

    // 4. TRIPADVISOR (para hoteles/restaurantes)
    if (sources.includes('tripadvisor')) {
      try {
        console.log('Extrayendo de TripAdvisor...');
        
        const taParams = new URLSearchParams({
          engine: 'tripadvisor',
          q: business_name,
          api_key: SERPAPI_KEY
        });

        const taResponse = await fetch(`https://serpapi.com/search?${taParams}`);
        const taData = await taResponse.json();

        if (taData.results && taData.results.length > 0) {
          const firstTAResult = taData.results[0];
          
          if (firstTAResult.reviews) {
            const taReviews = firstTAResult.reviews.slice(0, max_reviews_per_source).map((review: any, index: number) => ({
              review_id: `tripadvisor_${index}_${review.user?.name || 'unknown'}`.replace(/\s+/g, '_'),
              platform: 'tripadvisor',
              user: {
                name: review.user?.name,
                thumbnail: review.user?.avatar
              },
              rating: review.rating,
              snippet: review.text,
              iso_date: review.date ? new Date(review.date).toISOString() : new Date().toISOString()
            }));
            
            allReviews = allReviews.concat(taReviews);
            console.log(`TripAdvisor: ${taReviews.length} reseñas extraídas`);
          }
        }
      } catch (error) {
        console.error('Error extrayendo de TripAdvisor:', error);
      }
    }

    // Resumen de resultados
    const summary = {
      total_reviews: allReviews.length,
      sources_used: sources,
      reviews_by_platform: sources.reduce((acc: any, platform: string) => {
        acc[platform] = allReviews.filter(r => r.platform === platform).length;
        return acc;
      }, {})
    };

    console.log('Extracción completada:', summary);

    return new Response(
      JSON.stringify({
        success: true,
        business_info: businessInfo,
        reviews: allReviews,
        summary
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error en multi-source-reviews:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: error.stack
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});