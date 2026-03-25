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

    // Fetch business data and reviews in parallel
    const [businessRes, reviewsRes, reviewStatsRes] = await Promise.all([
      supabaseAdmin.from('businesses').select('id, name, logo_url').eq('id', businessId).single(),
      supabaseAdmin.from('reviews').select('title, review_text, rating, original_author_name, source, created_at').eq('business_id', businessId).eq('status', 'approved').lte('created_at', new Date().toISOString()).not('title', 'is', null).not('review_text', 'is', null).neq('title', '').neq('review_text', '').order('created_at', { ascending: false }).limit(20),
      // Calculate avg_rating and review_count directly from reviews table
      supabaseAdmin.from('reviews').select('rating').eq('business_id', businessId).eq('status', 'approved').lte('created_at', new Date().toISOString())
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

    // Calculate review count and average rating from actual reviews
    const allReviews = reviewStatsRes.data || [];
    const reviewCount = allReviews.length;
    const avgRating = reviewCount > 0
      ? allReviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / reviewCount
      : 0;

    const businessData = {
      ...businessRes.data,
      avg_rating: Math.round(avgRating * 10) / 10, // Round to 1 decimal
      review_count: reviewCount,
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