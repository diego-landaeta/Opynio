// supabase/functions/create-checkout-session/index.ts
//
// Crea una Stripe Checkout Session para suscribirse a un plan.
//
// Cambios vs versión anterior:
//   • Una sola suscripcion por usuario: si ya tiene CUALQUIER suscripcion viva
//     (active|trialing|past_due, mirada en Stripe y en la BD), devuelve 409 y el
//     front abre el portal de Stripe para cambiar de plan (con prorrateo) en vez
//     de crear un segundo Checkout: antes «Mejorar a X» creaba otra suscripcion
//     y se cobraban las dos. 'duplicate_subscription' si es el mismo price,
//     'has_active_subscription' si es otro.
//   • Alta de empresa con un nombre que ya existe (sin mayusculas ni espacios
//     de los extremos): 400 'business_name_taken' ANTES de cobrar. En produccion
//     businesses.name es UNIQUE: el webhook no podia crear la empresa y el
//     cliente quedaba cobrado sin empresa.
//   • idempotency_key en stripe.customers.create y stripe.checkout.sessions.create
//     → reintentos del cliente reutilizan el mismo objeto en Stripe.
//   • CORS y success_url/cancel_url restringidos a una whitelist de Origins;
//     ya no se acepta cualquier Origin arbitrario.
//   • Todas las respuestas de error son JSON { error, code, details } con un
//     `code` estable (ver ErrorCode). El front traduce por `code`.
//
// OJO al desplegar: el front manda { plan, billingCycle, businessId |
// businessData }, nunca priceId. Una version anterior de esta funcion (la que
// habia en produccion desde el 19/05/2026) exigia priceId y respondia 400 a
// todos los pagos. Desplegar siempre desde este fichero.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@^16.2.0?target=deno&no-check";
import {
  LIVE_SUBSCRIPTION_STATUSES,
  PLAN_LIMITS,
  PLAN_PRICE_IDS,
  allowedPriceIds,
  isLiveStatus,
} from "../_shared/stripePlans.ts";
import { ilikeExactPattern, normalizeBusinessName } from "../_shared/businessName.ts";

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
// Price IDs y limites en ../_shared/stripePlans.ts (compartidos con el portal,
// get-checkout-status y el webhook). Source of truth: Stripe Dashboard.

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

// Codigos estables: el front (utils/userFacingError.ts) decide el mensaje y la
// accion por `code`, nunca por el texto. `error`/`details` son para logs y
// soporte (y para el front antiguo, que ensenaba `details`). No renombrar un
// codigo sin cambiar el front a la vez.
type ErrorCode =
  | "stripe_not_configured" // 500: falta STRIPE_SECRET_KEY
  | "unauthorized"          // 401: sin JWT o JWT invalido
  | "invalid_request"       // 400: cuerpo no JSON o sin plan/negocio
  | "invalid_plan"          // 400: plan, ciclo o priceId no permitidos
  | "invalid_business_data" // 400: faltan nombre/categoria/pais del negocio nuevo
  | "business_not_found"    // 403: el negocio no existe o no es del usuario
  | "business_limit_reached"// 400: el plan no admite mas negocios (no 409: 409 abre el portal)
  | "business_name_taken"   // 400: ya hay una empresa con ese nombre (no 409: 409 abre el portal)
  | "duplicate_subscription"// 409: ya tiene ese mismo plan activo → portal
  | "has_active_subscription"// 409: ya tiene otra suscripcion viva → portal (cambio de plan)
  | "price_unavailable"     // 500: el price no existe (o esta archivado) en la cuenta de Stripe de la clave
  | "stripe_error"          // 502: Stripe rechazo o no respondio
  | "internal_error";       // 500: cualquier otro fallo (BD...)

function errorResponse(
  code: ErrorCode,
  message: string,
  status: number,
  origin: string,
  extra: Record<string, unknown> = {},
): Response {
  console.error(`Error (${status}) [${code}]:`, message);
  return jsonResponse({ error: message, code, details: message, ...extra }, status, origin);
}

// deno-lint-ignore no-explicit-any
function isStripeError(error: any): boolean {
  return typeof error?.type === "string" && error.type.startsWith("Stripe");
}

// deno-lint-ignore no-explicit-any
type Admin = any;
type LiveSub = { id: string; status: string; priceId: string | null };

// Suscripciones vivas del usuario. Stripe manda: se listan las del customer y
// se comprueban una a una las que la BD da por vivas y no salen en la lista
// (otro customer, o una fila desfasada). Asi se cubre tambien el hueco entre el
// pago y la llegada del webhook. Si Stripe no responde, vale lo que diga la BD
// (mejor mandar al portal que arriesgar un doble cobro).
async function findLiveSubscriptions(admin: Admin, userId: string, stripeCustomerId: string | null): Promise<LiveSub[]> {
  const { data: rows, error } = await admin
    .from("subscriptions")
    .select("id, status, price_id")
    .eq("user_id", userId)
    .in("status", [...LIVE_SUBSCRIPTION_STATUSES]);
  if (error) throw error;
  // deno-lint-ignore no-explicit-any
  const fromDb: LiveSub[] = (rows ?? []).map((r: any) => ({ id: r.id, status: String(r.status), priceId: r.price_id ?? null }));

  try {
    const live: LiveSub[] = [];
    if (stripeCustomerId) {
      const list = await stripe.subscriptions.list({ customer: stripeCustomerId, status: "all", limit: 100 });
      for (const s of list.data) {
        if (isLiveStatus(s.status)) live.push({ id: s.id, status: s.status, priceId: s.items.data[0]?.price?.id ?? null });
      }
    }
    for (const row of fromDb) {
      if (live.some((l) => l.id === row.id)) continue;
      let real: Stripe.Subscription | null = null;
      try {
        real = await stripe.subscriptions.retrieve(row.id);
      } catch (err) {
        // deno-lint-ignore no-explicit-any
        if ((err as any)?.code !== "resource_missing") throw err;
      }
      if (real && isLiveStatus(real.status)) {
        live.push({ id: real.id, status: real.status, priceId: real.items.data[0]?.price?.id ?? null });
      } else {
        console.warn(`Sub ${row.id} viva en BD ('${row.status}') pero en Stripe es '${real?.status ?? "inexistente"}': no bloquea el pago.`);
      }
    }
    return live;
  } catch (err) {
    // deno-lint-ignore no-explicit-any
    console.error("No se pudieron consultar las suscripciones en Stripe; se usa la BD:", (err as any)?.message ?? String(err));
    return fromDb;
  }
}

type ExistingBusiness = { id: string; name: string; slug: string | null; country: string | null; owner_id: string | null };

// Empresa con el mismo nombre (sin mayusculas ni espacios de los extremos).
// ILIKE sin comodines del usuario (superconjunto) + igualdad exacta (lo que
// comprueba el UNIQUE de produccion); el filtro fino se hace aqui.
async function findBusinessByName(admin: Admin, name: string): Promise<ExistingBusiness | null> {
  const target = normalizeBusinessName(name);
  const cols = "id, name, slug, country, owner_id";
  const [similar, exact] = await Promise.all([
    admin.from("businesses").select(cols).ilike("name", ilikeExactPattern(name)).limit(50),
    admin.from("businesses").select(cols).eq("name", name).limit(1),
  ]);
  if (similar.error) throw similar.error;
  if (exact.error) throw exact.error;
  const all: ExistingBusiness[] = [...(exact.data ?? []), ...(similar.data ?? [])];
  return all.find((b) => normalizeBusinessName(b.name) === target) ?? null;
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
      return errorResponse("stripe_not_configured", "La clave secreta de Stripe no está configurada.", 500, origin);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("unauthorized", "No se encontró la cabecera de autorización.", 401, origin);
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) return errorResponse("unauthorized", "No autorizado.", 401, origin);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // deno-lint-ignore no-explicit-any
    let body: any;
    try {
      body = await req.json();
    } catch {
      return errorResponse("invalid_request", "El cuerpo de la solicitud no es JSON válido.", 400, origin);
    }
    const { plan, billingCycle, businessId, businessData, priceId: legacyPriceId } = body ?? {};

    if (!businessId && !businessData) {
      return errorResponse("invalid_request", "Falta 'businessId' o 'businessData' en la solicitud.", 400, origin);
    }
    if (businessId && businessData) {
      return errorResponse(
        "invalid_request",
        "Envía 'businessId' (existente) o 'businessData' (nuevo), no ambos.",
        400,
        origin
      );
    }

    // 1) Resolver priceId desde plan + billingCycle (o aceptar legacy whitelisted)
    let priceId: string | undefined;
    if (plan && billingCycle) {
      if (!Object.prototype.hasOwnProperty.call(PLAN_PRICE_IDS, plan)) {
        return errorResponse("invalid_plan", "Plan inválido.", 400, origin);
      }
      if (billingCycle !== "monthly" && billingCycle !== "annual") {
        return errorResponse("invalid_plan", "Ciclo de facturación inválido.", 400, origin);
      }
      priceId = PLAN_PRICE_IDS[plan][billingCycle];
    } else if (legacyPriceId && typeof legacyPriceId === "string") {
      if (!allowedPriceIds().includes(legacyPriceId)) {
        return errorResponse("invalid_plan", "priceId no autorizado.", 400, origin);
      }
      priceId = legacyPriceId;
    } else {
      return errorResponse("invalid_request", "Faltan 'plan' y 'billingCycle' en la solicitud.", 400, origin);
    }

    // 2) Customer de Stripe del usuario, si ya lo tiene (se crea en el paso 6).
    const { data: customer, error: customerError } = await supabaseAdmin
      .from("customers")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();
    if (customerError) throw customerError;

    // 3) Una sola suscripcion por usuario. Con cualquier suscripcion viva no se
    //    crea otro Checkout (se cobrarian las dos): 409 y el front abre el
    //    portal, que cambia el plan de la suscripcion existente con prorrateo.
    //    Antes solo se bloqueaba el MISMO plan; «Mejorar a X» creaba una segunda.
    const live = await findLiveSubscriptions(supabaseAdmin, user.id, customer?.stripe_customer_id ?? null);
    if (live.length > 0) {
      const same = live.find((s) => s.priceId === priceId);
      return same
        ? errorResponse(
            "duplicate_subscription",
            "Ya tienes una suscripción activa a este plan. Gestiónala desde el portal de facturación.",
            409,
            origin,
            { subscription_id: same.id },
          )
        : errorResponse(
            "has_active_subscription",
            "Ya tienes una suscripción activa. Cambia de plan desde el portal de facturación.",
            409,
            origin,
            { subscription_id: live[0].id },
          );
    }

    // 4) Validación según flujo (existing business vs new business). Antes de
    //    llamar a Stripe: son datos del usuario y se validan contra la BD.
    const stripeMetadata: Record<string, string> = {
      supabase_user_id: user.id,
    };

    if (businessId) {
      // Negocio existente — verificamos ownership.
      if (typeof businessId !== "string") {
        return errorResponse("invalid_request", "'businessId' inválido.", 400, origin);
      }
      const { data: businessRow, error: businessError } = await supabaseAdmin
        .from("businesses")
        .select("id, owner_id")
        .eq("id", businessId)
        .maybeSingle();
      if (businessError) throw businessError;
      if (!businessRow || businessRow.owner_id !== user.id) {
        return errorResponse("business_not_found", "Negocio no encontrado o no autorizado.", 403, origin);
      }
      stripeMetadata.business_id = businessId;
    } else {
      // Negocio nuevo — la creación se difiere al webhook.
      const bd = businessData as Record<string, unknown>;
      const name = typeof bd.name === "string" ? bd.name.trim() : "";
      const category = typeof bd.category === "string" ? bd.category.trim() : "";
      const country = typeof bd.country === "string" ? bd.country.trim() : "";
      if (!name) return errorResponse("invalid_business_data", "'businessData.name' es requerido.", 400, origin);
      if (!category) return errorResponse("invalid_business_data", "'businessData.category' es requerido.", 400, origin);
      if (!country) return errorResponse("invalid_business_data", "'businessData.country' es requerido.", 400, origin);

      const targetLimit = PLAN_LIMITS[plan as string] ?? 1;
      const { count, error: countError } = await supabaseAdmin
        .from("businesses")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id);
      if (countError) throw countError;
      if ((count ?? 0) >= targetLimit) {
        return errorResponse(
          "business_limit_reached",
          `Has alcanzado el límite de negocios para el plan '${plan}' (${targetLimit}).`,
          400,
          origin
        );
      }

      const clip = (v: unknown, max: number) =>
        typeof v === "string" ? v.slice(0, max) : (v == null ? "" : String(v).slice(0, max));

      // Nombre ya usado: se rechaza ANTES de cobrar. El front ofrece reclamar
      // la existente si no tiene dueno, o elegir otro nombre. Los datos que se
      // devuelven de la empresa existente ya son publicos (su ficha).
      const taken = await findBusinessByName(supabaseAdmin, clip(name, 500));
      if (taken) {
        return errorResponse(
          "business_name_taken",
          "Ya existe una empresa con ese nombre.",
          400,
          origin,
          {
            existing_business: {
              name: taken.name,
              slug: taken.slug,
              country: taken.country,
              claimable: !taken.owner_id,
            },
          },
        );
      }

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

    // 5) El price tiene que existir y estar activo en la cuenta de Stripe de
    //    STRIPE_SECRET_KEY. Un id copiado de otra cuenta da resource_missing: se
    //    devuelve un codigo propio para que en los logs se vea que es
    //    configuracion (ver la nota de starter.annual en _shared/stripePlans.ts).
    // deno-lint-ignore no-explicit-any
    let requestedPrice: any;
    try {
      requestedPrice = await stripe.prices.retrieve(priceId);
    } catch (priceError) {
      // deno-lint-ignore no-explicit-any
      const detail = (priceError as any)?.message ?? String(priceError);
      const missing = isStripeError(priceError) && (priceError as { code?: string }).code === "resource_missing";
      console.error(
        `Price ${priceId} (${plan}/${billingCycle}) no disponible en Stripe` +
          (missing ? " [resource_missing: el id no existe en la cuenta de STRIPE_SECRET_KEY; revisar PLAN_PRICE_IDS en _shared/stripePlans.ts]" : "") +
          ":",
        detail,
      );
      return missing
        ? errorResponse("price_unavailable", "El precio de este plan no existe en la cuenta de Stripe.", 500, origin)
        : errorResponse("stripe_error", "No se pudo consultar el precio en Stripe.", 502, origin);
    }
    if (requestedPrice?.active === false) {
      console.error(`Price ${priceId} (${plan}/${billingCycle}) archivado en Stripe (active=false): Checkout lo rechazaria.`);
      return errorResponse("price_unavailable", "El precio de este plan está archivado en Stripe.", 500, origin);
    }

    // 6) Find or create Stripe Customer (idempotente).
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

    // 7) Stripe Checkout Session con idempotency_key estable por hora.
    // success_url incluye {CHECKOUT_SESSION_ID} para usarlo como event_id en Meta CAPI Purchase (dedup cliente↔servidor)
    const successUrl = `${origin}/pago-exitoso?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/pago-cancelado`;
    const idemBucket = Math.floor(Date.now() / (60 * 60 * 1000)); // 1h bucket
    // La clave incluye un hash de lo que se manda a Stripe: con los mismos datos
    // un doble clic reutiliza la sesion; si el usuario corrige el nombre de la
    // empresa y reintenta, es otra clave. Antes Stripe rechazaba la clave
    // reutilizada con parametros distintos y el usuario veia un 500 durante 1 h.
    const huella = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify({ priceId, stripeMetadata })),
    );
    const huellaHex = Array.from(new Uint8Array(huella)).slice(0, 8)
      .map((b) => b.toString(16).padStart(2, "0")).join("");
    const idemKey = `checkout-${user.id}-${plan}-${billingCycle}-${businessId ?? "new"}-${idemBucket}-${huellaHex}`;

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
    // El detalle (mensaje de Stripe o de la BD) va solo al log; al cliente, un
    // codigo estable. Stripe (clave invalida, cliente borrado, sin red...) → 502.
    // deno-lint-ignore no-explicit-any
    const msg = (error as any)?.message ?? String(error);
    if (isStripeError(error)) {
      // deno-lint-ignore no-explicit-any
      console.error(`Stripe ${(error as any).type} ${(error as any).code ?? ""}:`, msg);
      return errorResponse("stripe_error", "Stripe no pudo crear la sesión de pago.", 502, origin);
    }
    console.error("Error interno:", msg);
    return errorResponse("internal_error", "Error interno del servidor.", 500, origin);
  }
});
