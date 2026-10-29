-- =============================================================================
-- upgrade_user_to_business_owner: el limite de empresas usa el plan EFECTIVO. 2026-10-29
--
-- Issue #11. Durante la prueba (con tarjeta o sin ella) profiles.plan sigue siendo el elegido
-- ('free' en la prueba sin tarjeta), y plan_efectivo(plan, trial_full_access_until) da 'enterprise'.
-- enforce_business_limit (migracion 20261026100000), el contador «Mis negocios (1/∞)» y el texto de la
-- pagina de planes («acceso completo, sin limites») ya usan el plan efectivo, pero las dos sobrecargas de
-- esta RPC contaban con profiles.plan: un usuario en prueba veia «1/∞», pulsaba «Anadir negocio» y recibia
-- «Has alcanzado el limite de negocios para tu plan (1)». Aqui se cuenta con el plan efectivo.
--
-- Cambio: solo la lectura del plan (SELECT plan -> SELECT plan_efectivo(plan, trial_full_access_until)).
-- TODO lo demas es igual, caracter por caracter, que 20260924240000 (firmas, valores por defecto,
-- SECURITY DEFINER, search_path, proteccion del admin, INSERT y valor devuelto). CREATE OR REPLACE
-- conserva dueno y permisos. Requiere 20261026100000 (plan_efectivo y la columna).
--
-- Idempotente. VUELTA ATRAS: volver a ejecutar 20260924240000_upgrade_keep_admin.sql.
-- =============================================================================
BEGIN;

-- 1. Sobrecarga de 3 parámetros ----------------------------------------------
CREATE OR REPLACE FUNCTION public.upgrade_user_to_business_owner(p_business_name text, p_category text, p_plan text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
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

  SELECT public.plan_efectivo(plan, trial_full_access_until), COALESCE(business_limit, 0) INTO v_plan, effective_limit
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

  -- 20260924240000: un admin sigue siendo admin.
  UPDATE public.profiles SET role = 'business_owner'
  WHERE id = auth.uid() AND role IS DISTINCT FROM 'admin'::public.user_role;

  INSERT INTO public.businesses (name, category, owner_id)
  VALUES (p_business_name, p_category, auth.uid())
  RETURNING id INTO new_business_id;

  RETURN new_business_id;
END;
$function$;

-- 2. Sobrecarga de 9 parámetros (la que usa el front) -------------------------
CREATE OR REPLACE FUNCTION public.upgrade_user_to_business_owner(p_business_name text, p_category text, p_plan text, p_country character varying, p_description text DEFAULT NULL::text, p_logo_url text DEFAULT NULL::text, p_google_maps_url text DEFAULT NULL::text, p_latitude double precision DEFAULT NULL::double precision, p_longitude double precision DEFAULT NULL::double precision)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
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

  SELECT public.plan_efectivo(plan, trial_full_access_until), COALESCE(business_limit, 0)
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

  -- 20260924240000: un admin sigue siendo admin.
  UPDATE public.profiles
  SET role = 'business_owner'
  WHERE id = auth.uid() AND role IS DISTINCT FROM 'admin'::public.user_role;

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

COMMIT;
