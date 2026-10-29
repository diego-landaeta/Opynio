-- Reembolsos y contracargos de Stripe. 2026-10-27
--
-- Un reembolso hecho a mano en Stripe (o un contracargo) no cancela la suscripcion: si no se registra, Opynio sigue
-- mostrando la suscripcion «activa» y el cliente, que ya recupero su dinero, vuelve a pagar en la siguiente renovacion.
-- El webhook (eventos charge.refunded y charge.dispute.created) anota aqui cada cobro devuelto y que se hizo con la
-- suscripcion; el apartado Pagos del admin lo muestra.
--
-- Solo lo escribe el servidor (service role). RLS activada y sin politicas: ni anon ni authenticated leen ni
-- escriben; el admin lo ve a traves de admin_payments_overview (SECURITY DEFINER).
--
-- VUELTA ATRAS:
--   DROP TABLE public.stripe_refunds;
--   y volver a aplicar 20261027100000_admin_payments_overview.sql (la funcion sin el campo `refund`).

BEGIN;

CREATE TABLE IF NOT EXISTS public.stripe_refunds (
  charge_id        text NOT NULL,
  kind             text NOT NULL DEFAULT 'refund' CHECK (kind IN ('refund', 'dispute')),  -- reembolso o contracargo (disputa)
  invoice_id       text,
  subscription_id  text,
  user_id          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  amount           integer NOT NULL,                 -- importe del cobro (unidad menor)
  amount_refunded  integer NOT NULL,                 -- reembolsado hasta ahora
  currency         text,
  "full"           boolean NOT NULL,                 -- reembolso total del cobro
  action           text NOT NULL CHECK (action IN ('recorded', 'alert', 'cancelled')),
  refunded_at      timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (charge_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_stripe_refunds_subscription ON public.stripe_refunds (subscription_id);

ALTER TABLE public.stripe_refunds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_refunds FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.stripe_refunds IS
  'Cobros de Stripe reembolsados (webhook charge.refunded). action: recorded = anotado; alert = reembolso total con la suscripcion aun viva; cancelled = se cancelo la suscripcion.';

-- admin_payments_overview: ahora cada fila lleva `refund` (el ultimo reembolso de esa suscripcion, o null).
CREATE OR REPLACE FUNCTION public.admin_payments_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Acción solo para administradores.' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'generatedAt', now(),
    'rows', COALESCE((
      SELECT jsonb_agg(x.fila ORDER BY x.orden DESC NULLS LAST, x.id)
      FROM (
        SELECT
          s.id,
          COALESCE(
            NULLIF(to_jsonb(s) ->> 'created', '')::timestamptz,
            NULLIF(to_jsonb(s) ->> 'created_at', '')::timestamptz
          ) AS orden,
          jsonb_build_object(
            'id', s.id,
            'status', s.status::text,
            'cancelAtPeriodEnd', COALESCE(s.cancel_at_period_end, false),
            'periodStart', to_jsonb(s) ->> 'current_period_start',
            'periodEnd', s.current_period_end,
            'createdAt', COALESCE(to_jsonb(s) ->> 'created', to_jsonb(s) ->> 'created_at'),
            'endedAt', to_jsonb(s) ->> 'ended_at',
            'priceId', s.price_id,
            'amount', pr.unit_amount,
            'currency', pr.currency,
            'interval', pr."interval",
            'productName', prod.name,
            'userId', s.user_id,
            'userName', p.name,
            'userEmail', u.email,
            'plan', p.plan,
            'trialUntil', to_jsonb(p) ->> 'trial_full_access_until',
            'stripeCustomerId', c.stripe_customer_id,
            'businessCount', (SELECT count(*) FROM public.businesses b WHERE b.owner_id = s.user_id),
            'businesses', COALESCE((
              SELECT jsonb_agg(bn.name ORDER BY bn.name)
              FROM (SELECT b.name FROM public.businesses b WHERE b.owner_id = s.user_id ORDER BY b.name LIMIT 5) bn
            ), '[]'::jsonb),
            'refund', (
              SELECT to_jsonb(q)
              FROM (
                SELECT r.amount_refunded AS "amount", r.currency, r."full", r.action, r.kind, r.refunded_at AS "at"
                FROM public.stripe_refunds r
                WHERE r.subscription_id = s.id
                ORDER BY r.refunded_at DESC
                LIMIT 1
              ) q
            )
          ) AS fila
        FROM public.subscriptions s
        LEFT JOIN public.prices pr ON pr.id = s.price_id
        LEFT JOIN public.products prod ON prod.id = pr.product_id
        LEFT JOIN public.profiles p ON p.id = s.user_id
        LEFT JOIN auth.users u ON u.id = s.user_id
        LEFT JOIN public.customers c ON c.id = s.user_id
      ) x
    ), '[]'::jsonb)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_payments_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_payments_overview() TO authenticated;

COMMENT ON FUNCTION public.admin_payments_overview() IS
  'Suscripciones con cliente, plan, importe, estado, fechas y ultimo reembolso para el apartado Pagos del admin. Solo admin; solo lectura.';

COMMIT;
