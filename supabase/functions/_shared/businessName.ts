// supabase/functions/_shared/businessName.ts
//
// Nombres de empresa en el alta con pago. Sin dependencias: se prueba con deno test.
//
// En produccion businesses.name es UNIQUE (businesses_name_key, sensible a
// mayusculas). create-checkout-session rechaza ANTES de cobrar un nombre que ya
// existe (comparando sin mayusculas ni espacios de los extremos). Si aun asi
// choca al crear la empresa (otra alta con el mismo nombre entre la sesion de
// pago y el webhook), el webhook la crea como "Nombre (2)", "Nombre (3)"... y,
// si hasta "(10)" estan ocupados, con el final del id de la suscripcion, en vez
// de dejar el cobro sin empresa (ver stripe-webhook/checkoutCompletion.ts).

/** Sufijo mas alto que prueba el webhook: "Nombre (2)" ... "Nombre (10)". */
export const MAX_NAME_SUFFIX = 10;

/** Clave de comparacion: sin espacios en los extremos, NFC y en minusculas. */
export function normalizeBusinessName(name: unknown): string {
  return typeof name === "string" ? name.normalize("NFC").trim().toLowerCase() : "";
}

/** Nombre con sufijo de desempate: n=1 es el nombre tal cual. */
export function suffixedBusinessName(base: string, n: number): string {
  return n <= 1 ? base : `${base} (${n})`;
}

/**
 * Ultimo recurso si "Nombre" ... "Nombre (10)" estan todos ocupados: sufijo con
 * el final del id de la suscripcion. Es unico por pago (no choca con otra alta)
 * y estable entre reintentos del mismo evento (el reintento lo reconoce). Asi
 * un cobro nunca se queda sin empresa por el nombre. null sin id.
 */
export function lastResortBusinessName(base: string, subscriptionId: unknown): string | null {
  const token = typeof subscriptionId === "string" ? subscriptionId.replace(/^sub_/, "").slice(-10) : "";
  return token ? `${base} (${token})` : null;
}

/**
 * Todos los nombres que puede acabar teniendo la empresa de un alta pagada:
 * el pedido, los sufijos (2)..(10) y, si se pasa la suscripcion, el de ultimo
 * recurso.
 */
export function businessNameCandidates(base: string, subscriptionId?: unknown): string[] {
  const out: string[] = [];
  for (let n = 1; n <= MAX_NAME_SUFFIX; n++) out.push(suffixedBusinessName(base, n));
  const last = lastResortBusinessName(base, subscriptionId);
  if (last) out.push(last);
  return out;
}

/**
 * Patron ILIKE sin comodines del usuario: %, _, * (PostgREST lo traduce a %)
 * y \ pasan a "_" (un caracter cualquiera). El patron encuentra un superconjunto
 * y el llamador filtra despues con normalizeBusinessName.
 */
export function ilikeExactPattern(name: string): string {
  return name.trim().replace(/[\\%_*]/g, "_");
}
