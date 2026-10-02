// supabase/functions/stripe-webhook/index.ts
//
// Webhook de Stripe con idempotencia robusta y procesamiento transaccional.
//
// Cambios vs versión anterior:
//   • Guard de idempotencia: cada handler hace INSERT en processed_webhook_events
//     (PK = event.id). Si el INSERT no afecta filas, el evento ya fue procesado y
//     se descarta — protege contra reentregas de Stripe.
//   • checkout.session.completed delega a la RPC process_checkout_completion,
//     que envuelve los 5 writes (products/prices/subscriptions/businesses/profiles)
//     en una única transacción PostgreSQL.
//   • customer.subscription.updated y customer.subscription.created hacen UPSERT
//     (no UPDATE) — auto-recuperación si el evento llega antes que checkout.session.completed.
//   • Lectura defensiva de current_period_start/end: prefiere subscription.items[0]
//     (formato actual) y cae al top-level (formato anterior) — forward-compat con la
//     deprecación de Stripe API 2025-03-31.
//   • Errores en upserts de products/prices se chequean siempre (antes se tragaban).
//   • La respuesta de error al exterior es genérica; el detalle queda en logs.
//   • 24/09/2026: alta pagada con nombre o URL de Maps ya usados -> la empresa se
//     crea igualmente ("Nombre (2)" / sin URL) en vez de 500 eterno
//     (checkoutCompletion.ts). Con varias suscripciones vivas, solo la
//     principal escribe el plan y deleted no baja a free si queda otra
//     (subscriptionSync.ts).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@^16.2.0?target=deno&no-check";
import { runCheckoutCompletion } from "./checkoutCompletion.ts";
import { pickRemainingPrimary, shouldSyncProfile, type SubscriptionRow } from "./subscriptionSync.ts";
import { LIVE_SUBSCRIPTION_STATUSES, planNameFromPrice } from "../_shared/stripePlans.ts";
import { businessNameCandidates } from "../_shared/businessName.ts";

declare const Deno: { env: { get: (key: string) => string | undefined } };

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  httpClient: Stripe.createFetchHttpClient(),
  apiVersion: "2024-06-20",
});

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

// El plan local sale del mapa de prices de _shared/stripePlans.ts (el mismo que
// usa create-checkout-session) y, si el price no esta, del nombre del producto
// en Stripe en minusculas. Antes solo 'v2' ("TESTEO OPYNIO" en Stripe) tenia
// override: un producto llamado "Plan Growth" habria dado plan 'plan growth'.

// Stripe API 2025-03-31 movió current_period_* de subscription a subscription.items[0].
// Mientras estemos pinned a 2024-06-20 ambos formatos pueden existir. Preferimos el
// nuevo y caemos al viejo si no está. Si ambos faltan, lanzamos.
//
// Para suscripciones multi-item (raras en nuestro modelo, pero posibles si Stripe
// añade items administrativamente), usamos el `current_period_end` MAYOR de todos
// los items para que `plan_expires_at` refleje hasta cuándo está cubierto el user.
// El `current_period_start` lo tomamos del MÍNIMO (inicio más temprano).
function getPeriodTimestamps(subscription: Stripe.Subscription): {
  startISO: string;
  endISO: string;
} {
  const items = subscription.items?.data ?? [];
  if (items.length === 0) {
    throw new Error(`Subscription ${subscription.id} has no items`);
  }
  // deno-lint-ignore no-explicit-any
  const subAny = subscription as any;
  let minStart: number | undefined;
  let maxEnd: number | undefined;
  for (const it of items) {
    // deno-lint-ignore no-explicit-any
    const itAny = it as any;
    const s = itAny.current_period_start;
    const e = itAny.current_period_end;
    if (typeof s === "number") minStart = minStart === undefined ? s : Math.min(minStart, s);
    if (typeof e === "number") maxEnd = maxEnd === undefined ? e : Math.max(maxEnd, e);
  }
  // Fallback: si los items no traen los timestamps, usar los del nivel sub (formato viejo).
  if (typeof minStart !== "number") minStart = subAny.current_period_start;
  if (typeof maxEnd !== "number") maxEnd = subAny.current_period_end;
  if (typeof minStart !== "number" || typeof maxEnd !== "number") {
    throw new Error(
      `Subscription ${subscription.id}: current_period_start/end missing on items and subscription`
    );
  }
  return {
    startISO: new Date(minStart * 1000).toISOString(),
    endISO: new Date(maxEnd * 1000).toISOString(),
  };
}

// Devuelve true si el evento es nuevo (insertado), false si ya estaba procesado.
async function claimEvent(eventId: string, eventType: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("processed_webhook_events")
    .insert({ event_id: eventId, type: eventType })
    .select("event_id");
  if (error) {
    // 23505 = unique_violation → ya estaba procesado.
    // deno-lint-ignore no-explicit-any
    if ((error as any).code === "23505") return false;
    throw error;
  }
  return (data?.length ?? 0) > 0;
}

// Upsert defensivo de product+price desde un Stripe.Subscription.
// Usado por handlers que NO van por la RPC transaccional (subscription.updated/created,
// invoice.paid). Garantiza que la FK de subscriptions.price_id no falle.
async function upsertProductAndPrice(subscription: Stripe.Subscription): Promise<void> {
  const item = subscription.items.data[0];
  if (!item) throw new Error(`Subscription ${subscription.id} has no items`);
  const price = item.price;
  if (typeof price.product !== "string") {
    throw new Error(`Subscription ${subscription.id}: price.product is not a string id (was ${typeof price.product})`);
  }
  const product = await stripe.products.retrieve(price.product);

  const { error: prodErr } = await supabaseAdmin.from("products").upsert({
    id: product.id,
    active: product.active,
    name: product.name,
    description: product.description,
    metadata: product.metadata,
  });
  if (prodErr) throw prodErr;

  const { error: priceErr } = await supabaseAdmin.from("prices").upsert({
    id: price.id,
    product_id: price.product,
    active: price.active,
    unit_amount: price.unit_amount,
    currency: price.currency,
    type: price.type,
    interval: price.recurring?.interval,
    interval_count: price.recurring?.interval_count,
    metadata: price.metadata,
  });
  if (priceErr) throw priceErr;
}

// Resuelve plan + billing cycle desde una Stripe.Subscription. Si el price/product
// no está aún en BD, lo upserta desde Stripe.
async function resolvePlanFromSubscription(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0];
  if (!item) throw new Error(`Subscription ${subscription.id} has no items`);
  const priceId = item.price.id;

  let { data: priceRow, error: priceQueryErr } = await supabaseAdmin
    .from("prices")
    .select("products(name)")
    .eq("id", priceId)
    .maybeSingle();
  if (priceQueryErr) throw priceQueryErr;

  if (!priceRow) {
    await upsertProductAndPrice(subscription);
    const refetch = await supabaseAdmin
      .from("prices")
      .select("products(name)")
      .eq("id", priceId)
      .maybeSingle();
    if (refetch.error) throw refetch.error;
    priceRow = refetch.data;
  }

  const productName = (priceRow?.products as { name: string } | null)?.name ?? "";
  const planName = productName ? planNameFromPrice(priceId, productName) : null;
  const billingCycle = item.price.recurring?.interval === "month" ? "monthly" : "annual";
  return { planName, billingCycle };
}

// Suscripciones vivas (active/trialing/past_due) del usuario en la BD.
// select('*'): la fecha es `created` en produccion y `created_at` en local.
async function liveSubscriptionRows(userId: string): Promise<SubscriptionRow[]> {
  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .in("status", [...LIVE_SUBSCRIPTION_STATUSES]);
  if (error) throw error;
  return (data ?? []) as SubscriptionRow[];
}

// Escribe en el perfil el plan de `subscription`, salvo que el usuario tenga
// otra suscripcion viva mas reciente (ver subscriptionSync.ts): la renovacion o
// el cambio de una suscripcion antigua no debe pisar el plan de la nueva.
async function syncProfileFromSubscription(
  subscription: Stripe.Subscription,
  userId: string,
  endISO: string,
  eventLabel: string,
): Promise<void> {
  const rows = await liveSubscriptionRows(userId);
  if (!shouldSyncProfile(subscription.id, rows)) {
    console.warn(
      `⚠️  ${eventLabel}: sub ${subscription.id} no es la suscripcion principal del usuario ${userId} ` +
        `(tiene ${rows.length} vivas); no se toca el plan del perfil.`
    );
    return;
  }
  const { planName, billingCycle } = await resolvePlanFromSubscription(subscription);
  if (!planName) return;
  const { error: profErr } = await supabaseAdmin
    .from("profiles")
    .update({ plan: planName, billing_cycle: billingCycle, plan_expires_at: endISO })
    .eq("id", userId);
  if (profErr) throw profErr;
}

// -----------------------------------------------------------------------------
// Meta Conversions API (server-side Purchase event, dedup vía event_id con Pixel cliente)
// -----------------------------------------------------------------------------

const META_PIXEL_ID = "1280166973678477";

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.trim().toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sendMetaPurchase(params: {
  eventId: string;
  email?: string | null;
  userId: string;
  value: number;
  currency: string;
  sourceUrl?: string;
}) {
  const token = Deno.env.get("META_CAPI_TOKEN");
  if (!token) {
    console.warn("[meta-capi] META_CAPI_TOKEN not set, skipping Purchase event");
    return;
  }
  try {
    const user_data: Record<string, unknown> = {
      external_id: [await sha256Hex(params.userId)],
    };
    if (params.email) {
      user_data.em = [await sha256Hex(params.email)];
    }

    const payload = {
      data: [
        {
          event_name: "Purchase",
          event_time: Math.floor(Date.now() / 1000),
          event_id: params.eventId,
          action_source: "website",
          event_source_url: params.sourceUrl,
          user_data,
          custom_data: {
            currency: params.currency.toUpperCase(),
            value: params.value,
          },
        },
      ],
    };

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      console.error("[meta-capi] Purchase failed", res.status, await res.text());
    } else {
      console.log(`[meta-capi] Purchase sent (event_id=${params.eventId}, value=${params.value} ${params.currency})`);
    }
  } catch (err) {
    console.error("[meta-capi] Purchase exception", err);
  }
}

// -----------------------------------------------------------------------------
// Main handler
// -----------------------------------------------------------------------------

serve(async (req) => {
  const signature = req.headers.get("Stripe-Signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      Deno.env.get("STRIPE_WEBHOOK_SIGNING_SECRET")!
    );
  } catch (err) {
    // deno-lint-ignore no-explicit-any
    console.error("Webhook signature verification failed.", (err as any).message);
    return new Response("invalid signature", { status: 400 });
  }

  try {
    // Idempotency guard: si el event.id ya está registrado, descartamos.
    const isNew = await claimEvent(event.id, event.type);
    if (!isNew) {
      console.log(`↩️  duplicate event ${event.id} (${event.type}) — skipping`);
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
      });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        );
        const userId = session.metadata?.supabase_user_id;
        const isNewBusiness = session.metadata?.is_new_business === "true";
        const existingBusinessId = session.metadata?.business_id;

        if (!userId) {
          throw new Error("Metadata 'supabase_user_id' missing in checkout session.");
        }
        if (!isNewBusiness && !existingBusinessId) {
          throw new Error(
            "Metadata missing 'business_id' for existing-business upgrade."
          );
        }

        // already_processed evita crear la empresa dos veces si este mismo
        // checkout se reintenta (la RPC ya hizo commit pero algo posterior fallo
        // y se libero el claim del evento).
        //
        // Antes se decidia mirando si existia la fila en `subscriptions`. Pero
        // customer.subscription.created suele llegar ANTES que este evento y
        // hace upsert de esa fila: el checkout se daba por procesado y la
        // empresa pagada no se creaba nunca (el cliente quedaba business_owner
        // de pago y sin empresa). Reproducido simulando ese orden en la BD.
        //
        // La senal correcta es si la EMPRESA de este checkout ya existe: mismo
        // dueno, mismo nombre, creada despues de abrir la sesion de pago.
        //
        // El nombre puede llevar sufijo " (2)", " (3)"... o el de ultimo recurso
        // con el id de la suscripcion si chocaba con otra empresa
        // (checkoutCompletion.ts): se aceptan todos los candidatos, o el
        // reintento crearia "Nombre (3)" al no encontrar "Nombre".
        let alreadyProcessed = false;
        if (isNewBusiness) {
          const candidates = new Set(businessNameCandidates(session.metadata?.business_name ?? "", subscription.id));
          const sessionCreatedISO = new Date(session.created * 1000).toISOString();
          const { data: ownBizs, error: existingBizErr } = await supabaseAdmin
            .from("businesses")
            .select("id, name")
            .eq("owner_id", userId)
            .gte("created_at", sessionCreatedISO)
            .limit(50);
          if (existingBizErr) throw existingBizErr;
          alreadyProcessed = (ownBizs ?? []).some((b) => candidates.has(b.name));
        }

        const item = subscription.items.data[0];
        if (!item) throw new Error(`Subscription ${subscription.id} has no items`);
        const price = item.price;
        if (typeof price.product !== "string") {
          throw new Error(`Subscription ${subscription.id}: price.product is not a string id`);
        }
        const product = await stripe.products.retrieve(price.product);

        const { startISO, endISO } = getPeriodTimestamps(subscription);
        const planName = planNameFromPrice(price.id, product.name);
        const billingCycle = price.recurring?.interval === "month" ? "monthly" : "annual";

        // Si la URL de Maps o el nombre ya los tiene otra empresa (UNIQUE ->
        // 23505), se reintenta sin la URL o con el nombre "X (2)" en vez de
        // dejar al cliente cobrado y sin empresa (ver checkoutCompletion.ts).
        // El resto de errores, igual que antes.
        const { error: rpcError, droppedGoogleMapsUrl, renamedBusinessTo } = await runCheckoutCompletion(
          (fn, params) => supabaseAdmin.rpc(fn, params),
          {
            p_subscription_id: subscription.id,
            p_user_id: userId,
            p_status: subscription.status,
            p_price_id: price.id,
            p_cancel_at_period_end: subscription.cancel_at_period_end,
            p_current_period_start: startISO,
            p_current_period_end: endISO,
            p_product_id: product.id,
            p_product_name: product.name,
            p_product_active: product.active,
            p_product_description: product.description,
            p_product_metadata: product.metadata,
            p_price_active: price.active,
            p_price_unit_amount: price.unit_amount,
            p_price_currency: price.currency,
            p_price_type: price.type,
            p_price_interval: price.recurring?.interval ?? null,
            p_price_interval_count: price.recurring?.interval_count ?? null,
            p_price_metadata: price.metadata,
            p_plan_name: planName,
            p_billing_cycle: billingCycle,
            p_is_new_business: isNewBusiness,
            p_already_processed: alreadyProcessed,
            p_business_name: session.metadata?.business_name ?? null,
            p_business_category: session.metadata?.business_category ?? null,
            p_business_country: session.metadata?.business_country ?? null,
            p_business_description: session.metadata?.business_description ?? null,
            p_business_logo_url: session.metadata?.business_logo_url ?? null,
            p_business_google_maps_url:
              session.metadata?.business_google_maps_url ?? null,
            // Validamos rango antes de pasar a la RPC. Coordenadas fuera de rango
            // (cliente malicioso o bug en frontend) se descartan a NULL en lugar de
            // contaminar la BD.
            p_business_latitude: (() => {
              const v = session.metadata?.business_latitude;
              if (!v) return null;
              const n = Number(v);
              return Number.isFinite(n) && n >= -90 && n <= 90 ? n : null;
            })(),
            p_business_longitude: (() => {
              const v = session.metadata?.business_longitude;
              if (!v) return null;
              const n = Number(v);
              return Number.isFinite(n) && n >= -180 && n <= 180 ? n : null;
            })(),
          },
          (message) => console.warn(`${message} [event ${event.id}]`),
        );
        if (rpcError) throw rpcError;

        console.log(
          `✅ checkout.session.completed: plan='${planName}' user=${userId} new_business=${isNewBusiness} retry=${alreadyProcessed}` +
            (droppedGoogleMapsUrl ? ` google_maps_url_descartada=${droppedGoogleMapsUrl}` : "") +
            (renamedBusinessTo ? ` empresa_creada_como="${renamedBusinessTo}"` : "")
        );

        // Meta CAPI - Purchase (server-side). event_id = session.id se comparte con el
        // Pixel cliente en /pago-exitoso para que Meta deduplique cliente↔servidor.
        const purchaseValue = (price.unit_amount ?? 0) / 100;
        await sendMetaPurchase({
          eventId: session.id,
          email: session.customer_details?.email ?? session.customer_email ?? null,
          userId,
          value: purchaseValue,
          currency: price.currency || "eur",
          sourceUrl: session.success_url ?? undefined,
        });
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await upsertProductAndPrice(subscription);

        const { startISO, endISO } = getPeriodTimestamps(subscription);

        // Necesitamos user_id. Si la sub ya está en BD, lo leemos. Si no, lo
        // resolvemos por customer → customers.id.
        let userId: string | null = null;
        const { data: existing } = await supabaseAdmin
          .from("subscriptions")
          .select("user_id")
          .eq("id", subscription.id)
          .maybeSingle();
        if (existing?.user_id) {
          userId = existing.user_id;
        } else {
          const { data: customer } = await supabaseAdmin
            .from("customers")
            .select("id")
            .eq("stripe_customer_id", subscription.customer as string)
            .maybeSingle();
          userId = customer?.id ?? null;
        }

        if (!userId) {
          // No podemos asociar la sub a ningún usuario nuestro. Probablemente
          // creada manualmente desde el Stripe Dashboard. Logueamos y salimos
          // sin error: el evento se queda marcado como procesado.
          console.warn(
            `⚠️  ${event.type}: cannot resolve user_id for sub ${subscription.id} (customer=${subscription.customer}).`
          );
          break;
        }

        const { error: subUpsertErr } = await supabaseAdmin
          .from("subscriptions")
          .upsert({
            id: subscription.id,
            user_id: userId,
            status: subscription.status,
            price_id: subscription.items.data[0].price.id,
            cancel_at_period_end: subscription.cancel_at_period_end,
            current_period_start: startISO,
            current_period_end: endISO,
          });
        if (subUpsertErr) throw subUpsertErr;

        // Si la sub está activa/trialing, sincronizamos el plan en profile
        // (solo si es la suscripcion principal del usuario: subscriptionSync.ts).
        // Si está en estados terminales (canceled, unpaid, incomplete_expired),
        // la sincronización de baja la maneja customer.subscription.deleted.
        if (
          subscription.status === "active" ||
          subscription.status === "trialing" ||
          subscription.status === "past_due"
        ) {
          await syncProfileFromSubscription(subscription, userId, endISO, event.type);
        }

        console.log(`✅ ${event.type}: ${subscription.id} (status=${subscription.status})`);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string | null;
        if (!subscriptionId) {
          console.log("invoice.paid: no subscription attached, ignoring.");
          break;
        }
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await upsertProductAndPrice(subscription);

        const { startISO, endISO } = getPeriodTimestamps(subscription);

        // Buscamos user_id existente; si no, resolvemos por customer.
        let userId: string | null = null;
        const { data: subRow } = await supabaseAdmin
          .from("subscriptions")
          .select("user_id")
          .eq("id", subscription.id)
          .maybeSingle();
        if (subRow?.user_id) {
          userId = subRow.user_id;
        } else {
          const { data: customer } = await supabaseAdmin
            .from("customers")
            .select("id")
            .eq("stripe_customer_id", subscription.customer as string)
            .maybeSingle();
          userId = customer?.id ?? null;
        }

        if (!userId) {
          console.warn(
            `⚠️  invoice.paid: cannot resolve user_id for sub ${subscription.id}.`
          );
          break;
        }

        // UPSERT (no UPDATE) → si la sub no estaba en BD, la creamos.
        const { error: subUpsertErr } = await supabaseAdmin
          .from("subscriptions")
          .upsert({
            id: subscription.id,
            user_id: userId,
            status: subscription.status,
            price_id: subscription.items.data[0].price.id,
            cancel_at_period_end: subscription.cancel_at_period_end,
            current_period_start: startISO,
            current_period_end: endISO,
          });
        if (subUpsertErr) throw subUpsertErr;

        // La renovacion de una suscripcion antigua no pisa el plan de la
        // principal (subscriptionSync.ts).
        await syncProfileFromSubscription(subscription, userId, endISO, "invoice.paid");

        console.log(`✅ invoice.paid: synced sub ${subscription.id} for user ${userId}.`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string | null;
        if (!subscriptionId) {
          console.log("invoice.payment_failed: no subscription attached, ignoring.");
          break;
        }
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        // Reflejamos el estado de Stripe (past_due / unpaid). El downgrade a free
        // lo dispara customer.subscription.deleted al final del dunning.
        const { error: updateErr } = await supabaseAdmin
          .from("subscriptions")
          .update({ status: subscription.status })
          .eq("id", subscription.id);
        if (updateErr) throw updateErr;

        console.warn(
          `⚠️  invoice.payment_failed: sub ${subscription.id} marked '${subscription.status}'.`
        );
        break;
      }

      case "checkout.session.async_payment_succeeded": {
        // Para métodos asíncronos (SEPA, Bizum, transferencia) Stripe emite este
        // evento cuando el pago finalmente se confirma. Lo tratamos como un
        // checkout.session.completed tardío: si la sub aún no está sincronizada,
        // delegamos en el mismo handler.
        const session = event.data.object as Stripe.Checkout.Session;
        if (!session.subscription) {
          console.log("async_payment_succeeded: no subscription attached, ignoring.");
          break;
        }
        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        );
        await upsertProductAndPrice(subscription);

        const { startISO, endISO } = getPeriodTimestamps(subscription);
        const userId = session.metadata?.supabase_user_id;
        if (!userId) {
          console.warn(
            `async_payment_succeeded: no supabase_user_id in metadata for sub ${subscription.id}.`
          );
          break;
        }

        const { error: subUpsertErr } = await supabaseAdmin
          .from("subscriptions")
          .upsert({
            id: subscription.id,
            user_id: userId,
            status: subscription.status,
            price_id: subscription.items.data[0].price.id,
            cancel_at_period_end: subscription.cancel_at_period_end,
            current_period_start: startISO,
            current_period_end: endISO,
          });
        if (subUpsertErr) throw subUpsertErr;

        await syncProfileFromSubscription(subscription, userId, endISO, event.type);

        console.log(`✅ async_payment_succeeded: synced sub ${subscription.id} for user ${userId}.`);
        break;
      }

      case "checkout.session.async_payment_failed": {
        // El pago asíncrono no se completó. NO promovemos plan ni creamos
        // negocio: el flujo `checkout.session.completed` no ha disparado
        // todavía y posiblemente no lo haga. Sólo logueamos.
        const session = event.data.object as Stripe.Checkout.Session;
        console.warn(
          `⚠️  async_payment_failed: session ${session.id} (customer=${session.customer}).`
        );
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        const { error: subErr } = await supabaseAdmin
          .from("subscriptions")
          .update({ status: "canceled", ended_at: new Date().toISOString() })
          .eq("id", subscription.id);
        if (subErr) throw subErr;

        const { data: subRow } = await supabaseAdmin
          .from("subscriptions")
          .select("user_id")
          .eq("id", subscription.id)
          .maybeSingle();
        if (!subRow) {
          console.warn(
            `customer.subscription.deleted: sub ${subscription.id} not found locally.`
          );
          break;
        }

        // Solo se baja a free si no le queda otra suscripcion viva. Antes, un
        // usuario con dos (p. ej. la vieja y la del cambio de plan) bajaba a free
        // al cancelar cualquiera aunque siguiera pagando la otra. La que queda se
        // comprueba contra Stripe: si la fila local estaba desfasada (se perdio
        // su deleted), se corrige y se mira la siguiente.
        const fetched = new Map<string, Stripe.Subscription>();
        const { primary: remaining, stale } = await pickRemainingPrimary(
          await liveSubscriptionRows(subRow.user_id),
          subscription.id,
          async (id) => {
            try {
              const real = await stripe.subscriptions.retrieve(id);
              fetched.set(id, real);
              return real.status;
            } catch (err) {
              // deno-lint-ignore no-explicit-any
              if ((err as any)?.code === "resource_missing") return null;
              throw err;
            }
          },
        );
        for (const s of stale) {
          // El enum subscription_status de la BD no tiene todos los estados de
          // Stripe (p. ej. 'paused'): lo que no conoce se guarda como canceled.
          const dbStatus = ["canceled", "incomplete", "incomplete_expired", "unpaid"].includes(s.status ?? "")
            ? s.status
            : "canceled";
          const { error: staleErr } = await supabaseAdmin
            .from("subscriptions")
            .update({ status: dbStatus })
            .eq("id", s.id);
          if (staleErr) throw staleErr;
          console.warn(`⚠️  customer.subscription.deleted: sub ${s.id} marcada viva en BD pero en Stripe es '${s.status ?? "inexistente"}'; corregida a '${dbStatus}'.`);
        }

        const other = remaining ? fetched.get(remaining.id) : undefined;
        if (remaining && other) {
          const { endISO: otherEnd } = getPeriodTimestamps(other);
          const { planName, billingCycle } = await resolvePlanFromSubscription(other);
          if (planName) {
            const { error: profErr } = await supabaseAdmin
              .from("profiles")
              .update({ plan: planName, billing_cycle: billingCycle, plan_expires_at: otherEnd })
              .eq("id", subRow.user_id);
            if (profErr) throw profErr;
          }
          console.log(
            `✅ customer.subscription.deleted: ${subscription.id}; el usuario ${subRow.user_id} conserva la sub ${remaining.id} (plan='${planName}').`
          );
          break;
        }

        const { error: profErr } = await supabaseAdmin
          .from("profiles")
          .update({ plan: "free", billing_cycle: null, plan_expires_at: null })
          .eq("id", subRow.user_id);
        if (profErr) throw profErr;

        console.log(`✅ customer.subscription.deleted: ${subscription.id}.`);
        break;
      }

      default:
        console.log(`🤷 Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error) {
    // Si fallamos, borramos el lock de idempotencia para que Stripe pueda
    // reintentar y se reprocese el evento desde cero. El detalle del error
    // queda en logs, no se filtra al exterior.
    console.error(`Webhook handler failed for event ${event.id} (${event.type}):`, error);
    try {
      await supabaseAdmin
        .from("processed_webhook_events")
        .delete()
        .eq("event_id", event.id);
    } catch (cleanupErr) {
      console.error("Failed to release idempotency lock:", cleanupErr);
    }
    return new Response("internal error", { status: 500 });
  }
});
