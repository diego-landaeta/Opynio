// supabase/functions/repair-stripe-orphans/index.ts
//
// Edge Function de reconciliación: para cada `customer` en BD, lista sus
// suscripciones en Stripe y rellena `products/prices/subscriptions`.
// También sincroniza `profiles.plan/billing_cycle/plan_expires_at` con la
// suscripción activa.
//
// Casos de uso:
//   • Reparar usuarios huérfanos (profile.plan != 'free' sin fila en
//     subscriptions) cuando el webhook falló históricamente.
//   • Resincronización tras restaurar BD desde backup.
//
// Invocación:
//   POST https://<project>.supabase.co/functions/v1/repair-stripe-orphans
//   Authorization: Bearer <JWT de un usuario admin>
//
// Sólo admins pueden invocar (verifica profile.role = 'admin' en BD).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@^16.2.0?target=deno&no-check";

declare const Deno: { env: { get: (key: string) => string | undefined } };

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  httpClient: Stripe.createFetchHttpClient(),
  apiVersion: "2024-06-20",
});

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Para subs multi-item: usa min(start) y max(end) de todos los items para
// reflejar correctamente hasta cuándo está cubierto el plan.
function getPeriodTimestamps(subscription: Stripe.Subscription): {
  startISO: string;
  endISO: string;
} {
  const items = subscription.items?.data ?? [];
  if (items.length === 0) throw new Error(`Subscription ${subscription.id} has no items`);
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
  if (typeof minStart !== "number") minStart = subAny.current_period_start;
  if (typeof maxEnd !== "number") maxEnd = subAny.current_period_end;
  if (typeof minStart !== "number" || typeof maxEnd !== "number") {
    throw new Error(`Subscription ${subscription.id}: missing period timestamps`);
  }
  return {
    startISO: new Date(minStart * 1000).toISOString(),
    endISO: new Date(maxEnd * 1000).toISOString(),
  };
}

async function syncSubscription(
  userId: string,
  subscription: Stripe.Subscription
): Promise<{ planName: string | null; billingCycle: string }> {
  const item = subscription.items.data[0];
  if (!item) throw new Error(`Subscription ${subscription.id} has no items`);
  const price = item.price;
  if (typeof price.product !== "string") {
    throw new Error(`Subscription ${subscription.id}: price.product is not a string id`);
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

  const { startISO, endISO } = getPeriodTimestamps(subscription);

  const { error: subErr } = await supabaseAdmin.from("subscriptions").upsert({
    id: subscription.id,
    user_id: userId,
    status: subscription.status,
    price_id: price.id,
    cancel_at_period_end: subscription.cancel_at_period_end,
    current_period_start: startISO,
    current_period_end: endISO,
  });
  if (subErr) throw subErr;

  // Defensa: si el producto en Stripe no tiene name (raro pero válido), usamos
  // un placeholder en lugar de crashear con TypeError.
  const planName = product.name ? product.name.toLowerCase() : "unknown";
  const billingCycle = price.recurring?.interval === "month" ? "monthly" : "annual";

  // Si la sub está activa/trialing/past_due, sincronizamos profile.
  if (
    subscription.status === "active" ||
    subscription.status === "trialing" ||
    subscription.status === "past_due"
  ) {
    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .update({
        plan: planName,
        billing_cycle: billingCycle,
        plan_expires_at: endISO,
      })
      .eq("id", userId);
    if (profErr) throw profErr;
  }

  return { planName, billingCycle };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verificamos que el caller es admin.
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (callerProfile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Body opcional: { user_id?: string } para reparar un solo usuario.
    // Validamos formato UUID para evitar queries silenciosas con strings inválidos.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let targetUserId: string | undefined;
    try {
      const body = await req.json();
      if (body && typeof body.user_id === "string") {
        if (!UUID_RE.test(body.user_id)) {
          return new Response(JSON.stringify({ error: "user_id debe ser un UUID válido" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        targetUserId = body.user_id;
      }
    } catch (_) {
      // body vacío → reparamos a todos los customers conocidos.
    }

    let q = supabaseAdmin.from("customers").select("id, stripe_customer_id");
    if (targetUserId) q = q.eq("id", targetUserId);
    const { data: customers, error: customersErr } = await q;
    if (customersErr) throw customersErr;

    const report: Array<{
      user_id: string;
      stripe_customer_id: string;
      synced: number;
      skipped: number;
      error?: string;
    }> = [];

    for (const c of customers ?? []) {
      const entry = {
        user_id: c.id,
        stripe_customer_id: c.stripe_customer_id,
        synced: 0,
        skipped: 0,
      } as (typeof report)[number];

      try {
        // Pagination: iteramos hasta agotar todas las páginas. Stripe devuelve
        // hasta 100 por petición y un `has_more` para saber si quedan más.
        let starting_after: string | undefined;
        let totalProcessed = 0;
        const MAX_ITERATIONS = 50; // safety: hasta 5000 subs por customer
        for (let i = 0; i < MAX_ITERATIONS; i++) {
          const subs = await stripe.subscriptions.list({
            customer: c.stripe_customer_id,
            status: "all",
            limit: 100,
            ...(starting_after ? { starting_after } : {}),
          });

          for (const sub of subs.data) {
            // Sólo sincronizamos las que importan: active, trialing, past_due, canceled.
            if (
              sub.status === "incomplete" ||
              sub.status === "incomplete_expired"
            ) {
              entry.skipped++;
              continue;
            }
            await syncSubscription(c.id, sub);
            totalProcessed++;
          }

          if (!subs.has_more) break;
          starting_after = subs.data[subs.data.length - 1]?.id;
          if (!starting_after) break;
        }
        entry.synced = totalProcessed;
      } catch (err) {
        // deno-lint-ignore no-explicit-any
        entry.error = (err as any)?.message ?? String(err);
      }
      report.push(entry);
    }

    return new Response(JSON.stringify({ ok: true, report }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("repair-stripe-orphans failed:", error);
    return new Response(JSON.stringify({ error: "internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
