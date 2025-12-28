# 🤖 Sistema de Scraping - Documentación Completa

Este documento contiene toda la información sobre el sistema de scraping de Google Maps de Opynio, incluyendo SQL, configuración y funcionamiento.

---

## 📋 Tabla de Contenidos

1. [Descripción General](#descripción-general)
2. [Base de Datos (SQL)](#base-de-datos-sql)
3. [Arquitectura del Sistema](#arquitectura-del-sistema)
4. [Configuración de APIs](#configuración-de-apis)
5. [Edge Functions](#edge-functions)
6. [Flujo de Scraping](#flujo-de-scraping)
7. [Límites y Optimizaciones](#límites-y-optimizaciones)
8. [Frontend - UI de Scraping](#frontend-ui-de-scraping)
9. [Troubleshooting](#troubleshooting)

---

## 🎯 Descripción General

El sistema de scraping permite a los administradores de Opynio importar empresas y reseñas desde Google Maps de forma automatizada usando:

- **SerpAPI**: Para búsquedas en Google Maps
- **Gemini AI (opcional)**: Para categorización automática
- **Supabase Edge Functions**: Para procesamiento backend

### Características Principales

✅ **Scraping en tiempo real** con progreso visible
✅ **Límite inteligente**: Máximo 5 empresas nuevas por ejecución
✅ **Control de reseñas**: 100-250 reseñas por empresa (aleatorio)
✅ **Filtrado de duplicados** antes de procesar
✅ **Guardado incremental** página por página
✅ **Tracking completo** con `scraping_sessions`

---

## 💾 Base de Datos (SQL)

### Tabla: `scraping_sessions`
Rastrea el progreso de cada sesión de scraping en tiempo real.

```sql
-- Tabla principal para tracking de sesiones de scraping
CREATE TABLE IF NOT EXISTS scraping_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),

    -- Contadores de progreso
    total_businesses_found INTEGER DEFAULT 0,
    total_businesses_created INTEGER DEFAULT 0,
    total_businesses_skipped INTEGER DEFAULT 0,
    total_reviews_imported INTEGER DEFAULT 0,
    current_business_index INTEGER DEFAULT 0,
    current_business_name TEXT,

    -- Progreso de reseñas (EN TIEMPO REAL)
    current_review_page INTEGER DEFAULT 0,
    current_reviews_scraped INTEGER DEFAULT 0,

    -- Datos de la sesión
    search_urls TEXT[] NOT NULL,
    country TEXT NOT NULL,
    max_businesses INTEGER NOT NULL,

    -- Resultados y errores
    errors TEXT[] DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_scraping_sessions_user_id ON scraping_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_scraping_sessions_status ON scraping_sessions(status);

-- Comentarios
COMMENT ON COLUMN scraping_sessions.current_review_page IS 'Página actual de reseñas siendo scrapeada';
COMMENT ON COLUMN scraping_sessions.current_reviews_scraped IS 'Total de reseñas acumuladas para la empresa actual';
```

### RLS (Row Level Security)

```sql
-- Habilitar RLS
ALTER TABLE scraping_sessions ENABLE ROW LEVEL SECURITY;

-- Los usuarios solo pueden ver sus propias sesiones
CREATE POLICY "Users can view own scraping sessions"
    ON scraping_sessions FOR SELECT
    USING (auth.uid() = user_id);

-- Los usuarios pueden crear sus propias sesiones
CREATE POLICY "Users can create own scraping sessions"
    ON scraping_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Los usuarios pueden actualizar sus propias sesiones
CREATE POLICY "Users can update own scraping sessions"
    ON scraping_sessions FOR UPDATE
    USING (auth.uid() = user_id);
```

### Función: `update_scraping_sessions_updated_at()`

```sql
CREATE OR REPLACE FUNCTION update_scraping_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_scraping_sessions_updated_at
    BEFORE UPDATE ON scraping_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_scraping_sessions_updated_at();
```

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────┐
│   Admin UI      │
│ (React/TypeScript)
└────────┬────────┘
         │ 1. Usuario ingresa URL
         ↓
┌─────────────────────────────┐
│ Edge Function:              │
│ instant-full-scrape         │
│ (Deno/TypeScript)           │
└──┬──────────────────────┬───┘
   │                      │
   │ 2. Buscar empresas   │ 3. Guardar progreso
   ↓                      ↓
┌──────────┐         ┌──────────────┐
│ SerpAPI  │         │  Supabase    │
│(Google   │         │  Database    │
│ Maps)    │         │              │
└──────────┘         └──────────────┘
   │                      ↑
   │ 4. Extraer reseñas   │
   ↓                      │
┌──────────┐              │
│ Páginas  │              │
│ 1, 2, 3  │──────────────┘
└──────────┘    5. Guardar cada página
```

---

## 🔑 Configuración de APIs

### SerpAPI

1. **Obtener API Key**: https://serpapi.com/
2. **Agregar Secret en Supabase**:
   ```bash
   # En Supabase Dashboard > Project Settings > Edge Functions > Secrets
   SERPAPI_KEY=tu_clave_aqui
   ```

### Gemini AI (Opcional)

1. **Obtener API Key**: https://ai.google.dev/
2. **Agregar Secret en Supabase**:
   ```bash
   GEMINI_API_KEY=tu_clave_aqui
   ```

**Nota**: Actualmente el sistema NO usa Gemini para ahorrar costos. Las empresas se guardan con categoría por defecto y se pueden recategorizar manualmente después.

---

## ⚙️ Edge Functions

### Función: `instant-full-scrape`

**Ubicación**: `supabase/functions/instant-full-scrape/index.ts`

**Responsabilidades**:
1. ✅ Parsear URLs de Google Maps
2. ✅ Buscar hasta 20 empresas en SerpAPI
3. ✅ Filtrar duplicados ANTES de procesar
4. ✅ Seleccionar 5 empresas nuevas
5. ✅ Para cada empresa:
   - Obtener detalles del negocio
   - Guardar empresa en DB
   - Extraer 100-250 reseñas (aleatorio)
   - Guardar reseñas página por página
6. ✅ Actualizar progreso en tiempo real

**Parámetros de entrada**:
```typescript
{
  searchUrls: string[],  // URLs de búsqueda de Google Maps
  country: string,        // Código de país (ej: "ES", "BR")
  maxBusinesses: 5        // Siempre 5 (fijo)
}
```

**Respuesta**:
```typescript
{
  session_id: string,
  total_businesses_found: number,
  total_businesses_created: number,
  total_businesses_skipped: number,
  total_reviews_imported: number,
  businesses: Array<{
    name: string,
    id: string,
    reviews_count: number
  }>,
  errors: string[]
}
```

---

## 🔄 Flujo de Scraping Completo

### Fase 1: Búsqueda y Filtrado (Optimizado ✅)

```typescript
// 1. Parsear URL y extraer query
searchQuery = "Supermercados en brasil"
coordinates = "@6.7360364,-102.9381488,4z"

// 2. Buscar 20 empresas (no 5)
SerpAPI.search({
  q: searchQuery,
  num: 20, // ← MÁS EMPRESAS para filtrar duplicados
  ll: coordinates
})

// 3. Verificar duplicados EN BATCH (UNA SOLA VEZ)
existingUrls = await DB.getExistingUrls(allUrls)

// 4. Filtrar y seleccionar 5 NUEVAS
nonDuplicates = businesses.filter(b => !existingUrls.has(b.url))
toProcess = nonDuplicates.slice(0, 5)

✅ RESULTADO: Exactamente 5 empresas nuevas (si hay suficientes)
```

### Fase 2: Procesamiento Individual

```typescript
for (const business of toProcess) {
  // 1. Obtener detalles
  details = await SerpAPI.getBusinessDetails(business.data_id)

  // 2. GUARDAR EMPRESA INMEDIATAMENTE
  newBusiness = await DB.insertBusiness({
    name, description, category,
    google_maps_url, country,
    phone, website, latitude, longitude,
    horarios, source_search_url
  })

  // 3. EXTRAER Y GUARDAR RESEÑAS (página por página)
  reviewLimit = random(100, 250) // Aleatorio

  let page = 1
  let totalSaved = 0

  while (totalSaved < reviewLimit) {
    reviews = await SerpAPI.getReviewsPage(page)

    // GUARDAR INMEDIATAMENTE
    await DB.insertReviews(reviews)
    totalSaved += reviews.length

    // ACTUALIZAR PROGRESO EN DB
    await DB.updateSession({
      current_review_page: page,
      current_reviews_scraped: totalSaved
    })

    page++
  }
}
```

---

## 🎯 Límites y Optimizaciones

### Límites por Ejecución

| Métrica | Límite | Motivo |
|---------|--------|--------|
| **Empresas buscadas** | 20 | Permitir filtrado de duplicados |
| **Empresas procesadas** | 5 exactas | Evitar timeouts y controlar costos |
| **Reseñas por empresa** | 100-250 (aleatorio) | Evitar colapsos (antes 1000+) |
| **Tiempo estimado** | 3-8 minutos | Depende de cantidad de reseñas |

### Optimizaciones Implementadas

✅ **Búsqueda ampliada**: 20 empresas en lugar de 5
✅ **Filtrado previo**: Duplicados se filtran ANTES de procesar
✅ **Sin offset aleatorio**: Siempre las primeras 20 empresas
✅ **Límite de reseñas**: Evita scraping excesivo
✅ **Guardado incremental**: Página por página
✅ **Progreso en tiempo real**: UI actualizada cada 2 segundos

---

## 🖥️ Frontend - UI de Scraping

### Componente: `AdminScrapingPage.tsx`

**Ubicación**: `components/pages/admin/AdminScrapingPage.tsx`

**Características**:

1. **Formulario de scraping**:
   - Textarea para múltiples URLs
   - Selector de país
   - Cantidad fija: 5 empresas

2. **Progreso en tiempo real**:
   - Empresa actual siendo procesada
   - Número de página de reseñas
   - Reseñas acumuladas
   - Total de empresas creadas

3. **Modal de progreso**:
   - Spinner animado
   - Estadísticas en tiempo real
   - Últimas empresas procesadas
   - Advertencias importantes

### Polling de Progreso

```typescript
// Actualización cada 2 segundos
useEffect(() => {
  const interval = setInterval(async () => {
    const session = await getScrapingSession(sessionId)
    setCurrentSession(session)

    // Detener si completó o falló
    if (session.status !== 'running') {
      clearInterval(interval)
    }
  }, 2000)

  return () => clearInterval(interval)
}, [sessionId])
```

---

## 🔍 Troubleshooting

### Problema: "Descubre 5, procesa 2"

**Solución**: ✅ **RESUELTO**
- Ahora busca 20 empresas
- Filtra duplicados ANTES
- Selecciona exactamente 5 nuevas

### Problema: "URL no reconocida"

**Formato esperado**:
```
https://www.google.com/maps/search/Supermercados+en+brasil/@lat,lng,zoomz/data=!3m1!4b1?entry=ttu
```

**Solución**: ✅ **RESUELTO**
- Parser mejorado con logs detallados
- Soporta URLs con parámetros adicionales

### Problema: "Sistema colapsa con 1000+ reseñas"

**Solución**: ✅ **RESUELTO**
- Límite aleatorio 100-250 reseñas por empresa
- Guardado página por página
- Empresas con <100 reseñas se aceptan completas

### Problema: "Error 401 en SerpAPI"

**Causa**: API Key no configurada o inválida

**Solución**:
```bash
# Verificar Secret en Supabase
SERPAPI_KEY=tu_clave_valida_aqui
```

---

## 📊 Estadísticas Típicas

### Por Ejecución (5 empresas)

```
Empresas encontradas:     18-20
Empresas duplicadas:      0-15 (variable)
Empresas procesadas:      5 exactas
Reseñas por empresa:      100-250 (aleatorio)
Total reseñas:            500-1,250
Tiempo total:             3-8 minutos
```

### Uso de APIs

```
SerpAPI:
  - Búsqueda: 1 llamada (20 empresas)
  - Detalles: 5 llamadas (1 por empresa)
  - Reseñas:  10-25 llamadas (2-5 páginas × 5 empresas)
  TOTAL:      16-31 llamadas por ejecución

Gemini AI:
  - Categorización: 0 llamadas (desactivado para ahorrar)
```

---

## ✅ Checklist de Configuración

### Base de Datos
- [ ] Verificar que la tabla `scraping_sessions` existe (ver sección SQL arriba)
- [ ] Verificar que los campos de progreso están en la tabla `reviews`
- [ ] Verificar índices en `scraping_sessions`
- [ ] Verificar políticas RLS

### Edge Functions
- [ ] Desplegar función `instant-full-scrape`
- [ ] Configurar Secret `SERPAPI_KEY`
- [ ] Configurar Secret `GEMINI_API_KEY` (opcional)
- [ ] Verificar permisos de función

### Frontend
- [ ] Verificar `AdminScrapingPage.tsx`
- [ ] Probar formulario de scraping
- [ ] Verificar modal de progreso
- [ ] Probar polling en tiempo real

---

## 📝 Ejemplos de URLs Válidas

```
✅ https://www.google.com/maps/search/Supermercados+en+brasil/@6.7360364,-102.9381488,4z/data=!3m1!4b1?entry=ttu&g_ep=...

✅ https://www.google.com/maps/search/restaurantes+Madrid/@40.4168,-3.7038,13z

✅ https://www.google.com/maps/search/veterinarios+en+Lisboa/@38.7223,-9.1393,12z
```

---

**Última actualización:** Noviembre 2025
**Versión:** 2.0.0 (Sistema optimizado)
