// supabase/functions/_shared/invitacionExterna.ts
//
// Registro de invitaciones a reseñar que NO nacen en el panel de la empresa (Certifex#97).
//
// El correo del diploma de Certifex lleva «Valóranos en Opynio». Aquí se deja constancia de que
// ese alumno ha sido invitado: la fila entra en `review_invitations` y sale en el historial de la
// empresa, y el enlace del correo lleva su id para que Opynio marque «abierta» y «reseña escrita»
// (mark_invitation_opened / mark_invitation_reviewed, igual que con las invitaciones del panel).
//
// NO envía ningún correo ni gasta la cuota de Brevo del dueño: el correo ya lo manda Certifex.
//
// Lógica pura, sin Deno ni red: la base se inyecta (`Db`). Así se prueba con `node --test`
// (ver invitacionExterna.test.ts) aunque en este repo no haya Deno ni marco de pruebas de funciones.

/** Quién puede aparecer en la dirección de la ficha de una empresa. */
const HOSTS_OPYNIO = ["web.opynio.com", "www.opynio.com", "opynio.com"];

/** Invitaciones externas que una empresa puede recibir en 24 h: tope por si la clave se filtrara. */
export const LIMITE_DIARIO = 500;

/** Una invitación del mismo correo y empresa dentro de este plazo se reutiliza, no se duplica. */
export const DIAS_REUTILIZAR = 30;

// Sin espacios, comas ni punto y coma, y sin caracteres de control (un NUL hacía fallar el insert).
const EMAIL_RE = /^[^\s@<>"',;\u0000-\u001f\u007f]+@[^\s@<>"',;\u0000-\u001f\u007f]+\.[^\s@<>"',;\u0000-\u001f\u007f]+$/;
const MAX_CUERPO = 2000;

export interface Db {
  empresaPorSlug(slug: string): Promise<{ id: string } | null>;
  /** La invitación vigente (no fallida) de ese correo en esa empresa, si la hay. */
  invitacionVigente(businessId: string, email: string, desde: Date): Promise<{ id: string } | null>;
  /** Cuántas invitaciones externas (sin `sent_by`) tiene la empresa desde ese instante. */
  externasDesde(businessId: string, desde: Date): Promise<number>;
  crearInvitacion(businessId: string, email: string): Promise<{ id: string }>;
}

export interface Deps {
  /** El secreto compartido con Certifex (CERTIFEX_REGISTRO_CLAVE). Sin él, la función no atiende. */
  claveEsperada: string | undefined;
  db: Db;
  ahora?: () => number;
}

/** El slug de una ficha: `https://web.opynio.com/es/empresa/<slug>` → `<slug>`. null si no lo es. */
export function slugDeOpynioUrl(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || !HOSTS_OPYNIO.includes(u.hostname)) return null;
  // Ni puerto ni usuario:contraseña en la dirección: una ficha de Opynio no los lleva nunca.
  if (u.port !== "" || u.username !== "" || u.password !== "") return null;
  const partes = u.pathname.split("/").filter(Boolean);
  // /<país>/<empresa|company|azienda…>/<slug>: la palabra del medio cambia con el idioma.
  if (partes.length < 3) return null;
  let slug: string;
  try {
    slug = decodeURIComponent(partes[partes.length - 1]);
  } catch {
    return null;
  }
  return /^[\p{L}\p{N}_-]{1,150}$/u.test(slug) ? slug : null;
}

/** Comparación en tiempo constante: no deja adivinar la clave por lo que tarda en fallar. */
export function clavesIguales(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  const n = Math.max(ea.length, eb.length);
  for (let i = 0; i < n; i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

export type Entrada = { ok: true; slug: string; email: string } | { ok: false; error: string };

export function validarEntrada(cuerpo: unknown): Entrada {
  if (!cuerpo || typeof cuerpo !== "object") return { ok: false, error: "Cuerpo no válido." };
  const { opynioUrl, email } = cuerpo as Record<string, unknown>;
  if (typeof opynioUrl !== "string" || opynioUrl.length > 300) return { ok: false, error: "Falta la dirección de la ficha de Opynio." };
  const slug = slugDeOpynioUrl(opynioUrl);
  if (!slug) return { ok: false, error: "La dirección no es la ficha de una empresa de Opynio." };
  if (typeof email !== "string") return { ok: false, error: "Falta el correo." };
  const correo = email.trim().toLowerCase();
  if (correo.length > 254 || !EMAIL_RE.test(correo)) return { ok: false, error: "El correo no es válido." };
  return { ok: true, slug, email: correo };
}

const json = (cuerpo: unknown, status: number) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });

export async function manejar(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  // Sin clave configurada o con una clave mala se contesta lo mismo (401): un anónimo no debe
  // poder saber si la función está configurada. El motivo real va al registro del servidor.
  const esperada = deps.claveEsperada;
  if (!esperada || esperada.length < 24) {
    console.error("registrar-invitacion-externa: CERTIFEX_REGISTRO_CLAVE sin configurar o demasiado corta.");
    return json({ error: "No autorizado." }, 401);
  }
  const recibida = req.headers.get("x-registro-clave") ?? "";
  if (!clavesIguales(recibida, esperada)) return json({ error: "No autorizado." }, 401);

  let texto: string;
  try {
    texto = await req.text();
  } catch {
    return json({ error: "Cuerpo no válido." }, 400);
  }
  if (texto.length > MAX_CUERPO) return json({ error: "Cuerpo demasiado grande." }, 413);
  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    return json({ error: "Cuerpo no válido." }, 400);
  }
  const entrada = validarEntrada(cuerpo);
  if (!entrada.ok) return json({ error: entrada.error }, 400);

  try {
    const empresa = await deps.db.empresaPorSlug(entrada.slug);
    if (!empresa) return json({ error: "Empresa no encontrada." }, 404);

    const ahora = deps.ahora ? deps.ahora() : Date.now();
    const vigente = await deps.db.invitacionVigente(empresa.id, entrada.email, new Date(ahora - DIAS_REUTILIZAR * 86_400_000));
    if (vigente) return json({ id: vigente.id, businessId: empresa.id, reutilizada: true }, 200);

    const hoy = await deps.db.externasDesde(empresa.id, new Date(ahora - 86_400_000));
    if (hoy >= LIMITE_DIARIO) return json({ error: "Límite diario alcanzado." }, 429);

    const nueva = await deps.db.crearInvitacion(empresa.id, entrada.email);
    return json({ id: nueva.id, businessId: empresa.id, reutilizada: false }, 200);
  } catch (e) {
    // Nada de la base ni el correo del alumno en la respuesta ni en el registro.
    console.error("registrar-invitacion-externa: fallo de base de datos:", (e as { code?: string })?.code ?? "sin código");
    return json({ error: "No se pudo registrar la invitación." }, 500);
  }
}
