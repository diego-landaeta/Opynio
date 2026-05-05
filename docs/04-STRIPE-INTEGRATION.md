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
- **Validaciones server-side**:
  - Plan ∈ {starter, growth, pro}; cycle ∈ {monthly, annual}.
  - Si `businessId`, verifica `owner_id == auth.uid()`.
  - Si `businessData`, valida `business_limit` antes de cobrar.
  - **Anti-duplicado**: si el usuario tiene una sub `active|trialing` con el
    mismo `price_id`, responde **409 `duplicate_subscription`** y devuelve el
    `subscription_id` para que el cliente abra el portal.
- **Idempotencia**:
  - `stripe.customers.create({...}, { idempotencyKey: 'create-customer-{userId}' })`
  - `stripe.checkout.sessions.create({...}, { idempotencyKey: 'checkout-{userId}-{plan}-{cycle}-{biz}-{Hbucket}' })`
- **CORS**: `Access-Control-Allow-Origin` restringido a whitelist de Origins.
- **`success_url`/`cancel_url`**: usan el origin validado, no el header crudo.
- **Metadata enviada a Stripe** (50 keys / 500 chars máx):
  - `supabase_user_id` (siempre)
  - `business_id` (flujo upgrade)
  - `is_new_business=true` + `business_*` campos (flujo creación de negocio)

### 2.2. `create-portal-session` (verify_jwt: true)

Abre el Stripe Customer Portal. Crea customer al vuelo si no existe (con
idempotency key). CORS y `return_url` whitelisted.

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
| `customer.subscription.created` | UPSERT sub + sync profile |
| `customer.subscription.updated` | UPSERT sub + sync profile |
| `customer.subscription.deleted` | mark canceled + downgrade profile a free |
| `invoice.paid` | UPSERT sub + sync profile (renovación) |
| `invoice.payment_failed` | actualiza `status` a past_due/unpaid |
| `checkout.session.async_payment_succeeded` | sync sub (SEPA/Bizum tardío) |
| `checkout.session.async_payment_failed` | log only |

#### Idempotencia

Cada handler arranca con `claimEvent(event.id)`:
1. INSERT en `processed_webhook_events(event_id PK)`.
2. Si unique_violation (23505) → evento ya procesado → 200 OK silencioso.
3. Si el handler falla, el catch hace **DELETE del lock** → Stripe puede
   reintentar y reprocesar.

Adicionalmente, `checkout.session.completed` consulta `subscriptions.id` antes
de crear el negocio: si la sub existía (porque `subscription.created` llegó
primero), pasa `already_processed=true` a la RPC y NO duplica el `business`.

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
annual. Los IDs viven en
`supabase/functions/create-checkout-session/index.ts` → `PLAN_PRICE_IDS`. El
frontend NUNCA envía price IDs; solo `{ plan, billingCycle }`.

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
3. Si difiere → checkout → `customer.subscription.updated` actualiza el plan.

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
