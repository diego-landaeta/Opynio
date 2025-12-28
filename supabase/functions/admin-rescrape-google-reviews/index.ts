// supabase/functions/admin-rescrape-google-reviews/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SERPAPI_BASE_URL = 'https://serpapi.com/search.json';
const MAX_REVIEW_PAGES_PER_BUSINESS = 50;


// HELPER FUNCTIONS FOR URL PARSING
function isValidGoogleMapsUrl(url: string): boolean {
    return url.includes('google.com/maps') || url.includes('maps.google.com');
}

// FIX: This function now correctly identifies the type of identifier (place_id vs data_id)
// and returns an object, which is crucial for making the correct SerpApi call.
function extractPlaceIdentifier(googleMapsUrl: string): { type: 'place_id' | 'data_id', value: string } | null {
  if (!isValidGoogleMapsUrl(googleMapsUrl)) {
    console.warn(`URL no válida de Google Maps: ${googleMapsUrl}`);
    return null;
  }

  const decodedUrl = decodeURIComponent(googleMapsUrl);
  console.log(`Intentando extraer de la URL decodificada: ${decodedUrl}`);
  
  // Prioritize place_id as it's more standard for the API
  const placeIdPatterns = [
      /place_id=([A-Za-z0-9_-]{20,})/i,
      /q=place_id:([A-Za-z0-9_-]{20,})/i,
  ];

  for (const pattern of placeIdPatterns) {
      const placeIdMatch = decodedUrl.match(pattern);
      if (placeIdMatch && placeIdMatch[1]) {
          console.log(`Place ID encontrado: ${placeIdMatch[1]}`);
          return { type: 'place_id', value: placeIdMatch[1] };
      }
  }

  // Patterns for data_id (hex) and cid (numeric)
  const dataIdPatterns = [
      /!1s(0x[a-f0-9]{14,16}:0x[a-f0-9]{14,16})/i,
      /data=.*?1s(0x[a-f0-9]{14,16}:0x[a-f0-9]{14,16})/i,
      /cid=(\d{10,})/,
      /(0x[a-f0-9]{14,16}:0x[a-f0-9]{14,16})/i, // fallback for hex without context
  ];
  
  for (const pattern of dataIdPatterns) {
    const match = decodedUrl.match(pattern);
    if (match && match[1]) {
      console.log(`Data ID (o CID) encontrado: ${match[1]}`);
      return { type: 'data_id', value: match[1] };
    }
  }

  console.warn(`No se pudo extraer un ID válido de la URL: ${decodedUrl}`);
  return null;
}


async function rescrapeBusiness(businessId: string, supabase: SupabaseClient, adminId: string, SERPAPI_KEY: string): Promise<{ newReviewsCount: number, processed: boolean }> {
    console.log(`Iniciando re-scrape para la empresa: ${businessId}`);
    let newReviewsCount = 0;
    
    try {
        const { data: business, error: businessError } = await supabase
          .from('businesses')
          .select('google_maps_url, category')
          .eq('id', businessId)
          .single();

        if (businessError || !business || !business.google_maps_url) {
            throw new Error(businessError?.message || `No se encontró URL de Google para la empresa ${businessId}.`);
        }
        
        const identifier = extractPlaceIdentifier(business.google_maps_url);
        if (!identifier) {
            throw new Error(`No se pudo extraer un identificador válido de la URL: ${business.google_maps_url}`);
        }

        let allReviews: any[] = [];
        let nextPageToken: string | undefined = undefined;
        let page = 0;

        do {
            page++;
            const params = new URLSearchParams({ 
                engine: 'google_maps_reviews', 
                api_key: SERPAPI_KEY, 
                hl: 'es', 
                num: '20' 
            });
            params.set(identifier.type, identifier.value);
            if (nextPageToken) params.set('next_page_token', nextPageToken);
            
            const response = await fetch(`${SERPAPI_BASE_URL}?${params}`);
            if (!response.ok) throw new Error(`La solicitud a SerpApi falló en la página ${page}: ${response.statusText}`);
            
            const data = await response.json();
            if (data.error) throw new Error(`Error de SerpApi en la página ${page}: ${data.error}`);
            
            if (data.reviews?.length > 0) allReviews.push(...data.reviews);
            nextPageToken = data.serpapi_pagination?.next_page_token;
        } while (nextPageToken && page < MAX_REVIEW_PAGES_PER_BUSINESS);

        if (allReviews.length > 0) {
            const sourceIds = allReviews.map(r => `google-${r.review_id}`);
            const { data: existingReviews, error: checkError } = await supabase
                .from('reviews')
                .select('source_id')
                .eq('business_id', businessId)
                .in('source_id', sourceIds);
            if (checkError) throw new Error(`Error al verificar reseñas existentes: ${checkError.message}`);
    
            const existingSourceIds = new Set(existingReviews.map(r => r.source_id));
            const newReviews = allReviews.filter(r => !existingSourceIds.has(`google-${r.review_id}`));
            newReviewsCount = newReviews.length;
    
            if (newReviews.length > 0) {
                const reviewsToInsert = newReviews.map(review => ({
                    rating: review.rating,
                    title: review.snippet ? `${review.snippet.substring(0, 50)}...` : `Reseña de ${review.rating} estrellas`,
                    review_text: review.snippet || null,
                    created_at: review.iso_date || new Date().toISOString(),
                    user_id: adminId,
                    business_id: businessId,
                    category: business.category,
                    source: 'google',
                    source_id: `google-${review.review_id}`,
                    original_author_name: review.user?.name || 'Usuario de Google',
                    is_verified_purchase: false,
                    original_response_text: review.response?.snippet || null,
                    original_response_date: review.response?.iso_date || null,
                }));
                const { error: insertError } = await supabase.from('reviews').insert(reviewsToInsert);
                if (insertError) throw new Error(`Error al insertar nuevas reseñas: ${insertError.message}`);
            }
        }
    
        await supabase
          .from('businesses')
          .update({
            last_google_scrape_at: new Date().toISOString(),
            last_google_scrape_new_reviews: newReviewsCount,
          })
          .eq('id', businessId);

        console.log(`Re-scrape exitoso para ${businessId}. Nuevas reseñas: ${newReviewsCount}.`);
        return { newReviewsCount, processed: true };

    } catch (error) {
        console.error(`Falló el re-scrape para la empresa ${businessId}:`, error.message);
        await supabase
          .from('businesses')
          .update({
            last_google_scrape_at: new Date().toISOString(),
            last_google_scrape_new_reviews: 0,
          })
          .eq('id', businessId);
        return { newReviewsCount: 0, processed: false };
    }
}


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY');
    if (!SERPAPI_KEY) {
      throw new Error('La clave de API del servidor (SERPAPI_KEY) no está configurada.');
    }
    
    // Crear un cliente con privilegios de administrador para todas las operaciones.
    const supabaseAdminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    let adminId: string;
    const internalCallSecret = req.headers.get('X-Internal-Secret');
    const INTERNAL_SECRET = Deno.env.get('INTERNAL_SECRET');

    if (internalCallSecret && internalCallSecret === INTERNAL_SECRET) {
        // Llamada interna (ej: desde un cron job). Buscamos un ID de admin para atribuir las reseñas.
        const { data: adminProfile, error: adminError } = await supabaseAdminClient
            .from('profiles')
            .select('id')
            .eq('role', 'admin')
            .limit(1)
            .single();
        if (adminError || !adminProfile) throw new Error('No se encontró un usuario administrador para atribuir las reseñas.');
        adminId = adminProfile.id;
    } else {
        // Llamada pública (desde el dashboard). Verificamos que el usuario sea admin.
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        );

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
        if (authError || !user) {
            throw new Error('No autorizado');
        }
        const { data: profile } = await supabaseClient.from('profiles').select('role').eq('id', user.id).single();
        if (profile?.role !== 'admin') {
            throw new Error('Acción solo para administradores.');
        }
        adminId = user.id;
    }

    const { businessIds } = await req.json();
    if (!Array.isArray(businessIds) || businessIds.length === 0) {
      throw new Error('Se requiere un array de IDs de empresas.');
    }

    const results = await Promise.allSettled(
        businessIds.map(id => rescrapeBusiness(id, supabaseAdminClient, adminId, SERPAPI_KEY))
    );

    let totalNewReviews = 0;
    let businessesProcessed = 0;
    
    results.forEach(result => {
        if (result.status === 'fulfilled' && result.value.processed) {
            totalNewReviews += result.value.newReviewsCount;
            businessesProcessed++;
        }
    });
    
    return new Response(JSON.stringify({
        total_new_reviews: totalNewReviews,
        businesses_processed: businessesProcessed,
        total_requested: businessIds.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error en la función admin-rescrape-google-reviews:', error.message);
    return new Response(JSON.stringify({ error: error.message, details: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})