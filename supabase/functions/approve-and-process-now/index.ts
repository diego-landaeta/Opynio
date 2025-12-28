// supabase/functions/approve-and-process-now/index.ts

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenAI, Type } from 'https://esm.sh/@google/genai@^1.13.0';

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
const MAX_REVIEW_PAGES = 50; // Limit to 50 pages (approx 1000 reviews)

const CATEGORIES: { [key: string]: string[] } = {
    'Restauración y Ocio': [
        'Restaurantes',
        'Bares y Cafeterías',
        'Comida Rápida',
        'Vida Nocturna y Discotecas',
        'Cines, Teatros y Espectáculos',
        'Parques Temáticos y de Atracciones',
    ],
    'Salud y Bienestar': [
        'Clínicas y Hospitales',
        'Clínicas Dentales',
        'Farmacias y Ópticas',
        'Fisioterapia y Rehabilitación',
        'Psicología y Terapia',
        'Gimnasios y Centros Deportivos',
        'Peluquerías y Salones de Belleza',
        'Spas y Centros de Bienestar',
    ],
    'Compras y Retail': [
        'Supermercados y Tiendas de Alimentación',
        'Tiendas de Ropa y Moda',
        'Tiendas de Electrónica y Tecnología',
        'Tiendas de Muebles y Decoración',
        'Grandes Almacenes',
        'Joyerías y Relojerías',
        'Librerías y Papelerías',
        'Jugueterías y Tiendas Infantiles',
    ],
    'Servicios para el Hogar': [
        'Reformas y Construcción',
        'Limpieza y Mantenimiento',
        'Fontanería, Electricidad y Cerrajería',
        'Jardinería y Paisajismo',
        'Mudanzas y Almacenamiento',
        'Seguridad del Hogar',
    ],
    'Servicios Profesionales y de Empresa': [
        'Asesoría Fiscal y Contable',
        'Servicios Legales y Abogados',
        'Agencias de Marketing y Publicidad',
        'Desarrollo de Software y Servicios TI',
        'Consultoría de Negocios',
        'Recursos Humanos y Contratación',
    ],
    'Automoción': [
        'Concesionarios de Vehículos',
        'Talleres Mecánicos y Reparación',
        'Alquiler de Vehículos',
        'Estaciones de Servicio y Lavado de Coches',
        'Tiendas de Repuestos y Accesorios',
    ],
    'Educación y Formación': [
        'Universidades y Educación Superior',
        'Colegios y Escuelas',
        'Formación Profesional y Cursos Online',
        'Academias de Idiomas',
        'Autoescuelas',
        'Clases Particulares y Tutorías',
    ],
    'Finanzas y Legal': [
        'Bancos y Entidades Financieras',
        'Compañías de Seguros',
        'Servicios de Inversión',
        'Inmobiliarias',
    ],
    'Viajes y Transporte': [
        'Hoteles y Alojamientos',
        'Agencias de Viajes y Touroperadores',
        'Aerolíneas y Transporte',
        'Atracciones Turísticas y Museos',
    ],
    'Mascotas': [
        'Clínicas Veterinarias',
        'Tiendas para Mascotas',
        'Peluquerías y Cuidadores de Mascotas',
        'Adiestramiento Canino',
    ],
    'Eventos': [
        'Organización de Bodas y Eventos',
        'Salones y Espaços para Eventos',
        'Serviços de Catering',
        'Aluguel de Equipamentos para Eventos',
    ],
    'Sectores Emergentes y Otros': [
        'Energías Renovables',
        'Coworking y Oficinas Flexibles',
        'Servicios de Drones',
        'Realidad Virtual y Aumentada',
    ],
};

// Función helper para crear respuestas de error consistentes
function createErrorResponse(message: string, statusCode: number = 500, details?: any) {
    console.error(`Error (${statusCode}):`, message, details);
    return new Response(
        JSON.stringify({ 
            error: message, 
            details: details?.message || details,
            timestamp: new Date().toISOString()
        }), 
        { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
            status: statusCode 
        }
    );
}

async function processItem(item: any, supabase: SupabaseClient, adminId: string, SERPAPI_KEY: string, ai: GoogleGenAI) {
    console.log(`🔄 Procesando item ${item.id}: ${item.business_name || 'Sin nombre'}`);
    
    try {
        // Actualizar estado a procesando
        await supabase.from('scraping_queue').update({ status: 'processing', processed_at: new Date().toISOString() }).eq('id', item.id);

        // Verificar si el negocio ya existe
        const { data: existingBusiness } = await supabase.from('businesses').select('id').eq('google_maps_url', item.google_maps_url).maybeSingle();
        
        if (existingBusiness) {
            console.log(`⚠️ Negocio ya existe: ${item.id}`);
            await supabase.from('scraping_queue').update({ status: 'completed', error_message: 'El negocio ya existía.' }).eq('id', item.id);
            return { status: 'fulfilled', message: 'Negocio ya existía' };
        }

        // Hacer scraping con SerpAPI con paginación
        let allReviews: any[] = [];
        let place_info: any = null;
        let nextPageToken: string | undefined = undefined;
        let page = 0;

        do {
            page++;
            const params = new URLSearchParams({ engine: 'google_maps_reviews', data_id: item.data_id, api_key: SERPAPI_KEY, hl: 'es', num: '20' });
            if (nextPageToken) {
                params.set('next_page_token', nextPageToken);
            }
            
            const response = await fetch(`${SERPAPI_BASE_URL}?${params}`);
            if (!response.ok) throw new Error(`SerpApi request failed on page ${page}: ${response.status} ${response.statusText}`);
            
            const data = await response.json();
            if (data.error) throw new Error(`SerpApi error on page ${page}: ${data.error}`);

            if (page === 1) {
                place_info = data.place_info;
                if (!place_info) throw new Error('No se encontró información del negocio en SerpAPI.');
            }

            if (data.reviews && data.reviews.length > 0) {
                allReviews.push(...data.reviews);
            }
            
            nextPageToken = data.serpapi_pagination?.next_page_token;
            
        } while (nextPageToken && page < MAX_REVIEW_PAGES);

        
        // Determinar categoría
        let businessCategory = item.category;
        if (!businessCategory) {
            businessCategory = place_info.type; // Fallback
            const categoryList = Object.entries(CATEGORIES).flatMap(([main, subs]) => subs.map(sub => `${main}: ${sub}`));
            const prompt = `Dada la siguiente información, selecciona la categoría MÁS apropiada de la lista.\n\nInformación:\n- Nombre: ${place_info.title}\n- Tipo: ${place_info.type || 'N/A'}\n- Dirección: ${place_info.address || 'N/A'}\n- Reseñas: ${(allReviews || []).slice(0, 3).map((r: any) => `- ${r.snippet}`).join('\n')}\n\nLista de Categorías:\n${categoryList.join('\n')}\n\nResponde únicamente con la cadena de texto exacta de la categoría.`;
            const categorySchema = { type: Type.OBJECT, properties: { category: { type: Type.STRING, description: "La categoría más apropiada.", enum: categoryList } }, required: ["category"] };
            try {
                const aiResponse = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt, config: { responseMimeType: "application/json", responseSchema: categorySchema }});
                const parsed = JSON.parse(aiResponse.text);
                if (parsed.category) businessCategory = parsed.category;
            } catch(aiError) {
                console.error(`❌ AI categorization failed for ${place_info.title}:`, aiError);
            }
        }

        // Insertar negocio
        const { data: newBusiness, error: businessError } = await supabase.from('businesses').insert({ name: place_info.title, description: place_info.address, category: businessCategory, logo_url: item.logo_url || place_info.thumbnail, google_maps_url: item.google_maps_url, owner_id: null, country: item.country }).select().single();
        if (businessError) throw new Error(`Error al insertar negocio: ${businessError.message}`);
        
        // Insertar reseñas (con validación mejorada)
        if (allReviews && allReviews.length > 0) {
            const reviewsToInsert = allReviews.map((review: any) => {
                const rating = review.rating ? Math.round(Number(review.rating)) : 0;
                if (!review.review_id || rating < 1 || rating > 5) {
                    console.warn(`Skipping invalid review for item ${item.id}:`, review);
                    return null;
                }
                return {
                    rating,
                    title: review.snippet ? `${review.snippet.substring(0, 50)}...` : `Reseña de ${rating} estrellas`,
                    review_text: review.snippet || null,
                    created_at: review.iso_date || new Date().toISOString(),
                    user_id: adminId,
                    business_id: newBusiness.id,
                    category: businessCategory,
                    source: 'google',
                    source_id: `google-${review.review_id}`,
                    original_author_name: review.user?.name || 'Usuario de Google',
                    is_verified_purchase: false,
                    original_response_text: review.response?.snippet || null,
                    original_response_date: review.response?.iso_date || null,
                };
            }).filter((r): r is NonNullable<typeof r> => r !== null);
            
            if (reviewsToInsert.length > 0) {
                const { error: reviewsError } = await supabase.from('reviews').insert(reviewsToInsert);
                if (reviewsError) console.error(`⚠️ Error inserting reviews for ${newBusiness.name}:`, reviewsError.message);
            }
        }

        // Marcar como completado
        await supabase.from('scraping_queue').update({ status: 'completed' }).eq('id', item.id);
        return { status: 'fulfilled', businessId: newBusiness.id };
        
    } catch (error) {
        console.error(`❌ Failed to process item ${item.id}:`, error);
        await supabase.from('scraping_queue').update({ status: 'failed', error_message: error.message }).eq('id', item.id);
        return { status: 'rejected', reason: error.message };
    }
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY');
        if (!SERPAPI_KEY) return createErrorResponse('La clave de API del servidor (SERPAPI_KEY) no está configurada.', 500);
        
        const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
        if (!GEMINI_API_KEY) return createErrorResponse('La clave de API de Gemini (GEMINI_API_KEY) no está configurada.', 500);
        
        const supabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization')! } } });
        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
        if (authError || !user) return createErrorResponse('No autorizado.', 401);
        
        const { data: profile } = await supabaseClient.from('profiles').select('role').eq('id', user.id).single();
        if (profile?.role !== 'admin') return createErrorResponse('Acción solo para administradores.', 403);

        const { ids } = await req.json();
        if (!Array.isArray(ids) || ids.length === 0) return createErrorResponse('Se requiere un array de IDs no vacío.', 400);
        
        const { data: items, error: fetchError } = await supabaseClient.from('scraping_queue').select('*').in('id', ids).eq('status', 'pending');
        if (fetchError) return createErrorResponse(`Error al obtener items: ${fetchError.message}`, 500);
        
        if (items.length === 0) {
            return new Response(JSON.stringify({ processed: 0, failed: 0, message: "No se encontraron items pendientes con los IDs proporcionados." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        }
        
        await supabaseClient.from('scraping_queue').update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: user.id }).in('id', items.map(i => i.id));

        // Procesar items secuencialmente para evitar timeouts
        let processed = 0;
        let failed = 0;
        for (const item of items) {
            const result = await processItem(item, supabaseClient, user.id, SERPAPI_KEY, ai);
            if (result.status === 'fulfilled') processed++;
            else failed++;
        }
        
        console.log(`📈 Resultados: ${processed} procesados, ${failed} fallidos`);

        return new Response(JSON.stringify({ processed, failed, total: items.length, success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

    } catch (error) {
        return createErrorResponse('Error interno del servidor', 500, error);
    }
})