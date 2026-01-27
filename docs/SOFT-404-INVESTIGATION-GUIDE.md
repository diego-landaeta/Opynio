# Guía de Investigación de Soft 404

## 🔍 ¿Qué es un Soft 404?

Un **Soft 404** ocurre cuando una página devuelve código HTTP 200 (OK) pero Google considera que el contenido es equivalente a una página 404. Esto suele pasar cuando:

1. La página tiene muy poco contenido
2. La página muestra un mensaje de "no hay resultados"
3. La página carga contenido dinámicamente que Google no ve
4. La página redirige con JavaScript (no con HTTP redirect)

## 📊 Situación Actual

Según Google Search Console:
- **1,019 páginas** identificadas como Soft 404
- Esto representa un problema significativo de crawl budget y SEO

## 🎯 Cómo Investigar en Google Search Console

### Paso 1: Obtener lista de URLs con Soft 404

1. Ir a Google Search Console
2. Navegar a **Coverage** o **Páginas**
3. Filtrar por **"Soft 404"**
4. Exportar la lista completa de URLs

### Paso 2: Analizar patrones en las URLs

Buscar patrones comunes en las URLs afectadas:

```
¿Son todas de un tipo específico?
- /es/empresa/[slug]?
- /mx/directorio?
- /br/explorar?

¿Tienen parámetros específicos?
- ?category=algo
- ?country=algo
- ?page=N

¿Son de idiomas específicos?
- Solo /br/ (Brasil)?
- Solo idiomas menos usados?
```

## 🔬 Causas Probables y Soluciones

### 1. Páginas de Categoría Vacías

**Síntoma:** URLs como `/es/directorio?category=categoria-sin-empresas`

**Causa:** Categoría sin empresas registradas

**Solución:**
```typescript
// En BusinessesPage.tsx o ExplorePage.tsx
// Cuando no hay resultados, devolver 404 real en lugar de página vacía

if (businesses.length === 0 && !loading) {
    return <NotFoundPage message="No hay empresas en esta categoría" />;
}
```

**Implementación recomendada:**
- Añadir lógica para detectar cuando una categoría no tiene empresas
- Devolver 404 HTTP real con `<meta http-equiv="status" content="404">`
- O agregar `noindex` a páginas sin resultados

### 2. Páginas de País sin Contenido Localizado

**Síntoma:** URLs de países con pocas empresas como `/ve/directorio` o `/gt/directorio`

**Causa:** País con muy pocas empresas registradas, Google lo considera vacío

**Solución:**
```typescript
// Agregar contenido mínimo cuando hay pocas empresas
// O redirigir a página de país genérica con mensaje

if (totalCount < 5) {
    // Mostrar mensaje de "Estamos creciendo en [país]"
    // Añadir contenido estático sobre Opynio
    // Esto da suficiente contenido para que no sea Soft 404
}
```

### 3. Contenido Cargado con JavaScript

**Síntoma:** Google no ve el contenido porque carga después del render inicial

**Causa:** React renderiza contenido dinámicamente después de fetch

**Verificación:**
```bash
# Usar curl para ver lo que Google ve
curl -A "Googlebot" https://web.opynio.com/es/directorio

# Verificar que hay contenido significativo en el HTML inicial
```

**Solución:**
- Implementar Server-Side Rendering (SSR) con Next.js o similar
- O asegurar que hay contenido estático mínimo en el HTML inicial
- Usar loading skeletons que cuenten como contenido

### 4. Empresas que ya no existen

**Síntoma:** URLs de empresas que fueron eliminadas pero siguen en sitemap

**Causa:** URL en sitemap apunta a empresa eliminada, devuelve página sin contenido

**Solución:**
```typescript
// En BusinessPage.tsx
// Cuando business es null, devolver 404 real

if (!business && !loading) {
    // Devolver código 404 real
    return <NotFoundPage />;
}
```

**Verificar sitemap:**
```bash
# Verificar que el sitemap solo incluya empresas activas
curl https://web.opynio.com/sitemap.xml | grep "<loc>"
```

### 5. Páginas con Redirecciones JavaScript

**Síntoma:** Página usa `navigate()` de React Router en lugar de redirect HTTP

**Causa:** Google no ejecuta el JavaScript y ve página "vacía"

**Solución:**
```typescript
// NO hacer esto:
useEffect(() => {
    if (condition) {
        navigate('/otra-pagina');
    }
}, []);

// HACER esto (en el servidor o con meta refresh):
if (condition) {
    return <meta httpEquiv="refresh" content="0; url=/otra-pagina" />;
}
```

## 📝 Plan de Acción Recomendado

### Prioridad Alta (hacer primero)

1. **Exportar lista de URLs de Google Search Console**
   - Identificar los patrones más comunes

2. **Verificar páginas de empresa eliminadas**
   ```sql
   -- Verificar en Supabase si hay empresas en sitemap que no existen
   SELECT slug FROM businesses WHERE deleted_at IS NOT NULL;
   ```

3. **Añadir contenido mínimo a páginas con pocas empresas**
   - Texto explicativo sobre Opynio
   - Llamado a acción para registrar empresas
   - Enlaces a otras secciones

### Prioridad Media

4. **Implementar 404 real para categorías vacías**
   ```typescript
   if (businesses.length === 0 && debouncedSearchTerm) {
       // Búsqueda sin resultados
       return <meta httpEquiv="status" content="404" />;
   }
   ```

5. **Agregar noindex a páginas sin contenido**
   ```typescript
   const hasLowContent = businesses.length < 3;
   <Meta noindex={hasActiveFilters || hasLowContent} />
   ```

6. **Verificar que sitemap excluye empresas inactivas**

### Prioridad Baja

7. **Considerar SSR/SSG** para páginas críticas
8. **Implementar loading skeletons** con contenido HTML estático
9. **Añadir structured data** para dar más contexto a Google

## 🧪 Herramientas de Testing

### 1. Google Rich Results Test
```
https://search.google.com/test/rich-results
```
- Ver cómo Google renderiza la página
- Verificar si ve el contenido

### 2. Screaming Frog
```
- Crawl del sitio completo
- Identificar páginas con poco contenido
- Encontrar patrones en Soft 404
```

### 3. cURL con User-Agent de Googlebot
```bash
curl -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" \
     https://web.opynio.com/es/directorio | wc -c

# Comparar el tamaño con una página normal
# Si es muy pequeño (< 10KB), posiblemente sea Soft 404
```

## 📊 Métricas de Éxito

Después de implementar las soluciones:

1. **Reducir Soft 404 en 50%** en 1 mes
2. **Identificar y corregir** los 10 patrones más comunes
3. **Mejorar crawl budget** - menos páginas crawleadas sin valor
4. **Aumentar páginas indexadas** correctamente

## 📅 Seguimiento

Revisar Google Search Console cada semana durante 1 mes para:
- Verificar reducción de Soft 404
- Identificar nuevos patrones
- Ajustar estrategia según resultados

## 🔗 Recursos Adicionales

- [Google Soft 404 Documentation](https://developers.google.com/search/docs/crawling-indexing/http-status-codes)
- [Debugging Soft 404s](https://support.google.com/webmasters/answer/181708)

---

**Fecha de creación:** 2026-01-27
**Estado:** Guía de investigación - Requiere datos de Google Search Console
