# Playbooks

Procedimientos paso a paso para operaciones repetitivas. Cada playbook está pensado para que **Claude** (o un humano) lo pueda ejecutar de principio a fin sin tener que reconstruir el contexto cada vez.

## Disponibles

| Playbook | Cuándo usarlo |
| - | - |
| [add-language.md](./add-language.md) | Añadir un idioma nuevo a la app + widget + sitemap |

## Pendientes (placeholders)

| Playbook | Estado |
| - | - |
| `add-business.md` | TODO — pasos para registrar empresa manualmente vs scraping bulk |
| `add-review.md` | TODO — flujo de creación de reseña, moderación, importación TrustIndex/Google |
| `add-country.md` | TODO — añadir país (sólo país, sin idioma nuevo) — implica tocar `COUNTRIES`, `SEDE_COUNTRIES`, `countries.*` en los 11 locales, `Meta.tsx` hreflang si aplica, mapas de timezone, etc. |
| `add-edge-function.md` | TODO — patrón base de Edge Function en Supabase (CORS, auth, errores, secrets) |
| `bump-widget-version.md` | TODO — pasos al cambiar `public/widget.js` (header + EMBED_VERSION + impacto cliente) |

## Formato esperado

Cada playbook sigue el mismo esquema (ver [`_template.md`](./_template.md)):

1. **Resumen** — 1-2 líneas qué hace este playbook y cuándo aplica
2. **Cuándo usar / cuándo no** — escenarios concretos
3. **Pre-requisitos** — qué información hay que tener antes de empezar
4. **Pasos** — numerados, con código exacto y archivos a tocar
5. **Verificación** — comandos/audits que confirman que está bien
6. **Rollback** — cómo deshacer si algo sale mal
7. **Variantes / gotchas** — casos especiales conocidos

Los nombres usan kebab-case con verbo: `add-X`, `bump-X`, `migrate-X`, `cleanup-X`.

## Cómo crear uno nuevo

1. Copia `_template.md` a `<nombre>.md`
2. Rellena cada sección con pasos verificados (no especulación)
3. Si lo escribes después de ejecutar el proceso, incluye los **comandos exactos** que funcionaron, no aproximaciones
4. Añádelo a la tabla de "Disponibles" en este README
5. Si es relevante para Claude por defecto, menciónalo también en `/CLAUDE.md`
