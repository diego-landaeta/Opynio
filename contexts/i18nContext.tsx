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

export type Language = "es" | "en" | "br" | "ca" | "fr" | "de" | "it" | "cn";

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
} = {
  es: esTranslations.paths,
  en: enTranslations.paths,
  br: brTranslations.paths,
  ca: caTranslations.paths,
  fr: frTranslations.paths,
  de: deTranslations.paths,
  it: itTranslations.paths,
  cn: cnTranslations.paths,
};

// Maps a country code from the URL to a language code for path generation.
export const getLanguageForCountryCode = (countryCode: string | null | undefined): Language => {
    if (!countryCode) return 'es';
    const uc = countryCode.toUpperCase();
    switch (uc) {
        case 'US':
        case 'GB':
            return 'en';
        case 'BR':
        case 'PT':
            return 'br';
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
      if (saved && ['es', 'en', 'br', 'ca', 'fr', 'de', 'it', 'cn'].includes(saved)) {
        return saved as Language;
      }
    }
    return 'es';
  });

  // Wrap setLanguage to also persist to localStorage
  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('opynio_language', lang);
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
  };
  return localeMap[language] || 'es-ES';
}

