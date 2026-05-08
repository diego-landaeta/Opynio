# 12 — Plan de migración a Shadow DOM (próximo PR)

> **Estado**: pendiente. Diferido conscientemente desde v6.3.0 porque es un refactor real con riesgo de regresiones en hosts en producción y **sin upside SEO bloqueante**. Ya hicimos el lazy loading, los fixes SEO (JSON-LD, rel, bot-path) y la UX del floating en v6.0 → v6.3.0. Esto es la última pieza de "blindaje".

---

## 1. Por qué hacerlo

- Eliminar **todos los `!important`** del CSS del widget. Hoy son ~70 reglas con `!important` para combatir temas agresivos (WordPress, Shopify, etc.) que pisan al widget.
- **Cero conflictos** con CSS del host: el host nunca podrá romper el widget accidentalmente con un selector global.
- Los `!important` de WordPress se vuelven irrelevantes — Shadow DOM aísla por defecto.
- Limpieza de mantenibilidad: el CSS deja de ser una guerra de especificidad.

## 2. Por qué NO se hizo en v6.3.0

- Toca **cada uno de los 9 renderers**: cada `el.innerHTML` y `el.querySelector` necesita pasar por la raíz del shadow root.
- El CSS necesita transformación: `:root { --opynio-* }` → `:host { --opynio-* }`, `.opynio-widget` (el host element) deja de matchear desde dentro del shadow.
- El bot path debe seguir en **light DOM** (sin shadow) para que el contenido sea trivialmente indexable. Eso significa dos rutas de render conviviendo.
- Riesgo real: alguno de los 9 widgets se rompe en algún host raro. Sin testeo dedicado, ese riesgo es alto.

## 3. Plan concreto

### 3.1 Estrategia técnica

```js
function attachShadowShell(el, theme) {
    var shadow = el.attachShadow({ mode: 'open' });
    var styleEl = document.createElement('style');
    styleEl.textContent = WIDGET_CSS_SHADOW; // version with :host
    shadow.appendChild(styleEl);
    var wrapper = document.createElement('div');
    wrapper.className = 'opynio-widget opynio-theme-' + theme;
    shadow.appendChild(wrapper);
    el.__opynioShadow = shadow;
    el.__opynioRoot = wrapper;
    return wrapper;
}
```

Cambios en `initWidget`:
- Después de `IS_BOT` (que sigue light DOM), antes de llamar al renderer, crear el shadow + wrapper.
- Pasar el wrapper al renderer en lugar de `el`. Refactorizar firma a `(root, el, business, reviews, s)` — `el` se sigue pasando para acceso a `dataset` (p. ej. `floating` lee `data-position`).

### 3.2 Cambios en CSS

`var WIDGET_CSS_SHADOW = WIDGET_CSS.replace(/:root/g, ':host')`. Más casos puntuales:
- Reglas que dicen `.opynio-widget { ... }` (target host element) → eliminar (en shadow scope, el host es implícito).
- Reglas que dicen `.opynio-widget .opynio-x` → simplificar a `.opynio-x`.
- Eliminar todos los `!important` (innecesarios en shadow).

### 3.3 Bot path — sin cambios

`renderBotSafe(el, business, s)` sigue usando `el.innerHTML` directo (light DOM). Ventaja: el contenido SEO-safe queda en el árbol indexable trivial. Googlebot Chromium evergreen indexa shadow DOM bien, pero el bot path queda fuera por simplicidad.

### 3.4 Test page

`public/widget-test.html` necesita ajustes:
- `document.querySelectorAll('.opynio-widget')` para detectar el host: igual.
- Para inspeccionar contenido interno: `el.shadowRoot ? el.shadowRoot.querySelector(...) : el.querySelector(...)`.
- Añadir invariante: "Shadow DOM activo en humanos, ausente en bot path".

### 3.5 Migración con red de seguridad

- **Opt-in temporal**: `data-isolate="shadow"` activa Shadow DOM. Default sigue siendo light DOM.
- Probar en staging con varios hosts representativos (WordPress, Shopify, plain HTML).
- Cuando todos los renderers se vean bien con `data-isolate="shadow"`, hacer el flip: default = shadow, opt-out via `data-isolate="light"`.
- Eventualmente eliminar el modo light salvo para el bot path.

---

## 4. Estimación

- Implementación inicial: ~1 día
- Pruebas en hosts representativos: ~1-2 días
- Ajustes finos por renderer: ~1 día
- Total: ~1 semana de trabajo enfocado.

## 5. Cuándo hacerlo

Cuando aparezca el primer ticket "el widget se ve raro en este host" que sea atribuible a CSS del host pisándonos. Hasta ese momento, los `!important` actuales bastan y el coste/beneficio no justifica el riesgo de la migración.

---

## 6. Referencias

- [MDN — Using Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM)
- [Web.dev — Shadow DOM v1: Self-Contained Web Components](https://web.dev/articles/shadowdom-v1)
- [Google Search Central — JavaScript SEO Basics (incluye Shadow DOM)](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
