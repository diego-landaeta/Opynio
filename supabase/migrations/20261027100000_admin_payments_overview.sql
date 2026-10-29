-- Apartado «Pagos» del panel de admin. 2026-10-27
--
-- Una sola RPC de lectura que devuelve las suscripciones con quién las paga, qué plan, cuánto, en qué estado y
-- cuándo es el próximo cobro o termina la prueba. El correo del cliente vive en auth.users (no se puede leer desde
-- el cliente), por eso va en una función SECURITY DEFINER; lo que impide que la use cualquiera es la comprobación
-- de rol de dentro (igual que admin_list_users): un usuario que no es admin recibe un error y ningún dato.
--
-- NO escribe nada. No toca ninguna tabla ni empresa. Tolera las diferencias entre esquemas (en producción la
-- fecha de alta de la suscripción es `created` y en local `created_at`; `current_period_start` y `ended_at` pueden
-- no existir) leyendo esas columnas a través de to_jsonb(s).
-- `periodEnd` (current_period_end) existe en ambos esquemas y se lee directo.
--
-- VUELTA ATRAS: DROP FUNCTION public.admin_payments_overview();

BEGIN;

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
            ), '[]'::jsonb)
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
  'Suscripciones con cliente, plan, importe, estado y fechas para el apartado Pagos del admin. Solo admin; solo lectura.';

COMMIT;
