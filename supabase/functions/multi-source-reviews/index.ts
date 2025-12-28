// supabase/functions/multi-source-reviews/index.ts

// Provides type information for the Deno environment in Supabase Edge Functions.
// FIX: Add Deno type declarations for the Supabase Edge Function environment.
declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
};

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

// CORS headers to allow your frontend application to call this function.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // For production, restrict this to your domain: 'https://app.opynio.com'
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SERPAPI_BASE_URL = 'https://serpapi.com/search.json';

interface MultiSourceReview {
  review_id: string;
  platform: string;
  user?: { name?: string; thumbnail?: string; reviews?: number; };
  rating?: number;
  snippet?: string;
  iso_date?: string;
  likes?: number;
  response?: { snippet?: string; iso_date?: string; };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { 
      business_name, 
      location = "España",
      sources = ['google', 'facebook', 'yelp', 'tripadvisor'],
      max_reviews_per_source = 20
    } = await req.json();

    if (!business_name) {
      throw new Error('business_name es requerido');
    }

    const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY');
    if (!SERPAPI_KEY) {
      throw new Error('La clave de API del servidor no está configurada. Contacta al administrador.');
    }

    console.log(`Extrayendo reseñas para: ${business_name} en ${location}`);
    
    let allReviews: MultiSourceReview[] = [];
    let businessInfo: any = null;

    if (sources.includes('google')) {
      try {
        console.log('Extrayendo de Google Maps...');
        const searchParams = new URLSearchParams({
          engine: 'google_maps', q: business_name, ll: `@0,0,5z`, // Broader search
          type: 'search', api_key: SERPAPI_KEY, hl: 'es'
        });
        const searchResponse = await fetch(`${SERPAPI_BASE_URL}?${searchParams}`);
        const searchData = await searchResponse.json();

        if (searchData.local_results && searchData.local_results.length > 0) {
          const firstResult = searchData.local_results[0];
          businessInfo = businessInfo || {
            title: firstResult.title, address: firstResult.address,
            rating: firstResult.rating, type: firstResult.type || 'Negocio'
          };
          if (firstResult.data_id) {
            const reviewsParams = new URLSearchParams({
              engine: 'google_maps_reviews', data_id: firstResult.data_id,
              api_key: SERPAPI_KEY, sort_by: 'newestFirst', hl: 'es'
            });
            const reviewsResponse = await fetch(`${SERPAPI_BASE_URL}?${reviewsParams}`);
            const reviewsData = await reviewsResponse.json();
            if (reviewsData.reviews) {
              const googleReviews = reviewsData.reviews.slice(0, max_reviews_per_source).map((r: any) => ({ ...r, review_id: `google-${r.review_id}`, platform: 'google' }));
              allReviews = allReviews.concat(googleReviews);
              console.log(`Google: ${googleReviews.length} reseñas extraídas`);
            }
          }
        }
      } catch (error) {
        console.error('Error extrayendo de Google:', error);
      }
    }

    const summary = {
      total_reviews: allReviews.length,
      sources_used: sources,
      reviews_by_platform: sources.reduce((acc: any, platform: string) => {
        acc[platform] = allReviews.filter(r => r.platform === platform).length;
        return acc;
      }, {})
    };
    console.log('Extracción completada:', summary);

    return new Response(JSON.stringify({ success: true, business_info: businessInfo, reviews: allReviews, summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Error en multi-source-reviews:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
