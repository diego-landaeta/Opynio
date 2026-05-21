// supabase/functions/serpapi-proxy/index.ts

// FIX: Add Deno type declarations for the Supabase Edge Function environment.
// This resolves the "Property 'env' does not exist on type 'typeof Deno'" error.
declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
};

// Se actualiza a una versión más reciente y estable de la librería estándar de Deno.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

// Cabeceras CORS para permitir que tu aplicación frontend llame a esta función.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Para producción, es mejor restringirlo a tu dominio: 'https://app.opynio.com'
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SERPAPI_BASE_URL = 'https://serpapi.com/search.json';

serve(async (req) => {
  // Manejo de la solicitud preflight de CORS, necesaria para los navegadores.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. OBTENCIÓN SEGURA DE LA CLAVE API
    // Se obtiene la clave de los "Secrets" de la función en Supabase.
    // Esta es la causa más común del error si el Secret no está configurado.
    const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY');
    if (!SERPAPI_KEY) {
      console.error('ERROR CRÍTICO: La SERPAPI_KEY no está definida en los Secrets de la Edge Function.');
      // Lanza un error claro que ayuda a diagnosticar el problema.
      throw new Error('La clave de API del servidor no está configurada. Contacta al administrador.');
    }

    // 2. PROCESAMIENTO DE LA SOLICITUD
    // Acepta data_id (0x...:0x...) o place_id (ChIJ...). Si solo viene place_id,
    // se resuelve a data_id via engine=google_maps (consulta extra).
    const { data_id: bodyDataId, place_id, next_page_token } = await req.json();
    if (!bodyDataId && !place_id) {
      throw new Error('Se requiere "data_id" o "place_id" del negocio.');
    }

    let data_id = bodyDataId;
    if (!data_id && place_id) {
      const lookupParams = new URLSearchParams({
        engine: 'google_maps',
        place_id: place_id,
        api_key: SERPAPI_KEY,
        hl: 'es'
      });
      const lookupRes = await fetch(`${SERPAPI_BASE_URL}?${lookupParams}`);
      const lookupData = await lookupRes.json();
      data_id = lookupData?.place_results?.data_id;
      if (!data_id) {
        throw new Error('No se pudo resolver data_id desde place_id: ' + (lookupData?.error || 'sin data_id en respuesta'));
      }
    }

    // 3. CONSTRUCCIÓN Y LLAMADA A LA API EXTERNA (SERPAPI)
    // Nota: el parámetro `num` SOLO se acepta si hay next_page_token; en primera
    // página devuelve siempre 8 resultados.
    const params = new URLSearchParams({
      engine: 'google_maps_reviews',
      data_id: data_id,
      api_key: SERPAPI_KEY,
      hl: 'es',
      sort_by: 'newestFirst'
    });

    if (next_page_token) {
      params.append('next_page_token', next_page_token);
      params.append('num', '20'); // 20 resultados por página solo con token
    }

    // Se realiza la llamada a la API de SerpApi.
    const response = await fetch(`${SERPAPI_BASE_URL}?${params}`);

    // 4. MANEJO DE LA RESPUESTA DE SERPAPI
    // Si la respuesta de SerpApi no es exitosa, se lanza un error con detalle.
    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Error en la respuesta de SerpApi:', errorBody);
      throw new Error(`SerpAPI ${response.status} (data_id usado: ${data_id}): ${errorBody.slice(0, 300)}`);
    }

    const responseData = await response.json();
    // Si la API de SerpApi devuelve un error en su JSON, también se maneja.
    if (responseData.error) {
        throw new Error(`Error de SerpApi: ${responseData.error}`);
    }
    
    // 5. ENVÍO DE LA RESPUESTA EXITOSA AL FRONTEND
    // Se devuelve la respuesta de SerpApi al cliente.
    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    // MANEJO CENTRALIZADO DE ERRORES
    // Cualquier error en el proceso anterior será capturado aquí.
    console.error('Error en la Edge Function `serpapi-proxy`:', error.message);
    // Se devuelve una respuesta de error 500 (Internal Server Error) al cliente.
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
