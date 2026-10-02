# Scripts

Herramientas del proyecto. Las que se lanzan con npm están en [`package.json`](../package.json) → `scripts`.

## En git

| Script | Para qué | Cómo |
|---|---|---|
| `typecheck.mjs` + `typecheck-baseline.txt` | Comprobación de tipos contra una línea base (no hay `tsconfig.json`) | `npm run typecheck` |
| `gen-locale-paths.mjs` | Copia el bloque `paths` de los locales a `contexts/localePaths.generated.ts` | `npm run gen:locale-paths` · `npm run check:locale-paths` |
| `check-widget-version.mjs` | Comprueba que `public/widget.js` y `EMBED_VERSION` coinciden | `npm run check:widget` |
| `i18n-inyectar.mjs` | Añade claves de traducción a los 31 locales | [docs/playbooks/add-i18n-keys.md](../docs/playbooks/add-i18n-keys.md) |
| `local/` | Base de datos y widget en local (Docker) | [local/README.md](local/README.md) |

`npm run verify` ejecuta typecheck, widget y rutas de locales.

## Fuera de git (`scripts/_*`)

Todo lo que empieza por `_` está en `.gitignore`: scripts de un solo uso, datos de producción
y copias de seguridad. No se suben al repositorio y pueden contener datos personales o
credenciales leídas de `.env` (nunca escritas en los ficheros). Los que siguen en uso:

| Carpeta / fichero | Para qué |
|---|---|
| `_db.cjs`, `_bizs.json` | Consultas a producción con la Management API (PAT en `.env`). |
| `_catalogo/` | Catálogo de productos y asignación reseña → producto (runbook, paso 4b). |
| `_datos-prod/` | SQL de datos de producción con su marcha atrás (runbook). |
| `_backup-prod-functions/` | Copia de las Edge Functions desplegadas, para volver atrás. |
| `_prodlike/` | Copias de la estructura de producción para ensayar migraciones. |
| `_backup/` | `backup-completo.cjs` (copia completa de producción, solo lectura) y `restaurar-tabla.cjs` (reinserta filas que falten). |
| `_deploy-edge-*.cjs`, `_get-deployed-code.cjs`, `_share/` | Despliegue y diagnóstico (runbook). |
| `_inject-reviews.cjs`, `_rollback-sep.sql`, `_ids-*-lote.json` | Carga mensual de reseñas: patrón y marcha atrás del último mes. |

Limpieza del 30/09/2026: los scripts de un solo uso ya ejecutados se archivaron en
`C:\Users\nange\Backups\opynio-limpieza-scripts-2026-09-30.zip` (no en el repo).
