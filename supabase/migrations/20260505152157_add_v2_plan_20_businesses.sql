-- =============================================================================
-- Plan 'v2' (premium test) — límite de 20 negocios
-- =============================================================================
-- Añade el plan 'v2' a las funciones que mapean plan → business_limit:
--   • enforce_business_limit (trigger BEFORE INSERT en businesses)
--   • upgrade_user_to_business_owner (3-arg y 9-arg)
-- profiles.plan es text → no requiere ALTER TYPE.
-- =============================================================================

BEGIN;

-- enforce_business_limit
CREATE OR REPLACE FUNCTION public.enforce_business_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

  SELECT role, plan, COALESCE(business_limit, 0)
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

-- upgrade_user_to_business_owner (9-arg)
CREATE OR REPLACE FUNCTION public.upgrade_user_to_business_owner(
    p_business_name text,
    p_category text,
    p_plan text,
    p_country character varying,
    p_description text DEFAULT NULL::text,
    p_logo_url text DEFAULT NULL::text,
    p_google_maps_url text DEFAULT NULL::text,
    p_latitude double precision DEFAULT NULL::double precision,
    p_longitude double precision DEFAULT NULL::double precision
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  new_business_id uuid;
  current_count int;
  current_plan text;
  effective_limit int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado.';
  END IF;

  SELECT plan, COALESCE(business_limit, 0)
    INTO current_plan, effective_limit
  FROM public.profiles WHERE id = auth.uid();

  IF effective_limit = 0 THEN
    effective_limit := CASE current_plan
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

  UPDATE public.profiles
  SET role = 'business_owner'
  WHERE id = auth.uid();

  INSERT INTO public.businesses (
      owner_id, name, category, country, description, logo_url, google_maps_url, latitude, longitude, sedes
  )
  VALUES (
      auth.uid(), p_business_name, p_category, p_country, p_description, p_logo_url, p_google_maps_url, p_latitude, p_longitude, jsonb_build_array(jsonb_build_object('country_code', p_country))
  )
  RETURNING id INTO new_business_id;

  RETURN new_business_id;
END;
$function$;

-- upgrade_user_to_business_owner (3-arg)
CREATE OR REPLACE FUNCTION public.upgrade_user_to_business_owner(
    p_business_name text,
    p_category text,
    p_plan text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  new_business_id uuid;
  current_count int;
  effective_limit int;
  v_plan text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado.';
  END IF;

  SELECT plan, COALESCE(business_limit, 0) INTO v_plan, effective_limit
  FROM public.profiles WHERE id = auth.uid();

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

  UPDATE public.profiles SET role = 'business_owner' WHERE id = auth.uid();

  INSERT INTO public.businesses (name, category, owner_id)
  VALUES (p_business_name, p_category, auth.uid())
  RETURNING id INTO new_business_id;

  RETURN new_business_id;
END;
$function$;

COMMIT;
