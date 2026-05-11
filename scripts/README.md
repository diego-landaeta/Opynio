# Scripts

Utilities para poblar datos, migrar categorías y consultas SQL útiles. Todos los scripts ejecutables están en [`package.json`](../package.json) → `scripts`.

## Variables de entorno

Todos requieren `.env` con:

```env
VITE_SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # Settings → API → service_role (¡NO la anon!)
```

⚠️ `SERVICE_ROLE_KEY` tiene permisos totales — nunca exponerla en frontend ni repos públicos.

---

## Poblar votos en reseñas

[`populate-review-votes.ts`](./populate-review-votes.ts) distribuye votos (útil/no útil) de forma realista, idempotente, con rate limiting.

```bash
npm run populate-votes                          # toda la BD
npm run populate-votes-single <business_id>     # solo una empresa
npm run clear-votes                             # borrar todos los votos
```

**Configuración** (objeto `CONFIG` en el script):

| Parámetro | Default | Descripción |
| - | - | - |
| `minVotesPerReview` / `maxVotesPerReview` | 3 / 25 | Rango aleatorio por reseña |
| `defaultPositiveRatio` | 0.75 | Empresas normales: 75% positivos |
| `premiumPositiveRatio` | 0.90 | Premium (starter/growth/pro/enterprise): 90% positivos |
| `batchSize` | 50 | Reseñas por batch |
| `delayBetweenBatches` | 2000 ms | Pausa entre batches |
| `delayBetweenInserts` | 100 ms | Pausa entre cada insert |
| `maxRetries` | 3 | Reintentos por error temporal |

**Tiempos estimados**: 100 reseñas → ~2 min · 1k → ~15 min · 10k → ~2.5 h · 100k → ~35 h.

**Si ves rate limit**: subir `delayBetweenBatches` a 3000+, bajar `batchSize` a 25, ejecutar de madrugada.

---

## Migrar categorías

Normaliza el campo `category` de empresas al formato `Categoría Principal: Subcategoría` (español, sin snake_case).

```bash
npm run list-categories              # qué hay en BD ahora
npm run migrate-categories:dry-run   # preview sin tocar la BD
npm run migrate-categories           # ejecutar
```

**Antes de ejecutar en prod**: backup de la BD (Supabase Dashboard → Database → Backups) + revisar dry-run.

**Modificar mapeo**: editar [`category-mapping.ts`](./category-mapping.ts) → `CATEGORY_MAPPING: Record<string, string>`.

Las categorías se guardan en español. Las traducciones (en, pt/br, fr, it, de, ca, cn) viven en el frontend (sistema i18n).

[`update-i18n-categories.ts`](./update-i18n-categories.ts) regenera los locales a partir del mapping.

---

## Consultas SQL útiles

[`USEFUL_QUERIES.sql`](./USEFUL_QUERIES.sql) — colección de SELECTs para analizar votos, ratios premium vs normal, top empresas, etc. Pegar en Supabase Dashboard → SQL Editor.

---

## Verificar resultados rápido

```sql
-- Total de votos creados
SELECT COUNT(*) FROM review_votes;

-- Top 20 reseñas con más votos
SELECT r.id, b.name, r.helpful_votes, r.not_helpful_votes,
       r.helpful_votes + r.not_helpful_votes AS total
FROM reviews r JOIN businesses b ON b.id = r.business_id
WHERE r.status = 'approved'
ORDER BY total DESC LIMIT 20;

-- Ratio positivo por plan (verifica diferencia premium vs normal)
SELECT b.plan, COUNT(*) AS reviews,
       ROUND(AVG(r.helpful_votes::float
                 / NULLIF(r.helpful_votes + r.not_helpful_votes, 0)) * 100, 1) AS positive_pct
FROM businesses b JOIN reviews r ON r.business_id = b.id
WHERE r.status = 'approved' AND (r.helpful_votes + r.not_helpful_votes) > 0
GROUP BY b.plan ORDER BY positive_pct DESC;
```

---

## Problemas comunes

| Error | Causa | Solución |
| - | - | - |
| `Falta configuración` | `.env` incompleto | Pon `VITE_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` |
| `relation 'review_votes' does not exist` | Migración de votos no aplicada | Aplica [`../supabase/migrations/create_review_votes_system.sql`](../supabase/migrations/create_review_votes_system.sql) |
| `No hay usuarios en la base de datos` | `profiles` vacío | Registra usuarios o inserta perfiles de prueba |
| Votos duplicados | Re-ejecución | Esperado: el script es idempotente y los ignora |
