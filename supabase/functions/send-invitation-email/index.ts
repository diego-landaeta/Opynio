// supabase/functions/send-invitation-email/index.ts

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
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
      return createErrorResponse("Configuración incompleta: falta 'MAKE_WEBHOOK_URL'.", 500);
    }

    // 2. Authenticate the user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return createErrorResponse("No se encontró la cabecera de autorización.", 401);
    }
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return createErrorResponse("No autorizado.", 401);
    }
    
    // 3. Get form data from request body
    const { businessName, businessId, emails, message } = await req.json();
    if (!businessName || !businessId || !Array.isArray(emails) || emails.length === 0) {
      return createErrorResponse("Faltan datos en la solicitud (businessName, businessId, emails).", 400);
    }

    // 4. Verify user is the owner of the business (security check)
    const { data: business, error: businessError } = await supabaseClient
        .from('businesses')
        .select('owner_id')
        .eq('id', businessId)
        .single();
    
    if (businessError || !business || business.owner_id !== user.id) {
        return createErrorResponse("No tienes permiso para enviar invitaciones para esta empresa.", 403);
    }

    // 5. Construct email payloads and send them
    const reviewLink = `https://web.opynio.com/escribir?businessId=${businessId}`;
    const subject = `Tu opinión sobre ${businessName} es importante`;
    
    const emailPromises = emails.map(email => {
        const body = `
            <p>Hola,</p>
            <p>${businessName} te invita a compartir tu experiencia en Opynio.</p>
            ${message ? `<p><strong>Mensaje de ${businessName}:</strong><br><em>${message}</em></p>` : ''}
            <p>Tu opinión ayuda a otros a tomar mejores decisiones y a nosotros a mejorar.</p>
            <p><a href="${reviewLink}" style="display: inline-block; padding: 12px 24px; background-color: #00b67a; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Escribe tu reseña ahora</a></p>
            <br>
            <p>¡Gracias!</p>
            <p>El equipo de ${businessName}</p>
        `;

        return fetch(makeWebhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                // Add a type to distinguish from support emails if using the same webhook
                formType: 'invitation', 
                to: email, 
                subject, 
                body 
            }),
        });
    });

    await Promise.all(emailPromises);
    
    // 6. Return success response
    return new Response(JSON.stringify({ success: true, message: "Invitations sent to automation service" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return createErrorResponse(error.message || "Un error desconocido ha ocurrido.", 500);
  }
});
