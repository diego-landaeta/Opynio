// supabase/functions/trial-ending-reminder/plantilla.ts
//
// Texto del correo «tu prueba gratuita acaba pronto». Sin dependencias ni
// efectos al importar. Dos idiomas: espanol (por defecto) e ingles (cuando el
// perfil tiene guardado un idioma distinto del espanol). El idioma se elige con
// elegirIdioma().

export type IdiomaAviso = "es" | "en";

export type DatosAviso = {
  idioma: IdiomaAviso;
  /** Nombre del plan tal como se muestra: Starter, Growth, Pro. */
  plan: string;
  /** Importe ya formateado con moneda: «49,00 €». */
  importe: string;
  /** "month" | "year": cada cuanto se cobra el plan. */
  intervalo: "month" | "year";
  /** Fecha del primer cobro ya formateada: «14 de enero de 2027». */
  fecha: string;
  /** Enlace al panel donde esta «Gestionar facturacion» (abre el portal de Stripe). */
  enlace: string;
};

const ESPANOL_O_CATALAN = new Set(["es", "ca"]);

/** Espanol (o sin idioma guardado) y catalan -> espanol; cualquier otro idioma guardado -> ingles. */
export function elegirIdioma(preferido: string | null | undefined): IdiomaAviso {
  const code = (preferido ?? "").trim().toLowerCase();
  if (!code || ESPANOL_O_CATALAN.has(code)) return "es";
  return "en";
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const boton = (href: string, label: string) =>
  `<p><a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 24px;background-color:#00b67a;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">${escapeHtml(label)}</a></p>`;

export function construirAviso(d: DatosAviso): { asunto: string; html: string } {
  const plan = escapeHtml(d.plan);
  const importe = escapeHtml(d.importe);
  const fecha = escapeHtml(d.fecha);
  if (d.idioma === "en") {
    const cada = d.intervalo === "year" ? "per year" : "per month";
    return {
      asunto: `Your ${d.plan} plan starts on ${d.fecha}: ${d.importe}`,
      html: `
      <p>Hello,</p>
      <p>Your free trial of Opynio ends on <strong>${fecha}</strong>. That day your <strong>${plan}</strong> plan starts and <strong>${importe}</strong> ${cada} will be charged to the card you gave us.</p>
      <p>Until that day you have full access to every feature, with no limits. From then on you will have what the <strong>${plan}</strong> plan includes.</p>
      <p>You don't need to do anything to continue. If you would rather change plan or cancel, do it before that date and you will not be charged.</p>
      ${boton(d.enlace, "Change plan or cancel")}
      <p style="color:#6b7280;font-size:13px">In your panel, press «Manage billing» to open the secure payment portal.</p>
      <p>The Opynio team</p>`,
    };
  }
  const cada = d.intervalo === "year" ? "al año" : "al mes";
  return {
    asunto: `El ${d.fecha} empieza tu plan ${d.plan}: ${d.importe}`,
    html: `
      <p>Hola,</p>
      <p>Tu prueba gratuita de Opynio termina el <strong>${fecha}</strong>. Ese día empieza tu plan <strong>${plan}</strong> y se cobrarán <strong>${importe}</strong> ${cada} a la tarjeta que nos indicaste.</p>
      <p>Hasta ese día tienes acceso completo a todas las funciones, sin límites. Desde entonces tendrás lo que incluye el plan <strong>${plan}</strong>.</p>
      <p>Si quieres continuar, no tienes que hacer nada. Si prefieres cambiar de plan o cancelar, hazlo antes de esa fecha y no se te cobrará nada.</p>
      ${boton(d.enlace, "Cambiar de plan o cancelar")}
      <p style="color:#6b7280;font-size:13px">En tu panel, pulsa «Gestionar facturación» para abrir el portal de pago seguro.</p>
      <p>El equipo de Opynio</p>`,
  };
}
