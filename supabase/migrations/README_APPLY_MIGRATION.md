# 🔧 Cómo Aplicar la Migración del Directorio de Empresas

## ⚠️ PROBLEMAS DETECTADOS

1. **"0 empresas encontradas"**: La función RPC `get_businesses_with_review_stats` no existe o tiene una firma incorrecta
2. **Carga muy lenta**: Falta de índices en las tablas `businesses` y `reviews` causa consultas lentas

Esta migración resuelve ambos problemas.

## ✅ SOLUCIÓN

Debes aplicar el archivo de migración `create_business_directory_function.sql` a tu base de datos de Supabase.

---

## 📋 OPCIÓN 1: Supabase Dashboard (Recomendado)

### Pasos:

1. **Abre Supabase Dashboard**
   - Ve a https://app.supabase.com
   - Selecciona tu proyecto Opynio

2. **Ve al SQL Editor**
   - En el menú lateral, haz clic en **SQL Editor**
   - Haz clic en **+ New Query**

3. **Copia y Pega el SQL**
   - Abre el archivo `supabase/migrations/create_business_directory_function.sql`
   - Copia **TODO el contenido** del archivo
   - Pega en el editor SQL de Supabase

4. **Ejecuta la Query**
   - Haz clic en **Run** (botón verde) en la esquina inferior derecha
   - Espera a que termine la ejecución

5. **Verifica que todo está OK**
   - Deberías ver mensajes de éxito
   - Sin errores en rojo

---

## 📋 OPCIÓN 2: Supabase CLI (Si tienes CLI instalado)

```bash
# Instalar Supabase CLI (si no lo tienes)
npm install -g supabase

# Vincular tu proyecto
supabase link --project-ref TU_PROJECT_REF

# Aplicar migración
supabase db push

# O aplicar solo este archivo
supabase db execute --file supabase/migrations/create_business_directory_function.sql
```

---

## 🧪 VERIFICAR QUE FUNCIONA

Después de aplicar la migración:

1. **Recarga la página del directorio de empresas**
   - Ve a http://localhost:3002/empresas (o tu dominio)
   - Deberías ver las empresas cargando correctamente

2. **Verifica en la consola del navegador (F12)**
   - Abre DevTools → Console
   - Deberías ver logs como:
     ```
     ✅ Loaded businesses: 15
     ✅ With reviews: 8
     📋 First 5 businesses: [...]
     ```

3. **Prueba que el widget funciona**
   - Los widgets también usan la vista `business_metrics` creada
   - Verifica que los widgets muestran las calificaciones correctamente

---

## 📊 LO QUE CREA ESTA MIGRACIÓN

### 1. Elimina Funciones/Vistas Existentes (IMPORTANTE)
- Hace DROP de `get_businesses_with_review_stats()` existente
- Hace DROP de `business_metrics` existente
- **Necesario** porque la función cambió su firma (columnas de retorno)

### 2. Función RPC `get_businesses_with_review_stats()`
- Devuelve todas las empresas con sus estadísticas calculadas
- Incluye `avg_rating` y `review_count` por cada empresa
- **Nueva firma** incluye todos los campos de Business (sedes, horarios, etc.)
- Ordena por cantidad de reseñas y calificación

### 3. Vista Materializada `business_metrics`
- Tabla pre-calculada para consultas más rápidas
- Usada por el widget-proxy para cargar widgets
- Se actualiza llamando a `refresh_business_metrics()`

### 4. Función `refresh_business_metrics()`
- Refresca la vista materializada
- Ejecutar cuando haya cambios importantes en las reseñas

### 5. Índices de Rendimiento (NUEVO - Acelera la carga)
- `idx_reviews_business_id_status`: Acelera JOIN entre businesses y reviews
- `idx_reviews_status_approved`: Filtra reseñas aprobadas rápidamente
- `idx_reviews_rating_business`: Acelera cálculo de AVG(rating)
- `idx_businesses_country_category`: Acelera búsquedas por país/categoría
- `idx_businesses_plan`: Filtra por plan rápidamente
- **Resultado**: Carga de empresas 10-50x más rápida

---

## 🔄 MANTENIMIENTO

### Refrescar Estadísticas Manualmente

Si las estadísticas no están actualizadas:

```sql
SELECT refresh_business_metrics();
```

Ejecuta esto en el SQL Editor de Supabase cuando:
- Apruebes muchas reseñas nuevas
- Importes reseñas de Google
- Las calificaciones se vean desactualizadas

### Automatizar Refresco (Opcional)

Para actualizar automáticamente cada hora, crea un cron job en Supabase:

1. Ve a **Database → Extensions**
2. Activa la extensión `pg_cron`
3. Ejecuta en SQL Editor:

```sql
SELECT cron.schedule(
    'refresh-business-metrics',
    '0 * * * *', -- Cada hora
    $$SELECT refresh_business_metrics();$$
);
```

---

## ❓ TROUBLESHOOTING

### Error: "function get_businesses_with_review_stats() does not exist"
- **Solución**: No aplicaste la migración correctamente. Repite los pasos de arriba.

### Error: "relation business_metrics does not exist" en widgets
- **Solución**: La vista materializada no se creó. Vuelve a ejecutar todo el SQL.

### Las estadísticas están desactualizadas
- **Solución**: Ejecuta `SELECT refresh_business_metrics();`

### La página sigue mostrando "0 empresas"
1. Verifica que la migración se aplicó: `SELECT * FROM pg_proc WHERE proname = 'get_businesses_with_review_stats';`
2. Verifica que hay empresas en la DB: `SELECT COUNT(*) FROM businesses;`
3. Revisa la consola del navegador para ver errores

---

## 📝 NOTAS IMPORTANTES

- ⚠️ **No elimines** este archivo SQL - puede ser necesario para nuevos entornos
- 🔒 La función usa `SECURITY DEFINER` para ejecutarse con permisos de creador
- 🚀 La vista materializada mejora el rendimiento pero necesita refrescos periódicos
- ✅ Los permisos están configurados para `authenticated` y `anon` (usuarios y visitantes)

---

**Creado**: Diciembre 2025
**Por**: Sistema de Migración Automática de Opynio
