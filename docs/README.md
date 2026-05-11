# 📚 Documentación de Opynio

Documentación técnica de Opynio — plataforma de reseñas verificadas.

## Índice

| # | Documento | Cuándo usar |
| - | - | - |
| 01 | [Base de datos](./01-DATABASE-SETUP.md) | Configurar Supabase desde cero: tablas, RLS, triggers, índices. |
| 02 | [Sistema de scraping](./02-SCRAPING-SYSTEM.md) | Importar empresas/reseñas desde Google Maps. SerpAPI + Gemini + Edge Functions. |
| 03 | [Plataforma](./03-PLATFORM-DOCUMENTATION.md) | Onboarding: arquitectura, stack, estructura, roles, i18n, despliegue. |
| 04 | [Integración Stripe](./04-STRIPE-INTEGRATION.md) | Suscripciones, checkout, webhooks, modelo de facturación. |
| 05 | [Widget](./05-WIDGET.md) | Widget `stars-carousel` (SEO + bot path) y plan futuro de Shadow DOM. |
| 06 | [SEO y rendimiento](./06-SEO-AND-PERFORMANCE.md) | Política de noindex, Soft 404, optimización de bundle, Lighthouse. |

## Migraciones SQL

En [`../supabase/migrations/`](../supabase/migrations/). Las que llevan prefijo timestamp (`YYYYMMDD…`) las aplica el CLI de Supabase; las sin timestamp son legado histórico ya aplicado.

## Email templates

Plantillas de auth (Supabase) en [`./email-templates/`](./email-templates/).

## Inicio rápido

1. [03 — Plataforma](./03-PLATFORM-DOCUMENTATION.md) → arquitectura y entorno local.
2. [01 — Base de datos](./01-DATABASE-SETUP.md) → ejecutar SQL inicial.
3. [02 — Scraping](./02-SCRAPING-SYSTEM.md) si vas a tocar importación.
4. [04 — Stripe](./04-STRIPE-INTEGRATION.md) si vas a tocar pagos.
