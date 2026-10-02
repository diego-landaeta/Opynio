import { COUNTRIES, SEDE_COUNTRIES } from '../constants';
import { getLanguageForCountryCode, getLocaleFromLanguage, type Language } from '../contexts/i18nContext';

/**
 * Países cuyo idioma es el mismo que el de la interfaz, para ordenar listados
 * por afinidad (directorio de empresas: primero el país del usuario, luego
 * estos, luego el resto).
 *
 * Se compara el idioma BASE, no el locale: 'gb', 'au', 'ie', 'sg' y 'en' son
 * inglés; 'de' y 'at', alemán; 'pt' y 'br', portugués; 'cn' y 'tw', chino. Así,
 * con la interfaz en español salen ES, MX, AR, CO, CL, PE, EC, GT, CR, PA, UY,
 * VE; en inglés, US, CA, GB, IE, AU, NZ, SG, ZA, NG.
 *
 * Solo se miran los países que la app conoce (COUNTRIES y SEDE_COUNTRIES):
 * todos tienen su caso en getLanguageForCountryCode. Un código sin caso caería
 * en su fallback ('es') y se colaría como hispanohablante; si se añade un país
 * a esas listas, añádelo también allí.
 */
const idiomaBase = (lang: Language): string => getLocaleFromLanguage(lang).split('-')[0];

const CODIGOS: string[] = Array.from(
    new Set([...COUNTRIES, ...SEDE_COUNTRIES].map(c => c.code.toUpperCase()))
);

const cache = new Map<string, string[]>();

export const countriesSharingLanguage = (lang: Language): string[] => {
    const base = idiomaBase(lang);
    let paises = cache.get(base);
    if (!paises) {
        paises = CODIGOS.filter(code => idiomaBase(getLanguageForCountryCode(code)) === base).sort();
        cache.set(base, paises);
    }
    return paises;
};
