import { useMemo } from 'react';
import { getSubcategoryKey, getCategorySpanishName } from '../../../../utils/categoryMappings';

/** Una cola se considera «atrasada» cuando lo que espera lleva MAS de 3 dias. */
export const LATE_AFTER_MS = 3 * 24 * 3600 * 1000;

const time = (iso: string | null | undefined): number => {
    if (!iso) return NaN;
    const ms = new Date(iso).getTime();
    return Number.isFinite(ms) ? ms : NaN;
};

/** ¿Lleva esperando mas de 3 dias? Una fecha ausente o rota no cuenta como atrasada. */
export const isLate = (iso: string | null | undefined, now: number): boolean => {
    const ms = time(iso);
    return Number.isFinite(ms) && now - ms > LATE_AFTER_MS;
};

/**
 * Antiguedad en texto del idioma activo («hace 4 dias»). Minutos hasta la hora,
 * horas hasta las 48 h y dias enteros a partir de ahi (4 dias y 20 h son
 * «hace 4 dias»: con lo que de verdad ha pasado, no redondeado hacia arriba).
 */
export const relativeAge = (iso: string | null | undefined, locale: string, now: number): string => {
    const ms = time(iso);
    if (!Number.isFinite(ms)) return '';
    const minutes = Math.max(0, now - ms) / 60000;
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'always' });
    if (minutes < 60) return rtf.format(-Math.max(1, Math.round(minutes)), 'minute');
    const hours = minutes / 60;
    if (hours < 48) return rtf.format(-Math.round(hours), 'hour');
    return rtf.format(-Math.floor(hours / 24), 'day');
};

/** Formatos numericos del idioma activo (agrupacion de miles siempre, tambien en 4 cifras). */
export const useNumberFormats = (locale: string) =>
    useMemo(() => {
        const full = new Intl.NumberFormat(locale, { useGrouping: 'always' } as unknown as Intl.NumberFormatOptions);
        const dec2 = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const signed = (d: number) => new Intl.NumberFormat(locale, { signDisplay: 'exceptZero', useGrouping: 'always' } as unknown as Intl.NumberFormatOptions).format(d);
        const signed2 = (d: number) => new Intl.NumberFormat(locale, { signDisplay: 'exceptZero', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(d);
        // El signo menos tipografico (U+2212) en vez del guion: se lee como resta, no como rango.
        const minus = (s: string) => s.replace(/^[-\u2010-\u2012\u2212]/, '\u2212');
        return {
            n: (v: number) => full.format(v),
            /** Para los contadores de la barra lateral: por encima de 9.999 se recorta a «9.999+». */
            badge: (v: number) => (v > 9999 ? `${full.format(9999)}+` : full.format(v)),
            dec2: (v: number) => dec2.format(v),
            signed: (v: number) => minus(signed(v)),
            signed2: (v: number) => minus(signed2(v)),
        };
    }, [locale]);

/** Une una lista con el «y» del idioma activo (Intl.ListFormat); si el navegador no lo trae, con comas. */
export const joinList = (items: string[], locale: string): string => {
    try {
        const LF = (Intl as any).ListFormat;
        if (LF) return new LF(locale, { style: 'long', type: 'conjunction' }).format(items);
    } catch { /* cae a la coma */ }
    return items.join(', ');
};

// Ultimo recurso cuando la clave guardada no esta en los locales: que al menos
// se lea como texto. Mismo criterio que ReviewCard y BusinessPage.
const humanize = (value: string): string => value.replace(/_/g, ' ').trim();

/**
 * Nombre visible de la categoria de una empresa («Educacion y Formacion»,
 * «Salud: Fisioterapia»). Misma regla que ReviewCard.getCategoryTranslation.
 */
export const categoryLabel = (raw: string | null | undefined, t: (k: string) => string): string => {
    if (!raw) return '';
    let main = raw;
    let sub = '';
    if (raw.includes(':')) {
        [main, sub] = raw.split(':');
        main = main.trim();
        sub = sub.trim();
    }
    const key = getCategorySpanishName(main);
    const translatedMain = t(`categories.${key}`);
    const mainLabel = translatedMain.startsWith('categories.') ? humanize(main) : translatedMain;
    if (!sub) return mainLabel;
    const subKey = sub.includes('_') ? sub : getSubcategoryKey(sub);
    if (!subKey) return `${mainLabel}: ${humanize(sub)}`;
    const translatedSub = t(`subcategories.${subKey}`);
    return `${mainLabel}: ${translatedSub.startsWith('subcategories.') ? humanize(sub) : translatedSub}`;
};

/** Ruta (sin dominio ni parametros) de una URL de pagina, para el informe de errores. */
export const pathOf = (url: string | null | undefined): string => {
    if (!url) return '';
    try {
        const p = new URL(url, 'http://x');
        return decodeURIComponent(p.pathname) || '/';
    } catch {
        return url.slice(0, 80);
    }
};
