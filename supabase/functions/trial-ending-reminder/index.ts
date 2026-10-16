// supabase/functions/trial-ending-reminder/index.ts
//
// Aviso por correo 7 dias antes de que acabe la prueba gratuita (issue #2).
// Stripe solo avisa por webhook 3 dias antes (customer.subscription.trial_will_end)
// y no manda nada al cliente por si mismo, asi que lo hace esta funcion con un
// cron DIARIO (ver docs/PRECIOS-NUEVOS.md).
//
// Seguridad: igual que monthly-rescrape-job. verify_jwt = false (config.toml) y
// la unica barrera es `Authorization: Bearer <CRON_SECRET>`; sin secret
// configurado falla cerrado (401). CORS restringido (_shared/cors.ts).
//
// Que hace en cada pasada:
//   1. Busca en `subscriptions` las que estan en 'trialing' y acaban en <= 8 dias
//      (current_period_end = fin de la prueba mientras dura; margen de 1 dia).
//   2. Descarta las que ya tienen aviso en `trial_reminders`.
//   3. Para cada una confirma en Stripe (fuente de verdad) que sigue en prueba, que
//      no esta cancelada ni programada para cancelar y que trial_end cae dentro de
//      los proximos 7 dias; saca plan, importe e intervalo del price.
//   4. RESERVA el aviso (INSERT en trial_reminders; la PK evita duplicados aunque
//      haya dos ejecuciones a la vez), envia el correo por Brevo y, si el envio
//      falla, libera la reserva para que la pasada siguiente lo reintente.
//
// Cuerpo opcional: { "dryRun": true } lista a quien avisaria sin reservar ni enviar.
// Respuesta: { checked, sent, skipped: {motivo: n}, failed, dryRun, candidates? }.
//
// Requiere la migracion 20261015110000_trial_reminders.sql (tabla trial_reminders),
// y los secrets CRON_SECRET, STRIPE_SECRET_KEY y BREVO_API_KEY (o la clave en Vault
// via la RPC auth_email_secrets, ver _shared/brevo.ts). Opcional: SITE_URL.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@^16.2.0?target=deno&no-check";
import { corsHeadersFor } from "../_shared/cors.ts";
import { enviarBrevo, leerClaveBrevo } from "../_shared/brevo.ts";
import { planForPriceId } from "../_shared/stripePlans.ts";
import { construirAviso, elegirIdioma } from "./plantilla.ts";

declare const Deno: { env: { get: (key: string) => string | undefined } };

const DIAS_AVISO = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_POR_PASADA = 200;
const SITE = "https://web.opynio.com";

// Comparacion en tiempo constante para no filtrar el secreto por timing.
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < Math.max(ab.length, bb.length); i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

const NOMBRES_PLAN: Record<string, string> = { starter: "Starter", growth: "Growth", pro: "Pro", v2: "V2" };

serve(async (req: Request) => {
  const corsHeaders = corsHeadersFor(req);
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  // 1. Autorizacion ANTES de tocar nada; sin CRON_SECRET falla cerrado.
  const CRON_SECRET = Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!CRON_SECRET) {
    console.error("trial-ending-reminder: CRON_SECRET no configurado; peticion rechazada.");
    return json({ error: "No autorizado" }, 401);
  }
  if (!safeEqual(authHeader, `Bearer ${CRON_SECRET}`)) return json({ error: "No autorizado" }, 401);

  let dryRun = false;
  try {
    const body = await req.json();
    dryRun = body?.dryRun === true;
  } catch {
    // sin cuerpo: pasada normal
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY no configurada.");
    const stripe = new Stripe(stripeKey, { httpClient: Stripe.createFetchHttpClient(), apiVersion: "2024-06-20" });
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const ahora = Date.now();
    // 2. Candidatas en la BD (margen de 1 dia: la fecha exacta la da Stripe).
    const { data: rows, error: rowsError } = await admin
      .from("subscriptions")
      .select("id, user_id, price_id, current_period_end, cancel_at_period_end")
      .eq("status", "trialing")
      .gt("current_period_end", new Date(ahora).toISOString())
      .lte("current_period_end", new Date(ahora + (DIAS_AVISO + 1) * DAY_MS).toISOString())
      .limit(MAX_POR_PASADA);
    if (rowsError) throw new Error(`subscriptions: ${rowsError.message}`);

    // deno-lint-ignore no-explicit-any
    const candidatas: any[] = (rows ?? []).filter((r: any) => r.cancel_at_period_end !== true);
    const skipped: Record<string, number> = {};
    const saltar = (motivo: string) => { skipped[motivo] = (skipped[motivo] ?? 0) + 1; };
    if ((rows ?? []).length !== candidatas.length) skipped["cancelada_al_acabar"] = (rows ?? []).length - candidatas.length;

    // Ya avisadas.
    let yaAvisadas = new Set<string>();
    if (candidatas.length > 0) {
      const { data: prev, error: prevError } = await admin
        .from("trial_reminders")
        .select("subscription_id")
        .in("subscription_id", candidatas.map((c) => c.id));
      if (prevError) throw new Error(`trial_reminders (¿migración 20261015110000 sin aplicar?): ${prevError.message}`);
      yaAvisadas = new Set((prev ?? []).map((p: { subscription_id: string }) => p.subscription_id));
    }

    let sent = 0;
    let failed = 0;
    const candidates: unknown[] = [];

    for (const row of candidatas) {
      if (yaAvisadas.has(row.id)) { saltar("ya_avisada"); continue; }
      try {
        // 3. Stripe manda: sigue en prueba, no cancelada, y acaba dentro de la ventana.
        const sub = await stripe.subscriptions.retrieve(row.id, { expand: ["items.data.price.product"] });
        if (sub.status !== "trialing" || !sub.trial_end) { saltar("ya_no_esta_en_prueba"); continue; }
        if (sub.cancel_at_period_end || sub.cancel_at) { saltar("cancelada_al_acabar"); continue; }
        const finMs = sub.trial_end * 1000;
        if (finMs <= ahora) { saltar("prueba_ya_terminada"); continue; }
        if (finMs > ahora + DIAS_AVISO * DAY_MS) { saltar("fuera_de_ventana"); continue; }

        const item = sub.items.data[0];
        const price = item?.price;
        if (!price || price.unit_amount == null) { saltar("sin_precio"); continue; }
        // deno-lint-ignore no-explicit-any
        const productName = typeof price.product === "object" && price.product ? String((price.product as any).name ?? "") : "";
        const planKey = planForPriceId(price.id) ?? productName.toLowerCase();
        const plan = NOMBRES_PLAN[planKey] ?? (productName || planKey || "Opynio");
        const intervalo: "month" | "year" = price.recurring?.interval === "year" ? "year" : "month";

        // Destinatario e idioma.
        const { data: u, error: uError } = await admin.auth.admin.getUserById(row.user_id);
        const email = u?.user?.email ?? "";
        if (uError || !email) { saltar("sin_email"); continue; }
        const { data: perfil } = await admin.from("profiles").select("preferred_language").eq("id", row.user_id).maybeSingle();
        const idioma = elegirIdioma((perfil as { preferred_language?: string | null } | null)?.preferred_language);

        const locale = idioma === "en" ? "en-GB" : "es-ES";
        const fecha = new Date(finMs).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Madrid" });
        const importe = new Intl.NumberFormat(locale, { style: "currency", currency: (price.currency || "eur").toUpperCase() }).format(price.unit_amount / 100);
        const site = (() => { const s = Deno.env.get("SITE_URL"); return s && /^https:\/\/(web\.|www\.)?opynio\.com$/.test(s) ? s : SITE; })();
        const aviso = construirAviso({ idioma, plan, importe, intervalo, fecha, enlace: `${site}/es/mis-negocios` });

        if (dryRun) {
          candidates.push({ subscription: sub.id, plan, importe, intervalo, fin: new Date(finMs).toISOString(), idioma });
          continue;
        }

        // 4. Reservar (PK = un solo aviso por suscripcion), enviar y liberar si falla.
        const { error: claimError } = await admin
          .from("trial_reminders")
          .insert({ subscription_id: sub.id, user_id: row.user_id, trial_end: new Date(finMs).toISOString() });
        if (claimError) {
          if (claimError.code === "23505") { saltar("ya_avisada"); continue; }
          throw new Error(`trial_reminders insert: ${claimError.message}`);
        }
        try {
          await enviarBrevo(await leerClaveBrevo(), { para: email, asunto: aviso.asunto, html: aviso.html });
          sent++;
          console.log(`trial-ending-reminder: aviso enviado (sub ${sub.id}, plan ${plan}, fin ${new Date(finMs).toISOString()}).`);
        } catch (sendError) {
          await admin.from("trial_reminders").delete().eq("subscription_id", sub.id);
          throw sendError;
        }
      } catch (err) {
        failed++;
        // Sin el correo del usuario en el log.
        console.error(`trial-ending-reminder: fallo con la suscripcion ${row.id}:`, (err as { message?: string })?.message ?? String(err));
      }
    }

    return json({ checked: candidatas.length, sent, failed, skipped, dryRun, ...(dryRun ? { candidates } : {}) }, 200);
  } catch (error) {
    console.error("trial-ending-reminder:", (error as { message?: string })?.message ?? String(error));
    return json({ error: "Error interno." }, 500);
  }
});
