// Registro completado (issue #18): reglas para lanzar CompleteRegistration UNA
// sola vez por registro. Sin dependencias (ni Supabase ni el pixel) para poder
// comprobarlas sueltas; el envio lo hace trackCompleteRegistration en metaPixel.ts.
//
// Cuando cuenta como registro:
//   - usuario con correo: auth.signUp devuelve una cuenta NUEVA (ver isNewSignUp)
//     y se muestra la pantalla de «Registro completado».
//   - usuario con Google: primera entrada de una cuenta recien creada
//     (ver isFreshOAuthSignUp), al llegar a /post-acceso.
//   - empresa: al terminar el asistente (finishBusinessSignup sin error), antes
//     de llevarle a su panel. El primer paso de /registro no cuenta: ahi la
//     empresa aun no existe.

export type RegistrationKind = 'user' | 'business';

const KEY_PREFIX = 'opynio_pixel_registro';

interface KeyValueStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

const defaultStorage = (): KeyValueStorage | null => {
    try {
        return typeof window !== 'undefined' ? window.localStorage : null;
    } catch {
        return null;
    }
};

// Mismo id en el pixel y en la Conversions API (Meta los deduplica), y fijo
// por cuenta y tipo: si por lo que sea saliera dos veces, es el mismo evento.
export const registrationEventId = (kind: RegistrationKind, userId: string): string =>
    `registro-${kind}-${userId}`;

// Reserva el evento de este registro. Devuelve true solo la primera vez para
// esa cuenta y ese tipo en este navegador: recargar, volver atras o pasar otra
// vez por /post-acceso ya no lo lanza.
export function claimRegistrationEvent(
    kind: RegistrationKind,
    userId: string | null | undefined,
    storage: KeyValueStorage | null = defaultStorage(),
): boolean {
    if (!userId) return false;
    const key = `${KEY_PREFIX}:${kind}:${userId}`;
    try {
        if (storage?.getItem(key)) return false;
        storage?.setItem(key, new Date().toISOString());
    } catch {
        // Sin almacenamiento (modo privado estricto): se lanza igual. Los
        // disparadores son de un solo paso (envio del formulario, fin del
        // asistente, cuenta de Google recien creada) y el event_id fijo deja
        // a Meta deduplicar.
    }
    return true;
}

interface SignUpResultLike {
    user?: { id?: string; identities?: unknown[] | null } | null;
}

// Supabase, con confirmacion por correo, NO da error si el correo ya tiene
// cuenta: devuelve un usuario sin identidades. Eso no es un registro nuevo.
export function isNewSignUp(data: SignUpResultLike | null | undefined): boolean {
    const user = data?.user;
    if (!user?.id) return false;
    return !Array.isArray(user.identities) || user.identities.length > 0;
}

interface AuthUserLike {
    created_at?: string | null;
    last_sign_in_at?: string | null;
    app_metadata?: { provider?: string } | null;
}

// Cuenta creada con Google (u otro proveedor externo) en esta misma entrada:
// la creacion y el ultimo acceso coinciden y fue hace poco. Las cuentas de
// correo cuentan al registrarse (RegisterPage), no aqui.
export function isFreshOAuthSignUp(user: AuthUserLike | null | undefined, now: number = Date.now()): boolean {
    const provider = user?.app_metadata?.provider;
    if (!provider || provider === 'email') return false;
    const created = Date.parse(user?.created_at ?? '');
    const lastSignIn = Date.parse(user?.last_sign_in_at ?? '');
    if (Number.isNaN(created) || Number.isNaN(lastSignIn)) return false;
    const MISMA_ENTRADA_MS = 2 * 60 * 1000;
    const RECIENTE_MS = 30 * 60 * 1000;
    return Math.abs(lastSignIn - created) <= MISMA_ENTRADA_MS && now - created <= RECIENTE_MS;
}
