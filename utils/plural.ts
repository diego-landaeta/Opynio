// Singular/plural para el t() casero, que solo interpola {param}.
//
// Convencion: la clave base es la forma plural («{count} empresas encontradas»)
// y la variante `<clave>One` la singular («{count} empresa encontrada»). La
// eleccion la hace Intl.PluralRules con las reglas CLDR de cada idioma: en
// frances o hindi 0 tambien es 'one', en ruso 21 lo es y en japones o chino
// nunca. Las categorias 'two'/'few'/'many' (arabe, polaco, ruso...) caen en la
// clave base.
//
// Las variantes One existen en los 31 locales (scripts/_i18n-pendientes/
// inject-plural-one.cjs); si se usa pluralKey con una clave nueva hay que
// anadir su One en todos, o t() caera al espanol.

import { useCallback } from 'react';
import { useI18n } from '../contexts/i18nContext';

// Codigos de locale de la app que no son etiquetas BCP 47 validas o que son
// regiones de otro idioma. El resto (es, en, fr, de, ja, ...) se usan tal cual.
const PLURAL_LOCALE: Record<string, string> = {
  at: 'de-AT',
  au: 'en-AU',
  gb: 'en-GB',
  ie: 'en-IE',
  sg: 'en-SG',
  br: 'pt-BR',
  pt: 'pt-PT',
  cn: 'zh-CN',
  tw: 'zh-TW',
  tl: 'fil',
};

const cache = new Map<string, Intl.PluralRules | null>();

const rulesFor = (language: string): Intl.PluralRules | null => {
  if (!cache.has(language)) {
    let rules: Intl.PluralRules | null = null;
    try {
      rules = new Intl.PluralRules(PLURAL_LOCALE[language] || language);
    } catch {
      rules = null;
    }
    cache.set(language, rules);
  }
  return cache.get(language) ?? null;
};

/** Devuelve `${key}One` si `count` es singular en `language`, si no `key`. */
export const pluralKey = (key: string, count: number, language: string): string => {
  const rules = rulesFor(language);
  const isOne = rules ? rules.select(count) === 'one' : count === 1;
  return isOne ? `${key}One` : key;
};

/**
 * t() con singular/plural: `tn('common.reviewsFound', n)` equivale a
 * t('common.reviewsFound' o 'common.reviewsFoundOne', { count: n }).
 */
export const usePluralT = () => {
  const { language, t } = useI18n();
  return useCallback(
    (key: string, count: number, params: Record<string, string | number> = {}) =>
      t(pluralKey(key, count, language), { count, ...params }),
    [language, t],
  );
};
