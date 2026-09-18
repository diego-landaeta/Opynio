# Entorno local: Supabase en Docker

Levanta una copia de Opynio contra un Supabase **local** —Postgres, PostgREST,
Auth y Studio en Docker— con datos de ejemplo. Sirve para probar migraciones,
políticas RLS y el widget incrustado **sin tocar el proyecto de producción**.

## Arrancar

```bash
npx supabase start               # solo la primera vez (descarga imágenes)
bash scripts/local/reconstruir.sh
npx vite --mode docker --port 8768
```

Entras en `http://localhost:8768` con **jefa@local.test / prueba-local-1234**.
Deja una academia con doce cursos, unas ochenta reseñas y parte sin asignar.

Para parar todo: `npx supabase stop`.

## Por qué `--mode docker` y no `.env.local`

Vite lee `.env.local` en **todos** los modos. Si las credenciales locales
vivieran ahí, tu `npm run dev` de siempre dejaría de apuntar a producción sin
avisar. Con `--mode docker` solo se lee `.env.docker.local`, y el flujo normal
no se entera de que este entorno existe.

Ese fichero **lo genera `reconstruir.sh`** leyendo las claves del propio stack;
no se escribe a mano y está ignorado por git.

## Qué hay aquí

| Fichero | Para qué |
|---|---|
| `reconstruir.sh` | Rehace la base entera: esquema, migraciones, usuaria y datos. |
| `datos.sql` | La academia de ejemplo y su catálogo. Lo usa el script anterior. |
| `pruebas.sql` | Comprueba las garantías del modelo de productos. Ver abajo. |
| `preparar-widget.py` | Copia `public/widget.js` apuntando al Supabase local. |
| `web-cliente.html` | Web de academia simulada que carga esa copia, como un cliente real. |

## Comprobar las garantías del modelo

```bash
docker exec -i supabase_db_Opynio psql -U postgres -d postgres < scripts/local/pruebas.sql
```

Diez comprobaciones contra RLS y roles reales, dentro de una transacción que
termina en `ROLLBACK` (no deja rastro). Cubren lo que no se puede romper:

- El total de la empresa es **independiente** de sus productos: las reseñas de
  Google y las importadas cuentan para la empresa y no tienen producto.
- Una reseña no puede estar en dos productos, ni enlazarse a un producto de otra
  empresa.
- La nota de un producto sale solo de sus reseñas.
- Un anónimo ve los productos activos, **no** los retirados, **no** la referencia
  interna (`code`) y no puede crear nada.

## Probar el widget como lo ve un cliente

```bash
python scripts/local/preparar-widget.py
# abrir http://localhost:8768/scripts/local/web-cliente.html
```

La página imita la web de una academia, con su propio CSS, y carga dos widgets:
uno de la empresa y otro de un curso. Sirve para ver que el del curso muestra su
propia nota, que los enlaces llevan a su ficha y que no hay desplazamiento de
diseño al cargar (CLS).

## Si algo no va

**El widget dice «Error del servidor»** — el runtime de Edge Functions está
parado. Pasa después de reiniciar la máquina: `npx supabase start` lo deja caído
sin avisar. `reconstruir.sh` ya lo levanta, pero a mano es:

```bash
docker start supabase_edge_runtime_Opynio
```

**La aplicación no encuentra la empresa** — la base se ha reconstruido y los
identificadores han cambiado. Vuelve a ejecutar `preparar-widget.py`.

## Aviso importante

El esquema local se reconstruye desde [`docs/01-DATABASE-SETUP.md`](../../docs/01-DATABASE-SETUP.md)
y de las migraciones. Eso significa dos cosas:

1. Cada reconstrucción **comprueba que ese documento sigue siendo ejecutable**.
2. Es una reconstrucción, no una copia de producción. Vale para la sintaxis, la
   RLS y el flujo; **no** prueba nada sobre las columnas reales de tu base. Para
   eso está la consulta de solo lectura al final de ese mismo documento.
