import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from 'https://esm.sh/stripe@^16.2.0?target=deno&no-check';

declare const Deno: { env: { get: (key: string) => string | undefined } };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Server-side authoritative mapping of plan + billing cycle → Stripe price ID.
// Mirrors STRIPE_PRICE_IDS in constants.ts. Keep them in sync.
const PLAN_PRICE_IDS: Record<string, { monthly: string; annual: string }> = {
  starter: { monthly: 'price_1SIEGvRJqlZctcvhh3VMcupC', annual: 'price_1SIESFRJqlZctcvhzjdQHBzL' },
  growth:  { monthly: 'price_1SIEJeRJqlZctcvhrzuA4wR8', annual: 'price_1SIET4RJqlZctcvhy9Rwy8ka' },
  pro:     { monthly: 'price_1SIELiRJqlZctcvhQ3xP8rwa', annual: 'price_1SIEU1RJqlZctcvhRze5EeNR' },
};

const PLAN_LIMITS: Record<string, number> = {
  free: 1, starter: 1, growth: 3, pro: 10, enterprise: 2147483647,
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
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!Deno.env.get("STRIPE_SECRET_KEY")) {
      return createErrorResponse("La clave secreta de Stripe no está configurada.", 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return createErrorResponse("No se encontró la cabecera de autorización.", 401);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) return createErrorResponse("No autorizado.", 401);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Body shape: either upgrades an existing business (businessId) or buys for a new
    // business that will be created by the webhook on payment success (businessData).
    const body = await req.json();
    const { plan, billingCycle, businessId, businessData, priceId: legacyPriceId } = body ?? {};

    if (!businessId && !businessData) {
      return createErrorResponse("Falta 'businessId' o 'businessData' en la solicitud.", 400);
    }
    if (businessId && businessData) {
      return createErrorResponse("Envía 'businessId' (existente) o 'businessData' (nuevo), no ambos.", 400);
    }

    // 1) Resolve priceId from plan + billingCycle (or accept whitelisted legacy priceId).
    let priceId: string | undefined;
    if (plan && billingCycle) {
      if (!Object.prototype.hasOwnProperty.call(PLAN_PRICE_IDS, plan)) {
        return createErrorResponse("Plan inválido.", 400);
      }
      if (billingCycle !== 'monthly' && billingCycle !== 'annual') {
        return createErrorResponse("Ciclo de facturación inválido.", 400);
      }
      priceId = PLAN_PRICE_IDS[plan][billingCycle];
    } else if (legacyPriceId && typeof legacyPriceId === 'string') {
      const allowed = Object.values(PLAN_PRICE_IDS).flatMap(p => [p.monthly, p.annual]);
      if (!allowed.includes(legacyPriceId)) return createErrorResponse("priceId no autorizado.", 400);
      priceId = legacyPriceId;
    } else {
      return createErrorResponse("Faltan 'plan' y 'billingCycle' en la solicitud.", 400);
    }

    // 2) Branch: existing business (only re-plan) vs new business (create on payment).
    const stripeMetadata: Record<string, string> = {
      supabase_user_id: user.id,
    };

    if (businessId) {
      // Existing business — verify ownership.
      if (typeof businessId !== 'string') {
        return createErrorResponse("'businessId' inválido.", 400);
      }
      const { data: businessRow, error: businessError } = await supabaseAdmin
        .from("businesses")
        .select("id, owner_id")
        .eq("id", businessId)
        .maybeSingle();
      if (businessError) throw businessError;
      if (!businessRow || businessRow.owner_id !== user.id) {
        return createErrorResponse("Negocio no encontrado o no autorizado.", 403);
      }
      stripeMetadata.business_id = businessId;
    } else {
      // New business — defer creation to the webhook. Validate business_limit now so
      // we don't create a Stripe session for someone who couldn't legitimately get the
      // business once paid.
      const bd = businessData as Record<string, unknown>;
      const name = typeof bd.name === 'string' ? bd.name.trim() : '';
      const category = typeof bd.category === 'string' ? bd.category.trim() : '';
      const country = typeof bd.country === 'string' ? bd.country.trim() : '';
      if (!name) return createErrorResponse("'businessData.name' es requerido.", 400);
      if (!category) return createErrorResponse("'businessData.category' es requerido.", 400);
      if (!country) return createErrorResponse("'businessData.country' es requerido.", 400);

      // Count caller's businesses against the LIMIT OF THE PLAN BEING PURCHASED.
      const targetLimit = PLAN_LIMITS[plan as string] ?? 1;
      const { count, error: countError } = await supabaseAdmin
        .from("businesses")
        .select("id", { count: 'exact', head: true })
        .eq("owner_id", user.id);
      if (countError) throw countError;
      if ((count ?? 0) >= targetLimit) {
        return createErrorResponse(
          `Has alcanzado el límite de negocios para el plan '${plan}' (${targetLimit}).`,
          400
        );
      }

      // Stripe metadata: 50 keys max, 500 chars per value. Split fields and clip strings.
      const clip = (v: unknown, max: number) =>
        typeof v === 'string' ? v.slice(0, max) : (v == null ? '' : String(v).slice(0, max));

      stripeMetadata.is_new_business = 'true';
      stripeMetadata.business_name = clip(name, 500);
      stripeMetadata.business_category = clip(category, 500);
      stripeMetadata.business_country = clip(country, 50);
      if (bd.description != null) stripeMetadata.business_description = clip(bd.description, 500);
      if (bd.logo_url != null) stripeMetadata.business_logo_url = clip(bd.logo_url, 500);
      if (bd.google_maps_url != null) stripeMetadata.business_google_maps_url = clip(bd.google_maps_url, 500);
      if (bd.latitude != null) stripeMetadata.business_latitude = clip(bd.latitude, 64);
      if (bd.longitude != null) stripeMetadata.business_longitude = clip(bd.longitude, 64);
    }

    // 3) Find or create Stripe Customer.
    let { data: customer, error: customerError } = await supabaseAdmin
      .from("customers")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();
    if (customerError) throw customerError;

    let stripeCustomerId: string;
    if (!customer?.stripe_customer_id) {
      const stripeCustomer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      stripeCustomerId = stripeCustomer.id;
      const { error: insertError } = await supabaseAdmin
        .from("customers")
        .insert({ id: user.id, stripe_customer_id: stripeCustomerId });
      if (insertError) throw insertError;
    } else {
      stripeCustomerId = customer.stripe_customer_id;
    }

    // 4) SITE_URL.
    let siteUrl = Deno.env.get("SITE_URL");
    if (!siteUrl) siteUrl = req.headers.get("origin");
    if (!siteUrl || !siteUrl.startsWith('http')) {
      return createErrorResponse("No se pudo determinar la URL del sitio.", 500);
    }

    // 5) Stripe Checkout Session.
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${siteUrl}/pago-exitoso`,
      cancel_url: `${siteUrl}/pago-cancelado`,
      metadata: stripeMetadata,
    });

    if (!session.id || !session.url) throw new Error("No se pudo crear la sesión de Stripe.");

    return new Response(JSON.stringify({ sessionId: session.id, url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return createErrorResponse(error.message || "Error interno del servidor", 500);
  }
});
