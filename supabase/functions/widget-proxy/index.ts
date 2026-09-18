// supabase/functions/widget-proxy/index.ts

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
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
  'Cache-Control': 'public, max-age=300, stale-while-revalidate=600', // Cache for 5 minutes, serve stale for up to 10 minutes while revalidating
}

// Version de widget.js que deberia estar corriendo. El widget la compara
// con la suya y, si es mas antigua, se recarga. Tiene que coincidir con la
// cabecera de public/widget.js: `npm run check:widget` lo comprueba.
const WIDGET_VERSION = 'v6.10.2';

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // productId (alias subjectId) es OPCIONAL. Sin él, la respuesta es
    // exactamente la de siempre: la empresa entera. Los widgets ya desplegados
    // en webs de clientes nunca lo envían y siguen el mismo camino que antes.
    const body = await req.json()
    const businessId = body.businessId
    const productId = body.productId ?? body.subjectId ?? null
    if (!businessId) {
      return new Response(JSON.stringify({ error: 'businessId is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Use the SERVICE_ROLE_KEY for admin privileges to bypass RLS and public API restrictions
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch business data and reviews in parallel
    const [businessRes, reviewsRes, reviewStatsRes] = await Promise.all([
      supabaseAdmin.from('businesses').select('id, name, slug, country, logo_url').eq('id', businessId).single(),
      supabaseAdmin.from('reviews').select('title, review_text, rating, original_author_name, source, created_at').eq('business_id', businessId).eq('status', 'approved').lte('created_at', new Date().toISOString()).not('title', 'is', null).not('review_text', 'is', null).neq('title', '').neq('review_text', '').order('created_at', { ascending: false }).limit(20),
      // Stats via RPC: counting rows client-side hit PostgREST's 1000-row cap,
      // so any business above that showed exactly 1000 (ISEIE: 1520 -> 1000).
      // The average had the same flaw, silently computed over a 1000-row sample.
      supabaseAdmin.rpc('widget_business_stats', { p_business_id: businessId })
    ]);

    if (businessRes.error) {
        if (businessRes.error.code === 'PGRST116') { // Not found
             return new Response(JSON.stringify({ error: `Empresa con ID ${businessId} no encontrada.` }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 404,
            });
        }
        throw businessRes.error;
    }
    // Don't throw for other errors, just log them if they exist
    if (reviewsRes.error) console.error("Reviews fetch error:", reviewsRes.error);
    if (reviewStatsRes.error) console.error("Review stats fetch error:", reviewStatsRes.error);

    // The RPC returns a single row already aggregated in Postgres.
    const stats = Array.isArray(reviewStatsRes.data) ? reviewStatsRes.data[0] : reviewStatsRes.data;
    const reviewCount = Number(stats?.review_count ?? 0);
    const avgRating = Number(stats?.avg_rating ?? 0);

    const businessData = {
      ...businessRes.data,
      avg_rating: avgRating,
      review_count: reviewCount,
    };

    const reviewsData = reviewsRes.data || [];

    const responseData: Record<string, unknown> = {
      widget_version: WIDGET_VERSION,
      business: businessData,
      reviews: reviewsData,
    };

    // ------------------------------------------------------------------
    // Widget de producto
    // ------------------------------------------------------------------
    // Las cifras de la empresa que van arriba NO se tocan: se calculan igual
    // que siempre y se devuelven igual que siempre. Lo del producto viaja
    // aparte, en `product`, y solo cuenta las reseñas asignadas explícitamente
    // a ese producto. Un producto sin reseñas asignadas devuelve 0; en ningún
    // caso hereda las de su empresa.
    if (productId) {
      const { data: product, error: productError } = await supabaseAdmin
        .from('review_subjects')
        .select('id, business_id, name, slug, description, image_url, is_active')
        .eq('id', productId)
        .maybeSingle();

      if (productError) throw productError;

      // El producto puede haber sido desactivado o borrado por su dueño, o el
      // snippet puede estar mal copiado (producto de otra empresa). En los tres
      // casos el widget YA ESTÁ PEGADO en la web pública de un cliente: devolver
      // un error pintaría una caja roja en su página por una acción normal del
      // panel. Se responde con los datos de la empresa —información válida y del
      // mismo negocio— y el widget se comporta como el de empresa de siempre.
      const productoUtilizable = product && product.is_active && product.business_id === businessId;
      if (!productoUtilizable) {
        console.warn(
          `widget-proxy: producto ${productId} no utilizable para la empresa ${businessId} ` +
          `(existe: ${!!product}, activo: ${product?.is_active}, misma empresa: ${product?.business_id === businessId}). ` +
          `Se devuelve el widget de la empresa.`
        );
        return new Response(JSON.stringify(responseData), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      const [productStatsRes, productReviewsRes] = await Promise.all([
        supabaseAdmin.rpc('widget_subject_stats', { p_subject_id: productId }),
        supabaseAdmin.rpc('widget_subject_reviews', { p_subject_id: productId, p_limit: 20 }),
      ]);

      if (productStatsRes.error) console.error("Product stats fetch error:", productStatsRes.error);
      if (productReviewsRes.error) console.error("Product reviews fetch error:", productReviewsRes.error);

      const pStats = Array.isArray(productStatsRes.data) ? productStatsRes.data[0] : productStatsRes.data;

      responseData.product = {
        id: product.id,
        name: product.name,
        slug: product.slug,
        image_url: product.image_url,
        avg_rating: Number(pStats?.avg_rating ?? 0),
        review_count: Number(pStats?.review_count ?? 0),
      };
      // Las tarjetas que pinta el widget pasan a ser las del producto.
      responseData.reviews = productReviewsRes.data || [];
    }

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in widget-proxy function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})
