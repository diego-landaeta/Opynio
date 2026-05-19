// supabase/functions/meta-capi/index.ts
// Relay endpoint for Meta Conversions API.
// Frontend calls this with event_name, event_id, user_data (already hashed
// on the client) and custom_data. We forward to graph.facebook.com using
// META_CAPI_TOKEN stored as a Supabase Secret.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

declare const Deno: {
  env: { get: (key: string) => string | undefined };
};

const META_PIXEL_ID = "1280166973678477";
const META_GRAPH_URL = `https://graph.facebook.com/v21.0/${META_PIXEL_ID}/events`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface IncomingEvent {
  event_name: string;
  event_id: string;
  event_time?: number;
  action_source?: string;
  event_source_url?: string;
  user_data?: Record<string, unknown>;
  custom_data?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const token = Deno.env.get("META_CAPI_TOKEN");
  if (!token) {
    return new Response(
      JSON.stringify({ error: "META_CAPI_TOKEN not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let body: IncomingEvent;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!body.event_name || !body.event_id) {
    return new Response(
      JSON.stringify({ error: "event_name and event_id are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Forward client IP for better match quality
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("cf-connecting-ip") ||
    undefined;

  const userData = { ...(body.user_data || {}) } as Record<string, unknown>;
  if (clientIp && !userData.client_ip_address) {
    userData.client_ip_address = clientIp;
  }

  const payload = {
    data: [
      {
        event_name: body.event_name,
        event_time: body.event_time || Math.floor(Date.now() / 1000),
        event_id: body.event_id,
        action_source: body.action_source || "website",
        event_source_url: body.event_source_url,
        user_data: userData,
        custom_data: body.custom_data || {},
      },
    ],
  };

  try {
    const res = await fetch(`${META_GRAPH_URL}?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (!res.ok) {
      console.error("[meta-capi] Meta API error", res.status, data);
      return new Response(JSON.stringify({ error: data }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, meta: data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[meta-capi] fetch failed", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
