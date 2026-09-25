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

> **Superado.** El orden, los comandos y las verificaciones vigentes están en
> [DESPLIEGUE-2026-09.md](./DESPLIEGUE-2026-09.md) (24/09/2026): la rama ya lleva
> 17 migraciones, 19 funciones y el widget v6.10.4, y tres de esas migraciones
> no se pueden aplicar tal cual en producción. Lo que sigue es el texto del
> 18/09, corregido donde ya no es cierto.

1. **SQL primero.** Las dos migraciones de producto (`20260917120000`,
   `20260917121000`). El panel de Productos revienta al cargar sin ellas.
   **Ojo:** `20260917120000` falla en producción tal como está, porque allí
   `reviews.id` es `bigint` y la migración lo enlaza como `UUID` (ver B1 en el
   runbook).
2. **`widget-proxy` y `generate-sitemap`, después del SQL.** El 18/09 ambos
   degradaban solos si las tablas no estaban. **Ya no es así para
   `widget-proxy`**: desde que pide las reseñas a la RPC `widget_business_reviews`
   (migración `20260923150000`), si esa RPC no existe el widget de empresa
   responde **sin reseñas** (el error solo se registra en el log). Hay que
   aplicar antes las migraciones. `generate-sitemap` sigue degradando, pero
   debe desplegarse con `verify_jwt=false`.
3. **`widget.js` (hoy v6.10.4) y después el front.**

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

## Después de desplegar: las 39 reseñas que mienten

El arreglo hace que las fotos nuevas se suban, pero **no repara las viejas**. En
producción hay **39 reseñas etiquetadas «imágenes» sin ninguna imagen**, de 2
empresas, entre marzo de 2023 y diciembre de 2025. Sus ficheros nunca llegaron a
subirse: no hay nada que recuperar, solo una etiqueta que promete algo que no
está.

Primero mira cuántas son (solo lectura):

```sql
SELECT id, business_id, title, created_at
FROM reviews
WHERE tags @> ARRAY['imágenes']
  AND (image_urls IS NULL OR cardinality(image_urls) = 0)
ORDER BY created_at;
```

Y si te cuadra, quita la etiqueta:

```sql
UPDATE reviews
SET tags = array_remove(tags, 'imágenes')
WHERE tags @> ARRAY['imágenes']
  AND (image_urls IS NULL OR cardinality(image_urls) = 0);
```

> ⚠️ **Es la única sentencia de toda esta entrega que escribe en `reviews`.** Todo
> lo demás deja esa tabla intacta. Solo quita una etiqueta de filas cuya promesa
> es demostrablemente falsa —no borra reseñas, ni texto, ni valoraciones— pero
> decídelo tú y hazlo aparte, no dentro del despliegue.

---

## Lo que sigue pendiente

Widget sin imagen del producto, orden de los productos por nota en vez de por
fecha, buscador en el selector cuando haya muchos, empleados (la base ya lo
acepta; falta pantalla y la decisión legal), y seis tablas que el código usa y
siguen sin documentar.
