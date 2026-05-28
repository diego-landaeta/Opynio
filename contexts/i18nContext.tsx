import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { translateText } from "../services/geminiService";
import esTranslations from '../locales/es';
import enTranslations from '../locales/en';
import brTranslations from "../locales/br";
import caTranslations from "../locales/ca";
import frTranslations from "../locales/fr";
import deTranslations from "../locales/de";
import itTranslations from "../locales/it";
import cnTranslations from "../locales/cn";
import svTranslations from "../locales/sv";
import plTranslations from "../locales/pl";
import jaTranslations from "../locales/ja";
import ptTranslations from "../locales/pt";
import gbTranslations from "../locales/gb";
import auTranslations from "../locales/au";
import koTranslations from "../locales/ko";
import arTranslations from "../locales/ar";
import nlTranslations from "../locales/nl";
import ruTranslations from "../locales/ru";
import idTranslations from "../locales/id";
import msTranslations from "../locales/ms";
import twTranslations from "../locales/tw";
import thTranslations from "../locales/th";
import faTranslations from "../locales/fa";
import viTranslations from "../locales/vi";
import bnTranslations from "../locales/bn";
import hiTranslations from "../locales/hi";
import tlTranslations from "../locales/tl";

export type Language = "es" | "en" | "br" | "ca" | "fr" | "de" | "it" | "cn" | "sv" | "pl" | "ja" | "pt" | "gb" | "au" | "ko" | "ar" | "nl" | "ru" | "id" | "ms" | "tw" | "th" | "fa" | "vi" | "bn" | "hi" | "tl";

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export const translations = {
  es: esTranslations,
  en: enTranslations,
  br: brTranslations,
  ca: caTranslations,
  fr: frTranslations,
  de: deTranslations,
  it: itTranslations,
  cn: cnTranslations,
  sv: svTranslations,
  pl: plTranslations,
  ja: jaTranslations,
  pt: ptTranslations,
  gb: gbTranslations,
  au: auTranslations,
  ko: koTranslations,
  ar: arTranslations,
  nl: nlTranslations,
  ru: ruTranslations,
  id: idTranslations,
  ms: msTranslations,
  tw: twTranslations,
  th: thTranslations,
  fa: faTranslations,
  vi: viTranslations,
  bn: bnTranslations,
  hi: hiTranslations,
  tl: tlTranslations,
};

export const pathTranslations: {
  es: typeof esTranslations.paths;
  en: typeof enTranslations.paths;
  br: typeof brTranslations.paths;
  ca: typeof caTranslations.paths;
  fr: typeof frTranslations.paths;
  de: typeof deTranslations.paths;
  it: typeof itTranslations.paths;
  cn: typeof cnTranslations.paths;
  sv: typeof svTranslations.paths;
  pl: typeof plTranslations.paths;
  ja: typeof jaTranslations.paths;
  pt: typeof ptTranslations.paths;
  gb: typeof gbTranslations.paths;
  au: typeof auTranslations.paths;
  ko: typeof koTranslations.paths;
  ar: typeof arTranslations.paths;
  nl: typeof nlTranslations.paths;
  ru: typeof ruTranslations.paths;
  id: typeof idTranslations.paths;
  ms: typeof msTranslations.paths;
  tw: typeof twTranslations.paths;
  th: typeof thTranslations.paths;
  fa: typeof faTranslations.paths;
  vi: typeof viTranslations.paths;
  bn: typeof bnTranslations.paths;
  hi: typeof hiTranslations.paths;
  tl: typeof tlTranslations.paths;
} = {
  es: esTranslations.paths,
  en: enTranslations.paths,
  br: brTranslations.paths,
  ca: caTranslations.paths,
  fr: frTranslations.paths,
  de: deTranslations.paths,
  it: itTranslations.paths,
  cn: cnTranslations.paths,
  sv: svTranslations.paths,
  pl: plTranslations.paths,
  ja: jaTranslations.paths,
  pt: ptTranslations.paths,
  gb: gbTranslations.paths,
  au: auTranslations.paths,
  ko: koTranslations.paths,
  ar: arTranslations.paths,
  nl: nlTranslations.paths,
  ru: ruTranslations.paths,
  id: idTranslations.paths,
  ms: msTranslations.paths,
  tw: twTranslations.paths,
  th: thTranslations.paths,
  fa: faTranslations.paths,
  vi: viTranslations.paths,
  bn: bnTranslations.paths,
  hi: hiTranslations.paths,
  tl: tlTranslations.paths,
};

// Detecta el idioma al que pertenece un segmento del path comparándolo
// contra los basePath registrados en pathTranslations. Devuelve null si
// no matchea nada. Los segmentos compartidos por varios idiomas (p.ej.
// "widgets", "support") devuelven el primer match — irrelevante porque
// el contenido renderizado es el mismo.
export const detectLanguageFromPath = (pathSegment: string | null | undefined): Language | null => {
    if (!pathSegment) return null;
    const languages = Object.keys(pathTranslations) as Language[];
    for (const lang of languages) {
        const paths = pathTranslations[lang];
        for (const value of Object.values(paths)) {
            const basePath = (value as string).split('/')[0].split(':')[0];
            if (basePath && (pathSegment === basePath || pathSegment.startsWith(basePath + '/'))) {
                return lang;
            }
        }
    }
    return null;
};

// Detecta si la ruta corresponde a un dashboard (admin, panel del business
// owner, mis-negocios, migrar-google-reviews, completar-registro-empresa).
// Usado para ocultar selectores de idioma/país que no deberían estar
// disponibles dentro del panel — la URL de los dashboards está atada al
// país de la empresa y cambiar el idioma rompería navegación.
export const isDashboardRoute = (pathname: string): boolean => {
    if (pathname.startsWith('/admin')) return true;

    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) return false;

    // El primer segmento puede ser un código de país (us, es, fr…) — si lo es,
    // el segmento relevante es el siguiente. Importamos los países perezosamente
    // para evitar un import circular con constants.ts (que importa types).
    // Los códigos de país ISO 3166-1 alpha-2 son siempre 2 letras.
    const first = segments[0].toLowerCase();
    const looksLikeCountry = first.length === 2 && /^[a-z]{2}$/.test(first);
    const rawSeg = looksLikeCountry && segments.length > 1 ? segments[1] : segments[0];
    const seg = decodeURIComponent(rawSeg);

    // Recorre las traducciones de paths de cada idioma y comprueba si el
    // segmento corresponde a un path de dashboard.
    const languages = Object.keys(pathTranslations) as Language[];
    for (const lang of languages) {
        const paths = pathTranslations[lang];
        const dashboardSegs = [
            paths.myBusinesses,
            paths.businessDashboard?.split('/')[0],
            paths.completeBusinessRegistration?.split('/')[0],
            paths.migrateGoogleReviews?.split('/')[0],
        ].filter(Boolean);
        if (dashboardSegs.some(p => seg === p || seg.startsWith(p + '/'))) {
            return true;
        }
    }
    return false;
};

// País por defecto que canonicaliza un idioma en el dominio raíz.
// Cuando la URL es /login (sin country prefix), su canonical apunta a
// /us/login porque "us" es el país default para inglés. Español NO se
// mapea porque el dominio raíz ES la versión canónica española.
export const LANGUAGE_DEFAULT_COUNTRY: Partial<Record<Language, string>> = {
    en: 'us',
    de: 'de',
    fr: 'fr',
    it: 'it',
    br: 'br',
    ca: 'ad',
    cn: 'cn',
    sv: 'se',
    pl: 'pl',
    ja: 'jp',
    pt: 'pt',
    gb: 'gb',
    au: 'au',
    ko: 'kr',
    ar: 'ae',
    nl: 'nl',
    ru: 'ru',
    id: 'id',
    ms: 'my',
    tw: 'tw',
    th: 'th',
    fa: 'ir',
    vi: 'vn',
    bn: 'bd',
    hi: 'in',
    tl: 'ph',
};

// Maps a country code from the URL to a language code for path generation.
export const getLanguageForCountryCode = (countryCode: string | null | undefined): Language => {
    if (!countryCode) return 'es';
    const uc = countryCode.toUpperCase();
    switch (uc) {
        case 'US':
        case 'CA':
            return 'en';
        case 'GB':
        case 'IE':
        case 'SG':
        case 'NZ':
        case 'ZA':
        case 'NG':
            return 'gb';
        case 'IN':
            return 'hi';
        case 'PH':
            return 'tl';
        case 'AU':
            return 'au';
        case 'KR':
            return 'ko';
        case 'AE':
        case 'SA':
        case 'KW':
        case 'EG':
            return 'ar';
        case 'NL':
            return 'nl';
        case 'RU':
            return 'ru';
        case 'ID':
            return 'id';
        case 'MY':
            return 'ms';
        case 'TW':
        case 'HK':
            return 'tw';
        case 'TH':
            return 'th';
        case 'IR':
            return 'fa';
        case 'VN':
            return 'vi';
        case 'BD':
            return 'bn';
        case 'BR':
            return 'br';
        case 'PT':
            return 'pt';
        case 'FR':
            return 'fr';
        case 'DE':
            return 'de';
        case 'IT':
            return 'it';
        case 'AD':
            return 'ca';
        case 'CN':
            return 'cn';
        case 'SE':
            return 'sv';
        case 'PL':
            return 'pl';
        case 'JP':
            return 'ja';
        // All other Spanish-speaking countries map to 'es'
        case 'ES':
        case 'MX':
        case 'CO':
        case 'AR':
        case 'PE':
        case 'VE':
        case 'CL':
        case 'EC':
        case 'GT':
        case 'CR':
        case 'PA':
        case 'UY':
            return 'es';
        default:
            return 'es'; // Fallback to Spanish
    }
};

export const translateCategoryString = (
  categoryString: string | null | undefined,
  t: (key: string, params?: Record<string, string | number>) => string
): string => {
  if (!categoryString || !categoryString.includes(":")) {
    return categoryString || t("common.unspecified");
  }
  const [mainKey, subKey] = categoryString.split(":");
  const main = t(`categories.${mainKey.trim()}`);
  const sub = t(`subcategories.${subKey.trim()}`);

  if (main.startsWith("categories.") || sub.startsWith("subcategories.")) {
    // Fallback for missing translations
    return categoryString.replace(":", ": ").replace(/_/g, " ");
  }
  return `${main}: ${sub}`;
};

export const getNestedTranslation = (obj: any, key: string): string | undefined => {
    if (!obj || !key) return undefined;
    return key.split('.').reduce((o, i) => (o ? o[i] : undefined), obj);
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [language, setLanguageState] = useState<Language>(() => {
    // Initialize from localStorage or default to 'es'
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('opynio_language');
      if (saved && ['es', 'en', 'br', 'ca', 'fr', 'de', 'it', 'cn', 'sv', 'pl', 'ja', 'pt', 'gb', 'au', 'ko', 'ar', 'nl', 'ru', 'id', 'ms', 'tw', 'th', 'fa', 'vi', 'bn', 'hi', 'tl'].includes(saved)) {
        return saved as Language;
      }
    }
    return 'es';
  });

  // Wrap setLanguage to also persist to localStorage + set dir for RTL
  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('opynio_language', lang);
      const isRTL = ['ar', 'he', 'fa', 'ur'].includes(lang);
      document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
      document.documentElement.lang = lang;
    }
  }, []);

  const t = useCallback(
    (key: string, params: Record<string, string | number> = {}): string => {
      // Create a composite key to try and find the translation
      const keysToTry = key.includes('.') ? [key] : Object.keys(translations[language]).map(section => `${section}.${key}`);
      
      let translation: string | undefined;
      for (const k of keysToTry) {
          translation = getNestedTranslation(translations[language], k);
          if (translation) break;
      }
      
      // Fallback to Spanish (main language) if not found in current language
      if (!translation) {
           for (const k of keysToTry) {
              translation = getNestedTranslation(translations.es, k);
              if (translation) break;
          }
      }

      // If still not found, return the key itself
      translation = translation || key;

      for (const param in params) {
        translation = translation.replace(`{${param}}`, String(params[param]));
      }
      return translation;
    },
    [language]
  );

  const value = { language, setLanguage, t };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
};

export const useTranslation = () => {
  const { t } = useI18n();
  return t;
};

/**
 * Hook for translating a single piece of dynamic text.
 * Handles caching, loading states, and provides a toggle to show the original text.
 */
export function useAutoTranslation(originalText: string | null | undefined) {
  const { language } = useI18n();
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setTranslatedText(null);
    setShowOriginal(false);
    setIsTranslating(false);

    if (originalText) {
      setIsTranslating(true);
      translateText(originalText, language)
        .then(result => { if (!cancelled) setTranslatedText(result); })
        .catch(() => { if (!cancelled) console.error("Translation failed for:", originalText); })
        .finally(() => { if (!cancelled) setIsTranslating(false); });
    }

    return () => { cancelled = true; };
  }, [originalText, language]);

  const textToDisplay = !showOriginal && translatedText ? translatedText : originalText;
  const canToggle = !isTranslating && !!translatedText && translatedText !== originalText;

  const toggle = useCallback(() => {
    if (canToggle) {
      setShowOriginal(prev => !prev);
    }
  }, [canToggle]);

  return {
    text: textToDisplay,
    isTranslating,
    canToggle,
    showOriginal,
    toggle,
  };
}

/**
 * Hook for translating a group of related fields (e.g., a title and description).
 * Provides a single loading state and toggle for the entire group.
 */
export function useAutoTranslations<T extends Record<string, string | null | undefined>>(
    originals: T
) {
    const { language } = useI18n();
    const [translations, setTranslations] = useState<Partial<T>>({});
    const [isTranslating, setIsTranslating] = useState(false);
    const [showOriginal, setShowOriginal] = useState(false);

    const originalsString = useMemo(() => JSON.stringify(originals), [originals]);

    useEffect(() => {
        let cancelled = false;

        setTranslations({});
        setShowOriginal(false);
        setIsTranslating(false);

        const toTranslate = Object.entries(originals).filter(([, value]) => value);
        if (toTranslate.length > 0) {
            setIsTranslating(true);
            Promise.allSettled(
                toTranslate.map(([, value]) => translateText(value!, language))
            ).then(results => {
                if (cancelled) return;
                const newTranslations: Partial<T> = {};
                toTranslate.forEach(([key], index) => {
                    const result = results[index];
                    if (result.status === 'fulfilled') {
                        newTranslations[key as keyof T] = result.value as T[keyof T];
                    }
                });
                setTranslations(newTranslations);
            }).finally(() => {
                if (!cancelled) setIsTranslating(false);
            });
        }

        return () => { cancelled = true; };
    }, [originalsString, language]);

    const toggle = useCallback(() => setShowOriginal(p => !p), []);
    const hasActualTranslations = Object.entries(translations).some(
        ([key, value]) => value && value !== originals[key as keyof T]
    );
    const canToggle = !isTranslating && hasActualTranslations;

    const translatedContent = useMemo(() => {
        const result: T = { ...originals };
        if (!showOriginal) {
            for (const key in translations) {
                if (translations[key]) {
                    result[key as keyof T] = translations[key] as T[keyof T];
                }
            }
        }
        return result;
    }, [originals, translations, showOriginal, language]);

    return {
        content: translatedContent,
        isTranslating,
        canToggle,
        showOriginal,
        toggle,
    };
}

/**
 * Get the locale string for date formatting based on the current language
 * @param language - The current language code
 * @returns The locale string (e.g., 'es-ES', 'en-US', 'zh-CN')
 */
export function getLocaleFromLanguage(language: Language): string {
  const localeMap: Record<Language, string> = {
    es: 'es-ES',
    en: 'en-US',
    br: 'pt-BR',
    ca: 'ca-ES',
    fr: 'fr-FR',
    de: 'de-DE',
    it: 'it-IT',
    cn: 'zh-CN',
    sv: 'sv-SE',
    pl: 'pl-PL',
    ja: 'ja-JP',
    pt: 'pt-PT',
    gb: 'en-GB',
    au: 'en-AU',
    ko: 'ko-KR',
    ar: 'ar-AE',
    nl: 'nl-NL',
    ru: 'ru-RU',
    id: 'id-ID',
    ms: 'ms-MY',
    tw: 'zh-TW',
    th: 'th-TH',
    fa: 'fa-IR',
    vi: 'vi-VN',
    bn: 'bn-BD',
    hi: 'hi-IN',
    tl: 'tl-PH',
  };
  return localeMap[language] || 'es-ES';
}

