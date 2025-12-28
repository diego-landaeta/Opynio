# Migración de Categorías

Este directorio contiene los scripts necesarios para normalizar las categorías de empresas en la base de datos.

## 📋 Archivos

- **`list-categories.ts`** - Lista todas las categorías actuales en la BD
- **`category-mapping.ts`** - Define el mapeo de categorías antiguas → nuevas
- **`migrate-categories.ts`** - Ejecuta la migración en la base de datos
- **`CATEGORIAS-PROPUESTA.md`** - Documento con la propuesta de normalización

## 🚀 Uso

### 1. Ver categorías actuales

```bash
npm run list-categories
```

### 2. Probar la migración (sin modificar la BD)

```bash
npm run migrate-categories:dry-run
```

Este comando te mostrará:
- Qué empresas se van a modificar
- Cómo cambiarán las categorías
- Estadísticas de la migración
- **NO modifica la base de datos**

### 3. Ejecutar la migración real

⚠️ **IMPORTANTE:** Antes de ejecutar, asegúrate de:
1. Haber revisado el dry-run
2. Tener un backup de la base de datos
3. Estar seguro de los cambios

```bash
npm run migrate-categories
```

## 🔧 Variables de entorno necesarias

El script necesita acceso a Supabase. Asegúrate de tener configuradas:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
```

O al menos:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

## 📊 Formato de categorías

**Formato estándar:** `Categoría Principal: Subcategoría`

Ejemplos:
- ✅ `Restaurantes y Ocio: Restaurantes`
- ✅ `Salud y Bienestar: Clínicas Dentales`
- ✅ `Educación y Formación: Academias de Idiomas`

**NO usar:**
- ❌ `leisure_and_dining:restaurants` (snake_case)
- ❌ `Ocio y Restauración: Restaurantes` (nombre incorrecto)
- ❌ Categorías en inglés

## 🌍 Traducciones

Las categorías se almacenan en español en la base de datos. Las traducciones a otros idiomas se manejan en el frontend mediante el sistema de internacionalización (i18n).

**Idiomas soportados:**
- Español (es) - Base
- Inglés (en)
- Portugués (pt/br)
- Francés (fr)
- Italiano (it)
- Alemán (de)
- Catalán (ca)
- Chino (cn)

## 📝 Modificar el mapeo

Si necesitas ajustar las categorías, edita el archivo `category-mapping.ts`:

```typescript
export const CATEGORY_MAPPING: Record<string, string> = {
  'categoría antigua': 'Categoría Nueva: Subcategoría',
  // ...más mapeos
};
```

## ⚠️ Notas importantes

1. **Backup:** Siempre haz un backup antes de ejecutar la migración
2. **Dry-run:** Siempre ejecuta el dry-run primero
3. **Service Role Key:** Para la migración necesitas la SERVICE_ROLE_KEY, no solo la ANON_KEY
4. **Lotes:** El script procesa las empresas en lotes de 50 para no saturar Supabase
5. **Rate limiting:** Hay delays entre lotes para respetar los límites de Supabase

## 🔍 Ejemplo de output

```
🚀 Iniciando migración de categorías...

📋 Obteniendo todas las empresas...
✅ Encontradas 891 empresas con categoría

📦 Procesando 891 empresas en 18 lotes...

📦 Lote 1/18 (50 empresas):
  ✓ Restaurante El Buen Sabor           | Ocio y Restauración: Restaurantes → Restaurantes y Ocio: Restaurantes
  ✓ Clínica Dental Sonrisa              | health_and_wellness:dental_clinics → Salud y Bienestar: Clínicas Dentales
  ...

═══════════════════════════════════════════════════════════════════════════
📊 REPORTE DE MIGRACIÓN
═══════════════════════════════════════════════════════════════════════════

📈 Estadísticas:
   - Total de empresas: 891
   - Empresas modificadas: 520 (58.4%)
   - Empresas sin cambios: 371 (41.6%)

🔄 Transformaciones realizadas:
   309 empresas | emerging_and_other: virtual_augmented_reality → Sectores Emergentes y Otros: Realidad Virtual y Aumentada
    48 empresas | health_and_wellness:dental_clinics → Salud y Bienestar: Clínicas Dentales
    ...

✅ Migración completada exitosamente
```

## 📞 Soporte

Si encuentras algún problema o categoría que no esté mapeada correctamente, revisa el archivo `category-mapping.ts` y ajústalo según sea necesario.
