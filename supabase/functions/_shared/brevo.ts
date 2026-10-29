// supabase/functions/_shared/brevo.ts
//
// Envio de correo transaccional por la API de Brevo. Lo usa send-invitation-email
// (antes mandaba el aviso a Make, que contestaba 200 aunque luego no enviara nada).
//
// - Clave: BREVO_API_KEY del entorno; si no esta, de Supabase Vault con la RPC
//   auth_email_secrets() (solo service_role; migracion 20261001120000). Es la
//   misma clave que ya usa send-auth-email.
// - Remitente: BREVO_SENDER_EMAIL (por defecto no-reply@opynio.com, verificado en
//   Brevo). El NOMBRE puede llevar la marca de la empresa; el correo no cambia.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: {
  env: { get: (key: string) => string | undefined };
};

let claveEnCache: string | null = null;

export async function leerClaveBrevo(): Promise<string> {
  if (claveEnCache) return claveEnCache;
  let clave = Deno.env.get("BREVO_API_KEY") ?? "";
  if (!clave) {
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data, error } = await admin.rpc("auth_email_secrets");
    if (error) throw new Error("auth_email_secrets: " + error.message);
    const fila = Array.isArray(data) ? data[0] : data;
    clave = fila?.brevo_api_key ?? "";
  }
  if (!clave) throw new Error("Falta BREVO_API_KEY");
  claveEnCache = clave;
  return clave;
}

export type CorreoBrevo = {
  para: string;
  asunto: string;
  html: string;
  /** Nombre que ve el destinatario como remitente (el correo sigue siendo el de Opynio). */
  remitenteNombre?: string;
  /** Si responde, le llega a la empresa. Debe ser un correo valido. */
  responderA?: string;
};

// Sin comillas, saltos de linea ni caracteres de control: va en una cabecera.
export function nombreSeguro(valor: string, max = 60): string {
  return valor.replace(/[\u0000-\u001f\u007f\u2028\u2029"<>]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export async function enviarBrevo(apiKey: string, c: CorreoBrevo): Promise<void> {
  const cuerpo: Record<string, unknown> = {
    sender: {
      email: Deno.env.get("BREVO_SENDER_EMAIL") ?? "no-reply@opynio.com",
      name: c.remitenteNombre ? nombreSeguro(c.remitenteNombre) : (Deno.env.get("BREVO_SENDER_NAME") ?? "Opynio"),
    },
    to: [{ email: c.para }],
    subject: c.asunto,
    htmlContent: c.html,
  };
  if (c.responderA) cuerpo.replyTo = { email: c.responderA };

  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify(cuerpo),
  });
  if (!r.ok) {
    // Sin la clave en el mensaje: Brevo no la devuelve, pero por si acaso.
    const texto = (await r.text()).replaceAll(apiKey, "<clave>").slice(0, 300);
    throw new Error(`Brevo ${r.status}: ${texto}`);
  }
}

// Cupo de la cuenta de Brevo. La cuenta es plan Free (300 correos al dia) y la comparten
// varios sistemas de ISEIE: con el cupo agotado Brevo contesta 201 a /smtp/email pero no
// envia ni registra nada, y el panel decia «Enviada» (issue #5). GET /v3/account trae en
// plan[] una entrada con creditsType «sendLimit» y los envios que quedan hoy.
// Devuelve null si no se puede saber (API caida, plan sin tope diario, respuesta rara):
// en ese caso NO se bloquea nada, para que un fallo de esta comprobacion nunca impida enviar.
export function enviosRestantesDeCuenta(cuenta: unknown): number | null {
  const planes = (cuenta as { plan?: unknown })?.plan;
  if (!Array.isArray(planes)) return null;
  for (const p of planes) {
    const e = p as { creditsType?: unknown; credits?: unknown };
    if (e?.creditsType === "sendLimit" && typeof e.credits === "number" && Number.isFinite(e.credits) && e.credits >= 0) {
      return Math.floor(e.credits);
    }
  }
  return null;
}

export async function enviosRestantesBrevo(apiKey: string): Promise<number | null> {
  try {
    const r = await fetch("https://api.brevo.com/v3/account", {
      headers: { "api-key": apiKey, accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return null;
    return enviosRestantesDeCuenta(await r.json());
  } catch {
    return null;
  }
}
