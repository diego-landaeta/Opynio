// supabase/functions/monthly-rescrape-job/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeadersFor } from '../_shared/cors.ts'

// Declaraciones de tipos para el entorno de Deno en Edge Functions.
declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
};

// Comparacion en tiempo constante para no filtrar el secreto por timing.
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < Math.max(ab.length, bb.length); i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

// Lo invoca un cron (verify_jwt = false en config.toml), asi que la unica
// barrera es `Authorization: Bearer <CRON_SECRET>`. CORS restringido: ningun
// navegador de terceros debe poder leer su respuesta.
serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // 1. Verificacion de seguridad ANTES de tocar nada. Si el secreto no esta
  //    configurado se falla cerrado (401) en vez de lanzar un 500 que revele config.
  const CRON_SECRET = Deno.env.get('CRON_SECRET');
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!CRON_SECRET) {
    console.error('monthly-rescrape-job: CRON_SECRET no configurado; peticion rechazada.');
    return json({ error: 'No autorizado' }, 401);
  }
  if (!safeEqual(authHeader, `Bearer ${CRON_SECRET}`)) {
    return json({ error: 'No autorizado' }, 401);
  }

  try {
    const INTERNAL_SECRET = Deno.env.get('INTERNAL_SECRET');
    if (!INTERNAL_SECRET) {
      throw new Error('El secreto interno (INTERNAL_SECRET) no está configurado.');
    }

    // 2. Crear un cliente de Supabase con privilegios de administrador (service_role).
    const supabaseAdminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log("Iniciando trabajo de re-sincronización mensual...");

    // 3. Obtener todas las empresas marcadas para la re-sincronización.
    const { data: businesses, error: fetchError } = await supabaseAdminClient
      .from('businesses')
      .select('id')
      .eq('is_selected_for_monthly_scrape', true);

    if (fetchError) {
      throw new Error(`Error al obtener las empresas seleccionadas: ${fetchError.message}`);
    }

    if (!businesses || businesses.length === 0) {
      console.log("No hay empresas seleccionadas para la re-sincronización mensual. Finalizando trabajo.");
      return new Response(JSON.stringify({ success: true, message: "No hay empresas seleccionadas." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }
    
    const businessIds = businesses.map(b => b.id);
    console.log(`Se encontraron ${businessIds.length} empresas para procesar.`);

    // 4. Invocar la función de re-sincronización para todas las empresas seleccionadas.
    const { error: invokeError } = await supabaseAdminClient.functions.invoke('admin-rescrape-google-reviews', {
      body: { businessIds },
      headers: {
        'X-Internal-Secret': INTERNAL_SECRET
      }
    });

    if (invokeError) {
      throw new Error(`Error al invocar la función de re-sincronización: ${invokeError.message}`);
    }
    
    console.log(`Trabajo de re-sincronización completado. Total de empresas procesadas: ${businessIds.length}.`);

    return new Response(JSON.stringify({
      success: true,
      message: `Proceso de re-sincronización completado. ${businessIds.length} empresas procesadas.`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error en la función `monthly-rescrape-job`:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})