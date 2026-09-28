// supabase/functions/send-notification-email/index.ts
//
// Aviso por correo al usuario (QA 28/09: «debe tambien notificar por correo»).
// Lo llama el admin desde el panel:
//   - { kind: 'support_reply', ticketId }  -> al autor de la solicitud, tras
//     responderle en /admin/soporte.
//   - { kind: 'review_published', reviewId } -> al dueno de la empresa, tras
//     aprobar la resena en moderacion.
// El aviso en la web (campana) lo crea la base de datos; esto es solo el
// correo. Se envia por el mismo webhook de Make que las invitaciones
// (formType 'notification', con destinatario `to`): el escenario de Make
// debe tratar 'notification' igual que 'invitation'.
//
// Solo admin (requireAdmin) y CORS restringido: si no, cualquiera podria
// mandar correos a nombre de Opynio a los usuarios.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/requireAdmin.ts";

declare const Deno: {
  env: { get: (key: string) => string | undefined };
};

const SITE = "https://web.opynio.com";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Asunto en texto plano, sin saltos ni controles.
const plain = (s: string) => s.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, " ").slice(0, 200);

const button = (href: string, label: string) =>
  `<p><a href="${href}" style="display:inline-block;padding:12px 24px;background-color:#00b67a;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">${label}</a></p>`;

serve(async (req: Request) => {
  const corsHeaders = corsHeadersFor(req);
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Método no permitido." });

  const denied = await requireAdmin(req, corsHeaders);
  if (denied) return denied;

  let body: { kind?: string; ticketId?: number | string; reviewId?: string | number };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Cuerpo no válido." });
  }

  const makeWebhookUrl = Deno.env.get("MAKE_WEBHOOK_URL");
  if (!makeWebhookUrl) return json(500, { error: "Configuración incompleta: falta 'MAKE_WEBHOOK_URL'." });

  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

  let to = "";
  let subject = "";
  let html = "";

  if (body.kind === "support_reply" && body.ticketId != null) {
    const { data: ticket } = await admin
      .from("support_tickets")
      .select("id, user_id, subject")
      .eq("id", body.ticketId)
      .maybeSingle();
    if (!ticket) return json(404, { error: "Solicitud no encontrada." });
    const { data: u } = await admin.auth.admin.getUserById(ticket.user_id);
    to = u?.user?.email ?? "";
    subject = plain(`Respuesta de soporte: ${ticket.subject}`);
    html = `
      <p>Hola,</p>
      <p>El equipo de Opynio ha respondido a tu solicitud <strong>«${escapeHtml(String(ticket.subject))}»</strong> (n.º ${ticket.id}).</p>
      <p>Puedes leer la respuesta y contestar desde tu perfil, en «Mis solicitudes de soporte».</p>
      ${button(`${SITE}/es/perfil#soporte`, "Ver la respuesta")}
      <p>El equipo de Opynio</p>`;
  } else if (body.kind === "review_published" && body.reviewId != null) {
    const { data: review } = await admin
      .from("reviews")
      .select("id, rating, title, business_id, user_id, original_author_name, status")
      .eq("id", body.reviewId)
      .maybeSingle();
    if (!review) return json(404, { error: "Reseña no encontrada." });
    // Las importadas (con autor original) no avisan, igual que en la campana.
    if (review.status !== "approved" || review.original_author_name) return json(200, { skipped: true });
    const { data: business } = await admin
      .from("businesses")
      .select("name, owner_id")
      .eq("id", review.business_id)
      .maybeSingle();
    if (!business?.owner_id || business.owner_id === review.user_id) return json(200, { skipped: true });
    const { data: u } = await admin.auth.admin.getUserById(business.owner_id);
    to = u?.user?.email ?? "";
    subject = plain(`Nueva reseña en ${business.name}`);
    const stars = "★".repeat(Math.max(0, Math.min(5, Number(review.rating) || 0)));
    html = `
      <p>Hola,</p>
      <p>Se ha publicado una nueva reseña de <strong>${escapeHtml(String(business.name))}</strong> en Opynio:</p>
      <p style="font-size:18px;color:#f5b301;margin:0">${stars}</p>
      ${review.title ? `<p><strong>${escapeHtml(String(review.title))}</strong></p>` : ""}
      <p>Puedes leerla y responder desde el panel de tu empresa.</p>
      ${button(`${SITE}/es/mis-negocios`, "Ir a mis negocios")}
      <p>El equipo de Opynio</p>`;
  } else {
    return json(400, { error: "Tipo de aviso no válido." });
  }

  if (!to) return json(200, { skipped: true, reason: "sin email" });

  const res = await fetch(makeWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ formType: "notification", to, subject, body: html }),
  }).catch(() => null);

  if (!res || !res.ok) {
    console.error(`send-notification-email: el webhook respondió ${res?.status ?? "sin respuesta"} (${body.kind}).`);
    return json(502, { error: "El servicio de envío no respondió." });
  }
  return json(200, { sent: true });
});
