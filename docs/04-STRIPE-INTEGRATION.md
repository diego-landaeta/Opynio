# Plan de Integración de Stripe para Opynio

Este documento describe la estrategia y los pasos técnicos para integrar Stripe en la plataforma Opynio, permitiendo a los negocios contratar y gestionar planes de suscripción de pago ('Starter', 'Growth', 'Pro').

---

## Fase 1: Configuración del Backend (Supabase)

El objetivo de esta fase es preparar la base de datos y la lógica del servidor para interactuar con la API de Stripe de forma segura.

### 1.1. Modelo de Datos en Supabase

Crearemos nuevas tablas para reflejar el modelo de datos de facturación de Stripe. Esto nos permitirá tener una copia local del estado de las suscripciones de nuestros clientes.

-   **`customers`**: Mapea los perfiles de usuario de Opynio (`profiles.id`) con los IDs de cliente de Stripe (`stripe_customer_id`).
    -   `id` (UUID, FK a `profiles.id`, PK)
    -   `stripe_customer_id` (TEXT, UNIQUE)

-   **`products`**: Almacena los planes que ofrecemos.
    -   `id` (TEXT, PK - ej. "plan_starter")
    -   `active` (BOOLEAN)
    -   `name` (TEXT)
    -   `description` (TEXT)

-   **`prices`**: Almacena los diferentes precios de cada producto (ej. mensual vs. anual).
    -   `id` (TEXT, PK - ID del precio en Stripe)
    -   `product_id` (TEXT, FK a `products.id`)
    -   `active` (BOOLEAN)
    -   `unit_amount` (BIGINT - en céntimos)
    -   `currency` (TEXT - ej. "eur")
    -   `type` (TEXT - "recurring")
    -   `interval` (TEXT - "month" o "year")

-   **`subscriptions`**: Almacena el estado de la suscripción de un usuario. Esta será nuestra "fuente de la verdad".
    -   `id` (TEXT, PK - ID de la suscripción en Stripe)
    -   `user_id` (UUID, FK a `profiles.id`)
    -   `status` (TEXT - ej. "active", "trialing", "past_due", "canceled")
    -   `price_id` (TEXT, FK a `prices.id`)
    -   `current_period_end` (TIMESTAMPTZ - Fecha de renovación o fin del plan)

### 1.2. Configuración de Stripe

1.  **Crear Cuenta de Stripe**: Obtener claves API (publicable y secreta).
2.  **Crear Productos y Precios**: En el dashboard de Stripe, crear los productos para los planes 'Starter', 'Growth' y 'Pro'. Para cada uno, crear un precio mensual y otro anual.
3.  **Configurar Webhook**: Crear un endpoint de webhook que apunte a nuestra futura Edge Function. Inicialmente, escuchar el evento `checkout.session.completed`.

### 1.3. Edge Functions de Supabase

Crearemos tres funciones principales para manejar la lógica de Stripe.

1.  **`create-checkout-session`**:
    -   **Disparador**: Llamada desde el frontend cuando un usuario hace clic en "Empezar Ahora".
    -   **Lógica**:
        -   Autentica al usuario.
        -   Busca o crea un `stripe_customer_id` para el usuario.
        -   Usa la API de Stripe para crear una `checkout session` con el `price_id` seleccionado.
        -   Devuelve el `session_id` al frontend para redirigir al checkout de Stripe.

2.  **`create-portal-session`**:
    -   **Disparador**: Llamada desde el panel de facturación del usuario.
    -   **Lógica**:
        -   Autentica al usuario.
        -   Obtiene el `stripe_customer_id`.
        -   Crea una sesión del Portal de Cliente de Stripe.
        -   Devuelve la URL del portal al frontend para la redirección.

3.  **`stripe-webhook`**:
    -   **Disparador**: Eventos enviados por Stripe a nuestro endpoint.
    -   **Lógica**:
        -   **Verificar Firma**: Es crucial verificar la firma del webhook para asegurar que la petición proviene de Stripe.
        -   Manejar eventos clave:
            -   `checkout.session.completed`: Crea el registro en la tabla `subscriptions` y actualiza el `plan` en la tabla `businesses`.
            -   `invoice.paid`: Actualiza la fecha `current_period_end` en la suscripción.
            -   `customer.subscription.updated`: Maneja cambios de plan (upgrade/downgrade).
            -   `customer.subscription.deleted`: Maneja cancelaciones, actualizando el estado de la suscripción y el plan del negocio.

---

## Fase 2: Implementación en el Frontend (React)

### 2.1. Página de Precios (`PricingPage.tsx`)

-   **Lógica de Botones**: Los botones "Empezar Ahora" deben:
    -   Si el usuario no está logueado, redirigirlo a `/registro` con el plan en la URL (ej. `/registro?type=business&plan=starter`).
    -   Si el usuario está logueado, llamar a la Edge Function `create-checkout-session` con el `price_id` del plan seleccionado.
-   **Instalar Stripe.js**: `npm install @stripe/stripe-js`.
-   **Redirección a Checkout**: Al recibir el `session_id` de la Edge Function, usar `stripe.redirectToCheckout({ sessionId })`.

### 2.2. Panel de Facturación (`DashboardBilling.tsx`)

-   **Estado de la Suscripción**: Leer la información de la tabla `subscriptions` para mostrar el plan actual, el estado y la fecha de renovación.
-   **Botón "Gestionar Suscripción"**:
    -   Este botón llamará a la Edge Function `create-portal-session`.
    -   Al recibir la URL del portal, redirigirá al usuario para que pueda gestionar su facturación directamente en Stripe.

### 2.3. Lógica de Registro y Asignación

-   **Flujo de Registro**: Cuando un usuario se registra con un plan (`/registro?plan=...`), la lógica debe asegurar que, tras la creación de la cuenta y el negocio, se inicie el proceso de checkout.
-   **Página `AssignBusinessPage.tsx`**: Si un usuario ya logueado selecciona un plan, esta página debe guiarlo para aplicar el plan a su negocio existente o a uno nuevo, culminando en la llamada a `create-checkout-session`.

---

## Fase 3: Lista de Tareas (Checklist)

### Configuración
-   [ ] Crear cuenta de Stripe y obtener claves API (publicable y secreta).
-   [ ] Añadir claves de Stripe como Secrets en el proyecto de Supabase.
-   [ ] Crear productos y precios para los planes en el dashboard de Stripe.
-   [ ] Configurar el endpoint del webhook en Stripe.

### Backend (Supabase)
-   [ ] Crear script SQL para las tablas `customers`, `products`, `prices`, `subscriptions`.
-   [ ] Implementar la Edge Function `create-checkout-session`.
-   [ ] Implementar la Edge Function `create-portal-session`.
-   [ ] Implementar la Edge Function `stripe-webhook` con verificación de firma.
-   [ ] Manejar el evento `checkout.session.completed` en el webhook.
-   [ ] Manejar `invoice.paid`, `customer.subscription.updated` y `customer.subscription.deleted` en el webhook.
-   [ ] Configurar políticas de RLS para las nuevas tablas.

### Frontend (React)
-   [ ] Instalar `@stripe/stripe-js`.
-   [ ] Actualizar la lógica de los botones en `PricingPage.tsx`.
-   [ ] Implementar la llamada a `redirectToCheckout`.
-   [ ] Crear páginas/rutas de éxito (`/success`) y cancelación (`/cancel`) para Stripe.
-   [ ] Actualizar `DashboardBilling.tsx` para mostrar el estado de la suscripción.
-   [ ] Implementar el botón "Gestionar Suscripción" que llama a `create-portal-session`.
-   [ ] Adaptar el flujo en `AssignBusinessPage.tsx` para iniciar el checkout.
