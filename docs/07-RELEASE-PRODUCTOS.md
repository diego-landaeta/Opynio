# 07 — Release: productos reseñables

Guía para revisar y desplegar esta rama. **Nada de esto está aplicado ni
desplegado.** Escrita el 18/09/2026.

Son 16 commits y 86 ficheros, pero no es un bloque: son **cinco cosas
independientes** que se pueden revisar —y desplegar— por separado. Están en la
misma rama porque salieron unas de otras, no porque dependan entre sí.

---

## Qué hay aquí, por unidades

### A. Arreglos que valen por sí solos *(despliega cuando quieras)*

No tienen nada que ver con productos. Son fallos que afectan **hoy** a usuarios
reales y se descubrieron por el camino.

| Commit | Qué arregla | Cómo se detectó |
|---|---|---|
| `9aef268` | El botón «Escribe tu reseña» del widget llevaba a un **404** en todas las webs de clientes. Apuntaba a `/es/escribir` y la ruta es `/es/escribir-resena`. | Al recorrer el circuito entero contra un Supabase real |
| `31d4641` | Las **fotos de las reseñas no se subían nunca**. `createReview` recibía un segundo argumento con los ficheros y su firma solo aceptaba el primero. En producción hay **39 reseñas etiquetadas «imágenes» y cero con imagen real**. | Al buscar de dónde subir la imagen de un producto |
| `0b19b69` | La **cola de moderación era invisible**. Consecuencia directa del 404: como no llegaba ninguna reseña de la web, nadie miraba esa cola. Al arreglar el botón, empezarán a llegar. | |
| `492b436` | Logos claros invisibles sobre fondo claro (tono medido del logo). | Sesiones anteriores |

> **Los dos primeros y el tercero van juntos.** Arreglar el botón sin hacer
> visible la cola significa que las reseñas nuevas entran y no las ve nadie.

### B. Productos reseñables *(la funcionalidad)*

`3285f24` (el grueso), `773eb0c` (selector de la ficha pública), `b3131b1` (sitemap).

Cada producto o servicio tiene su nota, sus reseñas y su widget. La regla que no
se puede romper: **el total de la empresa cuenta TODAS sus reseñas**, no la suma
de sus productos.

### C. Documentación *(sin riesgo)*

`d06dccd`, `b9223d9`. El documento de base de datos describía un esquema viejo:
faltaban 12 columnas de `profiles`, el `slug` de `businesses`, el tipo
`user_role`, el disparador de alta y seis tablas. **No servía para reconstruir
nada.** Corregido y comprobado: la base local se levanta entera desde él.

### D. Herramientas *(sin riesgo, no entra en el bundle)*

`d8ac2ad` (Supabase local en Docker), `7f09b05` (`npm run typecheck`).

### E. Traducciones

31 idiomas, 56 claves nuevas. Completas y sin `{placeholder}` roto, pero
**ningún nativo ha leído las 25 que no hablamos**.

---

## Orden de despliegue

Comprobado, no supuesto:

1. **SQL primero.** Las dos migraciones de producto (`20260917120000`,
   `20260917121000`). El panel de Productos revienta al cargar sin ellas.
2. **`widget-proxy` y `generate-sitemap`, cuando quieras.** Ambos degradan solos
   si las tablas no están: lo probé escondiéndolas y el widget de empresa
   responde idéntico y el sitemap devuelve 200 sin fichas de producto.
3. **Front y `widget.js` v6.10.1 al final.**

**Aparte, y con su propio momento**: el arreglo del disparador de `logo_tone`
(`20260915150000`) es `CREATE OR REPLACE` sobre una tabla existente
(`businesses`). Es el único cambio de esta rama que modifica comportamiento de
algo que ya está vivo.

### Vuelta atrás

- SQL: `DROP` de los objetos nuevos. **La tabla `reviews` no se toca en ningún
  momento**, así que no hay nada que restaurar.
- Widget: revertir `public/widget.js` y `EMBED_VERSION` a la vez.
- Front: revertir el despliegue.

---

## Qué se verificó de verdad

Contra un Supabase local real (PostgREST, RLS, Auth y roles), no contra maquetas:

- **10 de 10** comprobaciones del modelo (`scripts/local/pruebas.sql`): el total
  de la empresa es independiente de los productos, una reseña no puede estar en
  dos, no se enlaza a un producto de otra empresa, y el anónimo no lee la
  referencia interna ni crea nada.
- **Circuito completo**: widget de un curso → formulario → publicar → la reseña
  queda enlazada a ese curso, en estado `pending`.
- **Widget incrustado** en una web de cliente simulada: **CLS 0**, enlaces
  correctos, y **7 de los 9 tipos idénticos al píxel** frente a la versión
  desplegada (v6.5.5). Solo cambian `sidebar` (+9px) y `badge` (+7px).
- **Esquema contrastado con producción** (solo lecturas): 24 de 25 columnas
  presentes; la única que falta, `profiles.reviews_count`, no la lee nadie.

## Qué NO se verificó

- **Nada de esto ha corrido sobre tus datos.** El entorno local es una
  reconstrucción a partir del documento y las migraciones, no una copia.
- No se ha probado con carga. La escala real ayuda: 115 reseñas de media por
  empresa y la mayor tiene 2.655, así que las consultas por empresa siempre
  trabajan sobre conjuntos pequeños.
- Las traducciones que no hablamos.

---

## Antes de que un cliente lo use

- **Ninguna cuenta puede usar Productos hoy**: hay 41 perfiles `free` y 2
  `enterprise`, y la funcionalidad exige `starter` o superior.
- **Decidir quién vacía la cola de moderación.** Ahora se ve, pero verla no la
  vacía.

## Lo que sigue pendiente

Widget sin imagen del producto, orden de los productos por nota en vez de por
fecha, buscador en el selector cuando haya muchos, empleados (la base ya lo
acepta; falta pantalla y la decisión legal), y seis tablas que el código usa y
siguen sin documentar.
