// Nombre de un pais en el idioma de la interfaz.
//
// Orden de preferencia:
//   1. La clave `countries.XX` del locale, si existe: nombres revisados a mano.
//   2. Intl.DisplayNames en ese idioma (datos CLDR del navegador). Cubre
//      cualquier pais sin tener que mantener la misma lista en 31 locales:
//      un pais nuevo en COUNTRIES sale traducido sin tocar locales/.
//   3. El `fallback` que pase quien llama (el nombre de constants.ts).
//   4. El codigo tal cual.
//
// Antes cada pagina hacia `t('countries.XX') || nombre`, pero t() devuelve la
// clave cruda cuando falta, asi que el `||` nunca actuaba: la home mostraba
// «countries.KR» para los 22 paises sin clave al pulsar «Ver más».

import { useCallback } from 'react';
import { useI18n, toBcp47, getLanguageForCountryCode } from '../contexts/i18nContext';
import { COUNTRIES } from '../constants';

// style 'short': «Hong Kong» en vez de «Hong Kong SAR China» / «RAE de Hong
// Kong (China)», que no caben en una etiqueta bajo una bandera.
const cache = new Map<string, Intl.DisplayNames | null>();

const displayNamesFor = (language: string): Intl.DisplayNames | null => {
  if (!cache.has(language)) {
    let dn: Intl.DisplayNames | null = null;
    try {
      dn = new Intl.DisplayNames([toBcp47(language)], { type: 'region', style: 'short' });
    } catch {
      dn = null; // navegador sin Intl.DisplayNames (anterior a 2021)
    }
    cache.set(language, dn);
  }
  return cache.get(language) ?? null;
};

/** Nombre del pais segun CLDR, o null si el navegador no lo sabe. */
export const intlCountryName = (code: string, language: string): string | null => {
  const dn = displayNamesFor(language);
  if (!dn || !/^[A-Za-z]{2}$/.test(code)) return null;
  try {
    const name = dn.of(code.toUpperCase());
    // Para un codigo que no conoce devuelve el propio codigo.
    return name && name.toUpperCase() !== code.toUpperCase() ? name : null;
  } catch {
    return null;
  }
};

/**
 * `const countryName = useCountryName(); countryName('KR', 'Corea')`
 */
export const useCountryName = () => {
  const { t, language } = useI18n();
  return useCallback((code: string | null | undefined, fallback?: string): string => {
    if (!code) return fallback || '';
    const upper = code.toUpperCase();
    const key = `countries.${upper}`;
    const translated = t(key);
    if (translated && translated !== key) return translated;
    return intlCountryName(upper, language) || fallback || upper;
  }, [t, language]);
};

/**
 * Marca con pais para titulares y metadatos: `brandName('GB')` -> «Opynio United Kingdom».
 *
 * Con el idioma por defecto del pais (el que implica la URL, que es el que ve un
 * buscador, sin localStorage) devuelve EXACTAMENTE `Opynio <nombre de constants.ts>`:
 * los titulos y descripciones ya indexados no cambian. Solo cuando el visitante
 * tiene guardado otro idioma (espanol en /gb) el pais sale en ese idioma
 * («Opynio Reino Unido»), en vez de mezclar ingles en una pagina en espanol.
 */
export const useBrandName = () => {
  const { language } = useI18n();
  const countryNameOf = useCountryName();
  return useCallback((code: string | null | undefined): string => {
    const info = code ? COUNTRIES.find(c => c.code === code) : undefined;
    if (!info) return 'Opynio';
    if (getLanguageForCountryCode(info.code) === language) return `Opynio ${info.name}`;
    return `Opynio ${countryNameOf(info.code, info.name)}`;
  }, [language, countryNameOf]);
};
