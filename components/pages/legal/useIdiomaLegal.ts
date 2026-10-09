import { useLocation } from 'react-router-dom';
import { useI18n, getLanguageForCountryCode, pathTranslations, Language } from '../../../contexts/i18nContext';
import { COUNTRIES } from '../../../constants';

// Idioma del texto legal. Con prefijo de pais (/de/impressum, /us/legal-notice)
// manda el idioma de ese pais: cada URL es la version idiomatica que declara el
// hreflang de Meta.tsx, la vea quien la vea (persona o Google). Sin prefijo
// (/aviso-legal) se usa el idioma de la interfaz. El idioma de la interfaz no
// se toca: el resto de la pagina sigue como el usuario la tenga.
export function useIdiomaLegal(): Language {
    const { language } = useI18n();
    const { pathname } = useLocation();
    const prefijo = (pathname.split('/')[1] || '').toLowerCase();
    if (!prefijo) return language;
    if (COUNTRIES.some(c => c.code.toLowerCase() === prefijo)) return getLanguageForCountryCode(prefijo);
    // Prefijos alias que son codigo de idioma (/cn, /ja, /en…): /cn no es un
    // pais del selector, pero el hreflang lo usa para el chino.
    if (prefijo in pathTranslations) return prefijo as Language;
    return language;
}

// Codigo BCP 47 para el atributo lang del contenido.
const BCP47: Partial<Record<Language, string>> = {
    gb: 'en-GB', au: 'en-AU', ie: 'en-IE', sg: 'en-SG', at: 'de-AT',
    br: 'pt-BR', pt: 'pt-PT', cn: 'zh-CN', tw: 'zh-TW',
};
export const langAttr = (l: Language): string => BCP47[l] ?? l;
