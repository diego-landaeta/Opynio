# Playbook: añadir claves de traducción a los 31 locales

## Resumen

Cómo añadir una o varias claves nuevas de i18n a **todos** los idiomas cableados sin
editar 31 ficheros a mano. Escrito después de hacerlo diez veces seguidas (52 claves
en total) con el inyector que se describe aquí.

## Cuándo usar / cuándo no

- **Úsalo** cuando añadas texto visible nuevo a la app (una pantalla, un botón, un aviso).
- **No lo uses** para añadir un **idioma** nuevo: eso es [add-language.md](./add-language.md).
- **No lo uses** para los textos del widget embebido: `public/widget.js` tiene su propio
  `UI_STRINGS` (20 idiomas) al margen de `locales/`. Si el texto sale en el widget,
  hay que ponerlo **en los dos sitios**.

## Pre-requisitos

- Saber en qué **bloque** van las claves: `businessDashboard`, `businessPage`, `common`…
  El bloque importa: el inyector ancla en una clave existente de ese bloque.
- Tener las traducciones. Hay 31 ficheros pero **26 juegos de idioma**: `gb`, `au`, `ie`
  y `sg` comparten el inglés, y `at` comparte el alemán.

## Datos útiles

- 31 locales cableados en `contexts/i18nContext.tsx` (el `CLAUDE.md` decía 11 —
  estaba desactualizado; cuéntalos ahí, no de memoria).
- Cada locale tiene **dos** bloques relevantes: `paths` (segmentos de URL, ~línea 20)
  y los bloques de textos (~línea 900+). Una sección nueva del panel necesita clave
  en los dos; un texto normal solo en el segundo.
- Si falta una clave en un idioma, `t()` **cae al español**, no revienta. Si falta en
  español también, se imprime la clave cruda en pantalla (`businessPage.productsTitle`).
  Por eso siempre 31/31.

## Pasos

1. **Escribe las traducciones** en un fichero `scripts/_i18n-<tema>/traducciones.mjs`
   (`scripts/_*` está gitignored):

   ```js
   const set = (a, b) => ({ claveUno: a, claveDos: b });
   export const KEYS = {
     es: set('Texto', 'Otro'),
     en: set('Text', 'Other'),
     // … 24 juegos más
   };
   KEYS.gb = KEYS.en; KEYS.au = KEYS.en; KEYS.ie = KEYS.en; KEYS.sg = KEYS.en;
   KEYS.at = KEYS.de;
   ```

2. **Elige un ancla**: una clave que ya exista en los 31 ficheros **dentro del bloque
   correcto**. Compruébalo antes:

   ```bash
   grep -l "    allReviewsFor:" locales/*.ts | wc -l   # tiene que dar 31
   ```

3. **Inyecta** con un script que inserte detrás del ancla, respetando la indentación
   y el estilo de comillas (comillas simples salvo que el texto lleve apóstrofo, y
   entonces `JSON.stringify`). Usa `scripts/_i18n-productos/inyectar.mjs` como base:
   es idempotente (si la clave ya está, salta el fichero).

   ```bash
   node scripts/_i18n-<tema>/inyectar.mjs --dry-run   # informa, no escribe
   node scripts/_i18n-<tema>/inyectar.mjs
   ```

## Verificación

```bash
# 31/31, sin excepciones
grep -l "claveUno" locales/*.ts | wc -l

# que haya caído en el bloque correcto (mira el nombre del bloque anterior)
awk 'NR<=LINEA && /^  [a-zA-Z]+: \{/ {b=$0} END{print b}' locales/es.ts

# y que compile (no hay tsconfig: el build es la comprobación)
npx vite build
```

Y **míralo en pantalla**. Una clave puesta en el bloque equivocado compila
perfectamente y se muestra cruda al usuario.

## Rollback

`git checkout -- locales/` deshace la inyección entera: no toca nada más.

## Gotchas

- **El acento de `imágenes` viene en otra normalización Unicode** en algunos ficheros.
  Si un `str.replace` no encuentra un texto que ves con tus ojos, normaliza los dos
  lados con `unicodedata.normalize('NFC', …)` antes de comparar.
- **No confíes en el orden de las apariciones**: `dashboardWidgets` sale dos veces por
  fichero (una en `paths`, otra en los textos). El inyector cuenta las anclas y aborta
  si no encuentra las que espera.
- **Los slugs de URL no se traducen todos**: unos idiomas usan la palabra local
  (`ginys`, `製品`) y otros dejan el inglés. Copia el criterio que ya use ese locale.
