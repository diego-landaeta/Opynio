# add-language — playbook

> Añadir un idioma nuevo a la app web + widget embebido + sitemap, con 0 claves faltantes vs `en.ts` y build verde.

## Cuándo usar

- El usuario pide "añadir [idioma X]" o "expandir a mercado Y"
- Hay demanda de un mercado donde la app aún no está disponible
- Un locale existe huérfano (en `locales/`) pero no está importado en `i18nContext.tsx`

## Cuándo NO usar

- Para arreglar claves faltantes en un idioma YA cableado → ese es otro flujo (audit + backfill por sección)
- Para añadir un país sin idioma nuevo → ver `add-country.md`
- Para cambiar un slug de path existente → eso es refactor, rompe SEO

## Pre-requisitos

Antes de empezar el usuario debe confirmarme o yo asumir defaults razonables:

- **Código idioma ISO 639-1**: `sv`, `pl`, `ja`, `nl`, `ar`, etc.
- **Código país URL** (lo que aparece tras `/`): normalmente coincide con el ISO 3166-1 alpha-2 del país principal del idioma. Ej: `sv → se`, `ja → jp`, `ko → kr`, `nl → nl`, `ru → ru`, `ar → ?` (Egipto/EAU/SA según mercado prioritario).
- **Nombre nativo**: `Svenska`, `日本語`, `한국어`, etc.
- **RTL**: sólo árabe (`ar`), hebreo (`he`), persa (`fa`), urdu (`ur`). Si aplica → paso extra de `dir="rtl"`.

---

## Pasos

Estructura: **1 locale file + 9 puntos de cableado + verificación**.

Variables que se usan en los snippets (sustituye al ejecutar):
- `{LANG}` — código idioma (ej. `sv`)
- `{LANG_TYPE}` — `Language` type literal (ej. `"sv"`)
- `{COUNTRY}` — código país URL minúsculas (ej. `se`)
- `{COUNTRY_UC}` — código país mayúsculas (ej. `SE`)
- `{NATIVE_NAME}` — nombre nativo (ej. `Svenska`)
- `{COUNTRY_NATIVE}` — país en idioma nativo (ej. `Sverige`)
- `{LOCALE_INTL}` — locale string para `Intl.*` (ej. `sv-SE`)

### 1. Crear el locale file (`locales/{LANG}.ts`)

Opciones por orden de calidad:

**Opción A (preferida) — sub-agent crea fichero completo (~1865 claves)**:
```
Spawn general-purpose sub-agent con prompt:
- Lee `locales/en.ts` y replica estructura exacta
- Traduce a {LANG} idiomático (estilo Trustpilot.{country})
- Preserva: placeholders {count}/{n}/{businessName}, etiquetas HTML, URLs case*, nombres "Opynio"/Pro/Starter/Growth/Enterprise/v.2
- `paths:` con slugs URL-safe (sin diacríticos si son problemáticos)
- `countries:` añade el país nuevo si aplica (ej. `SE: "Sverige"`)
- Indentación 2 espacios
- Write una sola vez con todo el contenido
```

**Opción B (fallback rápido) — re-export con override**:
```ts
import en from './en';
export default { ...en, paths: { /* slugs traducidos */ } };
```
Funcional pero deja todo en inglés salvo paths. Usar sólo si el sub-agent falla y el usuario tiene prisa.

**Opción C — manual escribir 1865 claves** desde Read del prompt: sólo si nada más funciona. Muy lento.

### 2. Cablear en [contexts/i18nContext.tsx](../../contexts/i18nContext.tsx) y regenerar las rutas

Los locales ya **no** se importan de forma estática (salvo `es`, fallback de `t()`): cada idioma es un chunk propio que se descarga con `import()` al elegirlo. Las rutas de todos los idiomas viven copiadas en [contexts/localePaths.generated.ts](../../contexts/localePaths.generated.ts), generado desde el bloque `paths` de cada locale.

Ediciones en `i18nContext.tsx`:

```ts
// (a) Tipo Language — añade al final. El generador de rutas lee esta lista.
export type Language = "es" | ... | "{LANG_TYPE}";

// (b) LOCALE_LOADERS — import dinámico (Rollup crea el chunk locale-{LANG})
{LANG}: () => import('../locales/{LANG}'),

// (c) LANGUAGE_DEFAULT_COUNTRY
{LANG}: '{COUNTRY}',

// (d) getLanguageForCountryCode — case nuevo
case '{COUNTRY_UC}':
    return '{LANG_TYPE}';

// (e) getLocaleFromLanguage localeMap
{LANG}: '{LOCALE_INTL}',

// (f) BCP47 — solo si el código interno NO es un código de idioma válido
//     (variantes por país: gb -> en-GB, br -> pt-BR...). Es lo que va a <html lang>.
{LANG}: '{LOCALE_INTL}',
```

La validación del idioma guardado en localStorage (`isSupportedLanguage`) sale sola de `localePaths`: no hay lista que tocar.

Después, **regenera las rutas** (obligatorio; el build falla si no coinciden):

```bash
npm run gen:locale-paths      # = node scripts/gen-locale-paths.mjs
npm run check:locale-paths    # comprueba; también lo hace `npm run verify` y el build
```

### 3. Cablear en [constants.ts](../../constants.ts)

3 listas a tocar:

```ts
// LANGUAGES (idiomas que aparecen en el popup)
{ code: '{LANG}', name: '{NATIVE_NAME}', flag: 'https://flagcdn.com/{COUNTRY}.svg' },

// COUNTRIES (lista de países, mayúsculas)
{ code: '{COUNTRY_UC}', name: '{COUNTRY_NATIVE}', flag: 'https://flagcdn.com/{COUNTRY}.svg' },

// SEDE_COUNTRIES (países que pueden tener sede de empresa)
{ code: '{COUNTRY_UC}', name: '{COUNTRY_NATIVE}', flag: 'https://flagcdn.com/{COUNTRY}.svg', disabled: false },

// APP_LANGUAGES (sí, existe aparte de LANGUAGES — legacy, usar minúsculas)
{ code: '{COUNTRY}', name: '{COUNTRY_NATIVE}', flag: 'https://flagcdn.com/{COUNTRY}.svg', disabled: false },
```

### 4. Cablear en [services/translateService.ts](../../services/translateService.ts)

```ts
const GOOGLE_LANG_CODES = {
    ...,
    '{LANG}': '{LANG}',  // o '{LOCALE_INTL}' si Google Translate lo requiere (ej. cn → zh-CN)
};
```

### 5. Cablear en [components/pages/business/dashboard/widgets/widgetShared.ts](../../components/pages/business/dashboard/widgets/widgetShared.ts)

Añadir entrada en `PREVIEW_STRINGS` (12 strings que se ven en el dashboard al previsualizar widgets):

```ts
{LANG}: { ratingExcellent: '...', ratingVeryGood: '...', ratingGood: '...', reviews: '...', outOf5: '...', customerRatings: '...', basedOn: '...', basedOnAlt: '...', writeReview: '...', reviewsFor: '...', googleReview: '...', opynioReview: '...', seeAllReviews: '...' },
```

**BUMP `EMBED_VERSION`** en el mismo archivo: `vX.Y.Z` → `vX.Y.(Z+1)`.

### 6. Cablear en [public/widget.js](../../public/widget.js)

Dos cambios:

```js
// (a) Header de comentario en top del fichero
* Opynio Widget Loader vX.Y.(Z+1)  // ← debe coincidir con EMBED_VERSION del paso 5

// (b) UI_STRINGS — entrada completa (19 keys)
{LANG}: { reviews: '...', outOf5: '...', customerRatings: '...', basedOn: '...', basedOnAlt: '...', seeMore: '...', seeAllReviews: '...', writeReview: '...', anonymous: '...', noReviews: '...', noReviewsText: '...', multimediaReview: '...', ratingExcellent: '...', ratingVeryGood: '...', ratingGood: '...', googleReview: '...', opynioReview: '...', close: '...' },

// (c) LANG_MAP — código Google Translate
var LANG_MAP = { ..., {LANG}: '{LANG}' };  // o el código que Google espera
```

### 7. Cablear en [supabase/functions/generate-sitemap/index.ts](../../supabase/functions/generate-sitemap/index.ts)

4 cambios:

```ts
// (a) pathsByLanguage — bloque nuevo con slugs traducidos
{LANG}: {
    explore: '...',
    businesses: '...',
    business: '...',
    community: '...',
    whatsNew: '...',
    pricing: '...',
    support: '...',
    about: '...',
    faq: '...',
    howItWorks: '...',
    forBusinesses: '...',
    caseStudies: '...',
    widgets: 'widgets',
},

// (b) countryToLanguage
'{COUNTRY}': '{LANG}',

// (c) countryCodes array
const countryCodes = [..., '{COUNTRY}'];

// (d) countryToUrlCode (DB country code → URL code)
'{COUNTRY_UC}': '{COUNTRY}',
```

### 8. Cablear en [components/Meta.tsx](../../components/Meta.tsx)

```tsx
// hreflang
{ code: '{LANG}', path: `/{COUNTRY}${pathWithoutLang}` },
```

### 9. Cablear en [components/LanguagePopup.tsx](../../components/LanguagePopup.tsx)

3 lugares:

```tsx
// (a) popupTranslations — popup de bienvenida con bandera
{LANG}: {
    welcome: '...',
    selectLanguage: '...',
    changeLanguageHint: '...',
    countryDetected: '...',
    changeToLanguage: '...',
    keepCurrentLanguage: '...',
},

// (b) languageNames — añadir COLUMNA {LANG} en TODAS las filas existentes + fila {LANG} nueva
// Ej en cada fila: ..., {LANG}: '<nombre del idioma EN ese otro idioma>'
// Y fila nueva: {LANG}: { es: '...', en: '...', ..., {LANG}: '{NATIVE_NAME}' }

// (c) countryNames — añadir COLUMNA {COUNTRY_UC} en TODAS las filas + fila {LANG} si país nuevo
// Ej: ..., {COUNTRY_UC}: '<país EN ese otro idioma>'
```

### 10. Cablear en [components/ReviewCard.tsx](../../components/ReviewCard.tsx)

```tsx
// localeMap para Intl.RelativeTimeFormat
{LANG}: '{LOCALE_INTL}',
```

### 11. (SÓLO RTL) — añadir el idioma a `RTL_LANGUAGES`

En [contexts/i18nContext.tsx](../../contexts/i18nContext.tsx) el `I18nProvider` ya pone `<html dir>` y `<html lang>` (con `toBcp47`) en un `useLayoutEffect`. Solo hay que añadir el código a `RTL_LANGUAGES` si no está (`['ar', 'he', 'fa', 'ur']`). No pongas `lang`/`dir` en ningún otro sitio (ni App.tsx ni Meta.tsx): se pisarían.

Para RTL puro habrá que revisar también CSS: márgenes/paddings asimétricos (`mr-*`, `pl-*`) se invierten. Tailwind v3+ tiene `rtl:` variant pero hay que añadirlo a cada utility relevante. Esto es trabajo aparte del playbook — auditar visualmente.

---

## Verificación

### A. Rutas generadas + build vite

```bash
npm run check:locale-paths    # "Rutas de locales sincronizadas."
npx vite build 2>&1 | tail -5
```

En la salida del build debe aparecer un chunk `assets/locale-{LANG}-*.js` propio. Si el build se para con `[check-locale-paths]`, falta `npm run gen:locale-paths`.

Salida esperada:
```
✓ built in X.YYs
✅ HomePage → ...
```

Si falla: error en cableado o tipos. Revisa diff vs último cableado correcto.

### B. Audit de claves vs `en.ts`

Script reusable (no committearlo si tiene prefijo `_`):

```js
// scripts/_audit.mjs
const langs = ['es', 'en', 'br', 'ca', 'fr', 'de', 'it', 'cn', 'sv', 'pl', 'ja', 'pt', /* nuevo: */ '{LANG}'];
function flatten(o, p='') { const r={}; for (const k of Object.keys(o)) { const v=o[k]; const key=p?`${p}.${k}`:k; if (v && typeof v==='object' && !Array.isArray(v)) Object.assign(r, flatten(v,key)); else r[key]=v; } return r; }
const en = (await import('../locales/en.ts')).default;
const enKeys = Object.keys(flatten(en));
for (const lang of langs) {
  const m = (await import(`../locales/${lang}.ts`)).default;
  const flat = flatten(m);
  const missing = enKeys.filter(k => !(k in flat));
  console.log(`${lang}: ${missing.length} missing${missing.length ? ' → '+missing.slice(0,5).join(', ') : ' ✅'}`);
}
```

Ejecuta:
```bash
npx tsx scripts/_audit.mjs
```

Salida esperada: **todas las filas con `0 missing ✅`**. Si el idioma nuevo tiene missing, backfillear esas claves específicamente.

### C. Navegar la URL

Vite dev en `:3000`:
```
http://localhost:3000/{COUNTRY}            ← homepage en idioma nuevo
http://localhost:3000/{COUNTRY}/widgets    ← página de widgets
```

El header, footer y bloques principales deben verse en el idioma nuevo.

---

## Rollback

Si algo sale mal a mitad de camino:

1. **Borrar `locales/{LANG}.ts`** — punto de no retorno hasta este momento.
2. **Revertir cada cableado** — recorre los 10 puntos en orden inverso. El cableado es aditivo: cada entrada nueva es un diff limpio que se puede revertir con `git checkout -- <archivo>` si aún no commiteaste.
3. **`npx vite build`** para confirmar que vuelve a estar verde.

Si ya commiteaste y quieres revertir todo: `git revert <commit-de-cableado>` deshace todos los cambios a la vez.

---

## Variantes / gotchas

- **`pt` vs `br`**: ya cableados como locales separados (pt-PT vs pt-BR). No fusionar — vocabulario distinto (palavra-passe vs senha, utilizador vs usuário, análises vs avaliações). El mapeo está en `getLanguageForCountryCode`: `BR → br`, `PT → pt`.
- **Países hispanohablantes (MX, AR, CO, etc.)**: todos mapean a `es`. No crear locales `es-MX`, `es-AR`. La variante regional no justifica un locale separado (vocabulario muy similar).
- **Locale `pt-PT` (huérfano)**: si encuentras un locale en `locales/` que NO está importado en `i18nContext`, no es un bug — está pendiente de cablear. Verifica si el usuario lo quiere activar antes de borrarlo.
- **`countries.SE/PL/JP/...`**: cada vez que añadas un país nuevo (como parte de un idioma o solo), replícalo en **los 11 locales cableados**. Si no, el nombre del país aparece como código (`SE`) en el idioma que falte.
- **EMBED_VERSION debe coincidir** entre `widgetShared.ts` y el header de `widget.js`. Si no, los embeds antiguos cacheados no recargarán y los clientes verán UI de versión anterior.
- **Sub-agents con socket error**: los sub-agents pueden fallar en operaciones de Write grandes (>1500 líneas). Si pasa, relanzar el sub-agent o caer a Opción B (re-export con override) y backfillear después.
- **Categorías de empresas (`categories.*`)**: usan keys en español como ID en la BD (`"Restaurantes y Ocio"`, etc.). No renombrar las keys españolas, solo traducir los valores.
- **`paths.*` se copian a `contexts/localePaths.generated.ts`**: cualquier cambio en un bloque `paths` (o en el tipo `Language`) exige `npm run gen:locale-paths`. No edites el generado a mano. El resto de claves NO afecta al generado.
- **`paths.*` cambios rompen SEO**: si un idioma ya existe en producción, NO cambies sus slugs de paths sin redirects 301. Las URLs cambian y Google las desindexa.
- **Categorías y subcategorías**: el archivo `subcategories` también usa snake_case en inglés Y duplicados en snake_case en español (legacy). Hay ~95 subcategorías. Replicar de `en.ts` exactamente.

---

## Idiomas actualmente cableados (state of the world)

| Idioma | Código | País URL | RTL | Estado |
|---|---|---|---|---|
| Español | es | (raíz) | no | ✅ |
| English | en | (US/GB) | no | ✅ |
| Português Brasil | br | br | no | ✅ |
| Português Portugal | pt | pt | no | ✅ |
| Català | ca | ad | no | ✅ |
| Français | fr | fr | no | ✅ |
| Deutsch | de | de | no | ✅ |
| Italiano | it | it | no | ✅ |
| 简体中文 | cn | cn | no | ✅ |
| Svenska | sv | se | no | ✅ |
| Polski | pl | pl | no | ✅ |
| 日本語 | ja | jp | no | ✅ |

## Idiomas listos sin cablear (locale en disco, sin importar)

| Idioma | Código | País URL sugerido | RTL | Próximo paso |
|---|---|---|---|---|
| Nederlands | nl | nl | no | cablear (no requiere RTL) |
| Русский | ru | ru | no | cablear |
| 한국어 | ko | kr | no | cablear |
| العربية | ar | ae/sa/eg | **sí** | cablear + RTL (paso 11) + auditoría visual CSS |
