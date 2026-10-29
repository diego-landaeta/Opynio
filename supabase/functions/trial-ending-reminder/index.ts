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
//   4. Mira el cupo diario de la cuenta de Brevo (la comparten las invitaciones y
//      otros sistemas; con el cupo agotado Brevo contesta 201 sin enviar nada). Sin
//      cupo NO se reserva ni se envia: la pasada del dia siguiente lo reintenta
//      (el aviso es obligatorio antes del primer cobro).
//   5. RESERVA el aviso (INSERT en trial_reminders; la PK evita duplicados aunque
//      haya dos ejecuciones a la vez), envia el correo por Brevo y, si el envio
//      falla, libera la reserva para que la pasada siguiente lo reintente.
//
// Antes de todo lo anterior, la prueba de 90 dias SIN tarjeta (issue #11, migracion
// 20261029100000), que no pasa por Stripe:
//   a. Busca en `free_trial_grants` las pruebas sin aviso que acaban en <= 7 dias.
//   b. Confirma en el perfil que sigue en plan gratuito y en prueba (si ya paga, el aviso
//      es el de Stripe).
//   c. Mismo cupo de Brevo; RESERVA con UPDATE ... WHERE reminder_sent_at IS NULL, envia
//      el correo construirAvisoSinTarjeta() y libera la reserva si el envio falla.
//
// Cuerpo opcional: { "dryRun": true } lista a quien avisaria sin reservar ni enviar.
// Respuesta: { checked, sent, skipped: {motivo: n}, failed, dryRun, candidates?, noCard }.
//
// Requiere la migracion 20261015110000_trial_reminders.sql (tabla trial_reminders),
// y los secrets CRON_SECRET, STRIPE_SECRET_KEY y BREVO_API_KEY (o la clave en Vault
// via la RPC auth_email_secrets, ver _shared/brevo.ts). Opcional: SITE_URL.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@^16.2.0?target=deno&no-check";
import { corsHeadersFor } from "../_shared/cors.ts";
import { cronAuthorized } from "../_shared/cronAuth.ts";
import { enviarBrevo, enviosRestantesBrevo, leerClaveBrevo } from "../_shared/brevo.ts";
import { planForPriceId } from "../_shared/stripePlans.ts";
import { construirAviso, construirAvisoSinTarjeta, elegirIdioma } from "./plantilla.ts";

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

  // 1. Autorizacion ANTES de tocar nada: vale el secreto del entorno (CRON_SECRET) o el de Vault (_shared/cronAuth.ts);
  //    sin ninguno configurado falla cerrado.
  const adminAuth = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  if (!(await cronAuthorized(req, Deno.env.get("CRON_SECRET"), adminAuth))) return json({ error: "No autorizado" }, 401);

  let dryRun = false;
  try {
    const body = await req.json();
    dryRun = body?.dryRun === true;
  } catch {
    // sin cuerpo: pasada normal
  }

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const ahora = Date.now();
    const site = (() => { const s = Deno.env.get("SITE_URL"); return s && /^https:\/\/(web\.|www\.)?opynio\.com$/.test(s) ? s : SITE; })();
    // Envios que quedan hoy en Brevo; undefined = aun no consultado, null = no se sabe (no se bloquea).
    // Lo comparten las dos pasadas.
    let restantesBrevo: number | null | undefined;

    // A. Prueba de 90 dias sin tarjeta (issue #11): no depende de Stripe.
    const noCard = { checked: 0, sent: 0, failed: 0, skipped: {} as Record<string, number>, candidates: [] as unknown[] };
    const saltarSinTarjeta = (motivo: string) => { noCard.skipped[motivo] = (noCard.skipped[motivo] ?? 0) + 1; };
    {
      const { data: pruebas, error: pruebasError } = await admin
        .from("free_trial_grants")
        .select("user_id, ends_at")
        .is("reminder_sent_at", null)
        .gt("ends_at", new Date(ahora).toISOString())
        .lte("ends_at", new Date(ahora + DIAS_AVISO * DAY_MS).toISOString())
        .limit(MAX_POR_PASADA);
      if (pruebasError) throw new Error(`free_trial_grants (¿migración 20261029100000 sin aplicar?): ${pruebasError.message}`);
      noCard.checked = (pruebas ?? []).length;

      for (const prueba of (pruebas ?? []) as { user_id: string; ends_at: string }[]) {
        try {
          // Sigue en plan gratuito y en prueba: si ya paga, el aviso es el de Stripe.
          const { data: perfil } = await admin
            .from("profiles")
            .select("plan, trial_full_access_until, preferred_language")
            .eq("id", prueba.user_id)
            .maybeSingle();
          const p = perfil as { plan?: string | null; trial_full_access_until?: string | null; preferred_language?: string | null } | null;
          if (!p) { saltarSinTarjeta("sin_perfil"); continue; }
          if ((p.plan ?? "free") !== "free") { saltarSinTarjeta("ya_tiene_plan_de_pago"); continue; }
          const finMs = p.trial_full_access_until ? Date.parse(p.trial_full_access_until) : NaN;
          if (!Number.isFinite(finMs) || finMs <= ahora) { saltarSinTarjeta("ya_no_esta_en_prueba"); continue; }

          const { data: u, error: uError } = await admin.auth.admin.getUserById(prueba.user_id);
          const email = u?.user?.email ?? "";
          if (uError || !email) { saltarSinTarjeta("sin_email"); continue; }
          const idioma = elegirIdioma(p.preferred_language);
          const locale = idioma === "en" ? "en-GB" : "es-ES";
          const fecha = new Date(finMs).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Madrid" });
          const aviso = construirAvisoSinTarjeta({ idioma, fecha, enlace: `${site}${idioma === "en" ? "/us/pricing" : "/es/planes"}` });

          if (dryRun) {
            noCard.candidates.push({ user: prueba.user_id, fin: new Date(finMs).toISOString(), idioma });
            continue;
          }

          const brevoKey = await leerClaveBrevo();
          if (restantesBrevo === undefined) restantesBrevo = await enviosRestantesBrevo(brevoKey);
          if (restantesBrevo !== null && restantesBrevo < 1) {
            saltarSinTarjeta("sin_cupo_brevo");
            console.warn("trial-ending-reminder: cupo diario de Brevo agotado; el aviso de una prueba sin tarjeta se reintenta en la pasada siguiente.");
            continue;
          }

          // Reservar: solo si nadie lo ha enviado ya (dos ejecuciones a la vez no duplican).
          const { data: reservada, error: reservaError } = await admin
            .from("free_trial_grants")
            .update({ reminder_sent_at: new Date().toISOString() })
            .eq("user_id", prueba.user_id)
            .is("reminder_sent_at", null)
            .select("user_id");
          if (reservaError) throw new Error(`free_trial_grants update: ${reservaError.message}`);
          if (!reservada || reservada.length === 0) { saltarSinTarjeta("ya_avisada"); continue; }
          try {
            await enviarBrevo(brevoKey, { para: email, asunto: aviso.asunto, html: aviso.html });
            noCard.sent++;
            if (typeof restantesBrevo === "number") restantesBrevo--;
            console.log(`trial-ending-reminder: aviso de prueba sin tarjeta enviado (fin ${new Date(finMs).toISOString()}).`);
          } catch (sendError) {
            await admin.from("free_trial_grants").update({ reminder_sent_at: null }).eq("user_id", prueba.user_id);
            throw sendError;
          }
        } catch (err) {
          noCard.failed++;
          // Sin el correo del usuario en el log.
          console.error("trial-ending-reminder: fallo con una prueba sin tarjeta:", (err as { message?: string })?.message ?? String(err));
        }
      }
    }
    const resumenSinTarjeta = { checked: noCard.checked, sent: noCard.sent, failed: noCard.failed, skipped: noCard.skipped, ...(dryRun ? { candidates: noCard.candidates } : {}) };

    // B. Prueba con tarjeta (Stripe).
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY no configurada.");
    const stripe = new Stripe(stripeKey, { httpClient: Stripe.createFetchHttpClient(), apiVersion: "2024-06-20" });
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
        const aviso = construirAviso({ idioma, plan, importe, intervalo, fecha, enlace: `${site}/es/mis-negocios` });

        if (dryRun) {
          candidates.push({ subscription: sub.id, plan, importe, intervalo, fin: new Date(finMs).toISOString(), idioma });
          continue;
        }

        // 4. Cupo de Brevo ANTES de reservar: sin cupo, el aviso queda para la pasada de mañana.
        const brevoKey = await leerClaveBrevo();
        if (restantesBrevo === undefined) restantesBrevo = await enviosRestantesBrevo(brevoKey);
        if (restantesBrevo !== null && restantesBrevo < 1) {
          saltar("sin_cupo_brevo");
          console.warn(`trial-ending-reminder: cupo diario de Brevo agotado; el aviso de la suscripcion ${sub.id} se reintenta en la pasada siguiente.`);
          continue;
        }

        // 5. Reservar (PK = un solo aviso por suscripcion), enviar y liberar si falla.
        const { error: claimError } = await admin
          .from("trial_reminders")
          .insert({ subscription_id: sub.id, user_id: row.user_id, trial_end: new Date(finMs).toISOString() });
        if (claimError) {
          if (claimError.code === "23505") { saltar("ya_avisada"); continue; }
          throw new Error(`trial_reminders insert: ${claimError.message}`);
        }
        try {
          await enviarBrevo(brevoKey, { para: email, asunto: aviso.asunto, html: aviso.html });
          sent++;
          if (typeof restantesBrevo === "number") restantesBrevo--;
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

    return json({ checked: candidatas.length, sent, failed, skipped, dryRun, ...(dryRun ? { candidates } : {}), noCard: resumenSinTarjeta }, 200);
  } catch (error) {
    console.error("trial-ending-reminder:", (error as { message?: string })?.message ?? String(error));
    return json({ error: "Error interno." }, 500);
  }
});
