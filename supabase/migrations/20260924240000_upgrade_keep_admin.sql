-- =============================================================================
-- upgrade_user_to_business_owner: no degradar a un admin. 2026-09-24
--
-- Las dos sobrecargas que hay en producción (leídas con pg_get_functiondef el
-- 24/09; idénticas en opynio_prodlike y en la base local) hacían
--   UPDATE public.profiles SET role = 'business_owner' WHERE id = auth.uid();
-- sin mirar el rol actual: un admin que daba de alta una empresa por el
-- asistente (AssignBusinessPage / finishBusinessSignup) perdía el panel de
-- administración. El front de la rama ya desvía al admin a /admin/empresa/crear,
-- pero la RPC es la que tiene que protegerlo (el front de producción no lo hace).
--
-- Cambio: ese UPDATE ya no toca a quien tenga role = 'admin'. TODO lo demás es
-- igual, carácter por carácter: firmas, valores por defecto, SECURITY DEFINER,
-- search_path, límite de empresas por plan, INSERT (owner_id = auth.uid()) y
-- valor devuelto. CREATE OR REPLACE conserva dueño (postgres) y permisos.
--
-- Mismo patrón, NO tocado aquí (fuera del encargo): finish_business_signup
-- (nadie la llama: ni el front de prod ni el de la rama) y
-- admin_assign_business_owner (si un admin aprueba la reclamación de otro
-- admin, este pasa a business_owner).
--
-- Idempotente. Rollback: volver a crear las dos funciones sin
-- «AND role IS DISTINCT FROM 'admin'» (el resto del cuerpo es el mismo).
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

-- Verificación:
--   SELECT p.oid::regprocedure, position('IS DISTINCT FROM ''admin''' in p.prosrc) > 0 AS protege_admin,
--          p.prosecdef, p.proconfig, p.proacl
--   FROM pg_proc p WHERE p.proname = 'upgrade_user_to_business_owner';
--   -- 2 filas: true, true, {search_path=public, pg_temp}, misma ACL que antes
