/**
 * Nombres de empresa: comparacion y errores de duplicado.
 *
 * En produccion `businesses.name` es UNIQUE (`businesses_name_key`), sensible a
 * mayusculas, tildes y espacios. El usuario no debe llegar a ver el error de
 * Postgres: se avisa ANTES de enviar con una comparacion mas estricta que la
 * del servidor (sin mayusculas, sin tildes, espacios colapsados), y si el
 * servidor rechaza igualmente el nombre, el error se traduce al mismo mensaje.
 */

/** Nombre tal y como se guarda: sin espacios en los extremos y con los repetidos colapsados. */
export function cleanBusinessName(name: unknown): string {
    return typeof name === 'string' ? name.normalize('NFC').trim().replace(/\s+/g, ' ') : '';
}

/**
 * Clave de comparacion: «Academía   Local» y «academia local» dan la misma.
 * El resultado NO es un nombre para guardar ni para ensenar.
 */
export function normalizeBusinessNameKey(name: unknown): string {
    return cleanBusinessName(name)
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase();
}

/**
 * Patron ILIKE que encuentra un SUPERCONJUNTO de los nombres equivalentes a
 * `name`: las letras que pueden llevar tilde (a, e, i, o, u, n, c...) pasan a
 * `_` (un caracter cualquiera), los espacios a `%` y los comodines del usuario
 * (`%`, `_`, `\`) se escapan. Quien lo use filtra despues con
 * `normalizeBusinessNameKey`.
 */
export function businessNameCandidatePattern(name: string): string {
    const key = normalizeBusinessNameKey(name);
    let out = '';
    for (const ch of key) {
        if (ch === '%' || ch === '_' || ch === '\\') out += '\\' + ch;
        else if (ch === ' ') out += '%';
        else if (/[acdeghijklnorstuwyz]/.test(ch)) out += '_';
        else out += ch;
    }
    return out;
}

/**
 * ¿Es el error de «ya existe una empresa con ese nombre» de Postgres/PostgREST?
 * 23505 sobre la columna `name` (se mira la columna del `details` y, de reserva,
 * el nombre de la restriccion: la restriccion de otras columnas, como
 * `businesses_google_maps_url_key` o `businesses_slug_key`, NO es esto).
 */
export function isBusinessNameConflict(err: unknown): boolean {
    const e = (err ?? {}) as { code?: unknown; message?: unknown; details?: unknown };
    if (String(e.code ?? '') !== '23505') return false;
    const text = `${String(e.details ?? '')} ${String(e.message ?? '')}`;
    return /Key \(name\)=/i.test(text) || /businesses_name_key/i.test(text);
}
