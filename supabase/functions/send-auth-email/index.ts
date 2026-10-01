// supabase/functions/send-auth-email/index.ts
//
// Hook "Send Email" de Supabase Auth: en lugar del SMTP (Resend, roto: el dominio
// auth.opynio.com no está verificado y todo alta respondía 500 "Error sending
// confirmation email"), Auth llama aquí y el correo sale por la API de Brevo.
//
// - Lo llama Auth, no un navegador: verify_jwt = false y se exige la firma
//   Standard Webhooks con SEND_EMAIL_HOOK_SECRET ("v1,whsec_...").
// - Plantillas y asuntos: los mismos que tenía configurados Auth (plantillas.ts).
// - Secretos: BREVO_API_KEY y SEND_EMAIL_HOOK_SECRET. Primero como variables de
//   entorno; si no están, de Supabase Vault con la RPC auth_email_secrets()
//   (solo service_role; migración 20261001120000). BREVO_SENDER_EMAIL y
//   BREVO_SENDER_NAME, opcionales.
// - Si falla, responde con { error: { http_code, message } }: Auth lo trata como
//   fallo de envío y el front ya lo traduce (utils/authErrors.ts, emailSendFailed).

import { Webhook } from "npm:standardwebhooks@1.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PLANTILLAS } from "./plantillas.ts";

declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type EmailData = {
  token?: string;
  token_hash?: string;
  redirect_to?: string;
  email_action_type: string;
  site_url?: string;
  token_new?: string;
  token_hash_new?: string;
  old_email?: string;
  old_phone?: string;
  provider?: string;
  factor_type?: string;
};

type HookUser = { email?: string; new_email?: string; phone?: string };

// email_action_type de Auth -> plantilla.
const PLANTILLA_DE: Record<string, string> = {
  signup: "confirmation",
  recovery: "recovery",
  invite: "invite",
  magiclink: "magic_link",
  email_change: "email_change",
  reauthentication: "reauthentication",
  password_changed_notification: "password_changed_notification",
  email_changed_notification: "email_changed_notification",
  phone_changed_notification: "phone_changed_notification",
  mfa_factor_enrolled_notification: "mfa_factor_enrolled_notification",
  mfa_factor_unenrolled_notification: "mfa_factor_unenrolled_notification",
  identity_linked_notification: "identity_linked_notification",
  identity_unlinked_notification: "identity_unlinked_notification",
};

// Secretos: entorno primero, Vault después. Se cachean mientras viva la instancia.
let secretos: { brevo: string; hook: string } | null = null;
async function leerSecretos(): Promise<{ brevo: string; hook: string }> {
  if (secretos) return secretos;
  let brevo = Deno.env.get("BREVO_API_KEY") ?? "";
  let hook = Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "";
  if (!brevo || !hook) {
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data, error } = await admin.rpc("auth_email_secrets");
    if (error) throw new Error("auth_email_secrets: " + error.message);
    const fila = Array.isArray(data) ? data[0] : data;
    brevo ||= fila?.brevo_api_key ?? "";
    hook ||= fila?.send_email_hook_secret ?? "";
  }
  if (!brevo || !hook) throw new Error("Faltan BREVO_API_KEY o SEND_EMAIL_HOOK_SECRET");
  secretos = { brevo, hook };
  return secretos;
}

const escaparHtml = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function rellenar(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{\s*\.(\w+)\s*\}\}/g, (_m, nombre: string) => escaparHtml(vars[nombre] ?? ""));
}

// Mismo enlace que construye Auth con el SMTP: /auth/v1/verify vuelve a redirect_to.
function enlaceVerificacion(tokenHash: string, tipo: string, redirectTo: string | undefined): string {
  const base = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
  const url = new URL(`${base}/auth/v1/verify`);
  url.searchParams.set("token", tokenHash);
  url.searchParams.set("type", tipo);
  if (redirectTo) url.searchParams.set("redirect_to", redirectTo);
  return url.toString();
}

function fallo(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: { http_code: status, message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function enviarBrevo(apiKey: string, para: string, asunto: string, html: string): Promise<void> {
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: {
        email: Deno.env.get("BREVO_SENDER_EMAIL") ?? "no-reply@opynio.com",
        name: Deno.env.get("BREVO_SENDER_NAME") ?? "Opynio",
      },
      to: [{ email: para }],
      subject: asunto,
      htmlContent: html,
    }),
  });
  if (!r.ok) {
    // Sin la clave en el mensaje: Brevo no la devuelve, pero por si acaso.
    const cuerpo = (await r.text()).replaceAll(apiKey, "<clave>").slice(0, 300);
    throw new Error(`Brevo ${r.status}: ${cuerpo}`);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return fallo(405, "Método no permitido");

  let claves: { brevo: string; hook: string };
  try {
    claves = await leerSecretos();
  } catch (e) {
    console.error("[send-auth-email]", String(e instanceof Error ? e.message : e));
    return fallo(500, "Configuración de correo incompleta");
  }

  const cuerpo = await req.text();
  let user: HookUser;
  let email_data: EmailData;
  try {
    const wh = new Webhook(claves.hook.replace(/^v1,whsec_/, ""));
    ({ user, email_data } = wh.verify(cuerpo, Object.fromEntries(req.headers)) as {
      user: HookUser;
      email_data: EmailData;
    });
  } catch {
    return fallo(401, "Firma del hook no válida");
  }

  const tipo = email_data?.email_action_type;
  const clave = PLANTILLA_DE[tipo];
  const plantilla = clave ? PLANTILLAS[clave] : undefined;
  if (!plantilla) return fallo(400, `Tipo de correo no soportado: ${tipo}`);

  const varsBase: Record<string, string> = {
    Email: user?.email ?? "",
    NewEmail: user?.new_email ?? "",
    OldEmail: email_data.old_email ?? "",
    Phone: user?.phone ?? "",
    OldPhone: email_data.old_phone ?? "",
    Provider: email_data.provider ?? "",
    FactorType: email_data.factor_type ?? "",
    Token: email_data.token ?? "",
  };

  // Correos a enviar: [destinatario, token_hash]. En el cambio de email con
  // confirmación doble Auth manda token_hash (dirección actual) y token_hash_new
  // (la nueva); con confirmación simple solo uno, para la nueva.
  const envios: Array<[string, string | undefined]> = [];
  if (tipo === "email_change") {
    if (email_data.token_hash_new && user?.email) envios.push([user.email, email_data.token_hash_new]);
    if (email_data.token_hash) envios.push([user?.new_email || user?.email || "", email_data.token_hash]);
  } else {
    envios.push([user?.email ?? "", email_data.token_hash]);
  }

  try {
    for (const [para, tokenHash] of envios) {
      if (!para) continue;
      const vars = {
        ...varsBase,
        ConfirmationURL: tokenHash ? enlaceVerificacion(tokenHash, tipo, email_data.redirect_to) : "",
      };
      await enviarBrevo(claves.brevo, para, plantilla.asunto, rellenar(plantilla.html, vars));
    }
  } catch (e) {
    console.error("[send-auth-email]", tipo, String(e instanceof Error ? e.message : e));
    return fallo(500, "No se pudo enviar el correo");
  }

  return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
});
