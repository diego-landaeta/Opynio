import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from 'https://esm.sh/stripe@^16.2.0?target=deno&no-check';

// Type declarations for Deno environment
declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function createErrorResponse(message: string, statusCode: number = 500) {
  console.error(`Error (${statusCode}):`, message);
  return new Response(JSON.stringify({ error: message, details: message }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: statusCode,
  });
}

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
    httpClient: Stripe.createFetchHttpClient(),
    apiVersion: '2024-06-20',
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!Deno.env.get("STRIPE_SECRET_KEY")) {
      return createErrorResponse("La clave secreta de Stripe no está configurada.", 500);
    }
    
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return createErrorResponse("No se encontró la cabecera de autorización.", 401);
    }
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return createErrorResponse("No autorizado.", 401);
    }

    // After authentication, create an admin client to perform privileged operations
    const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get Stripe Customer ID from Supabase using admin client. Lazily create one if missing
    // so that any authenticated user can land on the portal even if they have not yet paid.
    let { data: customer, error: customerError } = await supabaseAdmin
      .from("customers")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (customerError) {
      throw customerError;
    }

    let stripeCustomerId: string | undefined = customer?.stripe_customer_id ?? undefined;

    if (!stripeCustomerId) {
      const stripeCustomer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      stripeCustomerId = stripeCustomer.id;

      const { error: insertError } = await supabaseAdmin
        .from("customers")
        .insert({ id: user.id, stripe_customer_id: stripeCustomerId });
      if (insertError) throw insertError;
    }

    // Determine SITE_URL, falling back to Origin header
    // Resolution order: SITE_URL secret → request Origin header → production fallback.
    let siteUrl = Deno.env.get("SITE_URL") ?? req.headers.get("origin") ?? "https://web.opynio.com";
    if (!siteUrl.startsWith('http')) siteUrl = "https://web.opynio.com";

    // Create Stripe Portal Session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${siteUrl}/empresa/panel/facturacion`,
    });

    if (!portalSession.url) {
      throw new Error("No se pudo crear la sesión del portal de cliente.");
    }

    return new Response(JSON.stringify({ url: portalSession.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    return createErrorResponse(error.message || "Error interno del servidor", 500);
  }
});