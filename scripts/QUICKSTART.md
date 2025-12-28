# 🚀 Guía Rápida - Poblar Votos

## TL;DR - Lo Mínimo Necesario

```bash
# 1. Instalar dependencias
npm install

# 2. Crear archivo .env con tus credenciales
cp .env.example .env

# 3. Editar .env y agregar:
#    - VITE_SUPABASE_URL
#    - SUPABASE_SERVICE_ROLE_KEY

# 4. Ejecutar el script
npm run populate-votes
```

## 🎯 Tres Opciones de Uso

### Opción 1: Poblar TODAS las reseñas (Recomendado)

```bash
npm run populate-votes
```

**Cuándo usar**: Cuando quieres poblar votos en todas las reseñas de la plataforma.

**Tiempo estimado**:
- 100 reseñas → ~2 minutos
- 1,000 reseñas → ~15 minutos
- 10,000 reseñas → ~2.5 horas
- 117,052 reseñas → ~35 horas

**💡 Tip**: Ejecuta esto durante la noche o en un servidor.

---

### Opción 2: Poblar UNA empresa específica

```bash
npm run populate-votes-single <business_id>
```

**Ejemplo**:
```bash
npm run populate-votes-single 123e4567-e89b-12d3-a456-426614174000
```

**Cuándo usar**: Para testing, o cuando solo quieres agregar votos a una empresa específica.

**Tiempo estimado**: ~10 segundos por empresa (depende de cuántas reseñas tenga).

---

### Opción 3: Configuración personalizada

Edita [`scripts/populate-review-votes.ts`](./populate-review-votes.ts) y ajusta el objeto `CONFIG`:

```typescript
const CONFIG = {
  minVotesPerReview: 10,        // Más votos por reseña
  maxVotesPerReview: 50,
  batchSize: 100,               // Batches más grandes (más rápido)
  delayBetweenBatches: 1000,    // Menos delay (más rápido pero más riesgoso)
  // ...
};
```

## 📊 ¿Qué Hace el Script?

```
┌─────────────────────────────────────────────────────────┐
│  🏢 Empresa Normal          🏢 Empresa Premium          │
│                                                         │
│  ⭐⭐⭐⭐⭐  Review #1        ⭐⭐⭐⭐⭐  Review #1        │
│  👍👍👍👎👎👎 (50% pos)    👍👍👍👍👍👍👍👍👎 (90% pos)│
│                                                         │
│  ⭐⭐⭐⭐   Review #2        ⭐⭐⭐⭐⭐  Review #2        │
│  👍👍👍👍👎👎 (66% pos)    👍👍👍👍👍👍👍👍👍 (100% pos)│
│                                                         │
│  ⭐⭐⭐    Review #3        ⭐⭐⭐⭐   Review #3        │
│  👍👍👎👎👎👎 (33% pos)    👍👍👍👍👍👍👎👎 (75% pos)│
└─────────────────────────────────────────────────────────┘

Normal: 75% votos positivos en promedio
Premium: 90% votos positivos en promedio
```

## ⚙️ Configuración por Defecto

| Parámetro | Valor | Descripción |
|-----------|-------|-------------|
| **Votos por reseña** | 3-25 | Cantidad aleatoria entre estos valores |
| **Ratio positivo (normal)** | 75% | 3 de cada 4 votos serán positivos |
| **Ratio positivo (premium)** | 90% | 9 de cada 10 votos serán positivos |
| **Batch size** | 50 | Procesa 50 reseñas a la vez |
| **Delay entre batches** | 2000ms | 2 segundos de pausa entre batches |
| **Delay entre inserts** | 100ms | 100ms entre cada voto |

## 🛡️ Protección para Empresas Premium

El script detecta automáticamente empresas premium basándose en el campo `plan`:

```typescript
premiumPlans: ['starter', 'growth', 'pro', 'enterprise']
```

Las empresas premium reciben:
- ✅ Mayor ratio de votos positivos (90% vs 75%)
- ✅ Se identifica con ⭐ en los logs

## 🔐 Obtener Service Role Key

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Settings → API
3. Busca la sección **Project API keys**
4. Copia la key que dice `service_role` (¡NO la `anon`!)
5. Pégala en tu `.env`:

```env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

⚠️ **IMPORTANTE**: Esta key tiene permisos totales. No la expongas en el frontend ni en repos públicos.

## 🐛 Problemas Comunes

### "No hay usuarios en la base de datos"

**Solución**: Registra algunos usuarios primero o crea perfiles manualmente:

```sql
-- Ejemplo: crear 10 usuarios de prueba
INSERT INTO profiles (id, name, username, role)
SELECT
  gen_random_uuid(),
  'Usuario ' || n,
  'user_' || n,
  'authenticated'
FROM generate_series(1, 10) n;
```

### "relation 'review_votes' does not exist"

**Solución**: Ejecuta la migración primero:

```bash
# En Supabase Dashboard → SQL Editor
-- Ejecuta: supabase/migrations/create_review_votes_system.sql
```

### El script es muy lento

**Opciones**:

1. **Aumentar batch size**:
   ```typescript
   batchSize: 100,  // Default: 50
   ```

2. **Reducir delays**:
   ```typescript
   delayBetweenBatches: 1000,  // Default: 2000
   delayBetweenInserts: 50,    // Default: 100
   ```

3. **Usar el script de empresa individual** para testing:
   ```bash
   npm run populate-votes-single <business_id>
   ```

### Límite de tasa de Supabase

Si ves errores tipo `rate limit exceeded`:

1. **Aumenta los delays**:
   ```typescript
   delayBetweenBatches: 3000,  // Más espera
   ```

2. **Reduce batch size**:
   ```typescript
   batchSize: 25,  // Batches más pequeños
   ```

3. **Ejecuta en horarios de poco tráfico** (madrugada)

## 📈 Verificar Resultados

```sql
-- Ver empresas con más votos
SELECT
  b.name,
  b.plan,
  COUNT(DISTINCT r.id) as total_reviews,
  SUM(r.helpful_votes) as total_helpful,
  SUM(r.not_helpful_votes) as total_not_helpful,
  ROUND(AVG(r.helpful_votes::float / NULLIF(r.helpful_votes + r.not_helpful_votes, 0)) * 100, 1) as positive_ratio
FROM businesses b
JOIN reviews r ON r.business_id = b.id
WHERE r.status = 'approved'
  AND (r.helpful_votes + r.not_helpful_votes) > 0
GROUP BY b.id, b.name, b.plan
ORDER BY total_helpful + total_not_helpful DESC
LIMIT 20;
```

## 💡 Tips Pro

1. **Testing local**: Usa primero `populate-votes-single` con una empresa de prueba

2. **Producción**: Ejecuta `populate-votes` en un servidor o durante la noche

3. **Monitoreo**: Observa los logs en tiempo real para detectar problemas

4. **Idempotencia**: Puedes ejecutar el script varias veces sin problemas

5. **Backup**: Haz un backup antes de ejecutar en producción:
   ```bash
   # En Supabase Dashboard → Database → Backups
   ```

## 📚 Más Información

- [README completo](./README.md) - Documentación detallada
- [Sistema de votos](../supabase/migrations/README_VOTES.md) - Cómo funciona internamente
- [Supabase Docs](https://supabase.com/docs) - Documentación oficial

## ❓ ¿Necesitas Ayuda?

Si algo no funciona:

1. ✅ Revisa que todas las variables de entorno estén configuradas
2. ✅ Verifica que tengas usuarios en la tabla `profiles`
3. ✅ Asegúrate de que la migración de votos esté aplicada
4. ✅ Revisa los logs del script para mensajes de error específicos
5. ✅ Lee la sección de "Problemas Comunes" arriba

---

**¡Listo!** Con esto ya puedes poblar votos en tus reseñas sin saturar Supabase 🚀
