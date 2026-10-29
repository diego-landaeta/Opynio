# Precios nuevos y prueba gratuita de 3 meses: receta de despliegue (issue #2)

Estado: **ACTIVO en el código** (`NEW_PRICING_ENABLED = true`, `TRIAL_DAYS = 90`). El dueño ya archivó los precios
antiguos en Stripe, así que hasta que se despliegue esto **no se puede contratar ningún plan**: el código en producción
solo conoce los IDs antiguos. Este documento es la receta, en orden. Solo aparecen **nombres** de variables y secrets;
los valores secretos (claves de Stripe, Brevo, `CRON_SECRET`) no se escriben aquí ni en el chat.

| Plan | Mensual | Anual |
|---|---|---|
| Starter | 15 € | 150 € |
| Growth | 49 € | 490 € |
| Pro | 99 € | 990 € |

Los importes están en **una sola fuente** (`utils/planPrices.ts`: `PRICES_NEW`, `ANNUAL_NEW`). Cada uno debe coincidir con el
importe del Price de Stripe: la web enseña la constante y Stripe cobra el Price. IVA incluido (`PRICES_INCLUDE_VAT = true`:
el checkout no activa Stripe Tax, el cliente paga exactamente el importe del Price).

## Orden crítico

**Secrets y funciones ANTES que el frontend.** Si se sube el frontend primero, la web anuncia precios que el servidor
todavía no sabe cobrar. Si se ponen los secrets y las funciones primero, solo se arreglan cosas (hoy ya no se cobra nada).

## Pendiente: Growth anual y Pro anual (hasta que llegue el ID de Diego)

El dueño envió el **mismo** Price ID (`price_1UTNitRJqlZctcvhrQDsKCAX`, producto `prod_VUMROu9Wcp88wy`) para Growth anual
y para Pro anual: es un error de copia, solo se creó uno de los dos. **No se inventa ni se copia a las dos variables.**
Comportamiento deliberado hasta entonces:

- **Servidor** (`supabase/functions/_shared/stripePlans.ts`): si dos variables `STRIPE_PRICE_*_V2` tienen el mismo valor,
  se ignoran las dos, se escribe un `ERROR DE CONFIGURACION` en el log de la función y esos ciclos quedan **bloqueados**:
  el checkout responde `price_unavailable` («Este plan no está disponible ahora mismo… No se ha realizado ningún cargo»)
  **sin crear sesión de pago**, y el webhook nunca resuelve ese ID a un plan. Los otros cuatro precios no se ven afectados.
- **Web** (`utils/planPrices.ts`, constante `AVAILABLE_BILLING_CYCLES`): `growth.annual` y `pro.annual` están en `false`.
  Mientras el anual no esté disponible en **los tres** planes no se enseña el interruptor «Mensual / Anual» (ni en `/planes`
  ni en las pantallas con candado): se ofrece solo el pago mensual y nadie llega a un error. Un enlace antiguo con
  `?billingCycle=annual` cae al mensual en «asignar empresa». Starter anual sigue funcionando en el servidor, pero queda
  sin ofrecer hasta que el anual esté en los tres.

### Cuando llegue el ID correcto
1. Abrir ese Price en Stripe y mirar **a qué producto pertenece y cuánto cuesta**. El ID duplicado de arriba es el correcto
   de **uno** de los dos (Growth anual: 490 €/año, o Pro anual: 990 €/año); Diego pasa el del otro.
2. Poner las dos variables, cada una con su ID: `STRIPE_PRICE_GROWTH_ANNUAL_V2` y `STRIPE_PRICE_PRO_ANNUAL_V2`.
3. Volver a desplegar las funciones del paso 4 (leen el entorno al arrancar). En los logs de `create-checkout-session` no debe
   salir ningún `ERROR DE CONFIGURACION`.
4. Probar los dos ciclos abriendo el checkout sin pagar (paso 9).
5. En `utils/planPrices.ts` poner `growth.annual` y `pro.annual` a `true`, `npx vite build` y subir el frontend. Aparece el
   interruptor Mensual/Anual (con «Ahorra hasta un 17 %», «Ahorra X €» y «el año empieza al acabar la prueba»).

## Pasos de hoy, en este orden

### 1. Stripe: comprobar los precios (Dashboard → Catálogo de productos, cuenta de `STRIPE_SECRET_KEY`)
Abrir uno a uno y comprobar importe, moneda (EUR), intervalo y que **no lleven prueba en el propio precio** (la prueba la
pone el checkout):

| Plan y ciclo | Variable (Supabase) | Price ID recibido | Debe ser |
|---|---|---|---|
| Starter mensual | `STRIPE_PRICE_STARTER_MONTHLY_V2` | `price_1UTNXMRJqlZctcvhhWNXiz29` | 15 € / mes |
| Starter anual | `STRIPE_PRICE_STARTER_ANNUAL_V2` | `price_1UTNfARJqlZctcvh90DlreIc` | 150 € / año |
| Growth mensual | `STRIPE_PRICE_GROWTH_MONTHLY_V2` | `price_1UTNaERJqlZctcvhFHmmiuMG` | 49 € / mes |
| Growth anual | `STRIPE_PRICE_GROWTH_ANNUAL_V2` | **pendiente** (ver arriba) | 490 € / año |
| Pro mensual | `STRIPE_PRICE_PRO_MONTHLY_V2` | `price_1UTNcARJqlZctcvhPItAtPjG` | 99 € / mes |
| Pro anual | `STRIPE_PRICE_PRO_ANNUAL_V2` | **pendiente** (ver arriba) | 990 € / año |

Los IDs de la tabla son identificadores públicos (no son secretos) y se copiaron de un mensaje: **copiarlos desde el
Dashboard**, no de este documento, y comprobar que cada uno empieza por `price_`. Si alguno tuviera una errata, el checkout
de ese plan fallará con «No such price» en el log de la función (paso 9 lo detecta antes de que pague nadie).

### 2. Stripe: portal de cliente
Ajustes → Facturación → Portal de cliente: permitir cancelar y cambiar de plan, y **añadir los precios nuevos** a los
productos que se pueden elegir (sin eso el cambio de plan desde el portal falla). Hoy: los 4 de la tabla; cuando llegue el ID,
los 6. Dejar también los antiguos en el portal: hay clientes que siguen cobrando con ellos (archivar un Price no toca las
suscripciones que ya lo usan).

### 3. Supabase: migración `trial_reminders`
Aplicar `supabase/migrations/20261015110000_trial_reminders.sql` (crea `trial_reminders`, RLS activada sin políticas;
vuelta atrás al final del fichero). Hay que hacerlo antes de la primera ejecución del aviso (paso 6). Es idempotente.

### 4. Supabase: secrets (Edge Functions → Secrets)
Poner **todos antes de desplegar las funciones**:

- `STRIPE_PRICE_STARTER_MONTHLY_V2`, `STRIPE_PRICE_STARTER_ANNUAL_V2`, `STRIPE_PRICE_GROWTH_MONTHLY_V2`,
  `STRIPE_PRICE_PRO_MONTHLY_V2` con los IDs de la tabla.
- `STRIPE_PRICE_GROWTH_ANNUAL_V2` y `STRIPE_PRICE_PRO_ANNUAL_V2`: **no poner los dos con el mismo valor**. Si no hay ID
  correcto, dejarlas **sin poner** (o ponerlas tal cual llegaron: el servidor las bloquea igual). Lo importante es no inventar.
- `TRIAL_DAYS` = `90` (prueba de 3 meses; tiene que coincidir con `TRIAL_DAYS` de `utils/planPrices.ts`).
- Comprobar que existen (no cambiarlos): `STRIPE_SECRET_KEY`, `CRON_SECRET` y `BREVO_API_KEY` (o la clave de Brevo en Vault,
  `auth_email_secrets`). Sin `CRON_SECRET` el aviso responde 401; sin Brevo no sale el correo.

Nunca poner `TRIAL_DAYS` sin las variables de precio: el checkout bloquea cada combinación sin variable (`price_unavailable`)
en vez de caer al ID antiguo archivado, así que no hay riesgo de regalar prueba a un precio equivocado.

### 5. Supabase: desplegar las funciones (desde el repo)
Todas leen `_shared/stripePlans.ts`, que ha cambiado: `create-checkout-session`, `create-portal-session`,
`get-checkout-status`, `stripe-webhook`, y la nueva `trial-ending-reminder` (`verify_jwt = false` en `config.toml`; la protege
`CRON_SECRET`). Después de desplegar, mirar los logs de `create-checkout-session`: con Growth anual y Pro anual duplicados
saldrá **un** `ERROR DE CONFIGURACION: STRIPE_PRICE_GROWTH_ANNUAL_V2 y STRIPE_PRICE_PRO_ANNUAL_V2 tienen el MISMO Price ID`
y es lo esperado hoy; cualquier otro error de configuración no.

### 6. Cron diario del aviso a 7 días
Stripe no avisa al cliente por sí mismo; esta función manda el correo 7 días antes del primer cobro (obligatorio antes de
cobrar). Programar una llamada diaria (Supabase → Integraciones → Cron, o `pg_cron` + `pg_net`):
`POST https://<proyecto>.supabase.co/functions/v1/trial-ending-reminder` con cabecera `Authorization: Bearer <CRON_SECRET>`.
**Primero con cuerpo `{"dryRun": true}`**: devuelve a quién avisaría (`candidates`) sin reservar ni enviar. Hoy no habrá
candidatas (nadie está en prueba): debe responder 200 con `checked: 0`. Si responde 500 y el log menciona la migración,
falta el paso 3. Con la prueba real, la respuesta trae `checked`, `sent`, `failed` y `skipped` por motivo (`ya_avisada`,
`cancelada_al_acabar`, `ya_no_esta_en_prueba`, `fuera_de_ventana`, `sin_email`, `sin_precio`, `sin_cupo_brevo`). Si Brevo no
tiene cupo diario (cuenta Free compartida) el aviso no se reserva y se reintenta al día siguiente. Después del dry run,
dejar el cron con cuerpo vacío.

### 7. Frontend (último)
`utils/planPrices.ts` ya viene con `NEW_PRICING_ENABLED = true`. `npx vite build`, `pre-commit-secret-scan` y subir `dist/`
como siempre. No hay variables `VITE_*` nuevas.

### 8. Stripe: precios antiguos
Ya están archivados. No hay nada más que hacer. No reactivarlos sin cambiar `LEGACY_PRICE_FALLBACK` y `NEW_PRICING_ENABLED`
(ver «Vuelta atrás»).

### 9. Comprobar en producción cada plan y ciclo, SIN pagar
Con una cuenta de prueba de empresa **sin** suscripción previa (la prueba es de un solo uso por cliente):

1. Abrir `/es/planes`: debe mostrar 15 / 49 / 99 € al mes, «3 meses gratis, después 15 / 49 / 99 € al mes», «Hoy pagas 0 €.
   Primer cobro: … el <fecha de hoy + 90 días>», «Precios con IVA incluido» y **no** el interruptor Mensual/Anual (mientras
   falte el ID de Diego).
2. Pulsar «Empieza gratis 3 meses» en **Starter, Growth y Pro** (mensual). Stripe debe abrir el checkout con
   **«Prueba gratuita de 90 días»** (o equivalente), **«0,00 € hoy»** y como importe posterior el de la web: 15 €, 49 € y 99 €
   al mes, con la fecha del primer cobro de hoy + 90 días. Comparar importe y fecha con lo que anuncia la web y **cerrar la
   pestaña sin pagar** (la sesión caduca sola; no queda suscripción).
3. Starter anual: no se ofrece en la web mientras falte el anual de los otros dos. Para comprobarlo igualmente, llamar a
   `create-checkout-session` con `{plan:'starter', billingCycle:'annual'}` desde una sesión de prueba (o activar
   temporalmente el interruptor en un build local): debe abrir el checkout con 150 €/año y prueba de 90 días.
4. Growth anual y Pro anual (mientras estén duplicados): la web no los ofrece. Una llamada directa a la función con esos ciclos
   debe devolver `price_unavailable` y **no** crear sesión de Stripe (se ve porque no aparece ninguna sesión nueva en
   Stripe → Pagos → Sesiones).
5. Cuando llegue el ID de Diego, repetir 2 y 3 para los ciclos anuales: 490 €/año y 990 €/año, prueba de 90 días.
6. Si un importe de Stripe no coincide con la web, **parar**: corregir el Price en Stripe o la constante de `planPrices.ts`
   (la web enseña la constante; Stripe cobra el Price) y volver a desplegar.
7. Qué hacer si el checkout no abre: el log de `create-checkout-session` dice la causa (`ERROR DE CONFIGURACION`,
   `price_unavailable`, `resource_missing` = el ID no existe en la cuenta de `STRIPE_SECRET_KEY`).

## Qué hay en el código (referencia)

| Pieza | Fichero |
|---|---|
| Precios, interruptor y ciclos disponibles | `utils/planPrices.ts` (**fuente única**): `NEW_PRICING_ENABLED`, `PRICES_NEW`, `ANNUAL_NEW`, `TRIAL_DAYS`, `AVAILABLE_BILLING_CYCLES` |
| Textos de precio, «Ahorra…», prueba, IVA | `PricingPage`, pantallas con candado (`LockedFeaturePreview`), `PlanActivatedModal`, `BusinessListPage`, `TrialStatusBanner`; textos en el bloque `pricingPage` de los 31 `locales/*.ts` |
| «Prueba gratuita: te quedan X días» | `hooks/useTrialStatus.ts` + `components/TrialStatusBanner.tsx` (Resumen del panel y «Gestionar plan» del perfil), «Mis negocios» y modal de plan activado |
| Prueba de 90 días en el pago (solo el primer alta) | `supabase/functions/create-checkout-session/index.ts` (secret `TRIAL_DAYS`) |
| Price IDs y defensa contra duplicados | `supabase/functions/_shared/stripePlans.ts` (6 variables `STRIPE_PRICE_*_V2`; `LEGACY_PRICE_FALLBACK = false`) |
| Aviso a 7 días | `supabase/functions/trial-ending-reminder/`, `_shared/brevo.ts`, migración `20261015110000_trial_reminders.sql` |

Comportamiento de `create-checkout-session`: la prueba (`trial_period_days = TRIAL_DAYS`, tarjeta siempre) se manda **solo** si
`TRIAL_DAYS` es un entero entre 1 y 730 **y** el usuario no tuvo antes ninguna suscripción (BD o Stripe, del estado que sea)
ni prueba; si no se puede comprobar, no se da. Sin `TRIAL_DAYS` no hay prueba. El plan `v2` (pruebas) sigue sin poder
contratarse. Una combinación sin variable de precio, o con una mal puesta (repetida, de otro plan, formato raro), no crea
sesión: `price_unavailable`. Los IDs antiguos solo sirven para que el webhook reconozca las suscripciones que ya existen.

## Vuelta atrás
- **Solo frontend** (la web anuncia algo incorrecto): subir el `dist/` anterior. No arregla el cobro: los precios antiguos están
  archivados.
- **Un ciclo mal puesto**: dejar su variable sin poner (queda bloqueado) y desplegar de nuevo; no cae a ningún ID antiguo.
- **Volver a los precios antiguos** exige reactivar los 6 Price antiguos en Stripe, `LEGACY_PRICE_FALLBACK = true` en
  `stripePlans.ts`, quitar los secrets `STRIPE_PRICE_*_V2` y `TRIAL_DAYS`, `NEW_PRICING_ENABLED = false` y volver a desplegar
  funciones y frontend. No se ha previsto hoy.
- **Prueba de 3 meses** (sin tocar precios): borrar el secret `TRIAL_DAYS` y volver a desplegar `create-checkout-session`;
  la web seguirá diciendo «3 meses gratis» hasta el siguiente build, así que conviene subir también un build con `TRIAL_DAYS`
  de la web a 0 (`NEW_PRICING_ENABLED` sigue true) o cambiar los textos.

## Cómo se ha verificado (23/10/2026, todo local; Stripe y Brevo reales no se han tocado)

Arneses de Node con Stripe y Supabase simulados, ejecutando el TS real de las funciones
(`scratchpad/qa-opynio/agentes/precios-2-tools/`):
- `h-stripeplans.cjs` (10 casos): los 5 IDs reales distintos resuelven al plan correcto en `priceIdFor` (checkout) y
  `planForPriceId` (webhook); Growth anual y Pro anual (mismo ID) quedan bloqueados, sin afectar a los otros cuatro y con un
  solo `ERROR` en el log; con el sexto ID distinto los seis funcionan; sin variables no se puede contratar nada y los ids
  antiguos siguen reconocidos; ID antiguo de otro plan, ID del plan `v2`, formato inválido y triple duplicado.
- `h-checkout.mjs` (52 casos, `index.ts` real de `create-checkout-session`): con `TRIAL_DAYS=90` y primer alta,
  `trial_period_days: 90` y `payment_method_collection: 'always'` en los 6 planes×ciclos con 6 IDs y en los 4 contratables del
  estado real; sin `TRIAL_DAYS` (o inválido) no hay prueba; con suscripción previa (BD o Stripe, aunque cancelada) o si falla
  la comprobación, tampoco; `plan:'v2'` rechazado (400); duplicado → `price_unavailable` (500) sin sesión en Growth anual y Pro
  anual y los otros cuatro intactos; sin variables, todo `price_unavailable`; el `priceId` antiguo heredado se rechaza.
- `h-reminder.mjs` (28 casos): ventana de 7 días, no repetir, canceladas, reintento si falla Brevo, sin cupo, `dryRun`,
  concurrencia, español/inglés, tabla sin migrar y los IDs nuevos.
- Web con el interruptor encendido: `/es/planes`, «Mis negocios», «Gestionar plan», las 4 pantallas con candado, modal de plan
  activado y Resumen del panel con suscripciones `trialing`, claro y oscuro, 1366 y 390 px; 31 idiomas sin claves crudas.
- `npx vite build`, `npm run check:widget`, `npm run check:locale-paths` y `npm run typecheck` (98 errores = los de master).

## Decisiones pendientes del responsable (no bloquean el despliegue)

1. **Clientes que ya pagan 95 / 215 / 419.** Siguen cobrando por sus IDs antiguos (archivados, pero vivos). Quedan pagando 4-6
   veces más que uno nuevo. Recomendación: pasarlos al precio nuevo en su próxima renovación, sin prorrateo y avisando por
   correo, con un script que cambie el Price de cada suscripción (`proration_behavior: none`). Los anuales ya pagados, aparte.
   El código actual no hace esta migración. Ojo: la web ya les muestra el importe nuevo en «Mis negocios»/«Gestionar plan»
   aunque sigan cobrándoles el antiguo (`utils/planPrices.ts` no sabe a qué precio está cada cliente).
2. **IVA incluido o no.** Hoy «Precios con IVA incluido» es lo único veraz (no hay Stripe Tax). Si se decide «sin IVA»: activar
   Stripe Tax, Price con `tax_behavior: exclusive`, `automatic_tax` en el checkout y `PRICES_INCLUDE_VAT = false`.
3. **Quién tiene prueba.** Una por usuario/customer de Stripe. Una persona con otro correo puede conseguir otra; la issue dice
   «una por empresa» y hoy la suscripción es por usuario.
4. **Meta Pixel / Conversions API.** El webhook manda un Purchase con el importe completo del plan en cuanto se confirma el pago
   aunque en prueba se cobre 0 €, y el Pixel del navegador manda 0 € con el mismo `event_id`. Decidir si en prueba se informa
   `StartTrial`. No se ha tocado.
5. **Una suscripción viva en el plan antiguo** que intente contratar el mismo plan nuevo recibe `has_active_subscription` y se
   abre el portal (cambio de plan entre Prices), no un checkout nuevo.

## Issue #11 (prueba con acceso ilimitado): NO implementada

Durante `trialing` el webhook guarda en `profiles.plan` el plan elegido, y todo lo que limita a Starter o Growth lee ese
campo en dos capas (front: `utils/planFeatures.ts`, límites en `DashboardProducts` y `BusinessListPage`; BD/servidor: trigger
`enforce_product_limit`, funciones de límite de negocios, RPC `business_analytics`, `send-invitation-email`,
`create-checkout-session`). Desbloquear solo el front dejaría pantallas abiertas que fallan al guardar. Hacerlo bien exige
tocar guards de BD y el webhook, y requiere decisiones de producto: qué es «ilimitado» (límites de Pro o sin tope), qué pasa si
baja de plan durante la prueba, qué pasa con lo creado de más al acabar y cómo evitar abuso del cupo de Brevo. Se haría con una
columna `profiles.trial_full_access_until` y una función `effective_plan(user_id)` usada por el trigger, las funciones de
límite y la RPC, el webhook rellenándola con `trial_end`, y un único `useEffectivePlan()` en el front; unas 8 horas con
pruebas con relojes de prueba de Stripe, y OK explícito antes de desplegar (es código de pagos).

## Qué no se ha podido comprobar
- Stripe y Brevo reales (no hay claves ni red en este entorno): la comprobación del paso 9 en producción es la primera prueba
  real del checkout con los Price nuevos, la prueba de 90 días y el aviso por correo.
- «Te quedan X días» lee `subscriptions` (`status = trialing`, `current_period_end` = fin de prueba) con la sesión del usuario;
  funciona en local y en `opynio_prodlike`; falta confirmarlo en la base real.
- El correo del aviso enlaza a `/es/mis-negocios` (botón «Gestionar facturación», que abre el portal de Stripe) y va en español
  o inglés según el idioma del perfil; no hay plantilla en los 31 idiomas.
