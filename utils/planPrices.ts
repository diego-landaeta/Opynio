/**
 * Precios de los planes de pago. FUENTE UNICA: los usan la pagina de Planes
 * (PricingPage) y las pantallas de funcion bloqueada del panel de empresa
 * (dashboard/LockedFeaturePreview). Si cambia un precio, se cambia aqui y en
 * ningun otro sitio.
 *
 * Importes en euros por mes, con facturacion mensual. Enterprise no tiene
 * precio publico («a medida»), por eso no esta aqui.
 */
export type PaidPlanId = 'starter' | 'growth' | 'pro';

export const PLAN_MONTHLY_PRICE: Record<PaidPlanId, number> = {
    starter: 95,
    growth: 215,
    pro: 419,
};

/** Factor del pago anual sobre 12 mensualidades (0.75 = «Ahorra 25%»). */
export const ANNUAL_PRICE_FACTOR = 0.75;

/** Orden de los planes de pago, de menor a mayor. */
export const PAID_PLAN_ORDER: readonly PaidPlanId[] = ['starter', 'growth', 'pro'];

/** Total de un ano de plan con facturacion anual. */
export const annualPrice = (monthly: number): number => monthly * 12 * ANNUAL_PRICE_FACTOR;

/** Importe con el formato de la pagina de Planes (€ con dos decimales, estilo es-ES). */
export const formatPlanPrice = (amount: number): string =>
    amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
