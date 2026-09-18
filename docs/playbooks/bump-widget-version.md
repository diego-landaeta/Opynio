# Playbook: subir la versión del widget

## Resumen

Qué hay que tocar cuando cambias `public/widget.js`, y por qué **no basta** con editar
el fichero. Escrito tras hacerlo dos veces (v6.6.0 → v6.7.0 → v6.8.0).

## Cuándo usar

Siempre que modifiques `public/widget.js`, por pequeño que sea el cambio. Si no subes
la versión, los navegadores de los visitantes siguen sirviendo el widget viejo desde
caché y el cliente ve una interfaz que ya no existe.

## Pasos

1. **Cabecera de `public/widget.js`** (línea 2):

   ```js
   * Opynio Widget Loader v6.8.0
   ```

2. **`EMBED_VERSION`** en
   [`components/pages/business/dashboard/widgets/widgetShared.ts`](../../components/pages/business/dashboard/widgets/widgetShared.ts):

   ```ts
   const EMBED_VERSION = 'v6.8.0';
   ```

   Esa constante va al snippet que copia el cliente (`widget.js?v=v6.8.0`) y es lo que
   fuerza la redescarga.

3. **`WIDGET_VERSION` dentro de `public/widget.js`** (junto a la configuración):

   ```js
   var WIDGET_VERSION = 'v6.8.0';
   ```

   Es lo que el widget cree ser. Se compara con la que anuncia el servidor para
   decidir si tiene que recargarse.

4. **`WIDGET_VERSION` en
   [`supabase/functions/widget-proxy/index.ts`](../../supabase/functions/widget-proxy/index.ts)**:

   ```ts
   const WIDGET_VERSION = 'v6.8.0';
   ```

   Viaja en cada respuesta. Un widget más antiguo la ve y se recarga solo.

**Las cuatro tienen que coincidir.** No lo compruebes a ojo:

```bash
npm run check:widget
```

Y actívate el guardián una vez por copia del repositorio, para que no dependa de
acordarse:

```bash
git config core.hooksPath .githooks
```

A partir de ahí, cualquier commit que toque el widget con las versiones
descuadradas —o que cambie `widget.js` sin subir la versión— se detiene solo.

### Orden al desplegar

**Primero el fichero, después el proxy.** Si sale antes el proxy, anunciará una
versión que aún no existe y los widgets harán un intento de recarga inútil (uno
solo: hay un freno para que no se repita). Al revés no pasa nada.

3. **Anota el cambio** en la cabecera del propio `widget.js`, en la lista de versiones:
   una línea diciendo qué cambió para el cliente, no para ti.

4. Si el cambio añade texto visible, mételo en `UI_STRINGS` **de `widget.js`**
   (20 idiomas). Ese bloque es independiente de `locales/`: ver
   [add-i18n-keys.md](./add-i18n-keys.md).

## Verificación

```bash
# Las dos versiones, una al lado de la otra: tienen que ser la misma
grep -n "Widget Loader v" public/widget.js | head -1
grep -n "EMBED_VERSION = " components/pages/business/dashboard/widgets/widgetShared.ts

# Que el fichero siga parseando (no hay build que lo cubra: se sirve tal cual)
node -e "new Function(require('fs').readFileSync('public/widget.js','utf8')); console.log('ok')"
```

Y pruébalo en un HTML suelto que cargue `widget.js` contra respuestas simuladas:
`public/widget.js` **no pasa por el build de Vite**, así que un error de sintaxis ahí
no lo detecta `npx vite build`. Solo lo ve el navegador del cliente.

## Rollback

`git checkout -- public/widget.js components/pages/business/dashboard/widgets/widgetShared.ts`.
Si ya se subió al hosting, volver a subir el fichero anterior: los clientes que ya
tengan el nuevo en caché lo mantendrán hasta que caduque o hasta el siguiente bump.

## Gotchas

- **El bump obliga a redescargar a TODOS los clientes**, no solo a los afectados por el
  cambio. Es lo deseado, pero tenlo en cuenta si el cambio es arriesgado.
- `WIDGET_CSS` está duplicado: uno en `public/widget.js` (el real) y otro en
  `widgetShared.ts` (para las vistas previas del panel). Un estilo nuevo que deba verse
  igual en los dos sitios hay que ponerlo dos veces.
- `WIDGET_CSS_SHADOW` se deriva de `WIDGET_CSS` dentro de `widget.js`: añadir reglas a
  `WIDGET_CSS` basta para cubrir también el Shadow DOM.
