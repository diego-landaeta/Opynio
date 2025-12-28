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

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { businessId } = await req.json()
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

    // Fetch business data, metrics, and reviews in parallel
    const [businessRes, metricsRes, reviewsRes] = await Promise.all([
      supabaseAdmin.from('businesses').select('id, name, logo_url').eq('id', businessId).single(),
      supabaseAdmin.from('business_metrics').select('avg_rating, review_count').eq('id', businessId).single(),
      supabaseAdmin.from('reviews').select('title, review_text, rating, original_author_name, source, created_at').eq('business_id', businessId).eq('status', 'approved').not('title', 'is', null).not('review_text', 'is', null).neq('title', '').neq('review_text', '').order('created_at', { ascending: false }).limit(20)
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
    if (metricsRes.error && metricsRes.error.code !== 'PGRST116') console.error("Metrics fetch error:", metricsRes.error);
    if (reviewsRes.error) console.error("Reviews fetch error:", reviewsRes.error);


    const businessData = {
      ...businessRes.data,
      avg_rating: metricsRes.data?.avg_rating ?? 0,
      review_count: metricsRes.data?.review_count ?? 0,
    };
    
    const reviewsData = reviewsRes.data || [];

    const responseData = {
      business: businessData,
      reviews: reviewsData,
    };
    
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