import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useLayoutEffect,
} from "react";
import { translateText, needsTranslation, type TranslationHints } from "../services/translateService";
// Solo el espanol va en la carga inicial: es el idioma por defecto y el
// fallback de t(). El resto se descarga con import() al necesitarlo.
import esTranslations from '../locales/es';
// Rutas de TODOS los idiomas, sin los textos (~9 KB gzip frente a ~1 MB).
// Generado: tras tocar un bloque `paths`, `node scripts/gen-locale-paths.mjs`.
import { localePaths } from './localePaths.generated';
import { isServedUrlPrefix, COUNTRIES } from '../constants';
import { useNotification } from './NotificationContext';

export type Language = "es" | "en" | "br" | "ca" | "fr" | "de" | "it" | "cn" | "sv" | "pl" | "ja" | "pt" | "gb" | "au" | "ko" | "ar" | "nl" | "ru" | "id" | "ms" | "tw" | "th" | "fa" | "vi" | "bn" | "hi" | "tl" | "sg" | "ie" | "at" | "tr";

interface I18nContextType {
  /** Idioma que se ve en pantalla (su diccionario ya esta descargado). */
  language: Language;
  /**
   * Ultimo idioma pedido. Mientras se descarga su diccionario, `language` sigue
   * siendo el anterior: para saber «a que idioma va la UI» se compara con este.
   */
  requestedLanguage: Language;
  /** Eleccion del USUARIO (selectores, primera visita): se guarda cuando carga. */
  setLanguage: (lang: Language) => void;
  /**
   * Idioma impuesto por la ruta (el panel de admin va en espanol). No se guarda
   * como preferencia; con null se vuelve a la preferencia del usuario.
   */
  setLanguageOverride: (lang: Language | null) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

type Dictionary = Record<string, any>;

// Un import() por idioma. Rollup crea un chunk por locale (locale-xx en
// vite.config.ts) y solo se descarga el que se pide.
const LOCALE_LOADERS: Record<Exclude<Language, 'es'>, () => Promise<{ default: Dictionary }>> = {
  en: () => import('../locales/en'),
  br: () => import('../locales/br'),
  ca: () => import('../locales/ca'),
  fr: () => import('../locales/fr'),
  de: () => import('../locales/de'),
  it: () => import('../locales/it'),
  cn: () => import('../locales/cn'),
  sv: () => import('../locales/sv'),
  pl: () => import('../locales/pl'),
  ja: () => import('../locales/ja'),
  pt: () => import('../locales/pt'),
  gb: () => import('../locales/gb'),
  au: () => import('../locales/au'),
  ko: () => import('../locales/ko'),
  ar: () => import('../locales/ar'),
  nl: () => import('../locales/nl'),
  ru: () => import('../locales/ru'),
  id: () => import('../locales/id'),
  ms: () => import('../locales/ms'),
  tw: () => import('../locales/tw'),
  th: () => import('../locales/th'),
  fa: () => import('../locales/fa'),
  vi: () => import('../locales/vi'),
  bn: () => import('../locales/bn'),
  hi: () => import('../locales/hi'),
  tl: () => import('../locales/tl'),
  sg: () => import('../locales/sg'),
  ie: () => import('../locales/ie'),
  at: () => import('../locales/at'),
  tr: () => import('../locales/tr'),
};

// Diccionarios ya descargados. Es modulo, no estado: t() los lee al vuelo y el
// idioma activo solo cambia (setLanguageState) cuando su diccionario ya esta.
const dictionaries: Partial<Record<Language, Dictionary>> = { es: esTranslations };
const pendingLoads: Partial<Record<Language, Promise<Dictionary>>> = {};

export const isSupportedLanguage = (lang: unknown): lang is Language =>
  typeof lang === 'string' && Object.prototype.hasOwnProperty.call(localePaths, lang);

/** Diccionario de un idioma si ya esta descargado (sincrono). */
export const getLoadedTranslations = (lang: Language): Dictionary | undefined => dictionaries[lang];

/** Descarga (una sola vez) el diccionario de un idioma. */
export const loadLocale = (lang: Language): Promise<Dictionary> => {
  const ready = dictionaries[lang];
  if (ready) return Promise.resolve(ready);
  const pending = pendingLoads[lang];
  if (pending) return pending;
  const loader = LOCALE_LOADERS[lang as Exclude<Language, 'es'>];
  if (!loader) return Promise.resolve(esTranslations);
  const request = loader()
    .then((mod) => {
      // Con vite:preloadError cancelado (index.tsx) el import() se resuelve sin
      // modulo: se trata como fallo, no como diccionario vacio.
      if (!mod || !mod.default) throw new Error(`Locale "${lang}" vacio`);
      dictionaries[lang] = mod.default;
      return mod.default;
    })
    .finally(() => { delete pendingLoads[lang]; });
  pendingLoads[lang] = request;
  return request;
};

// URL del modulo que no se pudo descargar, si el navegador la da en el error
// ("Failed to fetch dynamically imported module: https://.../locale-de-x.js").
// Solo del mismo origen: es un chunk nuestro.
const failedModuleUrl = (err: unknown): string | null => {
  const match = String((err as any)?.message || '').match(/(https?:\/\/[^\s'"]+?\.(?:m?js|ts))(?:\?[^\s'"]*)?(?=[\s'"]|$)/);
  if (!match || typeof window === 'undefined') return null;
  try {
    return new URL(match[1]).origin === window.location.origin ? match[1] : null;
  } catch { return null; }
};

/** true si el error de carga es de un chunk de idioma (lo gestiona este modulo). */
export const isLocaleChunkError = (err: unknown): boolean =>
  /\/(?:assets\/locale-[a-z]+-|locales\/[a-z]+\.ts)/.test(String((err as any)?.message || ''));

// Un reintento antes de dar el idioma por perdido: un corte de red puntual no
// debe tirar la eleccion del usuario. Chrome recuerda el import() fallido de una
// URL y ni la vuelve a pedir, asi que el reintento va a la misma URL con otra
// query (el diccionario son datos: da igual que sea otra instancia del modulo).
const LOCALE_RETRY_DELAY_MS = 800;
const loadLocaleWithRetry = (lang: Language): Promise<Dictionary> =>
  loadLocale(lang).catch(async (err) => {
    await new Promise<void>((resolve) => setTimeout(resolve, LOCALE_RETRY_DELAY_MS));
    const ready = dictionaries[lang];
    if (ready) return ready;
    const url = failedModuleUrl(err);
    if (!url) return loadLocale(lang);
    const mod = await import(/* @vite-ignore */ `${url}?reintento=${Date.now()}`);
    if (!mod || !mod.default) throw err;
    dictionaries[lang] = mod.default;
    return mod.default as Dictionary;
  });

// Tras un despliegue, una pestana abierta de antes pide chunks con hashes que ya
// no existen: ni reintentar sirve. Una recarga trae el index.html nuevo. Solo
// una vez cada pocos minutos (marca en sessionStorage), para no entrar en bucle
// si el fallo es de red y no de version.
const CHUNK_RELOAD_KEY = 'opynio_chunk_reload_at';
const CHUNK_RELOAD_COOLDOWN_MS = 5 * 60 * 1000;

/** Recarga la pagina si no se ha hecho hace poco. Devuelve true si recarga. */
export const reloadOnceForStaleChunks = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
    if (last && Date.now() - last < CHUNK_RELOAD_COOLDOWN_MS) return false;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  } catch {
    // Sin sessionStorage no hay forma de evitar un bucle de recargas.
    return false;
  }
  window.location.reload();
  return true;
};

export const pathTranslations: typeof localePaths = localePaths;

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

// Pantalla de inicio: `/` o `/<pais>` (tambien los alias /en, /ve, /cn), con
// o sin barra final. Los selectores de idioma y pais (cabecera, menu movil,
// pie, boton flotante y popup de idioma/pais) solo se muestran aqui: en el
// resto de pantallas la URL ya fija el pais del contenido y cambiarlo desde
// una ficha, un panel o el admin confundia mas que ayudaba.
export const isHomeRoute = (pathname: string): boolean => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) return true;
    return segments.length === 1 && isServedUrlPrefix(segments[0]);
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
    sg: 'sg',
    ie: 'ie',
    at: 'at',
    tr: 'tr',
};

// Codigo BCP-47 para <html lang>: los locales internos usan codigos de pais
// para variantes (gb, br, cn, tw...) que no son idiomas validos para lectores
// de pantalla ni buscadores ("cn" no es chino, "br" es breton).
const BCP47: Record<string, string> = {
  gb: 'en-GB', au: 'en-AU', ie: 'en-IE', sg: 'en-SG',
  br: 'pt-BR', pt: 'pt-PT', cn: 'zh-CN', tw: 'zh-TW', at: 'de-AT',
};
export const toBcp47 = (lang: string): string => BCP47[lang] || lang;

// Prefijo de URL para un idioma. Los prefijos son PAISES: `/${language}` daba
// /ar/... (Argentina, no arabe) o /ca/... (Canada) para arabe y catalan.
// Nunca devuelve un prefijo que de 404: si el pais recibido no se sirve (un
// codigo raro guardado, un pais de sede nuevo), se usa el del idioma y, si
// tampoco, /es. Ver isServedUrlPrefix en constants.ts.
export const countryPrefixFor = (lang: Language, country?: string | null): string => {
  const code = [country, LANGUAGE_DEFAULT_COUNTRY[lang], 'es'].find(c => isServedUrlPrefix(c)) || 'es';
  return `/${code.toLowerCase()}`;
};

// Ruta completa con prefijo de pais y el segmento en el idioma de ESE pais
// (/es/acceder, /gb/login). Mezclarlos (/es/login) da 404.
export const localizedPath = (key: keyof typeof pathTranslations.es, lang: Language, country?: string | null): string => {
  const prefijo = countryPrefixFor(lang, country);
  const idioma = getLanguageForCountryCode(prefijo.slice(1));
  const rutas = (pathTranslations as any)[idioma] || pathTranslations.es;
  return `${prefijo}/${rutas[key] || (pathTranslations.es as any)[key]}`;
};

// Como localizedPath, pero sin pais conocido devuelve la ruta SIN prefijo en el
// idioma de la UI (/login, /acceder), que el router acepta en cualquier idioma.
// localizedPath pondria el pais por defecto del idioma (/us/...), y entrar en
// una URL con pais le asigna ese pais al usuario (LanguagePopup).
export const localizedPathOrRoot = (key: keyof typeof pathTranslations.es, lang: Language, country?: string | null): string => {
  if (country) return localizedPath(key, lang, country);
  const rutas = (pathTranslations as any)[lang] || pathTranslations.es;
  return `/${rutas[key] || (pathTranslations.es as any)[key]}`;
};

// Maps a country code from the URL to a language code for path generation.
export const getLanguageForCountryCode = (countryCode: string | null | undefined): Language => {
    if (!countryCode) return 'es';
    const uc = countryCode.toUpperCase();
    switch (uc) {
        case 'US':
        case 'CA':
            return 'en';
        // /en/... (alias en constants.ts, sitemap antiguo) NO se mapea aqui: cae
        // en el espanol por defecto, como en master, que es como esta indexado
        // (/en/explore con el contenido en espanol). Sus rutas en ingles se
        // sirven igual: el router acepta cualquier idioma tras un alias.
        case 'IE':
            return 'ie';
        case 'SG':
            return 'sg';
        case 'GB':
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
        case 'AT':
            return 'at';
        case 'TR':
            return 'tr';
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

// Idioma con el que arranca la app, antes del primer render:
// 1. El que el usuario ya eligio (localStorage opynio_language).
// 2. Primera visita: el del pais de la URL (/de/... -> de). Es lo que ven los
//    buscadores, que no guardan localStorage. Antes arrancaba siempre en es y
//    LanguagePopup lo cambiaba en un efecto: parpadeo es -> idioma del pais.
// 3. Primera visita sin pais: el idioma del slug (/preise -> de), como hace
//    MainLayout en App.tsx.
// Antes de todo eso, el idioma que el usuario eligio y no llego a descargarse
// (ver PENDING_LANGUAGE_KEY): se reintenta tras la recarga.
//
// Solo se GUARDA (opynio_language) lo que elige el usuario o la primera visita
// (setLanguage). Lo que impone una ruta (admin en espanol) no se guarda: antes
// pasar por /admin dejaba a un usuario en ingles en espanol para siempre.
const LANGUAGE_STORAGE_KEY = 'opynio_language';
// sessionStorage: idioma elegido cuya descarga fallo; sobrevive a la recarga
// unica de reloadOnceForStaleChunks para volver a intentarlo con el index nuevo.
const PENDING_LANGUAGE_KEY = 'opynio_pending_language';

const readSavedLanguage = (): Language | null => {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isSupportedLanguage(saved) ? saved : null;
  } catch { return null; /* localStorage bloqueado: se sigue con la URL */ }
};
const saveLanguage = (lang: Language) => {
  try { localStorage.setItem(LANGUAGE_STORAGE_KEY, lang); } catch { /* sin almacenamiento */ }
};
const readPendingLanguage = (): Language | null => {
  try {
    const pending = sessionStorage.getItem(PENDING_LANGUAGE_KEY);
    return isSupportedLanguage(pending) ? pending : null;
  } catch { return null; }
};
const setPendingLanguage = (lang: Language | null) => {
  try {
    if (lang) sessionStorage.setItem(PENDING_LANGUAGE_KEY, lang);
    else sessionStorage.removeItem(PENDING_LANGUAGE_KEY);
  } catch { /* sin almacenamiento */ }
};

// Idioma que pide la URL: el del pais del prefijo o, sin prefijo, el del slug.
const languageFromUrl = (): Language => {
  const first = window.location.pathname.split('/').filter(Boolean)[0];
  if (!first || first === 'admin') return 'es';
  // Solo los paises del selector (COUNTRIES) dan idioma, como en master, donde
  // lo ponia LanguagePopup y solo para esos paises. Los alias (/cn, /en, /ve:
  // URL_PREFIX_ALIASES) se ven en espanol en la primera visita.
  if (/^[a-z]{2}$/i.test(first)) {
    return COUNTRIES.some(c => c.code === first.toUpperCase()) ? getLanguageForCountryCode(first) : 'es';
  }
  let seg = first;
  try { seg = decodeURIComponent(first); } catch { /* segmento mal codificado */ }
  return detectLanguageFromPath(seg) || 'es';
};

export const detectInitialLanguage = (): Language => {
  if (typeof window === 'undefined') return 'es';
  return readPendingLanguage() || readSavedLanguage() || languageFromUrl();
};

const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur'];
const pendingAtStart = typeof window !== 'undefined' ? readPendingLanguage() : null;
const initialLanguage = detectInitialLanguage();
// Si el idioma pendiente tampoco carga tras recargar, se vuelve a este.
const initialFallback: Language = pendingAtStart && typeof window !== 'undefined'
  ? (readSavedLanguage() || languageFromUrl())
  : initialLanguage;
// <html lang/dir> desde ya, no desde el primer render: mientras llega el
// diccionario se ve el "Cargando..." de index.html y el documento ya declara
// el idioma que va a tener (index.html trae lang="es" fijo).
if (typeof document !== 'undefined') {
  document.documentElement.lang = toBcp47(initialLanguage);
  document.documentElement.dir = RTL_LANGUAGES.includes(initialLanguage) ? 'rtl' : 'ltr';
}
const initialLoad = loadLocaleWithRetry(initialLanguage).catch((err) => {
  console.error(`[i18n] No se pudo cargar el idioma "${initialLanguage}":`, err);
  return esTranslations;
});

// t() de un idioma concreto (el del proveedor, o el que se ve al avisar de un
// fallo desde una promesa).
const translateWith = (lang: Language, key: string, params: Record<string, string | number> = {}): string => {
  const dict = dictionaries[lang] || esTranslations;
  // Create a composite key to try and find the translation
  const keysToTry = key.includes('.') ? [key] : Object.keys(dict).map(section => `${section}.${key}`);

  let translation: string | undefined;
  for (const k of keysToTry) {
    translation = getNestedTranslation(dict, k);
    if (translation) break;
  }

  // Fallback to Spanish (main language) if not found in current language
  if (!translation) {
    for (const k of keysToTry) {
      translation = getNestedTranslation(esTranslations, k);
      if (translation) break;
    }
  }

  // If still not found, return the key itself
  translation = translation || key;

  for (const param in params) {
    translation = translation.replace(`{${param}}`, String(params[param]));
  }
  return translation;
};

/**
 * Se resuelve cuando el diccionario del idioma inicial esta descargado (o a los
 * `timeoutMs`, para no dejar la pagina en blanco si la red falla: entonces se
 * pinta en espanol y el proveedor cambia al idioma bueno cuando llegue).
 * index.tsx espera a esto antes del primer render, asi que nunca se pinta una
 * clave cruda ni se ve el espanol un instante antes del idioma del usuario.
 * Para `es` (el caso mas comun) ya esta resuelto: no retrasa nada.
 */
export const initialLocaleReady = (timeoutMs = 4000): Promise<void> =>
  Promise.race([
    initialLoad.then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);

const I18nContext = createContext<I18nContextType | undefined>(undefined);


export const I18nProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { showNotification } = useNotification();
  const notifyRef = useRef(showNotification);
  useEffect(() => { notifyRef.current = showNotification; }, [showNotification]);

  // El idioma activo solo pasa a uno cuyo diccionario ya esta descargado. Asi
  // t() nunca devuelve una clave cruda por un idioma a medio llegar.
  const [language, setLanguageState] = useState<Language>(() =>
    dictionaries[initialLanguage] ? initialLanguage : 'es'
  );
  const [requestedLanguage, setRequestedLanguage] = useState<Language>(initialLanguage);
  // Ultimo idioma pedido (ref: lo leen las descargas al terminar). Si se piden
  // dos seguidos, gana el ultimo aunque el primero llegue despues.
  const requested = useRef<Language>(initialLanguage);
  // Idioma en pantalla, para avisar en el si otro no carga.
  const shown = useRef<Language>(language);
  // Preferencia del usuario: lo que se ve cuando la ruta no impone otro idioma.
  const preference = useRef<Language>(initialLanguage);
  // Idioma impuesto por la ruta (admin = es). No es preferencia.
  const override = useRef<Language | null>(null);

  // Pide un idioma. persist: es eleccion del usuario y se guarda cuando su
  // diccionario esta (no antes: si no descarga, no queda guardado un idioma que
  // no se puede ver). prevPref: preferencia a la que volver si falla.
  // isFallback: intento de volver a la preferencia tras un fallo (sin mas avisos).
  const request = useCallback((lang: Language, persist: boolean, prevPref?: Language, isFallback = false) => {
    requested.current = lang;
    setRequestedLanguage(lang);
    const apply = () => {
      if (persist && preference.current === lang) {
        saveLanguage(lang);
        setPendingLanguage(null);
      }
      if (requested.current === lang) {
        shown.current = lang;
        setLanguageState(lang);
      }
    };
    if (dictionaries[lang]) { apply(); return; }
    // Mientras se descarga se sigue viendo el idioma anterior (completo) y se
    // cambia de golpe al llegar: sin claves crudas ni mezcla de idiomas.
    loadLocaleWithRetry(lang).then(apply).catch((err) => {
      console.error(`[i18n] No se pudo cargar el idioma "${lang}":`, err);
      if (requested.current !== lang) return; // entretanto se pidio otro
      const keepShown = () => {
        requested.current = shown.current;
        setRequestedLanguage(shown.current);
      };
      if (isFallback) { keepShown(); return; }
      // Una recarga (una vez) por si es una pestana de antes de un despliegue.
      // El idioma elegido se recuerda en la sesion para reintentarlo al volver.
      if (persist) setPendingLanguage(lang);
      if (reloadOnceForStaleChunks()) return;
      setPendingLanguage(null);
      if (preference.current === lang && prevPref) preference.current = prevPref;
      keepShown();
      notifyRef.current(translateWith(shown.current, 'common.languageLoadError'), 'error');
      // La preferencia anterior puede no estar descargada (idioma pendiente tras
      // la recarga): se intenta una vez, sin volver a avisar ni recargar.
      const back = override.current ?? preference.current;
      if (back !== lang && back !== shown.current) request(back, false, undefined, true);
    });
  }, []);

  // Si el idioma inicial no llego a tiempo (red lenta, ver initialLocaleReady),
  // se aplica en cuanto este. Si era un idioma elegido pendiente de la recarga,
  // se guarda al cargar.
  useEffect(() => {
    if (!dictionaries[initialLanguage]) {
      request(initialLanguage, !!pendingAtStart, initialFallback);
    } else if (pendingAtStart) {
      saveLanguage(initialLanguage);
      setPendingLanguage(null);
    }
  }, [request]);

  // Eleccion del usuario: se ve (salvo que la ruta imponga otro) y se guarda
  // cuando su diccionario este descargado.
  const setLanguage = useCallback((lang: Language) => {
    const prev = preference.current;
    preference.current = lang;
    if (override.current) {
      // La ruta impone otro idioma (admin): se guarda para cuando se salga.
      loadLocaleWithRetry(lang)
        .then(() => { if (preference.current === lang) saveLanguage(lang); })
        .catch(() => { if (preference.current === lang) preference.current = prev; });
      return;
    }
    request(lang, true, prev);
  }, [request]);

  // Idioma impuesto por la ruta, sin tocar la preferencia guardada. null: vuelve
  // a la preferencia del usuario.
  const setLanguageOverride = useCallback((lang: Language | null) => {
    if (override.current === lang) return;
    override.current = lang;
    request(lang ?? preference.current, false);
  }, [request]);

  // <html lang/dir> = idioma que se ve en pantalla. Unica fuente: antes lo
  // pisaban MainLayout (idioma del pais del usuario) y Meta (idioma del pais
  // de la empresa), y no coincidia con el texto para quien ya habia elegido
  // idioma. Los buscadores no tienen idioma guardado: para ellos el idioma de
  // la UI es el del pais de la URL, asi que sigue coincidiendo con el pais.
  // useLayoutEffect: antes del pintado, para que lang y texto cambien a la vez.
  useLayoutEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = toBcp47(language);
    document.documentElement.dir = RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr';
  }, [language]);

  const t = useCallback(
    (key: string, params: Record<string, string | number> = {}): string => translateWith(language, key, params),
    [language]
  );

  const value = useMemo(
    () => ({ language, requestedLanguage, setLanguage, setLanguageOverride, t }),
    [language, requestedLanguage, setLanguage, setLanguageOverride, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

/**
 * Diccionario de un idioma concreto (distinto del de la UI), descargandolo si
 * hace falta. Devuelve undefined mientras llega. Lo usa la ficha de empresa
 * para los metadatos en el idioma del pais de la empresa.
 */
export function useLocaleDictionary(lang: Language): Dictionary | undefined {
  const [, setVersion] = useState(0);
  useEffect(() => {
    if (dictionaries[lang]) return;
    let cancelled = false;
    loadLocale(lang)
      .then(() => { if (!cancelled) setVersion((v) => v + 1); })
      .catch(() => { /* se queda con el fallback del llamador */ });
    return () => { cancelled = true; };
  }, [lang]);
  return dictionaries[lang];
}

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
export function useAutoTranslation(originalText: string | null | undefined, hints?: TranslationHints) {
  const { language } = useI18n();
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const hintsKey = hints ? JSON.stringify(hints) : '';

  useEffect(() => {
    let cancelled = false;

    setTranslatedText(null);
    setShowOriginal(false);
    setIsTranslating(false);

    // Texto ya en el idioma de la UI: ni peticion ni «Traduciendo...».
    if (originalText && needsTranslation(originalText, language, hints)) {
      setIsTranslating(true);
      translateText(originalText, language, hints)
        .then(result => { if (!cancelled) setTranslatedText(result); })
        .catch(() => { if (!cancelled) console.error("Translation failed for:", originalText); })
        .finally(() => { if (!cancelled) setIsTranslating(false); });
    }

    return () => { cancelled = true; };
    // hints va por hintsKey (un objeto literal cambia en cada render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalText, language, hintsKey]);

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
    originals: T,
    hints?: TranslationHints
) {
    const { language } = useI18n();
    const [translations, setTranslations] = useState<Partial<T>>({});
    const [isTranslating, setIsTranslating] = useState(false);
    const [showOriginal, setShowOriginal] = useState(false);

    const originalsString = useMemo(() => JSON.stringify(originals), [originals]);
    const hintsKey = hints ? JSON.stringify(hints) : '';

    useEffect(() => {
        let cancelled = false;

        setTranslations({});
        setShowOriginal(false);
        setIsTranslating(false);

        // Solo los campos que no estan ya en el idioma de la UI: una resena en
        // espanol vista en espanol no hace ninguna peticion. Los campos del
        // grupo son del mismo autor: un titulo corto ("Excelente servicio"),
        // que solo no da para detectar el idioma, se juzga con el resto.
        const contextText = Object.values(originals).filter(Boolean).join('\n');
        const groupHints: TranslationHints = { ...hints, contextText };
        const toTranslate = Object.entries(originals)
            .filter(([, value]) => value && needsTranslation(value, language, groupHints));
        if (toTranslate.length > 0) {
            setIsTranslating(true);
            Promise.allSettled(
                toTranslate.map(([, value]) => translateText(value!, language, groupHints))
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [originalsString, language, hintsKey]);

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
    sg: 'en-SG',
    ie: 'en-IE',
    at: 'de-AT',
    tr: 'tr-TR',
  };
  return localeMap[language] || 'es-ES';
}

