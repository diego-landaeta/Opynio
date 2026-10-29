// supabase/functions/send-invitation-email/index.ts

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enviarBrevo, enviosRestantesBrevo, leerClaveBrevo } from "../_shared/brevo.ts";

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
    const { businessId, emails, message, productId, resendOf } = await req.json();
    if (!businessId || !Array.isArray(emails) || emails.length === 0) {
      return createErrorResponse("Faltan datos en la solicitud (businessId, emails).", 400);
    }

    // Emails validos, sin repetir y con tope: sin tope, el formulario servia
    // para mandar correos masivos en nombre de Opynio.
    const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;
    const recipients = [...new Set(emails.map((e: unknown) => String(e).trim().toLowerCase()))]
      .filter(e => EMAIL_RE.test(e) && e.length <= 254);
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
        .select('owner_id, name, contact_email, logo_url')
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

    // La clave de Brevo se comprueba ANTES de reservar cuota: una configuracion
    // rota no debe gastar el limite diario del dueno.
    let brevoKey: string;
    try {
      brevoKey = await leerClaveBrevo();
    } catch (e) {
      console.error("send-invitation-email: sin clave de Brevo:", e);
      return createErrorResponse("Configuración incompleta del servicio de correo.", 500);
    }

    // Cupo de la cuenta de Brevo (plan Free compartido). Con el cupo agotado Brevo contesta
    // 201 sin enviar nada y el panel decia «Enviada» (issue #5). Se mira ANTES de reservar la
    // cuota del dueno. Si no se puede saber (API caida, sin tope diario), no se bloquea.
    const enviosRestantes = await enviosRestantesBrevo(brevoKey);
    if (enviosRestantes !== null && enviosRestantes < recipients.length) {
      console.warn(`send-invitation-email: cupo de Brevo insuficiente (quedan ${enviosRestantes}, se piden ${recipients.length}).`);
      return createErrorResponse(
        "El servicio de correo ha alcanzado su límite diario de envíos. No se ha enviado nada ni se ha gastado tu cuota: inténtalo de nuevo más tarde.",
        503,
      );
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

    // 5. Un identificador por destinatario viaja en el enlace: asi la invitacion
    //    pasa a "abierta" y a "reseña escrita" cuando la persona actua.
    //    La ruta es /escribir-resena (antes /escribir, que no existe y abria la
    //    home). Con producto, el formulario llega con el curso preseleccionado.
    const businessName = escapeHtml(business.name);
    const subjectName = product ? `${product.name} (${business.name})` : business.name;
    // Asunto en texto plano (sin escapar), pero sin saltos de linea ni controles.
    const subject = `Tu opinión sobre ${subjectName} es importante`
      .replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ');
    const safeMessage = message ? escapeHtml(String(message).slice(0, 1000)).replace(/\n/g, '<br>') : '';
    const aboutProduct = product ? ` sobre <strong>${escapeHtml(product.name)}</strong>` : '';
    const logoUrl = /^https:\/\/[^\s"'<>]+$/.test(String(business.logo_url ?? '')) ? String(business.logo_url) : '';
    const replyTo = EMAIL_RE.test(String(business.contact_email ?? '').trim())
      ? String(business.contact_email).trim()
      : undefined;

    const construirCorreo = (invitationId: string) => {
      const params = new URLSearchParams({ businessId, invitacion: invitationId });
      if (product) params.set('producto', product.id);
      const reviewLink = `https://web.opynio.com/escribir-resena?${params.toString()}`;
      return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 12px;"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <tr><td style="background:#00b67a;padding:16px 24px;color:#ffffff;font-size:20px;font-weight:bold;">Opynio</td></tr>
    <tr><td style="padding:24px 24px 8px 24px;">
      ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="${businessName}" height="48" style="display:block;max-height:48px;width:auto;margin:0 0 16px 0;">` : ''}
      <h1 style="margin:0 0 12px 0;font-size:20px;line-height:26px;color:#111827;">${businessName} quiere conocer tu opinión</h1>
      <p style="margin:0 0 12px 0;font-size:15px;line-height:22px;">Hola, ${businessName} te invita a compartir tu experiencia${aboutProduct} en Opynio.</p>
      ${safeMessage ? `<p style="margin:0 0 12px 0;font-size:15px;line-height:22px;padding:12px 14px;background:#f4f6f8;border-radius:8px;"><strong>Mensaje de ${businessName}:</strong><br><em>${safeMessage}</em></p>` : ''}
      <p style="margin:0 0 20px 0;font-size:15px;line-height:22px;">Tu opinión ayuda a otras personas a decidir mejor. Solo te llevará un par de minutos.</p>
      <p style="margin:0 0 20px 0;"><a href="${reviewLink}" style="display:inline-block;padding:13px 26px;background:#00b67a;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;">Escribir mi reseña</a></p>
      <p style="margin:0 0 4px 0;font-size:12px;line-height:18px;color:#6b7280;">Si el botón no funciona, copia este enlace en tu navegador:<br><a href="${reviewLink}" style="color:#00b67a;word-break:break-all;">${reviewLink}</a></p>
    </td></tr>
    <tr><td style="padding:12px 24px 20px 24px;font-size:12px;line-height:18px;color:#9ca3af;">Recibes este correo porque ${businessName} te ha invitado a través de Opynio. Si no esperabas este mensaje, puedes ignorarlo.</td></tr>
  </table>
</td></tr></table>
</body></html>`;
    };

    // Envio por Brevo, de 5 en 5: cada resultado se conoce de verdad (antes se
    // daba por enviado lo que Make aceptaba, y Make contestaba 200 siempre).
    type Resultado = { id: string; email: string; ok: boolean; error?: string };
    const resultados: Resultado[] = [];
    const mensajeGuardado = message ? String(message).slice(0, 1000) : null;
    let historyError: unknown = null;
    for (let i = 0; i < recipients.length; i += 5) {
      const lote = recipients.slice(i, i + 5);
      const hechos = await Promise.all(lote.map(async (email): Promise<Resultado> => {
        const id = crypto.randomUUID();
        try {
          await enviarBrevo(brevoKey, {
            para: email,
            asunto: subject,
            html: construirCorreo(id),
            remitenteNombre: `${String(business.name).slice(0, 40)} (vía Opynio)`,
            responderA: replyTo,
          });
          return { id, email, ok: true };
        } catch (e) {
          console.error(`send-invitation-email: fallo enviando (user ${user.id}):`, (e as Error).message);
          return { id, email, ok: false, error: String((e as Error).message ?? e).slice(0, 200) };
        }
      }));
      resultados.push(...hechos);

      // Reenvio de una invitacion fallida que vuelve a fallar: no se anade otra fila
      // «Fallida» (quedarian dos del mismo correo); se actualiza el error de la que ya
      // estaba, solo de ESTA empresa y solo si seguia fallida.
      if (typeof resendOf === 'string' && recipients.length === 1 && hechos.length === 1 && !hechos[0].ok) {
        const { error: errorActualizar } = await supabaseAdmin.from('review_invitations')
          .update({ error: hechos[0].error ?? 'Error de envío' })
          .eq('id', resendOf)
          .eq('business_id', businessId)
          .eq('status', 'failed');
        if (errorActualizar) {
          historyError = errorActualizar;
          console.error("send-invitation-email: no se pudo actualizar la invitacion fallida:", errorActualizar);
        }
        continue;
      }

      // Historial: una fila por destinatario, enviada o fallida, guardada tras cada
      // lote. Si guardar falla, los correos ya salieron: se avisa en la respuesta.
      const { error: errorLote } = await supabaseAdmin.from('review_invitations').insert(
        hechos.map(r => ({
          id: r.id,
          business_id: businessId,
          sent_by: user.id,
          email: r.email,
          product_id: product?.id ?? null,
          message: mensajeGuardado,
          status: r.ok ? 'sent' : 'failed',
          error: r.ok ? null : (r.error ?? 'Error de envío'),
        })),
      );
      if (errorLote) {
        historyError = errorLote;
        console.error("send-invitation-email: no se pudo guardar el historial:", errorLote);
      }
    }

    // Reenvio de una invitacion fallida: si ha salido, se retira la fila fallida
    // (solo de ESTA empresa y solo si seguia fallida), para que no queden dos.
    if (typeof resendOf === 'string' && recipients.length === 1 && resultados[0]?.ok) {
      const { error: errorBorrar } = await supabaseAdmin.from('review_invitations')
        .delete()
        .eq('id', resendOf)
        .eq('business_id', businessId)
        .eq('status', 'failed');
      if (errorBorrar) console.error("send-invitation-email: no se pudo retirar la invitacion fallida:", errorBorrar);
    }

    const failed = resultados.filter(r => !r.ok).length;
    if (failed > 0) {
      console.error(`send-invitation-email: ${failed}/${recipients.length} envios fallidos (user ${user.id}).`);
    }

    // 6. La respuesta dice la verdad: cuantos salieron, cuantos no y cuales.
    return new Response(JSON.stringify({
      success: failed < resultados.length,
      sent: resultados.length - failed,
      failed,
      historySaved: !historyError,
      results: resultados.map(r => ({ email: r.email, ok: r.ok, error: r.ok ? undefined : 'send_failed' })),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return createErrorResponse(error.message || "Un error desconocido ha ocurrido.", 500);
  }
});
