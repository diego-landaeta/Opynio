// supabase/functions/send-support-email/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Type declarations for Deno environment
declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Asunto: texto plano (el correo lo pinta tal cual, asi que escaparlo dejaba
// «O&#39;Brien»), pero sin saltos de linea ni caracteres de control: un \r\n
// en el asunto es la puerta a inyectar cabeceras si el servicio de correo no
// lo filtra. El escape HTML queda solo para el cuerpo.
function plainSubjectPart(value: unknown, max = 120): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, max);
}

// La pagina a reclamar tiene que ser de Opynio. Antes cualquier URL acababa
// como enlace en un correo que sale de Opynio hacia soporte.
const OPYNIO_HOST = /(^|\.)opynio\.com$/;
const LOCAL_HOST = /^(localhost|127\.0\.0\.1)$/;
function isOpynioUrl(value: unknown): boolean {
  try {
    const url = new URL(String(value ?? "").trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    if (url.username || url.password) return false;
    return OPYNIO_HOST.test(url.hostname) || LOCAL_HOST.test(url.hostname);
  } catch {
    return false;
  }
}

// La web de la empresa puede ser cualquier dominio, pero solo se enlaza si es
// http(s); si no (javascript:, data:...), va como texto.
function isHttpUrl(value: unknown): boolean {
  try {
    const url = new URL(String(value ?? "").trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function createErrorResponse(message: string, statusCode: number = 500) {
  console.error(`Error (${statusCode}):`, message);
  return new Response(JSON.stringify({ error: message, details: message }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: statusCode,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2. Authenticate the user calling the function (Safer check)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return createErrorResponse("No se encontró la cabecera de autorización.", 401);
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return createErrorResponse("No autorizado. Debes iniciar sesión.", 401);
    }
    
    // 3. Get form data from request body
    // El secreto se mira DESPUES de autenticar: antes un anonimo podia saber si
    // estaba configurado.
    const makeWebhookUrl = Deno.env.get("MAKE_WEBHOOK_URL");
    if (!makeWebhookUrl) {
      return createErrorResponse("Configuración incompleta. Falta el secreto 'MAKE_WEBHOOK_URL' en el proyecto de Supabase.", 500);
    }

    const { formType, data: rawData } = await req.json();
    // Todo lo que llega del formulario se escapa antes de ir al HTML del correo,
    // y el email del remitente es el de la sesion: antes salia del body y se
    // podia suplantar a cualquiera o meter HTML (enlaces) en el correo a soporte.
    const escapar = (v: unknown) => String(v ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const data: Record<string, string> = {};
    for (const [clave, valor] of Object.entries((rawData ?? {}) as Record<string, unknown>)) {
      data[clave] = escapar(valor);
    }
    data.email = escapar(user.email ?? rawData?.email);
    if (!formType || !data) {
      return createErrorResponse("Faltan datos en la solicitud.", 400);
    }
    // Para el asunto se usa el valor original (sin escapar), limpiado a texto plano.
    const usernameForSubject = plainSubjectPart(rawData?.username);

    // 4. Construct email subject and body
    let subject = "";
    let body = "";

    if (formType === 'bug') {
        subject = `Nuevo Reporte de Bug de: ${usernameForSubject}`;
        body = `
            <p>Un usuario ha reportado un error en la plataforma.</p>
            <br>
            <h3>Detalles del Usuario:</h3>
            <ul>
                <li><strong>Nombre de Usuario:</strong> ${data.username}</li>
                <li><strong>Email:</strong> ${data.email}</li>
            </ul>
            <h3>Detalles del Reporte:</h3>
            <ul>
                <li><strong>URL del Error:</strong> ${data.pageUrl || 'No especificada'}</li>
            </ul>
            <strong>Descripción:</strong><br>
            <pre style="background-color: #f4f4f4; padding: 10px; border: 1px solid #ddd; border-radius: 5px; white-space: pre-wrap; word-wrap: break-word;">${data.description}</pre>
        `;
    } else if (formType === 'claim') {
        if (!isOpynioUrl(rawData?.opynioUrl)) {
          return createErrorResponse("La página a reclamar debe ser una URL de Opynio (http/https).", 400);
        }
        const websiteHtml = isHttpUrl(rawData?.websiteUrl)
          ? `<a href="${data.websiteUrl}">${data.websiteUrl}</a>`
          : (data.websiteUrl || 'No especificada');
        subject = `Nueva Solicitud de Reclamación de Empresa: ${usernameForSubject}`;
        body = `
            <p>Un usuario ha solicitado reclamar una página de empresa.</p>
            <br>
            <h3>Detalles del Usuario:</h3>
            <ul>
                <li><strong>Nombre de Usuario / Nombre:</strong> ${data.username}</li>
                <li><strong>Email:</strong> ${data.email}</li>
            </ul>
            <h3>Detalles de la Reclamación:</h3>
            <ul>
                <li><strong>Página de Opynio a reclamar:</strong> <a href="${data.opynioUrl}">${data.opynioUrl}</a></li>
                <li><strong>Web oficial de la empresa:</strong> ${websiteHtml}</li>
                <li><strong>Teléfono de la empresa:</strong> ${data.phone}</li>
            </ul>
            <strong>Comentarios adicionales:</strong><br> 
            <pre style="background-color: #f4f4f4; padding: 10px; border: 1px solid #ddd; border-radius: 5px; white-space: pre-wrap; word-wrap: break-word;">${data.comments || 'Sin comentarios.'}</pre>
        `;
    } else if (formType === 'claim_review') {
        subject = `Apelación de Reseña Rechazada por: ${usernameForSubject}`;
        body = `
            <p>Un usuario ha apelado el rechazo de una de sus reseñas.</p>
            <br>
            <h3>Detalles del Usuario:</h3>
            <ul>
                <li><strong>Nombre de Usuario:</strong> ${data.username}</li>
                <li><strong>Email:</strong> ${data.email}</li>
            </ul>
            <h3>Detalles de la Reseña:</h3>
            <ul>
                <li><strong>ID de Reseña:</strong> ${data.reviewId}</li>
                <li><strong>Título de Reseña:</strong> ${data.reviewTitle}</li>
            </ul>
            <strong>Motivo de la apelación:</strong><br>
            <pre style="background-color: #f4f4f4; padding: 10px; border: 1px solid #ddd; border-radius: 5px; white-space: pre-wrap; word-wrap: break-word;">${data.reason || 'Sin comentarios.'}</pre>
        `;
    } else if (formType === 'ticket') {
        // Aviso al equipo de una solicitud nueva. La solicitud ya esta guardada
        // en support_tickets: esto es solo el aviso (si falla, no pasa nada).
        const ticketId = plainSubjectPart(rawData?.ticketId, 20);
        subject = `Nueva solicitud de soporte #${ticketId} (${plainSubjectPart(rawData?.ticketType, 30)}): ${plainSubjectPart(rawData?.subject, 100)}`;
        body = `
            <p>Un usuario ha abierto una solicitud de soporte. Respóndela desde el panel de admin (Soporte).</p>
            <br>
            <h3>Detalles del Usuario:</h3>
            <ul>
                <li><strong>Nombre de Usuario:</strong> ${data.username}</li>
                <li><strong>Email:</strong> ${data.email}</li>
            </ul>
            <h3>Solicitud #${data.ticketId}</h3>
            <ul>
                <li><strong>Tipo:</strong> ${data.ticketType}</li>
                <li><strong>Asunto:</strong> ${data.subject}</li>
            </ul>
            <strong>Mensaje:</strong><br>
            <pre style="background-color: #f4f4f4; padding: 10px; border: 1px solid #ddd; border-radius: 5px; white-space: pre-wrap; word-wrap: break-word;">${data.message}</pre>
        `;
    } else {
        return createErrorResponse("Tipo de formulario no válido.", 400);
    }

    // 5. Send the data to the Make.com webhook
    const webhookResponse = await fetch(makeWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: subject,
        body: body,
      }),
    });

    if (!webhookResponse.ok) {
        const errorBody = await webhookResponse.text();
        console.error("Error from Make.com webhook:", errorBody);
        throw new Error(`El servicio de automatización devolvió un error: ${webhookResponse.statusText}`);
    }
    
    // 6. Return success response
    return new Response(JSON.stringify({ success: true, message: "Email request sent to automation service" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return createErrorResponse(error.message || "Un error desconocido ha ocurrido.", 500);
  }
});