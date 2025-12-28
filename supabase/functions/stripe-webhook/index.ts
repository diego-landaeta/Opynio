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
        const businessId = session.metadata?.business_id;
        const userId = session.metadata?.supabase_user_id;
        
        if (!businessId || !userId) {
          throw new Error("Metadata 'business_id' or 'supabase_user_id' missing in checkout session.");
        }

        const price = subscription.items.data[0].price;
        const product = await stripe.products.retrieve(price.product as string);

        // Upsert product and price info to our DB to ensure it exists
        const { error: productUpsertError } = await supabaseAdmin.from("products").upsert({
            id: product.id,
            active: product.active,
            name: product.name,
            description: product.description,
            metadata: product.metadata,
        });
        if (productUpsertError) throw productUpsertError;

        const { error: priceUpsertError } = await supabaseAdmin.from("prices").upsert({
            id: price.id,
            product_id: price.product as string,
            active: price.active,
            unit_amount: price.unit_amount,
            currency: price.currency,
            type: price.type,
            interval: price.recurring?.interval,
            interval_count: price.recurring?.interval_count,
            metadata: price.metadata,
        });
        if (priceUpsertError) throw priceUpsertError;

        // 1. Insert into our subscriptions table
        const { error: subError } = await supabaseAdmin.from("subscriptions").insert({
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
        
        // 3. Update the user's profile with the new plan details
        const { error: profileError } = await supabaseAdmin.from("profiles").update({
          plan: planName,
          billing_cycle: subscription.items.data[0].price.recurring?.interval === 'month' ? 'monthly' : 'annual',
          plan_expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
        }).eq("id", userId);

        if (profileError) throw profileError;
        
        console.log(`✅ checkout.session.completed: Successfully activated plan '${planName}' for user ${userId}.`);
        break;
      }
      
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        const subscriptionUpdate = {
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        };

        const { error: updateError } = await supabaseAdmin.from("subscriptions").update(subscriptionUpdate).eq("id", subscription.id);
        if (updateError) throw updateError;
        
        // Also update the user's profile expiry date
        const { data: subData } = await supabaseAdmin.from("subscriptions").select("user_id").eq("id", subscription.id).single();
        if (subData) {
            await supabaseAdmin.from("profiles").update({
                plan_expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
            }).eq("id", subData.user_id);
        }
        
        console.log(`✅ invoice.paid: Updated subscription period for ${subscription.id}.`);
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

        const { data: priceData } = await supabaseAdmin.from("prices").select("products(name)").eq("id", subscription.items.data[0].price.id).single();
        if (!priceData) throw new Error("Price not found in DB for update");
        const planName = (priceData.products as { name: string })?.name.toLowerCase();

        const { data: sub } = await supabaseAdmin.from("subscriptions").select("user_id").eq("id", subscription.id).single();
        if (!sub) throw new Error("Subscription not found for user lookup");
        
        await supabaseAdmin.from("profiles").update({
            plan: planName,
            billing_cycle: subscription.items.data[0].price.recurring?.interval === 'month' ? 'monthly' : 'annual',
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
        
        const { data: sub } = await supabaseAdmin.from("subscriptions").select("user_id").eq("id", subscription.id).single();
        if (!sub) throw new Error("Subscription not found for user lookup");
        
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