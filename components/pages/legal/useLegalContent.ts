import { useEffect, useState } from 'react';
import type { Language } from '../../../contexts/i18nContext';
import type { LegalContent } from './types';
import es from './content/es';

// Las variantes de pais comparten texto con su idioma base.
type Code = Exclude<Language, 'gb' | 'au' | 'ie' | 'sg' | 'at'>;
const ALIAS: Partial<Record<Language, Code>> = { gb: 'en', au: 'en', ie: 'en', sg: 'en', at: 'de' };

// Un import() por idioma, igual que LOCALE_LOADERS en i18nContext: cada texto
// legal va en su propio chunk y solo se descarga el del idioma activo. El
// español va en el chunk de la pagina porque es el idioma por defecto.
const LOADERS: Record<Exclude<Code, 'es'>, () => Promise<{ default: LegalContent }>> = {
    en: () => import('./content/en'),
    ca: () => import('./content/ca'),
    fr: () => import('./content/fr'),
    it: () => import('./content/it'),
    pt: () => import('./content/pt'),
    br: () => import('./content/br'),
    nl: () => import('./content/nl'),
    de: () => import('./content/de'),
    sv: () => import('./content/sv'),
    pl: () => import('./content/pl'),
    ru: () => import('./content/ru'),
    tr: () => import('./content/tr'),
    vi: () => import('./content/vi'),
    ar: () => import('./content/ar'),
    fa: () => import('./content/fa'),
    hi: () => import('./content/hi'),
    bn: () => import('./content/bn'),
    th: () => import('./content/th'),
    tl: () => import('./content/tl'),
    id: () => import('./content/id'),
    ms: () => import('./content/ms'),
    ja: () => import('./content/ja'),
    ko: () => import('./content/ko'),
    cn: () => import('./content/cn'),
    tw: () => import('./content/tw'),
};

const cache: Partial<Record<Code, LegalContent>> = { es };

const codigo = (lang: Language): Code => ALIAS[lang] ?? (lang as Code);

/** Texto legal del idioma activo; null mientras se descarga. */
export function useLegalContent(lang: Language): LegalContent | null {
    const code = codigo(lang);
    const [content, setContent] = useState<LegalContent | null>(cache[code] ?? null);

    useEffect(() => {
        const enCache = cache[code];
        if (enCache) { setContent(enCache); return; }
        let vivo = true;
        setContent(null);
        const cargar = code === 'es' ? null : LOADERS[code];
        if (!cargar) { setContent(es); return; }
        cargar()
            .then(m => { cache[code] = m.default; if (vivo) setContent(m.default); })
            // Sin red o chunk caducado tras un despliegue: mejor el español que nada.
            .catch(() => { if (vivo) setContent(es); });
        return () => { vivo = false; };
    }, [code]);

    return content;
}
