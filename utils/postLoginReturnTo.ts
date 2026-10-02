/**
 * A donde volver tras iniciar sesion (LoginPage lo guarda, PostLoginRedirect
 * lo consume). Va en localStorage y no en memoria porque el login con Google
 * sale de la pagina.
 *
 * Lleva marca de tiempo y caduca a los 10 minutos: se guarda ANTES de
 * intentar el login, y si el login fallaba o se cancelaba Google, el destino
 * se quedaba ahi y el siguiente login (horas o dias despues) acababa en una
 * pagina que ya no tocaba. Un valor antiguo sin marca (texto plano) se
 * descarta por lo mismo.
 */
const KEY = 'postLoginReturnTo';
const MAX_AGE_MS = 10 * 60 * 1000;

// Solo rutas internas: nada que empiece por "//" o lleve protocolo.
const isInternalPath = (path: unknown): path is string =>
    typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\');

export const rememberPostLoginReturnTo = (path: string | null | undefined): void => {
    try {
        if (isInternalPath(path)) {
            localStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }));
        } else {
            // Un intento nuevo sin destino no debe heredar el de uno anterior.
            localStorage.removeItem(KEY);
        }
    } catch { /* modo privado: se sigue el flujo normal */ }
};

export const forgetPostLoginReturnTo = (): void => {
    try {
        localStorage.removeItem(KEY);
    } catch { /* idem */ }
};

/** Lee y BORRA el destino. Devuelve null si no hay, ha caducado o no es interno. */
export const takePostLoginReturnTo = (): string | null => {
    let raw: string | null = null;
    try {
        raw = localStorage.getItem(KEY);
        if (raw !== null) localStorage.removeItem(KEY);
    } catch {
        return null;
    }
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as { path?: unknown; at?: unknown };
        const at = Number(parsed?.at);
        if (!Number.isFinite(at) || Date.now() - at > MAX_AGE_MS || at > Date.now() + 60_000) return null;
        return isInternalPath(parsed?.path) ? parsed.path : null;
    } catch {
        return null;
    }
};
