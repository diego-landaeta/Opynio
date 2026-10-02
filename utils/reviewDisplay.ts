import { getLocaleFromLanguage, type Language } from '../contexts/i18nContext';

// Autor y fecha de una resena: UNA sola regla para todas las tarjetas.
//
// Antes cada pantalla tenia la suya: Explorar ponia «Anonimo» a resenas de
// usuarios registrados que en la ficha salian con nombre, y la fecha salia
// «28/4/2026» en un sitio y «28/04/26» en otro. Cualquier sitio que pinte una
// resena (tarjeta, listado, JSON-LD) debe pasar por aqui.

interface ReviewAuthorFields {
    user_id?: string | null;
    original_author_name?: string | null;
    author_name?: string | null;
    profiles?: { name?: string | null; username?: string | null } | null;
}

const limpio = (v: string | null | undefined): string | null => {
    const s = (v ?? '').trim();
    return s ? s : null;
};

/**
 * De donde sale el nombre:
 *  1. `original_author_name`: resena importada (Google, Trustindex, scraping)
 *     o cargada en nombre de otra persona. Es el nombre real del autor, aunque
 *     la fila tenga el user_id de la cuenta que la importo. Mismo criterio que
 *     `widget_author_label` en la base de datos.
 *  2. Perfil del usuario registrado: `name`, y si esta vacio, `username`.
 *  3. Nada: `null`, y quien pinta pone «Anonimo» traducido.
 *
 * No existe la opcion de publicar como anonimo: «Anonimo» solo sale cuando de
 * verdad no hay ningun dato.
 */
export const resolveReviewAuthor = (
    review: ReviewAuthorFields
): { name: string | null; fromImport: boolean } => {
    const original = limpio(review.original_author_name);
    if (original) return { name: original, fromImport: true };

    const perfil = review.user_id
        ? limpio(review.profiles?.name) || limpio(review.profiles?.username)
        : null;
    if (perfil) return { name: perfil, fromImport: false };

    const otro = limpio(review.author_name);
    return { name: otro, fromImport: false };
};

export const getReviewAuthorName = (review: ReviewAuthorFields, anonymousLabel: string): string =>
    resolveReviewAuthor(review).name || anonymousLabel;

/**
 * Fecha de la resena con el locale del idioma activo y formato medio
 * («28 abr 2026», «Apr 28, 2026», «2026年4月28日»). Devuelve '' si la fecha
 * no es valida para no pintar «Invalid Date».
 */
export const formatReviewDate = (value: string | number | Date | null | undefined, language: Language): string => {
    if (value === null || value === undefined || value === '') return '';
    const fecha = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(fecha.getTime())) return '';
    try {
        return new Intl.DateTimeFormat(getLocaleFromLanguage(language), { dateStyle: 'medium' }).format(fecha);
    } catch {
        return fecha.toISOString().slice(0, 10);
    }
};
