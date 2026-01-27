# Script para Indexar Reseñas a Empresas

Este script permite agregar reseñas masivamente a una empresa en la base de datos de Opynio.

---

## 📋 **REQUISITOS**

1. **Node.js** instalado
2. **Archivo .env** configurado con:
   ```env
   VITE_SUPABASE_URL=tu_url_de_supabase
   VITE_SUPABASE_ANON_KEY=tu_anon_key
   # O mejor aún (para operaciones de admin):
   SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
   ```

---

## 🚀 **USO BÁSICO**

### **Método 1: Editar el script directamente**

1. **Abrir** `scripts/index-reviews.cjs`

2. **Cambiar** el `BUSINESS_ID`:
   ```javascript
   const BUSINESS_ID = 'TU_BUSINESS_ID_AQUI'; // ← Cambiar esto
   ```

3. **Editar** el array `REVIEWS`:
   ```javascript
   const REVIEWS = [
     {
       rating: 5,
       title: 'Excelente servicio',
       review_text: 'Muy satisfecho con la atención...',
       status: 'approved',
       source: 'google',
       original_author_name: 'Juan Pérez',
       is_verified_customer: false,
       created_at: '2024-01-15T10:30:00Z'
     },
     // Agregar más reseñas...
   ];
   ```

4. **Ejecutar**:
   ```bash
   node scripts/index-reviews.cjs
   ```

---

### **Método 2: Usar archivo JSON (RECOMENDADO)**

1. **Crear** un archivo JSON con tus reseñas:
   ```bash
   # Copiar el ejemplo
   cp scripts/reviews-example.json scripts/mis-reviews.json

   # Editar con tus reseñas
   code scripts/mis-reviews.json
   ```

2. **Obtener** el ID de tu empresa:
   ```bash
   # Opción A: Desde la URL en Opynio
   # Ej: https://web.opynio.com/empresa/abc-123-def
   # El ID es: abc-123-def

   # Opción B: Consultar directamente en Supabase
   # Ir a Supabase → Table Editor → businesses
   # Buscar tu empresa y copiar el ID
   ```

3. **Ejecutar**:
   ```bash
   node scripts/index-reviews.cjs <business_id> scripts/mis-reviews.json
   ```

   **Ejemplo:**
   ```bash
   node scripts/index-reviews.cjs 123e4567-e89b-12d3-a456-426614174000 scripts/mis-reviews.json
   ```

---

## 📝 **FORMATO DEL JSON**

### **Estructura del archivo:**

```json
[
  {
    "rating": 5,
    "title": "Título de la reseña",
    "review_text": "Texto completo de la reseña...",
    "status": "approved",
    "source": "google",
    "original_author_name": "Nombre del autor",
    "is_verified_customer": false,
    "created_at": "2024-01-15T10:30:00Z"
  },
  {
    "rating": 4,
    "title": "Otra reseña",
    "review_text": "Texto de otra reseña...",
    ...
  }
]
```

### **Campos disponibles:**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `rating` | number | ✅ Sí | Rating de 1 a 5 estrellas |
| `review_text` | string | ✅ Sí | Texto de la reseña |
| `title` | string | ❌ No | Título de la reseña |
| `status` | string | ❌ No | `approved`, `pending`, `rejected` (default: `approved`) |
| `source` | string | ❌ No | `google`, `manual`, `trustindex`, etc. (default: `manual`) |
| `original_author_name` | string | ❌ No | Nombre del autor original |
| `is_verified_customer` | boolean | ❌ No | Si es cliente verificado (default: `false`) |
| `is_verified_purchase` | boolean | ❌ No | Si es compra verificada (default: `false`) |
| `created_at` | string | ❌ No | Fecha ISO 8601 (default: fecha actual) |
| `images` | array | ❌ No | Array de URLs de imágenes |
| `audio_url` | string | ❌ No | URL de audio de la reseña |
| `category` | string | ❌ No | Categoría de la reseña |
| `tags` | array | ❌ No | Tags de la reseña |
| `helpful_votes` | number | ❌ No | Votos útiles (default: 0) |
| `not_helpful_votes` | number | ❌ No | Votos no útiles (default: 0) |
| `original_response_text` | string | ❌ No | Respuesta del propietario |
| `original_response_date` | string | ❌ No | Fecha de respuesta ISO 8601 |

---

## 💡 **EJEMPLOS**

### **Ejemplo 1: Indexar 10 reseñas de ejemplo**

```bash
# Usar el archivo de ejemplo incluido
node scripts/index-reviews.cjs abc-123-def scripts/reviews-example.json
```

### **Ejemplo 2: Crear reseñas personalizadas**

**Archivo:** `scripts/mis-reviews.json`
```json
[
  {
    "rating": 5,
    "title": "Mejor café de Madrid",
    "review_text": "El café es excelente y el ambiente muy acogedor. El personal es amable y profesional.",
    "status": "approved",
    "source": "google",
    "original_author_name": "María P.",
    "is_verified_customer": true,
    "created_at": "2024-03-15T10:00:00Z"
  },
  {
    "rating": 4,
    "title": "Muy buena experiencia",
    "review_text": "Todo perfecto excepto el tiempo de espera. Pero vale la pena.",
    "status": "approved",
    "source": "google",
    "original_author_name": "Carlos R.",
    "is_verified_customer": false,
    "created_at": "2024-03-16T14:30:00Z"
  }
]
```

**Ejecutar:**
```bash
node scripts/index-reviews.cjs mi-business-id scripts/mis-reviews.json
```

### **Ejemplo 3: Migrar reseñas de Google**

Si tienes reseñas de Google Maps que quieres importar:

```json
[
  {
    "rating": 5,
    "review_text": "Excellent service and quality products!",
    "status": "approved",
    "source": "google",
    "original_author_name": "John Smith",
    "is_verified_customer": false,
    "created_at": "2024-02-10T08:30:00Z"
  }
]
```

---

## 🔧 **OPCIONES AVANZADAS**

### **Cambiar el usuario autor**

Por defecto, las reseñas se asignan al usuario `sistema`. Para cambiar esto:

1. **Editar** `scripts/index-reviews.cjs`:
   ```javascript
   const DEFAULT_USER_ID = 'sistema'; // ← Cambiar por UUID de usuario real
   ```

2. O crear un usuario específico en Supabase primero.

### **Estado de las reseñas**

- `approved`: Reseña aprobada y visible
- `pending`: Reseña pendiente de moderación
- `rejected`: Reseña rechazada

### **Source (fuente)**

- `google`: Migradas de Google
- `manual`: Creadas manualmente
- `trustindex`: De TrustIndex
- `opynio`: Nativas de Opynio

---

## 📊 **SALIDA DEL SCRIPT**

### **Ejemplo de ejecución exitosa:**

```
═══════════════════════════════════════════════════════
🚀 SCRIPT DE INDEXACIÓN DE RESEÑAS
═══════════════════════════════════════════════════════

🔍 Verificando empresa...
✅ Empresa encontrada: Mi Empresa S.L. (es)
🔍 Verificando usuario del sistema...
✅ Usuario del sistema encontrado: sistema

📝 Reseñas a indexar: 10
═══════════════════════════════════════════════════════

[1/10] Indexando reseña de "Juan Pérez"...
✅ [1/10] Reseña indexada con ID: abc-def-123
   Rating: 5★ | Título: "Excelente servicio"

[2/10] Indexando reseña de "María García"...
✅ [2/10] Reseña indexada con ID: ghi-jkl-456
   Rating: 4★ | Título: "Buena experiencia"

...

═══════════════════════════════════════════════════════
📊 RESUMEN
═══════════════════════════════════════════════════════
Total de reseñas:     10
✅ Indexadas:         10
❌ Errores:           0
═══════════════════════════════════════════════════════

✅ Proceso completado exitosamente!

🔗 Ver empresa: https://web.opynio.com/empresa/mi-business-id
```

---

## ❌ **TROUBLESHOOTING**

### **Error: "Empresa no encontrada"**

**Causa:** El `business_id` no existe en la base de datos

**Solución:**
1. Verificar que el ID es correcto
2. Consultar en Supabase: `businesses` table
3. Usar el ID exacto (UUID)

### **Error: "Variables de entorno no configuradas"**

**Causa:** Falta archivo `.env` o las variables no están definidas

**Solución:**
1. Crear archivo `.env` en la raíz del proyecto
2. Agregar:
   ```env
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu_anon_key_aqui
   ```

### **Error: "Usuario del sistema no encontrado"**

**Causa:** No existe el usuario `sistema` en `profiles`

**Solución:** El script intenta crearlo automáticamente. Si falla:
1. Crear manualmente en Supabase
2. O cambiar `DEFAULT_USER_ID` a un usuario existente

### **Error al insertar reseña**

**Causa:** Campos requeridos faltantes o tipos incorrectos

**Solución:**
1. Verificar que `rating` y `review_text` existen
2. Verificar que `rating` es un número entre 1-5
3. Verificar formato de fechas (ISO 8601)

---

## 📚 **REFERENCIAS**

- **Estructura de Review:** Ver `types.ts` línea 110
- **Supabase Docs:** https://supabase.com/docs
- **Formato ISO 8601:** `2024-01-15T10:30:00Z`

---

## 🎯 **CASOS DE USO**

### **1. Migrar reseñas desde Google**
```bash
# Exportar reseñas de Google → JSON
# Ejecutar script con ese JSON
node scripts/index-reviews.cjs <business_id> google-reviews.json
```

### **2. Agregar reseñas de prueba**
```bash
# Usar el archivo de ejemplo
node scripts/index-reviews.cjs <business_id> scripts/reviews-example.json
```

### **3. Importar reseñas de otra plataforma**
```bash
# Convertir formato → JSON
# Ejecutar script
node scripts/index-reviews.cjs <business_id> reviews-importadas.json
```

---

**Creado por:** Claude Sonnet 4.5
**Fecha:** 2026-01-27
