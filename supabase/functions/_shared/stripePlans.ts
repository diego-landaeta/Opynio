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

// Precios nuevos (issue #2: Starter 15 / Growth 49 / Pro 99 y anual): sus Price
// IDs se leen de variables de entorno, asi que cambiarlos no exige tocar este
// fichero. El checkout y el cambio de plan del portal usan SOLO esos ids; los
// ids antiguos (PLAN_PRICE_IDS) siguen reconocidos por planForPriceId para las
// suscripciones que ya estan cobrando, pero el dueno los archivo en Stripe y NO
// se pueden contratar (ver LEGACY_PRICE_FALLBACK).
// Los 6 prices deben estar en la cuenta de STRIPE_SECRET_KEY.
//   STRIPE_PRICE_STARTER_MONTHLY_V2   STRIPE_PRICE_STARTER_ANNUAL_V2
//   STRIPE_PRICE_GROWTH_MONTHLY_V2    STRIPE_PRICE_GROWTH_ANNUAL_V2
//   STRIPE_PRICE_PRO_MONTHLY_V2       STRIPE_PRICE_PRO_ANNUAL_V2
// Ver docs/PRECIOS-NUEVOS.md.

/**
 * ¿Una combinacion plan/ciclo SIN su variable STRIPE_PRICE_*_V2 cae al id antiguo
 * de PLAN_PRICE_IDS? false desde que los precios antiguos estan ARCHIVADOS en
 * Stripe: Stripe rechaza crear un checkout con un Price archivado, y ademas un id
 * antiguo cobraria un importe distinto del anunciado. Con false, una variable sin
 * poner bloquea esa combinacion (priceIdFor = null -> 'price_unavailable', sin
 * crear sesion de pago). Solo volver a true si se reactivan los Price antiguos.
 */
export const LEGACY_PRICE_FALLBACK = false;

const ENV_PRICE_PLANS = ["starter", "growth", "pro"] as const;
const ENV_PRICE_CYCLES = ["monthly", "annual"] as const;

/** Resultado de leer los STRIPE_PRICE_*_V2: los ids aceptados y las combinaciones bloqueadas. */
export interface EnvPriceConfig {
  /** Ids nuevos validos, por plan y ciclo. */
  ids: Record<string, { monthly?: string; annual?: string }>;
  /** Combinaciones «plan:ciclo» cuya variable estaba puesta pero se descarto (ver abajo). */
  blocked: Set<string>;
  /** Errores de configuracion, para el log. */
  problems: string[];
  /** Variables sin poner (para avisar de una configuracion parcial). */
  missing: string[];
}

function envVarName(plan: string, cycle: BillingCycle): string {
  return `STRIPE_PRICE_${plan.toUpperCase()}_${cycle.toUpperCase()}_V2`;
}

/**
 * Lee y VALIDA los seis STRIPE_PRICE_*_V2. Funcion pura (recibe el lector de
 * entorno) para poder probarla sin Deno.
 *
 * Defensa contra un error de copia al pegar los Price IDs: si dos variables
 * tienen el MISMO valor, o una variable tiene el id ANTIGUO de otro plan/ciclo
 * (o el del plan de pruebas v2), se IGNORAN todas las variables implicadas y se
 * deja un error claro en el log. Asi un id repetido nunca puede cobrar un plan
 * por otro ni hacer que el webhook active el plan equivocado. Una variable con
 * un valor que no parece un price de Stripe tambien se descarta.
 *
 * Una combinacion descartada queda BLOQUEADA (priceIdFor devuelve null): el
 * checkout responde 'price_unavailable' en vez de caer al precio antiguo, que
 * cobraria un importe distinto del que anuncia la web. Una variable sin poner
 * (vacia) tambien queda bloqueada mientras LEGACY_PRICE_FALLBACK sea false (los
 * precios antiguos estan archivados); con true seguiria con PLAN_PRICE_IDS.
 */
export function resolveEnvPriceConfig(read: (name: string) => string | undefined): EnvPriceConfig {
  const set: { plan: string; cycle: BillingCycle; name: string; value: string }[] = [];
  const blocked = new Set<string>();
  const problems: string[] = [];
  const missing: string[] = [];

  for (const plan of ENV_PRICE_PLANS) {
    for (const cycle of ENV_PRICE_CYCLES) {
      const name = envVarName(plan, cycle);
      const raw = read(name);
      const value = typeof raw === "string" ? raw.trim() : "";
      if (!value) {
        missing.push(name);
        continue;
      }
      if (!/^price_[A-Za-z0-9]+$/.test(value)) {
        blocked.add(`${plan}:${cycle}`);
        problems.push(`${name} no parece un Price ID de Stripe (price_...): se ignora y esa combinacion queda bloqueada.`);
        continue;
      }
      set.push({ plan, cycle, name, value });
    }
  }

  const rejected = new Set<string>(); // nombres de variable descartadas
  // 1) El mismo valor en dos o mas variables.
  const byValue = new Map<string, string[]>();
  for (const e of set) byValue.set(e.value, [...(byValue.get(e.value) ?? []), e.name]);
  for (const [value, names] of byValue) {
    if (names.length < 2) continue;
    names.forEach((n) => rejected.add(n));
    problems.push(
      `ERROR DE CONFIGURACION: ${names.join(" y ")} tienen el MISMO Price ID (${value}). ` +
        `Se ignoran las dos y esas combinaciones quedan bloqueadas hasta que cada una tenga su propio id.`,
    );
  }
  // 2) El valor es un id antiguo de OTRO plan/ciclo (o del plan de pruebas v2).
  for (const e of set) {
    for (const [oldPlan, ids] of Object.entries(PLAN_PRICE_IDS)) {
      const oldCycle = ENV_PRICE_CYCLES.find((c) => ids[c] === e.value);
      if (!oldCycle) continue;
      if (oldPlan === e.plan && oldCycle === e.cycle) continue; // el mismo de siempre: inofensivo
      rejected.add(e.name);
      problems.push(
        `ERROR DE CONFIGURACION: ${e.name} tiene el Price ID antiguo de ${oldPlan}/${oldCycle} (${e.value}). ` +
          `Se ignora y esa combinacion queda bloqueada.`,
      );
    }
  }

  const ids: EnvPriceConfig["ids"] = {};
  for (const e of set) {
    if (rejected.has(e.name)) {
      blocked.add(`${e.plan}:${e.cycle}`);
      continue;
    }
    ids[e.plan] = { ...(ids[e.plan] ?? {}), [e.cycle]: e.value };
  }
  return { ids, blocked, problems, missing };
}

const loggedEnvSignatures = new Set<string>();

function readEnv(name: string): string | undefined {
  try {
    // deno-lint-ignore no-explicit-any
    const raw = (globalThis as any).Deno?.env?.get?.(name);
    return typeof raw === "string" ? raw : undefined;
  } catch {
    return undefined; // sin permiso de entorno (deno test) o sin Deno
  }
}

/** Configuracion de precios nuevos del entorno actual. Los errores se escriben una vez por configuracion distinta. */
export function envPriceConfig(): EnvPriceConfig {
  const cfg = resolveEnvPriceConfig(readEnv);
  const signature = JSON.stringify([cfg.problems, cfg.missing]);
  if (!loggedEnvSignatures.has(signature)) {
    loggedEnvSignatures.add(signature);
    for (const p of cfg.problems) console.error(`[stripePlans] ${p}`);
    if (cfg.missing.length > 0 && cfg.missing.length < ENV_PRICE_PLANS.length * ENV_PRICE_CYCLES.length) {
      console.warn(
        `[stripePlans] Configuracion parcial de precios nuevos: sin poner ${cfg.missing.join(", ")}. ` +
          (LEGACY_PRICE_FALLBACK
            ? `Esas combinaciones siguen cobrando el precio ANTIGUO.`
            : `Esas combinaciones NO se pueden contratar (price_unavailable) hasta que se pongan.`),
      );
    }
  }
  return cfg;
}

/** Price IDs nuevos puestos por entorno (y validos); solo las combinaciones configuradas. */
export function envPriceIds(): Record<string, { monthly?: string; annual?: string }> {
  return envPriceConfig().ids;
}

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

// Planes que estan en el mapa (para que el webhook resuelva las suscripciones que ya
// existen) pero que NO se contratan por autoservicio: ni en Checkout ni como destino
// de cambio de plan en el portal. 'v2' es el plan de pruebas (0,50 EUR/mes) y da las
// funciones de enterprise: dejarlo contratable por cualquier usuario era un agujero.
// NO quitarlo de PLAN_PRICE_IDS: sin el, planNameFromPrice() daria el nombre del
// producto en Stripe ("testeo opynio") a quien ya lo tiene al renovar.
export const NOT_SELF_SERVE_PLANS: readonly string[] = ["v2"];

/** True si el plan existe y puede contratarse (o elegirse como destino) por autoservicio. */
export function isSelfServePlan(plan: unknown): plan is string {
  return typeof plan === "string"
    && Object.prototype.hasOwnProperty.call(PLAN_PRICE_IDS, plan)
    && !NOT_SELF_SERVE_PLANS.includes(plan);
}

/**
 * Price ID de un plan contratable y ciclo, o null si la combinacion no existe,
 * no es de autoservicio o su variable de entorno estaba mal puesta (bloqueada).
 */
export function priceIdFor(plan: unknown, billingCycle: unknown): string | null {
  if (!isSelfServePlan(plan)) return null;
  if (billingCycle !== "monthly" && billingCycle !== "annual") return null;
  const cfg = envPriceConfig();
  // Variable puesta pero descartada (id repetido o de otro plan): no se cobra nada.
  if (cfg.blocked.has(`${plan}:${billingCycle}`)) return null;
  // Id nuevo del entorno; si no esta puesto, bloqueado (los antiguos estan archivados).
  return cfg.ids[plan]?.[billingCycle] ?? (LEGACY_PRICE_FALLBACK ? PLAN_PRICE_IDS[plan][billingCycle] : null);
}

/** Price IDs contratables por autoservicio (para el priceId heredado del front antiguo). */
export function allowedPriceIds(): string[] {
  const cfg = envPriceConfig();
  const antiguos = !LEGACY_PRICE_FALLBACK ? [] : Object.entries(PLAN_PRICE_IDS)
    .filter(([plan]) => isSelfServePlan(plan))
    .flatMap(([plan, p]) => ENV_PRICE_CYCLES.filter((c) => !cfg.blocked.has(`${plan}:${c}`)).map((c) => p[c]));
  const nuevos = Object.values(cfg.ids).flatMap((p) => [p.monthly, p.annual].filter((x): x is string => !!x));
  return [...antiguos, ...nuevos];
}

/** Plan local de un price conocido, o null si no esta en el mapa. */
export function planForPriceId(priceId: unknown): string | null {
  if (typeof priceId !== "string") return null;
  for (const [plan, ids] of Object.entries(PLAN_PRICE_IDS)) {
    if (ids.monthly === priceId || ids.annual === priceId) return plan;
  }
  // Solo ids nuevos ya validados: uno repetido o de otro plan no llega aqui, asi
  // que nunca resuelve a un plan equivocado (el webhook usa esto para activar el plan).
  for (const [plan, ids] of Object.entries(envPriceIds())) {
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
