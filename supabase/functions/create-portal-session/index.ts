// supabase/functions/create-portal-session/index.ts
//
// Crea una sesión del Stripe Customer Portal para que el usuario gestione
// su suscripción.
//
// Cambios vs versión anterior:
//   • CORS y return_url restringidos a una whitelist de Origins.
//   • Idempotency key implícita: stripe.customers.create se reutiliza por user.id.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@^16.2.0?target=deno&no-check";

declare const Deno: { env: { get: (key: string) => string | undefined } };

// -----------------------------------------------------------------------------
// Origin whitelist
// -----------------------------------------------------------------------------
const ALLOWED_ORIGINS = new Set<string>([
  "https://web.opynio.com",
  "https://opynio.com",
  "https://www.opynio.com",
  "http://localhost:5173",
  "http://localhost:3000",
]);

const FALLBACK_SITE_URL = "https://web.opynio.com";

function resolveOrigin(req: Request): string {
  const headerOrigin = req.headers.get("origin");
  if (headerOrigin && ALLOWED_ORIGINS.has(headerOrigin)) return headerOrigin;
  const envSite = Deno.env.get("SITE_URL");
  if (envSite && ALLOWED_ORIGINS.has(envSite)) return envSite;
  return FALLBACK_SITE_URL;
}

function corsHeadersFor(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

// -----------------------------------------------------------------------------
// Stripe
// -----------------------------------------------------------------------------
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  httpClient: Stripe.createFetchHttpClient(),
  apiVersion: "2024-06-20",
});

function jsonResponse(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersFor(origin), "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status: number, origin: string): Response {
  console.error(`Error (${status}):`, message);
  return jsonResponse({ error: message, details: message }, status, origin);
}

// -----------------------------------------------------------------------------
// Main handler
// -----------------------------------------------------------------------------
serve(async (req) => {
  const origin = resolveOrigin(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeadersFor(origin) });
  }

  try {
    if (!Deno.env.get("STRIPE_SECRET_KEY")) {
      return errorResponse("La clave secreta de Stripe no está configurada.", 500, origin);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("No se encontró la cabecera de autorización.", 401, origin);
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return errorResponse("No autorizado.", 401, origin);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: customer, error: customerError } = await supabaseAdmin
      .from("customers")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();
    if (customerError) throw customerError;

    let stripeCustomerId: string | undefined = customer?.stripe_customer_id ?? undefined;

    if (!stripeCustomerId) {
      const stripeCustomer = await stripe.customers.create(
        { email: user.email, metadata: { supabase_user_id: user.id } },
        { idempotencyKey: `create-customer-${user.id}` }
      );
      stripeCustomerId = stripeCustomer.id;

      const { error: insertError } = await supabaseAdmin
        .from("customers")
        .insert({ id: user.id, stripe_customer_id: stripeCustomerId });
      if (insertError) throw insertError;
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${origin}/empresa/panel/facturacion`,
    });

    if (!portalSession.url) {
      throw new Error("No se pudo crear la sesión del portal de cliente.");
    }

    return jsonResponse({ url: portalSession.url }, 200, origin);
  } catch (error) {
    // deno-lint-ignore no-explicit-any
    const msg = (error as any)?.message ?? "Error interno del servidor";
    return errorResponse(msg, 500, origin);
  }
});
