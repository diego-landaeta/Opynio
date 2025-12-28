# Script de Población de Votos para Reseñas

Este script distribuye votos (útil/no útil) en las reseñas de forma controlada y eficiente, sin saturar Supabase.

## 🎯 Características

- ✅ **Procesamiento por lotes**: Procesa las reseñas en batches para no saturar la base de datos
- ✅ **Rate limiting**: Delays configurables entre requests para evitar límites de tasa
- ✅ **Protección premium**: Las empresas premium reciben más votos positivos (90% vs 75%)
- ✅ **Distribución realista**: Genera entre 3-25 votos por reseña
- ✅ **Retry logic**: Reintenta automáticamente en caso de errores temporales
- ✅ **Idempotente**: Ignora votos duplicados si se ejecuta varias veces
- ✅ **Progreso detallado**: Muestra el progreso en tiempo real

## 📋 Pre-requisitos

1. Tener el sistema de votos instalado (migración `create_review_votes_system.sql`)
2. Tener reseñas aprobadas en la base de datos
3. Tener usuarios en la tabla `profiles`

## 🔧 Instalación

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
```

Necesitas agregar estas variables a tu archivo `.env` o `.env.local`:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-aqui
```

**⚠️ IMPORTANTE**: Necesitas la **SERVICE ROLE KEY** (no la anon key). La encuentras en:
- Supabase Dashboard → Settings → API → `service_role` key (secret)

## 🚀 Uso

### Opción 1: Con variables de entorno en el archivo

```bash
npm run populate-votes
```

### Opción 2: Pasando variables directamente

```bash
VITE_SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx npm run populate-votes
```

### Opción 3: En Windows (PowerShell)

```powershell
$env:VITE_SUPABASE_URL="https://xxx.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="xxx"
npm run populate-votes
```

## ⚙️ Configuración

Puedes ajustar los parámetros editando el objeto `CONFIG` en [`populate-review-votes.ts`](./populate-review-votes.ts):

```typescript
const CONFIG = {
  // Votos por reseña (aleatorio entre min y max)
  minVotesPerReview: 3,
  maxVotesPerReview: 25,

  // Ratio de votos positivos (0-1)
  defaultPositiveRatio: 0.75,    // 75% positivos para empresas normales
  premiumPositiveRatio: 0.90,    // 90% positivos para empresas premium

  // Batch size - procesar N reseñas a la vez
  batchSize: 50,

  // Delays en milisegundos
  delayBetweenBatches: 2000,     // 2 segundos entre batches
  delayBetweenInserts: 100,      // 100ms entre cada insert

  // Reintentos en caso de error
  maxRetries: 3,

  // Planes considerados premium
  premiumPlans: ['starter', 'growth', 'pro', 'enterprise'],
};
```

## 📊 Ejemplo de Salida

```
🚀 Iniciando población de votos en reseñas...

⚙️  Configuración:
   - Votos por reseña: 3-25
   - Ratio positivo normal: 75%
   - Ratio positivo premium: 90%
   - Batch size: 50 reseñas
   - Delay entre batches: 2000ms
   - Delay entre inserts: 100ms

📋 Obteniendo reseñas aprobadas...
✅ Encontradas 117052 reseñas aprobadas
👥 Verificando usuarios para votos...
✅ Usando 1000 usuarios existentes para generar votos

📊 Obteniendo planes de empresas...
✅ 983 empresas (150 premium)

📦 Procesando 117052 reseñas en batches de 50...

📦 Batch 1/2342 (50 reseñas):
  ✓ Reseña 1a2b3c4d... - 12 votos (👍 9, 👎 3) ⭐ PREMIUM
  ✓ Reseña 5e6f7g8h... - 8 votos (👍 6, 👎 2)
  ✓ Reseña 9i0j1k2l... - 15 votos (👍 11, 👎 4)
  ...

   Batch completado: 50 exitosas, 0 fallidas

⏳ Esperando 2000ms antes del siguiente batch...

...

============================================================
✅ PROCESO COMPLETADO
============================================================
📊 Total de reseñas procesadas: 117052
✓  Exitosas: 117052
✗  Fallidas: 0
📈 Tasa de éxito: 100.0%
============================================================
```

## 🔍 Verificación

Después de ejecutar el script, puedes verificar los resultados en Supabase:

```sql
-- Ver total de votos creados
SELECT COUNT(*) FROM review_votes;

-- Ver distribución de votos por reseña
SELECT
  r.id,
  b.name as business_name,
  r.helpful_votes,
  r.not_helpful_votes,
  r.helpful_votes + r.not_helpful_votes as total_votes
FROM reviews r
JOIN businesses b ON b.id = r.business_id
WHERE r.status = 'approved'
ORDER BY total_votes DESC
LIMIT 20;

-- Ver ratio de votos positivos por empresa premium
SELECT
  b.name,
  b.plan,
  COUNT(*) as total_reviews,
  AVG(r.helpful_votes) as avg_helpful,
  AVG(r.not_helpful_votes) as avg_not_helpful,
  AVG(r.helpful_votes::float / NULLIF(r.helpful_votes + r.not_helpful_votes, 0)) * 100 as positive_ratio
FROM businesses b
JOIN reviews r ON r.business_id = b.id
WHERE r.status = 'approved'
  AND b.plan IN ('starter', 'growth', 'pro', 'enterprise')
GROUP BY b.id, b.name, b.plan
ORDER BY positive_ratio DESC;
```

## ⚠️ Consideraciones Importantes

### 1. Service Role Key

Este script usa la **SERVICE ROLE KEY** que tiene permisos completos. **NUNCA** expongas esta key en:
- Código del frontend
- Repositorios públicos
- Variables de entorno del cliente

Solo debe usarse en scripts del servidor/backend.

### 2. Usuarios Existentes

El script usa usuarios existentes en la tabla `profiles`. Si tienes muy pocos usuarios, los votos no serán tan realistas porque se repetirán los mismos usuarios.

### 3. Límites de Supabase

El script está optimizado para no saturar Supabase, pero si tienes **decenas de miles de reseñas**, considera:

- Aumentar `delayBetweenBatches` (ej: 3000ms)
- Reducir `batchSize` (ej: 25)
- Ejecutar el script en horarios de poco tráfico

### 4. Empresas Premium

El script detecta automáticamente empresas premium basándose en el campo `plan` de la tabla `businesses`. Asegúrate de que este campo esté correctamente configurado.

## 🐛 Solución de Problemas

### Error: "Falta configuración"

```bash
❌ Falta configuración: VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos
```

**Solución**: Asegúrate de pasar las variables de entorno correctamente.

### Error: "No hay usuarios en la base de datos"

```bash
❌ No hay usuarios en la base de datos. Crea algunos usuarios primero.
```

**Solución**: Registra algunos usuarios en la aplicación o crea perfiles manualmente.

### Error: "relation 'review_votes' does not exist"

```bash
❌ Error: relation "review_votes" does not exist
```

**Solución**: Ejecuta primero la migración del sistema de votos:
```bash
# En Supabase Dashboard → SQL Editor
-- Ejecuta el contenido de: supabase/migrations/create_review_votes_system.sql
```

### Votos duplicados

```bash
⚠️  Algunos votos ya existían (duplicados), continuando...
```

Esto es normal. El script ignora votos duplicados si ya existen.

## 📝 Notas

- El script es **idempotente**: puedes ejecutarlo varias veces sin problemas
- Los votos se distribuyen aleatoriamente usando los usuarios existentes
- Las empresas premium siempre tendrán una mejor ratio de votos positivos
- Los contadores se actualizan automáticamente gracias a los triggers de la base de datos

## 🤝 Ayuda

Si tienes problemas, verifica:

1. ✅ Tienes la migración de votos instalada
2. ✅ Tienes reseñas con status='approved'
3. ✅ Tienes usuarios en la tabla profiles
4. ✅ La SERVICE ROLE KEY es correcta
5. ✅ El SUPABASE_URL es correcto

## 📚 Referencias

- [Documentación del sistema de votos](../supabase/migrations/README_VOTES.md)
- [Supabase Authentication](https://supabase.com/docs/guides/auth)
- [Supabase Service Role Key](https://supabase.com/docs/guides/api#the-service_role-key)
