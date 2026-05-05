// supabase/functions/create-checkout-session/index.ts
//
// Crea una Stripe Checkout Session para suscribirse a un plan.
//
// Cambios vs versión anterior:
//   • Anti-duplicado: si el usuario ya tiene una suscripción active|trialing
//     al mismo (plan, billingCycle), devuelve 409 — debe gestionarla por el
//     portal en vez de pagar dos veces.
//   • idempotency_key en stripe.customers.create y stripe.checkout.sessions.create
//     → reintentos del cliente reutilizan el mismo objeto en Stripe.
//   • CORS y success_url/cancel_url restringidos a una whitelist de Origins;
//     ya no se acepta cualquier Origin arbitrario.

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
  // El env SITE_URL también se valida contra whitelist, no se confía a ciegas.
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
// Plan / price configuration
// -----------------------------------------------------------------------------
// Stripe Price IDs autoritativos. Source of truth: Stripe Dashboard.
// Para añadir/cambiar planes hay que actualizar este mapa Y los productos en Stripe.
//
// 'v2' es un plan premium de prueba con un único price (sin distinción mensual/anual);
// se usa el mismo Stripe price para ambos billingCycle.
const V2_PRICE_ID = "price_1TTo6JGP3zN1neHAXHFYpy1l";
const PLAN_PRICE_IDS: Record<string, { monthly: string; annual: string }> = {
  starter: { monthly: "price_1TTnzlGP3zN1neHAKltGEqOy", annual: "price_1TTo2CGP3zN1neHAplpNdMDD" },
  growth:  { monthly: "price_1TTo0DGP3zN1neHAoJoiJKhu", annual: "price_1TTo2dGP3zN1neHAsg6PbzeJ" },
  pro:     { monthly: "price_1TTo17GP3zN1neHAXzBZ9dD0", annual: "price_1TTo3gGP3zN1neHArXBCKxyq" },
  v2:      { monthly: V2_PRICE_ID,                     annual: V2_PRICE_ID },
};

const PLAN_LIMITS: Record<string, number> = {
  free: 1, starter: 1, growth: 3, pro: 10, v2: 20, enterprise: 2147483647,
};

// -----------------------------------------------------------------------------
// Stripe
// -----------------------------------------------------------------------------
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  httpClient: Stripe.createFetchHttpClient(),
  apiVersion: "2024-06-20",
});

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
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
    if (authError || !user) return errorResponse("No autorizado.", 401, origin);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { plan, billingCycle, businessId, businessData, priceId: legacyPriceId } = body ?? {};

    if (!businessId && !businessData) {
      return errorResponse("Falta 'businessId' o 'businessData' en la solicitud.", 400, origin);
    }
    if (businessId && businessData) {
      return errorResponse(
        "Envía 'businessId' (existente) o 'businessData' (nuevo), no ambos.",
        400,
        origin
      );
    }

    // 1) Resolver priceId desde plan + billingCycle (o aceptar legacy whitelisted)
    let priceId: string | undefined;
    if (plan && billingCycle) {
      if (!Object.prototype.hasOwnProperty.call(PLAN_PRICE_IDS, plan)) {
        return errorResponse("Plan inválido.", 400, origin);
      }
      if (billingCycle !== "monthly" && billingCycle !== "annual") {
        return errorResponse("Ciclo de facturación inválido.", 400, origin);
      }
      priceId = PLAN_PRICE_IDS[plan][billingCycle];
    } else if (legacyPriceId && typeof legacyPriceId === "string") {
      const allowed = Object.values(PLAN_PRICE_IDS).flatMap((p) => [p.monthly, p.annual]);
      if (!allowed.includes(legacyPriceId)) {
        return errorResponse("priceId no autorizado.", 400, origin);
      }
      priceId = legacyPriceId;
    } else {
      return errorResponse("Faltan 'plan' y 'billingCycle' en la solicitud.", 400, origin);
    }

    // 2) Anti-duplicado: si el usuario ya tiene una sub activa al MISMO PRODUCTO
    //    (no sólo al mismo price), rechazamos. Esto evita que alguien con el plan
    //    "Growth mensual" active simultáneamente "Growth anual" → cobrado dos veces.
    //    Hacemos JOIN con prices para obtener el product_id de cada sub activa, y
    //    comparamos contra el product_id del priceId solicitado.
    const requestedPrice = await stripe.prices.retrieve(priceId);
    const requestedProductId =
      typeof requestedPrice.product === "string" ? requestedPrice.product : requestedPrice.product?.id;

    const { data: activeSubs, error: activeSubsErr } = await supabaseAdmin
      .from("subscriptions")
      .select("id, status, price_id, prices:price_id ( product_id )")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing"]);
    if (activeSubsErr) throw activeSubsErr;

    const duplicate = (activeSubs ?? []).find((s) => {
      // Match exacto por price → mismo plan + ciclo
      if (s.price_id === priceId) return true;
      // Match por product → mismo plan, ciclo distinto (también es duplicado)
      // deno-lint-ignore no-explicit-any
      const subProductId = (s as any).prices?.product_id;
      return subProductId && requestedProductId && subProductId === requestedProductId;
    });
    if (duplicate) {
      return jsonResponse(
        {
          error: "duplicate_subscription",
          details:
            "Ya tienes una suscripción activa a este plan. Gestiónala desde el portal de facturación.",
          subscription_id: duplicate.id,
        },
        409,
        origin
      );
    }

    // 3) Validación según flujo (existing business vs new business)
    const stripeMetadata: Record<string, string> = {
      supabase_user_id: user.id,
    };

    if (businessId) {
      // Negocio existente — verificamos ownership.
      if (typeof businessId !== "string") {
        return errorResponse("'businessId' inválido.", 400, origin);
      }
      const { data: businessRow, error: businessError } = await supabaseAdmin
        .from("businesses")
        .select("id, owner_id")
        .eq("id", businessId)
        .maybeSingle();
      if (businessError) throw businessError;
      if (!businessRow || businessRow.owner_id !== user.id) {
        return errorResponse("Negocio no encontrado o no autorizado.", 403, origin);
      }
      stripeMetadata.business_id = businessId;
    } else {
      // Negocio nuevo — la creación se difiere al webhook.
      const bd = businessData as Record<string, unknown>;
      const name = typeof bd.name === "string" ? bd.name.trim() : "";
      const category = typeof bd.category === "string" ? bd.category.trim() : "";
      const country = typeof bd.country === "string" ? bd.country.trim() : "";
      if (!name) return errorResponse("'businessData.name' es requerido.", 400, origin);
      if (!category) return errorResponse("'businessData.category' es requerido.", 400, origin);
      if (!country) return errorResponse("'businessData.country' es requerido.", 400, origin);

      const targetLimit = PLAN_LIMITS[plan as string] ?? 1;
      const { count, error: countError } = await supabaseAdmin
        .from("businesses")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id);
      if (countError) throw countError;
      if ((count ?? 0) >= targetLimit) {
        return errorResponse(
          `Has alcanzado el límite de negocios para el plan '${plan}' (${targetLimit}).`,
          400,
          origin
        );
      }

      const clip = (v: unknown, max: number) =>
        typeof v === "string" ? v.slice(0, max) : (v == null ? "" : String(v).slice(0, max));

      stripeMetadata.is_new_business = "true";
      stripeMetadata.business_name = clip(name, 500);
      stripeMetadata.business_category = clip(category, 500);
      stripeMetadata.business_country = clip(country, 50);
      if (bd.description != null) stripeMetadata.business_description = clip(bd.description, 500);
      if (bd.logo_url != null) stripeMetadata.business_logo_url = clip(bd.logo_url, 500);
      if (bd.google_maps_url != null) stripeMetadata.business_google_maps_url = clip(bd.google_maps_url, 500);
      // Validamos rango antes de guardar en metadata. Coordenadas fuera de rango
      // se descartan (no se incluyen en metadata) en lugar de propagarse al webhook.
      if (bd.latitude != null) {
        const lat = Number(bd.latitude);
        if (Number.isFinite(lat) && lat >= -90 && lat <= 90) {
          stripeMetadata.business_latitude = String(lat);
        }
      }
      if (bd.longitude != null) {
        const lon = Number(bd.longitude);
        if (Number.isFinite(lon) && lon >= -180 && lon <= 180) {
          stripeMetadata.business_longitude = String(lon);
        }
      }
    }

    // 4) Find or create Stripe Customer (idempotente).
    const { data: customer, error: customerError } = await supabaseAdmin
      .from("customers")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();
    if (customerError) throw customerError;

    let stripeCustomerId: string;
    if (!customer?.stripe_customer_id) {
      const stripeCustomer = await stripe.customers.create(
        { email: user.email, metadata: { supabase_user_id: user.id } },
        { idempotencyKey: `create-customer-${user.id}` }
      );
      stripeCustomerId = stripeCustomer.id;
      const { error: insertError } = await supabaseAdmin
        .from("customers")
        .insert({ id: user.id, stripe_customer_id: stripeCustomerId });
      if (insertError) throw insertError;
    } else {
      stripeCustomerId = customer.stripe_customer_id;
    }

    // 5) Stripe Checkout Session con idempotency_key estable por hora.
    const successUrl = `${origin}/pago-exitoso`;
    const cancelUrl = `${origin}/pago-cancelado`;
    const idemBucket = Math.floor(Date.now() / (60 * 60 * 1000)); // 1h bucket
    const idemKey = `checkout-${user.id}-${plan}-${billingCycle}-${businessId ?? "new"}-${idemBucket}`;

    const session = await stripe.checkout.sessions.create(
      {
        payment_method_types: ["card"],
        customer: stripeCustomerId,
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "subscription",
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: stripeMetadata,
      },
      { idempotencyKey: idemKey }
    );

    if (!session.id || !session.url) {
      throw new Error("No se pudo crear la sesión de Stripe.");
    }

    return jsonResponse({ sessionId: session.id, url: session.url }, 200, origin);
  } catch (error) {
    // deno-lint-ignore no-explicit-any
    const msg = (error as any)?.message ?? "Error interno del servidor";
    return errorResponse(msg, 500, origin);
  }
});
