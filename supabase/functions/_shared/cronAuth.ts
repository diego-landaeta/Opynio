// Autorizacion de las tareas programadas (pg_cron -> Edge Function): `Authorization: Bearer <secreto>`.
//
// Acepta el secreto CRON_SECRET del entorno de la funcion Y el guardado en Supabase Vault con el nombre 'cron_secret'
// (lo genera la propia base de datos, nunca se ve ni se copia a mano; la tarea lo lee de Vault al ejecutarse y la funcion
// lo pide con la RPC cron_secret(), solo para service_role). Asi las tareas funcionan sin tocar los secretos de las funciones.
// Sin ninguno de los dos configurados falla cerrado (401).

/** Comparacion en tiempo constante para no filtrar el secreto por timing. */
export function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < Math.max(ab.length, bb.length); i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

/** Funcion pura: ¿coincide la cabecera con alguno de los secretos validos? Recorre todos (no corta al primero). */
export function isCronAuthorized(authHeader: string, secretos: ReadonlyArray<string | null | undefined>): boolean {
  const validos = secretos.filter((s): s is string => typeof s === "string" && s.length > 0);
  if (validos.length === 0) return false;
  let ok = false;
  for (const s of validos) if (safeEqual(authHeader, `Bearer ${s}`)) ok = true;
  return ok;
}

// deno-lint-ignore no-explicit-any
type RpcClient = { rpc: (fn: string) => PromiseLike<{ data: any; error: unknown }> };

/** Secreto de Vault via RPC (null si no existe o falla la consulta: entonces solo vale el del entorno). */
export async function secretoDeVault(admin: RpcClient): Promise<string | null> {
  try {
    const { data, error } = await admin.rpc("cron_secret");
    if (error) return null;
    return typeof data === "string" && data.length > 0 ? data : null;
  } catch {
    return null;
  }
}

/** Autoriza una peticion de una tarea programada. `admin` es un cliente con service_role. */
export async function cronAuthorized(req: Request, envSecret: string | undefined, admin: RpcClient): Promise<boolean> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const vault = await secretoDeVault(admin);
  const ok = isCronAuthorized(authHeader, [envSecret, vault]);
  if (!envSecret && !vault) console.error("cron: ni CRON_SECRET ni el secreto de Vault estan configurados; peticion rechazada.");
  return ok;
}
