# Sistema de Votos para Reseñas - Instalación

## 📋 Descripción

Este sistema implementa un sistema completo de votos (útil/no útil) para las reseñas, incluyendo:

- ✅ Tabla `review_votes` para rastrear votos individuales
- ✅ Contadores automáticos `helpful_votes` y `not_helpful_votes` en la tabla `reviews`
- ✅ Triggers que actualizan los contadores automáticamente
- ✅ Row Level Security (RLS) configurado
- ✅ Prevención de votos duplicados (un voto por usuario por reseña)
- ✅ Posibilidad de cambiar el voto

## 🚀 Instalación

### Opción 1: Usando Supabase Dashboard (Recomendado)

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Navega a **SQL Editor** en el menú lateral
3. Haz clic en **New Query**
4. Copia y pega el contenido completo del archivo `create_review_votes_system.sql`
5. Haz clic en **Run** para ejecutar el script
6. Verifica que aparezca el mensaje de éxito

### Opción 2: Usando Supabase CLI

```bash
# Asegúrate de estar en el directorio raíz del proyecto
cd /ruta/a/opynio_-reseñas-auténticas-de-empresas

# Ejecuta la migración
supabase db push --db-url "postgresql://postgres:[TU-PASSWORD]@[TU-HOST]:5432/postgres"
```

### Opción 3: Aplicar manualmente la migración

```bash
# Conéctate a tu base de datos y ejecuta
psql -h [TU-HOST] -U postgres -d postgres -f supabase/migrations/create_review_votes_system.sql
```

## 🔍 Verificación

Después de ejecutar el script, verifica que todo esté correcto:

```sql
-- 1. Verificar que la tabla review_votes existe
SELECT table_name
FROM information_schema.tables
WHERE table_name = 'review_votes';

-- 2. Verificar que las columnas fueron agregadas a reviews
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'reviews'
  AND column_name IN ('helpful_votes', 'not_helpful_votes');

-- 3. Verificar que los triggers existen
SELECT trigger_name
FROM information_schema.triggers
WHERE trigger_name LIKE '%review_vote%';

-- 4. Verificar las políticas RLS
SELECT policyname
FROM pg_policies
WHERE tablename = 'review_votes';
```

## 📊 Estructura de la Tabla review_votes

```sql
CREATE TABLE review_votes (
  id UUID PRIMARY KEY,
  review_id UUID NOT NULL,        -- FK a reviews
  user_id UUID NOT NULL,           -- FK a auth.users
  is_helpful BOOLEAN NOT NULL,     -- true = útil, false = no útil
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  UNIQUE(review_id, user_id)      -- Un voto por usuario por reseña
);
```

## 🔧 Funcionalidad Implementada

### 1. Votar en una Reseña
```typescript
// El código ya está implementado en supabaseService.ts
const result = await voteOnReview(reviewId, userId, 'helpful');
// Retorna: { helpful_votes: number, not_helpful_votes: number }
```

### 2. Obtener el Voto del Usuario
```typescript
const vote = await getUserVoteOnReview(reviewId, userId);
// Retorna: { hasVoted: boolean, isHelpful: boolean | null }
```

### 3. Eliminar Voto
```typescript
const result = await removeVoteOnReview(reviewId, userId);
// Retorna: { helpful_votes: number, not_helpful_votes: number }
```

## 🔒 Seguridad (RLS Policies)

Las siguientes políticas están activas:

1. **Lectura**: Cualquiera puede ver los votos
2. **Inserción**: Solo usuarios autenticados pueden votar
3. **Actualización**: Los usuarios solo pueden actualizar sus propios votos
4. **Eliminación**: Los usuarios solo pueden eliminar sus propios votos

## ⚡ Triggers Automáticos

Los contadores se actualizan automáticamente cuando:
- Se inserta un nuevo voto → Incrementa el contador correspondiente
- Se actualiza un voto → Recalcula ambos contadores
- Se elimina un voto → Decrementa el contador correspondiente

## 🎯 Ventajas del Sistema

1. **Integridad de Datos**: Un usuario solo puede votar una vez por reseña
2. **Actualización Automática**: Los contadores se actualizan sin código adicional
3. **Cambio de Voto**: Los usuarios pueden cambiar su voto de útil a no útil y viceversa
4. **Performance**: Índices optimizados para consultas rápidas
5. **Seguridad**: RLS configurado para proteger los datos

## 🐛 Solución de Problemas

### Error: "relation 'review_votes' does not exist"
**Solución**: Ejecuta el script SQL nuevamente en el dashboard de Supabase.

### Error: "column 'is_helpful' does not exist"
**Solución**: Verifica que el script se ejecutó completamente sin errores.

### Los contadores no se actualizan
**Solución**: Verifica que los triggers estén activos:
```sql
SELECT * FROM pg_trigger WHERE tgname LIKE '%review_vote%';
```

### Error: "duplicate key value violates unique constraint"
**Solución**: Esto es esperado - significa que el usuario ya votó. Usa `upsert` en lugar de `insert`.

## 📝 Notas Adicionales

- Los votos se eliminan automáticamente si se elimina la reseña (CASCADE)
- Los votos se eliminan automáticamente si se elimina el usuario (CASCADE)
- Los contadores iniciales de todas las reseñas existentes se inicializan en 0
- El sistema está optimizado para alta concurrencia

## 🔄 Migración de Datos Existentes

Si ya tienes votos en otro formato, puedes migrarlos con:

```sql
-- Ejemplo: Si tienes una tabla antigua con formato diferente
INSERT INTO review_votes (review_id, user_id, is_helpful, created_at)
SELECT
  review_id,
  user_id,
  CASE WHEN vote_type = 'helpful' THEN true ELSE false END,
  created_at
FROM old_votes_table
ON CONFLICT (review_id, user_id) DO NOTHING;
```

## ✅ Checklist Post-Instalación

- [ ] Script SQL ejecutado sin errores
- [ ] Tabla `review_votes` creada
- [ ] Columnas agregadas a `reviews`
- [ ] Triggers funcionando
- [ ] RLS policies activas
- [ ] Probado desde la aplicación
- [ ] Notificaciones toast funcionando
- [ ] Contadores actualizándose en tiempo real
