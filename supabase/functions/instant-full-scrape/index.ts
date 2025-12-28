// supabase/functions/instant-full-scrape/index.ts
// Esta función extrae empresas Y reseñas en un solo paso desde URLs de búsqueda de Google Maps

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
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

// Categorías disponibles (copiadas del sistema)
const CATEGORIES: { [key: string]: string[] } = {
    'leisure_and_dining': ['restaurants', 'bars_cafes', 'fast_food', 'nightlife_clubs', 'cinemas_theaters_shows', 'theme_parks'],
    'health_and_wellness': ['clinics_hospitals', 'dental_clinics', 'pharmacies_opticians', 'physiotherapy_rehabilitation', 'psychology_therapy', 'nutrition_dietetics', 'gyms_sports_centers', 'hair_salons_beauty_salons', 'spas_wellness_centers'],
    'shopping_and_retail': ['supermarkets_food_stores', 'clothing_fashion_stores', 'electronics_technology_stores', 'furniture_decoration_stores', 'department_stores', 'jewelry_watch_stores', 'bookstores_stationery', 'toy_stores_children_stores'],
    'home_services': ['renovations_construction', 'cleaning_maintenance', 'plumbing_electricity_locksmithing', 'gardening_landscaping', 'moving_storage', 'home_security'],
    'professional_and_business_services': ['tax_accounting_advisory', 'legal_services_lawyers', 'marketing_advertising_agencies', 'software_development_it_services', 'business_consulting', 'human_resources_recruitment'],
    'automotive': ['vehicle_dealerships', 'mechanical_workshops_repair', 'vehicle_rental', 'service_stations_car_washes', 'parts_accessories_stores'],
    'education_and_training': ['universities_higher_education', 'schools_colleges', 'vocational_training_online_courses', 'language_academies', 'driving_schools', 'private_lessons_tutoring'],
    'finance_and_legal': ['banks_financial_entities', 'insurance_companies', 'investment_services', 'real_estate_agencies'],
    'travel_and_transport': ['hotels_accommodations', 'travel_agencies_tour_operators', 'airlines_transport', 'tourist_attractions_museums'],
    'pets': ['veterinary_clinics', 'pet_stores', 'pet_grooming_pet_sitters', 'dog_training'],
    'events': ['wedding_event_planning', 'event_halls_venues', 'catering_services', 'event_equipment_rental'],
    'emerging_and_other': ['renewable_energies', 'coworking_flexible_offices', 'drone_services', 'virtual_augmented_reality'],
};

// Función para categorizar negocio usando Gemini AI (SOLO 1 intento para evitar límites 429)
async function categorizeBusinessWithAI(businessName: string, businessType: string, address: string, reviewSnippets: string[], geminiKey: string): Promise<string | null> {
    const allSubcategories = Object.entries(CATEGORIES).flatMap(([main, subs]) =>
        subs.map(sub => ({ main, sub, full: `${main}: ${sub}` }))
    );

    try {
        // Pausa de 2 segundos para evitar rate limiting de Gemini (crítico!)
        await new Promise(resolve => setTimeout(resolve, 2000));

        const prompt = `Eres un experto en categorización de negocios. Dado el nombre, tipo y reseñas de un negocio, debes asignarle la categoría más apropiada.

Nombre del negocio: ${businessName}
Tipo: ${businessType}
Dirección: ${address}
Ejemplos de reseñas: ${reviewSnippets.slice(0, 3).join(' | ')}

Categorías disponibles (usa EXACTAMENTE uno de estos valores):
${allSubcategories.map(c => c.full).join('\n')}

IMPORTANTE: Responde SOLO con la categoría en el formato exacto "categoria_principal: subcategoria".
Ejemplo válido: "health_and_wellness: dental_clinics"
NO agregues texto adicional, explicaciones o formato diferente.`;

        const response = await fetch(`${GEMINI_API_URL}?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 100 }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.warn(`⚠️ Gemini API error: ${response.status} - Usando categoría por defecto`);
            return null; // Devolver null para usar categoría por defecto
        }

        const data = await response.json();
        let category = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (!category) {
            console.warn(`⚠️ Gemini no devolvió categoría - Usando categoría por defecto`);
            return null;
        }

        // Limpiar respuesta (remover comillas, espacios extras, etc)
        category = category.replace(/["'`]/g, '').trim();

        // Verificar si la categoría es válida
        const validCategory = allSubcategories.find(c => c.full === category);
        if (validCategory) {
            console.log(`  ✓ Categoría AI: ${category}`);
            return category;
        }

        // Si no es válida, intentar hacer fuzzy matching
        console.warn(`  ⚠️ Categoría AI inválida: "${category}". Intentando match aproximado...`);
        const fuzzyMatch = allSubcategories.find(c =>
            category.toLowerCase().includes(c.sub.toLowerCase()) ||
            c.sub.toLowerCase().includes(category.toLowerCase())
        );

        if (fuzzyMatch) {
            console.log(`  ✓ Match aproximado: ${fuzzyMatch.full}`);
            return fuzzyMatch.full;
        }

        console.warn(`  ⚠️ No se pudo categorizar - Usando categoría por defecto`);
        return null;
    } catch (error) {
        console.error(`❌ Error con Gemini AI:`, error);
        return null; // Usar categoría por defecto
    }
}

// Función para obtener detalles completos de un negocio (NO CRÍTICO - devuelve null si falla)
async function getBusinessDetails(dataId: string, serpApiKey: string): Promise<any> {
    try {
        const url = `${SERPAPI_BASE_URL}?engine=google_maps&type=place&data_id=${dataId}&api_key=${serpApiKey}&hl=es`;

        // Timeout de 10 segundos para evitar que se quede colgado
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.warn(`  ⚠️ SerpAPI place error ${response.status} - continuando sin detalles`);
            return null; // NO es crítico, seguir sin detalles
        }

        const data = await response.json();
        return data.place_results || null;
    } catch (error: any) {
        if (error.name === 'AbortError') {
            console.warn(`  ⚠️ Timeout obteniendo detalles - continuando sin detalles`);
        } else {
            console.warn(`  ⚠️ Error obteniendo detalles: ${error.message}`);
        }
        return null; // NO es crítico, seguir sin detalles
    }
}

// Función para extraer Y GUARDAR reseñas página por página (GUARDA INMEDIATAMENTE)
// LÍMITE: Entre 100-250 reseñas por empresa (variable para evitar patrones y colapsos)
async function scrapeBusinessReviews(
    dataId: string,
    serpApiKey: string,
    sessionId: string,
    supabaseClient: any,
    businessId: string,
    userId: string,
    category: string
): Promise<number> {
    let totalReviewsSaved = 0;
    let nextPageToken: string | undefined = undefined;
    let pageCount = 0;

    // LÍMITE DINÁMICO: Entre 100-250 reseñas por empresa (aleatorio para variabilidad)
    const MIN_REVIEWS = 100;
    const MAX_REVIEWS = 250;
    const reviewLimit = Math.floor(Math.random() * (MAX_REVIEWS - MIN_REVIEWS + 1)) + MIN_REVIEWS;
    console.log(`  📊 Límite de reseñas para esta empresa: ${reviewLimit}`);

    while (true) {
        pageCount++;
        console.log(`  Scraping reviews page ${pageCount} for data_id: ${dataId} (${totalReviewsSaved}/${reviewLimit} reseñas)`);

        // VERIFICAR SI YA ALCANZAMOS EL LÍMITE
        if (totalReviewsSaved >= reviewLimit) {
            console.log(`  ✋ Límite alcanzado: ${totalReviewsSaved}/${reviewLimit} reseñas. Deteniendo extracción.`);
            break;
        }

        // Actualizar progreso de reseñas en DB
        await supabaseClient
            .from('scraping_sessions')
            .update({
                current_review_page: pageCount,
                current_reviews_scraped: totalReviewsSaved
            })
            .eq('id', sessionId);

        // Construir URL según si es primera página o no
        const params = new URLSearchParams({
            engine: 'google_maps_reviews',
            data_id: dataId,
            api_key: serpApiKey,
            hl: 'es'
        });

        // Solo agregar next_page_token si existe (páginas 2+)
        if (nextPageToken) {
            params.append('next_page_token', nextPageToken);
        }

        const currentPageUrl = `${SERPAPI_BASE_URL}?${params.toString()}`;

        // Timeout de 15 segundos para cada página de reseñas
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        let response;
        try {
            response = await fetch(currentPageUrl, { signal: controller.signal });
            clearTimeout(timeoutId);
        } catch (fetchError: any) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError') {
                console.warn(`  ⚠️ Timeout en página ${pageCount} de reseñas - terminando extracción`);
                break;
            }
            console.warn(`  ⚠️ Error de red en página ${pageCount}: ${fetchError.message}`);
            break;
        }

        if (!response.ok) {
            console.warn(`  ⚠️ Error fetching reviews page ${pageCount}: ${response.status}`);

            // Si es error 401, es problema de autenticación
            if (response.status === 401) {
                console.error(`  ❌ Error 401: Verifica SERPAPI_KEY en Supabase Secrets`);
                throw new Error(`SerpAPI 401 Unauthorized`);
            }

            // Para otros errores (400, 500, etc), solo rompe el loop pero NO lanza error
            console.warn(`  → Terminando extracción de reseñas por error ${response.status}`);
            break;
        }

        const data = await response.json();

        // GUARDAR RESEÑAS INMEDIATAMENTE (página por página)
        if (data.reviews && data.reviews.length > 0) {
            console.log(`  → Guardando ${data.reviews.length} reseñas de página ${pageCount}...`);

            // Calcular cuántas reseñas podemos tomar de esta página sin exceder el límite
            const reviewsToTake = data.reviews.slice(0, reviewLimit - totalReviewsSaved);

            if (reviewsToTake.length === 0) {
                console.log(`  → Ya alcanzamos el límite, omitiendo reseñas de esta página.`);
                break;
            }

            const reviewsToInsert = reviewsToTake.map((review: any) => ({
                rating: Math.round(review.rating || 5),
                title: (review.snippet || 'Sin título').substring(0, 50) + (review.snippet?.length > 50 ? '...' : ''),
                review_text: review.snippet || 'Sin comentario',
                created_at: review.iso_date || new Date().toISOString(),
                user_id: userId,
                business_id: businessId,
                category: category,
                source: 'google',
                source_id: `google-${review.review_id || review.user?.name + '-' + review.iso_date}`,
                original_author_name: review.user?.name || 'Usuario de Google',
                is_verified_purchase: false,
                original_response_text: review.response?.snippet || null,
                original_response_date: review.response?.iso_date || null,
                status: 'approved',
                published_at: review.iso_date || new Date().toISOString()
            }));

            const { error: reviewsError } = await supabaseClient
                .from('reviews')
                .insert(reviewsToInsert);

            if (reviewsError) {
                console.error(`  ❌ ERROR insertando reseñas página ${pageCount}:`);
                console.error(`     Mensaje: ${reviewsError.message}`);
                // NO romper - continuar con siguiente página
            } else {
                totalReviewsSaved += reviewsToInsert.length;
                console.log(`  ✅ ${reviewsToInsert.length} reseñas guardadas. Total acumulado: ${totalReviewsSaved}/${reviewLimit}`);
            }
        }

        // Verificar si hay más páginas
        nextPageToken = data.serpapi_pagination?.next_page_token;

        // Si no hay más reseñas o no hay token de siguiente página, terminar
        if (!nextPageToken || !data.reviews || data.reviews.length === 0) {
            if (totalReviewsSaved < reviewLimit) {
                console.log(`  ℹ️ Esta empresa tiene menos reseñas (${totalReviewsSaved}) que el límite estimado (${reviewLimit}). Aceptando todas las disponibles.`);
            }
            console.log(`  → Fin de reseñas. Total guardado: ${totalReviewsSaved}`);
            break;
        }

        // Rate limiting entre páginas
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Mensaje final con contexto
    if (totalReviewsSaved >= reviewLimit) {
        console.log(`  ✅ Límite alcanzado: ${totalReviewsSaved}/${reviewLimit} reseñas guardadas`);
    } else {
        console.log(`  ✅ Todas las reseñas disponibles guardadas: ${totalReviewsSaved} (límite era ${reviewLimit})`);
    }
    return totalReviewsSaved;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY');
        const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

        console.log(`🔑 SERPAPI_KEY detectada: ${SERPAPI_KEY ? `Sí (${SERPAPI_KEY.substring(0, 8)}...${SERPAPI_KEY.substring(SERPAPI_KEY.length - 4)})` : 'NO - ¡ERROR!'}`);
        console.log(`🔑 GEMINI_API_KEY detectada: ${GEMINI_API_KEY ? 'Sí' : 'NO'}`);

        if (!SERPAPI_KEY) {
            throw new Error('SERPAPI_KEY no está configurada.');
        }
        if (!GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY no está configurada.');
        }

        // Create Supabase client
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        // Verificar que el usuario es admin
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        if (userError || !user) throw new Error('No autorizado');

        const { data: profile } = await supabaseClient.from('profiles').select('role').eq('id', user.id).single();
        if (profile?.role !== 'admin') throw new Error('Solo administradores pueden ejecutar esta función');

        const { searchUrls, country, maxBusinesses = 5, targetReviews = 900 } = await req.json();

        if (!Array.isArray(searchUrls) || searchUrls.length === 0) {
            throw new Error('Se requiere al menos una URL de búsqueda.');
        }
        if (!country) {
            throw new Error('Se requiere el país.');
        }

        console.log(`Iniciando scraping completo para ${searchUrls.length} URLs en país ${country}`);
        console.log(`🎯 Meta de reseñas: ~${targetReviews} reseñas totales (extraerá empresas hasta alcanzar esta meta)`);

        // CREAR SESIÓN DE SCRAPING para tracking en tiempo real
        const { data: session, error: sessionError } = await supabaseClient
            .from('scraping_sessions')
            .insert({
                user_id: user.id,
                status: 'running',
                search_urls: searchUrls,
                country: country,
                max_businesses: maxBusinesses,
                total_businesses_found: 0,
                total_businesses_created: 0,
                total_businesses_skipped: 0,
                total_reviews_imported: 0,
                current_business_index: 0,
                errors: []
            })
            .select()
            .single();

        if (sessionError || !session) {
            console.error('Error creando sesión de scraping:', sessionError);
            throw new Error('No se pudo crear la sesión de tracking');
        }

        console.log(`✅ Sesión de scraping creada: ${session.id}`);

        const results = {
            session_id: session.id,
            total_businesses_found: 0,
            total_businesses_created: 0,
            total_businesses_skipped: 0,
            total_reviews_imported: 0,
            businesses: [] as any[],
            errors: [] as string[]
        };

        // FASE 1: Extraer todas las empresas de las búsquedas
        let allBusinessesData: any[] = [];

        for (const searchUrl of searchUrls) {
            if (!searchUrl || !searchUrl.includes('google.com/maps')) {
                console.warn(`URL inválida omitida: ${searchUrl}`);
                continue;
            }

            let searchQuery = '';
            let ll = '';

            // Normalizar URL: agregar https:// si no tiene protocolo
            let normalizedUrl = searchUrl;
            if (!searchUrl.startsWith('http://') && !searchUrl.startsWith('https://')) {
                normalizedUrl = 'https://' + searchUrl;
                console.log(`   ⚠️ URL sin protocolo detectada, agregando https://`);
            }

            try {
                const urlObj = new URL(normalizedUrl);

                console.log(`📝 Parseando URL: ${searchUrl}`);
                console.log(`   pathname: ${urlObj.pathname}`);
                console.log(`   search: ${urlObj.search}`);
                console.log(`   hash: ${urlObj.hash}`);

                // Intentar extraer query del pathname (formato: /maps/search/query/)
                if (urlObj.pathname.includes('/maps/search/')) {
                    const pathParts = urlObj.pathname.split('/search/');
                    if (pathParts.length > 1) {
                        const rawQuery = pathParts[1].split('/')[0];
                        searchQuery = decodeURIComponent(rawQuery.replace(/\+/g, ' '));
                        console.log(`   ✓ Query del pathname: "${searchQuery}"`);
                    }
                }

                // Si no se encontró en el pathname, buscar en el hash (algunas URLs de Google Maps usan #)
                if (!searchQuery && urlObj.hash && urlObj.hash.includes('q=')) {
                    const hashMatch = urlObj.hash.match(/q=([^&]+)/);
                    if (hashMatch) {
                        searchQuery = decodeURIComponent(hashMatch[1].replace(/\+/g, ' '));
                        console.log(`   ✓ Query del hash: "${searchQuery}"`);
                    }
                }

                // Extraer coordenadas si existen (formato: @lat,lng,zoomz o @lat,lng,zoomz/data=...)
                // SerpAPI espera formato: @lat,lng,zoomz (ej: @48.8648563,2.2902338,13z)
                const coordsMatch = searchUrl.match(/@([\d.-]+),([\d.-]+),([\d.]+)z/);
                if (coordsMatch) {
                    ll = `@${coordsMatch[1]},${coordsMatch[2]},${coordsMatch[3]}z`;
                    console.log(`   ✓ Coordenadas: ${ll}`);
                }
            } catch (e) {
                console.warn(`Error parseando URL: ${searchUrl}`, e);
            }

            if (!searchQuery) {
                console.warn(`❌ No se pudo extraer consulta de búsqueda de la URL: ${searchUrl}`);
                console.warn(`   Formato esperado: https://www.google.com/maps/search/tu+busqueda/@lat,lng,zoom`);
                results.errors.push(`URL inválida: ${searchUrl} - No se pudo extraer la consulta de búsqueda`);
                continue;
            }

            // CONTAR cuántas empresas ya existen con esta source_search_url para calcular el offset
            const { count: existingCount } = await supabaseClient
                .from('businesses')
                .select('id', { count: 'exact', head: true })
                .eq('source_search_url', searchUrl);

            const offsetStart = existingCount || 0;
            console.log(`📊 Empresas ya extraídas de esta URL: ${offsetStart}`);
            console.log(`   Usando offset: ${offsetStart} para obtener empresas nuevas`);

            // Buscar empresas con SerpAPI usando OFFSET dinámico según lo ya extraído
            const searchParams = new URLSearchParams({
                engine: 'google_maps',
                q: searchQuery,
                api_key: SERPAPI_KEY,
                hl: 'es',
                num: '20', // Pedir 20 para tener más opciones y omitir duplicados
                start: offsetStart.toString(), // ✅ OFFSET DINÁMICO para obtener empresas nuevas
                type: 'search'
            });

            if (ll) searchParams.append('ll', ll);

            let currentPageUrl: string | undefined = `${SERPAPI_BASE_URL}?${searchParams}`;
            let pageCount = 0;
            const MAX_PAGES = 5; // Hasta 5 páginas = hasta 100 empresas

            console.log(`🔍 Query extraída: "${searchQuery}"`);
            console.log(`📍 Coordenadas: ${ll || 'No especificadas'}`);
            console.log(`📊 Buscando empresas hasta alcanzar ~${targetReviews} reseñas totales (hasta ${MAX_PAGES} páginas)`);

            // Extraer hasta 100 empresas de múltiples páginas
            while (currentPageUrl && pageCount < MAX_PAGES && allBusinessesData.length < 100) {
                pageCount++;
                console.log(`Buscando empresas - página ${pageCount} para: ${searchQuery}`);

                const response = await fetch(currentPageUrl);
                if (!response.ok) {
                    const errorBody = await response.text();
                    console.error(`❌ Error en búsqueda página ${pageCount}: ${response.statusText}`);
                    console.error(`   Status: ${response.status}`);
                    console.error(`   Response: ${errorBody}`);
                    console.error(`   URL intentada: ${currentPageUrl.replace(SERPAPI_KEY, 'API_KEY_HIDDEN')}`);
                    results.errors.push(`Error SerpAPI: ${response.status} - ${response.statusText}`);
                    break;
                }

                const searchData = await response.json();

                // Log detallado de la respuesta de SerpAPI para debugging
                console.log(`📦 Respuesta SerpAPI:`, JSON.stringify(searchData).substring(0, 500));
                console.log(`   search_metadata:`, searchData.search_metadata ? 'presente' : 'ausente');
                console.log(`   search_parameters:`, searchData.search_parameters ? JSON.stringify(searchData.search_parameters) : 'ausente');
                console.log(`   local_results:`, searchData.local_results ? `${searchData.local_results.length} encontrados` : 'ausente o vacío');

                if (searchData.local_results && searchData.local_results.length > 0) {
                    for (const item of searchData.local_results) {
                        if (!item.data_id || !item.place_id) continue;

                        allBusinessesData.push({
                            source_url: searchUrl,
                            google_place_id: item.place_id,
                            data_id: item.data_id,
                            business_name: item.title,
                            google_maps_url: item.link || `https://www.google.com/maps/place/?q=place_id:${item.place_id}`,
                            logo_url: item.thumbnail,
                            address: item.address,
                            rating: item.rating,
                            type: item.type
                        });

                        // Remover límite aquí - dejar que llegue a 100
                    }
                } else {
                    console.warn(`⚠️ No se encontraron resultados en local_results`);
                    console.warn(`   Verificar si hay error en SerpAPI:`, searchData.error || 'No hay error reportado');
                    console.warn(`   search_information:`, searchData.search_information ? JSON.stringify(searchData.search_information) : 'ausente');
                }

                currentPageUrl = searchData.serpapi_pagination?.next;
                if (currentPageUrl) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
        }

        console.log(`Total de empresas encontradas (sin filtrar): ${allBusinessesData.length}`);

        // VERIFICAR DUPLICADOS ANTES DE PROCESAR
        const urls = allBusinessesData.map(b => b.google_maps_url).filter(Boolean);

        const { data: existingBusinesses } = await supabaseClient
            .from('businesses')
            .select('google_maps_url, name')
            .in('google_maps_url', urls);

        const existingUrls = new Set(existingBusinesses?.map((b: any) => b.google_maps_url).filter(Boolean) || []);

        // FILTRAR DUPLICADOS
        const nonDuplicateBusinesses = allBusinessesData.filter(b => !existingUrls.has(b.google_maps_url));

        // PROCESAR TODAS LAS EMPRESAS DISPONIBLES - el loop se detendrá al alcanzar la meta
        console.log(`📊 Filtrado de empresas:`);
        console.log(`   Empresas encontradas: ${allBusinessesData.length}`);
        console.log(`   Empresas duplicadas: ${allBusinessesData.length - nonDuplicateBusinesses.length}`);
        console.log(`   Empresas nuevas disponibles: ${nonDuplicateBusinesses.length}`);
        console.log(`   Meta de reseñas: ~${targetReviews}`);
        console.log(`   ⚠️ Se procesarán empresas hasta alcanzar ${targetReviews} reseñas (no hay límite de empresas)`);

        // USAR TODAS las empresas disponibles - el loop decidirá cuándo parar
        allBusinessesData = nonDuplicateBusinesses;

        results.total_businesses_found = allBusinessesData.length;
        console.log(`Total de empresas A PROCESAR: ${allBusinessesData.length}`);

        // Actualizar sesión con total encontrado
        await supabaseClient
            .from('scraping_sessions')
            .update({ total_businesses_found: allBusinessesData.length })
            .eq('id', session.id);

        // FASE 2: Procesar cada empresa (YA FILTRADAS - NO hay duplicados)
        // PARAR cuando se alcance la meta de reseñas
        for (let i = 0; i < allBusinessesData.length; i++) {
            const businessData = allBusinessesData[i];

            // VERIFICAR SI YA ALCANZAMOS LA META DE RESEÑAS
            if (results.total_reviews_imported >= targetReviews) {
                console.log(`🎯 META ALCANZADA: ${results.total_reviews_imported}/${targetReviews} reseñas`);
                console.log(`   Deteniendo extracción. Empresas procesadas: ${i}/${allBusinessesData.length}`);
                break;
            }

            try {
                console.log(`[${i + 1}/${allBusinessesData.length}] Procesando: ${businessData.business_name} (${results.total_reviews_imported}/${targetReviews} reseñas acumuladas)`);

                // Actualizar progreso en DB (empresa en proceso)
                await supabaseClient
                    .from('scraping_sessions')
                    .update({
                        current_business_index: i + 1,
                        current_business_name: businessData.business_name
                    })
                    .eq('id', session.id);

                // PASO 1: Obtener detalles completos del negocio (NO CRÍTICO - continuar sin detalles si falla)
                console.log(`  → Obteniendo detalles completos...`);
                let businessDetails = null;
                try {
                    businessDetails = await getBusinessDetails(businessData.data_id, SERPAPI_KEY);
                    if (businessDetails) {
                        console.log(`  ✓ Detalles obtenidos`);
                    } else {
                        console.warn(`  ⚠️ No se obtuvieron detalles - continuando con datos básicos`);
                    }
                } catch (detailsError: any) {
                    console.warn(`  ⚠️ Error obteniendo detalles: ${detailsError.message} - continuando sin detalles`);
                }

                // PASO 2: Usar categoría por defecto (SIN GEMINI para ahorrar costos y tiempo)
                // La categoría se asignará manualmente después en la sección de categorización masiva
                const category = 'emerging_and_other: virtual_augmented_reality';
                console.log(`  → Categoría por defecto: ${category} (se puede cambiar después)`);

                // PASO 3: Preparar datos completos del negocio
                const description = businessDetails?.description || businessDetails?.editorial_summary || businessData.address || 'Sin descripción';
                const phone = businessDetails?.phone || null;
                const website = businessDetails?.website || null;
                const latitude = businessDetails?.gps_coordinates?.latitude || null;
                const longitude = businessDetails?.gps_coordinates?.longitude || null;

                // Procesar horarios si existen
                let horarios = null;
                if (businessDetails?.hours) {
                    horarios = {
                        lunes: businessDetails.hours['Lunes'] || 'cerrado',
                        martes: businessDetails.hours['Martes'] || 'cerrado',
                        miercoles: businessDetails.hours['Miércoles'] || 'cerrado',
                        jueves: businessDetails.hours['Jueves'] || 'cerrado',
                        viernes: businessDetails.hours['Viernes'] || 'cerrado',
                        sabado: businessDetails.hours['Sábado'] || 'cerrado',
                        domingo: businessDetails.hours['Domingo'] || 'cerrado'
                    };
                }

                console.log(`  → Datos: descripción=${description.length} chars, teléfono=${phone ? 'sí' : 'no'}, web=${website ? 'sí' : 'no'}, coords=${latitude && longitude ? 'sí' : 'no'}, horarios=${horarios ? 'sí' : 'no'}`);

                // PASO 5: GUARDAR INMEDIATAMENTE EN DB (CRÍTICO)
                console.log(`  → Guardando empresa en DB...`);

                // Log detallado de datos antes de insertar
                const businessToInsert = {
                    name: businessData.business_name,
                    description: description,
                    category: category,
                    logo_url: businessData.logo_url || null,
                    google_maps_url: businessData.google_maps_url,
                    country: country,
                    source_search_url: businessData.source_url,
                    contact_phone: phone,
                    website_url: website,
                    latitude: latitude,
                    longitude: longitude,
                    horarios: horarios,
                    owner_id: null
                };

                console.log(`  → Insertando:`, JSON.stringify(businessToInsert).substring(0, 200));

                const { data: newBusiness, error: businessError} = await supabaseClient
                    .from('businesses')
                    .insert(businessToInsert)
                    .select()
                    .single();

                if (businessError) {
                    console.error(`❌ ERROR CRÍTICO guardando ${businessData.business_name}:`);
                    console.error(`   Código: ${businessError.code}`);
                    console.error(`   Mensaje: ${businessError.message}`);
                    console.error(`   Detalles:`, businessError.details);
                    console.error(`   Hint:`, businessError.hint);
                    results.errors.push(`${businessData.business_name}: ${businessError.message}`);
                    continue;
                }

                if (!newBusiness) {
                    console.error(`❌ ERROR: No se devolvió el negocio creado para ${businessData.business_name}`);
                    results.errors.push(`${businessData.business_name}: No se devolvió el negocio creado`);
                    continue;
                }

                console.log(`  ✅ Empresa guardada con ID: ${newBusiness.id}`);

                // PASO 4: EXTRAER Y GUARDAR RESEÑAS PÁGINA POR PÁGINA (después de guardar la empresa)
                console.log(`  → Extrayendo y guardando reseñas página por página...`);
                let totalReviewsSaved = 0;
                try {
                    totalReviewsSaved = await scrapeBusinessReviews(
                        businessData.data_id,
                        SERPAPI_KEY,
                        session.id,
                        supabaseClient,
                        newBusiness.id,
                        user.id,
                        category
                    );
                    console.log(`  ✅ Total reseñas guardadas: ${totalReviewsSaved}`);
                } catch (reviewError: any) {
                    console.warn(`  ⚠️ Error extrayendo reseñas: ${reviewError.message}`);
                    console.log(`  → Continuando sin más reseñas...`);
                }

                // Limpiar progreso de reseñas después de terminar
                await supabaseClient
                    .from('scraping_sessions')
                    .update({
                        current_review_page: 0,
                        current_reviews_scraped: 0
                    })
                    .eq('id', session.id);

                results.total_businesses_created++;
                results.total_reviews_imported += totalReviewsSaved;
                results.businesses.push({
                    name: businessData.business_name,
                    id: newBusiness.id,
                    reviews_count: totalReviewsSaved,
                    category: category
                });

                // Actualizar progreso en DB (empresa guardada exitosamente)
                await supabaseClient
                    .from('scraping_sessions')
                    .update({
                        total_businesses_created: results.total_businesses_created,
                        total_reviews_imported: results.total_reviews_imported
                    })
                    .eq('id', session.id);

            } catch (error: any) {
                console.error(`❌ ERROR GENERAL procesando ${businessData.business_name}:`, error);
                console.error(`   Stack:`, error.stack);
                results.errors.push(`${businessData.business_name}: ${error.message}`);

                // Actualizar errores en DB
                await supabaseClient
                    .from('scraping_sessions')
                    .update({
                        errors: results.errors
                    })
                    .eq('id', session.id);

                // NO hacer continue aquí - dejar que siga con la siguiente empresa
            }

            // Pequeña pausa entre empresas (reducida a 300ms para ser más rápido)
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        console.log('Scraping completo:', results);
        console.log(`📊 RESUMEN FINAL:`);
        console.log(`   Total empresas encontradas: ${results.total_businesses_found}`);
        console.log(`   Total empresas creadas: ${results.total_businesses_created}`);
        console.log(`   Total empresas omitidas: ${results.total_businesses_skipped}`);
        console.log(`   Total reseñas importadas: ${results.total_reviews_imported}`);
        console.log(`   Errores: ${results.errors.length}`);

        // Marcar sesión como completada
        await supabaseClient
            .from('scraping_sessions')
            .update({
                status: 'completed',
                completed_at: new Date().toISOString()
            })
            .eq('id', session.id);

        // Reducir tamaño de respuesta - solo enviar resumen + session_id
        const summaryResults = {
            session_id: session.id,
            total_businesses_found: results.total_businesses_found,
            total_businesses_created: results.total_businesses_created,
            total_businesses_skipped: results.total_businesses_skipped,
            total_reviews_imported: results.total_reviews_imported,
            businesses: results.businesses.map(b => ({
                name: b.name,
                id: b.id,
                reviews_count: b.reviews_count
            })),
            errors: results.errors.slice(0, 10) // Solo primeros 10 errores para no saturar
        };

        return new Response(JSON.stringify(summaryResults), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        console.error('Error en instant-full-scrape:', error.message);

        // Intentar marcar la sesión como fallida (si existe)
        try {
            const supabaseClient = createClient(
                Deno.env.get('SUPABASE_URL') ?? '',
                Deno.env.get('SUPABASE_ANON_KEY') ?? '',
                { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
            );

            // Buscar sesión activa del usuario
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (user) {
                await supabaseClient
                    .from('scraping_sessions')
                    .update({
                        status: 'failed',
                        errors: [error.message],
                        completed_at: new Date().toISOString()
                    })
                    .eq('user_id', user.id)
                    .eq('status', 'running')
                    .order('created_at', { ascending: false })
                    .limit(1);
            }
        } catch (updateError) {
            console.error('No se pudo actualizar la sesión a failed:', updateError);
        }

        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
})
