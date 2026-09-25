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

const MAX_RECIPIENTS = 50;

// Cuota por usuario: destinatarios en 24 h, contados en BD
// (invitation_sends + reserve_invitation_quota, migracion 20260924140000).
const DAILY_RECIPIENT_LIMIT = 200;

// Misma jerarquia que DashboardInvitations.tsx (FeatureLock requiredPlan="starter").
// Antes el plan solo se comprobaba en el front: un dueno free llamaba a la
// funcion directamente y enviaba igual.
const PLAN_LEVEL: Record<string, number> = {
  free: 0,
  starter: 1,
  growth: 2,
  pro: 3,
  v2: 4,
  enterprise: 4,
};
const REQUIRED_PLAN_LEVEL = PLAN_LEVEL.starter;

// El nombre de la empresa y el mensaje los escribe el dueno: sin escapar, podia
// meter HTML arbitrario (enlaces de phishing) en un correo enviado por Opynio.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
    // 1. Authenticate the user (el secreto de Make se mira despues de validar
    //    todo: antes un anonimo podia saber si estaba configurado).
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
    
    // 2. Get form data from request body
    const { businessId, emails, message, productId } = await req.json();
    if (!businessId || !Array.isArray(emails) || emails.length === 0) {
      return createErrorResponse("Faltan datos en la solicitud (businessId, emails).", 400);
    }

    // Emails validos, sin repetir y con tope: sin tope, el formulario servia
    // para mandar correos masivos en nombre de Opynio.
    const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;
    const recipients = [...new Set(emails.map((e: unknown) => String(e).trim().toLowerCase()))]
      .filter(e => EMAIL_RE.test(e));
    if (recipients.length === 0) {
      return createErrorResponse("Ningún email válido en la lista.", 400);
    }
    if (recipients.length > MAX_RECIPIENTS) {
      return createErrorResponse(`Máximo ${MAX_RECIPIENTS} emails por envío.`, 400);
    }

    // 4. Verify user is the owner of the business (security check)
    //    El nombre sale de la BD, no del body: antes se podia firmar el correo
    //    con el nombre de cualquier marca.
    const { data: business, error: businessError } = await supabaseClient
        .from('businesses')
        .select('owner_id, name')
        .eq('id', businessId)
        .single();

    if (businessError || !business || business.owner_id !== user.id) {
        return createErrorResponse("No tienes permiso para enviar invitaciones para esta empresa.", 403);
    }

    // 4b. Plan del dueno (quien llama ES el dueno: comprobado arriba). Se lee con
    //     service_role para no depender de la RLS de profiles.
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const { data: ownerProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) {
      return createErrorResponse("No se pudo comprobar tu plan. Inténtalo de nuevo.", 500);
    }
    const planLevel = PLAN_LEVEL[String(ownerProfile?.plan ?? 'free')] ?? 0;
    if (planLevel < REQUIRED_PLAN_LEVEL) {
      return createErrorResponse("Las invitaciones por email requieren el plan Starter o superior.", 403);
    }

    const makeWebhookUrl = Deno.env.get("MAKE_WEBHOOK_URL");
    if (!makeWebhookUrl) {
      return createErrorResponse("Configuración incompleta: falta 'MAKE_WEBHOOK_URL'.", 500);
    }

    // 4c. Cuota diaria. Se reserva ANTES de enviar y cuenta aunque el envio
    //     falle despues: reintentar en bucle no debe regalar cuota.
    const { data: quota, error: quotaError } = await supabaseAdmin.rpc('reserve_invitation_quota', {
      p_user_id: user.id,
      p_business_id: businessId,
      p_recipients: recipients.length,
      p_daily_limit: DAILY_RECIPIENT_LIMIT,
    });
    if (quotaError || !quota) {
      console.error("reserve_invitation_quota:", quotaError);
      return createErrorResponse("No se pudo comprobar el límite de envíos. Inténtalo más tarde.", 500);
    }
    if (!quota.allowed) {
      const remaining = Number(quota.remaining ?? 0);
      return createErrorResponse(
        remaining > 0
          ? `Límite de ${DAILY_RECIPIENT_LIMIT} invitaciones cada 24 horas: ahora mismo puedes enviar ${remaining} más.`
          : `Has alcanzado el límite de ${DAILY_RECIPIENT_LIMIT} invitaciones cada 24 horas. Inténtalo más tarde.`,
        429,
      );
    }

    // Producto opcional: solo si es de esta empresa y esta activo.
    let product: { id: string; name: string } | null = null;
    if (productId) {
      const { data: found } = await supabaseClient
        .from('review_subjects')
        .select('id, name')
        .eq('id', productId)
        .eq('business_id', businessId)
        .eq('is_active', true)
        .maybeSingle();
      product = found ?? null;
    }

    // 5. Construct email payloads and send them
    //    La ruta es /escribir-resena (antes /escribir, que no existe y abria la
    //    home). Con producto, el formulario llega con el curso preseleccionado.
    const params = new URLSearchParams({ businessId });
    if (product) params.set('producto', product.id);
    const reviewLink = `https://web.opynio.com/escribir-resena?${params.toString()}`;

    const businessName = escapeHtml(business.name);
    const subjectName = product ? `${product.name} (${business.name})` : business.name;
    // Asunto en texto plano (sin escapar), pero sin saltos de linea ni controles.
    const subject = `Tu opinión sobre ${subjectName} es importante`
      .replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ');
    const safeMessage = message ? escapeHtml(String(message).slice(0, 1000)).replace(/\n/g, '<br>') : '';
    const aboutProduct = product ? ` sobre <strong>${escapeHtml(product.name)}</strong>` : '';

    const emailPromises = recipients.map(email => {
        const body = `
            <p>Hola,</p>
            <p>${businessName} te invita a compartir tu experiencia${aboutProduct} en Opynio.</p>
            ${safeMessage ? `<p><strong>Mensaje de ${businessName}:</strong><br><em>${safeMessage}</em></p>` : ''}
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

    // Antes se ignoraba la respuesta de Make: un 4xx/5xx se daba por enviado.
    const results = await Promise.allSettled(emailPromises);
    const failed = results.filter(r => r.status === 'rejected' || !r.value.ok).length;
    if (failed > 0) {
      console.error(`send-invitation-email: ${failed}/${recipients.length} envios fallidos (user ${user.id}).`);
    }
    if (failed === recipients.length) {
      return createErrorResponse("El servicio de envío no respondió. Inténtalo de nuevo más tarde.", 502);
    }

    // 6. Return success response
    return new Response(JSON.stringify({ success: true, sent: recipients.length - failed, failed, message: "Invitations sent to automation service" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return createErrorResponse(error.message || "Un error desconocido ha ocurrido.", 500);
  }
});
