# 🔧 SOLUCIÓN RÁPIDA - Error en /admin/reclamaciones

## ❌ Error Actual
```
Could not embed because more than one relationship was found for 'claims' and 'profiles'
```

## ✅ Solución en 3 Pasos

### Paso 1: Abrir Supabase Dashboard
1. Ve a https://supabase.com/dashboard/project/hvtrrhxeqrsnjxhngdsj
2. Inicia sesión si es necesario
3. Haz clic en **SQL Editor** (icono </> en el menú lateral)

### Paso 2: Ejecutar Script de Corrección
1. Haz clic en "New query"
2. Copia y pega el siguiente código:

```sql
-- =====================================================
-- FIX CLAIMS FOREIGN KEYS
-- =====================================================

-- Drop existing foreign key constraints
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    FOR constraint_record IN
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = 'claims'
          AND constraint_type = 'FOREIGN KEY'
          AND constraint_name LIKE '%user_id%'
    LOOP
        EXECUTE 'ALTER TABLE claims DROP CONSTRAINT IF EXISTS ' || constraint_record.constraint_name;
    END LOOP;

    FOR constraint_record IN
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = 'claims'
          AND constraint_type = 'FOREIGN KEY'
          AND constraint_name LIKE '%resolved_by%'
    LOOP
        EXECUTE 'ALTER TABLE claims DROP CONSTRAINT IF EXISTS ' || constraint_record.constraint_name;
    END LOOP;
END $$;

-- Add foreign keys with explicit names
-- Note: Point to profiles.id instead of auth.users.id
ALTER TABLE claims
  ADD CONSTRAINT claims_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES profiles(id)
    ON DELETE CASCADE;

ALTER TABLE claims
  ADD CONSTRAINT claims_resolved_by_fkey
    FOREIGN KEY (resolved_by)
    REFERENCES profiles(id)
    ON DELETE SET NULL;

-- Also add FK for business_id
ALTER TABLE claims
  DROP CONSTRAINT IF EXISTS claims_business_id_fkey;

ALTER TABLE claims
  ADD CONSTRAINT claims_business_id_fkey
    FOREIGN KEY (business_id)
    REFERENCES businesses(id)
    ON DELETE CASCADE;

-- Verify (should return 2 rows)
SELECT
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'claims';
```

3. Haz clic en **RUN** (o presiona Ctrl+Enter)
4. Verifica que la consulta final muestre 2 filas:
   - `claims_user_id_fkey`
   - `claims_resolved_by_fkey`

### Paso 3: Refrescar el Navegador
1. Ve a http://localhost:3001/admin/reclamaciones
2. Presiona Ctrl+Shift+R (hard refresh)
3. La página debería cargar correctamente

## 🎯 ¿Qué hace este script?

El script:
1. ✅ Elimina las foreign keys con nombres auto-generados
2. ✅ Crea nuevas foreign keys con nombres predecibles
3. ✅ Permite que la consulta especifique qué relación usar

## 📝 Cambios en el Código (Ya aplicados)

El código ya fue actualizado en:
- ✅ `services/supabaseService.ts` - Consulta especifica `claims_user_id_fkey`
- ✅ Servidor corriendo en http://localhost:3001

## 🆘 Si el error persiste

Si después de ejecutar el script el error continúa:

1. **Verifica la consola del navegador** (F12) para errores adicionales
2. **Verifica que las foreign keys existen**:
   ```sql
   SELECT constraint_name
   FROM information_schema.table_constraints
   WHERE table_name = 'claims'
     AND constraint_type = 'FOREIGN KEY';
   ```
   Deberías ver exactamente:
   - `claims_user_id_fkey`
   - `claims_resolved_by_fkey`

3. **Si los nombres son diferentes**, copia el nombre exacto de `user_id` y actualiza en:
   ```typescript
   // services/supabaseService.ts línea 1146
   profiles!TU_NOMBRE_AQUI(name, email, username)
   ```

## 📚 Archivos de Referencia

- **Script completo**: `supabase/migrations/fix_claims_foreign_keys.sql`
- **Documentación detallada**: `ADMIN_RECLAMACIONES_FIX.md`
- **Código modificado**: `services/supabaseService.ts:1140-1157`

---

**Tiempo estimado**: 2 minutos ⏱️
