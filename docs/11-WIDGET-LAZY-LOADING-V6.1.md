# 11 — Widget loader v6.1: lazy loading SEO-safe

> **Estado**: implementado en `public/widget.js` v6.1.
> **Pendiente** (no incluido en este PR): mover JSON-LD `AggregateRating` fuera del documento del host, añadir `rel="noopener nofollow"` a anchors, dar bot-path a los 8 widgets restantes.

---

## 1. Por qué

Antes (v6.0) el loader hacía `initAll()` en `DOMContentLoaded` y llamaba `initWidget` para **todos** los widgets a la vez, sin importar si estaban dentro o fuera del viewport del host. Cada `initWidget` disparaba en serie:

1. `injectStyles()` (CSS de ~400 líneas con `!important` global)
2. `renderLoader()` (spinner)
3. `fetchData()` (Supabase Edge Function)
4. `translateReviews()` (2 calls × cada review a `translate.googleapis.com`)
5. render

Resultado: el widget competía con el LCP del host y degradaba INP por culpa de los `setInterval` de carruseles que nunca paraban.

---

## 2. Qué cambia (resumen ejecutivo)

| Componente | v6.0 | v6.1 |
|---|---|---|
| Trigger de init | `DOMContentLoaded` → todos a la vez | `IntersectionObserver(rootMargin: '200px')` por widget |
| Bot path | Sólo `stars-carousel` lo respeta | El scheduler lo respeta también: bots → render inmediato |
| Defer post-LCP | No | `requestIdleCallback(timeout: 1500)` antes de `initWidget` |
| Espacio reservado | No | `min-height` por tipo, antes de hidratar |
| `setInterval` carruseles | Eternos | Pausan con `IntersectionObserver` + `document.hidden` |
| `MutationObserver` | `document.body, subtree:true`, dispara siempre | Filtra a `.opynio-widget`, debounced 50 ms |

---

## 3. Decisiones clave y por qué

### 3.1 IntersectionObserver con `rootMargin: '200px 0px'`
Google Search Central recomienda IntersectionObserver explícitamente porque "no depende de acciones del usuario" — Google no scrollea. El margen de 200 px asegura que un widget que aparece por debajo se pre-renderice antes de ser visible al usuario, eliminando el efecto de "spinner que aparece al hacer scroll".

### 3.2 Bypass total para bots
`IS_BOT` ya existía en v6.0 (regex con Googlebot, Bingbot, etc.). En v6.1 el scheduler también lo respeta: si `IS_BOT`, NO se observa, NO se difiere, se llama `initWidget` directo. Justificación: "Googlebot doesn't scroll, and it simulates a tall viewport, which means scroll events never fire and your content may never load" (Search Central).

### 3.3 `requestIdleCallback` con timeout 1500 ms
Aún para widgets que están above-the-fold del host (incluido el `floating`), no llamamos `initWidget` directo. Lo metemos en `requestIdleCallback`. Así:
- El LCP del host se completa primero
- Si la pestaña está ocupada > 1.5 s, el timeout fuerza la ejecución
- Fallback a `setTimeout(_, 1)` para Safari < 17

### 3.4 Per-type `min-height` reservado
`reserveSpace(el)` corre antes que cualquier render y aplica `min-height` según el tipo:

| Tipo | min-height |
|---|---|
| badge | 90 px |
| floating | (sin min-height; es position:fixed) |
| sidebar | 320 px |
| grid | 480 px |
| wall | 560 px |
| showcase | 440 px |
| large-carousel | 380 px |
| horizontal-carousel | 440 px |
| stars-carousel | 320 px |

Si el host ya puso un `min-height` inline, no lo pisamos. Resultado: CLS aportado ≈ 0 cuando el render real reemplaza al loader.

### 3.5 `setInterval` visibility-aware
Los tres carruseles (`large-carousel`, `horizontal-carousel`, `stars-carousel`) ahora usan `visibilityAwareInterval(el, fn, ms)`. Internamente:
- Un IO por carrusel rastrea su visibilidad
- `document.visibilitychange` se escucha
- El `tick` solo ejecuta `fn()` si el widget está visible **y** la pestaña no está oculta

Antes: con 3 widgets de carrusel embebidos, eran 3 timers corriendo siempre. Después: solo corren los visibles activamente.

### 3.6 `MutationObserver` acotado
v6.0 hacía `observer.observe(document.body, { subtree: true })` y en cada mutación llamaba `initAll()`. En SPAs eso es un drenaje de INP brutal. v6.1:
- Sigue observando `subtree:true` (necesario para detectar inserts profundos)
- Pero el callback filtra: solo se prepara una pasada si un nodo añadido **es** un `.opynio-widget` o **contiene** uno
- Debounce de 50 ms para coalesce múltiples mutaciones

---

## 4. Cómo testear

### 4.1 Test diagnóstico en navegador (cero dependencias)
```bash
npm run dev
# abrir http://localhost:5173/widget-test.html
```

La página `public/widget-test.html`:
- Mockea `fetch` para `widget-proxy` y `translate.googleapis.com` (offline-friendly)
- Coloca 5 widgets distribuidos en distintas alturas de scroll
- Muestra un panel sticky a la izquierda con 10 invariantes evaluadas en vivo
- Botón "Recargar como Googlebot" → fuerza `navigator.userAgent` y valida bypass
- Botón "Ocultar pestaña (5s)" → simula `document.hidden` y verifica que los timers pausan

### 4.2 Validación manual con bots reales
1. Subir un fixture público (p. ej. `https://web.opynio.com/widget-test.html`)
2. **Google Search Console → URL Inspection → Test Live URL** → ver "Rendered HTML" y confirmar que para Googlebot se sirve el contenido SEO-safe
3. **Rich Results Test** → validar que el `AggregateRating` (cuando esté en `web.opynio.com`, NO en host) sea elegible
4. **PageSpeed Insights** sobre página fixture: comparar LCP / INP / CLS antes y después

### 4.3 Lighthouse CI (próximo PR)
Cuando se añada Playwright/Lighthouse al pipeline, los thresholds objetivo son:
- LCP < 2.5 s
- TBT < 200 ms
- CLS < 0.1 (idealmente < 0.01 aportado por widget)
- SEO score = 100

---

## 5. Trabajo pendiente (otros PRs)

Hallazgos identificados en la auditoría que **no** están en este PR:

| # | Hallazgo | Severidad | Prioridad |
|---|---|---|---|
| 1 | JSON-LD `AggregateRating` self-serving en `stars-carousel` ([widget.js:715](../public/widget.js#L715)). Google lo ignora desde 2019 para `LocalBusiness`/`Organization`. | 🔴 | siguiente PR |
| 2 | Anchors `target="_blank"` sin `rel="noopener nofollow"`. Tabnabbing + riesgo link scheme. | 🔴 | siguiente PR |
| 3 | Bot path solo en `stars-carousel`. Los 8 widgets restantes inyectan reviews completas a Googlebot — riesgo duplicate content. | 🟠 | PR aparte |
| 4 | CSS global con `!important`. Riesgo de pisar al host. | 🟠 | migración a Shadow DOM |
| 5 | `translateReviews` dispara hasta 2 × N requests al endpoint gtx no oficial. | 🟡 | optimización (caché localStorage + skip si lang ya coincide) |

---

## 6. Referencias oficiales consultadas

- [Fix Lazy-Loaded Website Content (Google Search Central)](https://developers.google.com/search/docs/crawling-indexing/javascript/lazy-loading)
- [Review snippet structured data (Google)](https://developers.google.com/search/docs/appearance/structured-data/review-snippet)
- [Making Review Rich Results More Helpful — Sept 2019](https://developers.google.com/search/blog/2019/09/making-review-rich-results-more-helpful)
- [Optimize Cumulative Layout Shift (web.dev)](https://web.dev/articles/optimize-cls)
