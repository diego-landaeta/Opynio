// supabase/functions/get-checkout-status/index.ts
//
// Estado de UNA sesion de Stripe Checkout para /pago-exitoso (verify_jwt: true).
//
// Antes /pago-exitoso daba el pago por confirmado si el usuario tenia cualquier
// suscripcion active/trialing creada en las ultimas 48 h, no la de ESTE checkout:
//   (A) Alta de empresa: customer.subscription.created guarda la suscripcion
//       antes de que checkout.session.completed cree la empresa y suba el rol:
//       la pagina confirmaba, «Mis negocios» rebotaba (BusinessRoute) y, si la
//       RPC fallaba, quedaba «confirmado» sin empresa.
//   (B) Un segundo checkout en menos de 48 h se confirmaba con la suscripcion
//       anterior y el Purchase salia con el session_id nuevo y el precio viejo.
//
// Aqui se mira la sesion en Stripe con la sesion del usuario:
//   - es suya (metadata.supabase_user_id o su customer) → si no, 404;
//   - esta pagada (status complete + payment_status paid/no_payment_required);
//   - el webhook ya la ha aplicado: su suscripcion esta en la BD y viva, el
//     perfil tiene el plan de ESA suscripcion y, si es alta de empresa, la
//     empresa existe (con su nombre o el sufijo " (2)"...) y el rol es
//     business_owner.
// `ready` solo es true cuando todo eso se cumple. Devuelve tambien el importe
// y la moneda de la sesion para el Purchase del Pixel.
//
// Solo lectura: no escribe nada ni en Stripe ni en la BD.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@^16.2.0?target=deno&no-check";
import { isLiveStatus, planNameFromPrice } from "../_shared/stripePlans.ts";
import { businessNameCandidates } from "../_shared/businessName.ts";

declare const Deno: { env: { get: (key: string) => string | undefined } };

// -----------------------------------------------------------------------------
// Origin whitelist (la misma que create-checkout-session / create-portal-session)
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

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  httpClient: Stripe.createFetchHttpClient(),
  apiVersion: "2024-06-20",
});

function jsonResponse(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersFor(origin), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// Mismos codigos estables que las otras funciones de pago (utils/userFacingError.ts).
type ErrorCode =
  | "stripe_not_configured" // 500
  | "unauthorized"          // 401
  | "invalid_request"       // 400: sin session_id o con formato invalido
  | "checkout_session_not_found" // 404: no existe o no es de este usuario (no se distingue)
  | "stripe_error"          // 502
  | "internal_error";       // 500

function errorResponse(code: ErrorCode, message: string, status: number, origin: string): Response {
  console.error(`Error (${status}) [${code}]:`, message);
  return jsonResponse({ error: message, code, details: message }, status, origin);
}

// deno-lint-ignore no-explicit-any
function isStripeError(error: any): boolean {
  return typeof error?.type === "string" && error.type.startsWith("Stripe");
}

const SESSION_ID_RE = /^cs_(test|live)_[A-Za-z0-9]{10,250}$/;

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
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) return errorResponse("unauthorized", "No autorizado.", 401, origin);

    // deno-lint-ignore no-explicit-any
    let body: any = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }
    const sessionId = typeof body?.session_id === "string" ? body.session_id.trim() : "";
    if (!SESSION_ID_RE.test(sessionId)) {
      return errorResponse("invalid_request", "Falta 'session_id' o no es válido.", 400, origin);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (err) {
      // deno-lint-ignore no-explicit-any
      if (isStripeError(err) && (err as any).code === "resource_missing") {
        return errorResponse("checkout_session_not_found", "Sesión de pago no encontrada.", 404, origin);
      }
      throw err;
    }

    // ¿Es de este usuario? La metadata la pone create-checkout-session; si no
    // la tuviera (sesion creada a mano), vale el customer del usuario.
    const metaUser = session.metadata?.supabase_user_id;
    let owns = metaUser === user.id;
    if (!owns && !metaUser) {
      const { data: customer, error: customerError } = await supabaseAdmin
        .from("customers")
        .select("stripe_customer_id")
        .eq("id", user.id)
        .maybeSingle();
      if (customerError) throw customerError;
      const sessionCustomer = typeof session.customer === "string" ? session.customer : session.customer?.id;
      owns = !!customer?.stripe_customer_id && sessionCustomer === customer.stripe_customer_id;
    }
    if (!owns) {
      // Mismo 404 que si no existiera: no se confirma la existencia de sesiones ajenas.
      console.warn(`Sesion ${sessionId} pedida por ${user.id}, que no es su dueno.`);
      return errorResponse("checkout_session_not_found", "Sesión de pago no encontrada.", 404, origin);
    }

    const paid =
      session.status === "complete" &&
      (session.payment_status === "paid" || session.payment_status === "no_payment_required");
    const isNewBusiness = session.metadata?.is_new_business === "true";
    const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;

    let subscriptionSynced = false;
    let planSynced = false;
    let businessReady = !isNewBusiness;
    let roleReady = !isNewBusiness;
    let plan: string | null = null;
    let business: { name: string; slug: string | null; country: string | null } | null = null;

    if (paid && subscriptionId) {
      const [{ data: subRow, error: subErr }, { data: profile, error: profErr }] = await Promise.all([
        supabaseAdmin.from("subscriptions").select("id, status, price_id").eq("id", subscriptionId).maybeSingle(),
        supabaseAdmin.from("profiles").select("plan, role").eq("id", user.id).maybeSingle(),
      ]);
      if (subErr) throw subErr;
      if (profErr) throw profErr;

      subscriptionSynced = !!subRow && isLiveStatus(subRow.status);
      if (subRow?.price_id) {
        let productName = "";
        const { data: priceRow } = await supabaseAdmin
          .from("prices")
          .select("product_id")
          .eq("id", subRow.price_id)
          .maybeSingle();
        if (priceRow?.product_id) {
          const { data: productRow } = await supabaseAdmin
            .from("products")
            .select("name")
            .eq("id", priceRow.product_id)
            .maybeSingle();
          productName = productRow?.name ?? "";
        }
        plan = planNameFromPrice(subRow.price_id, productName) || null;
      }
      planSynced = !!plan && profile?.plan === plan;

      if (isNewBusiness) {
        // La empresa de ESTE checkout: del usuario, creada despues de abrir la
        // sesion y con el nombre pedido (o con sufijo si chocaba).
        const candidates = new Set(businessNameCandidates(session.metadata?.business_name ?? "", subscriptionId));
        const { data: bizs, error: bizErr } = await supabaseAdmin
          .from("businesses")
          .select("name, slug, country, created_at")
          .eq("owner_id", user.id)
          .gte("created_at", new Date(session.created * 1000).toISOString())
          .limit(50);
        if (bizErr) throw bizErr;
        const found = (bizs ?? []).find((b) => candidates.has(b.name));
        business = found ? { name: found.name, slug: found.slug ?? null, country: found.country ?? null } : null;
        businessReady = !!found;
        roleReady = profile?.role === "business_owner" || profile?.role === "admin";
      }
    }

    const ready = paid && subscriptionSynced && planSynced && businessReady && roleReady;
    return jsonResponse(
      {
        paid,
        ready,
        status: session.status,
        payment_status: session.payment_status,
        is_new_business: isNewBusiness,
        subscription_synced: subscriptionSynced,
        plan_synced: planSynced,
        business_ready: businessReady,
        role_ready: roleReady,
        plan,
        business,
        amount: typeof session.amount_total === "number" ? session.amount_total / 100 : null,
        currency: session.currency ? session.currency.toUpperCase() : null,
      },
      200,
      origin,
    );
  } catch (error) {
    // deno-lint-ignore no-explicit-any
    const msg = (error as any)?.message ?? String(error);
    if (isStripeError(error)) {
      // deno-lint-ignore no-explicit-any
      console.error(`Stripe ${(error as any).type} ${(error as any).code ?? ""}:`, msg);
      return errorResponse("stripe_error", "No se pudo consultar la sesión de pago en Stripe.", 502, origin);
    }
    console.error("Error interno:", msg);
    return errorResponse("internal_error", "Error interno del servidor.", 500, origin);
  }
});
