# 06 — SEO y rendimiento

> Estado consolidado del trabajo SEO+perf hecho desde enero 2026. Cubre: política de `noindex`, solución de Soft 404, optimización de bundle y guía de testing con Lighthouse.

---

## 1. Política de `noindex` (estado actual)

8 páginas tienen `noindex` correctamente aplicado:

| Página | `noindex` | Razón |
|---|---|---|
| [BusinessesPage](../components/pages/BusinessesPage.tsx) | `{hasActiveFilters}` | Evita indexar miles de combinaciones de filtros |
| [ExplorePage](../components/pages/ExplorePage.tsx) | `{hasActiveFilters}` | Igual: filtros = contenido duplicado |
| [SearchResultsPage](../components/pages/SearchResultsPage.tsx) | `true` | Resultados `?q=` nunca deben indexarse |
| [NotFoundPage](../components/pages/NotFoundPage.tsx) | `true` | 404 |
| [ProfilePage](../components/pages/ProfilePage.tsx) | `true` | Privada/autenticada |
| [EditProfilePage](../components/pages/EditProfilePage.tsx) | `true` | Privada |
| [PaymentSuccessPage](../components/pages/PaymentSuccessPage.tsx) | `true` | Transaccional |
| [PaymentCancelPage](../components/pages/PaymentCancelPage.tsx) | `true` | Transaccional |

`robots.txt` complementa con bloqueo de filtros (`/*?*q=`, etc.). Canonical tags se generan automáticamente en `Meta.tsx`.

---

## 2. Soft 404 — causa y solución

**Datos:** 1,000 URLs con Soft 404 en GSC (snapshot 2026-01-27, crawl 2025-12-18 → 2026-01-06).

**Distribución**: 985 URLs (98.5%) son páginas de empresa en países incorrectos (Argentina 16%, Colombia 15.6%, Brasil 14.8%, Alemania 8.9%, etc.). 15 URLs (1.5%) son otras (`casos-de-exito`, `precios`, `explore`).

### Causa raíz

`Meta.tsx` generaba `hreflang` para TODOS los idiomas en páginas de empresa. Resultado: Google descubría 15+ variantes de cada empresa (`/es/empresa/X`, `/mx/empresa/X`, `/ar/empresa/X`, ...) cuando solo una tenía contenido real. Las demás devolvían 200 OK sin empresa → Soft 404 masivos.

### Solución implementada en [`components/Meta.tsx`](../components/Meta.tsx)

```typescript
if (isBusinessPage) {
  // Solo canonical, NO hreflang múltiples
  removeHreflangTags();
  setLinkTag('alternate', canonicalUrl, 'x-default');
} else {
  // Estáticas: hreflang completo
}
```

Complementos: `BusinessPage` devuelve `<NotFoundPage />` si no encuentra el business; `NotFoundPage` tiene `noindex={true}`.

### Estado y próximos pasos

- ✅ Código corregido. Las 1,000 Soft 404 son "antiguas" — Google las eliminará re-crawleando.
- ⏳ Monitorear GSC semanalmente. Objetivo: <100 Soft 404 en 8 semanas.
- ⏳ Opcional: enviar URLs en GSC → Removals para acelerar limpieza.
- ⏳ Investigar las 15 URLs no-empresa (11 `casos-de-exito`, 2 `precios`, 1 `explore`, 1 `buscar`).

### Solo si Soft 404 persiste >3 meses

- **Redirect 301 por país** en `BusinessPage` si `business.country !== currentCountry`. Trade-off: requiere cargar el business primero → lento.
- **Canonical dinámica al país real del business** en `Meta.tsx`. Trade-off: usuario queda en URL "equivocada".
- **SSR (Next.js/Remix)** para devolver 404 real en lugar de 200 con `noindex`. Evaluar en Q2 2026 si el problema persiste — es una migración grande.

---

## 3. Performance — optimización de bundle

### Problema identificado (2026-01-27)

`dist/index.html` pre-cargaba ~1.35MB de JavaScript innecesario en TODAS las páginas vía `<link rel="modulepreload">`:

| Bundle | Tamaño | ¿Necesario al inicio? |
|---|---|---|
| `admin-pages-*.js` | **964 KB** | ❌ NO — solo admins (<1% usuarios) |
| `google-ai-*.js` | **209 KB** | ❌ NO — solo features AI (~30% usuarios) |
| `leaflet-*.js` | **146 KB** | ❌ NO — solo páginas con mapa (~40%) |
| `supabase-*.js` | 184 KB | ⚠️ Parcial — usado pero no urgente |
| `react-core-*.js` | 186 KB | ✅ SÍ |
| `react-router-*.js` | 34 KB | ✅ SÍ |

### Solución 1 — `modulePreload` selectivo (alto impacto, 10 min)

Editar [`vite.config.ts`](../vite.config.ts):

```typescript
build: {
  modulePreload: {
    polyfill: false,
    resolveDependencies: (filename, deps) => {
      const criticalChunks = ['react-core', 'react-router', 'index'];
      return deps.filter(dep => criticalChunks.some(c => dep.includes(c)));
    }
  },
}
```

**Resultado esperado**: −1.3 MB en carga inicial, ~50% más rápido en móvil 3G.

### Solución 2 — Lazy import de Google AI

[`services/geminiService.ts`](../services/geminiService.ts): mover de import estático a dinámico.

```typescript
let genAI: any = null;
async function getGenAI() {
  if (!genAI) {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  }
  return genAI;
}
```

−209 KB en carga inicial. Solo se descarga cuando se usa una feature AI.

### Solución 3 — Dividir admin-pages

```typescript
manualChunks: (id) => {
  if (id.includes('/pages/admin/')) {
    if (id.includes('AdminScrapingPage') || id.includes('AdminBulkEditPage')) {
      return 'admin-heavy';
    }
    return 'admin-core';
  }
}
```

Mejor cache: si cambias scraping, no se reinvalida el resto del admin.

### Solución 4 — Brotli en servidor

Si usas Cloudflare/Vercel/Netlify: ya está. Servidor propio (nginx):

```nginx
brotli on;
brotli_comp_level 6;
brotli_types text/plain text/css application/json application/javascript text/xml application/xml+rss text/javascript;
```

Reduce JS transferido ~70-80%. Cero cambios en código.

### Solución 5 — Service Worker (cache para recurrentes)

Ya hay registro en [`index.tsx`](../index.tsx) para push notifications. Extender para caching estático mejoraría la 2ª carga a casi instantánea.

### Plan recomendado

1. **Quick wins (1-2 h)**: Solución 1 + 4. → −1.3 MB inicial.
2. **Medio plazo (3-4 h)**: Solución 2 + 3.
3. **Avanzado (1-2 días)**: Service Worker + lazy `loading` en imágenes + WebP + (eventual) SSR.

---

## 4. Testing con Lighthouse

### Procedimiento (Chrome DevTools)

1. **Antes de optimizar**: Chrome incógnito → https://web.opynio.com → F12 → Lighthouse pestaña.
2. **Configuración**: Mode `Navigation`, Device `Mobile` primero, todas las categorías marcadas (Performance, Accessibility, Best Practices, SEO), `Clear storage` + `Simulated throttling`.
3. **Analyze page load** (30-60 s). Guardar HTML: `lighthouse-before-mobile.html`. Repetir para Desktop.
4. **Capturar**: Performance score, FCP, LCP, TBT, Speed Index.
5. **Deploy → limpiar cache → repetir** con sufijo `-after-`.

### Umbrales

| Métrica | 🟢 Bueno | 🟡 Mejorar | 🔴 Pobre |
|---|---|---|---|
| Performance Score | 90-100 | 50-89 | 0-49 |
| LCP | <2.5s | 2.5-4s | >4s |
| TBT | <200ms | 200-600ms | >600ms |
| CLS | <0.1 | 0.1-0.25 | >0.25 |

### Mejoras esperadas tras Solución 1 (modulePreload)

- FCP: −30-40%
- LCP: −40-50%
- TBT: −30-40%
- Speed Index: −30-40%
- Performance score: +20-30 puntos en móvil

### Troubleshooting

- **Scores varían entre runs**: Lighthouse tiene 5-10% de variabilidad. Correr 3 veces, tomar mediana.
- **Sin mejora**: verifica que `modulepreload` ya no incluye `admin-pages` en el HTML producción (`grep "admin-pages" dist/index.html`); limpia cache completo; modo incógnito.
- **PageSpeed Insights**: lab data es inmediato; field data tarda 24-48 h en actualizar.

### Monitoreo continuo

- [pagespeed.web.dev](https://pagespeed.web.dev/) tras 24-48 h.
- Search Console → Core Web Vitals (7-28 días).
- Verificar que admin pages siguen funcionando y mapas cargan.

---

## 5. Referencias

- [Lighthouse Docs](https://developer.chrome.com/docs/lighthouse)
- [Web Vitals](https://web.dev/vitals/)
- [Google Search — JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
