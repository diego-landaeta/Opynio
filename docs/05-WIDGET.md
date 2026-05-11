# 05 — Widget de reseñas (`stars-carousel` + roadmap)

> **Qué cubre este documento**:
> - Blindaje SEO del widget `stars-carousel` (el que se embebe en sitios cliente).
> - Plan de migración a Shadow DOM (diferido conscientemente).
>
> Fuente única para el siguiente desarrollador que toque el widget. Si ya está aplicado algo, márcalo con commit y fecha.

---

## 1. Contexto

- El widget vive en [`public/widget.js`](../public/widget.js) (vanilla JS, IIFE) y se sirve desde `https://web.opynio.com/widget.js`.
- Embed cliente: `<div class="opynio-widget" data-business-id="..." data-type="stars-carousel">`.
- El componente React de preview: `components/pages/business/dashboard/widgets/StarsCarouselWidget.tsx` (export `StarsCarouselPreview`).
- CSS classes con prefix `opynio-stars-carousel-*`.

---

## 2. SEO del bot path — qué hay y qué falta

`BOT_REGEX` cubre Googlebot, Bingbot, AhrefsBot, SemrushBot, DuckDuckBot, Slurp, Baiduspider, YandexBot, facebookexternalhit, Twitterbot, LinkedInBot, WhatsApp, Discordbot, Applebot.

`SELF_HANDLED_EMPTY = ['stars-carousel']` — el renderer maneja internamente 0 reseñas.

**Lo que ya está bien:** bot detection con path minimal (no canibaliza Opynio), JSON-LD `AggregateRating` con `itemReviewed`, enlaces salientes hacia Opynio, JSON-LD emitido siempre.

### 🔴 Crítico (alto ROI, esfuerzo bajo)

**2.1 Schema raíz: `AggregateRating` → `LocalBusiness`**

`AggregateRating` raíz es válido pero limitado. Google quiere `LocalBusiness` (o subtipo) con `aggregateRating` anidado para emitir rich snippet completo.

```js
var jsonLd = '<script type="application/ld+json">{
  "@context":"https://schema.org",
  "@type":"LocalBusiness",
  "@id":"' + businessUrl + '#business",
  "name":"' + bizName + '",
  "url":"' + businessUrl + '",
  "image":"' + (business.image_url || logoFallback) + '",
  "address":{"@type":"PostalAddress","addressLocality":"' + city + '","addressCountry":"' + country + '"},
  "telephone":"' + (business.phone || '') + '",
  "priceRange":"' + (business.price_range || '') + '",
  "description":"' + (business.short_description || '') + '",
  "aggregateRating":{
    "@type":"AggregateRating",
    "ratingValue":"' + rating + '",
    "reviewCount":"' + count + '",
    "bestRating":"5","worstRating":"1"
  }
}</script>';
```

Campos del business a verificar en `getWidgetBusinessData` (en [`services/supabaseService.ts`](../services/supabaseService.ts)): `image_url`, `address`, `phone`, `price_range`, `short_description`, `category` (→ mapear a subtipo de LocalBusiness). Si faltan: extender el SELECT del endpoint.

**2.2 Bot path semántico con microdata**

Reemplazar el soup de divs por HTML semántico — microdata actúa como fallback del JSON-LD:

```html
<article class="opynio-badge" itemscope itemtype="https://schema.org/LocalBusiness">
  <a href="{businessUrl}" rel="noopener" class="opynio-widget-link">
    <header class="opynio-badge-content">
      <div class="opynio-badge-logo" aria-hidden="true">Opynio</div>
      <h2 itemprop="name" class="opynio-sr-only">{bizName}</h2>
      <div itemprop="aggregateRating" itemscope itemtype="https://schema.org/AggregateRating">
        <div class="opynio-stars" aria-label="{rating} de 5 estrellas">★★★★★</div>
        <div class="opynio-badge-text">
          <span itemprop="ratingValue">{rating}</span>
          <span class="opynio-sr-only">de</span>
          <span itemprop="bestRating">5</span>
        </div>
        <div class="opynio-badge-count">
          Basado en <span itemprop="reviewCount">{count}</span> reseñas verificadas
        </div>
      </div>
    </header>
    <span class="opynio-cta-text">Ver todas las reseñas de {bizName} en Opynio</span>
  </a>
</article>
```

Anchor text descriptivo (`"Ver todas las reseñas de {bizName} en Opynio"`) reemplaza el genérico actual.

**2.3 `rel="noopener noreferrer"` en todos los `target="_blank"`**

Aplicar en `cardHTML`, `footerHTML`, `ctaHTML`, `ratingPanelHTML` y bot path. Riesgo de seguridad (`window.opener`) + leve penalización SEO.

### 🟡 Importante (impacto medio)

**2.4 `inLanguage`** — detectar idioma del host y emitirlo:

```js
var pageLang = document.documentElement.lang || navigator.language || 'es';
// añadir al JSON-LD: "inLanguage":"' + pageLang + '"
```

**2.5 `Organization` para Opynio** — segundo bloque JSON-LD, **una sola vez por página** (gate con `document.querySelector('script[data-opynio-org]')` y `data-opynio-org="1"`):

```js
var orgLd = '<script type="application/ld+json" data-opynio-org="1">{
  "@context":"https://schema.org",
  "@type":"Organization",
  "@id":"https://opynio.com/#organization",
  "name":"Opynio",
  "url":"https://opynio.com",
  "logo":"https://opynio.com/logo.png",
  "sameAs":["https://twitter.com/opynio","https://linkedin.com/company/opynio"]
}</script>';
```

**No emitir `Review` schema individual en sitios cliente** — eso canibaliza Opynio. Sí en el perfil del business en Opynio.

### 🟢 Cosmético

- **Minify `widget.js`**: `esbuild public/widget.js --minify --outfile=public/widget.min.js` (~32 KB → ~12 KB).
- **Cache**: `Cache-Control: public, max-age=300, stale-while-revalidate=86400` (ya en deploy actual).
- **Versionado en query string**: `widget.js?v=EMBED_VERSION` para invalidar cache (ya implementado).
- **a11y**: `aria-label="Reseña de {firstName} con {rating} estrellas"` en cards, `role="region"` con `aria-labelledby`.

### Orden sugerido

| # | Tarea | Esfuerzo | Impacto |
|---|---|---|---|
| 1 | 2.3 `rel="noopener noreferrer"` | 5 min | Medio |
| 2 | 2.1 Schema `LocalBusiness` anidado | 30 min | **Alto** |
| 3 | 2.4 `inLanguage` | 10 min | Medio |
| 4 | 2.2 Bot path semántico + microdata | 1 h | **Alto** |
| 5 | 2.5 `Organization` | 20 min | Medio |
| 6 | Minify + a11y | 1 h | Bajo |

---

## 3. Validación

**DevTools UA spoofing**: F12 → Network conditions → User Agent `Googlebot/2.1` → recargar test page → inspeccionar HTML inyectado (debe ser bot path semántico).

**Schema validator**: https://validator.schema.org/ → pegar HTML del widget → 0 errores.

**Rich Results Test**: https://search.google.com/test/rich-results → AggregateRating válido, LocalBusiness reconocido.

**Search Console (1-2 semanas post-deploy)**: monitorear Cobertura y Mejoras → Productos/Reseñas. El sitio cliente NO debe penalizarse por contenido duplicado. Opynio debe ganar para queries `"{business} reseñas"`.

### Riesgos

| Riesgo | Mitigación |
|---|---|
| Cliente penalizado por duplicate content | Bot path minimal, sin reseñas individuales ✅ |
| Schema inválido rompe rich snippets | Validar antes de deploy |
| Cambios rompen sitios cliente activos | Deploy progresivo / feature flag |
| `Organization` duplicado si cliente ya lo tiene | Gate con `data-opynio-org` ✅ |

---

## 4. Plan de migración a Shadow DOM (diferido)

**Estado**: pendiente. Diferido desde v6.3.0 — refactor real, riesgo de regresiones en hosts en producción, **sin upside SEO bloqueante**. Lazy loading, fixes SEO (JSON-LD, rel, bot-path) y UX del floating se hicieron en v6.0 → v6.3.0. Esto es la última pieza de blindaje.

### Por qué hacerlo

- Eliminar **todos los `!important`** (~70 reglas para combatir temas agresivos en WordPress/Shopify).
- **Cero conflictos** con CSS del host: imposible romper el widget desde fuera.
- Limpieza de mantenibilidad — fin de la guerra de especificidad.

### Por qué NO se hizo en v6.3.0

- Toca cada uno de los 9 renderers (`el.innerHTML`, `el.querySelector` → shadow root).
- CSS necesita transformación: `:root` → `:host`, `.opynio-widget` (host element) deja de matchear desde dentro.
- Bot path debe quedarse en **light DOM** para indexabilidad trivial → dos rutas de render conviviendo.
- Riesgo real: algún renderer se rompe en algún host raro sin testeo dedicado.

### Plan técnico

```js
function attachShadowShell(el, theme) {
    var shadow = el.attachShadow({ mode: 'open' });
    var styleEl = document.createElement('style');
    styleEl.textContent = WIDGET_CSS_SHADOW; // versión con :host
    shadow.appendChild(styleEl);
    var wrapper = document.createElement('div');
    wrapper.className = 'opynio-widget opynio-theme-' + theme;
    shadow.appendChild(wrapper);
    el.__opynioShadow = shadow;
    el.__opynioRoot = wrapper;
    return wrapper;
}
```

Cambios en `initWidget`: después de `IS_BOT` (que sigue light DOM), antes del renderer, crear shadow + wrapper. Refactor de firma a `(root, el, business, reviews, s)` — `el` sigue pasándose para acceso a `dataset`.

**CSS**: `var WIDGET_CSS_SHADOW = WIDGET_CSS.replace(/:root/g, ':host')`. Más casos puntuales:
- Reglas `.opynio-widget { ... }` (target host) → eliminar (host es implícito en shadow scope).
- Reglas `.opynio-widget .opynio-x` → simplificar a `.opynio-x`.
- Eliminar todos los `!important`.

**Bot path**: sin cambios. `renderBotSafe(el, business, s)` sigue usando `el.innerHTML` directo en light DOM. Googlebot Chromium indexa shadow DOM bien, pero el bot path queda fuera por simplicidad.

**Test page** (`public/widget-test.html` si vuelve a existir): añadir invariante "Shadow DOM activo en humanos, ausente en bot path". Para inspeccionar contenido interno: `el.shadowRoot ? el.shadowRoot.querySelector(...) : el.querySelector(...)`.

### Migración con red de seguridad

- **Opt-in temporal**: `data-isolate="shadow"` activa Shadow DOM. Default light DOM.
- Probar en staging con hosts representativos (WordPress, Shopify, plain HTML).
- Cuando todos los renderers se vean bien, flip de default a shadow; opt-out `data-isolate="light"`.
- Eventualmente eliminar el modo light salvo para bot path.

### Estimación y trigger

- Implementación inicial: ~1 día. Pruebas en hosts: ~1-2 días. Ajustes finos: ~1 día. **Total: ~1 semana enfocada.**
- **Cuándo hacerlo**: cuando aparezca el primer ticket "el widget se ve raro en este host" atribuible a CSS del host pisándonos. Hasta entonces los `!important` bastan y el coste/beneficio no justifica el riesgo.

---

## 5. Referencias

- [Schema.org LocalBusiness](https://schema.org/LocalBusiness)
- [Google — Local Business structured data](https://developers.google.com/search/docs/appearance/structured-data/local-business)
- [Google — Review snippet guidelines](https://developers.google.com/search/docs/appearance/structured-data/review-snippet)
- [MDN — Using Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM)
- [Web Vitals para widgets de terceros](https://web.dev/articles/optimize-third-party-javascript)
