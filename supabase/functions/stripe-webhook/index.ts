// supabase/functions/stripe-webhook/index.ts

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@^16.2.0?target=deno&no-check";

// Type declarations for Deno environment
declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  httpClient: Stripe.createFetchHttpClient(),
  apiVersion: "2024-06-20",
});

// Initialize Supabase admin client
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Resolve the local plan name + billing cycle from a Stripe subscription.
// If the price/product is not in our local tables yet (e.g. subscription.updated arriving
// before checkout.session.completed), upsert them from Stripe so subsequent lookups succeed.
async function resolvePlanFromSubscription(subscription: Stripe.Subscription) {
  const priceItem = subscription.items.data[0].price;
  const priceId = priceItem.id;

  let { data: priceRow } = await supabaseAdmin
    .from("prices")
    .select("products(name)")
    .eq("id", priceId)
    .maybeSingle();

  if (!priceRow) {
    const product = await stripe.products.retrieve(priceItem.product as string);

    const { error: productUpsertError } = await supabaseAdmin.from("products").upsert({
      id: product.id,
      active: product.active,
      name: product.name,
      description: product.description,
      metadata: product.metadata,
    });
    if (productUpsertError) throw productUpsertError;

    const { error: priceUpsertError } = await supabaseAdmin.from("prices").upsert({
      id: priceItem.id,
      product_id: priceItem.product as string,
      active: priceItem.active,
      unit_amount: priceItem.unit_amount,
      currency: priceItem.currency,
      type: priceItem.type,
      interval: priceItem.recurring?.interval,
      interval_count: priceItem.recurring?.interval_count,
      metadata: priceItem.metadata,
    });
    if (priceUpsertError) throw priceUpsertError;

    priceRow = { products: { name: product.name } } as any;
  }

  const planName = (priceRow!.products as { name: string } | null)?.name?.toLowerCase() ?? null;
  const billingCycle = priceItem.recurring?.interval === 'month' ? 'monthly' : 'annual';

  return { planName, billingCycle };
}

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
    console.error("Webhook signature verification failed.", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        const userId = session.metadata?.supabase_user_id;
        const isNewBusiness = session.metadata?.is_new_business === 'true';
        const existingBusinessId = session.metadata?.business_id;

        if (!userId) {
          throw new Error("Metadata 'supabase_user_id' missing in checkout session.");
        }

        // Idempotency guard: if this subscription is already in our DB, the event was
        // already processed (Stripe retries deliveries). Skip the side effects.
        const { data: existingSub } = await supabaseAdmin
          .from("subscriptions")
          .select("id")
          .eq("id", subscription.id)
          .maybeSingle();
        const alreadyProcessed = !!existingSub;

        const price = subscription.items.data[0].price;
        const product = await stripe.products.retrieve(price.product as string);

        // Upsert product and price info (always safe).
        await supabaseAdmin.from("products").upsert({
            id: product.id, active: product.active, name: product.name,
            description: product.description, metadata: product.metadata,
        });
        await supabaseAdmin.from("prices").upsert({
            id: price.id, product_id: price.product as string, active: price.active,
            unit_amount: price.unit_amount, currency: price.currency, type: price.type,
            interval: price.recurring?.interval, interval_count: price.recurring?.interval_count,
            metadata: price.metadata,
        });

        // Subscription upsert.
        const { error: subError } = await supabaseAdmin.from("subscriptions").upsert({
          id: subscription.id,
          user_id: userId,
          status: subscription.status,
          price_id: subscription.items.data[0].price.id,
          cancel_at_period_end: subscription.cancel_at_period_end,
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        });
        if (subError) throw subError;

        const planName = product.name.toLowerCase();
        const billingCycle = subscription.items.data[0].price.recurring?.interval === 'month' ? 'monthly' : 'annual';
        const periodEndIso = new Date(subscription.current_period_end * 1000).toISOString();

        // For NEW business flow: defer business creation to here. Skip if this is a retry
        // (subscription row pre-existed before this handler ran).
        if (isNewBusiness && !alreadyProcessed) {
          const lat = session.metadata?.business_latitude;
          const lng = session.metadata?.business_longitude;
          const country = session.metadata?.business_country ?? null;
          const { error: insertError } = await supabaseAdmin.from("businesses").insert({
            owner_id: userId,
            name: session.metadata?.business_name ?? '',
            category: session.metadata?.business_category ?? null,
            country,
            description: session.metadata?.business_description ?? null,
            logo_url: session.metadata?.business_logo_url ?? null,
            google_maps_url: session.metadata?.business_google_maps_url ?? null,
            latitude: lat ? Number(lat) : null,
            longitude: lng ? Number(lng) : null,
            sedes: country ? [{ country_code: country }] : null,
          });
          if (insertError) throw insertError;
        } else if (!isNewBusiness && !existingBusinessId) {
          throw new Error("Metadata missing 'business_id' for existing-business upgrade.");
        }

        // Activate plan on the user's profile (and promote role for new owners).
        const profileUpdate: Record<string, unknown> = {
          plan: planName,
          billing_cycle: billingCycle,
          plan_expires_at: periodEndIso,
        };
        if (isNewBusiness) profileUpdate.role = 'business_owner';

        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .update(profileUpdate)
          .eq("id", userId);
        if (profileError) throw profileError;

        console.log(`✅ checkout.session.completed: plan='${planName}' user=${userId} new_business=${isNewBusiness} retry=${alreadyProcessed}`);
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

        const { error: updateError } = await supabaseAdmin.from("subscriptions").update({
            status: subscription.status,
            price_id: subscription.items.data[0].price.id,
            cancel_at_period_end: subscription.cancel_at_period_end,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        }).eq("id", subscription.id);
        if (updateError) throw updateError;

        const { data: subData } = await supabaseAdmin.from("subscriptions").select("user_id").eq("id", subscription.id).maybeSingle();
        if (subData?.user_id) {
            // On renewal also re-sync plan + billing_cycle so an upgrade/downgrade applied
            // mid-cycle is reflected in the profile when the next invoice is paid.
            const { planName, billingCycle } = await resolvePlanFromSubscription(subscription);
            await supabaseAdmin.from("profiles").update({
                plan: planName ?? undefined,
                billing_cycle: billingCycle,
                plan_expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
            }).eq("id", subData.user_id);
        } else {
            console.warn(`invoice.paid: subscription ${subscription.id} not found locally, skipping profile update.`);
        }

        console.log(`✅ invoice.paid: Updated subscription period for ${subscription.id}.`);
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

        // Mirror Stripe's status (typically 'past_due' or 'unpaid'). Stripe will keep retrying
        // for the dunning window and finally emit customer.subscription.deleted, which is what
        // actually downgrades the user to free. Until then we just record the status.
        const { error: updateError } = await supabaseAdmin.from("subscriptions").update({
            status: subscription.status,
        }).eq("id", subscription.id);
        if (updateError) throw updateError;

        console.warn(`⚠️ invoice.payment_failed: subscription ${subscription.id} marked '${subscription.status}'.`);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const { error: subUpdateError } = await supabaseAdmin.from("subscriptions").update({
          status: subscription.status,
          price_id: subscription.items.data[0].price.id,
          cancel_at_period_end: subscription.cancel_at_period_end,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        }).eq("id", subscription.id);
        if (subUpdateError) throw subUpdateError;

        const { planName, billingCycle } = await resolvePlanFromSubscription(subscription);

        const { data: sub } = await supabaseAdmin.from("subscriptions").select("user_id").eq("id", subscription.id).maybeSingle();
        if (!sub) {
          console.warn(`customer.subscription.updated: subscription ${subscription.id} not found locally, skipping profile update.`);
          break;
        }

        await supabaseAdmin.from("profiles").update({
            plan: planName ?? undefined,
            billing_cycle: billingCycle,
            plan_expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
        }).eq("id", sub.user_id);

        console.log(`✅ customer.subscription.updated: Updated subscription ${subscription.id}.`);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        const { error: deleteSubError } = await supabaseAdmin.from("subscriptions").update({
            status: 'canceled',
            ended_at: new Date().toISOString()
        }).eq("id", subscription.id);
        if (deleteSubError) throw deleteSubError;

        const { data: sub } = await supabaseAdmin.from("subscriptions").select("user_id").eq("id", subscription.id).maybeSingle();
        if (!sub) {
          console.warn(`customer.subscription.deleted: subscription ${subscription.id} not found locally, skipping profile downgrade.`);
          break;
        }

        await supabaseAdmin.from("profiles").update({
            plan: 'free',
            billing_cycle: null,
            plan_expires_at: null,
        }).eq("id", sub.user_id);

        console.log(`✅ customer.subscription.deleted: Canceled subscription ${subscription.id}.`);
        break;
      }

      default:
        console.log(`🤷‍♀️ Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error) {
    console.error("Webhook handler failed:", error);
    return new Response(`Webhook Error: ${error.message}`, { status: 400 });
  }
});
