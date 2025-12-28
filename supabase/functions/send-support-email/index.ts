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
    // 1. Get Make.com Webhook URL from secrets
    const makeWebhookUrl = Deno.env.get("MAKE_WEBHOOK_URL");

    if (!makeWebhookUrl) {
      const errorMessage = `Configuración incompleta. Falta el secreto 'MAKE_WEBHOOK_URL' en el proyecto de Supabase.`;
      return createErrorResponse(errorMessage, 500);
    }

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
    const { formType, data } = await req.json();
    if (!formType || !data) {
      return createErrorResponse("Faltan datos en la solicitud.", 400);
    }

    // 4. Construct email subject and body
    let subject = "";
    let body = "";

    if (formType === 'bug') {
        subject = `Nuevo Reporte de Bug de: ${data.username}`;
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
        subject = `Nueva Solicitud de Reclamación de Empresa: ${data.username}`;
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
                <li><strong>Web oficial de la empresa:</strong> <a href="${data.websiteUrl}">${data.websiteUrl}</a></li>
                <li><strong>Teléfono de la empresa:</strong> ${data.phone}</li>
            </ul>
            <strong>Comentarios adicionales:</strong><br> 
            <pre style="background-color: #f4f4f4; padding: 10px; border: 1px solid #ddd; border-radius: 5px; white-space: pre-wrap; word-wrap: break-word;">${data.comments || 'Sin comentarios.'}</pre>
        `;
    } else if (formType === 'claim_review') {
        subject = `Apelación de Reseña Rechazada por: ${data.username}`;
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