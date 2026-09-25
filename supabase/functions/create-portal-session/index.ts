// supabase/functions/create-portal-session/index.ts
//
// Crea una sesión del Stripe Customer Portal para que el usuario gestione
// su suscripción.
//
// Cambios vs versión anterior:
//   • CORS y return_url restringidos a una whitelist de Origins.
//   • Idempotency key implícita: stripe.customers.create se reutiliza por user.id.
//   • Cambio de plan (24/09/2026): cuerpo opcional { plan, billingCycle }. Si el
//     usuario tiene UNA suscripcion viva con otro price, el portal se abre
//     directamente en la confirmacion del cambio a ese plan (flow_data
//     subscription_update_confirm): Stripe ensena el prorrateo y el importe y
//     el usuario confirma. Si la configuracion del portal no lo permite (cambio
//     de plan desactivado o el price no esta entre sus productos), se prueba la
//     pantalla de cambio de plan (subscription_update) y, si tampoco, el portal
//     normal. create-checkout-session manda aqui (409) en vez de crear una
//     segunda suscripcion.
//     Por que el portal y no stripe.subscriptions.update desde aqui: con el
//     portal el usuario ve y confirma el importe prorrateado antes del cargo,
//     Stripe resuelve la autenticacion 3DS si el cobro la pide y aplica la
//     politica de prorrateo configurada; un update directo cobraria con un solo
//     clic, sin confirmacion, y un 3DS fallido dejaria la suscripcion en
//     past_due sin pantalla para completarlo.
//     El return_url no cambia (y no se usa after_completion con otra URL).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@^16.2.0?target=deno&no-check";
import { isLiveStatus, priceIdFor } from "../_shared/stripePlans.ts";

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

// Mismos codigos estables que create-checkout-session (el front traduce por
// `code`, ver utils/userFacingError.ts).
type ErrorCode =
  | "stripe_not_configured" // 500
  | "unauthorized"          // 401
  | "stripe_error"          // 502: Stripe rechazo (p. ej. portal sin configurar) o no respondio
  | "internal_error";       // 500

function errorResponse(code: ErrorCode, message: string, status: number, origin: string): Response {
  console.error(`Error (${status}) [${code}]:`, message);
  return jsonResponse({ error: message, code, details: message }, status, origin);
}

// deno-lint-ignore no-explicit-any
function isStripeError(error: any): boolean {
  return typeof error?.type === "string" && error.type.startsWith("Stripe");
}

// Cuerpo opcional { plan, billingCycle }: el plan al que se quiere cambiar.
// Sin cuerpo (o invalido) → portal normal, como antes.
async function readTargetPriceId(req: Request): Promise<string | null> {
  try {
    const text = await req.text();
    if (!text) return null;
    const body = JSON.parse(text);
    return priceIdFor(body?.plan, body?.billingCycle);
  } catch {
    return null;
  }
}

// flow_data para abrir el portal en el cambio de plan, en orden de preferencia.
// Vacio si no aplica: sin suscripcion viva, mas de una (que elija en el portal
// cual cancelar), varios items, o ya esta en ese price.
async function planChangeFlows(
  customerId: string,
  targetPriceId: string,
): Promise<Stripe.BillingPortal.SessionCreateParams.FlowData[]> {
  const list = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 });
  const live = list.data.filter((s) => isLiveStatus(s.status));
  if (live.length !== 1) return [];
  const sub = live[0];
  const items = sub.items.data;
  if (items.length !== 1 || items[0].price.id === targetPriceId) return [];
  return [
    {
      type: "subscription_update_confirm",
      subscription_update_confirm: {
        subscription: sub.id,
        items: [{ id: items[0].id, price: targetPriceId, quantity: 1 }],
      },
    },
    { type: "subscription_update", subscription_update: { subscription: sub.id } },
  ];
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
    if (authError || !user) {
      return errorResponse("unauthorized", "No autorizado.", 401, origin);
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

    // Plan al que se quiere cambiar (PricingPage tras el 409 de checkout).
    const targetPriceId = await readTargetPriceId(req);
    let flows: Stripe.BillingPortal.SessionCreateParams.FlowData[] = [];
    if (targetPriceId && customer?.stripe_customer_id) {
      try {
        flows = await planChangeFlows(customer.stripe_customer_id, targetPriceId);
      } catch (err) {
        // deno-lint-ignore no-explicit-any
        console.warn("No se pudieron leer las suscripciones para el cambio de plan; portal normal:", (err as any)?.message ?? String(err));
      }
    }

    // /empresa/panel/facturacion no existe (la pantalla de facturacion no se usa)
    // y mostraba "Negocio no encontrado". Mis negocios es donde esta el boton.
    const returnUrl = `${origin}/mis-negocios`;
    let portalSession: Stripe.BillingPortal.Session | null = null;
    for (const flow of flows) {
      try {
        portalSession = await stripe.billingPortal.sessions.create({
          customer: stripeCustomerId,
          return_url: returnUrl,
          flow_data: flow,
        });
        break;
      } catch (err) {
        // La configuracion del portal no permite este flujo: se prueba el siguiente.
        if (!isStripeError(err)) throw err;
        // deno-lint-ignore no-explicit-any
        console.warn(`Portal con flow_data '${flow.type}' rechazado por Stripe (${(err as any).code ?? (err as any).type}):`, (err as any).message);
      }
    }
    if (!portalSession) {
      portalSession = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: returnUrl,
      });
    }

    if (!portalSession.url) {
      throw new Error("No se pudo crear la sesión del portal de cliente.");
    }

    return jsonResponse({ url: portalSession.url }, 200, origin);
  } catch (error) {
    // El detalle va al log; al cliente, un codigo estable.
    // deno-lint-ignore no-explicit-any
    const msg = (error as any)?.message ?? String(error);
    if (isStripeError(error)) {
      // deno-lint-ignore no-explicit-any
      console.error(`Stripe ${(error as any).type} ${(error as any).code ?? ""}:`, msg);
      return errorResponse("stripe_error", "Stripe no pudo abrir el portal de facturación.", 502, origin);
    }
    console.error("Error interno:", msg);
    return errorResponse("internal_error", "Error interno del servidor.", 500, origin);
  }
});
