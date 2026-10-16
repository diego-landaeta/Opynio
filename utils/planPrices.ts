// utils/planPrices.ts
//
// FUENTE UNICA de los precios de los planes de empresa en el front y del
// interruptor de la propuesta nueva (issue #2: Starter 15 / Growth 49 / Pro 99,
// rebaja anual y 3 meses de prueba gratis).
//
// Todo lo nuevo esta DETRAS de NEW_PRICING_ENABLED, apagado: con el
// interruptor apagado la web muestra exactamente lo de siempre (95 / 215 / 419,
// anual = mensual x 12 con un 25 % menos calculado en el front).
//
// Encender = cambiar NEW_PRICING_ENABLED a true y hacer un build nuevo, SOLO
// cuando el responsable haya confirmado los precios y esten creados los precios
// en Stripe y los secrets en Supabase. Orden exacto en docs/PRECIOS-NUEVOS.md.
//
// Lo que se MUESTRA aqui tiene que coincidir con lo que COBRA Stripe: los
// importes reales son los de los Price de Stripe (PLAN_PRICE_IDS en
// supabase/functions/_shared/stripePlans.ts), no estas constantes.

export type PaidPlanKey = 'starter' | 'growth' | 'pro';
export type BillingCycleKey = 'monthly' | 'annual';

/** Interruptor general. false = la web se comporta exactamente como hoy. */
export const NEW_PRICING_ENABLED = false;

/**
 * Dias de prueba gratuita (solo con NEW_PRICING_ENABLED). Tiene que coincidir con
 * el secret TRIAL_DAYS de las Edge Functions (create-checkout-session): el front
 * solo informa, la prueba la aplica el servidor.
 */
export const TRIAL_DAYS = 90;
/** Meses que se anuncian (90 dias = 3 meses). */
export const TRIAL_MONTHS = Math.round(TRIAL_DAYS / 30);
/** Dias antes del fin de la prueba en que sale el correo de aviso (trial-ending-reminder). */
export const TRIAL_REMINDER_DAYS = 7;

/** Precios mensuales de HOY (EUR/mes). No tocar mientras el interruptor este apagado. */
export const PRICES_CURRENT: Record<PaidPlanKey, number> = {
  starter: 95,
  growth: 215,
  pro: 419,
};

/** Descuento anual de HOY: el front calcula mensual x 12 x 0,75. */
export const ANNUAL_FACTOR_CURRENT = 0.75;

/** Precios mensuales NUEVOS (EUR/mes), pedidos por Manuel el 08/10 en la issue #2. */
export const PRICES_NEW: Record<PaidPlanKey, number> = {
  starter: 15,
  growth: 49,
  pro: 99,
};

/**
 * Precio ANUAL nuevo (EUR/ano). PROPUESTA «2 meses gratis», SIN CONFIRMAR por
 * Manuel: 150 / 490 / 990. Si decide otro descuento, se cambia aqui y en el
 * Price anual que se cree en Stripe; los textos («Ahorra X», porcentaje) se
 * calculan solos a partir de estas cifras.
 */
export const ANNUAL_NEW: Record<PaidPlanKey, number> = {
  starter: 150,
  growth: 490,
  pro: 990,
};

/**
 * ¿Los precios nuevos llevan IVA incluido? DECISION PENDIENTE del responsable.
 * Por defecto true porque es lo unico veraz con el codigo de hoy:
 * create-checkout-session NO activa Stripe Tax (no hay automatic_tax), asi que
 * el cliente paga exactamente el importe del Price, sin IVA anadido encima. Si se
 * decide «sin IVA», hay que activar Stripe Tax y anadir automatic_tax al
 * checkout ANTES de poner esto a false (si no, el texto «el IVA se anade al
 * pagar» seria falso). Solo cambia el texto aclaratorio de la pagina de
 * precios (pricingPage.vatIncluded / vatExcluded). Ver docs/PRECIOS-NUEVOS.md.
 */
export const PRICES_INCLUDE_VAT = true;

export function isPaidPlanKey(plan: unknown): plan is PaidPlanKey {
  return plan === 'starter' || plan === 'growth' || plan === 'pro';
}

/** Precio mensual vigente en la web (segun el interruptor). */
export function monthlyPrice(plan: PaidPlanKey): number {
  return NEW_PRICING_ENABLED ? PRICES_NEW[plan] : PRICES_CURRENT[plan];
}

/** Precio anual vigente en la web (segun el interruptor). */
export function annualPrice(plan: PaidPlanKey): number {
  return NEW_PRICING_ENABLED ? ANNUAL_NEW[plan] : PRICES_CURRENT[plan] * 12 * ANNUAL_FACTOR_CURRENT;
}

export function priceFor(plan: PaidPlanKey, cycle: BillingCycleKey): number {
  return cycle === 'annual' ? annualPrice(plan) : monthlyPrice(plan);
}

/** Lo que se ahorra pagando el ano de golpe frente a 12 cuotas mensuales. */
export function annualSavings(plan: PaidPlanKey): number {
  return Math.round((monthlyPrice(plan) * 12 - annualPrice(plan)) * 100) / 100;
}

/** Porcentaje de ahorro anual (entero), p. ej. 17 para «2 meses gratis». */
export function annualSavingsPercent(plan: PaidPlanKey): number {
  const full = monthlyPrice(plan) * 12;
  return full > 0 ? Math.round((1 - annualPrice(plan) / full) * 100) : 0;
}

/** Ahorro anual maximo entre planes (para la etiqueta junto al interruptor). */
export function maxAnnualSavingsPercent(): number {
  return Math.max(...(['starter', 'growth', 'pro'] as PaidPlanKey[]).map(annualSavingsPercent));
}

/**
 * Numero «1.234,50» (siempre con dos decimales), el formato que usa la pagina de
 * precios de hoy. Con `compact`, los importes enteros salen sin decimales
 * («49»); solo se usa con los precios nuevos.
 */
export function formatAmount(amount: number, compact = false): string {
  const digits = compact && Number.isInteger(amount) ? 0 : 2;
  return amount.toLocaleString('es-ES', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Igual que formatAmount, con el simbolo delante: «€1.234,50». */
export function formatEur(amount: number, compact = false): string {
  return `€${formatAmount(amount, compact)}`;
}

/** Importe formateado de un plan y ciclo con el criterio de la web actual. */
export function formatPlanPrice(plan: PaidPlanKey, cycle: BillingCycleKey): string {
  return formatEur(priceFor(plan, cycle), NEW_PRICING_ENABLED);
}

/** Fecha del primer cobro si la prueba empezara hoy (hoy + TRIAL_DAYS). */
export function firstChargeDateFromToday(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + TRIAL_DAYS);
  return d;
}
