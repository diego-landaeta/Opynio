// supabase/functions/stripe-webhook/subscriptionSync.ts
//
// Que suscripcion manda en profiles.plan cuando un usuario tiene mas de una viva.
//
// Hasta ahora «Mejorar a X» abria un Checkout nuevo aunque ya hubiera una
// suscripcion activa: el usuario acababa con dos, se le cobraban las dos y el
// perfil lo pisaba el ultimo evento que llegase (la renovacion del plan viejo
// devolvia el perfil al plan viejo; al cancelar cualquiera de las dos, el
// usuario bajaba a free aunque siguiera pagando la otra).
//
// create-checkout-session ya no deja crear una segunda (manda al portal), pero
// puede haber usuarios que ya las tengan. Reglas:
//   - La suscripcion "principal" es la viva mas reciente: primero active/
//     trialing, despues past_due; dentro, la de `created` mas nuevo.
//   - invoice.paid / customer.subscription.updated|created / async_payment de
//     una suscripcion que NO es la principal no tocan el perfil.
//   - customer.subscription.deleted solo baja a free si no queda ninguna viva;
//     si queda otra, el perfil pasa a la principal de las que quedan
//     (verificada contra Stripe por si la fila local estuviera desfasada).
//
// Sin dependencias de red: se prueba con filas falsas.

import { isLiveStatus } from "../_shared/stripePlans.ts";

export type SubscriptionRow = {
  id: string;
  status: string;
  // `created` en produccion; `created_at` en la BD local. Se aceptan los dos.
  created?: string | null;
  created_at?: string | null;
};

function createdMs(row: SubscriptionRow): number {
  const t = Date.parse(String(row.created ?? row.created_at ?? ""));
  return Number.isFinite(t) ? t : 0;
}

function rank(status: string): number {
  return status === "active" || status === "trialing" ? 2 : isLiveStatus(status) ? 1 : 0;
}

/** Filas vivas ordenadas de mas a menos prioritaria. */
export function orderLiveSubscriptions(rows: SubscriptionRow[]): SubscriptionRow[] {
  return rows
    .filter((r) => isLiveStatus(r.status))
    .sort((a, b) => rank(b.status) - rank(a.status) || createdMs(b) - createdMs(a) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
}

/** La suscripcion viva que manda en el perfil, o null si no hay ninguna. */
export function pickPrimarySubscription(rows: SubscriptionRow[]): SubscriptionRow | null {
  return orderLiveSubscriptions(rows)[0] ?? null;
}

/**
 * ¿Puede el evento de `subscriptionId` escribir el plan en el perfil?
 * Si hay otra suscripcion viva que manda, no. Si no hay ninguna viva
 * (p. ej. la propia aun no esta en la BD), se mantiene el comportamiento
 * anterior: si.
 */
export function shouldSyncProfile(subscriptionId: string, liveRows: SubscriptionRow[]): boolean {
  const primary = pickPrimarySubscription(liveRows);
  return !primary || primary.id === subscriptionId;
}

/**
 * Tras borrar `deletedId`: la suscripcion que pasa a mandar, o null (-> free).
 * `verify` devuelve el estado real en Stripe (o null si no existe); las filas
 * que Stripe ya no da por vivas se descartan y se informan en `stale` para que
 * el llamador corrija su estado en la BD.
 */
export async function pickRemainingPrimary(
  rows: SubscriptionRow[],
  deletedId: string,
  verify: (id: string) => Promise<string | null>,
): Promise<{ primary: SubscriptionRow | null; stale: { id: string; status: string | null }[] }> {
  const stale: { id: string; status: string | null }[] = [];
  for (const row of orderLiveSubscriptions(rows.filter((r) => r.id !== deletedId))) {
    const real = await verify(row.id);
    if (isLiveStatus(real)) return { primary: { ...row, status: real as string }, stale };
    stale.push({ id: row.id, status: real });
  }
  return { primary: null, stale };
}
