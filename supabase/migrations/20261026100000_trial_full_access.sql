-- Prueba gratuita con acceso completo (issue #11). 2026-10-26
--
-- Mientras la suscripcion esta en 'trialing', la empresa debe tener todas las funciones y sin topes,
-- sea cual sea el plan elegido. Al acabar la prueba vuelve a su plan.
--
-- Diseno: profiles.plan NO cambia (sigue siendo el plan que eligio y que se cobrara). Una columna nueva,
-- profiles.trial_full_access_until, la escribe SOLO el webhook de Stripe (fin de la prueba mientras
-- dure; NULL en cualquier otro caso). plan_efectivo() devuelve 'enterprise' mientras esa fecha este en
-- el futuro y el plan normal despues. Las puertas de plan de la base de datos usan el plan efectivo:
--   enforce_business_limit (empresas), enforce_product_limit (productos), business_analytics (analiticas).
-- Las invitaciones ya exigen Starter o mas (toda prueba lo cumple) y su tope de 200/dia es antiabuso y
-- el mismo para todos los planes, asi que no cambian. El ranking del directorio sigue usando el plan real.
--
-- SEGURIDAD: la columna esta protegida en guard_profile_sensitive_columns (un usuario no puede darse
-- a si mismo acceso completo; solo service_role/postgres/admin).
--
-- VUELTA ATRAS: restaurar las 4 funciones con las definiciones guardadas en la carpeta de copias (*-prod-26oct.sql),
-- DROP FUNCTION public.plan_efectivo(text, timestamptz); ALTER TABLE public.profiles DROP COLUMN trial_full_access_until;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_full_access_until timestamptz;
COMMENT ON COLUMN public.profiles.trial_full_access_until IS
  'Fin del acceso completo de la prueba gratuita (la escribe el webhook de Stripe). NULL = sin prueba. Ver plan_efectivo().';

CREATE OR REPLACE FUNCTION public.plan_efectivo(p_plan text, p_trial_until timestamptz)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $f$
  SELECT CASE WHEN p_trial_until IS NOT NULL AND p_trial_until > now() THEN 'enterprise' ELSE p_plan END
$f$;

CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  caller_role public.user_role;
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role = 'admin'::public.user_role THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.role := 'authenticated'::public.user_role;
    NEW.plan := 'free';
    NEW.plan_expires_at := NULL;
    NEW.billing_cycle := NULL;
    NEW.business_limit := NULL;
    NEW.ai_credit_limit := NULL;
    NEW.feature_permissions := NULL;
    NEW.helpful_review_count := 0;
    NEW.ai_credits_used := COALESCE(NEW.ai_credits_used, 0);
    NEW.ai_credits_last_reset := COALESCE(NEW.ai_credits_last_reset, timezone('utc'::text, now()));
    NEW.trial_full_access_until := NULL;
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.plan IS DISTINCT FROM OLD.plan
     OR NEW.plan_expires_at IS DISTINCT FROM OLD.plan_expires_at
     OR NEW.billing_cycle IS DISTINCT FROM OLD.billing_cycle
     OR NEW.business_limit IS DISTINCT FROM OLD.business_limit
     OR NEW.ai_credit_limit IS DISTINCT FROM OLD.ai_credit_limit
     OR NEW.feature_permissions IS DISTINCT FROM OLD.feature_permissions
     OR NEW.helpful_review_count IS DISTINCT FROM OLD.helpful_review_count
     OR NEW.ai_credits_used IS DISTINCT FROM OLD.ai_credits_used
     OR NEW.ai_credits_last_reset IS DISTINCT FROM OLD.ai_credits_last_reset
     OR NEW.trial_full_access_until IS DISTINCT FROM OLD.trial_full_access_until
  THEN
    RAISE EXCEPTION 'No autorizado: campos protegidos del perfil sólo pueden modificarlos admin o service_role.';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_business_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  current_count int;
  effective_limit int;
  v_plan text;
  v_role public.user_role;
BEGIN
  IF NEW.owner_id IS NULL OR auth.uid() IS NULL OR NEW.owner_id <> auth.uid() THEN
    RETURN NEW;
  END IF;

  SELECT role, public.plan_efectivo(plan, trial_full_access_until), COALESCE(business_limit, 0)
    INTO v_role, v_plan, effective_limit
  FROM public.profiles WHERE id = auth.uid();

  IF v_role = 'admin' THEN
    RETURN NEW;
  END IF;

  IF effective_limit = 0 THEN
    effective_limit := CASE v_plan
        WHEN 'free' THEN 1
        WHEN 'starter' THEN 1
        WHEN 'growth' THEN 3
        WHEN 'pro' THEN 10
        WHEN 'v2' THEN 20
        WHEN 'enterprise' THEN 2147483647
        ELSE 1
    END;
  END IF;

  SELECT count(*) INTO current_count
  FROM public.businesses WHERE owner_id = auth.uid();

  IF current_count >= effective_limit THEN
    RAISE EXCEPTION 'Has alcanzado el límite de negocios para tu plan (%).', effective_limit;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_product_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_plan TEXT;
  v_limite INT;
  v_actual INT;
BEGIN
  -- Un admin de Opynio arreglando la cuenta de un cliente no deberia chocar
  -- contra el limite comercial de ese cliente.
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin') THEN
    RETURN NEW;
  END IF;

  SELECT public.plan_efectivo(p.plan, p.trial_full_access_until) INTO v_plan
  FROM public.businesses b
  JOIN public.profiles p ON p.id = b.owner_id
  WHERE b.id = NEW.business_id;

  v_limite := CASE coalesce(v_plan, 'free')
                WHEN 'free'    THEN 0
                WHEN 'starter' THEN 10
                WHEN 'growth'  THEN 30
                WHEN 'pro'     THEN 100
                ELSE 2147483647   -- v2 y enterprise: sin limite practico
              END;

  SELECT count(*) INTO v_actual
  FROM public.review_subjects s
  WHERE s.business_id = NEW.business_id;

  IF v_actual >= v_limite THEN
    RAISE EXCEPTION 'PRODUCT_LIMIT_REACHED: el plan % permite % productos y la empresa % ya tiene %.',
      coalesce(v_plan, 'free'), v_limite, NEW.business_id, v_actual
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.business_analytics(p_business_id uuid, p_days integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid  uuid := auth.uid();
  v_role text;
  v_plan text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Acceso no autorizado.' USING ERRCODE = '42501';
  END IF;

  SELECT p.role, public.plan_efectivo(p.plan, p.trial_full_access_until) INTO v_role, v_plan FROM public.profiles p WHERE p.id = v_uid;

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
$function$;
