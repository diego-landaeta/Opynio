# Precios nuevos y prueba gratuita de 3 meses (issue #2)

Estado: **preparado y APAGADO**. Rama `feat/precios-y-prueba-3-meses`. Con los interruptores apagados (valor por
defecto) producción se comporta exactamente como hoy: 95 / 215 / 419 €, sin prueba, mismos Price IDs.
No se ha creado nada en Stripe, no se ha aplicado ninguna migración ni desplegado ninguna función.

## Qué se ha preparado

| Pieza | Fichero | Interruptor (apagado por defecto) |
|---|---|---|
| Precios y textos en la web | `utils/planPrices.ts` (fuente única); lo leen `PricingPage`, `DashboardBilling`, `PlanActivatedModal` y `BusinessListPage` | `NEW_PRICING_ENABLED = false` (**requiere build nuevo**) |
| Estado «te quedan X días» | `hooks/useTrialStatus.ts` | solo actúa con `NEW_PRICING_ENABLED` |
| Prueba de 90 días en el pago | `supabase/functions/create-checkout-session/index.ts` | secret `TRIAL_DAYS` (sin él, nada cambia) |
| Price IDs nuevos | `supabase/functions/_shared/stripePlans.ts` (`PLAN_PRICE_IDS` intacto) | 6 variables `STRIPE_PRICE_*_V2` (sin ellas, nada cambia) |
| Aviso a 7 días del fin | `supabase/functions/trial-ending-reminder/` + `_shared/brevo.ts` + migración `20261015110000_trial_reminders.sql` | solo actúa si hay cron que la llame |
| Textos en 31 idiomas | bloque `pricingPage` de `locales/*.ts` (14 claves nuevas) | se ven solo con el interruptor |

Constantes de `utils/planPrices.ts`: `PRICES_CURRENT` (95/215/419), `PRICES_NEW` (15/49/99), `ANNUAL_NEW`
(150/490/990, **propuesta sin confirmar**), `TRIAL_DAYS` (90), `TRIAL_REMINDER_DAYS` (7), `PRICES_INCLUDE_VAT`.
Los textos «Ahorra X €» y «Ahorra hasta un N %» se calculan a partir de `ANNUAL_NEW`: si cambia el descuento
solo se tocan esas cifras y el Price anual en Stripe.

## Pasos manuales, en este orden

Los importes que ve el cliente en la web **deben coincidir** con los Price de Stripe: lo que cobra es el Price,
no `planPrices.ts`.

### 0. Antes de empezar
Confirmar las decisiones pendientes (sección final) y hacer la prueba completa en modo test (sección «Cómo probar»).

### 1. Stripe: crear los 6 precios (en la misma cuenta que `STRIPE_SECRET_KEY`)
Dashboard → Catálogo de productos. En los productos que ya existen (Starter, Growth, Pro) → «Añadir otro precio».
Moneda EUR, recurrente. **No** poner prueba en el precio (la prueba la pone el checkout). Comportamiento fiscal
(`tax_behavior`) según la decisión de IVA; no se puede cambiar después.

| Plan | Mensual | Anual (propuesta) |
|---|---|---|
| Starter | 15 € / mes | 150 € / año |
| Growth | 49 € / mes | 490 € / año |
| Pro | 99 € / mes | 990 € / año |

Apuntar los 6 IDs (`price_...`). Los 6 deben empezar por el mismo segmento de cuenta que la clave
(hoy `RJqlZctcvh`); el anual de Starter actual (`GP3zN1neHA`) es de otra cuenta y por eso no sirve, no se reutiliza.

### 2. Stripe: portal del cliente
Ajustes → Facturación → Portal del cliente: permitir cancelar suscripciones y cambiar de plan, y **añadir los 6
precios nuevos** a los productos que se pueden elegir (sin eso el cambio de plan desde el portal falla). Dejar
también los antiguos mientras haya clientes con ellos.

### 3. Supabase: secrets (Edge Functions → Secrets)
Poner **todos a la vez**, justo antes de subir el build (paso 7):
`STRIPE_PRICE_STARTER_MONTHLY_V2`, `STRIPE_PRICE_STARTER_ANNUAL_V2`, `STRIPE_PRICE_GROWTH_MONTHLY_V2`,
`STRIPE_PRICE_GROWTH_ANNUAL_V2`, `STRIPE_PRICE_PRO_MONTHLY_V2`, `STRIPE_PRICE_PRO_ANNUAL_V2` y `TRIAL_DAYS=90`.
Existentes que se usan: `STRIPE_SECRET_KEY`, `CRON_SECRET`, `BREVO_API_KEY` (o la clave en Vault vía
`auth_email_secrets`). **Nunca poner `TRIAL_DAYS` sin los precios nuevos**: darías 3 meses gratis a los precios
antiguos. Hay que poner los 6 precios: si falta uno, ese ciclo sigue con el antiguo.

### 4. Supabase: migración
Aplicar `supabase/migrations/20261015110000_trial_reminders.sql` (crea `trial_reminders`, RLS activada sin
políticas; vuelta atrás al final del fichero). Antes de la primera ejecución de la función de aviso.

### 5. Desplegar funciones, desde el repo
Todas importan `_shared/stripePlans.ts`, que cambia: `create-checkout-session`, `create-portal-session`,
`get-checkout-status`, `stripe-webhook`. Y la nueva `trial-ending-reminder` (verify_jwt = false en `config.toml`, la
protege `CRON_SECRET`). Sin los secrets del paso 3 se comportan como hoy; pueden desplegarse con antelación.

### 6. Cron diario del aviso
Programar una llamada diaria (Supabase → Integraciones → Cron, o `pg_cron` + `pg_net`):
`POST https://<proyecto>.supabase.co/functions/v1/trial-ending-reminder` con cabecera
`Authorization: Bearer <CRON_SECRET>`. Primero con cuerpo `{"dryRun": true}`: lista a quién avisaría sin enviar
ni reservar. La respuesta trae `checked`, `sent`, `failed` y `skipped` por motivo.

### 7. Encender la web (nuevo build)
En `utils/planPrices.ts` poner `NEW_PRICING_ENABLED = true` (y revisar `ANNUAL_NEW`, `TRIAL_DAYS`,
`PRICES_INCLUDE_VAT`). `npx vite build`, `pre-commit-secret-scan` y subir `dist/` por FileZilla como siempre.
Hacer 3 y 7 seguidos y en hora de poco tráfico: entre uno y otro la web enseña un precio distinto del que cobra
(si pasa, es mejor cobrar menos que más: por eso los secrets van antes que el build).

### 8. Stripe: archivar los precios antiguos
**Solo después de verificar el paso 7 en real.** Archivar un Price no toca las suscripciones que ya lo usan, pero
impide contratarlo. Si se archiva antes de poner los secrets, el pago falla con `price_unavailable`.

### 9. Comprobar en real
Contratar cada plan, mensual y anual: 0 € hoy, suscripción en estado «En prueba», `trial_end` = hoy + 90 días y,
al acabar, el importe exacto del Price. Ver también la regresión de abajo.

## Cómo probar en modo test (tarjeta 4242 4242 4242 4242)

Usar un entorno de pruebas (proyecto Supabase aparte o local) con `STRIPE_SECRET_KEY` de **test**, los 6 precios
creados en modo test y sus secrets; build con el interruptor encendido. No mezclar claves de test con la BD de
producción.

1. Tarjeta `4242 4242 4242 4242`, cualquier fecha futura y CVC. Contratar un plan: Stripe muestra «0 € hoy» y la
   fecha del primer cobro. En el Dashboard la suscripción queda `trialing` con `trial_end` a 90 días.
2. En la web: `profiles.plan` correcto, panel Facturación y «Mis negocios» con «Prueba gratuita: te quedan 90 días ·
   después, plan Growth €49/mes» y el modal de plan activado con la nota de prueba.
3. Una sola prueba: cancelar desde el portal, volver a contratar: el checkout ya no tiene prueba (se cobra hoy).
4. Anual: con un reloj de prueba de Stripe (Test clocks) avanzar 90 días: el primer cobro es de 12 meses y el
   siguiente ciclo un año después.
5. Aviso: para no esperar 83 días, poner `TRIAL_DAYS=5` solo en el entorno de test, contratar y llamar a la función
   (con `dryRun` y sin él): llega el correo y una segunda llamada responde `ya_avisada`.
6. Con `TRIAL_DAYS` sin definir, el checkout cobra en el acto (regresión: igual que hoy).
7. Tarjeta de rechazo `4000 0000 0000 0341` al acabar la prueba: pasa a `past_due` como cualquier impago.

## Decisiones pendientes del responsable

1. **Descuento anual.** Propuesta «2 meses gratis» (≈17 %: 150 / 490 / 990 €), sin confirmar por Manuel. Hoy la web
   enseña el anual como mensual × 12 − 25 % (855 / 1.935 / 3.771 €) por una fórmula del front; no se ha comprobado
   qué importe tienen los Price anuales actuales en Stripe. Alternativas: 20 % (144 / 470,40 / 950,40) o mantener
   25 % (135 / 441 / 891). Se cambia en `ANNUAL_NEW` y en el Price anual de Stripe.
2. **Clientes que ya pagan 95 / 215 / 419.** Opciones: (a) dejarlos en su precio hasta que ellos cambien: queda
   absurdo, pagan 4-6 veces más que un cliente nuevo; (b) pasarlos al precio nuevo en su próxima renovación, sin
   prorrateo, avisando por correo; (c) pasarlos ya. **Recomendación: (b)**, con un script que cambie el Price de cada
   suscripción (`proration_behavior: none`) y un aviso previo. Los de pago anual ya pagado merecen decisión aparte
   (abono o dejar correr el año). No tienen prueba. El código actual no hace esta migración.
3. **IVA incluido o no.** `create-checkout-session` no activa Stripe Tax: hoy el cliente paga exactamente el
   importe del Price. Por eso `PRICES_INCLUDE_VAT = true` («Precios con IVA incluido») es lo único veraz con el
   código actual. Si se decide «sin IVA», hay que activar Stripe Tax, crear los Price con `tax_behavior: exclusive`,
   añadir `automatic_tax` (y recogida de dirección) al checkout y poner la constante a false. No está hecho.
4. **Quién tiene prueba.** Implementado: una por usuario/customer de Stripe; no se da a quien ya tuvo cualquier
   suscripción (BD o Stripe) o prueba, y ante cualquier duda de comprobación no se da. Una persona con otra cuenta de
   correo puede conseguir otra prueba; la issue dice «una por empresa» y hoy la suscripción es por usuario.
5. **Meta Pixel / Conversions API.** El webhook manda un Purchase con el importe completo del plan en cuanto se
   confirma el pago, aunque en prueba se cobre 0 €, y el Pixel del navegador manda el importe de la sesión (0 €) con
   el mismo `event_id`. Decidir si en prueba se informa `StartTrial`/0 € para no inflar conversiones. No se ha tocado.

## Qué falta o depende de comprobarse

- «Te quedan X días» lee `subscriptions` (`status = trialing`, `current_period_end` = fin de prueba) con la sesión del
  usuario. Depende de que en producción exista la política RLS «Users can view own subscriptions»; si no, no
  aparece nada (nunca inventa un dato) y haría falta una columna en `profiles` o una RPC. No verificado.
- La RPC `process_checkout_completion` recibe `p_status = 'trialing'`: el enum `subscription_status` de producción
  debe incluirlo. No verificado (el webhook ya trata `trialing` como plan vivo).
- El correo enlaza a `/es/mis-negocios` (botón «Gestionar facturación», que abre el portal de Stripe), no directamente
  al portal: la URL del portal caduca en minutos y requiere sesión. Va en español, o en inglés si el perfil tiene otro
  idioma guardado; no hay plantilla en los 31 idiomas.
- Los correos existentes (`send-auth-email`, invitaciones, plantillas de `docs/email-templates`) no contienen precios
  de planes; el único correo nuevo es el aviso.
- `PaymentSuccessPage` no menciona la prueba (solo el modal de plan activado y el panel).
