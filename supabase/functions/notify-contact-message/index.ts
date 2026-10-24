// supabase/functions/notify-contact-message/index.ts
//
// Avisa por correo al equipo cuando alguien envía el formulario de contacto.
//
// Flujo: el formulario inserta el mensaje en contact_messages (anon solo puede INSERTAR) y a
// continuación llama a esta función con los mismos datos. La función NO se fía del cuerpo para
// enviar nada: busca la fila que acaba de crearse (mismo correo, nombre y texto, de hace menos de
// 10 minutos, sin avisar), la reclama de forma atómica (UPDATE ... notified_at) y solo entonces
// envía. Una fila = un correo como mucho; sin fila que case, no se envía nada. Además el trigger de
// la tabla ya limita a 5 mensajes por correo y hora.
//
// Destino: secret CONTACT_NOTIFY_EMAIL (por defecto support@opynio.com). El remitente es el de
// Opynio y «responder» va al correo de quien escribió. Todo texto del usuario se escapa en el HTML.
//
// Si el correo falla, se libera la marca para que un reintento pueda enviarlo.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { enviarBrevo, leerClaveBrevo } from "../_shared/brevo.ts";

declare const Deno: { env: { get: (key: string) => string | undefined } };

const DESTINO_POR_DEFECTO = "support@opynio.com";
const VENTANA_MIN = 10;
const TIPOS: Record<string, string> = {
  contact: "Contacto general",
  careers: "Trabaja con nosotros",
  press: "Prensa",
  partnership: "Colaboraciones",
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

serve(async (req: Request) => {
  const cors = corsHeadersFor(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  let body: { name?: unknown; email?: unknown; message?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Cuerpo no válido." }, 400); }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!name || !email || !message || name.length > 100 || email.length > 200 || message.length > 5000) {
    return json({ error: "Datos no válidos." }, 400);
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const desde = new Date(Date.now() - VENTANA_MIN * 60_000).toISOString();

  // 1) La fila recién creada que casa con estos datos y aún no se ha avisado.
  const { data: candidata, error: errBuscar } = await admin
    .from("contact_messages")
    .select("id")
    .ilike("email", email.replace(/[%_\\]/g, "\\$&"))
    .eq("name", name)
    .eq("message", message)
    .is("notified_at", null)
    .gte("created_at", desde)
    .order("id", { ascending: false })
    .limit(1);
  if (errBuscar) { console.error("notify-contact-message: buscar:", errBuscar.message); return json({ error: "Error interno." }, 500); }
  if (!candidata || candidata.length === 0) return json({ ok: true, enviado: false }); // nada que avisar

  // 2) Reclamarla de forma atómica: si dos llamadas coinciden, solo una gana.
  const { data: reclamada, error: errReclamar } = await admin
    .from("contact_messages")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", candidata[0].id)
    .is("notified_at", null)
    .select("id, created_at, kind, name, email, message")
    .maybeSingle();
  if (errReclamar) { console.error("notify-contact-message: reclamar:", errReclamar.message); return json({ error: "Error interno." }, 500); }
  if (!reclamada) return json({ ok: true, enviado: false });

  // 3) Enviar.
  const tipo = TIPOS[reclamada.kind] ?? reclamada.kind;
  const destino = (Deno.env.get("CONTACT_NOTIFY_EMAIL") ?? "").trim() || DESTINO_POR_DEFECTO;
  const fecha = new Date(reclamada.created_at).toLocaleString("es-ES", { timeZone: "Europe/Madrid", dateStyle: "long", timeStyle: "short" });
  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1f2937">` +
    `<h2 style="margin:0 0 4px">Nuevo mensaje de contacto</h2>` +
    `<p style="margin:0 0 16px;color:#6b7280">${esc(tipo)} · ${esc(fecha)}</p>` +
    `<table style="border-collapse:collapse;width:100%;font-size:14px">` +
    `<tr><td style="padding:6px 0;color:#6b7280;width:90px">Nombre</td><td style="padding:6px 0"><b>${esc(reclamada.name)}</b></td></tr>` +
    `<tr><td style="padding:6px 0;color:#6b7280">Correo</td><td style="padding:6px 0">${esc(reclamada.email)}</td></tr></table>` +
    `<div style="margin:16px 0;padding:14px 16px;background:#f3f4f6;border-radius:10px;white-space:pre-wrap;font-size:14px;line-height:1.5">${esc(reclamada.message)}</div>` +
    `<p style="font-size:14px">Responde a este correo para contestarle directamente, o gestiónalo en ` +
    `<a href="https://web.opynio.com/admin/soporte" style="color:#047857">el panel de administración</a> (Soporte › Contacto).</p></div>`;

  try {
    await enviarBrevo(await leerClaveBrevo(), {
      para: destino,
      asunto: `Contacto de Opynio: ${tipo} · ${reclamada.name}`.slice(0, 150),
      html,
      remitenteNombre: "Opynio · Contacto",
      responderA: reclamada.email,
    });
  } catch (e) {
    console.error("notify-contact-message: envío fallido:", (e as { message?: string })?.message ?? String(e));
    await admin.from("contact_messages").update({ notified_at: null }).eq("id", reclamada.id); // permite reintentar
    return json({ error: "No se pudo enviar el aviso." }, 502);
  }
  return json({ ok: true, enviado: true });
});
