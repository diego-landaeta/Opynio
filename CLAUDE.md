# CLAUDE.md

Contexto específico de este proyecto que Claude debe tener siempre cargado.

## Stack rápido

- **Frontend**: React 19 + Vite + TypeScript + Tailwind, sin tsconfig (Vite resuelve los .ts directamente).
- **Backend**: Supabase (Postgres + Edge Functions Deno + Auth + Storage + RLS).
- **i18n**: Sistema casero en [contexts/i18nContext.tsx](contexts/i18nContext.tsx), un fichero TS por idioma en [locales/](locales/). 11 idiomas cableados (es/en/br/ca/fr/de/it/cn/sv/pl/ja/pt) + 4 huérfanos listos sin cablear (nl/ru/ko/ar).
- **Widget embebido**: [public/widget.js](public/widget.js) (clientes lo cargan en sus webs). Tiene su propio `UI_STRINGS` independiente de los locales — cambios deben replicarse manualmente.
- **Pagos**: Stripe (checkout + portal + webhook).
- **Deploy**: estático via FileZilla; build en `dist/` (commiteado al repo).

## Playbooks

Para procesos repetitivos lee primero **[docs/playbooks/README.md](docs/playbooks/README.md)**. Pasos verificados, evita rehacer la operación desde cero. Disponibles:

- **[add-language.md](docs/playbooks/add-language.md)** — añadir un idioma nuevo extremo a extremo (locale file + 9 puntos de cableado + RTL si aplica + auditoría).

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
- **Categorías de empresas** usan keys en español como identificadores en la BD (`"Restaurantes y Ocio"`, `"Salud y Bienestar"`). Los locales mapean esas keys a su traducción. NO renombrar las keys españolas.
- **Países BR y PT**: locales separados (`br` = pt-BR, `pt` = pt-PT). El mapeo está en `getLanguageForCountryCode` en i18nContext.
- **`countries.SE/PL/JP`** existen en TODOS los 11 locales cableados. Si añades nuevo país, replica en los 11.
