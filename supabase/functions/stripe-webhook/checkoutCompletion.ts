// supabase/functions/stripe-webhook/checkoutCompletion.ts
//
// Llamada a la RPC process_checkout_completion con reintentos acotados para los
// dos choques de UNIQUE que dejaban al cliente cobrado y sin empresa.
//
// Problema: si el INSERT de la empresa de un alta pagada choca con un UNIQUE, la
// RPC da 23505, la transaccion entera hace rollback, el webhook responde 500 y
// Stripe reintenta durante dias... siempre con el mismo resultado. Mientras,
// customer.subscription.created ya ha guardado la suscripcion: el cliente queda
// cobrado, sin empresa, sin rol y sin plan.
//
// 1) google_maps_url duplicada (UNIQUE en local; en produccion hoy no lo es):
//    se repite SIN la URL de Maps y se avisa en el log.
// 2) Nombre duplicado (en produccion businesses_name_key UNIQUE(name); en local
//    no hay UNIQUE sobre name): se repite como "Nombre (2)", "Nombre (3)"...
//    hasta MAX_NAME_SUFFIX y, si todos estan ocupados, "Nombre (<final del id
//    de la suscripcion>)", unico por pago; se avisa en el log.
//    Por que no asignarle la empresa existente sin dueno: seria saltarse la
//    verificacion de reclamaciones (claims). Cualquiera podria quedarse con la
//    ficha de un competidor, con sus resenas, pagando un plan con su nombre.
//    Una empresa nueva con sufijo no quita nada a nadie; el admin decide despues
//    si fusiona (reclamacion) o renombra. Ademas create-checkout-session ya
//    rechaza ANTES de cobrar un nombre existente (code business_name_taken): esto
//    solo cubre la carrera entre la sesion de pago y el webhook.
//
// La RPC es una transaccion: un intento fallido no deja nada escrito, asi que el
// siguiente es una ejecucion limpia y no puede duplicar la empresa. Solo se
// reintenta en un alta nueva que no sea reintento del mismo checkout. Cualquier
// otro error se devuelve tal cual (el handler lo relanza y Stripe reintenta).
//
// Sin dependencias de red ni efectos al importar: se prueba con una RPC falsa.

import { MAX_NAME_SUFFIX, lastResortBusinessName, suffixedBusinessName } from "../_shared/businessName.ts";

export type RpcError = { code?: string; message?: string; details?: string | null; hint?: string | null };
export type RpcCaller = (
  fn: string,
  params: Record<string, unknown>,
) => PromiseLike<{ error: RpcError | null }>;

export const CHECKOUT_RPC = "process_checkout_completion";

export function isGoogleMapsUrlConflict(error: RpcError | null | undefined): boolean {
  if (!error || error.code !== "23505") return false;
  const text = `${error.message ?? ""} ${error.details ?? ""}`;
  return text.includes("google_maps_url");
}

// Columnas del UNIQUE violado, de "Key (name)=(Foo) already exists." o
// "Key (lower(name))=(foo) already exists." (indice funcional).
function conflictColumns(details: string | null | undefined): string {
  const m = /Key \((.*?)\)=\(/.exec(details ?? "");
  return m ? m[1] : "";
}

/**
 * 23505 sobre el nombre de la empresa. No depende del nombre del constraint
 * (businesses_name_key en produccion; otro nombre o un indice funcional en otra
 * BD): mira la columna en `details` y, si no viene, un constraint de businesses
 * cuyo nombre contenga "name".
 */
export function isBusinessNameConflict(error: RpcError | null | undefined): boolean {
  if (!error || error.code !== "23505") return false;
  if (isGoogleMapsUrlConflict(error)) return false;
  const cols = conflictColumns(error.details);
  if (cols) return /(^|[^a-z0-9_])name([^a-z0-9_]|$)/i.test(cols);
  return /unique constraint "businesses_[a-z0-9_]*name[a-z0-9_]*"/i.test(error.message ?? "");
}

export type CheckoutCompletionResult = {
  error: RpcError | null;
  /** URL de Maps que se quito para poder crear la empresa (null si no hizo falta). */
  droppedGoogleMapsUrl: string | null;
  /** Nombre con sufijo con el que se creo la empresa (null si se creo con el suyo). */
  renamedBusinessTo: string | null;
};

export async function runCheckoutCompletion(
  rpc: RpcCaller,
  params: Record<string, unknown>,
  warn: (message: string) => void = console.warn,
): Promise<CheckoutCompletionResult> {
  const canRetry = params.p_is_new_business === true && params.p_already_processed !== true;
  const baseName = typeof params.p_business_name === "string" ? params.p_business_name : "";
  const who = `usuario ${String(params.p_user_id ?? "")} (sub ${String(params.p_subscription_id ?? "")})`;

  let current = { ...params };
  let droppedGoogleMapsUrl: string | null = null;
  let renamedBusinessTo: string | null = null;
  let suffix = 1;
  let usedLastResort = false;

  // Como mucho: 1 intento + 1 sin URL de Maps + (MAX_NAME_SUFFIX - 1) sufijos
  // + 1 con el nombre de ultimo recurso.
  for (;;) {
    const { error } = await rpc(CHECKOUT_RPC, current);
    if (!error) return { error: null, droppedGoogleMapsUrl, renamedBusinessTo };
    if (!canRetry) return { error, droppedGoogleMapsUrl: null, renamedBusinessTo: null };

    const mapsUrl = current.p_business_google_maps_url;
    if (isGoogleMapsUrlConflict(error) && typeof mapsUrl === "string" && mapsUrl.trim() !== "") {
      warn(
        `[stripe-webhook] AVISO: google_maps_url ya usada por otra empresa (${mapsUrl}). ` +
          `Se crea la empresa pagada "${String(current.p_business_name ?? "")}" del ${who} SIN URL de Maps. ` +
          `Revisar si hay que fusionarla o reasignar la existente.`,
      );
      droppedGoogleMapsUrl = mapsUrl;
      current = { ...current, p_business_google_maps_url: null };
      continue;
    }

    if (isBusinessNameConflict(error) && baseName.trim() !== "") {
      let next: string | null = null;
      if (suffix < MAX_NAME_SUFFIX) {
        suffix++;
        next = suffixedBusinessName(baseName, suffix);
      } else if (!usedLastResort) {
        // "(2)".."(10)" ocupados: nombre unico con el final del id de la
        // suscripcion antes que dejar el cobro sin empresa.
        usedLastResort = true;
        next = lastResortBusinessName(baseName, params.p_subscription_id);
      }
      if (next) {
        warn(
          `[stripe-webhook] AVISO: ya existe una empresa llamada "${String(current.p_business_name ?? "")}". ` +
            `Se crea la empresa pagada del ${who} como "${next}". ` +
            `Revisar si es la misma empresa (reclamacion/fusion) o si hay que renombrarla.`,
        );
        renamedBusinessTo = next;
        current = { ...current, p_business_name: next };
        continue;
      }
    }

    return { error, droppedGoogleMapsUrl: null, renamedBusinessTo: null };
  }
}
