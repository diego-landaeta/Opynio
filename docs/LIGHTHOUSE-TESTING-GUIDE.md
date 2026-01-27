# Guía de Testing con Lighthouse - web.opynio.com

**Fecha:** 2026-01-27
**Objetivo:** Medir rendimiento ANTES y DESPUÉS de optimización

---

## 🎯 **OBJETIVO**

Comparar el rendimiento de web.opynio.com antes y después de la optimización que elimina 1.35MB de JavaScript innecesario.

---

## 📊 **MÉTODO 1: Chrome DevTools (RECOMENDADO)**

### Paso 1: Medir ANTES (versión actual en producción)

1. **Abrir Chrome** en modo incógnito (`Ctrl+Shift+N`)
   - Esto evita extensiones que afecten el resultado

2. **Ir a:** https://web.opynio.com

3. **Abrir DevTools:** `F12`

4. **Pestaña "Lighthouse"**
   - Si no la ves, click en `>>` → "Lighthouse"

5. **Configuración:**
   ```
   Mode: Navigation (Default)
   Device: Mobile  ← IMPORTANTE: Empezar con móvil
   Categories:
     ✓ Performance
     ✓ Accessibility
     ✓ Best Practices
     ✓ SEO

   Advanced:
     ✓ Clear storage
     ✓ Simulated throttling (Default)
   ```

6. **Click "Analyze page load"**

7. **Esperar 30-60 segundos**

8. **Guardar resultados:**
   - Click en icono de engranaje → "Save as HTML"
   - Guardar como: `lighthouse-before-mobile.html`

9. **Repetir para DESKTOP:**
   - Device: Desktop
   - Guardar como: `lighthouse-before-desktop.html`

10. **Tomar screenshot de scores principales:**
    - Performance score
    - First Contentful Paint (FCP)
    - Largest Contentful Paint (LCP)
    - Total Blocking Time (TBT)
    - Speed Index

---

### Paso 2: Deploy de optimización

```bash
# Ya hicimos el build optimizado
git push origin master

# Esperar a que el deploy se complete
# Verificar que el nuevo código está en producción
```

**Verificar que el deploy funcionó:**
1. Abrir https://web.opynio.com
2. DevTools → Network
3. Reload con cache limpio (`Ctrl+Shift+R`)
4. Buscar que admin-pages NO se descarga al inicio
5. Ver que solo hay 3 modulepreload (react-core, react-router, supabase)

---

### Paso 3: Medir DESPUÉS (versión optimizada)

1. **Limpiar cache completamente:**
   - Chrome → Settings → Privacy → Clear browsing data
   - Time range: Last hour
   - ✓ Cookies
   - ✓ Cached images and files

2. **Repetir EXACTAMENTE los mismos pasos** del Paso 1:
   - Modo incógnito
   - https://web.opynio.com
   - Lighthouse móvil y desktop
   - Guardar como: `lighthouse-after-mobile.html` y `lighthouse-after-desktop.html`

---

### Paso 4: Comparar resultados

**Crear tabla de comparación:**

| Métrica | Móvil ANTES | Móvil DESPUÉS | Mejora | Desktop ANTES | Desktop DESPUÉS | Mejora |
|---------|-------------|---------------|--------|---------------|-----------------|--------|
| Performance Score | ? | ? | ? | ? | ? | ? |
| FCP | ? | ? | ? | ? | ? | ? |
| LCP | ? | ? | ? | ? | ? | ? |
| TBT | ? | ? | ? | ? | ? | ? |
| Speed Index | ? | ? | ? | ? | ? | ? |
| Total Size | ? | ? | ? | ? | ? | ? |

**Mejoras esperadas:**
- Performance Score: +20-30 puntos en móvil
- LCP: -40-50% (más rápido)
- TBT: -30-40% (menos bloqueo)
- Total Size: -1.35MB en carga inicial

---

## 📊 **MÉTODO 2: PageSpeed Insights (Google Oficial)**

### Ventaja: Datos reales de usuarios

1. **Ir a:** https://pagespeed.web.dev/

2. **ANTES del deploy:**
   ```
   URL: https://web.opynio.com
   Click: Analizar
   ```

3. **Anotar scores:**
   - Performance móvil: ?
   - Performance desktop: ?
   - Core Web Vitals (si hay datos): LCP, FID, CLS

4. **Screenshot de resultados**

5. **DESPUÉS del deploy:**
   - Esperar 24-48 horas para datos reales de usuarios
   - O usar "Lab Data" (datos simulados) inmediatamente
   - Repetir análisis

6. **Comparar**

**Nota:** PageSpeed Insights puede tardar días en actualizar datos de campo reales. Los "Lab Data" son inmediatos pero simulados.

---

## 🔧 **MÉTODO 3: Lighthouse CLI (Automatizado)**

### Instalación:

```bash
# Instalar Lighthouse globalmente
npm install -g lighthouse
```

### Uso en Windows:

```bash
# Ejecutar script automatizado
scripts\test-performance.bat
```

### Uso en Mac/Linux:

```bash
# Dar permisos
chmod +x scripts/test-performance.sh

# Ejecutar
bash scripts/test-performance.sh
```

**El script generará:**
- `lighthouse-reports/mobile-{timestamp}.report.html`
- `lighthouse-reports/desktop-{timestamp}.report.html`
- JSON con datos para análisis programático

---

## 📈 **INTERPRETACIÓN DE RESULTADOS**

### Performance Score (0-100)

| Rango | Estado | Acción |
|-------|--------|--------|
| 90-100 | 🟢 Excelente | Mantener |
| 50-89 | 🟡 Necesita mejora | Optimizar |
| 0-49 | 🔴 Pobre | Urgente optimizar |

### Core Web Vitals

#### LCP (Largest Contentful Paint)
- **Bueno:** < 2.5s 🟢
- **Necesita mejora:** 2.5s - 4s 🟡
- **Pobre:** > 4s 🔴

#### FID / TBT (First Input Delay / Total Blocking Time)
- **Bueno:** TBT < 200ms 🟢
- **Necesita mejora:** 200ms - 600ms 🟡
- **Pobre:** > 600ms 🔴

#### CLS (Cumulative Layout Shift)
- **Bueno:** < 0.1 🟢
- **Necesita mejora:** 0.1 - 0.25 🟡
- **Pobre:** > 0.25 🔴

---

## 🎯 **MEJORAS ESPERADAS CON NUESTRA OPTIMIZACIÓN**

### Impacto directo de eliminar 1.35MB de preload:

1. **FCP (First Contentful Paint):** -30-40%
   - Menos JavaScript que parsear antes de renderizar

2. **LCP (Largest Contentful Paint):** -40-50%
   - Contenido principal carga más rápido sin JavaScript bloqueante

3. **TBT (Total Blocking Time):** -30-40%
   - Menos código JavaScript ejecutándose en el hilo principal

4. **Speed Index:** -30-40%
   - Contenido visible más rápido

5. **Performance Score:** +20-30 puntos
   - Especialmente en móvil (más sensible a JavaScript)

### NO cambia:

- **CLS:** No debería cambiar (no afecta layout)
- **SEO Score:** Ya debe estar bien
- **Accessibility:** No debería cambiar

---

## 📊 **TEMPLATE PARA REPORTE DE RESULTADOS**

```markdown
# Resultados de Optimización - web.opynio.com

**Fecha de test:** [FECHA]
**Optimización:** Eliminación de 1.35MB de JavaScript pre-cargado innecesario

## Móvil (4G Throttled)

| Métrica | ANTES | DESPUÉS | Mejora |
|---------|-------|---------|--------|
| Performance Score | [?]/100 | [?]/100 | +[?] puntos |
| FCP | [?]s | [?]s | -[?]% |
| LCP | [?]s | [?]s | -[?]% |
| TBT | [?]ms | [?]ms | -[?]% |
| Speed Index | [?]s | [?]s | -[?]% |
| Total Size | [?]MB | [?]MB | -[?]MB |

## Desktop

| Métrica | ANTES | DESPUÉS | Mejora |
|---------|-------|---------|--------|
| Performance Score | [?]/100 | [?]/100 | +[?] puntos |
| FCP | [?]s | [?]s | -[?]% |
| LCP | [?]s | [?]s | -[?]% |
| TBT | [?]ms | [?]ms | -[?]% |
| Speed Index | [?]s | [?]s | -[?]% |
| Total Size | [?]MB | [?]MB | -[?]MB |

## Conclusión

[Descripción de resultados]

## Capturas de pantalla

- lighthouse-before-mobile.html
- lighthouse-after-mobile.html
- lighthouse-before-desktop.html
- lighthouse-after-desktop.html
```

---

## 🔍 **TROUBLESHOOTING**

### "Los scores varían mucho entre ejecuciones"

**Normal:** Lighthouse tiene variabilidad del 5-10%

**Solución:**
1. Ejecutar 3 veces
2. Tomar el promedio
3. O usar mediana (valor del medio)

### "No veo mejora significativa"

**Verificar:**
1. ¿Se deployó el nuevo código? (verificar modulepreload en HTML)
2. ¿Limpiaste el cache completamente?
3. ¿Estás en modo incógnito?
4. ¿La red está throttled correctamente?

### "Performance score sigue bajo"

**Otras optimizaciones posibles:**
1. Implementar Service Worker (cache)
2. Optimizar imágenes (WebP)
3. Lazy loading de imágenes
4. Preconnect a dominios críticos
5. Critical CSS inline

Ver [docs/PERFORMANCE-ANALYSIS.md](./PERFORMANCE-ANALYSIS.md) para más soluciones.

---

## 📝 **CHECKLIST DE TESTING**

### Antes del deploy:
- [ ] Ejecutar Lighthouse en producción actual (móvil + desktop)
- [ ] Guardar reportes HTML
- [ ] Tomar screenshots de scores principales
- [ ] Anotar Total Size en Network tab

### Durante el deploy:
- [ ] Push del código optimizado
- [ ] Verificar que deploy completó
- [ ] Verificar modulepreload en HTML producción

### Después del deploy:
- [ ] Limpiar cache completamente
- [ ] Ejecutar Lighthouse nuevamente (móvil + desktop)
- [ ] Guardar nuevos reportes HTML
- [ ] Comparar resultados
- [ ] Documentar mejoras

### Monitoreo continuo:
- [ ] PageSpeed Insights después de 24-48h (datos reales)
- [ ] Google Search Console → Core Web Vitals (7-28 días)
- [ ] Verificar que admin pages siguen funcionando
- [ ] Verificar que mapas cargan correctamente

---

## 🔗 **RECURSOS**

- **Lighthouse Docs:** https://developer.chrome.com/docs/lighthouse
- **PageSpeed Insights:** https://pagespeed.web.dev/
- **Web Vitals:** https://web.dev/vitals/
- **Chrome DevTools:** https://developer.chrome.com/docs/devtools/

---

**Documento creado por:** Claude Sonnet 4.5
**Fecha:** 2026-01-27
**Última actualización:** 2026-01-27
