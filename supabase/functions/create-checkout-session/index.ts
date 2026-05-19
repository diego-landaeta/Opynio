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
    
    // 1. Authenticate user using their token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return createErrorResponse("No se encontró la cabecera de autorización.", 401);
    }
    // Create a client with the user's auth token to verify them
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

    // 2. Get price_id and business_id from request body
    const { priceId, businessId } = await req.json();
    if (!priceId || !businessId) {
      return createErrorResponse("Faltan 'priceId' o 'businessId' en la solicitud.", 400);
    }

    // 3. Find or create Stripe Customer using the admin client
    let { data: customer, error: customerError } = await supabaseAdmin
      .from("customers")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (customerError && customerError.code !== 'PGRST116') {
      throw customerError;
    }

    let stripeCustomerId: string;

    if (!customer) {
      const stripeCustomer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      stripeCustomerId = stripeCustomer.id;
      
      const { error: newCustomerError } = await supabaseAdmin
        .from("customers")
        .insert({ id: user.id, stripe_customer_id: stripeCustomerId });
      if (newCustomerError) throw newCustomerError;
    } else {
      stripeCustomerId = customer.stripe_customer_id!;
    }

    // Determine SITE_URL, falling back to Origin header
    let siteUrl = Deno.env.get("SITE_URL");
    if (!siteUrl) {
        siteUrl = req.headers.get("origin");
    }

    if (!siteUrl || !siteUrl.startsWith('http')) {
        return createErrorResponse(
            "No se pudo determinar la URL del sitio. Configure la variable de entorno SITE_URL o asegúrese de que la cabecera 'Origin' esté presente.", 
            500
        );
    }
    
    // 4. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${siteUrl}/pago-exitoso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/pago-cancelado`,
      metadata: {
        business_id: businessId,
        supabase_user_id: user.id,
      },
    });

    if (!session.id || !session.url) {
        throw new Error("No se pudo crear la sesión de Stripe.");
    }

    // 5. Return session ID and URL to client
    // FIX: Return the full session URL to allow the client to redirect manually,
    // bypassing the problematic client-side redirectToCheckout method.
    return new Response(JSON.stringify({ sessionId: session.id, url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    return createErrorResponse(error.message || "Error interno del servidor", 500);
  }
});