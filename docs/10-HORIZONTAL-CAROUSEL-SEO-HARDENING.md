# 10 — Plan de blindaje SEO para `horizontal-carousel`

> **Objetivo**: convertir el widget `horizontal-carousel` en una bestia de SEO. Es el widget que se embebe en sitios cliente externos, así que su comportamiento ante Googlebot debe ser impecable: sin canibalizar a Opynio, maximizando rich snippets y consolidando autoridad de marca.
>
> **Para quién**: el siguiente Claude que continúe este trabajo. Todo lo que necesita saber está aquí.

---

## 1. Contexto rápido

- El widget vive en `public/widget.js` (vanilla JS, IIFE) y se sirve desde `https://web.opynio.com/widget.js`.
- Los clientes lo embeben con `<div class="opynio-widget" data-business-id="..." data-type="horizontal-carousel">`.
- Hay un **swap reciente** (commit `4f8fcab`): el `data-type="horizontal-carousel"` ahora renderiza el diseño compacto (panel verde + 3 cards mini + footer "Ver reseñas completas"). El diseño viejo (cards grandes con texto) quedó bajo `stars-carousel`.
- Las CSS classes internas del nuevo diseño se renombraron a `opynio-horizontal-carousel-*`.

---

## 2. Estado actual del bot path (baseline)

Localización: `public/widget.js`, función `'horizontal-carousel'` (~línea 709).

```js
// Líneas relevantes:
var jsonLd = '<script type="application/ld+json">{
  "@context":"https://schema.org",
  "@type":"AggregateRating",
  "itemReviewed":{"@type":"LocalBusiness","name":"...","url":"..."},
  "ratingValue":"...","reviewCount":"...","bestRating":"5","worstRating":"1"
}</script>';

if (IS_BOT) {
    el.innerHTML = '<a href="..." class="opynio-widget-link">'
                 + '<div class="opynio-badge">'
                 + '  <div class="opynio-badge-content">'
                 + '    <div class="opynio-badge-logo">Opynio</div>'
                 + '    <div>'
                 + '      <div class="opynio-stars">★★★★★</div>'
                 + '      <div class="opynio-badge-text">4.8 out of 5</div>'
                 + '      <div class="opynio-badge-count">123 reseñas</div>'
                 + '    </div>'
                 + '  </div>'
                 + '</div></a>' + jsonLd;
    return;
}
```

`BOT_REGEX` cubre: Googlebot, Bingbot, AhrefsBot, SemrushBot, DuckDuckBot, Slurp, Baiduspider, YandexBot, facebookexternalhit, Twitterbot, LinkedInBot, WhatsApp, Discordbot, Applebot.

**Lo que ya está bien:**
- ✅ Bot detection + bot path minimal (no canibaliza Opynio).
- ✅ JSON-LD `AggregateRating` con `itemReviewed`.
- ✅ Enlaces salientes hacia Opynio (consolida autoridad).
- ✅ JSON-LD se emite SIEMPRE (humanos + bots).

---

## 3. Lo que está flojo (priorizado por ROI SEO)

### 🔴 Crítico (impacto alto, esfuerzo bajo)

#### 3.1 — Schema raíz incorrecto

`AggregateRating` como `@type` raíz es válido pero limitado. Google quiere `LocalBusiness` (o subtipo: `Restaurant`, `MedicalBusiness`, etc.) con `aggregateRating` anidado para emitir el rich snippet completo (estrellas amarillas + nombre + categoría en SERP).

**Cambio:**
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

**Datos del business que faltan capturar** (verificar disponibles en `getWidgetBusinessData`):
- `image_url` (logo o foto principal)
- `address` desglosada (`street`, `city`, `region`, `postal_code`, `country`)
- `phone`
- `price_range` (`$`, `$$`, `$$$`)
- `short_description` (≤160 chars)
- `category` para mapear a subtipo de LocalBusiness

#### 3.2 — Bot path sin HTML semántico

El bloque `<div class="opynio-badge">` es un soup de divs sin jerarquía. Googlebot prefiere semántica (`<article>`, `<header>`, `<h2>`, `<address>`).

**Propuesta:**
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

**Por qué importa:**
- Microdata (`itemprop`) actúa como *fallback* del JSON-LD. Google recomienda ambos: si uno falla en parser, el otro respalda.
- `<h2 itemprop="name">` con el nombre del business es la señal más fuerte de relevancia para esa keyword.
- Anchor text descriptivo (`"Ver todas las reseñas de {bizName} en Opynio"`) reemplaza el genérico actual y mejora el ranking de Opynio para búsquedas tipo `"reseñas de {business}"`.

#### 3.3 — Enlaces sin `rel="noopener noreferrer"`

Todos los `target="_blank"` actuales del widget (cards, footer, CTA) abren tab nuevo sin `rel`. Es un riesgo de seguridad (`window.opener` accesible) Y Google penaliza ligeramente.

**Cambio**: en cada `target="_blank"` añadir `rel="noopener noreferrer"`.

```js
// Buscar todos los: target="_blank"
// Reemplazar por:    target="_blank" rel="noopener noreferrer"
```

Aplicar en: `cardHTML`, `footerHTML`, `ctaHTML`, `ratingPanelHTML` y bot path.

---

### 🟡 Importante (impacto medio)

#### 3.4 — `inLanguage` ausente

Los sitios cliente pueden estar en cualquier idioma. Detectar el idioma de la página contenedora y emitirlo:

```js
var pageLang = document.documentElement.lang || navigator.language || 'es';
// Añadir al JSON-LD:
"inLanguage":"' + pageLang + '",
```

También útil: `<html lang>` del bot path debería propagarse a `<article lang="{pageLang}">`.

#### 3.5 — `Organization` para Opynio falta

Cada widget debería declarar implícitamente que pertenece al ecosistema Opynio. Añadir un segundo bloque JSON-LD con `Organization`:

```js
var orgLd = '<script type="application/ld+json">{
  "@context":"https://schema.org",
  "@type":"Organization",
  "@id":"https://opynio.com/#organization",
  "name":"Opynio",
  "url":"https://opynio.com",
  "logo":"https://opynio.com/logo.png",
  "sameAs":["https://twitter.com/opynio","https://linkedin.com/company/opynio"]
}</script>';
```

Solo emitirlo **una vez** por página (verificar con `document.querySelector('script[data-opynio-org]')` y poner `data-opynio-org="1"`).

#### 3.6 — `WebPage` + `BreadcrumbList` (avanzado)

Si la página cliente no tiene un `WebPage` schema, podríamos sugerir/emitir uno que incluya el widget como `mainEntity`. Esto es invasivo y puede chocar con el SEO del cliente. **Decisión recomendada**: NO emitir, dejar que el cliente lo maneje.

#### 3.7 — `Review` individuales solo para humanos

Actualmente en el path humano se muestran 3 cards. **No emitir `Review` schema individual** en sitios cliente — eso sí canibalizaría Opynio. Ya está bien, no tocar. Sí emitirlas en el perfil del business en Opynio (fuera del scope de este plan).

---

### 🟢 Cosmético (impacto bajo, hacerlo cuando se pueda)

#### 3.8 — Minificar `widget.js`

Actualmente ~870 líneas, ~32 KB sin gzipar. Con minify (`terser`/`esbuild`) baja a ~12 KB. Mejora LCP y INP en sitios cliente.

**Implementación**: añadir script `npm run build:widget` que ejecute `esbuild public/widget.js --minify --outfile=public/widget.min.js`. Servir `widget.min.js` por defecto, mantener `widget.js` para debug.

#### 3.9 — Cache headers correctos

Verificar que `widget.js` se sirve con:
```
Cache-Control: public, max-age=3600, stale-while-revalidate=86400
```
Una hora de cache permite invalidación rápida ante bugs; SWR mantiene el sitio rápido.

#### 3.10 — Versionado del widget en query string

El demo `mi-widget.html` ya usa `widget.js?v=container-queries`. Mantener esa convención: cada deploy importante bumpea la version (`?v=2026-05-08`) para invalidar cachés CDN/browser.

#### 3.11 — `aria-label` y accesibilidad mejoradas

- Las flechas `prev`/`next` ya tienen `aria-label` ✅.
- Las cards (`<a>`) deberían tener `aria-label="Reseña de {firstName} con {rating} estrellas"` además del title.
- El contenedor `<div role="region">` debería referenciar un `aria-labelledby` apuntando al heading.

#### 3.12 — `loading="lazy"` en imágenes

Si en el futuro se añaden avatares reales (no iniciales), todas las `<img>` deben llevar `loading="lazy"` y `decoding="async"`.

---

## 4. Plan de implementación sugerido

| Orden | Tarea | Esfuerzo | Impacto SEO |
|-------|-------|----------|-------------|
| 1 | 3.3 — Añadir `rel="noopener noreferrer"` (replace_all) | 5 min | Medio |
| 2 | 3.1 — Schema `LocalBusiness` con `aggregateRating` anidado | 30 min | **Alto** |
| 3 | 3.4 — `inLanguage` desde `document.documentElement.lang` | 10 min | Medio |
| 4 | 3.2 — Bot path semántico con microdata | 1 h | **Alto** |
| 5 | 3.5 — `Organization` (una vez por página) | 20 min | Medio |
| 6 | 3.11 — A11y de cards y región | 20 min | Bajo |
| 7 | 3.8 — Minify pipeline | 30 min | Bajo (perf, no ranking directo) |
| 8 | 3.9 / 3.10 — Cache headers + versionado | depende del CDN | Bajo |

**Recomendación de tandas:**
- **PR 1 (rápido, alto impacto)**: 3.3 + 3.1 + 3.4. Es la tanda crítica, se hace en 1 hora.
- **PR 2 (semántica)**: 3.2 + 3.5 + 3.11.
- **PR 3 (perf)**: 3.8 + 3.9 + 3.10.

---

## 5. Datos del business — qué falta capturar

Antes de implementar 3.1 (LocalBusiness), verificar qué campos están disponibles en la respuesta de `getWidgetBusinessData(businessId)` en `public/widget.js`:

- [ ] `name` ✅ (ya lo tenemos)
- [ ] `url` (canonical en Opynio) ✅
- [ ] `avg_rating` ✅
- [ ] `review_count` ✅
- [ ] `image_url` — ¿existe? buscar en `services/supabaseService.ts → getWidgetBusinessData`
- [ ] `address` (objeto con `street`, `city`, `region`, `postal_code`, `country`)
- [ ] `phone` (E.164 format)
- [ ] `price_range`
- [ ] `short_description` (≤160 chars, ideal SEO meta)
- [ ] `category` → mapear a subtipo de LocalBusiness (`Restaurant`, `Store`, `MedicalBusiness`, etc.)
- [ ] `geo` (`{ latitude, longitude }`) — opcional pero potente para "near me"
- [ ] `openingHours` — opcional

**Si faltan campos**: extender el endpoint del widget para incluirlos. No requiere cambios en DB normalmente; solo extender el SELECT.

---

## 6. Validación post-implementación

### Tests automáticos (cuando estén implementados)

```bash
# 1. Validar JSON-LD parsea sin errores
curl -A "Googlebot/2.1" https://web.opynio.com/widget.js | node -e "..."

# 2. Validar rich results
# Pegar URL del cliente en https://search.google.com/test/rich-results
# Esperar: ✅ AggregateRating válido, ✅ LocalBusiness reconocido
```

### Tests manuales

1. **DevTools UA spoofing**:
   - F12 → Network conditions → User Agent: `Googlebot/2.1`
   - Recargar `mi-widget.html`
   - Inspeccionar el HTML inyectado: debe ser el bot path semántico con microdata.
   - Ver fuente del JSON-LD: debe ser `LocalBusiness` con todos los campos.

2. **Schema.org Validator**:
   - https://validator.schema.org/
   - Pegar el HTML del widget (con bot path)
   - Esperar: 0 errores, 0 warnings críticos

3. **Lighthouse SEO**:
   - Cliente con widget embebido
   - Lighthouse → SEO category → score ≥95
   - Verificar `Structured data is valid`

4. **Search Console** (post-deploy):
   - Después de 1-2 semanas, monitorear "Cobertura" y "Mejoras → Productos / Reseñas"
   - Verificar que el sitio cliente NO recibe penalización por contenido duplicado
   - Verificar que Opynio gana visibilidad en queries `"{nombre del business} reseñas"`

---

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Cliente penalizado por duplicate content | Bot path mantiene HTML minimal sin reseñas individuales ✅ |
| Schema inválido rompe rich snippets | Validar con schema.org/validator ANTES de deploy |
| Cambios de schema rompen sitios cliente que ya funcionaban | Deploy progresivo: primero al 10% via flag, monitorear, expandir |
| `Organization` schema duplicado si cliente ya lo tiene | Detectar `script[type="application/ld+json"]` con `@type: Organization` y skip |
| Rendimiento degradado | Minify obligatorio antes de prod (3.8) |

---

## 8. Referencias técnicas

- [Schema.org LocalBusiness](https://schema.org/LocalBusiness)
- [Google Search — Local Business structured data](https://developers.google.com/search/docs/appearance/structured-data/local-business)
- [Google — Review snippet guidelines](https://developers.google.com/search/docs/appearance/structured-data/review-snippet)
- [Microdata vs JSON-LD](https://moz.com/blog/json-ld-for-beginners) — usar ambos como fallback es lo recomendado.
- [Web Vitals para widgets de terceros](https://web.dev/articles/optimize-third-party-javascript)

---

## 9. Estado del trabajo previo

- `09-WIDGET-SEO-FIX-PLAN.html` / `.pdf` — plan general previo de SEO del widget. **Léelo primero**, este documento es la continuación específica para el `horizontal-carousel` post-swap.
- Commit `4f8fcab` — swap `horizontal-carousel ↔ stars-carousel` aplicado.
- Commit `cc006a9` — galería visual + limpieza mini-carousel.
- Commit `05f0e5e` — añade los nuevos widgets (mini-carousel y stars-carousel originales) con SEO baseline.

---

**Cuando termines la implementación**, marca este documento con `> ✅ APLICADO en commit XXX` al inicio y mueve a `docs/archive/` si lo prefieres.
