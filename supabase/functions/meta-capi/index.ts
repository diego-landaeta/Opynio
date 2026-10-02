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

// Esta funcion la puede llamar cualquiera con la anon key (va en el bundle), y
// cada evento que reenvia alimenta la optimizacion de campanas de Meta. Limites:
//   - solo los eventos que envia la app (utils/metaPixel.ts)
//   - la URL del evento tiene que ser de un dominio de Opynio
//   - Purchase NUNCA se reenvia desde aqui (ver SERVER_ONLY_EVENTS)
//   - value/currency del cliente se descartan en el resto de eventos
const FORWARDED_EVENTS = new Set(["PageView", "ViewContent", "CompleteRegistration", "Lead"]);

// Purchase lo manda stripe-webhook (checkout.session.completed) desde el
// servidor, con el importe y la moneda reales de Stripe y event_id = session.id;
// el Pixel del navegador usa ese mismo event_id y Meta los deduplica. Aqui el
// valor, la moneda y el event_id los ponia el cliente: con una suscripcion
// cualquiera se podian inflar las conversiones (value: 999999, event_ids
// distintos). Se responde 200 sin reenviar para no tocar el front
// (PaymentSuccessPage sigue llamando igual, fire-and-forget) ni ensuciar la
// consola del cliente con un error en cada compra real.
const SERVER_ONLY_EVENTS = new Set(["Purchase"]);

// Campos de valor economico: solo los pone el servidor.
const SERVER_ONLY_CUSTOM_DATA = ["value", "currency", "predicted_ltv"];

const ALLOWED_HOST = /(^|\.)opynio\.com$|^localhost$|^127\.0\.0\.1$/;

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

  let body: IncomingEvent;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!body || typeof body.event_name !== "string" || !body.event_id) {
    return jsonResponse({ error: "event_name and event_id are required" }, 400);
  }
  if (SERVER_ONLY_EVENTS.has(body.event_name)) {
    return jsonResponse({ ok: true, forwarded: false, reason: "sent_server_side" }, 200);
  }
  if (!FORWARDED_EVENTS.has(body.event_name)) {
    return jsonResponse({ error: "event not allowed" }, 400);
  }
  let sourceHost = "";
  try {
    sourceHost = new URL(String(body.event_source_url ?? "")).hostname;
  } catch { /* URL invalida: se rechaza abajo */ }
  if (!ALLOWED_HOST.test(sourceHost)) {
    return jsonResponse({ error: "event_source_url not allowed" }, 400);
  }

  // El secreto se comprueba DESPUES de validar: antes un anonimo podia saber
  // si estaba configurado mandando cualquier cosa.
  const token = Deno.env.get("META_CAPI_TOKEN");
  if (!token) {
    return jsonResponse({ error: "META_CAPI_TOKEN not configured" }, 500);
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

  const rawCustom = body.custom_data;
  const customData: Record<string, unknown> =
    rawCustom && typeof rawCustom === "object" && !Array.isArray(rawCustom) ? { ...rawCustom } : {};
  for (const key of SERVER_ONLY_CUSTOM_DATA) delete customData[key];

  const payload = {
    data: [
      {
        event_name: body.event_name,
        event_time: body.event_time || Math.floor(Date.now() / 1000),
        event_id: body.event_id,
        action_source: body.action_source || "website",
        event_source_url: body.event_source_url,
        user_data: userData,
        custom_data: customData,
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
