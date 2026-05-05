-- =============================================================================
-- Stripe — idempotencia de webhooks + RPC transaccional de checkout
-- =============================================================================
-- Cierra los siguientes bugs verificados contra la BD real:
--   [#STRIPE-1] El webhook hacía 5 escrituras independientes (products / prices
--               / subscriptions / businesses / profiles). Si una fallaba a mitad,
--               la BD quedaba inconsistente. Caso real observado:
--                 profile.plan='pro' SIN fila en subscriptions ni prices.
--   [#STRIPE-2] Stripe reentrega webhooks tras timeout/error. Solo
--               checkout.session.completed tenía guarda de idempotencia
--               (mediante chequeo de `subscriptions.id` existente); el resto de
--               handlers reaplicaban side effects en cada reintento.
--
-- Estrategia:
--   • Tabla processed_webhook_events con event_id PK → guard atómico al inicio
--     de cada handler. INSERT con ON CONFLICT DO NOTHING + chequeo de filas
--     afectadas → si ya estaba, se descarta el evento.
--   • RPC process_checkout_completion → 5 escrituras en una sola transacción
--     PostgreSQL. Si cualquier paso falla, rollback completo. Ejecutada por el
--     webhook con SUPABASE_SERVICE_ROLE_KEY.
-- =============================================================================

BEGIN;

-- =============================================================================
-- processed_webhook_events
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.processed_webhook_events (
  event_id     text PRIMARY KEY,
  type         text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.processed_webhook_events ENABLE ROW LEVEL SECURITY;

-- Sólo service_role escribe/lee. El frontend no la consulta.
DROP POLICY IF EXISTS "service_role manages processed_webhook_events"
  ON public.processed_webhook_events;
CREATE POLICY "service_role manages processed_webhook_events"
  ON public.processed_webhook_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMENT ON TABLE public.processed_webhook_events IS
  'Idempotencia de webhooks de Stripe. event_id == Stripe event.id. INSERT al inicio del handler con ON CONFLICT DO NOTHING; si no se afecta ninguna fila, el evento ya fue procesado y se descarta.';

-- =============================================================================
-- process_checkout_completion(...)
-- Atómica: products + prices + subscriptions upserts, business INSERT opcional
-- y profile UPDATE. Llamada exclusivamente por el webhook (service_role).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.process_checkout_completion(
    p_subscription_id          text,
    p_user_id                  uuid,
    p_status                   text,
    p_price_id                 text,
    p_cancel_at_period_end     boolean,
    p_current_period_start     timestamptz,
    p_current_period_end       timestamptz,
    p_product_id               text,
    p_product_name             text,
    p_product_active           boolean,
    p_product_description      text,
    p_product_metadata         jsonb,
    p_price_active             boolean,
    p_price_unit_amount        bigint,
    p_price_currency           text,
    p_price_type               text,
    p_price_interval           text,
    p_price_interval_count     integer,
    p_price_metadata           jsonb,
    p_plan_name                text,
    p_billing_cycle            text,
    p_is_new_business          boolean,
    p_already_processed        boolean,
    p_business_name            text             DEFAULT NULL,
    p_business_category        text             DEFAULT NULL,
    p_business_country         text             DEFAULT NULL,
    p_business_description     text             DEFAULT NULL,
    p_business_logo_url        text             DEFAULT NULL,
    p_business_google_maps_url text             DEFAULT NULL,
    p_business_latitude        double precision DEFAULT NULL,
    p_business_longitude       double precision DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  -- 1) products upsert
  INSERT INTO public.products (id, active, name, description, metadata)
  VALUES (p_product_id, p_product_active, p_product_name, p_product_description, p_product_metadata)
  ON CONFLICT (id) DO UPDATE
    SET active      = EXCLUDED.active,
        name        = EXCLUDED.name,
        description = EXCLUDED.description,
        metadata    = EXCLUDED.metadata;

  -- 2) prices upsert (FK a products, por eso products va antes)
  INSERT INTO public.prices (
      id, product_id, active, unit_amount, currency, type, interval, interval_count, metadata
  )
  VALUES (
      p_price_id, p_product_id, p_price_active, p_price_unit_amount, p_price_currency,
      p_price_type, p_price_interval, p_price_interval_count, p_price_metadata
  )
  ON CONFLICT (id) DO UPDATE
    SET product_id     = EXCLUDED.product_id,
        active         = EXCLUDED.active,
        unit_amount    = EXCLUDED.unit_amount,
        currency       = EXCLUDED.currency,
        type           = EXCLUDED.type,
        interval       = EXCLUDED.interval,
        interval_count = EXCLUDED.interval_count,
        metadata       = EXCLUDED.metadata;

  -- 3) subscriptions upsert (FK a prices, por eso prices va antes)
  INSERT INTO public.subscriptions (
      id, user_id, status, price_id, cancel_at_period_end,
      current_period_start, current_period_end
  )
  VALUES (
      p_subscription_id, p_user_id, p_status::public.subscription_status, p_price_id,
      p_cancel_at_period_end, p_current_period_start, p_current_period_end
  )
  ON CONFLICT (id) DO UPDATE
    SET status               = EXCLUDED.status,
        price_id             = EXCLUDED.price_id,
        cancel_at_period_end = EXCLUDED.cancel_at_period_end,
        current_period_start = EXCLUDED.current_period_start,
        current_period_end   = EXCLUDED.current_period_end;

  -- 4) business INSERT sólo si es flujo "new business" Y no es retry.
  IF p_is_new_business AND NOT p_already_processed THEN
    IF p_business_name IS NULL OR length(trim(p_business_name)) = 0 THEN
      RAISE EXCEPTION 'p_business_name es obligatorio cuando p_is_new_business=true';
    END IF;
    INSERT INTO public.businesses (
        owner_id, name, category, country, description, logo_url, google_maps_url,
        latitude, longitude, sedes
    )
    VALUES (
        p_user_id, p_business_name, p_business_category, p_business_country,
        p_business_description, p_business_logo_url, p_business_google_maps_url,
        p_business_latitude, p_business_longitude,
        CASE WHEN p_business_country IS NOT NULL
             THEN jsonb_build_array(jsonb_build_object('country_code', p_business_country))
             ELSE NULL END
    );
  END IF;

  -- 5) profile UPDATE — promueve a business_owner si es new business.
  UPDATE public.profiles
  SET plan            = p_plan_name,
      billing_cycle   = p_billing_cycle,
      plan_expires_at = p_current_period_end,
      role            = CASE WHEN p_is_new_business
                             THEN 'business_owner'::public.user_role
                             ELSE role END
  WHERE id = p_user_id;
END;
$function$;

COMMENT ON FUNCTION public.process_checkout_completion IS
  'Procesa un Stripe checkout.session.completed en una sola transacción. Llamado desde el webhook con SUPABASE_SERVICE_ROLE_KEY.';

REVOKE EXECUTE ON FUNCTION public.process_checkout_completion FROM PUBLIC, anon, authenticated;

COMMIT;

-- =============================================================================
-- ROLLBACK MANUAL (referencia, NO se ejecuta):
--   DROP FUNCTION public.process_checkout_completion(text,uuid,text,text,boolean,
--     timestamptz,timestamptz,text,text,boolean,text,jsonb,boolean,bigint,text,
--     text,text,integer,jsonb,text,text,boolean,boolean,text,text,text,text,text,
--     text,double precision,double precision);
--   DROP TABLE public.processed_webhook_events;
-- =============================================================================
