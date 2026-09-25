# Despliegue a producción — septiembre 2026

Runbook para llevar a producción todo lo que hay en `feat/productos-resenables`
(commits de la rama **y** cambios sin commitear del árbol de trabajo).

- Preparado el **24/09/2026** con consultas **de solo lectura** a producción
  (catálogo de Postgres, `GET` a la Management API y descarga de los ficheros
  estáticos públicos). **No se ha aplicado ni desplegado nada.**
- Proyecto Supabase: `hvtrrhxeqrsnjxhngdsj`. Web: `https://web.opynio.com`.
- Sustituye a la sección «Orden de despliegue» de
  [07-RELEASE-PRODUCTOS.md](./07-RELEASE-PRODUCTOS.md), que se escribió el 18/09
  con 2 migraciones y el widget v6.10.1; hoy son 28 migraciones (27 en la
  sección 3 + `code_privado`), 19 funciones y el widget **v6.10.5**.
- **Revisado de nuevo el 24/09 por la noche** contra el árbol de trabajo y con
  `SELECT`/`GET` a producción (resultados en cada sección). Nada aplicado.
- Al final: **[checklist de 1 página](#checklist-de-1-página)** para imprimir.

> **Sección 0: B1–B4 resueltos en los ficheros (24/09, tarde)** y probados
> aplicando las 22 migraciones, en orden y como en el SQL Editor, sobre una
> **copia del esquema de producción** en el Docker local (`opynio_prodlike`,
> sección 3.0): 22/22 OK y 74/74 pruebas de roles OK. B5 y B8 también están
> resueltos; siguen abiertos B6 (se aplica a mano, fichero a fichero) y B7.
> **Ensayo repetido el 24/09 a las 22:33–22:50 UTC** con el paso 0-bis y las
> 28 migraciones de hoy (incluidas 3.22–3.26 y 3.23b): 28/28 OK en los dos
> órdenes, segunda pasada OK, 74/74 pruebas de roles y 48/48 de seguridad
> (ver «Ensayo con 0-bis y 3.22–3.25» en la sección 3).

**Orden global** (cada paso depende del anterior, salvo los pasos 0-bis y 0):

- **PASO 0-bis — URGENTE, YA, antes que todo: cerrar la fuga de emails**
  ([sección 0-bis](#paso-0-bis--urgente-cerrar-la-fuga-de-emails-independiente)).
  Independiente de todo lo demás (ni migraciones, ni funciones, ni front, ni
  pagos): pegar `scripts/_datos-prod/00-hotfix-fuga-emails.sql` entero en el
  SQL Editor. Solo quita permisos a 3 funciones que nadie usa. Hoy cualquiera
  con la anon key (pública) lista los emails de las 45 cuentas.

0. **PASO 0 — URGENTE: pagos** ([sección P](#paso-0--urgente-arreglar-los-pagos-independiente)).
   Independiente de todo lo demás. **Cuatro funciones**: `stripe-webhook`
   (`--no-verify-jwt`), `get-checkout-status` (nueva), `create-checkout-session`
   y `create-portal-session` (esta, si apruebas su `return_url`); ninguna
   migración. **Listo** (24/09, noche): incluye la corrección del nombre de
   empresa duplicado y de la doble suscripción al cambiar de plan (P.2).
1. Preparación y copia de seguridad (sección 2).
2. **Migraciones** SQL 3.1 → 3.26, con 3.23b (sección 3; lista final en 3.0). El front
   **actual** de producción es compatible con 3.1–3.18 (comprobado contra su
   bundle); 3.19–3.21 son de otros agentes (ver la nota de la sección 3);
   3.22–3.25 (24/09, noche) también son compatibles con él (ver cada una).
3. **Funciones** (sección 4), con **`widget.js` v6.10.5 subido justo antes de
   `widget-proxy`** (4.1, según
   [bump-widget-version.md](./playbooks/bump-widget-version.md): primero el
   fichero, después el proxy). `widget-proxy` necesita 3.7 (y esta, 3.2–3.3);
   los `requireAdmin` solo son fiables después de 3.4, porque hasta entonces un
   usuario normal puede ponerse `role = 'admin'` en su perfil;
   `send-invitation-email` necesita 3.2 y **3.17 (`20260924140000`)**.
4. **Front** `dist/` (sección 5). **No se sube sin** `featured_order` (3.13,
   home y `/admin/destacados`), `admin_list_users` (3.11, `/admin/usuarios`), el
   bucket `avatars` (3.10), las tablas de productos (3.2) y
   `directory_businesses` (3.26, `/…/empresas`): comprobación en 5.3.3. Ni sin
   el **paso 0** (`/pago-exitoso` llama a `get-checkout-status`).
5. `code_privado` (6.1) y carga del catálogo (6.2 →
   `scripts/_datos-prod/04-…`).
6. Datos a corregir (sección 7 → `scripts/_datos-prod/01…03`), Dashboard
   (sección 8; el punto 1 es independiente y se puede hacer ya) y pruebas de
   humo (sección 9).
7. Opcional y aparte: reparar el cron del scrapeo mensual (4.5).

---

## Paso 0-bis — URGENTE: cerrar la fuga de emails (independiente)

**Hacerlo ya, antes que todo.** No depende de nada (ni migraciones, ni
funciones, ni front, ni pagos) y nada depende de él. Solo cambia permisos.

**Qué pasa** (24/09, `SELECT` al catálogo de producción):

| Función | Problema | ¿Quién la usa? |
| --- | --- | --- |
| `search_assignable_users(text)` | `SECURITY DEFINER`, sin `search_path`, **sin comprobar admin**, `EXECUTE` para `PUBLIC`/`anon`/`authenticated`; hace JOIN con `auth.users` y devuelve `email` | Nadie |
| `get_admin_users_paginated(int, int, text, text)` | Igual; devuelve emails, nombre y rol de todas las cuentas, paginado | Nadie (el front nuevo usa `admin_list_users`, 3.11) |
| `refresh_business_metrics()` | Mismo patrón con **escritura**: cualquiera lanza `REFRESH MATERIALIZED VIEW CONCURRENTLY` en bucle (carga gratuita). No filtra datos | Nadie (3.8 hace esto mismo; aquí se adelanta) |

Con la anon key (pública, está en el bundle) cualquiera saca por
`/rest/v1/rpc/` el email de las **45 cuentas**. Son las **únicas** funciones de
la base que leen `auth.users`. «Nadie» = 0 apariciones en el bundle servido
(`index-B5KSYvHq`, 35 chunks, incluido `admin-pages`), en el front de la rama,
en las 20 Edge Functions desplegadas (paquetes descargados con `GET`), en otras
funciones de la base y en `cron.job`.

**Cómo** (2 minutos):

1. (Opcional) SQL Editor → pegar el fichero, **seleccionar solo el bloque A** y
   ejecutarlo: vista previa (hoy: 3 filas con `anon`/`authenticated` = `true`).
2. SQL Editor → pegar **entero** `scripts/_datos-prod/00-hotfix-fuga-emails.sql`
   → Run. Es una transacción con comprobación final: si algo no cuadra, aborta
   sin cambiar nada.
3. Resultado esperado (bloque C, lo último que enseña el editor): 3 filas con
   `anon = false`, `authenticated = false`, `service_role = true`,
   `postgres = true` y `acl = {postgres=X/postgres,service_role=X/postgres}`.
4. Desde fuera (PowerShell, en `C:\Proyectos\Opynio`; con un término que no
   coincide con nadie, así no sale ningún email ni antes ni después):

   ```powershell
   $anon = ((Select-String -Path .env -Pattern '^VITE_SUPABASE_ANON_KEY=(.*)$').Matches[0].Groups[1].Value).Trim('"',"'")
   $u = 'https://hvtrrhxeqrsnjxhngdsj.supabase.co/rest/v1/rpc'
   curl.exe -s -w "`n%{http_code}`n" "$u/search_assignable_users?p_search_term=zzzz-no-existe" -H "apikey: $anon" -H "Authorization: Bearer $anon"
   curl.exe -s -w "`n%{http_code}`n" "$u/get_admin_users_paginated?p_limit=1&p_search_term=zzzz-no-existe" -H "apikey: $anon" -H "Authorization: Bearer $anon"
   #   Antes: [] / {"data":[],"count":0} y 200.  Después: "code":"42501" (permission denied) y 401.
   Remove-Variable anon, u
   ```

**Vuelta atrás** (reabre la fuga): bloque D del fichero, los `GRANT` exactos
de la ACL leída en prod. **Alternativa**: bloque E, `DROP` de las dos funciones
de la fuga (guardando antes su definición con la consulta que trae).

**Probado** sobre una copia **prístina** del esquema de prod
(`opynio_prodlike_hotfix`, mismo `prodlike-schema.sql` que 3.0): antes, `anon`
lista los emails con las dos; tras pegar el fichero entero como el SQL Editor,
`anon`, un usuario normal y el admin (por la API) reciben `permission denied`,
`service_role` y `postgres` siguen pudiendo; segunda pasada sin error; el
bloque D devuelve exactamente la ACL de prod; el E, probado en
`BEGIN/ROLLBACK`. **Repetido el 24/09 (22:35 UTC)** sobre una copia recién
regenerada del catálogo de prod (idéntico): 12/12, segunda pasada OK, D deja la
ACL exacta de prod y un fallo simulado de la comprobación final aborta sin
cambiar nada (sección 3, «Ensayo con 0-bis…»). La ACL de prod sigue siendo la
del bloque A (leída a las 22:30 UTC: la fuga sigue abierta). La misma
corrección queda en el repo como **3.22**
(`20260924200000_close_user_email_leak.sql`), que no cambia nada si el hotfix ya
se aplicó.

**Revisadas y fuera del hotfix** (las 35 `SECURITY DEFINER` de `public`
ejecutables por anon/authenticated; las de trigger no se llaman por RPC):
`get_admin_businesses_paginated` (sin comprobar admin, pero solo devuelve lo que
anon ya lee por RLS: `businesses.*` y nombre/usuario/avatar/rol del dueño;
`profiles` no tiene email ni teléfono), `get_business_analytics` (su comprobación
deja pasar a anon, pero solo da agregados de reseñas aprobadas), las `admin_*` y
`resolve_review_appeal` (comprueban admin), `upgrade_user_to_business_owner`,
`finish_business_signup` e `increment_ai_credits` (solo sobre `auth.uid()`) y el
resto (datos ya públicos). `customers`/`subscriptions`: ninguna función
`DEFINER` las lee y su RLS solo deja ver lo propio. Ninguna vista lee
`auth.users`.

---

## Paso 0 — URGENTE: arreglar los pagos (independiente)

> **Listo para ejecutar (24/09, noche).** La corrección de los dos riesgos que
> bloqueaban este paso está en el árbol de trabajo y probada. **Cuatro
> funciones** (lista exacta en P.2), **ninguna migración**, sin tocar URLs
> (`success_url`/`cancel_url` iguales; el `return_url` del portal sigue siendo
> tu decisión, P.1.1). Detalle en `docs/04-STRIPE-INTEGRATION.md` (2.1–2.3 y 7).
>
> - **Nombre de empresa duplicado** (en prod `businesses_name_key`
>   `UNIQUE(name)`): `create-checkout-session` lo rechaza **antes de cobrar**
>   (400 `business_name_taken`; el front nuevo ofrece reclamar la existente si
>   no tiene dueño o cambiar el nombre). Si aun así choca en el webhook (dos
>   altas a la vez), la empresa se crea como «Nombre (2)»…«(10)» y, en último
>   recurso, «Nombre (<final del id de la suscripción>)»: **ningún cobro se
>   queda sin empresa** por el nombre (aviso en el log para que el admin decida).
> - **Doble suscripción**: con una suscripción viva (`active`/`trialing`/
>   `past_due`, mirada en Stripe) no se crea otro Checkout: 409
>   `has_active_subscription`/`duplicate_subscription` → el front abre el
>   portal (el nuevo, directamente en la confirmación del cambio con
>   prorrateo). En el webhook, solo la suscripción **principal** (la viva más
>   reciente) escribe el plan, y `customer.subscription.deleted` solo baja a
>   `free` si no queda otra viva. Hoy hay 0 suscripciones activas en prod: no
>   cambia nada existente.
> - **`/pago-exitoso`** (front nuevo) confirma **esa** sesión con
>   `get-checkout-status` (nueva) antes del Purchase. **Starter anual**
>   (`price_1TTo2C…`) responde `price_unavailable` con mensaje claro (P.1.2).
>
> **Con el front que hay hoy en prod** (se despliega después, sección 5):
> Checkout, portal y webhook funcionan; ante un 409 el front actual ya abre el
> portal (normal); un nombre duplicado se rechaza sin cobro pero el front
> actual enseña el texto técnico («non-2xx») hasta subir el nuevo;
> `get-checkout-status` no la llama nadie hasta entonces. **El front nuevo no
> se sube sin este paso**: sin `get-checkout-status`, `/pago-exitoso` diría
> «todavía no vemos ningún pago» aunque se haya cobrado.
>
> **Probado** (24/09, noche; nada contra prod ni contra Stripe real): 33/33
> pruebas unitarias del webhook con RPC falsa (nombres, sufijos, último
> recurso, suscripción principal, `deleted`); SQL en `opynio_prodlike`
> (`BEGIN…ROLLBACK`, prod de hoy **y** prod tras las 27 migraciones): forma real
> del 23505 de `businesses_name_key`, alta con «(2)» y con el último recurso,
> reintento reconocido, renovación de la antigua sin pisar el plan, `deleted`
> con otra viva → su plan y con ninguna → `free`, alta sin pago de quien ya paga
> el plan (límite del plan real); las 4 funciones sin `BOOT_ERROR` en el runtime
> local (8/8) y en runtimes aislados con clave de Stripe falsa (18/18 checkout/
> estado/portal; webhook: firma, caducidad e idempotencia 7/7);
> `npm run typecheck` sin errores nuevos; Playwright 51/51 (nombre ocupado es/gb
> 375/1280 claro/oscuro, 409 → portal con el plan destino, alta de quien ya
> paga sin Checkout, `price_unavailable`, `/pago-exitoso` en sus 4 estados).

**Producción no cobra desde el 19/05/2026.** Ese día se desplegó
`create-checkout-session` **v25**, una versión antigua que exige `priceId` en el
cuerpo; el front manda `{ plan, billingCycle, businessId | businessData }` y
recibe 400 en **todos** los pagos. `stripe-webhook` **v31** (también del 19/05)
es igual de antigua: no usa `processed_webhook_events` ni la RPC
`process_checkout_completion`.

Comprobado el 24/09 (solo lectura):

| Qué | Producción | Consecuencia |
| --- | --- | --- |
| `create-checkout-session` | v25 · `verify_jwt=true` · 19/05 | Rota. La del repo la arregla. |
| `create-portal-session` | v21 · `verify_jwt=true` · 06/05 | Funciona, pero vuelve a `/empresa/panel/facturacion` (404). |
| `stripe-webhook` | v31 · `verify_jwt=false` · 19/05 | Sin idempotencia ni transacción. |
| `get-checkout-status` | **No existe** (nueva) | Solo la llama el front nuevo (`/pago-exitoso`). |
| RPC `process_checkout_completion` | **Ya existe con los 31 parámetros** (mismos nombres, `p_subscription_id` … `p_business_longitude`) que manda el webhook del repo | **No hace falta ninguna migración.** |
| Tablas `processed_webhook_events`, `customers`, `subscriptions`, `prices`, `products` | Existen | — |
| Último evento de Stripe procesado / última suscripción | 07/05/2026 · 0 suscripciones activas | Nada a medias que recuperar. |
| Secretos `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SIGNING_SECRET`, `META_CAPI_TOKEN` | Existen (solo nombres) | No hay que crear ninguno. |

**Copia de seguridad: ya hecha** en `scripts/_backup-prod-functions/`
(ignorado por git): `<función>.body.eszip` (el paquete desplegado, con el
`index.ts` original dentro del *source map*) y `<función>.meta.json` (versión,
`verify_jwt`, hash). Son las v25, v21 y v31.

### P.1 Antes (5 minutos)

1. **Decide el portal.** La versión del repo cambia el `return_url` de
   `/empresa/panel/facturacion` (404) a **`/mis-negocios`**: pendiente de tu
   aprobación. Si no lo apruebas, despliega las otras tres y deja el portal
   como está: funciona (al volver cae en un 404) y, ante un 409 de checkout,
   abre el portal normal en vez de la confirmación del cambio de plan (la v21
   ignora el `{ plan, billingCycle }` que manda el front nuevo).
2. **Stripe → Productos**: el precio **Starter anual** del código
   (`price_1TTo2CGP3zN1neHAplpNdMDD`) tiene otro prefijo de cuenta
   (`…GP3zN1neHA…`) que el resto (`…RJqlZctcvh…`): parece de **otra cuenta de
   Stripe**. Con la función nueva, si no existe en la cuenta de la clave, ese
   plan responde 500 `price_unavailable` **sin cobrar** (el front nuevo dice
   «Este plan no se puede contratar ahora mismo con esta modalidad… prueba la
   otra (mensual o anual) o escríbenos») y el log lo explica; el resto de
   planes funciona. Comprobar en Stripe (docs/04, sección 4); si no existe,
   crear el precio anual de Starter en la cuenta buena y cambiar
   `PLAN_PRICE_IDS` en `_shared/stripePlans.ts` en un despliegue aparte (las
   cuatro funciones). **No bloquea este paso.**
3. Lo que se despliega es el **árbol de trabajo** (hay cambios sin commitear):
   ```powershell
   cd C:\Proyectos\Opynio
   git status --short supabase/functions/_shared supabase/functions/create-checkout-session supabase/functions/create-portal-session supabase/functions/stripe-webhook supabase/functions/get-checkout-status
   node scripts/_deploy-edge-multipart.cjs create-checkout-session --dry-run   # 3 ficheros (index + _shared/stripePlans + _shared/businessName); verify_jwt true
   node scripts/_deploy-edge-multipart.cjs stripe-webhook --dry-run            # 5 ficheros (index, checkoutCompletion, subscriptionSync + los 2 de _shared); verify_jwt false
   node scripts/_deploy-edge-multipart.cjs get-checkout-status --dry-run       # 3 ficheros; verify_jwt true
   node scripts/_deploy-edge-multipart.cjs create-portal-session --dry-run     # 2 ficheros (index + _shared/stripePlans); verify_jwt true
   ```
   Recomendado (lo decides tú): commitear antes esas carpetas (incluida
   `_shared/`) para saber qué hay desplegado, pasando antes el skill
   **`pre-commit-secret-scan`**.
4. CLI con sesión: `npx supabase login` (abre el navegador; **no pegues tokens
   en el chat**). Si Docker no está arrancado, añade `--use-api` a cada deploy.

### P.2 Desplegar

```powershell
$ref = 'hvtrrhxeqrsnjxhngdsj'
cd C:\Proyectos\Opynio
npx supabase functions deploy stripe-webhook          --project-ref $ref --no-verify-jwt   # 1.º: Stripe llama sin JWT
npx supabase functions deploy get-checkout-status     --project-ref $ref                   # 2.º: nueva, verify_jwt=true
npx supabase functions deploy create-checkout-session --project-ref $ref                   # 3.º: con esta vuelven los cobros
npx supabase functions deploy create-portal-session   --project-ref $ref                   # 4.º: solo si apruebas /mis-negocios (P.1.1)
```

Orden: primero el webhook, para que el primer cobro que permita
`create-checkout-session` ya lo procese la versión nueva (con la v31, un
nombre duplicado dejaría el cobro sin empresa). Las cuatro, **antes** del front
nuevo (sección 5). Ninguna migración.

El CLI empaqueta con cada función sus imports relativos (nuevos, sin
commitear): `stripe-webhook/checkoutCompletion.ts`, `stripe-webhook/subscriptionSync.ts`,
`_shared/stripePlans.ts` y `_shared/businessName.ts`. **No** usar `scripts/_deploy-edge-function.cjs`
(desactivado). `scripts/_deploy-edge-multipart.cjs <slug>` es la alternativa si
el CLI falla (ya sube los imports relativos y lee `verify_jwt` de
`config.toml`).

### P.3 Comprobar (las tres cosas)

```powershell
# 1. Versiones: antes 25 / 21 / 31 / (no existe). Esperado: 26+ / 22+ (si se desplegó) / 32+ / get-checkout-status v1.
#    verify_jwt: Dashboard → Edge Functions → stripe-webhook → "Verify JWT" desactivado; las otras tres, activado.
npx supabase functions list --project-ref $ref

# 2. Sin sesión de usuario → 401 JSON con code "unauthorized" (la v25 respondía sin "code").
#    Se usa la anon key (pública, ya está en el bundle) para pasar la pasarela; se lee de .env sin mostrarla.
$anon = ((Select-String -Path .env -Pattern '^VITE_SUPABASE_ANON_KEY=(.*)$').Matches[0].Groups[1].Value).Trim('"',"'")
curl.exe -s -w "`n%{http_code}`n" -X POST "https://$ref.supabase.co/functions/v1/create-checkout-session" -H "Authorization: Bearer $anon" -H "Content-Type: application/json" -d "{}"
#    Esperado: {"error":"No autorizado.","code":"unauthorized","details":"No autorizado."}  y  401
#    (Sin cabecera Authorization responde la pasarela con su propio 401, sin "code": no distingue versiones.)
curl.exe -s -w "`n%{http_code}`n" -X POST "https://$ref.supabase.co/functions/v1/create-portal-session" -H "Authorization: Bearer $anon" -H "Content-Type: application/json" -d "{}"
#    Esperado (si se desplegó): mismo JSON con "code":"unauthorized" y 401
curl.exe -s -w "`n%{http_code}`n" -X POST "https://$ref.supabase.co/functions/v1/get-checkout-status" -H "Authorization: Bearer $anon" -H "Content-Type: application/json" -d "{}"
#    Esperado: mismo JSON con "code":"unauthorized" y 401 (404 = no desplegada; BOOT_ERROR = vuelta atrás)

# 3. El webhook arranca (sin BOOT_ERROR) y rechaza lo no firmado
curl.exe -s -w "`n%{http_code}`n" -X POST "https://$ref.supabase.co/functions/v1/stripe-webhook" -d "{}"
#    Esperado: invalid signature  y  400   (la v31 decía "Webhook Error: …"; 500/503 = no arranca → vuelta atrás)
Remove-Variable anon
```

4. **Prueba manual** en `https://web.opynio.com`, con una cuenta de empresa de
   prueba en plan free: **Precios → «Cambiar a Growth»** → debe abrir
   **Stripe Checkout** (`checkout.stripe.com`). Cerrar la pestaña o pulsar
   «atrás» **no cobra nada** (vuelve a `/pago-cancelado`). Antes de hoy, ese
   botón mostraba «No se ha podido iniciar el pago».
5. Si apruebas el portal: con una cuenta que tenga cliente de Stripe,
   «Gestionar facturación» abre el portal y «Volver» lleva a `/mis-negocios`.
6. Logs: Dashboard → Edge Functions → `create-checkout-session` → Logs, sin
   `price_unavailable` (salvo Starter anual, P.1.2).
7. Si alguien paga de verdad: `stripe-webhook` → Logs con
   `✅ checkout.session.completed` (y, si hubo nombre duplicado,
   `empresa_creada_como="…"` más un `AVISO` para revisar si es la misma
   empresa). Con el front nuevo, `/pago-exitoso` confirma y manda el Purchase
   solo cuando `get-checkout-status` da `ready`.

`meta-capi` no es parte de este paso (el front actual y el webhook nuevo
funcionan con la versión que hay); va en la sección 4.

### P.4 Vuelta atrás (solo si P.3 falla; vuelve a dejar los pagos rotos)

```bash
# Git Bash, en C:\Proyectos\Opynio: extrae el index.ts original de cada eszip (no toca el repo)
node -e 'const fs=require("fs"),p=require("path"),out=process.argv[1];for(const f of ["create-checkout-session","create-portal-session","stripe-webhook"]){const b=fs.readFileSync("scripts/_backup-prod-functions/"+f+".body.eszip");const s=b.indexOf("{\"version\":3,\"sources\":[\"source/index.ts\"]");let d=0,q=0,e=0,i=s;for(;i<b.length;i++){const c=b[i];if(q){if(e)e=0;else if(c==92)e=1;else if(c==34)q=0;continue}if(c==34)q=1;else if(c==123)d++;else if(c==125&&--d==0)break}const m=JSON.parse(b.slice(s,i+1).toString("utf8"));const o=p.join(out,"supabase/functions",f);fs.mkdirSync(o,{recursive:true});fs.writeFileSync(p.join(o,"index.ts"),m.sourcesContent[0]);console.log(f,"OK")}' C:/opynio-backup/pagos-v25
npx supabase init --workdir C:/opynio-backup/pagos-v25        # crea un config.toml vacío
npx supabase functions deploy <función> --project-ref hvtrrhxeqrsnjxhngdsj --workdir C:/opynio-backup/pagos-v25   # stripe-webhook con --no-verify-jwt
```

(Probado el 24/09: el extractor recupera los tres `index.ts`, de un solo
fichero y solo con imports por URL.)

`get-checkout-status` no tenía versión anterior: si hubiera que retirarla,
`npx supabase functions delete get-checkout-status --project-ref hvtrrhxeqrsnjxhngdsj`.
El front actual no la llama; **el nuevo sí** (sin ella, `/pago-exitoso` no
confirma ningún pago), así que no se retira si el front nuevo ya está subido.

---

## 0. Bloqueos: resolver antes de desplegar

| # | Qué pasa | Evidencia (24/09) | Qué hacer |
| --- | --- | --- | --- |
| **B1** ✔ | **Resuelto 24/09.** `20260917120000_review_subjects.sql` fallaba entera: declaraba `review_subject_links.review_id UUID REFERENCES reviews(id)` e `is_review_author(uuid)`, y en producción `reviews.id` es **`bigint` identity** (ids 2349…129730). | Reproducido en `opynio_prodlike` con el fichero original: `foreign key constraint "review_subject_links_review_id_fkey" cannot be implemented … uuid and bigint`. En local (docs/01, `scripts/local/`) `reviews.id` es `uuid`. | Hecho en el fichero: `review_id` se crea con el tipo que tenga `reviews.id` (un `DO` lo lee del catálogo: `bigint` en prod, `uuid` en local) e `is_review_author(p_review_id public.reviews.id%TYPE)`, también en su `COMMENT` y `GRANT`. Políticas con `DROP … IF EXISTS` y fichero entre `BEGIN/COMMIT`: idempotente. Probado en prod-like (bigint) y en local (uuid). Pendiente aparte: alinear `docs/01-DATABASE-SETUP.md`/`scripts/local/` a `bigint` (10.5). |
| **B2** ✔ | **Resuelto 24/09.** `20260923120000_fix_security_guards.sql` fallaba entera por `CREATE TRIGGER … ON public.business_claims`, tabla que **no existe** en producción; al ir entre `BEGIN/COMMIT` no se aplicaba ningún arreglo de seguridad. | Reproducido en `opynio_prodlike`: `relation "public.business_claims" does not exist`. El resto de precondiciones se cumple (`claims`, `review_appeals`, los guards y `update_review_vote_counts` existen). | Hecho en el fichero: el trigger de `business_claims` va en un `DO` que solo actúa si `to_regclass('public.business_claims')` no es `NULL`. |
| **B3** ✔ | **Resuelto 24/09.** `20260923220000_fix_admin_rpcs.sql` borraba `resolve_review_appeal(bigint, …)` y creaba una `(uuid, …)`; en producción `review_appeals.id`/`review_id` son **`bigint`** (compilaba y fallaba al primer uso). Además en prod **sí** existe `review_appeals.resolved_by` (en local no). | Columnas `bigint` y `resolved_by uuid` en prod; 0 apelaciones; el front no llama a esta RPC. | Hecho en el fichero: `p_appeal_id public.review_appeals.id%TYPE` y variable `review_id%TYPE`; solo se borra la sobrecarga cuyo tipo **no** coincide con `review_appeals.id` (en prod ninguna: `CREATE OR REPLACE` reescribe la de `bigint`); `resolved_by` se rellena con SQL dinámico solo si la columna existe. Probado: el admin resuelve con id `bigint`, la reseña pasa a `approved` y queda `resolved_by`. |
| **B4** ✔ | **Resuelto 24/09** con la migración nueva **`20260924150000_drop_permissive_policies.sql`** (paso 3.18). Producción tiene políticas permisivas con otros nombres que anulaban (OR) los arreglos. | Presentes hoy en prod (7): `review_votes` «Authenticated users can insert votes» y «Users can update own votes»; `review_appeals` «Los usuarios pueden crear y ver sus apelaciones» (`ALL`: apelar lo ajeno y aprobarse la apelación); `storage.objects` «Business owners can upload logos» (cualquier dueño, cualquier ruta), «Authenticated users can upload avatars» (cualquier ruta) y las de UPDATE por `owner` «Business owners can update their own logo» / «Users can update their own avatar» (permitían **mover** un fichero propio a cualquier ruta, incluso de otro bucket). | La migración comprueba primero que existen las políticas que las sustituyen (si no, aborta con mensaje), borra las 7 con `IF EXISTS` y crea: UPDATE de votos con la misma regla que el INSERT, SELECT de apelaciones propias y UPDATE de imágenes de producto acotado a `productos/<empresa propia>/`. Sustituye al SQL suelto que había en 3.4, 3.8 y 3.10. |
| **B5** ✔ | **Resuelto 24/09.** `generate-sitemap` está desplegada con `verify_jwt=false` y `supabase/config.toml` no la tenía. Con `verify_jwt=true`, `https://web.opynio.com/sitemap.xml` —que el proxy de la web sirve desde esta función, sin `Authorization`— respondería **401 a Google**. | `GET /functions`: `generate-sitemap` v54, `verify_jwt=false`. `config.toml` (24/09, noche): `[functions.generate-sitemap] verify_jwt = false`, igual que `stripe-webhook`, `monthly-rescrape-job` y `widget-proxy`. | Se despliega igualmente con `--no-verify-jwt` (redundante, por si acaso) y se verifica `/sitemap.xml` (4.3). |
| **B6** | **No usar `supabase db push`.** `supabase_migrations.schema_migrations` solo tiene 4 filas (`20260429205557`, `20260429214703`, `20260505182026`, `20260505192243`; siguen siendo 4 el 24/09 por la noche); las dos de mayo tienen versiones distintas de los ficheros del repo. El CLI se negaría o intentaría reaplicar. | Consulta a `schema_migrations`. | Aplicar cada fichero en **Dashboard → SQL Editor**, uno a uno, en el orden de la sección 3 (como indica `supabase/migrations/README.md`). |
| **B7** | Hay **trabajo en curso de otros agentes** que entra en este mismo build (sección 5.1). | `git status`. | No hacer el build final hasta que terminen y `npm run verify` pase. |
| **B8** ✔ | **Resuelto 24/09.** `scripts/_deploy-edge-multipart.cjs` solo subía `index.ts`: 11 funciones que importan `../_shared/` (y `stripe-webhook`, que ahora importa `./checkoutCompletion.ts`) habrían arrancado en **`BOOT_ERROR`**, y ponía `verify_jwt=true` por defecto. | El script ya sube los imports relativos de forma recursiva y lee `verify_jwt` de `config.toml`; `--dry-run` (sin API) lo enseña: `stripe-webhook` → 2 ficheros, `verify_jwt false [config.toml]`. | Vía principal: **`npx supabase functions deploy <nombre>`**. El script, como alternativa si el CLI falla. |
| **B9** ✔ | **Resuelto 24/09** (hallado al probar en `opynio_prodlike`). En prod **no hay ninguna política SELECT sobre `review_media`** (local sí: «Public read review_media»). La API de Storage borra con `DELETE … WHERE … RETURNING *`, que solo alcanza filas visibles: `remove()` borraba **0 ficheros sin error** y la política de DELETE de `20260924120000` no servía. | `pg_policies` de prod; prueba en la copia: DELETE del autor = 0 filas. El código de la API de Storage (contenedor local v1.72.1) confirma el `RETURNING` en el borrado y que la subida **no** lo usa (las subidas sí funcionan). | Añadida a `20260924120000_reviews_author_delete.sql` la política «Users can read own review_media» (SELECT, solo la carpeta `<uid>/` propia). Probado: el autor borra lo suyo, otro usuario no. |
| **B10** ✔ | **Resuelto 24/09** (regla: no modificar URLs). El trigger de `20260923130000` hacía `btrim` de `slug`, `google_maps_url` y `logo_url` en **cualquier** UPDATE: un slug existente con espacios habría cambiado (y con él la URL) al editar cualquier otro campo de la empresa. | Hoy en prod 0 slugs con espacios, pero el trigger actuaría en cada edición futura. | En un UPDATE el trigger solo normaliza la columna que la sentencia cambia y las cadenas vacías (→ `NULL`); en INSERT genera slug solo si no trae. No toca `url_redirects`. Probado: slugs existentes (incluido uno con mayúsculas y otro con espacios) intactos tras editar la empresa; las 2 empresas sin slug siguen sin slug; alta nueva recibe slug con sufijo `_2` si choca. |

---

## 1. Foto de producción (24/09/2026, solo lectura)

### 1.1 Front y widget

- Front servido: build del **15/09/2026** (`last-modified` de
  `/assets/BusinessPage-cJWKfkKg.js`). **No coincide con master**: `widget.js`
  servido es **v6.5.5** y master tiene v6.5.4. **La única vuelta atrás posible del
  front es una copia descargada del servidor** (2.0.2): no se puede
  reconstruir desde git.
- Bundle desplegado revisado (30 chunks): solo contiene la anon key (JWT
  `role=anon`); ninguna `service_role`, `sb_secret_`, `sk_live_`/`sk_test_` ni
  clave `AIza…`.
- La rama sube el widget a **v6.10.5** (24/09, noche: `npm run check:widget` →
  «coincide en los cuatro sitios»: cabecera y `WIDGET_VERSION` de
  `public/widget.js`, `EMBED_VERSION` de `widgetShared.ts` y `WIDGET_VERSION` de
  `widget-proxy`; sintaxis de `public/widget.js` comprobada con `new Function`).

### 1.2 Migraciones

Las anteriores a la rama (abril → agosto) están aplicadas (comprobado por
muestreo: `uniq_review_per_user_business`, las RPC de `20260824*`,
`review_source_counts` y `businesses_without_reviews` de `20260825*`).

| Migración | En prod | Evidencia |
| --- | --- | --- |
| `20260915143000_add_logo_tone` | Sí | Columna `businesses.logo_tone` y `businesses_logo_tone_check`. |
| `20260915144500_directory_rpc_logo_tone` | Sí | `get_businesses_with_review_stats()` ya devuelve `logo_tone`. |
| `20260915150000_logo_tone_reset_trigger` | **Parcial** | `trg_reset_logo_tone` existe, pero la función es la **versión anterior** (compara `NEW.logo_tone` con `OLD.logo_tone`; no conoce `opynio.keep_logo_tone`). |
| `20260917120000_review_subjects` | No | `review_subjects` y `review_subject_links` no existen. **B1 (resuelto).** |
| `20260917121000_widget_subject_rpcs` | No | No existe ninguna de sus 4 funciones. |
| `20260923120000_fix_security_guards` | No | Guards de `profiles` y `businesses` siguen `SECURITY DEFINER`; no existen `guard_review_sensitive_columns`, `guard_request_status_on_insert` ni `guard_profile_extra_columns`; `reviews` no tiene **ningún** trigger. (`update_review_vote_counts` ya era `DEFINER`.) **B2 (resuelto).** |
| `20260923130000_businesses_empty_urls_and_slug` | No | No existen `opynio_slugify` ni `a_normalize_business_fields`. Hay 29 `google_maps_url = ''` y 1 `slug = ''`. En producción `google_maps_url` **no es UNIQUE** (el 409 no se da aquí); `slug` sí lo es, y `name` también (`businesses_name_key`). **B10 (resuelto).** |
| `20260923140000_storage_bucket_limits` | No | `review_media` y `business_logos` sin `file_size_limit` ni `allowed_mime_types`. |
| `20260923150000_widget_author_names` | No | No existen `widget_author_label` ni `widget_business_reviews`. |
| `20260923160000_security_extras` | No | No existen `guard_username`, `lock_business_owner`, `user_owns_business`, `opynio_is_admin`. `anon` puede ejecutar `refresh_business_metrics()` y `businesses_without_reviews()`. `business_stats` no existe (la migración ya lo contempla). Sus políticas nuevas se suman a las permisivas de prod: **B4 (lo cierra 3.18).** |
| `20260923170000_review_source_counts_total` | No | `review_source_counts` devuelve 3 columnas, sin `total`. |
| `20260923180000_avatars_bucket` | **Parcial** | El bucket `avatars` existe (público) pero sin límites, y con otras políticas (INSERT de cualquier autenticado en cualquier ruta). **B4 (lo cierra 3.18).** |
| `20260923190000_admin_list_users` | No | La función no existe. |
| `20260923200000_redirect_hits_rpc` | No | `increment_redirect_hits` no existe (el front desplegado ya la llama y falla en silencio). |
| `20260923210000_featured_order` | No | No existe la columna. |
| `20260923220000_fix_admin_rpcs` | No | `admin_update_user_role` sin categoría por defecto; `resolve_review_appeal(bigint, …)` (escribe `resolved_by`, que en prod existe). **B3 (resuelto).** |
| `20260924100000_review_subjects_code_privado` | No | Depende de `review_subjects`; `business_subject_codes` no existe. |
| `20260924120000_reviews_author_delete` | **Parcial** | «Users can delete their own reviews.» (`TO public`, misma condición) y «Allow authenticated delete on review_media» (misma condición que la nueva), pero **falta el SELECT** sin el que ese DELETE no alcanza ninguna fila: **B9 (resuelto en el fichero)**. |
| `20260924130000_block_owner_self_review` | No | Ni función ni trigger. |
| `20260924140000_invitation_quota` | No | No existen `invitation_sends` ni `reserve_invitation_quota`. La usa la versión nueva de `send-invitation-email`. |
| `20260924150000_drop_permissive_policies` | No (nueva) | Las 7 políticas que borra están hoy en prod. **B4.** |
| `20260924160000_own_review_edit_and_votes` | No | No existe `block_own_review_vote`. `review_votes` ya tiene `UNIQUE (review_id, user_id)` (`unique_review_user_vote`) y 0 votos: su paso 4 no hace nada. |
| `20260924180000_profile_name_sin_email` | No | No existe `profile_name_sin_email`. |
| `20260924190000_auto_approve_after_edit` | No (nueva) | `reviews.pending_since` no existe; `approve_old_pending_reviews()` cuenta desde `created_at` (`SECURITY INVOKER`, ejecutable por anon/authenticated); el cron `approve_pending_reviews_hourly` la llama cada hora (48 ejecuciones correctas en 2 días). 0 pendientes. |
| `20260924200000_close_user_email_leak` | No (nueva) | `search_assignable_users`, `get_admin_users_paginated` y `refresh_business_metrics` con `EXECUTE` para `PUBLIC`/`anon`/`authenticated`. Es el **paso 0-bis** hecho migración. |
| `20260924210000_review_subjects_slug_check` | No (nueva) | `review_subjects` no existe todavía; los 4.143 slugs de `carga.sql` cumplen el patrón. |
| `20260924230000_admin_save_featured` | No (nueva, de otro agente) | `admin_save_featured_businesses` no existe (sí la heredada `admin_set_featured_companies(uuid[])`, que no se toca). El front de la rama la llama al guardar `/admin/destacados` y, si no existe, vuelve a las escrituras sueltas. |
| `20260924240000_upgrade_keep_admin` | No (nueva) | Las dos sobrecargas de `upgrade_user_to_business_owner` ponen `business_owner` sin mirar el rol (un admin lo pierde). |
| `20260924250000_stats_sin_programadas` | No (nueva) | `business_review_stats` y `get_businesses_with_review_stats` cuentan las 25 reseñas aprobadas con fecha futura (22 empresas); `business_metrics` con 984 filas para 1.019 empresas y 617 cifras distintas de las reales. |
| `20260924260000_directory_relevance_order` | No (nueva, de otro agente) | No existen `directory_businesses(...)` ni `idx_reviews_approved_stats` (49.953 reseñas). El directorio de la rama la llama: **va antes del front nuevo**. |

### 1.3 Edge Functions

`GET /v1/projects/{ref}/functions` (solo lectura):

| Función | Prod hoy | Cambio en la rama | ¿Desplegar? |
| --- | --- | --- | --- |
| `widget-proxy` | v34 · `verify_jwt=false` · 24/08 | Autor vía RPC `widget_business_reviews`, widget de producto, `widget_version` = v6.10.5 | **Sí, después de 3.7 y de subir `widget.js`** (4.1). Sin esa RPC los widgets de los clientes se quedan **sin reseñas** (el error solo se registra) |
| `generate-sitemap` | v54 · **false** · 25/02 | Fichas de producto | Sí, `verify_jwt=false` (`config.toml`; B5) |
| `stripe-webhook` | v31 · false · 19/05 | Idempotencia (`processed_webhook_events`), alta en una transacción (`process_checkout_completion`, 31 parámetros: ya existe en prod), `Purchase` a Meta desde el servidor; nombre duplicado → «Nombre (2)»… (nunca un cobro sin empresa); con varias suscripciones solo la principal escribe el plan y `deleted` no baja a free si queda otra | **Paso 0** (urgente) |
| `monthly-rescrape-job` | v15 · **true** · 25/02 | `verify_jwt=false` (`config.toml`) y exige `Authorization: Bearer <CRON_SECRET>` (comparación en tiempo constante; sin secreto configurado, 401), CORS restringido | Sí. `CRON_SECRET` **existe** en los secretos de prod. Desplegarla no arregla el cron que la llama (roto desde oct-2025): 4.5, opcional |
| `meta-capi` | v1 · true · 19/05 | Lista blanca de eventos y hosts; **`Purchase` desde el cliente ya no se reenvía**: responde 200 `{"ok":true,"forwarded":false,"reason":"sent_server_side"}`. El `Purchase` lo manda `stripe-webhook` con el importe real y `event_id` = id de la sesión (Meta deduplica con el Pixel) | Sí (sección 4; el front actual no se entera: la llamada es *fire-and-forget*) |
| `create-checkout-session` | v25 · true · 19/05 | **v25 exige `priceId`: todos los pagos fallan desde el 19/05.** La del repo acepta `plan`/`billingCycle`, códigos de error estables, una sola suscripción por usuario (409 → portal), `business_name_taken` antes de cobrar, `price_unavailable`, idempotencia con huella | **Paso 0** (urgente) |
| `create-portal-session` | v21 · true · 06/05 | `return_url` → `/mis-negocios` (hoy `/empresa/panel/facturacion`, 404); códigos de error; `{ plan, billingCycle }` opcional → confirmación del cambio de plan con prorrateo | **Paso 0**, si apruebas el `return_url` |
| `get-checkout-status` | **No existe** | Nueva: `/pago-exitoso` confirma **esa** sesión de Checkout (del usuario, pagada y aplicada por el webhook) antes del Purchase | **Paso 0** (antes del front nuevo) |
| `send-invitation-email` | v5 · true · 25/02 | Escapa HTML, máx. 50 destinatarios, cuota diaria, plan mínimo `starter`, `productId` (lee `review_subjects`) | Sí, **después de 3.2 y 3.17** (`20260924140000`: `reserve_invitation_quota` e `invitation_sends`, que hoy no existen). Sin 3.17, cada envío falla |
| `send-support-email` | v27 · true | Escapa HTML; email del usuario autenticado | Sí |
| `repair-stripe-orphans` | v6 · true | CORS restringido | Sí |
| `admin-rescrape-google-reviews`, `approve-and-process-now`, `instant-full-scrape`, `process-scraping-queue`, `serpapi-proxy`, `start-scraping-search`, `trustindex-scraper` | true | `requireAdmin` + CORS restringido (`_shared/`) | Sí |
| `multi-source-reviews` | **No existe con ese nombre**: en prod está `multi-source-review` (singular, v12) | `requireAdmin` + CORS | Decidir: desplegarla crea una función **nueva** y la vieja sigue viva sin la comprobación de admin. El front no llama a ninguna de las dos. |
| `trustindex-proxy` | **No desplegada** | `requireAdmin` + CORS | Opcional: el front no la llama. |
| `auto-migrate-slugs`, `instant-process-urls` | v7 / v34 | No están en el repo | No tocar. |

`_shared/cors.ts` y `_shared/requireAdmin.ts` no se despliegan solos: el CLI los
empaqueta dentro de cada función que los importa.

Secretos en producción (solo nombres, releídos el 24/09 por la noche): están
todos los que usa el código (`CRON_SECRET`, `INTERNAL_SECRET`, `SERPAPI_KEY`,
`GEMINI_API_KEY`, `MAKE_WEBHOOK_URL`, `META_CAPI_TOKEN`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SIGNING_SECRET`, `SUPABASE_*`), salvo `SITE_URL`, que tiene
*fallback* a `https://web.opynio.com`. No hay que crear ninguno.

### 1.4 Auth

`GET /config/auth` (solo campos no secretos):

- `site_url` = `https://web.opynio.com`
- `uri_allow_list` = `https://web.opynio.com` — **solo esa URL exacta**. El
  front pide `redirectTo = https://web.opynio.com/<ruta de restablecer>` y
  Google vuelve a `…/post-acceso`: ninguna está permitida, así que Supabase cae
  a `site_url` y el enlace del email **abre la home en vez del formulario**.
- SMTP: `smtp.resend.com:587`, remitente `no-responder@auth.opynio.com`
  («Autenticación en Opynio.com»), contraseña configurada, 30 emails/h. La
  plantilla de recuperación usa `{{ .ConfirmationURL }}`.
- **«Recuperar contraseña» falla en producción** con `Error sending recovery
  email`: la configuración SMTP de Supabase está bien (releída el 24/09), así
  que el problema está en Resend (dominio `auth.opynio.com` sin verificar o API
  key revocada). Se revisa a mano en la sección 8.
- No he podido leer los logs de Auth por API (el endpoint cambió). Revísalos a
  mano (sección 8).

---

## 2. Preparación y copia de seguridad

### 2.0.1 Antes del día

1. ~~Resolver **B1, B2 y B3** en los ficheros de migración y repetir las pruebas
   en local con `reviews.id bigint`.~~ **Hecho el 24/09** (B1–B4, B9, B10), con
   las pruebas sobre la copia del esquema de prod (3.0). Si alguien toca otra
   migración antes del día, repetir 3.0 (tres comandos).
2. Esperar a que terminen los cambios en curso (5.1) y pasar `npm run verify`
   (24/09 por la noche: **pasa**, exit 0 — «Sin errores de tipos nuevos», widget
   v6.10.5 en los cuatro sitios, rutas de locales sincronizadas). Repetirlo el
   día del build.
3. **Commit**: antes de cualquier `git commit`/`push` y antes de subir `dist/`,
   ejecutar el skill **`pre-commit-secret-scan`**.
4. `.env` que usa el build (`npx vite build` sin `--mode` = modo `production`:
   lee `.env`, `.env.local`, `.env.production`, `.env.production.local`; hoy solo
   existe `.env`). **Nombres** que tiene el 24/09 (valores no mostrados):
   - `VITE_SUPABASE_URL` (proyecto `hvtrrhxeqrsnjxhngdsj`),
     `VITE_SUPABASE_ANON_KEY` (JWT `role=anon`) y `VITE_STRIPE_PUBLISHABLE_KEY`
     (`pk_live_…`): públicas por diseño. **Ninguna `VITE_*` secreta.**
   - `GEMINI_API_KEY` y `SUPABASE_PAT`: **sin** prefijo `VITE_`, así que Vite
     no las mete en el bundle (`vite.config.ts` no cambia `envPrefix` ni usa
     `define`). Aun así `SUPABASE_PAT` es un token con acceso total a la cuenta:
     no copiar `.env` a ningún sitio y no renombrarlas nunca a `VITE_*`.
   - **Nunca** `VITE_SUPABASE_SERVICE_ROLE_KEY`: el `.env.example` de master la
     proponía; la rama la corrige a `SUPABASE_SERVICE_ROLE_KEY`, sin prefijo.
   - `VITE_GEMINI_API_KEY`: **ya no la lee nadie** (corregido el 24/09, noche).
     `services/geminiService.ts` fija `AI_ENABLED = false` en el código, no crea
     ningún cliente de Gemini en el navegador y no lee ninguna clave
     (`grep VITE_GEMINI` en `*.ts/*.tsx`: solo comentarios). Las funciones de IA
     del navegador quedan ocultas hasta que se hagan por Edge Function con
     `GEMINI_API_KEY` (secret de Supabase, ya existe). Aun así, no definir
     ninguna `VITE_*` con una clave: todo `VITE_*` que el código lea acaba en el
     bundle público.
   - Nada de `--mode docker` (usa `.env.docker.local`, apunta a Supabase local).
     Ojo: el plugin `guard-docker-env` de `vite.config.ts` **solo actúa en modo
     docker** (para que el Docker no apunte a prod); en el build normal no
     comprueba nada. La comprobación de que el bundle apunta a producción está
     en 5.2.

### 2.0.2 Copia de seguridad (el mismo día, antes de la sección 3)

Guárdalo **fuera del repo** o en `scripts/_backup/` (los `scripts/_*` están en
`.gitignore`): contiene datos personales.

1. **Base de datos**: Dashboard → Database → Backups: confirmar que hay copia
   de hoy (o PITR). Además, un volcado propio:

   ```powershell
   npx supabase login                                   # abre el navegador; no pegues tokens en el chat
   npx supabase link --project-ref hvtrrhxeqrsnjxhngdsj
   npx supabase db dump --linked -f scripts\_backup\2026-09-24-schema.sql
   npx supabase db dump --linked --data-only --schema public -f scripts\_backup\2026-09-24-public-data.sql
   ```

2. **Definiciones que se van a cambiar** (para deshacer paso a paso). En el SQL
   Editor, guarda el resultado de:

   ```sql
   SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args, pg_get_functiondef(p.oid) AS def
   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname IN (
     'reset_logo_tone_on_logo_change','guard_profile_sensitive_columns','guard_business_sensitive_columns',
     'update_review_vote_counts','review_source_counts','admin_update_user_role','resolve_review_appeal');

   SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
   FROM pg_policies
   WHERE (schemaname = 'public' AND tablename IN ('profiles','reviews','review_votes','review_appeals'))
      OR (schemaname = 'storage' AND tablename = 'objects');

   SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets;
   ```

3. **Edge Functions desplegadas** (única forma de volver a la versión actual):
   descargar su código en una carpeta **fuera del repo**, para no pisar
   `supabase/functions/`:

   ```powershell
   $ref = 'hvtrrhxeqrsnjxhngdsj'
   $bk  = 'C:\opynio-backup\funciones-2026-09-24'
   New-Item -ItemType Directory -Force $bk | Out-Null
   npx supabase init --workdir $bk
   foreach ($f in 'widget-proxy','generate-sitemap','stripe-webhook','monthly-rescrape-job','meta-capi',
                  'create-checkout-session','create-portal-session','send-invitation-email','send-support-email',
                  'repair-stripe-orphans','admin-rescrape-google-reviews','approve-and-process-now',
                  'instant-full-scrape','process-scraping-queue','serpapi-proxy','start-scraping-search',
                  'trustindex-scraper') {
     npx supabase functions download $f --project-ref $ref --workdir $bk
   }
   git -C C:\Proyectos\Opynio status --short supabase/functions   # debe seguir igual que antes
   ```

   Las tres de pagos ya están además en `scripts/_backup-prod-functions/`
   (paso 0). Si el paso 0 ya se hizo, lo que se descarga aquí de esas tres es
   la versión nueva: da igual, su vuelta atrás es la de P.4.

4. **Web** (la única vuelta atrás posible del front, 1.1): con FileZilla,
   descargar la raíz publicada de `web.opynio.com` **entera** (`index.html`,
   `assets/`, `widget.js`, `sitemap.xml`, `robots.txt`, iconos…) a
   `C:\opynio-backup\web-2026-09-24\`. Comprobar que la copia tiene
   `widget.js` v6.5.5 y el mismo número de ficheros que el servidor.

---

## 3. Migraciones SQL

**Dónde**: Dashboard → SQL Editor, **un fichero por ejecución**, pegando el
fichero **entero**, en el orden de la lista. Tras cada uno, su comprobación. Si
algo falla, **parar**: cada fichero es atómico (o `BEGIN/COMMIT` o una sola
petición), así que un error no deja nada a medias. Todos son **idempotentes**:
si hay que repetir uno, se puede (probado con una segunda pasada completa).

**Frontend**: 3.1–3.18 son compatibles con el front que hay hoy en producción
(comprobado contra su bundle: no usa `review_subjects`, no escribe
`status`/`source` en reseñas salvo `pending`, no sube nada a Storage; sus votos
son `upsert` sobre el voto propio y siguen permitidos). 3.19–3.21 las añadieron
otros agentes el 24/09: 3.20 solo actúa en el alta de perfiles y 3.21 solo en la
aprobación automática; 3.19 cambia el comportamiento (editar una reseña aprobada
la devuelve a `pending`; votar la propia da `OPY02`) y **no la he contrastado
con el bundle desplegado**. Todas van **antes** del front nuevo, que las
necesita; la única que se deja para después del front es **`code_privado`**
(6.1). **El front nuevo no se sube sin 3.11 (`admin_list_users`), 3.13
(`featured_order`) y 3.26 (`directory_businesses`)**: el panel de admin, la
home y el directorio las llaman (ver 5.3.3).

> **Políticas en `storage.objects` (3.8, 3.10, 3.15, 3.18)**: no hace falta ser
> dueño de la tabla. Producción tiene `supautils.policy_grants` con
> `"postgres": [… "storage.objects" …]` (leído de `pg_settings`), igual que el
> Docker local; en la copia de prod, con `storage.objects` propiedad de
> `supabase_storage_admin` como allí, `postgres` las creó sin error. Si aun así
> el editor respondiera `must be owner of table objects`, crearlas desde
> Dashboard → Storage → Policies con la misma condición.

### 3.0 Ensayo hecho: las 22 migraciones sobre una copia del esquema de producción

El 24/09 se creó en el Docker local la base **`opynio_prodlike`** (aparte de la
`postgres` de la app) con el esquema de producción leído **solo del catálogo**
(`SELECT` por la Management API): todo `public` (tablas con sus tipos exactos,
identity, constraints, índices, funciones —incluidas `handle_new_user` y
`approve_old_pending_reviews`—, triggers, RLS, políticas, grants y owners),
`auth.users` con su trigger de alta, y `storage.buckets/objects` con sus
funciones, triggers, políticas y dueño (`supabase_storage_admin`), más los
`ALTER DEFAULT PRIVILEGES`. `verify-fidelity.cjs` la compara con producción:
**sin diferencias** en columnas, constraints, índices, políticas (83),
funciones (64, md5 de la definición), triggers y ACL. Datos mínimos con la forma
de prod (ids de reseña ~129700, 4 buckets sin límites, slug vacío, empresa sin
slug, una redirección, una pendiente de hace 25 h).

Resultado, aplicando cada fichero como una sola petición y como `postgres`
(igual que el SQL Editor):

- **Ficheros originales**: fallan `20260917120000` (B1), `20260923120000` (B2)
  y, en cadena, `20260917121000`, `20260923150000` y `20260924100000`.
- **Ficheros corregidos**: **22/22 OK**, en el orden de los ficheros y también en
  el del runbook (`code_privado` al final). Segunda pasada completa: 22/22 OK
  (idempotentes). `20260924150000` aplicada antes de tiempo aborta con un
  mensaje claro.
- **74/74 pruebas de roles OK** (conexión como `authenticator`, rol y JWT
  simulados como PostgREST, cada caso con `ROLLBACK`): reseña nueva queda
  `pending`/`opynio`; el autor edita (vuelve a `pending`), borra la suya y no
  puede aprobarse; el dueño no se reseña (`OPY01`); enlace reseña→producto por
  la dueña y por el autor (no la de otro, no entre empresas; plan free sin
  productos); admin cambia roles, el usuario no se hace admin ni cambia
  `username`; `widget_business_reviews`/`widget_subject_reviews` con autor;
  `admin_list_users` solo admin; `business_subject_codes` solo dueña/admin y
  `code` ilegible para anon/authenticated; votos solo propios y nunca sobre la
  reseña propia (tampoco moviendo el voto); apelaciones: la propia y rechazada,
  entra `pending`, no se ve ni se aprueba la de otro, el admin la resuelve con id
  `bigint`; Storage: avatar solo en `avatars/<uid>/`, imágenes solo en
  `business_logos/productos/<empresa propia>/` (otro `business_owner` ya no
  puede), no se puede mover un fichero propio a otra ruta, el autor borra su
  `review_media` y no la de otro; URLs: ningún slug existente cambia,
  `url_redirects` intacta; alta de usuario (email, Google con el email como
  nombre, «@@@», alta de respaldo desde el cliente) con el `handle_new_user` de
  prod; aprobación automática: una reseña de hace 3 días editada ahora **no** se
  aprueba, una pendiente de hace 25 h sí, el cliente no puede adelantar
  `pending_since` y votar una pendiente no la retrasa.

Repetirlo (p. ej. si alguien toca o añade una migración antes del día). Las
herramientas están en `scripts/_prodlike/` (ignorado por git; README dentro):

```bash
cd scripts/_prodlike
export MSYS_NO_PATHCONV=1                 # Git Bash en Windows
bash rebuild.sh --regen                   # relee el catálogo de prod (solo SELECT) y rehace opynio_prodlike
node verify-fidelity.cjs                  # FIDELIDAD OK
(cd ../../supabase/migrations && ls 20260915150000_*.sql 2026091712*.sql 202609[2]*.sql | sort > ../../scripts/_prodlike/orden.txt)
(cd ../../supabase/migrations && bash ../../scripts/_prodlike/apply-migrations.sh $(cat ../../scripts/_prodlike/orden.txt))
node test-roles.cjs                       # 74 OK, 0 fallos
node test-seguridad-0924.cjs fuga slug upgrade stats resena destacadas   # 48 OK, 0 fallos
```

La base `opynio_prodlike` se ha dejado creada. Borrarla:
`docker exec supabase_db_Opynio psql -U postgres -d postgres -c "DROP DATABASE opynio_prodlike WITH (FORCE)"`.

### Lista final (pegar en este orden)

| Paso | Fichero | Comprobación rápida tras ejecutarlo |
| --- | --- | --- |
| 3.1 | `20260915150000_logo_tone_reset_trigger.sql` | `keep_logo_tone` en la función → `true` |
| 3.2 | `20260917120000_review_subjects.sql` | `review_subject_links.review_id` = `bigint`, 8 políticas, 2 triggers |
| 3.3 | `20260917121000_widget_subject_rpcs.sql` | 4 funciones |
| 3.4 | `20260923120000_fix_security_guards.sql` | 5 guards con `prosecdef = false`, 4 triggers nuevos |
| 3.5 | `20260923130000_businesses_empty_urls_and_slug.sql` | 0 vacías; huella de slugs y de `url_redirects` igual que antes |
| 3.6 | `20260923140000_storage_bucket_limits.sql` | límites en `review_media` y `business_logos` |
| 3.7 | `20260923150000_widget_author_names.sql` | `widget_author_label(NULL,'Ana María López')` = `Ana M.` |
| 3.8 | `20260923160000_security_extras.sql` | anon sin `refresh_business_metrics`; 2 triggers |
| 3.9 | `20260923170000_review_source_counts_total.sql` | 4 columnas con `total` |
| 3.10 | `20260923180000_avatars_bucket.sql` | `avatars` con 2 MB y 3 tipos; 4 políticas |
| 3.11 | `20260923190000_admin_list_users.sql` | anon sin `EXECUTE` (**la necesita el front nuevo**) |
| 3.12 | `20260923200000_redirect_hits_rpc.sql` | la función existe |
| 3.13 | `20260923210000_featured_order.sql` | la columna existe (**la necesita el front nuevo**) |
| 3.14 | `20260923220000_fix_admin_rpcs.sql` | una sola `resolve_review_appeal(bigint, text, text)` |
| 3.15 | `20260924120000_reviews_author_delete.sql` | DELETE de reseñas `{authenticated}`; SELECT propio en `review_media` |
| 3.16 | `20260924130000_block_owner_self_review.sql` | trigger existe |
| 3.17 | `20260924140000_invitation_quota.sql` | tabla existe; `authenticated` sin `EXECUTE` |
| 3.18 | `20260924150000_drop_permissive_policies.sql` | 0 de las 7 políticas permisivas |
| 3.19 | `20260924160000_own_review_edit_and_votes.sql` | trigger de votos; UPDATE de reseñas del autor |
| 3.20 | `20260924180000_profile_name_sin_email.sql` | trigger existe |
| 3.21 | `20260924190000_auto_approve_after_edit.sql` | `pending_since` con default `now()`; la función usa `pending_since` |
| 3.22 | `20260924200000_close_user_email_leak.sql` | (= paso 0-bis) las 3 funciones sin `EXECUTE` para anon/authenticated |
| 3.23 | `20260924210000_review_subjects_slug_check.sql` | `review_subjects_slug_check` validada (`convalidated = true`) |
| 3.23b | `20260924230000_admin_save_featured.sql` | `admin_save_featured_businesses(uuid[])` existe; anon sin `EXECUTE` |
| 3.24 | `20260924240000_upgrade_keep_admin.sql` | 2 sobrecargas con `IS DISTINCT FROM 'admin'`, misma ACL |
| 3.25 | `20260924250000_stats_sin_programadas.sql` | 2 funciones con `created_at <= now()`; 3 RPC de `business_metrics` sin anon |
| 3.26 | `20260924260000_directory_relevance_order.sql` | `directory_businesses` existe (anon con `EXECUTE`); índice `idx_reviews_approved_stats` (**la necesita el front nuevo**) |
| 3.27 | `20260924270000_subject_rating_distribution.sql` | `subject_review_stats(uuid, uuid)` existe (anon/authenticated con `EXECUTE`). Requiere las tablas de productos (3.3/3.4). **La necesita el front nuevo** (distribución de valoraciones por producto en la ficha) |
| 3.28 | `20260925100000_profile_preferences.sql` | 3 columnas nuevas en `profiles` (`preferred_language`, `preferred_country`, `theme`) y 3 CHECK validados (`SELECT count(*) FROM pg_constraint WHERE conrelid='public.profiles'::regclass AND conname IN ('profiles_preferred_language_check','profiles_preferred_country_check','profiles_theme_check') AND convalidated` → 3). Requiere 3.4 (con el guard pristino de prod, SECURITY DEFINER, un usuario sigue pudiendo cambiarse `role`: fallo previo que arregla 3.4). El front nuevo la usa para **guardar** idioma/país/tema en Editar perfil; sin ella solo se aplican en ese navegador y avisa. Compatible con el front actual. Probada en local, `opynio_prodlike` y `opynio_prodlike_e0924b` (dos pasadas; propio sí, ajeno/anon 0 filas, CHECK y guard de `role`/`plan` OK) |
| 3.29 | `20260925110000_support_tickets.sql` | Tablas `support_tickets` y `support_ticket_messages` con RLS (4 políticas), 3 triggers y 4 RPC (`create_support_ticket`, `support_ticket_set_status`, `admin_list_support_tickets`, `admin_support_ticket_counts`; anon sin `EXECUTE`): `SELECT count(*) FROM pg_policy WHERE polrelid IN ('public.support_tickets'::regclass,'public.support_ticket_messages'::regclass)` → 4. Añade `public.notifications` a la publicación `supabase_realtime` si existe y no estaba (si no hay permiso, NOTICE y sigue): comprobar con `SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='notifications'`. Requiere 3.8 (`opynio_is_admin`, `user_owns_business`). **La necesita el front nuevo** (pestaña «Abrir una solicitud» de Soporte, «Mis solicitudes» del perfil y `/admin/soporte`; sin ella fallan al abrirlas). Opcional: redesplegar `send-support-email` (acepta `formType: 'ticket'`, aviso al equipo; sin él el ticket se guarda igual y el aviso da 400 silencioso). Probada en local y en una copia de `opynio_prodlike` con todas las migraciones anteriores (`scripts/_prodlike/test-soporte.cjs`: 31 OK) |
| 6.1 | `20260924100000_review_subjects_code_privado.sql` | (después del front) `code` solo `postgres`/`service_role` |

3.19 y 3.21 van **seguidas**, en un solo bloque **3.19 → 3.20 → 3.21 sin
pausa**: con 3.19 sola, una reseña antigua editada vuelve a `pending` y el cron
de cada hora (`approve_pending_reviews_hourly`, a en punto) la aprobaría sin
revisión. 3.20 (perfiles) es independiente y va en medio porque es el orden de
fichero con el que se probó todo en 3.0. Empieza el bloque justo después de una
hora en punto (p. ej. a las hh:05) para que el siguiente pase del cron ya
encuentre 3.21. Si aparece una migración nueva antes del día, va al final
(orden de fichero) y se repite 3.0.

Comprobado el 24/09 por la noche: la lista incluye `20260924140000` (3.17),
`20260924150000` (3.18), `20260924160000` (3.19), `20260924180000` (3.20) y
`20260924190000` (3.21), y a esa hora son todos los ficheros con fecha de
`supabase/migrations/` desde `20260915150000` (22, con `code_privado`).
**Añadidas el 24/09 (noche): 3.22–3.25** (`20260924200000`, `20260924210000`,
`20260924240000`, `20260924250000`), en orden de fichero después de 3.21. No
dependen de 3.19–3.21; 3.23 necesita 3.2 (aborta con mensaje si falta) y 3.25
necesita `20260915144500` (ya en prod). El hotfix 0-bis no depende de ninguna:
va antes que todo, y 3.22 lo repite sin efecto. Ensayo: ver «Ensayo con
0-bis y 3.22–3.25» más abajo.
**Añadida después (24/09, noche): 3.23b** (`20260924230000_admin_save_featured`,
de otro agente), en su orden de fichero entre 3.23 y 3.24. Necesita 3.13
(`featured_order`): creada antes, la función se crea igual (plpgsql no revisa
columnas al crearla) pero falla al llamarla. No depende de 3.22–3.25.
**Y 3.26** (`20260924260000_directory_relevance_order`, de otro agente,
creada a las 22:51 UTC): la última en orden de fichero; el directorio del front
nuevo la llama, así que va antes de la sección 5.
Recuento el 24/09 a las 22:55 (UTC): **28 ficheros** con fecha desde
`20260915150000` (27 en la sección 3 + `code_privado` en 6.1).
Muestreo en prod: ninguna aplicada todavía (`review_subjects`,
`invitation_sends`, `reviews.pending_since`, `featured_order`,
`admin_list_users`, `widget_business_reviews`: no existen).

### 3.1 `20260915150000_logo_tone_reset_trigger.sql` (reaplicar)

- Verificación: `SELECT position('opynio.keep_logo_tone' in prosrc) > 0 AS ok FROM pg_proc WHERE proname = 'reset_logo_tone_on_logo_change';` → `true`.
- Vuelta atrás: recrear la función con el cuerpo guardado en 2.0.2.

### 3.2 `20260917120000_review_subjects.sql` (B1 resuelto)

Da un `NOTICE: type reference public.reviews.id%TYPE converted to bigint`: es lo esperado.

- Verificación:
  ```sql
  SELECT to_regclass('public.review_subjects') IS NOT NULL AS subjects,
         (SELECT format_type(atttypid, atttypmod) FROM pg_attribute
           WHERE attrelid = 'public.review_subject_links'::regclass AND attname = 'review_id') AS review_id,   -- bigint
         (SELECT count(*) FROM pg_policies WHERE tablename IN ('review_subjects','review_subject_links')) AS politicas, -- 8
         (SELECT count(*) FROM pg_trigger WHERE tgname IN ('trg_review_subject_link_same_business','trg_enforce_product_limit')) AS triggers, -- 2
         to_regprocedure('public.is_review_author(bigint)') IS NOT NULL AS autor_bigint;                    -- true
  ```
- Vuelta atrás: `DROP TABLE public.review_subject_links; DROP TABLE public.review_subjects; DROP FUNCTION public.review_subject_link_same_business(), public.enforce_product_limit(), public.is_review_author(bigint);` — `reviews` no se toca.

### 3.3 `20260917121000_widget_subject_rpcs.sql`

- Verificación: `SELECT count(*) FROM pg_proc WHERE proname IN ('widget_subject_stats','widget_subject_reviews','business_subject_stats','business_unassigned_review_count');` → 4.
- Vuelta atrás: `DROP FUNCTION` de las cuatro.

### 3.4 `20260923120000_fix_security_guards.sql` (B2 resuelto)

Ya no lleva SQL suelto detrás: la política `ALL` de apelaciones se quita en 3.18.

- Verificación:
  ```sql
  SELECT proname, prosecdef FROM pg_proc
  WHERE proname IN ('guard_profile_sensitive_columns','guard_profile_extra_columns','guard_business_sensitive_columns',
                    'guard_review_sensitive_columns','guard_request_status_on_insert') ORDER BY 1;   -- 5 filas, prosecdef = false
  SELECT tgname FROM pg_trigger
  WHERE tgname IN ('trg_guard_profile_extra_columns','trg_guard_review_sensitive_columns','trg_guard_claims_insert',
                   'trg_guard_review_appeals_insert','trg_guard_business_claims_insert');  -- 4 (el de business_claims no: en prod no existe la tabla)
  SELECT policyname, cmd FROM pg_policies WHERE tablename = 'review_appeals' ORDER BY 1;
  -- hasta 3.18: la de admin (ALL), «Los usuarios pueden crear y ver sus apelaciones» (ALL) y «Users can create appeals» (INSERT)
  ```
- Prueba funcional (tras desplegar el front): con una cuenta normal, escribir una reseña → queda `pending` y `source = 'opynio'`.
- Vuelta atrás: restaurar `guard_profile_sensitive_columns` y `guard_business_sensitive_columns` desde 2.0.2; `DROP TRIGGER` de los cuatro nuevos y `DROP FUNCTION` de `guard_profile_extra_columns`, `guard_review_sensitive_columns`, `guard_request_status_on_insert`; restaurar las políticas de `review_appeals`. **Deshacerlo reabre los agujeros** (usuario que se hace admin, reseñas autoaprobadas): mejor arreglar hacia delante.

### 3.5 `20260923130000_businesses_empty_urls_and_slug.sql` (toca datos: ~30 filas)

Regla: **no cambia ninguna URL**. Solo pasa a `NULL` cadenas vacías (29
`google_maps_url` y 1 `slug`); el trigger, en un UPDATE, solo normaliza la
columna que se edita y las vacías (B10), y en un INSERT genera slug si no trae.
No toca `url_redirects`.

- **Antes** de ejecutarla, guardar la huella (y repetirla después: debe salir igual):
  ```sql
  SELECT md5(string_agg(id::text || '=' || slug, ',' ORDER BY id)) AS slugs
  FROM public.businesses WHERE btrim(slug) <> '';
  SELECT count(*) AS redirecciones, md5(string_agg(old_slug || '>' || business_id, ',' ORDER BY old_slug)) AS huella
  FROM public.url_redirects;
  ```
- Verificación:
  ```sql
  SELECT count(*) FILTER (WHERE btrim(google_maps_url) = '') AS gmaps_vacias,   -- 0
         count(*) FILTER (WHERE btrim(slug) = '')            AS slug_vacios,     -- 0
         count(*) FILTER (WHERE slug IS NULL)                AS slug_null        -- 2 (se arreglan en 7.1)
  FROM public.businesses;
  SELECT tgname FROM pg_trigger WHERE tgname = 'a_normalize_business_fields';     -- 1 fila
  ```
- Vuelta atrás: `DROP TRIGGER a_normalize_business_fields ON public.businesses; DROP FUNCTION public.normalize_business_fields(), public.opynio_slugify(text);`. Los `''` → `NULL` son equivalentes para la app; si hiciera falta, están en el volcado.

### 3.6 `20260923140000_storage_bucket_limits.sql`

- Verificación: `SELECT id, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id IN ('review_media','business_logos');` → 15 MB / 5 MB y listas de tipos.
- Vuelta atrás: `UPDATE storage.buckets SET file_size_limit = NULL, allowed_mime_types = NULL WHERE id IN ('review_media','business_logos');`

### 3.7 `20260923150000_widget_author_names.sql` (antes de desplegar `widget-proxy`)

- Verificación:
  ```sql
  SELECT public.widget_author_label(NULL, 'Ana María López');                                        -- 'Ana M.'
  SELECT count(*) FROM public.widget_business_reviews('b94183fd-ba33-449d-8f00-4741b57adfc9'::uuid, 5); -- 5
  ```
- Vuelta atrás (solo si `widget-proxy` sigue en la versión vieja): `DROP FUNCTION public.widget_business_reviews(uuid, int), public.widget_author_label(text, text);` y recrear `widget_subject_reviews` desde 3.3.

### 3.8 `20260923160000_security_extras.sql`

Ya no lleva SQL suelto detrás: las políticas viejas de votos y logos se quitan en 3.18.

- Verificación:
  ```sql
  SELECT has_function_privilege('anon', 'public.refresh_business_metrics()', 'EXECUTE');    -- false
  SELECT count(*) FROM pg_trigger WHERE tgname IN ('trg_guard_username','a_lock_business_owner');  -- 2
  SELECT policyname FROM pg_policies WHERE tablename = 'review_votes' AND cmd = 'INSERT';
  -- hasta 3.18: «…insert their own votes» (nueva) y «Authenticated users can insert votes» (vieja)
  ```
- Vuelta atrás: `DROP TRIGGER`/`DROP FUNCTION` de `guard_username` y `lock_business_owner`; restaurar políticas y permisos desde 2.0.2.

### 3.9 `20260923170000_review_source_counts_total.sql`

- Verificación: `SELECT * FROM public.review_source_counts('b94183fd-ba33-449d-8f00-4741b57adfc9');` → 4 columnas; `total` ≥ `opynio + google + trustindex`.
- Vuelta atrás: recrear la versión de 3 columnas de `20260825120000_source_counts_and_empty_businesses.sql` (el front nuevo tolera la ausencia de `total`).

### 3.10 `20260923180000_avatars_bucket.sql`

Ya no lleva SQL suelto detrás: «Authenticated users can upload avatars» y
«Users can update their own avatar» se quitan en 3.18.

- Verificación: `SELECT file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'avatars';` → 2097152 y 3 tipos; `SELECT count(*) FROM pg_policies WHERE policyname IN ('Public read avatars','Users upload own avatar','Users update own avatar','Users delete own avatar');` → 4.
- Vuelta atrás: `DROP POLICY` de las 4 nuevas y `UPDATE storage.buckets SET file_size_limit = NULL, allowed_mime_types = NULL WHERE id = 'avatars';`

### 3.11 `20260923190000_admin_list_users.sql` (necesaria antes del front nuevo)

`/admin/usuarios` del front nuevo la llama; sin ella la lista sale vacía.

- Verificación: `SELECT has_function_privilege('anon', 'public.admin_list_users(text,text,int,int)', 'EXECUTE');` → false.
- Vuelta atrás: `DROP FUNCTION public.admin_list_users(text, text, int, int);`

### 3.12 `20260923200000_redirect_hits_rpc.sql`

Solo suma `hits`; no cambia `old_slug` ni `business_id` (probado).

- Verificación: `SELECT to_regprocedure('public.increment_redirect_hits(text)') IS NOT NULL;` → true.
- Vuelta atrás: `DROP FUNCTION public.increment_redirect_hits(text);`

### 3.13 `20260923210000_featured_order.sql` (necesaria antes del front nuevo)

La home y `/admin/destacados` del front nuevo leen y escriben `featured_order`.

- Verificación: `SELECT column_name FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'featured_order';` → 1 fila.
- Vuelta atrás (solo si aún no se ha usado): `DROP INDEX public.idx_businesses_featured_order; ALTER TABLE public.businesses DROP COLUMN featured_order;`

### 3.14 `20260923220000_fix_admin_rpcs.sql` (B3 resuelto)

- Verificación:
  ```sql
  SELECT oid::regprocedure FROM pg_proc WHERE proname = 'resolve_review_appeal';          -- una sola: resolve_review_appeal(bigint,text,text)
  SELECT position('resolved_by' in prosrc) > 0 FROM pg_proc WHERE proname = 'resolve_review_appeal';  -- true
  SELECT position('Sectores Emergentes' in prosrc) > 0 FROM pg_proc WHERE proname = 'admin_update_user_role';  -- true
  ```
- Vuelta atrás: recrear ambas desde 2.0.2.

### 3.15 `20260924120000_reviews_author_delete.sql` (con B9)

Unifica el nombre de la política de DELETE de reseñas y **añade el SELECT de la
carpeta propia en `review_media`**, sin el que el autor no puede borrar sus
fotos (B9).

- Verificación:
  ```sql
  SELECT policyname, roles FROM pg_policies WHERE tablename = 'reviews' AND cmd = 'DELETE';  -- «Users can delete their own reviews.» {authenticated}
  SELECT policyname, cmd FROM pg_policies
  WHERE policyname IN ('Users can delete own review_media','Users can read own review_media');  -- DELETE y SELECT
  ```
- Vuelta atrás: `DROP POLICY "Users can delete own review_media" ON storage.objects; DROP POLICY "Users can read own review_media" ON storage.objects;` (la antigua de DELETE sigue ahí).

### 3.16 `20260924130000_block_owner_self_review.sql`

- Verificación: `SELECT tgname FROM pg_trigger WHERE tgname = 'trg_reviews_block_owner_self_review';` → 1 fila. Prueba funcional tras el front: un dueño intenta reseñar su empresa → mensaje `businessPage.cannotReviewOwnBusiness`.
- Vuelta atrás: `DROP TRIGGER IF EXISTS trg_reviews_block_owner_self_review ON public.reviews; DROP FUNCTION IF EXISTS public.block_owner_self_review();`

### 3.17 `20260924140000_invitation_quota.sql` (antes de desplegar `send-invitation-email`)

La versión nueva de `send-invitation-email` llama a `reserve_invitation_quota`
(y lee `review_subjects`, de 3.2). Si la función se despliega sin esta
migración, **cada envío de invitaciones falla**: no desplegarla antes (4.2).

- Verificación:
  ```sql
  SELECT to_regclass('public.invitation_sends') IS NOT NULL AS tabla,                                      -- true
         has_function_privilege('authenticated', 'public.reserve_invitation_quota(uuid,uuid,integer,integer)', 'EXECUTE') AS auth_ejecuta,  -- false
         has_table_privilege('authenticated', 'public.invitation_sends', 'SELECT') AS auth_lee;             -- false
  ```
- Vuelta atrás: `DROP FUNCTION IF EXISTS public.reserve_invitation_quota(uuid, uuid, integer, integer); DROP TABLE IF EXISTS public.invitation_sends;` (y la versión anterior de `send-invitation-email`).

### 3.18 `20260924150000_drop_permissive_policies.sql` (B4, nueva)

Requiere 3.4, 3.8 y 3.10 (lo comprueba y, si faltan, aborta sin tocar nada).
Borra las 7 políticas permisivas de prod y deja: UPDATE de votos con la misma
regla que el INSERT, SELECT de las apelaciones propias y UPDATE de imágenes de
producto solo en `productos/<empresa propia>/`.

- Verificación:
  ```sql
  SELECT count(*) FROM pg_policies WHERE policyname IN (
    'Authenticated users can insert votes','Users can update own votes',
    'Los usuarios pueden crear y ver sus apelaciones','Business owners can upload logos',
    'Authenticated users can upload avatars','Business owners can update their own logo',
    'Users can update their own avatar');                                                        -- 0
  SELECT tablename, cmd, policyname FROM pg_policies
  WHERE tablename IN ('review_votes','review_appeals')
     OR (schemaname = 'storage' AND tablename = 'objects' AND cmd IN ('INSERT','UPDATE'))
  ORDER BY 1, 2, 3;
  -- review_votes INSERT: solo «Authenticated users can insert their own votes»; UPDATE: solo «Users can update their own votes»
  -- review_appeals: admin (ALL), «Users can create appeals» (INSERT), «Users can view own appeals» (SELECT)
  -- objects INSERT: review_media y avatars por carpeta, «Authenticated users can upload logos», bucket reviews (legado)
  -- objects UPDATE: review_media y avatars por carpeta, «Owners can update own business images»
  ```
- Vuelta atrás: recrear las políticas borradas con la definición guardada en 2.0.2 (reabre los agujeros; mejor arreglar hacia delante) y `DROP POLICY` de las tres creadas.

### 3.19 `20260924160000_own_review_edit_and_votes.sql` (de otro agente)

El autor edita su reseña (aprobada → `pending`) y nadie vota la propia ni mueve
un voto (`OPY02`/`OPY03`). Prod ya tiene `unique_review_user_vote`
(`UNIQUE (review_id, user_id)`) y **0 votos** (0 duplicados): su paso 4 no hace
nada. Redefine `guard_review_sensitive_columns` de 3.4. **Seguir con 3.20 y
3.21 sin pausa** (ver la nota de la lista).

**Cambiado el 24/09 (noche):** el `WITH CHECK` de la política del autor pasa de
`status = 'pending'` a `status IN ('pending','approved')`. Con el anterior, un
`UPDATE` **sin cambios** de una reseña aprobada propia (abrir la edición y
guardar tal cual) fallaba con «new row violates row-level security policy». El
guard sigue mandando: probado en `opynio_prodlike` y en local (ids `uuid`) que
el autor que edita una aprobada la devuelve a `pending`; que no puede poner
`approved` en una pendiente (ni solo, ni junto a una edición: error del guard);
que reenviar `status = 'approved'` al editar una aprobada la deja en `pending`;
que guardar sin cambios no da error y sigue `approved`; que no edita la ajena
ni la rechazada propia (0 filas); y, con el trigger del guard desactivado, el
`WITH CHECK` sigue impidiendo `rejected`. `test-roles.cjs`: 74/74.

- Verificación:
  ```sql
  SELECT tgname FROM pg_trigger WHERE tgname = 'trg_review_votes_block_own_review';                 -- 1 fila
  SELECT policyname FROM pg_policies WHERE tablename = 'reviews' AND cmd = 'UPDATE' ORDER BY 1;
  -- «Admins can update reviews» y «Authors can edit own pending or approved reviews»
  ```
- Vuelta atrás: la de la cabecera del fichero.

### 3.20 `20260924180000_profile_name_sin_email.sql` (de otro agente)

Quita trozos «@…» del nombre al crear el perfil. Probado con el
`handle_new_user` de prod: alta por email (nombre y `username` intactos), alta
con Google cuyo nombre es el email (`pepe@gmail.com` → `pepe`), «@@@» →
«Nuevo Usuario» y alta de respaldo desde el cliente (sigue sin poder ponerse
`admin`). No toca perfiles existentes (el `UPDATE` de su pie es manual).

- Verificación: `SELECT tgname FROM pg_trigger WHERE tgname = 'profiles_name_sin_email';` → 1 fila.
- Vuelta atrás: `DROP TRIGGER IF EXISTS profiles_name_sin_email ON public.profiles; DROP FUNCTION IF EXISTS public.profile_name_sin_email();`

### 3.21 `20260924190000_auto_approve_after_edit.sql`

El cron `approve_pending_reviews_hourly` (cada hora, como `postgres`) aprobaba
las pendientes con `created_at` de hace más de 24 h: una reseña antigua editada
(3.19) se habría vuelto a publicar en menos de una hora sin revisión. Ahora
cuenta 24 h desde `reviews.pending_since` (columna nueva; la pone un trigger
cuando la reseña entra en `pending` o el autor edita una pendiente; el cliente
no puede fijarla; los votos no la mueven). El cron no se toca; la función
mantiene firma, `SECURITY INVOKER` y dueño, y deja de ser ejecutable por
anon/authenticated (solo la llama el cron). Hoy hay 0 pendientes en prod.

- Verificación:
  ```sql
  SELECT column_default FROM information_schema.columns
  WHERE table_name = 'reviews' AND column_name = 'pending_since';              -- now()
  SELECT tgname FROM pg_trigger WHERE tgname = 'trg_reviews_pending_since';    -- 1 fila
  SELECT position('pending_since' in prosrc) > 0, prosecdef
  FROM pg_proc WHERE proname = 'approve_old_pending_reviews';                  -- true, false
  SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'approve_pending_reviews_hourly';  -- sin cambios
  ```
- Vuelta atrás: la de la cabecera del fichero (restaura la función con `created_at`).

### 3.22 `20260924200000_close_user_email_leak.sql` (= paso 0-bis)

La corrección del paso 0-bis como migración, para que cualquier base nueva o
restaurada salga igual. Si el hotfix ya se aplicó, no cambia nada. Si una de
las funciones no existe (la base local no tiene las dos de la fuga), la salta
con un `NOTICE`. Compatible con cualquier front: nadie las llama.

- Verificación: el bloque C de `scripts/_datos-prod/00-hotfix-fuga-emails.sql`
  (3 filas, `anon`/`authenticated` = `false`, `service_role` = `true`).
- Vuelta atrás: la de la cabecera del fichero (reabre la fuga).

### 3.23 `20260924210000_review_subjects_slug_check.sql`

`CHECK (slug ~ '^[a-z0-9_-]+$')` en `review_subjects.slug` (el slug de producto
va tal cual a la URL y al `<loc>` del sitemap; `NULL` sigue permitido). Se crea
`NOT VALID` y se valida **solo si no hay filas fuera de patrón**; si las hay, se
queda `NOT VALID` y lo dice con un `NOTICE` (sus URLs no se tocan, pero
cualquier `UPDATE` de esas filas fallará hasta corregirlas a mano).

- Antes (solo lectura), si la tabla ya existe:
  `SELECT id, business_id, slug FROM public.review_subjects WHERE slug !~ '^[a-z0-9_-]+$';`
  24/09: en prod la tabla aún no existe (la crea 3.2); los **4.143** slugs de
  `scripts/_catalogo/carga.sql` cumplen el patrón (comprobado con la misma
  regex de Postgres) y los de la base local también, así que queda validada y
  la carga de 6.2 pasa.
- **Aviso para el panel** (no se ha tocado; es de otro agente):
  `slugify()` de `utils/slugify.ts`, que usa `createBusinessProduct`, deja pasar
  rayas `–`/`—`, guion no separable `‑`, espacio de ancho cero, `ª`/`º`, `ß`,
  comillas tipográficas, emoji o CJK. Con esta migración, crear un producto con
  uno de esos nombres da `23514` (check_violation) en vez de guardar un slug
  raro: 9 de los 4.143 nombres del catálogo real lo provocarían (p. ej.
  «Curso Terapias de 3ª Generación», «Máster en Hidrógeno Verde y Power‑to‑X»).
  Arreglo propuesto en el front: tras `slugify`, quitar todo lo que no sea
  `[a-z0-9_-]` (y caer a `producto` si queda vacío). El front de producción no
  crea productos: no le afecta.
- Verificación: `SELECT convalidated, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'review_subjects_slug_check';` → `true | CHECK ((slug ~ '^[a-z0-9_-]+$'::text))`.
- Vuelta atrás: `ALTER TABLE public.review_subjects DROP CONSTRAINT IF EXISTS review_subjects_slug_check;`

`generate-sitemap` (4.2 b) además escapa **solo `&`, `<` y `>`** en cada
`<loc>` (los que el texto de un elemento XML no admite). `'` y `"` no se tocan:
dentro de un elemento no hace falta escaparlos y `'` es un carácter válido de
URL que `encodeURIComponent` deja pasar (nombre de empresa sin slug), así que
escaparlo habría cambiado los bytes de URLs válidas respecto a master
(corregido el 24/09, noche; antes escapaba los cinco). Una URL sin `& < >` sale
**byte a byte igual** que en master; con `&` o `</loc>`, master generaba XML
inválido (Google descarta el sitemap entero) y ahora es válido y un lector XML
devuelve la URL original. En prod hoy: 0 de 1.019 empresas tienen `& < > " '` en
el slug o, sin slug, en el nombre. La forma de las URLs (tablas de rutas,
`countryToUrlCode`) es cosa de otro cambio: aquí solo el escape.

### 3.23b `20260924230000_admin_save_featured.sql` (de otro agente)

`admin_save_featured_businesses(uuid[])`: `/admin/destacados` guarda la lista en
una transacción con candado (antes, varias escrituras sueltas desde el
navegador que se pisaban con dos guardados seguidos). `SECURITY DEFINER` con
`search_path`, comprueba admin (`42501`), rechaza ids vacíos o repetidos y solo
escribe `is_featured`/`featured_order` de las filas que cambian: **no toca
slugs**. Sin `EXECUTE` para anon. La heredada `admin_set_featured_companies`
no se toca. El front actual de prod no la llama; el de la rama sí, y si no
existe vuelve a las escrituras de antes.

- Probado en el ensayo (grupo `destacadas` de `test-seguridad-0924.cjs`): anon →
  `permission denied`; usuario normal → «solo un administrador»; admin guarda
  `[b, a]` → `featured_order` 2 y 1 y el resto desmarcado; id repetido → error;
  la huella de slugs no cambia.
- Repetido en el ensayo de pagos (24/09, ~23:00 UTC, copia propia
  `opynio_prodlike_pagos` desde `opynio_prodlike` prístina, ya borrada): orden
  del runbook 3.1…3.25 con 3.23b entre 3.23 y 3.24 y `code_privado` al final,
  **27/27 OK** y segunda pasada 27/27; `test-roles` 74/74. Después: existe
  (`SECURITY DEFINER`, `search_path=public, pg_temp`); ACL
  `{postgres, authenticated, service_role}` (anon sin `EXECUTE`); anon →
  `42501 permission denied`; usuario normal → `42501` «solo un
  administrador»; admin guarda `[b2, b1]` → orden 1 y 2 y la destacada anterior
  desmarcada; repetida `22023`, nula `22004`, inexistente `P0002` (sin tocar
  nada); lista vacía → 0 destacadas; el admin sigue `admin`. 3.26 también
  aplicó encima (dos veces).
- Verificación: `SELECT has_function_privilege('anon', 'public.admin_save_featured_businesses(uuid[])', 'EXECUTE');` → `false`.
- Vuelta atrás: `DROP FUNCTION IF EXISTS public.admin_save_featured_businesses(uuid[]);`

### 3.24 `20260924240000_upgrade_keep_admin.sql`

Las dos sobrecargas de `upgrade_user_to_business_owner` (3 y 9 parámetros)
ponían `role = 'business_owner'` sin mirar el rol: un admin que daba de alta una
empresa por el asistente perdía el panel de administración. Ahora ese `UPDATE`
no toca a quien es `admin`; el resto es idéntico a prod (comparado con
`pg_get_functiondef`: solo cambia esa línea; misma ACL, dueño, `DEFINER` y
`search_path`). Compatible con el front actual (misma firma y resultado).
Probado en la copia prístina, en `opynio_prodlike` y en local: admin → sigue
`admin` y la empresa se crea con su `owner_id`; usuario normal →
`business_owner`; anon → «No autenticado.»; límite de plan intacto.
Mismo patrón, sin tocar: `finish_business_signup` (nadie la llama) y
`admin_assign_business_owner` (al aprobar la reclamación de un admin).

- Verificación: `SELECT oid::regprocedure, position('IS DISTINCT FROM ''admin''' in prosrc) > 0 FROM pg_proc WHERE proname = 'upgrade_user_to_business_owner';` → 2 filas `true`.
- Vuelta atrás: la de la cabecera del fichero.

### 3.25 `20260924250000_stats_sin_programadas.sql`

1. `business_review_stats` (panel del dueño) y `get_businesses_with_review_stats`
   (directorio) contaban las reseñas **programadas** (aprobadas con fecha
   futura: 25 en 22 empresas el 24/09) antes de que el front las enseñe. Se
   añade `created_at <= now()`; nada más cambia (diff contra
   `pg_get_functiondef` de prod: esa condición y, en el directorio, un
   `search_path = public` fijo que no tenía). Ya estaban bien:
   `review_stats_batch` (todos sus llamadores pasan
   `p_include_scheduled = false`), `review_source_counts` y su `total`,
   `widget_business_stats`, `business_analytics`.
2. Quita `EXECUTE` a anon/authenticated de las 3 RPC que leen la vista
   desfasada `business_metrics` (`get_featured_companies_with_details`,
   `get_public_businesses_with_details` y la sobrecarga `double precision` de
   `get_public_businesses`): nadie las llama (bundle de prod, repo, Edge
   Functions desplegadas). La vista en sí sigue legible por anon (nadie la lee).
   Comprobado de nuevo el 24/09 (22:40 UTC): 0 apariciones en los 37 chunks del
   bundle servido (`index-B5KSYvHq`) y en el repo. Además
   `get_featured_companies_with_details` y `get_public_businesses_with_details`
   **ya fallan hoy en prod** al ejecutarlas (`42804`: `avg_rating` de la vista es
   `numeric` y la función declara `double precision`), otra prueba de que nadie
   las usa. La sobrecarga `real` de `get_public_businesses` (no lee la vista) se
   queda abierta: devuelve `contact_email`/`contact_phone` de empresas, que anon
   ya lee de `businesses` por RLS.

Requiere `20260915144500` (en prod ya está; si falta, aborta con mensaje: pasó
en la base local, que no la tenía). Compatible con el front actual.

- Verificación: la del pie del fichero.
- Vuelta atrás: la de la cabecera del fichero.

### 3.26 `20260924260000_directory_relevance_order.sql` (de otro agente)

`directory_businesses(...)`: el directorio (`/es/empresas`) pide al servidor una
página ya filtrada, ordenada (relevancia por país/idioma + puntuación,
alfabético, valoración, nº de reseñas) y con el total. Crea además el índice
parcial `idx_reviews_approved_stats` sobre `reviews` (`CREATE INDEX` normal,
no `CONCURRENTLY`: bloquea escrituras en `reviews` mientras se crea; con ~50k
filas, menos de un segundo según su autor). `SECURITY DEFINER` con
`search_path` vacío; `EXECUTE` para anon/authenticated. Solo devuelve columnas
públicas de `businesses` (las mismas que pedía el directorio en master, **sin
`slug`**: no cambia cómo se forman los enlaces) y cuenta solo reseñas
aprobadas con `created_at <= now()`. **Va antes del front nuevo** (el
directorio la necesita). El front actual no la llama.

- Probado en el ensayo: dos pasadas OK en las dos bases; como anon devuelve las
  empresas y no cuenta una reseña programada; 74/74 y 48/48 siguen OK después.
  No se ha revisado a fondo su orden de relevancia (no era el encargo).
- Verificación: `SELECT has_function_privilege('anon', 'public.directory_businesses(text,text,text,text[],text,numeric,numeric,text,text,text[],integer,integer)', 'EXECUTE'), to_regclass('public.idx_reviews_approved_stats') IS NOT NULL;` → `true | true`.
- Vuelta atrás: la de la cabecera del fichero (y el front viejo del directorio).

### Ensayo con 0-bis y 3.22–3.25

Repetido **completo** el 24/09 entre las 22:33 y las 22:50 (UTC), con los
ficheros tal como están a esa hora:

- **Esquema**: `rebuild.sh --regen` releyó el catálogo de prod (solo `SELECT`):
  `prodlike-schema.sql` sale **idéntico** al anterior (prod no ha cambiado) y
  `verify-fidelity.cjs` da **FIDELIDAD OK** (275 columnas, 26 tablas, 79
  constraints, 72 índices, 83 políticas, 64 funciones, 17 triggers, ACL).
- **Bases propias** creadas desde ese mismo esquema y semilla:
  `opynio_prodlike_hf0924` (hotfix solo), `opynio_prodlike_e0924` (orden del
  runbook) y `opynio_prodlike_e0924b` (orden de fichero). Motivo: otro agente
  usaba a la vez `opynio_prodlike` y el fichero temporal compartido
  `/tmp/prodlike/mig.sql` de `apply-migrations.sh`; una ejecución cruzada
  aplicó un fichero **vacío** y dijo `OK`. Las copias propias usan otro
  directorio del contenedor y comprueban el tamaño de la copia antes de
  ejecutar. **Ojo si se repite con dos agentes a la vez.**
- **Paso 0-bis** (fichero entero, una petición, como `postgres`) sobre la copia
  prístina: antes, `anon` lista los emails con las dos funciones y lanza el
  refresco (3/3); después **12/12**: `anon`, un usuario y el admin por la API →
  `permission denied`; `service_role` y `postgres` siguen; ACL final
  `{postgres=X/postgres,service_role=X/postgres}`. Segunda pasada: OK. 3.22
  encima: OK, sin cambios. Bloque D: deja **exactamente** la ACL de prod
  (mismos 5 elementos). Fallo simulado (un rol intermedio con `EXECUTE`
  heredado por `anon`): el fichero **aborta** con su mensaje y la ACL queda
  intacta. Bloque E en `BEGIN/ROLLBACK`: borra las dos y vuelven al deshacer.
- **Orden del runbook** (`opynio_prodlike_e0924`): 0-bis → 3.1…3.25 con 3.23b →
  `code_privado`: **27/27 OK**; segunda pasada completa: **27/27 OK**.
- **Orden de fichero, sin 0-bis** (`opynio_prodlike_e0924b`, 3.22 hace el
  trabajo del hotfix, `code_privado` en su sitio): **27/27 OK**.
- **Pruebas, en las dos bases**: `test-roles.cjs` **74/74**;
  `test-seguridad-0924.cjs fuga slug upgrade stats resena destacadas`
  **48/48** (fuga 12, slug 8, upgrade 6, stats 8, reseña 9, destacadas 5).
  Cambio en la prueba ST6: ejecutar `get_featured_companies_with_details` como
  `service_role` falla **también en prod** (`42804`, ver 3.25), así que ahora
  comprueba el privilegio; ST7 deja constancia de ese fallo previo y ST8 de que
  la sobrecarga `real` de `get_public_businesses` sigue abierta.
- **Base local** (`postgres` de la app, ids `uuid`): 3.19, 3.22, 3.23, 3.24 y
  3.25 reaplicadas (idempotentes, OK; 3.23b ya la había aplicado su autor).
  Grupo `resena` con una reseña aprobada real: 9/9, y el autor no edita su
  rechazada (0 filas).
- **Catálogo**: los 4.143 slugs de `scripts/_catalogo/carga.sql`, cargados en
  una tabla temporal y comprobados con la misma regex de Postgres: 0 fuera de
  patrón, 0 nulos, 0 duplicados por empresa. En prod `review_subjects` aún no
  existe: 3.23 quedará **validada**.
- **Definiciones** (diff contra `pg_get_functiondef` de prod): 3.24 solo cambia
  el `UPDATE` de rol en las dos sobrecargas; 3.25 solo añade
  `created_at <= now()` (y `search_path = public` en el directorio). Ninguna
  migración anterior de la lista redefine esas funciones.
- **3.26** (apareció a las 22:51 UTC, con el ensayo ya hecho): aplicada
  después en las dos bases, dos veces (OK); 74/74 y 48/48 repetidas después:
  sin cambios. En total, **28/28** ficheros OK en cada orden.
- Prod sin cambios en las cifras: 45 cuentas, 25 reseñas programadas en 22
  empresas (25/09 → 21/10), 0 pendientes, 1.019 empresas.

Para repetirlo sin chocar con otro agente, crear una base con otro nombre (por
ejemplo con `CREATE DATABASE x TEMPLATE opynio_prodlike` justo después de
`rebuild.sh`) y pasar `--db x` / `PGDB=x`.

(`code_privado` va en 6.1, después de subir el front. Probada también en su
posición de fichero, antes de 3.15: funciona igual.)

---

## 4. Edge Functions y `widget.js`

Requisito: **toda la sección 3 aplicada** (como mínimo 3.2, 3.3, 3.4, 3.7 y
3.17). Todas las funciones son compatibles con el front de hoy (mismos
parámetros; `send-invitation-email` ya no exige `businessName`, que el front
viejo sigue mandando sin problema).

**Cómo**: con el CLI, `npx supabase functions deploy <nombre>`, que empaqueta
`_shared/` y los imports relativos y aplica el `verify_jwt` de
`supabase/config.toml`. Alternativa si el CLI falla:
`node scripts/_deploy-edge-multipart.cjs <nombre>` (B8, ya arreglado; probar
antes con `--dry-run`). Sesión: `npx supabase login` (navegador; nada de tokens
en el chat).

Las tres de pagos (`create-checkout-session`, `create-portal-session`,
`stripe-webhook`) ya se desplegaron en el **paso 0**: no se repiten salvo que
sus carpetas hayan cambiado desde entonces (`git diff` / `git status`).

### 4.1 `widget.js` v6.10.5 — primero el fichero, después el proxy

Según [bump-widget-version.md](./playbooks/bump-widget-version.md): si sale
antes el proxy, anuncia `widget_version` v6.10.5 cuando el fichero servido aún
es el viejo y los widgets con autoactualización hacen un intento de recarga
inútil (uno solo: hay freno). Al revés no pasa nada: el `widget-proxy` actual
(v34) no manda `widget_version` y el widget nuevo no se recarga; solo le faltan
los nombres de autor hasta que se despliega el proxy (4.2 a). Es independiente
del front: lo cargan las webs de los clientes.

```powershell
cd C:\Proyectos\Opynio
npm run check:widget                                                     # v6.10.5 — coincide en los cuatro sitios
node -e "new Function(require('fs').readFileSync('public/widget.js','utf8')); console.log('widget.js OK')"
Select-String -Path public\widget.js -Pattern 'Opynio Widget Loader v6.10.5'   # 1 coincidencia
```

Subir con FileZilla **solo** `public/widget.js` (no pasa por el build: es el
mismo fichero que acabará en `dist/widget.js`) a la raíz de `web.opynio.com`,
sustituyendo el v6.5.5 (su copia está en `C:\opynio-backup\web-2026-09-24\`,
2.0.2). Verificar:

```powershell
curl.exe -s https://web.opynio.com/widget.js | Select-Object -First 3    # "Opynio Widget Loader v6.10.5"
```

La caché de `widget.js` es de 5 minutos. Vuelta atrás: resubir el `widget.js`
v6.5.5 de la copia.

### 4.2 Desplegar

```powershell
$ref = 'hvtrrhxeqrsnjxhngdsj'
cd C:\Proyectos\Opynio
Select-String -Path supabase\config.toml -Pattern '^\[functions\.' -Context 0,1
#   Esperado: stripe-webhook, monthly-rescrape-job, widget-proxy y generate-sitemap, las 4 con verify_jwt = false
# Si Docker no está arrancado, añade --use-api a cada deploy.

# a) Widget: SOLO con 3.7 aplicada y DESPUÉS de 4.1 (widget.js v6.10.5 ya servido)
npx supabase functions deploy widget-proxy          --project-ref $ref --no-verify-jwt
# b) Sitemap: lo llama nginx sin Authorization (B5)
npx supabase functions deploy generate-sitemap      --project-ref $ref --no-verify-jwt
# c) Cron mensual: sin JWT, exige Authorization: Bearer <CRON_SECRET> (el cron está roto aparte: 4.5)
npx supabase functions deploy monthly-rescrape-job  --project-ref $ref --no-verify-jwt
# d) Invitaciones: SOLO con 3.2 y 3.17 (20260924140000) aplicadas; si no, cada envío falla
npx supabase functions deploy send-invitation-email --project-ref $ref
# e) El resto (verify_jwt = true). meta-capi deja de reenviar el Purchase del navegador (ver abajo)
foreach ($f in 'meta-capi','send-support-email','repair-stripe-orphans','admin-rescrape-google-reviews',
               'approve-and-process-now','instant-full-scrape','process-scraping-queue','serpapi-proxy',
               'start-scraping-search','trustindex-scraper') {
  npx supabase functions deploy $f --project-ref $ref
}
# f) Pagos: ya en el paso 0 (P.2). Repetir solo si esas carpetas cambiaron después.
# Decisión aparte: multi-source-reviews (nueva) + borrar la vieja multi-source-review; trustindex-proxy.
```

**`meta-capi`**: desde esta versión, un `Purchase` enviado por el navegador
(`PaymentSuccessPage`, *fire-and-forget*) recibe 200
`{"ok":true,"forwarded":false,"reason":"sent_server_side"}` y **no** se reenvía
a Meta: el valor y el `event_id` los ponía el cliente y se podían inflar
conversiones. El `Purchase` real lo manda `stripe-webhook` al completar el
checkout, con el importe y la moneda de Stripe y `event_id` = id de la sesión
(el Pixel usa el mismo y Meta deduplica). La v31 del webhook también lo hacía
(comprobado en su copia), así que en ningún orden de despliegue se pierden
compras.

### 4.3 Verificación

```powershell
# 1. Versiones nuevas (antes: widget-proxy 34, generate-sitemap 54, monthly-rescrape-job 15, meta-capi 1,
#    send-invitation-email 5). verify_jwt en Dashboard → Edge Functions: desactivado en widget-proxy,
#    generate-sitemap, stripe-webhook y monthly-rescrape-job; activado en el resto.
npx supabase functions list --project-ref $ref

# 2. Widget: trae widget_version y nombres de autor
$r = Invoke-RestMethod -Method Post -ContentType 'application/json' `
  -Uri "https://$ref.supabase.co/functions/v1/widget-proxy" `
  -Body '{"businessId":"b94183fd-ba33-449d-8f00-4741b57adfc9"}'
$r.widget_version                 # v6.10.5
$r.reviews.Count                  # > 0
$r.reviews | Select-Object -First 3 original_author_name

# 3. Sitemap sin autenticación, directo y a través de la web (el proxy la llama sin Authorization)
curl.exe -s -o NUL -w "%{http_code}`n" "https://$ref.supabase.co/functions/v1/generate-sitemap"   # 200
curl.exe -s https://web.opynio.com/sitemap.xml -o $env:TEMP\sitemap.xml -w "%{http_code}`n"      # 200 (401 = verify_jwt mal)
Select-String -Path $env:TEMP\sitemap.xml -Pattern '^<\?xml' -List                                 # empieza por <?xml
(Select-String -Path $env:TEMP\sitemap.xml -Pattern '<url>').Count                                 # >= 1287 (hoy); más tras cargar el catálogo

# 4. CORS cerrado en funciones de admin: sin Access-Control-Allow-Origin para otro origen
curl.exe -s -i -X OPTIONS "https://$ref.supabase.co/functions/v1/serpapi-proxy" -H "Origin: https://ejemplo.invalid" | Select-String "Access-Control-Allow-Origin"   # sin salida

# 5. monthly-rescrape-job sin secreto → 401 de la PROPIA función (con verify_jwt=true respondería la pasarela, con otro texto)
curl.exe -s -w "`n%{http_code}`n" -X POST "https://$ref.supabase.co/functions/v1/monthly-rescrape-job"   # {"error":"No autorizado"} y 401

# 6. meta-capi: SOLO tras confirmar en (1) que meta-capi ya no es la v1 (la v1 reenviaría una compra falsa a Meta)
$anon = ((Select-String -Path .env -Pattern '^VITE_SUPABASE_ANON_KEY=(.*)$').Matches[0].Groups[1].Value).Trim('"',"'")
Invoke-RestMethod -Method Post -Uri "https://$ref.supabase.co/functions/v1/meta-capi" -Headers @{ Authorization = "Bearer $anon" } `
  -ContentType 'application/json' -Body '{"event_name":"Purchase","event_id":"prueba-despliegue"}'
#    Esperado: ok = True, forwarded = False, reason = sent_server_side (200; no llega nada a Meta)
Remove-Variable anon
```

`send-invitation-email`: prueba funcional en 9 (una cuenta `starter`+ envía una
invitación a un correo propio).

### 4.4 Vuelta atrás

`npx supabase functions deploy <nombre> --project-ref $ref --workdir C:\opynio-backup\funciones-2026-09-24`
(con `--no-verify-jwt` en las que lo tenían: `widget-proxy`, `generate-sitemap`,
`stripe-webhook`). Las de pagos: P.4. Si `supabase functions download` no
funcionara en 2.0.2, `node scripts/_get-deployed-code.cjs <slug>` descarga el
paquete desplegado (solo `GET`) y de él se extrae el `index.ts` como en P.4.
`widget.js`: 4.1.

### 4.5 Opcional: reparar el cron del scrapeo mensual

No bloquea nada y **hoy no scrapearía nada**: 0 empresas tienen
`is_selected_for_monthly_scrape = true`. Hazlo solo si quieres que el
scrapeo mensual vuelva a funcionar. Requiere `monthly-rescrape-job` ya
desplegada (4.2 c, `verify_jwt=false`) y `admin-rescrape-google-reviews` nueva
(acepta la llamada interna con `X-Internal-Secret`).

**Estado el 24/09 (solo lectura):**

- Job `monthly_rescrape` (id 1, `0 0 1 * *`, como `postgres`): falla cada mes
  desde octubre de 2025; el último, el 01/09/2026, con
  `schema "secrets" does not exist`. Su comando hace `net.http_post(…
  'Authorization', 'Bearer ' || secrets.get('CRON_SECRET') …)`.
- `pg_net` **no está instalada** (disponible, 0.14.0): no existe el esquema
  `net`. No existe el esquema `secrets`. **Vault** está instalado con **0
  secretos**. `CRON_SECRET` existe solo como secreto de Edge Functions, que el
  SQL no puede leer (y su valor no se puede consultar: solo su hash).
- Ninguna función ni trigger de la base usa `net.*`: activar `pg_net` solo
  afecta a los 3 jobs que lo llaman (1, 5 y 6).

**Riesgos:**

1. **Activar `pg_net` despierta otros dos jobs** que hoy fallan a diario por
   `schema "net" does not exist`:
   - `auto-migrate-slugs-daily` (id 5, 03:00) llama a la función
     `auto-migrate-slugs` (v7, **no está en el repo**). Su código (leído del
     paquete desplegado) **cambia el slug —la URL— de hasta 10 empresas por
     ejecución** cuyo slug no coincide con su `slugify(nombre)` (≈209 hoy) y
     crea redirecciones. Hoy no llegaría a ejecutarse porque la función tiene
     `verify_jwt=true` y el cron no manda `Authorization` (401), pero bastaría
     con redesplegarla sin JWT. Rompe la regla de no cambiar URLs.
   - `ping-sitemap-after-migration` (id 6, 04:00) llama a
     `google.com/ping?sitemap=…`, que Google retiró en 2023: inútil.
   → **Desactivar los dos antes** de activar `pg_net`.
2. Hay que **generar un `CRON_SECRET` nuevo** (el actual no se puede leer) y
   ponerlo en dos sitios: Vault y los secretos de Edge Functions. Solo lo usa
   `monthly-rescrape-job` (buscado en el repo), así que cambiarlo no rompe nada
   más.
3. Dejar el secreto **en el comando** del job (en vez de en Vault) es más
   simple pero lo expone: el texto del comando se ve en `cron.job`, en cada
   fila de `cron.job_run_details` y en la pantalla de Cron del Dashboard.
   Mejor Vault.
4. Cuando alguien marque empresas para el scrapeo mensual, cada día 1 habrá
   llamadas a SerpAPI (coste) y la función puede agotar su tiempo máximo si
   son muchas.

**Pasos** (SQL Editor, como `postgres`):

```sql
-- 1. Desactivar los dos jobs que pg_net despertaría (reversible con active := true)
SELECT cron.alter_job(jobid, active := false)
FROM cron.job WHERE jobname IN ('auto-migrate-slugs-daily', 'ping-sitemap-after-migration');
SELECT jobid, jobname, active FROM cron.job ORDER BY jobid;   -- 5 y 6 con active = false

-- 2. Activar pg_net (o Dashboard → Database → Extensions → pg_net)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 3. Generar el secreto DENTRO de la base (no se teclea ni pasa por el chat) y guardarlo en Vault
SELECT vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
                           'cron_secret', 'Bearer de monthly-rescrape-job (cron monthly_rescrape)');
-- Mostrarlo UNA vez para copiarlo al paso 4 (no lo guardes en ningún fichero):
SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret';
```

4. Dashboard → Edge Functions → **Secrets** → editar `CRON_SECRET` y pegar ese
   valor (sustituye al actual). Nada de `supabase secrets set` en la terminal
   (queda en el historial).

```sql
-- 5. Reescribir el job para leer el secreto de Vault (mismo nombre, horario y URL)
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'monthly_rescrape'),
  command := $cmd$
    SELECT net.http_post(
      url := 'https://hvtrrhxeqrsnjxhngdsj.supabase.co/functions/v1/monthly-rescrape-job',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')),
      body := '{}'::jsonb,
      timeout_milliseconds := 540000);
  $cmd$);

-- 6. Probarlo ya (con 0 empresas marcadas no scrapea nada): mismo comando que el job
SELECT net.http_post(
  url := 'https://hvtrrhxeqrsnjxhngdsj.supabase.co/functions/v1/monthly-rescrape-job',
  headers := jsonb_build_object('Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')),
  body := '{}'::jsonb) AS request_id;
-- unos segundos después, con ese id:
SELECT status_code, left(content::text, 200) FROM net._http_response WHERE id = <request_id>;
-- Esperado: 200 y {"success":true,"message":"No hay empresas seleccionadas."}
-- 401 = el CRON_SECRET de Edge Functions no coincide con el de Vault (repetir el paso 4)
```

7. El día 2 del mes siguiente: `SELECT status, return_message, start_time FROM
   cron.job_run_details WHERE jobid = 1 ORDER BY start_time DESC LIMIT 1;` →
   `succeeded`.

**Vuelta atrás:** restaurar el comando original del job (está en el volcado de
2.0.2, o en `cron.job` antes del paso 5: guárdalo), `SELECT cron.alter_job(…,
active := true)` de 5 y 6 **solo** si se quieren de vuelta,
`DELETE FROM vault.secrets WHERE name = 'cron_secret';` y, si nada más lo usa,
`DROP EXTENSION pg_net;`. El `CRON_SECRET` nuevo puede quedarse.

Aparte, `monthly_ai_credit_reset` (id 4) falla a diario (`column
"ai_credits_last_reset" does not exist` en `businesses`): fuera de alcance
(10.1).

---

## 5. Front (`dist/` por FileZilla)

### 5.1 Qué entra en este build

Además de los commits de la rama, **todo el árbol de trabajo sin commitear**
(24/09 por la noche: 142 ficheros modificados y 41 nuevos). Estos estaban en
curso por otros agentes y el build debe esperarlos (B7; `npm run verify` ya
pasa):

- `contexts/i18nContext.tsx` y los **31** `locales/*.ts`; nuevos
  `contexts/localePaths.generated.ts` y `scripts/gen-locale-paths.mjs` (el build
  **se para** si `localePaths.generated.ts` no coincide con los locales:
  `npm run gen:locale-paths`).
- `App.tsx`, `components/Meta.tsx`, `vite.config.ts`.
- `services/geminiService.ts` (IA del navegador desactivada con
  `AI_ENABLED = false` fijo; no lee ninguna clave: ver 2.0.1).
- `components/pages/ExplorePage.tsx`, `components/pages/SearchResultsPage.tsx`.
- `supabase/functions/monthly-rescrape-job/index.ts` (se despliega en 4.2).
- Otros nuevos: `services/translateService.ts`, `utils/businessOwnership.ts`,
  `utils/plural.ts`, `utils/reviewDisplay.ts`.

### 5.2 Build

```powershell
cd C:\Proyectos\Opynio
npm run verify          # typecheck + check:widget + check:locale-paths

# .env: SOLO NOMBRES (los valores no se imprimen). Ninguna VITE_* secreta.
(Get-Content .env) -replace '=.*$','' | Where-Object { $_ -match '^VITE_' }
#   Esperado: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_STRIPE_PUBLISHABLE_KEY
(Get-Content .env) -replace '=.*$','' | Where-Object { $_ -match '^VITE_.*(TOKEN|SECRET|API_KEY|SERVICE_ROLE|PAT)' }   # sin salida
Get-ChildItem -Name .env* -Force   # .env, .env.docker.local, .env.example (un .env.local/.env.production también se leería)

npx vite build          # SIN --mode docker (y recuerda: guard-docker-env no comprueba nada en este modo)

# El bundle apunta a PRODUCCIÓN, no al Supabase local
(Select-String -Path dist\assets\*.js -Pattern 'hvtrrhxeqrsnjxhngdsj\.supabase\.co' -List).Count   # >= 1
Select-String -Path dist\assets\*.js -Pattern '127\.0\.0\.1:54321','localhost:54321' -List        # sin salida

Select-String -Path dist\widget.js -Pattern 'Opynio Widget Loader v6.10.5'   # 1 coincidencia
node -e "new Function(require('fs').readFileSync('dist/widget.js','utf8')); console.log('widget.js OK')"

# Ninguna clave secreta en el bundle (además del skill pre-commit-secret-scan)
Select-String -Path dist\assets\*.js -Pattern 'sb_secret_','sk_live_','sk_test_','AIza[0-9A-Za-z_-]{35}' -List   # sin salida
node -e "const fs=require('fs');const r={};for(const f of fs.readdirSync('dist/assets').filter(x=>x.endsWith('.js'))){for(const j of fs.readFileSync('dist/assets/'+f,'utf8').match(/eyJ[\w-]{10,}\.eyJ[\w-]{10,}\.[\w-]{10,}/g)||[]){const role=JSON.parse(Buffer.from(j.split('.')[1],'base64url')).role;r[role]=(r[role]||0)+1}};console.log(r)"   # solo { anon: n }
```

**Antes de subir nada por FileZilla: skill `pre-commit-secret-scan` sobre
`dist/`.** Si encuentra algo, no se sube.

### 5.3 Subida con FileZilla

5.3.1 Copia de seguridad del `dist/` actual **del servidor** (2.0.2, punto 4) en
`C:\opynio-backup\web-2026-09-24\`. Si no se hizo, hacerla ahora: es la única
vuelta atrás del front.

5.3.2 `widget.js`: ya subido en 4.1 (es el mismo fichero que `dist/widget.js`);
no hace falta volver a subirlo. En una web con widget: la consola muestra
`window.OpynioWidgetVersion` = `v6.10.5` y las tarjetas llevan nombre de autor.

5.3.3 **Front**:

0. Antes de subir nada, en el SQL Editor (todo `true`; si no, **no subir**):
   ```sql
   SELECT to_regprocedure('public.admin_list_users(text,text,int,int)') IS NOT NULL AS admin_list_users,   -- 3.11
          EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'businesses' AND column_name = 'featured_order') AS featured_order,  -- 3.13
          EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'avatars' AND file_size_limit IS NOT NULL) AS avatars,  -- 3.10
          to_regclass('public.review_subjects') IS NOT NULL AS productos,                                     -- 3.2
          to_regprocedure('public.directory_businesses(text,text,text,text[],text,numeric,numeric,text,text,text[],integer,integer)') IS NOT NULL AS directorio;  -- 3.26
   ```
   Y el **paso 0** hecho: `get-checkout-status` responde (el `curl` de P.3.2 da
   401 `"code":"unauthorized"`, no 404). Sin ella, `/pago-exitoso` del front
   nuevo nunca confirma un pago.
1. Subir `dist/assets/` (ficheros nuevos con hash). **No borrar** los antiguos
   todavía: quien tenga el `index.html` viejo cacheado los sigue pidiendo.
2. Subir el resto de `dist/` salvo `index.html` y **salvo `sitemap.xml`**
   (`robots.txt`, iconos, `manifest.json`, `404.html`…). `dist/sitemap.xml` es
   el estático de `public/` (enero de 2026, 1.273 URLs); el `/sitemap.xml` real
   lo genera `generate-sitemap` a través del proxy de la web (B5). Si el
   servidor sirviera el estático antes que el proxy, Google vería el viejo.
3. Subir `dist/index.html` **el último**.

Verificación:

```powershell
curl.exe -s https://web.opynio.com/ | Select-String -Pattern 'assets/index-[^"]+\.js' -AllMatches | % { $_.Matches.Value }   # el mismo hash que dist\index.html
curl.exe -s https://web.opynio.com/sitemap.xml | Select-String -Pattern '<url>' -AllMatches | Measure-Object | % Count        # >= 1287 (el dinámico, no 1273)
```

Vuelta atrás: resubir `C:\opynio-backup\web-2026-09-24\` (primero sus `assets/`,
`index.html` al final). El `widget.js` es aparte (4.1): los widgets v6.10.5
cacheados ven el `widget_version` v6.10.5 del proxy nuevo; si también se
vuelve atrás el proxy, se quedan con lo que tienen, sin bucle (se recargan una
sola vez por página).

---

## 6. `code_privado` y carga del catálogo

### 6.1 `20260924100000_review_subjects_code_privado.sql`

Aplicar ahora, **después de subir el front** y **antes de cargar productos**.
(Comprobado que tampoco rompería antes: el front desplegado no usa
`review_subjects`, y el nuevo pide siempre columnas explícitas —7 accesos, ningún
`select('*')`— y tolera que falte `business_subject_codes`.)

- Verificación:
  ```sql
  SELECT grantee FROM information_schema.column_privileges
  WHERE table_schema = 'public' AND table_name = 'review_subjects'
    AND column_name = 'code' AND privilege_type = 'SELECT';   -- solo postgres y service_role
  ```
- Vuelta atrás: `GRANT SELECT ON public.review_subjects TO authenticated; DROP FUNCTION public.business_subject_codes(uuid);`

### 6.2 Catálogo (4.143 productos en 9 empresas) y asignación (667 reseñas)

**Guía paso a paso con todas las comprobaciones:
`scripts/_datos-prod/04-catalogo-orden-y-comprobaciones.sql`** (no carga nada:
fija el orden, las consultas de antes/después y la vuelta atrás; se abre y se
va ejecutando por bloques).

Orden: 3.2 aplicada → front subido → 6.1 → **04.0** (comprobaciones previas) →
**`scripts/_catalogo/carga.sql`** → comprobación 04.1 →
**`scripts/_catalogo/asignar-prod.sql`** → comprobación 04.2 → (opcional 04.3).

Estado el 24/09 por la noche (`node scripts/_catalogo/consulta-prod.cjs` y
`SELECT`): las 9 empresas existen, **los 9 dueños tienen plan `enterprise`**
(sin límite de productos en `enforce_product_limit`) y la tabla aún no existe.
Las **667 reseñas** de `asignar-prod.sql` siguen existiendo, en la empresa
esperada y aprobadas (652 de Opynio y **15 de Google**: decisión en 04.3, ver la
nota del fichero).

```powershell
node scripts/_catalogo/consulta-prod.cjs      # tras 3.2: "Tabla review_subjects en produccion: SI", 9 x enterprise, productos_ya = 0
```

`carga.sql` (754 KB) y `asignar-prod.sql` (422 KB) van cada uno en un
`BEGIN/COMMIT` y son idempotentes (`ON CONFLICT … DO NOTHING`);
`asignar-prod.sql` aborta si el catálogo no está cargado. Por tamaño, mejor
`psql` con la cadena de Dashboard → Connect (Session pooler), sin pegarla en el
chat: `psql "<cadena>" -v ON_ERROR_STOP=1 -f scripts/_catalogo/carga.sql`.

Verificación de la carga:

```sql
SELECT b.name, count(s.id) AS productos
FROM public.businesses b LEFT JOIN public.review_subjects s ON s.business_id = b.id
WHERE b.id IN ('b94183fd-ba33-449d-8f00-4741b57adfc9','b56d8d2a-c4e6-4ada-aa71-22e7348964bd',
               '728e9965-fa82-4e23-bdb5-481203030c20','1d570b58-3737-4fe1-b953-ca567125e866',
               '8c68723d-7a8e-4966-bb9f-ca779d996f8c','46c76222-a0aa-4c33-a6d2-1d3d19f3d11e',
               'ebbdefed-d4aa-48b6-9219-4f2e56cfec19','74eb6e82-72eb-4c22-a691-24423131343e',
               '68485599-4429-4223-bdfa-2f26392bd95d')
GROUP BY b.name ORDER BY b.name;
-- ISEIE 792 · Psiko 1006 · ISECD 617 · ISEIH 513 · ICTESS 365 · Fono 345 · ISSLOGG 203 · ISAEG 173 · ISEF 129  (total 4143)
```

Asignación: el último `SELECT` de `asignar-prod.sql` debe dar
`enlazadas = 667, propuestas = 667` (menos si alguna reseña se borró desde el
24/09: no es un error). El total de cada empresa **no cambia** (regla: cuenta
todas sus reseñas, no la suma de productos): huella de 04.0 igual antes y
después.

Vuelta atrás, en este orden: `scripts/_catalogo/desasignar-prod.sql` (solo esos
667 pares) y `scripts/_catalogo/rollback.sql` (productos sin reseñas
enlazadas).

**`scripts/_catalogo/asignar.sql` y `desasignar.sql` NO sirven en producción**
(ids de la base local). Los de producción son `asignar-prod.sql` /
`desasignar-prod.sql`, generados el 24/09 por `asignar-resenas-prod.mjs` desde
las reseñas reales (`exportar-resenas-prod.cjs`, ids `bigint`); enlazan por
`(business_id, slug)` del producto, así que no necesitan los ids de los
productos recién creados.

---

## 7. Datos de producción a corregir

Cada corrección es un fichero en **`scripts/_datos-prod/`** (ignorado por git)
con la misma forma: **A** vista previa (`SELECT` de lo que cambiará, con lo
esperado), **B** el cambio en una transacción que **aborta sin tocar nada si
las filas afectadas no son exactamente las esperadas**, **C** verificación y
**D** marcha atrás (comentada; quitar `/* */` para usarla). Ejecutar el fichero
entero corre A + B + C. Dónde: SQL Editor como `postgres` (los guards le dejan
pasar) o `psql "<cadena>" -v ON_ERROR_STOP=1 -f <fichero>`. Si B aborta y el
editor queda en «transacción abortada», `ROLLBACK;`.

Probados el 24/09 en una copia temporal de `opynio_prodlike` (esquema de prod
con las 22 migraciones) con filas falsas de los mismos ids: B cambia justo las
filas esperadas, una segunda ejecución aborta sin tocar nada, D restaura el
estado anterior y, sin datos, B aborta con su mensaje. La copia se borró.

| Orden | Fichero | Cuándo | Cambia |
| --- | --- | --- | --- |
| 01 | `01-rechazar-autoresena-129694.sql` | Tras la sección 3 (3.16 impide nuevas) | 1 reseña → `rejected` |
| 02 | `02-slugs-vacios.sql` | Tras 3.5 (vale también antes) | 2 slugs |
| 03 | `03-perfil-nombre-sin-email.sql` | Tras 3.20 | 1 nombre de perfil |
| 04 | `04-catalogo-orden-y-comprobaciones.sql` | Sección 6 | Nada (guía de `carga.sql` + `asignar-prod.sql`) |

### 7.1 Empresas sin slug (2) → `02-slugs-vacios.sql`

| Empresa | id | slug hoy | Nota |
| --- | --- | --- | --- |
| Diana cosméticos | `0f4f50df-7d26-423e-82ba-4d89685421f7` | `NULL` | Creada el 23/09 por una RPC de alta (esas RPC no generaban slug). 1 reseña, 0 redirecciones. |
| Auto Escuela Trébol | `ab51b04c-7631-44de-8a7f-c6852ac8ef40` | `''` (→ `NULL` tras 3.5) | Sin dueño, 109 reseñas, 2 filas en `url_redirects`. Darle slug cambia su URL canónica; la URL por nombre sigue funcionando (búsqueda por nombre + redirección a la canónica). |

Slugs: **`diana_cosmeticos`** y **`auto_escuela_trebol`** (los que generan
`opynio_slugify` y `utils/slugify.ts`). Releído el 24/09 por la noche: los dos
libres en `businesses`; **`auto_escuela_trebol` ya está en `url_redirects`
como `old_slug` de la MISMA empresa** (10/01/2026, 0 visitas). No choca: la
ficha busca primero por slug y solo después en `url_redirects`, así que esa
fila deja de usarse y la URL `…/auto_escuela_trebol`, que hoy funciona vía
redirección, pasa a ser la canónica. El fichero aborta si alguna redirección
con esos slugs apuntara a **otra** empresa. No toca `url_redirects` ni otros
slugs: huellas (hoy 1.017 slugs `e8d3a785…`, 881 redirecciones `6ac71569…`)
iguales antes y después.

A partir de 3.5, toda empresa nueva sin slug lo recibe en el `INSERT`.

### 7.2 Autorreseñas (1) → `01-rechazar-autoresena-129694.sql`

Solo hay una (releído el 24/09 por la noche, sin cambios): id **129694**, «El
negocio es mío.» (título y texto), 5 estrellas, `approved`, `source =
'opynio'`, 23/09 21:50 UTC, de la dueña de «Diana cosméticos»; sin imágenes,
votos ni apelaciones. 3.16 impide nuevas, pero no toca esta. El fichero la pasa
a `rejected` con `rejection_reason = 'Reseña del propio dueño de la empresa'`
(no la borra). No hace falta refrescar `business_metrics`: la empresa no está
en esa vista.

### 7.3 Por qué la dueña de «Diana cosméticos» veía «Reclamar»

- `owner_id` de la empresa = `063f97e8-5378-4724-bef5-08caf424587d` = id de la
  cuenta de la dueña (un Gmail; perfil `business_owner`, plan `free`).
  **Coinciden**: no es un problema de propiedad mal asignada.
- En master (`BusinessPage.tsx`, línea 1034) **y en el bundle desplegado**
  (`Z&&!Z.owner_id&&…`), el bloque «¿Eres el dueño?» solo depende de
  `!business.owner_id`, no de quién mira. Con los datos actuales **no puede
  aparecer en su ficha**. Todas las RPC de alta rellenan `owner_id` en el
  `INSERT`, así que tampoco hubo un momento sin dueño.
- Lo que sí falla en su ficha es el **slug `NULL`**: «Mis negocios» no ofrece
  enlace público cuando no hay slug y la ficha solo se alcanza por nombre. La
  explicación compatible con los datos es que viera el aviso en otra ficha sin
  dueño —p. ej. 3DSAT (`owner_id NULL`), donde escribió otra reseña a las 21:34—.
  **No es reproducible con los datos de hoy.**
- La rama lo cubre de todos modos: `useOwnBusiness` oculta «Reclamar» y muestra
  «Gestionar» si la empresa está entre las del usuario o `owner_id = user.id`
  (ficha, producto y búsqueda), y 3.5 + 7.1 le dan slug.

### 7.4 Autoría en las tarjetas

Nada que corregir:

- 0 reseñas con `user_id` sin perfil.
- 0 reseñas que se pintarían «Anónimo» sin serlo: las 7.957 de Opynio sin
  `user_id` tienen `original_author_name`; las 13 propias (10 aprobadas, 3
  rechazadas) tienen nombre de perfil.
- 41.863 importadas llevan el `user_id` de quien las importó **y**
  `original_author_name`: la regla nueva (`resolveReviewAuthor` /
  `widget_author_label`) muestra el nombre original.
- 18 de 45 perfiles sin `username` y 1 sin `name`: no afecta a ninguna reseña
  visible. No hay usernames duplicados (3.8 no choca con nada).
- **1 perfil con un email en el nombre** → `03-perfil-nombre-sin-email.sql`.
  Releído el 24/09 por la noche: es el único con `@` en `name` (id
  `bb43af41-…`, alta con Google el 15/08, 0 reseñas); su nombre es
  «<usuario>@icloud <apellido>» y queda «<usuario> <apellido>» con el patrón de
  3.20 (quitar los trozos `@…`). El nombre viene tal cual de Google
  (`raw_user_meta_data->>'full_name'` idéntico): de ahí lo recupera la marcha
  atrás, y por eso el fichero no lo escribe.

### 7.5 Otras

- 29 `google_maps_url = ''` y 1 `slug = ''`: los limpia 3.5.
- 39 reseñas etiquetadas «imágenes» sin imagen (sigue igual): procedimiento en
  [07-RELEASE-PRODUCTOS.md](./07-RELEASE-PRODUCTOS.md#después-de-desplegar-las-39-reseñas-que-mienten).

---

## 8. Acciones manuales en el Dashboard de Supabase (y Resend)

Independientes del resto del despliegue: el punto 1 y el 2 se pueden hacer ya
(no dependen de migraciones ni del front).

1. **Auth → URL Configuration → Redirect URLs**: añadir
   **`https://web.opynio.com/**`** (24/09 por la noche sigue solo
   `https://web.opynio.com` exacto; `site_url` = `https://web.opynio.com`).
   Arregla que «recuperar contraseña» y el login con Google vuelvan a la home en
   vez de a su ruta. Verificación: Dashboard (la lista muestra la nueva
   entrada) o `GET /config/auth` → `uri_allow_list` incluye
   `https://web.opynio.com/**`.
2. **Resend** (hoy «recuperar contraseña» falla en prod con **`Error sending
   recovery email`**; la parte de Supabase está bien: host
   `smtp.resend.com:587`, remitente `no-responder@auth.opynio.com`, contraseña
   puesta, 30 emails/h):
   - Resend → **Domains**: **`auth.opynio.com` verificado** (SPF, DKIM y, si lo
     pide, MX de retorno en verde). Si no lo está, añadir en el DNS los
     registros que indica Resend y esperar a que valide.
   - Resend → **API Keys**: la key usada como contraseña SMTP existe, está
     activa y tiene permiso de envío (*Sending access*) para ese dominio. Si hay
     que regenerarla, pegarla **directamente** en Dashboard → Auth → SMTP
     Settings → Password (usuario `resend`), nunca en el chat ni en ficheros.
3. **Logs → Auth**: pedir «recuperar contraseña» con una cuenta de prueba y
   buscar errores de envío (`Error sending recovery email`, 4xx/5xx de SMTP).
   El email debe llegar y su enlace abrir el formulario de nueva contraseña
   (esto último necesita el punto 1).

---

## 9. Pruebas de humo

- [ ] Home, directorio y una ficha cargan; el chip «Todas (N)» coincide con el total de la cabecera.
- [ ] Widget en una web de cliente: reseñas con nombre de autor, versión v6.10.5 (`window.OpynioWidgetVersion`).
- [ ] Usuario normal escribe una reseña → `pending`, `source = 'opynio'`, con foto si la adjunta (llega a `review_media`).
- [ ] Un dueño no puede reseñar su propia empresa (mensaje traducido).
- [ ] Autor borra una reseña suya pendiente desde su perfil; si tenía foto, desaparece de `review_media` (B9).
- [ ] Autor edita una reseña suya aprobada → vuelve a `pending` y la siguiente pasada del cron (a en punto) **no** la aprueba (3.21).
- [ ] Recuperar contraseña: llega el email y el enlace abre el formulario.
- [ ] Login con Google vuelve a `/post-acceso`.
- [ ] Cuenta enterprise: Productos lista el catálogo; los códigos solo los ve el dueño.
- [ ] Admin: Usuarios muestra emails y filtra; Destacados guarda el orden.
- [ ] `generate-sitemap` responde 200 sin autenticación; `/sitemap.xml` de la web es el dinámico (≥ 1.287 URLs, con fichas de producto tras 6.2).
- [ ] Checkout de Stripe se abre (cancelar sin pagar) y el portal vuelve a `/mis-negocios` (paso 0).
- [ ] Invitaciones: una cuenta `starter`+ envía una invitación a un correo propio y llega (3.17 + `send-invitation-email`).
- [ ] «Diana cosméticos» y «Auto Escuela Trébol» abren por su slug; la autorreseña 129694 ya no se ve (7.1, 7.2).

---

## 10. Fuera de alcance, detectado al preparar esto

No lo arregla este despliegue; conviene saberlo.

1. **Cron roto desde hace meses** (`cron.job_run_details`):
   - `monthly_rescrape` (día 1 de cada mes, 00:00): falla desde octubre de 2025
     (11 ejecuciones fallidas, `schema "secrets" does not exist`). El job llama a
     `monthly-rescrape-job` con `net.http_post` y arma
     `Authorization: Bearer ' || secrets.get('CRON_…')`, pero en producción **no
     existe el esquema `secrets`, `pg_net` no está activada** (disponible, sin
     instalar) y **Vault está vacío** (0 secretos). `CRON_SECRET` sí existe, pero
     solo como secreto de Edge Functions, que el SQL no puede leer. Último
     scrapeo: 17/10/2025; hay 0 empresas marcadas para el scrapeo mensual.
     Desplegar la función (y su `verify_jwt=false`) **no lo arregla**: haría
     falta activar `pg_net`, guardar `CRON_SECRET` en Vault y reescribir el job
     para leerlo de `vault.decrypted_secrets`. **Procedimiento opcional, con sus
     riesgos: 4.5.** (Releído el 24/09 por la noche: sigue igual; última
     ejecución fallida el 01/09/2026.)
   - `monthly_ai_credit_reset`: falla a diario (`column "ai_credits_last_reset"
     does not exist` en `businesses`).
   - `auto-migrate-slugs-daily` y `ping-sitemap-after-migration`: fallan
     (`schema "net" does not exist`: `pg_net` no está activada). **Ojo si se
     activa `pg_net`**: el primero llama a una función que cambia slugs (URLs)
     de empresas existentes; desactivarlos antes (4.5, riesgo 1).
2. **`approve_pending_reviews_hourly`** aprueba cada hora las reseñas
   `pending` con más de 24 h (`approve_old_pending_reviews()`). Por eso hay 0
   pendientes. Con la cola de moderación ya visible, decidir si se mantiene: hoy
   **toda reseña se publica sola al día siguiente** aunque nadie la mire. (3.21
   ya evita que una reseña editada se republique en menos de 24 h: cuenta desde
   `pending_since`, no desde el alta.)
3. Funciones desplegadas que no están en el repo: `auto-migrate-slugs`,
   `instant-process-urls` y `multi-source-review` (la vieja, sin comprobación de
   admin).
4. Dos secretos con un tabulador al final del nombre (`SMTP_USER`,
   `SUPPORT_EMAIL_RECIPIENT`). El código actual no los lee; limpiar cuando se toquen.
5. El esquema local (`docs/01-DATABASE-SETUP.md`, `scripts/local/`) usa `UUID`
   en `reviews`, `review_votes`, `review_appeals` y `business_claims`; producción
   usa `bigint` y no tiene `business_claims`. Las migraciones de esta rama ya
   toman el tipo de la tabla y valen en los dos (B1–B3), y para probar contra
   el esquema real está `opynio_prodlike` (3.0). Alinear el esquema local sigue
   pendiente: `scripts/local/pruebas.sql` y el front en local siguen usando ids
   `uuid`.

---

## 11. Vuelta atrás global

Orden inverso: **datos** (bloque D de cada `scripts/_datos-prod/0N-…sql`) →
**catálogo** (`desasignar-prod.sql` y después `rollback.sql`) → **front** (5.3)
→ **funciones** (4.4; `widget.js` en 4.1) → **SQL** en orden inverso con la
vuelta atrás de cada migración. Los pagos (paso 0) tienen su propia vuelta
atrás (P.4) y **no** se deshacen con el resto: volver a v25 deja los pagos
rotos. Para las migraciones de seguridad (3.4, 3.8, 3.10) es preferible
arreglar hacia delante: deshacerlas reabre fallos que un usuario normal puede
explotar con su propio token.

Filas que cambian (todo lo demás es esquema, permisos o configuración):
`businesses` en 3.5 (~30 filas: cadenas vacías a `NULL`) y 7.1 (2 slugs);
`reviews` solo en 7.2 (1 fila) y en el procedimiento opcional de 7.5;
`profiles` en 7.4 (1 nombre); `review_subjects` en 6.2 (4.143 filas nuevas) y
`review_subject_links` (667). Ninguna migración modifica filas de `reviews`
salvo 3.21, que rellena `pending_since` de las pendientes (0 el 24/09) y añade
la columna sin reescribir la tabla. Ninguna toca `url_redirects` ni slugs no
vacíos.

---

## Checklist de 1 página

Fecha: ____________ · Inicio: ______ · Responsable: ______________________ ·
`$ref = 'hvtrrhxeqrsnjxhngdsj'` · SQL: Dashboard → SQL Editor, un fichero por
ejecución. **Si algo no da lo esperado: parar** y mirar la sección indicada.

**Paso 0 · Pagos (P) — listo (4 funciones, sin migraciones)**

- [ ] Decidido el `return_url` del portal (`/mis-negocios`) · Starter anual revisado en Stripe (no bloquea)
- [ ] `npx supabase login` · `git status` de `_shared` y las 4 carpetas · `--dry-run`: checkout 3 · webhook 5 (`verify_jwt false`) · status 3 · portal 2 ficheros
- [ ] Deploy en este orden: `stripe-webhook --no-verify-jwt` → `get-checkout-status` → `create-checkout-session` → (`create-portal-session`)
- [ ] `functions list`: 32+ / v1 / 26+ / (22+); webhook sin VERIFY JWT, las otras con
- [ ] POST con anon key → 401 `"code":"unauthorized"` (checkout, status, portal) · webhook sin firma → 400 `invalid signature`
- [ ] Web: Precios → «Cambiar a Growth» abre Stripe Checkout; cerrar sin pagar

**Paso 0-bis · Hotfix fuga de emails — YA, antes que todo, independiente**

- [ ] SQL Editor: `scripts/_datos-prod/00-hotfix-fuga-emails.sql` entero → bloque C: 3 filas `anon`/`authenticated` `false`, `service_role` `true`
- [ ] `curl` con la anon key a `search_assignable_users` y `get_admin_users_paginated` → 401 `42501`

**Preparación (2)**

- [ ] Otros agentes terminados (B7) · `npm run verify` OK
- [ ] Backups: Dashboard (copia de hoy/PITR) · `db dump` esquema + datos · definiciones (2.0.2.2) · `functions download` · web entera por FileZilla

**Migraciones (3)** — cada fichero entero + su comprobación de la tabla 3.0

- [ ] 3.1 `20260915150000` · 3.2 `20260917120000` (NOTICE bigint) · 3.3 `20260917121000` · 3.4 `20260923120000`
- [ ] 3.5 `20260923130000` (huellas de slugs y redirecciones antes = después)
- [ ] 3.6 → 3.16 (`20260923140000` … `20260924130000`)
- [ ] 3.17 `20260924140000` (invitaciones) · 3.18 `20260924150000` (0 políticas permisivas)
- [ ] 3.19 `20260924160000` → 3.20 `20260924180000` → 3.21 `20260924190000` **sin pausa**, empezando a hh:05
- [ ] 3.22 `20260924200000` (sin efecto si 0-bis ya está) · 3.23 `20260924210000` (slug validado) · 3.23b `20260924230000` (destacadas) · 3.24 `20260924240000` · 3.25 `20260924250000` · 3.26 `20260924260000` (directorio; antes del front) · 3.27 `20260924270000` (distribución por producto; antes del front) · 3.28 `20260925100000` (preferencias del perfil; antes del front) · 3.29 `20260925110000` (solicitudes de soporte; antes del front; `notifications` en `supabase_realtime`)

**Funciones y widget (4)**

- [ ] 4.1 `check:widget` + `new Function` → subir **solo** `public/widget.js` → la web sirve v6.10.5
- [ ] 4.2 a `widget-proxy` · b `generate-sitemap` · c `monthly-rescrape-job` (las 3 con `--no-verify-jwt`)
- [ ] 4.2 d `send-invitation-email` (3.17 ya aplicada) · e el resto (`meta-capi`, `send-support-email`, admin…)
- [ ] 4.3 versiones · `widget_version` v6.10.5 · sitemap 200 (≥ 1.287) · CORS cerrado · monthly 401 · meta-capi `forwarded False`

**Front (5)**

- [ ] `.env`: solo 3 `VITE_*` públicas (mirar nombres, no valores) · `npx vite build` **sin** `--mode docker`
- [ ] Bundle con `hvtrrhxeqrsnjxhngdsj`, sin `localhost:54321`, sin claves, JWT solo `anon`
- [ ] Skill **`pre-commit-secret-scan`** sobre `dist/` · copia del servidor hecha (2.0.2.4)
- [ ] SQL 5.3.3.0: todo `true`
- [ ] FileZilla: `assets/` → resto (sin `index.html` ni `sitemap.xml`) → `index.html` el último
- [ ] Hash de `index-*.js` en la web = `dist` · `/sitemap.xml` sigue siendo el dinámico

**Catálogo (6) → `scripts/_datos-prod/04-…`**

- [ ] 6.1 `20260924100000` (code_privado) · `code` solo `postgres`/`service_role`
- [ ] 04.0 → `carga.sql` (psql) → 04.1: 4.143 · decidido 04.3 (15 de Google)
- [ ] `asignar-prod.sql` → 04.2: 667/667 · huella de reseñas por empresa igual · (04.3)

**Datos (7) → `scripts/_datos-prod/`** — A (mirar) → B → C

- [ ] 01 autorreseña 129694 → `rejected`
- [ ] 02 slugs `diana_cosmeticos` y `auto_escuela_trebol` (huellas iguales)
- [ ] 03 nombre del perfil `bb43af41…` sin `@`

**Dashboard y Resend (8)** — se puede adelantar

- [ ] Redirect URLs: `https://web.opynio.com/**`
- [ ] Resend: `auth.opynio.com` verificado · API key activa · el email de recuperación llega

**Pruebas de humo (9)**

- [ ] Todas las casillas de la sección 9

**Opcional · cron mensual (4.5)**

- [ ] Jobs 5 y 6 desactivados → `pg_net` → secreto en Vault → `CRON_SECRET` en Edge Functions → `alter_job` → prueba 200

Fin: ______ · Incidencias: ____________________________________________
