
// supabase/functions/start-scraping-search/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Type declarations for Deno environment
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY');
    if (!SERPAPI_KEY) {
      throw new Error('La clave de API del servidor (SERPAPI_KEY) no está configurada.');
    }
    
    // Create a Supabase client with the user's auth token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { searchUrls, country } = await req.json();
    if (!Array.isArray(searchUrls) || searchUrls.length === 0) {
      throw new Error('Se requiere al menos una URL de búsqueda de Google Maps.');
    }
    if (!country) {
        throw new Error('Se requiere el país.');
    }

    let allPotentialItems: any[] = [];

    for (const searchUrl of searchUrls) {
        if (!searchUrl || !(searchUrl.includes('google.com/maps') || searchUrl.includes('google.com/search'))) {
            console.warn(`URL inválida omitida: ${searchUrl}`);
            continue;
        }

        let searchQuery = '';
        let ll = ''; // Coordinates parameter for SerpApi

        try {
            const urlObj = new URL(searchUrl);
            if (urlObj.pathname.includes('/maps/search/')) {
                // Standard Maps URL: google.com/maps/search/query/...
                // FIX: We must replace '+' with ' ' BEFORE decoding to get a clean search query.
                const rawQuery = urlObj.pathname.split('/search/')[1].split('/')[0];
                searchQuery = decodeURIComponent(rawQuery.replace(/\+/g, ' '));
            } else if (urlObj.searchParams.has('q')) {
                // Generic search URL: google.com/search?q=query...
                searchQuery = urlObj.searchParams.get('q') || '';
            }

            // Extract coordinates if present: @lat,long,zoom(z)
            // Example: @48.8623173,2.260752,12z
            const coordsMatch = searchUrl.match(/@([\d.-]+),([\d.-]+),([\d.]+)z/);
            if (coordsMatch) {
                // FIXED: Remove 'z' suffix as per user/Claude suggestion for better SerpApi compatibility in this context
                ll = `@${coordsMatch[1]},${coordsMatch[2]},${coordsMatch[3]}`;
            }

        } catch (e) {
            console.warn(`Error al parsear URL: ${searchUrl}`, e);
        }

        if (!searchQuery) {
            console.warn(`No se pudo extraer la consulta de la URL: ${searchUrl}`);
            continue;
        }

        // Initial parameters for SerpApi
        const initialParams = new URLSearchParams({
            engine: 'google_maps',
            q: searchQuery,
            api_key: SERPAPI_KEY,
            hl: 'es',
            num: '20',
            type: 'search'
        });

        // If coordinates were found, pass them to SerpApi to ensure we look in the right place
        if (ll) {
            initialParams.append('ll', ll);
        }

        let currentPageUrl: string | undefined = `${SERPAPI_BASE_URL}?${initialParams}`;
        let pageCount = 0;
        const MAX_PAGES = 50; // Limit to 50 pages (approx. 1000 results)

        while (currentPageUrl && pageCount < MAX_PAGES) {
            pageCount++;
            console.log(`Scraping page ${pageCount} for query: ${searchQuery} (ll: ${ll || 'none'})`);

            const response = await fetch(currentPageUrl);
            if (!response.ok) {
                console.warn(`Error de SerpApi en página ${pageCount} para URL ${searchUrl}: ${response.statusText}`);
                break; // Stop paginating for this URL on error
            }
            const searchData = await response.json();

            if (searchData.local_results && searchData.local_results.length > 0) {
                const itemsFromPage = searchData.local_results
                    .map((item: any) => ({
                        source_url: searchUrl,
                        google_place_id: item.place_id,
                        business_name: item.title,
                        data_id: item.data_id,
                        google_maps_url: item.link || `https://www.google.com/maps/place/?q=place_id:${item.place_id}`,
                        status: 'pending',
                        country: country,
                        // Optional: capture thumbnail if available to use later
                        logo_url: item.thumbnail
                    }))
                    .filter((item: any) => item.data_id && item.google_place_id);
                
                allPotentialItems.push(...itemsFromPage);
            }
            
            // Get the URL for the next page, if it exists
            currentPageUrl = searchData.serpapi_pagination?.next;
            
            if (currentPageUrl) {
                // SerpApi's 'next' link already contains the API key.
                // Small delay to be respectful to the API.
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    }

    if (allPotentialItems.length === 0) {
        return new Response(JSON.stringify({ added_to_queue: 0 }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }

    // Check for existing items to avoid duplicates
    const allPlaceIds = allPotentialItems.map((item: any) => item.google_place_id);
    // Optimization: Chunk the place IDs to avoid hitting URL length limits if many items
    const chunkSize = 100;
    const existingIdsSet = new Set();
    
    for (let i = 0; i < allPlaceIds.length; i += chunkSize) {
        const chunk = allPlaceIds.slice(i, i + chunkSize);
        const { data: existingItems, error: selectError } = await supabaseClient
            .from('scraping_queue')
            .select('google_place_id')
            .in('google_place_id', chunk);

        if (selectError) {
             console.error("Error checking duplicates:", selectError);
             // Continue without deduplication in worst case, or throw? Throwing is safer to avoid mass dupes.
             throw new Error("Error verificando duplicados en la cola.");
        }
        existingItems?.forEach((item: any) => existingIdsSet.add(item.google_place_id));
    }

    const itemsToInsert = allPotentialItems.filter((item: any) => !existingIdsSet.has(item.google_place_id));

    // Remove duplicates within the new batch itself (e.g. if same business appears in multiple search URLs)
    const uniqueItemsToInsert = Array.from(new Map(itemsToInsert.map(item => [item.google_place_id, item])).values());

    if (uniqueItemsToInsert.length === 0) {
        return new Response(JSON.stringify({ added_to_queue: 0, message: "Todos los negocios encontrados ya estaban en la cola." }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }

    // Insert new items in chunks to avoid payload limits
    let totalInserted = 0;
    for (let i = 0; i < uniqueItemsToInsert.length; i += chunkSize) {
        const batch = uniqueItemsToInsert.slice(i, i + chunkSize);
        const { error: insertError } = await supabaseClient
            .from('scraping_queue')
            .insert(batch);

        if (insertError) {
             console.error('Insert error in batch:', insertError);
             // Don't throw immediately, try to insert other batches.
        } else {
            totalInserted += batch.length;
        }
    }
    
    return new Response(JSON.stringify({ added_to_queue: totalInserted }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in start-scraping-search function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})
