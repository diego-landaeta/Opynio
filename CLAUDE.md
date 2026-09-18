# CLAUDE.md

Contexto específico de este proyecto que Claude debe tener siempre cargado.

## Stack rápido

- **Frontend**: React 19 + Vite + TypeScript + Tailwind, sin tsconfig (Vite resuelve los .ts directamente).
- **Backend**: Supabase (Postgres + Edge Functions Deno + Auth + Storage + RLS).
- **i18n**: Sistema casero en [contexts/i18nContext.tsx](contexts/i18nContext.tsx), un fichero TS por idioma en [locales/](locales/). **31 idiomas cableados** — cuéntalos en los `import` de i18nContext, no de memoria. Si falta una clave en un idioma, `t()` cae al español; si falta también ahí, imprime la clave cruda en pantalla.
- **Widget embebido**: [public/widget.js](public/widget.js) (clientes lo cargan en sus webs). Tiene su propio `UI_STRINGS` independiente de los locales — cambios deben replicarse manualmente.
- **Pagos**: Stripe (checkout + portal + webhook).
- **Deploy**: estático via FileZilla; build en `dist/`. Ojo: `dist` está en `.gitignore` (línea 11) y **no hay ni un fichero suyo trackeado**, pese a lo que decía antes este documento.

## Playbooks

Para procesos repetitivos lee primero **[docs/playbooks/README.md](docs/playbooks/README.md)**. Pasos verificados, evita rehacer la operación desde cero. Disponibles:

- **[add-language.md](docs/playbooks/add-language.md)** — añadir un idioma nuevo extremo a extremo (locale file + 9 puntos de cableado + RTL si aplica + auditoría).
- **[add-i18n-keys.md](docs/playbooks/add-i18n-keys.md)** — añadir claves de traducción nuevas a los 31 locales con un inyector, en vez de editar 31 ficheros a mano.
- **[bump-widget-version.md](docs/playbooks/bump-widget-version.md)** — tocar `public/widget.js` sin dejar a los clientes con la versión cacheada.

Si vas a hacer un proceso que se repetirá y aún no hay playbook, propón crearlo después.

## Reglas firmes específicas de este proyecto

- **Nunca regenerar `dist/` y commitearlo** sin que el usuario lo pida. El flujo de despliegue lo decide él.
- **Versionado del widget**: cuando toques `public/widget.js`, bumpea SIEMPRE el header `Opynio Widget Loader vX.Y.Z` Y la constante `EMBED_VERSION` en [components/pages/business/dashboard/widgets/widgetShared.ts](components/pages/business/dashboard/widgets/widgetShared.ts). Ambos deben coincidir; si no, los clientes cargan widget con UI vieja cacheada.
- **Variables `VITE_*`**: cualquier `VITE_*_TOKEN`/`*_SECRET`/`*_API_KEY` termina en el bundle público. Sólo `*_PUBLISHABLE_KEY` o `*_PUBLIC_KEY` son aceptables ahí. Service-role/webhook secrets viven en Supabase secrets.
- **Pre-commit secret scan**: antes de cualquier `git commit` o subida manual de `dist/`, invocar el skill `pre-commit-secret-scan`.
- **Scripts efímeros con prefijo `_`**: cualquier script en `scripts/_*` está gitignored. Útil para audits, diffs, scaffolding temporal.

## Quirks del codebase

- **No hay `tsconfig.json`**. Vite resuelve TS directamente. `npx tsc --noEmit` falla — para verificar compilación usa `npx vite build`.
- **PowerShell en Windows**: shell por defecto es PowerShell. `&&` no funciona, usa `; if ($?) {...}`. Bash también disponible vía tool.
- **Categorías de empresas** usan keys en español como identificadores en la BD (`"Restaurantes y Ocio"`, `"Salud y Bienestar"`). Los locales mapean esas keys a su traducción. NO renombrar las keys españolas. Si una fila trae una categoría que no está en los locales, la UI la humaniza (guiones bajos a espacios) en vez de imprimir el identificador.
- **Productos reseñables**: viven en `review_subjects` + `review_subject_links` (ver [docs/01-DATABASE-SETUP.md](docs/01-DATABASE-SETUP.md)). **No confundir con la tabla `products`, que es de Stripe.** Regla que no se puede romper: el total de la empresa cuenta TODAS sus reseñas, no la suma de sus productos — las de Google y las scrapeadas no tienen producto.
- **Países BR y PT**: locales separados (`br` = pt-BR, `pt` = pt-PT). El mapeo está en `getLanguageForCountryCode` en i18nContext.
- **`countries.SE/PL/JP`** existen en TODOS los locales cableados. Si añades nuevo país, replica en los 31.
- **`public/widget.js` no pasa por el build.** `npx vite build` no detecta un error de sintaxis ahí; se sirve tal cual al cliente. Compruébalo con `node -e "new Function(require('fs').readFileSync('public/widget.js','utf8'))"`.
