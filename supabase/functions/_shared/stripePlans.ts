// supabase/functions/_shared/stripePlans.ts
//
// Planes de pago <-> Stripe Price IDs. Fuente unica para create-checkout-session,
// create-portal-session, get-checkout-status y stripe-webhook (antes cada una
// tenia su copia y el webhook deducia el plan del NOMBRE del producto en Stripe).
//
// Sin dependencias ni efectos al importar: se prueba con deno test.
//
// Para anadir/cambiar un plan hay que tocar este mapa Y los productos en el
// Dashboard de Stripe. Ver docs/04-STRIPE-INTEGRATION.md (seccion 4).

export type BillingCycle = "monthly" | "annual";

// 'v2' es un plan premium de prueba con un unico price (sin distincion
// mensual/anual): se usa el mismo price para los dos ciclos.
export const V2_PRICE_ID = "price_1TTqZNRJqlZctcvhV711xZuz";

// OJO starter.annual: su segmento de cuenta (GP3zN1neHA) no coincide con el del
// resto (RJqlZctcvh). Probablemente es de la cuenta de Stripe antigua. Si no
// existe en la cuenta de STRIPE_SECRET_KEY, create-checkout-session responde
// 'price_unavailable' y lo deja en el log. Pendiente de confirmar en el
// Dashboard (docs/04-STRIPE-INTEGRATION.md, seccion 4).
export const PLAN_PRICE_IDS: Record<string, { monthly: string; annual: string }> = {
  starter: { monthly: "price_1SIEGvRJqlZctcvhh3VMcupC", annual: "price_1TTo2CGP3zN1neHAplpNdMDD" },
  growth:  { monthly: "price_1SIEJeRJqlZctcvhrzuA4wR8", annual: "price_1TTqWBRJqlZctcvhY78cLeWP" },
  pro:     { monthly: "price_1SIELiRJqlZctcvhQ3xP8rwa", annual: "price_1TTqYARJqlZctcvholBtHK17" },
  v2:      { monthly: V2_PRICE_ID,                     annual: V2_PRICE_ID },
};

export const PLAN_LIMITS: Record<string, number> = {
  free: 1, starter: 1, growth: 3, pro: 10, v2: 20, enterprise: 2147483647,
};

// Estados en los que una suscripcion sigue viva (Stripe la cobra o la va a
// reintentar cobrar). past_due cuenta: Stripe sigue reintentando el cobro y el
// plan se mantiene hasta customer.subscription.deleted.
export const LIVE_SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due"] as const;

export function isLiveStatus(status: unknown): boolean {
  return typeof status === "string" && (LIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(status);
}

/** Price ID de un plan y ciclo, o null si la combinacion no existe. */
export function priceIdFor(plan: unknown, billingCycle: unknown): string | null {
  if (typeof plan !== "string" || !Object.prototype.hasOwnProperty.call(PLAN_PRICE_IDS, plan)) return null;
  if (billingCycle !== "monthly" && billingCycle !== "annual") return null;
  return PLAN_PRICE_IDS[plan][billingCycle];
}

/** Todos los price IDs permitidos (para el priceId heredado del front antiguo). */
export function allowedPriceIds(): string[] {
  return Object.values(PLAN_PRICE_IDS).flatMap((p) => [p.monthly, p.annual]);
}

/** Plan local de un price conocido, o null si no esta en el mapa. */
export function planForPriceId(priceId: unknown): string | null {
  if (typeof priceId !== "string") return null;
  for (const [plan, ids] of Object.entries(PLAN_PRICE_IDS)) {
    if (ids.monthly === priceId || ids.annual === priceId) return plan;
  }
  return null;
}

/**
 * Plan local de una suscripcion: primero el mapa de prices (fiable); si el
 * price no esta, el nombre del producto en Stripe en minusculas (lo que hacia
 * el webhook antes, p. ej. producto "Growth" -> 'growth').
 */
export function planNameFromPrice(priceId: string, fallbackProductName: string): string {
  return planForPriceId(priceId) ?? fallbackProductName.toLowerCase();
}
