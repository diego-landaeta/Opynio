# Migraciones

## Layout

- **`YYYYMMDDhhmmss_<name>.sql`** — migraciones gestionadas por el CLI de Supabase. Las aplica `supabase db push` (o el Management API).
- **`create_*.sql` / `fix_*.sql`** (sin timestamp) — legado. Se aplicaron manualmente vía Supabase Dashboard → SQL Editor. Se mantienen como referencia para nuevos entornos.

## Aplicar una migración nueva

```bash
# Crear archivo con timestamp
supabase migration new <descriptive_name>

# Aplicar a remoto
supabase db push
```

O vía Dashboard → SQL Editor → pegar el contenido del archivo → Run.

## Archivos legado — qué hace cada uno

| Archivo | Contenido |
| - | - |
| [`create_business_directory_function.sql`](./create_business_directory_function.sql) | RPC `get_businesses_with_review_stats()`, vista materializada `business_metrics` (refresca con `refresh_business_metrics()`), índices de rendimiento en `businesses`/`reviews`. |
| [`create_claims_table.sql`](./create_claims_table.sql) | Tabla `claims` (reclamación de empresas por dueños). |
| [`create_review_votes_system.sql`](./create_review_votes_system.sql) | Tabla `review_votes` con UNIQUE(review_id, user_id), triggers de contadores `helpful_votes`/`not_helpful_votes` en `reviews`, RLS, cascadas. |
| [`fix_bug_reports_rls.sql`](./fix_bug_reports_rls.sql) | Ajustes RLS sobre tabla `bug_reports`. |
| [`fix_claims_foreign_keys.sql`](./fix_claims_foreign_keys.sql) | Corrige FK de `claims.claimant_id` (auth.users → profiles) para que las consultas con embedding funcionen. |

## Refrescar `business_metrics`

```sql
SELECT refresh_business_metrics();
```

Ejecutar tras importar muchas reseñas. Para automatizar cada hora, activa `pg_cron` (Database → Extensions) y:

```sql
SELECT cron.schedule('refresh-business-metrics', '0 * * * *',
                     $$SELECT refresh_business_metrics();$$);
```
