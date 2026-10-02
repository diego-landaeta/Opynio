# Integración de Stripe en Opynio

Estado: producción. Última auditoría 2026-05-05.

Este documento describe la arquitectura final de cobros con Stripe + Supabase.

---

## 1. Modelo de datos

**Fuente de la verdad:** la tabla `subscriptions`. El campo `profiles.plan` (y
`billing_cycle`, `plan_expires_at`) es un **mirror derivado** que el webhook
mantiene sincronizado para consultas rápidas en el cliente.

| Tabla | Rol | Origen de filas |
|---|---|---|
| `customers` | Mapea `auth.users.id` ↔ `stripe_customer_id` | `create-checkout-session` / `create-portal-session` |
| `products` | Replica de Stripe products | webhook (upsert) |
| `prices` | Replica de Stripe prices | webhook (upsert) |
| `subscriptions` | Estado de suscripción del usuario | webhook (upsert) |
| `processed_webhook_events` | `event_id` ya procesados (idempotencia) | webhook |
| `profiles` | Perfil de usuario; `plan/billing_cycle/plan_expires_at` mirror | webhook actualiza, RLS impide al cliente cambiarlos |

**Reglas RLS clave:**
- `processed_webhook_events`: solo `service_role`.
- `prices`/`products`: SELECT público.
- `subscriptions`: SELECT del propio usuario.
- `profiles`: el trigger `guard_profile_sensitive_columns` impide al cliente
  cambiar `plan`/`role`/`business_limit`/etc. — solo `service_role` y `admin`.

---

## 2. Edge Functions

### 2.1. `create-checkout-session` (verify_jwt: true)

Crea una Stripe Checkout Session.

- **Input**: `{ plan, billingCycle, businessId | businessData }`.
- **Validaciones server-side** (en este orden):
  - Plan ∈ {starter, growth, pro, v2}; cycle ∈ {monthly, annual}. Los price IDs
    viven en `supabase/functions/_shared/stripePlans.ts`.
  - **Una sola suscripción por usuario** (24/09/2026): si tiene **cualquier**
    suscripción viva (`active|trialing|past_due`), no se crea Checkout. Se mira
    en Stripe (`subscriptions.list` del customer + `retrieve` de las que la BD da
    por vivas y no salen en la lista); si Stripe no responde, vale la BD.
    Responde **409**: `duplicate_subscription` si es el mismo price,
    `has_active_subscription` si es otro. El front abre el portal para cambiar
    de plan (2.2). Antes «Mejorar a X» abría un Checkout nuevo con una
    suscripción activa: el usuario acababa con dos y se le cobraban las dos.
  - Si `businessId`, verifica `owner_id == auth.uid()`.
  - Si `businessData`, valida `business_limit` y que **no exista ya una empresa
    con ese nombre** (sin mayúsculas ni espacios de los extremos) antes de
    cobrar: **400 `business_name_taken`** con
    `existing_business: { name, slug, country, claimable }` (`claimable` = sin
    dueño). En producción `businesses.name` es UNIQUE (`businesses_name_key`):
    sin esta comprobación el webhook no podía crear la empresa, respondía 500
    durante días y el cliente quedaba cobrado sin empresa, rol ni plan.
  - El price existe y está activo en la cuenta de `STRIPE_SECRET_KEY`; si no,
    **500 `price_unavailable`** con el motivo en el log (ver sección 4).
- **Idempotencia**:
  - `stripe.customers.create({...}, { idempotencyKey: 'create-customer-{userId}' })`
  - `stripe.checkout.sessions.create({...}, { idempotencyKey: 'checkout-{userId}-{plan}-{cycle}-{biz}-{Hbucket}' })`
- **CORS**: `Access-Control-Allow-Origin` restringido a whitelist de Origins.
- **`success_url`/`cancel_url`**: usan el origin validado, no el header crudo.
- **Metadata enviada a Stripe** (50 keys / 500 chars máx):
  - `supabase_user_id` (siempre)
  - `business_id` (flujo upgrade)
  - `is_new_business=true` + `business_*` campos (flujo creación de negocio)
- **Errores**: siempre JSON `{ error, code, details }`. El front
  (`utils/userFacingError.ts`) decide mensaje y acción por `code`, nunca por el
  texto: `stripe_not_configured` 500, `unauthorized` 401, `invalid_request` /
  `invalid_plan` / `invalid_business_data` 400, `business_limit_reached` 400,
  `business_name_taken` 400 (no 409: 409 abre el portal),
  `business_not_found` 403, `duplicate_subscription` y
  `has_active_subscription` 409 (el front abre el portal),
  `price_unavailable` 500 (el price no existe o está archivado en la cuenta de
  la clave; el front dice que ese plan no se puede contratar con esa modalidad,
  sin cargo, y sugiere la otra o Soporte: `userErrors.planUnavailable`),
  `stripe_error` 502, `internal_error` 500. El detalle de Stripe o
  de la BD va solo al log de la función.
- **Desplegar siempre desde el repo.** Del 19/05/2026 al menos hasta el
  24/09/2026 producción tuvo una versión antigua que exigía `priceId`: el front
  nunca lo manda, así que todos los pagos respondían 400 («Faltan 'priceId' o
  'businessId'») y el usuario veía «Edge Function returned a non-2xx status code».

### 2.2. `create-portal-session` (verify_jwt: true)

Abre el Stripe Customer Portal. Crea customer al vuelo si no existe (con
idempotency key). CORS y `return_url` whitelisted. Errores con los mismos
`code` (`stripe_not_configured`, `unauthorized`, `stripe_error`, `internal_error`).

**Cambio de plan** (24/09/2026): cuerpo opcional `{ plan, billingCycle }`
(lo manda `PricingPage` tras el 409 de checkout). Si el usuario tiene **una**
suscripción viva con **un** item y otro price, el portal se abre directamente
en la confirmación del cambio (`flow_data.type = subscription_update_confirm`
con el price destino): Stripe enseña el prorrateo y el importe, resuelve 3DS
si hace falta y el usuario confirma. Si Stripe rechaza ese flujo (cambio de
plan desactivado en la configuración del portal, o el price no está entre sus
productos) se prueba `subscription_update` y, si tampoco, el portal normal.
Con varias suscripciones vivas se abre el portal normal (para cancelar una).
El cambio llega por `customer.subscription.updated` + `invoice.paid`.
No se usa `stripe.subscriptions.update` directo: cobraría con un clic, sin
pantalla de confirmación, y un 3DS fallido dejaría la suscripción en
`past_due` sin forma de completarlo. `return_url` no cambia.

### 2.2 bis. `get-checkout-status` (verify_jwt: true)

La usa `/pago-exitoso` para confirmar **esa** sesión de pago (`session_id` de
la URL). Solo lectura. `stripe.checkout.sessions.retrieve(session_id)` y:

- la sesión es del usuario (`metadata.supabase_user_id`, o su customer si no
  hay metadata); si no, **404 `checkout_session_not_found`** (igual que si no
  existiera);
- `paid` = `status complete` y `payment_status paid|no_payment_required`;
- `ready` = pagada **y** el webhook ya la aplicó: su suscripción está en la BD
  y viva, `profiles.plan` es el plan de esa suscripción y, en un alta de
  empresa, la empresa existe (nombre pedido o con sufijo « (2)»…) y el rol es
  `business_owner`;
- devuelve `amount`/`currency` de la sesión para el Purchase del Pixel.

La página sondea con espera creciente (~85 s) y botón «Volver a comprobar».
Sin `ready` no confirma ni manda Purchase; si está pagada pero sin aplicar
dice «pago recibido, terminando de activar; no vuelvas a pagar» y ofrece
Soporte. Antes bastaba cualquier suscripción activa de las últimas 48 h: se
confirmaba antes de que existiera la empresa (y «Mis negocios» rebotaba) o con
la suscripción de un pago anterior (Purchase con el precio viejo).

### 2.3. `stripe-webhook` (verify_jwt: false)

Endpoint público que Stripe llama. **Verifica firma** con
`STRIPE_WEBHOOK_SIGNING_SECRET`. URL:

```
https://hvtrrhxeqrsnjxhngdsj.supabase.co/functions/v1/stripe-webhook
```

#### Eventos manejados

| Evento | Acción |
|---|---|
| `checkout.session.completed` | RPC `process_checkout_completion` (5 writes en transacción) |
| `customer.subscription.created` | UPSERT sub + sync profile (si es la principal) |
| `customer.subscription.updated` | UPSERT sub + sync profile (si es la principal) |
| `customer.subscription.deleted` | mark canceled + free **solo si no le queda otra viva**; si queda, plan de la otra |
| `invoice.paid` | UPSERT sub + sync profile (renovación; si es la principal) |
| `invoice.payment_failed` | actualiza `status` a past_due/unpaid |
| `checkout.session.async_payment_succeeded` | sync sub (SEPA/Bizum tardío; si es la principal) |
| `checkout.session.async_payment_failed` | log only |

#### Varias suscripciones vivas (`subscriptionSync.ts`)

Checkout ya no deja crear una segunda, pero puede haber usuarios que la
tengan. La **principal** es la viva más reciente (`active|trialing` antes que
`past_due`; dentro, `created` más nuevo). Solo la principal escribe
`profiles.plan`: la renovación de la antigua ya no devuelve el perfil al plan
viejo. En `deleted`, si queda otra viva (comprobada con
`stripe.subscriptions.retrieve`: una fila local desfasada se corrige y se
descarta), el perfil pasa a su plan; si no queda ninguna, `free`.

#### Alta pagada con nombre o URL de Maps ya usados (`checkoutCompletion.ts`)

Si el INSERT de la empresa en la RPC da 23505:

- sobre `google_maps_url` → se repite sin la URL (aviso en el log);
- sobre el nombre (`businesses_name_key` en producción; se detecta por la
  columna del `details`, no por el nombre del constraint) → se repite como
  «Nombre (2)», «Nombre (3)»… hasta «(10)» y, si todos están ocupados, como
  «Nombre (<últimos 10 caracteres del id de la suscripción>)»
  (`lastResortBusinessName`): único por pago y estable entre reintentos. Aviso
  en el log con usuario y sub. Así ningún cobro se queda sin empresa por el
  nombre (antes: 500 y Stripe reintentando durante días).

No se asigna la empresa existente sin dueño: sería saltarse la verificación
de reclamaciones (cualquiera podría quedarse con la ficha de otro pagando un
plan con su nombre). El admin decide después si fusiona o renombra. Es el
último recurso: `create-checkout-session` ya rechaza el nombre antes de cobrar;
esto cubre la carrera entre la sesión de pago y el webhook.

#### Idempotencia

Cada handler arranca con `claimEvent(event.id)`:
1. INSERT en `processed_webhook_events(event_id PK)`.
2. Si unique_violation (23505) → evento ya procesado → 200 OK silencioso.
3. Si el handler falla, el catch hace **DELETE del lock** → Stripe puede
   reintentar y reprocesar.

Adicionalmente, `checkout.session.completed` comprueba si la **empresa** de
ese checkout ya existe (del usuario, creada después de abrir la sesión, con el
nombre pedido, con sufijo « (2)»… o con el de último recurso) y en ese caso pasa
`already_processed=true` a la RPC para no duplicarla. (Antes miraba
`subscriptions.id`, pero `subscription.created` suele llegar primero y la
empresa no se creaba nunca.)

#### Lectura forward-compat de `current_period_*`

Stripe API 2025-03-31 movió `current_period_start/end` desde la subscription
al primer item. Lectura defensiva:

```ts
const start = item.current_period_start ?? subscription.current_period_start;
const end   = item.current_period_end   ?? subscription.current_period_end;
```

### 2.4. `repair-stripe-orphans` (verify_jwt: true, admin-only)

Edge Function de reconciliación. Para cada `customer` (o uno solo si pasas
`{ user_id }`), lista sus suscripciones en Stripe y rellena
`products`/`prices`/`subscriptions`. Usar tras incidencias o restauraciones
de backup.

```bash
curl -X POST https://hvtrrhxeqrsnjxhngdsj.supabase.co/functions/v1/repair-stripe-orphans \
  -H "Authorization: Bearer <ADMIN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"<UUID>"}'   # body vacío → repara TODOS
```

Devuelve un `report` por customer con `synced` y `error` si lo hubo.

---

## 3. RPC `process_checkout_completion`

`SECURITY DEFINER` con `EXECUTE` solo a `service_role`/`postgres`. Hace en
una sola transacción:

1. UPSERT `products`
2. UPSERT `prices` (FK a products)
3. UPSERT `subscriptions` (FK a prices)
4. INSERT `businesses` si `is_new_business AND NOT already_processed`
5. UPDATE `profiles` (plan + billing_cycle + plan_expires_at, role si new biz)

Si cualquier paso falla, **rollback** completo. Esto cierra la inconsistencia
histórica donde podía quedar `profile.plan='pro'` sin fila en `subscriptions`.

---

## 4. Configuración requerida en Stripe Dashboard

### Webhooks

URL: `https://hvtrrhxeqrsnjxhngdsj.supabase.co/functions/v1/stripe-webhook`

Eventos a habilitar:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`

Copiar el "Signing secret" (whsec_...) al secret `STRIPE_WEBHOOK_SIGNING_SECRET`
del proyecto Supabase.

### Secrets de Supabase Edge Functions

- `STRIPE_SECRET_KEY` — clave secreta de Stripe (sk_live_...).
- `STRIPE_WEBHOOK_SIGNING_SECRET` — del endpoint webhook configurado.
- `SITE_URL` (opcional) — URL canónica del frontend.

### Productos y Prices

Cada plan (Starter, Growth, Pro) debe tener exactamente dos prices: monthly y
annual. Los IDs viven en `supabase/functions/_shared/stripePlans.ts` →
`PLAN_PRICE_IDS` (compartido por checkout, portal, `get-checkout-status` y el
webhook, que deduce el plan del price y, si no lo conoce, del nombre del
producto). El frontend NUNCA envía price IDs; solo `{ plan, billingCycle }`.

> **PENDIENTE — confirmar en el Dashboard de Stripe (cuenta en vivo):**
> `starter.annual = price_1TTo2CGP3zN1neHAplpNdMDD`. Su segmento de cuenta
> (`GP3zN1neHA`) no coincide con el del resto de prices (`RJqlZctcvh`):
> probablemente es de la cuenta de Stripe antigua. Si no existe en la cuenta
> de `STRIPE_SECRET_KEY`, «Starter anual» responde `price_unavailable` (500,
> sin cargo; el front nuevo dice «Este plan no se puede contratar ahora mismo
> con esta modalidad de facturación… prueba la otra (mensual o anual) o
> escríbenos a soporte») y el log de
> `create-checkout-session` dice `Price price_1TTo2C… (starter/annual) no
> disponible en Stripe [resource_missing: …]`. Arreglo: Dashboard → Productos
> → Starter → copiar el ID del price anual → sustituirlo en `stripePlans.ts` y
> redesplegar las cuatro funciones de pago. Los demás planes no se ven
> afectados.

### Customer Portal (cambio de plan)

Dashboard → Settings → Billing → Customer portal:

- **Customers can switch plans** activado, con los productos Starter, Growth
  y Pro y sus prices mensual y anual. Sin esto `create-portal-session` cae al
  portal normal (el usuario puede cancelar pero no cambiar de plan desde ahí).
- Prorrateo: el que se quiera cobrar (por defecto «prorate charges»); el
  portal enseña el importe antes de confirmar.
- Opcional: limitar a **una suscripción por cliente** en la configuración de
  Checkout/portal si Stripe lo ofrece para la cuenta; el código ya lo impide
  salvo en la carrera de dos pestañas con Checkout abierto a la vez.

---

## 5. Flujos UX

### 5.1. Usuario nuevo elige plan pago

1. `PricingPage` → CTA → `/registro?type=business&plan=growth&billingCycle=monthly`.
2. Tras registro/login → `/asignar-empresa?plan=growth&billingCycle=monthly`.
3. `AssignBusinessPage` rellena formulario y manda
   `create-checkout-session` con `businessData`.
4. Stripe Checkout. Tras pago, webhook crea el `business` + activa el plan.

### 5.2. Usuario logueado con negocio cambia plan

1. `PricingPage` → `handleUpgradeExistingBusiness`.
2. Si plan+ciclo coincide con la sub activa → mostrar botón "Gestionar
   facturación" (abre portal en lugar de re-checkout).
3. Si difiere y ya paga otro plan → `create-checkout-session` responde 409
   `has_active_subscription` → el front abre `create-portal-session` con
   `{ plan, billingCycle }` → confirmación del cambio en el portal (prorrateo)
   → `customer.subscription.updated` actualiza el plan. Sin suscripción viva
   (plan free) → Checkout normal.

### 5.2 bis. Usuario que ya paga añade otra empresa

«Añadir empresa» en Mis negocios lleva a `/asignar-empresa?plan=<su plan>`.
Si `profile.plan` es ese mismo plan de pago, `AssignBusinessPage` crea la
empresa **sin Checkout** con la RPC `upgrade_user_to_business_owner`, que
aplica el límite de empresas del plan real del perfil (ignora `p_plan`); el
botón dice «Crear negocio». Antes abría un Checkout nuevo: una segunda
suscripción y doble cobro por una empresa que el plan ya incluía (ahora ese
Checkout respondería 409). Con otro plan en la URL sigue el Checkout, que da
409 `has_active_subscription` si ya paga uno.

### 5.3. Usuario gestiona suscripción

`DashboardBilling` → "Gestionar suscripción" → `create-portal-session` →
Stripe Portal. Botón deshabilitado para `free` y `enterprise`.

### 5.4. Cancelación

Usuario cancela en el portal → Stripe envía `customer.subscription.updated`
con `cancel_at_period_end=true`. Sigue activo hasta final de periodo. Al
expirar, `customer.subscription.deleted` baja `profile.plan` a `free`.

---

## 6. Operativa

### Verificar estado de un usuario

```sql
SELECT p.id, p.plan, p.billing_cycle, p.plan_expires_at,
       s.id AS sub_id, s.status, s.price_id, s.current_period_end
FROM public.profiles p
LEFT JOIN public.subscriptions s ON s.user_id = p.id
WHERE p.id = '<UUID>';
```

### Detectar huérfanos (plan ≠ free sin sub)

```sql
SELECT p.id, p.plan, p.plan_expires_at
FROM public.profiles p
LEFT JOIN public.subscriptions s ON s.user_id = p.id
WHERE p.plan IN ('starter','growth','pro')
  AND s.id IS NULL;
```

Si aparece alguno, invocar `repair-stripe-orphans` con `{ user_id }`.

### Inspeccionar eventos procesados

```sql
SELECT type, COUNT(*), MAX(processed_at) AS last_event
FROM public.processed_webhook_events
GROUP BY type
ORDER BY last_event DESC;
```

---

## 7. Cambios recientes

**2026-09-24 — Hotfix de pagos (antes de redesplegar desde el repo)**
- `create-checkout-session`: una sola suscripción por usuario (409
  `has_active_subscription` → portal); `business_name_taken` (400) antes de
  cobrar; price archivado → `price_unavailable`.
- `create-portal-session`: `{ plan, billingCycle }` opcional → confirmación del
  cambio de plan en el portal (`flow_data`), con caída al portal normal.
- `get-checkout-status` (nueva): `/pago-exitoso` confirma ESA sesión, espera a
  la empresa y al rol en un alta, y manda el Purchase con su importe.
- `stripe-webhook`: nombre duplicado → «Nombre (2)»… «(10)» y, en último
  recurso, «Nombre (<final del id de la sub>)» (nunca un cobro sin empresa); con
  varias suscripciones solo la principal escribe el plan; `deleted` no baja a
  free si queda otra.
- Front: `AssignBusinessPage` crea sin Checkout la empresa de quien ya paga ese
  plan (5.2 bis); `price_unavailable` con mensaje propio en los 31 idiomas.
- `_shared/stripePlans.ts` y `_shared/businessName.ts`: mapa de prices y
  reglas de nombre compartidos.
- Despliegue: las cuatro funciones (`stripe-webhook`, `get-checkout-status`,
  `create-checkout-session` y, si se aprueba su `return_url`,
  `create-portal-session`) **antes** que el front. Sin migraciones. Pasos y
  comprobaciones: `docs/DESPLIEGUE-2026-09.md`, paso 0.

**2026-05-05 — Lote 1 (P0)**
- Tabla `processed_webhook_events` + RPC transaccional `process_checkout_completion`.
- Webhook con idempotencia atómica + `subscription.created` + UPSERTs + lectura
  forward-compat de `current_period_*`.
- Anti-duplicado server-side en `create-checkout-session` (409).
- `idempotencyKey` en customer/checkout creation.
- CORS + Origin whitelist en checkout y portal.
- Edge Function admin `repair-stripe-orphans` para reconciliación.
- Frontend: `DashboardBilling/Overview/Reviews` leen `profile` (no `business`);
  `PricingPage` ofrece "Gestionar facturación" cuando el plan ya está activo;
  `AssignBusinessPage` propaga `billingCycle`.
- `incrementAiCredits` reescrito para usar la RPC server-side.

**2026-05-05 — Lote 2 (P1)**
- Botón "Gestionar suscripción" deshabilitado para enterprise.
- `creditResetDate` con clamping (no desborda en meses cortos).
- Webhook maneja `checkout.session.async_payment_*`.
- `STRIPE_PRICE_IDS` cliente eliminado (vivía duplicado en `constants.ts`).
- `loadStripe` muerto eliminado de `AssignBusinessPage`.
