-- business_analytics: solo el dueño de la empresa (plan Growth o superior) o un admin.
--
-- Hallazgo del QA del 23/10/2026: la RPC tenia GRANT EXECUTE a anon y no miraba quien
-- llamaba. Cualquiera, sin cuenta, obtenia las analiticas (total, media, tasa de
-- respuesta, fuentes y serie temporal) de CUALQUIER empresa, es decir, la funcion de
-- pago «Analiticas» (plan Growth) salia gratis por API. Los datos agregan reseñas ya
-- publicas, asi que no hay datos personales: es una fuga de funcion de pago, no de
-- privacidad. Reproducido en produccion con la clave anon.
--
-- Solo la usa DashboardAnalytics (el dueño viendo su empresa), que en la interfaz ya
-- esta bloqueada por debajo de Growth (utils/planFeatures.ts).
--
-- Como: el calculo pasa a business_analytics_calc (sin permisos para anon ni
-- authenticated) y business_analytics, con la misma firma, comprueba antes quien llama.
-- Idempotente. Solo lectura de datos; no toca filas.
--
-- VUELTA ATRAS:
--   DROP FUNCTION public.business_analytics(uuid, integer);
--   ALTER FUNCTION public.business_analytics_calc(uuid, integer) RENAME TO business_analytics;
--   GRANT EXECUTE ON FUNCTION public.business_analytics(uuid, integer) TO anon, authenticated, service_role;

DO $$
BEGIN
  IF to_regprocedure('public.business_analytics_calc(uuid, integer)') IS NULL THEN
    ALTER FUNCTION public.business_analytics(uuid, integer) RENAME TO business_analytics_calc;
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.business_analytics_calc(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.business_analytics_calc(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.business_analytics(p_business_id uuid, p_days integer)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_role text;
  v_plan text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Acceso no autorizado.' USING ERRCODE = '42501';
  END IF;

  SELECT p.role, p.plan INTO v_role, v_plan FROM public.profiles p WHERE p.id = v_uid;

  IF v_role = 'admin' THEN
    RETURN public.business_analytics_calc(p_business_id, p_days);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = p_business_id AND b.owner_id = v_uid) THEN
    RAISE EXCEPTION 'Acceso no autorizado.' USING ERRCODE = '42501';
  END IF;

  -- Analiticas: desde Growth (v2 y enterprise desbloquean lo mismo que pro o mas).
  IF COALESCE(v_plan, 'free') NOT IN ('growth', 'pro', 'v2', 'enterprise') THEN
    RAISE EXCEPTION 'Las analiticas estan disponibles desde el plan Growth.' USING ERRCODE = '42501';
  END IF;

  RETURN public.business_analytics_calc(p_business_id, p_days);
END;
$$;

COMMENT ON FUNCTION public.business_analytics(uuid, integer) IS
  'Analiticas de una empresa (total, media, tasa de respuesta, distribucion, fuentes y serie). Solo el dueño con plan Growth o superior, o un admin; 42501 en otro caso. El calculo esta en business_analytics_calc.';

REVOKE EXECUTE ON FUNCTION public.business_analytics(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.business_analytics(uuid, integer) TO authenticated, service_role;
