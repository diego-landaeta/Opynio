-- =============================================================================
-- Security hardening — 2026-04-29
-- =============================================================================
-- Cierra los siguientes bugs verificados contra la base real:
--   [#A1] profiles UPDATE permite cambiar role/plan/limits vía PostgREST.
--   [#A2] businesses UPDATE permite cambiar owner_id, is_featured, etc.
--   [#B1] admin_update_user_role: NULL != 'admin' pasa el check (anon → admin).
--   [#B2] admin_assign_business_owner: sin check de admin (anon → owner).
--   [#B3] admin_resolve_claim: mismo NULL-pitfall.
--   [#B4] resolve_review_appeal: mismo NULL-pitfall.
--   [#B5] upgrade_user_to_business_owner (9-arg): el cliente fija su propio plan.
--   [#B6] upgrade_user_to_business_owner (3-arg): sin check de auth.uid()
--         + INSERT sobre columna `plan` inexistente (función estaba rota).
--   [#B7] finish_business_signup: sin check de auth.uid().
--   [#B8] increment_ai_credits: acepta cualquier p_user_id.
--   [#C1] reviews SELECT con qual=true tapa la policy de moderación.
--   [#C2] businesses tiene policies SELECT/UPDATE duplicadas.
--   [#C3] slug_migration_log y translation_cache con qual=true en INSERT/UPDATE.
--   [#D1] business_limit no se aplica a nivel de BD.
-- Todas las funciones afectadas se recrean con SET search_path = public, pg_temp
-- para mitigar 'function_search_path_mutable'.
-- =============================================================================
-- Estrategia: en lugar de REVOKE column-level (que rompería AdminEnterprisePage,
-- AssignBusinessPage y AuthContext fallback), se usan triggers BEFORE que:
--   • Bypass automático para current_user IN (postgres, supabase_admin,
--     service_role)  →  edge functions, webhook de Stripe y SECURITY DEFINER
--     functions (todas owned por postgres) siguen funcionando sin cambios.
--   • Bypass para usuarios cuyo profile.role='admin'  →  el panel de admin
--     mantiene sus updates directos desde el cliente.
--   • Para todos los demás:
--       - INSERT: coerciona los campos sensibles a sus defaults seguros.
--       - UPDATE: RAISE si el caller intenta cambiarlos.
-- =============================================================================

BEGIN;

-- =============================================================================
-- [#A1] guard_profile_sensitive_columns
-- Bloquea la auto-promoción a admin y la auto-asignación de plan/limits.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  caller_role public.user_role;
BEGIN
  -- Bypass: roles privilegiados (edge functions, postgres-owned SECURITY DEFINER).
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  -- Bypass: el caller es admin según su propio profile.
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role = 'admin'::public.user_role THEN
    RETURN NEW;
  END IF;

  -- Caller no privilegiado:
  IF TG_OP = 'INSERT' THEN
    -- Forzamos defaults seguros sobre cualquier valor enviado por el cliente.
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
    RETURN NEW;
  END IF;

  -- TG_OP = 'UPDATE'
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
  THEN
    RAISE EXCEPTION 'No autorizado: campos protegidos del perfil sólo pueden modificarlos admin o service_role.';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_profile_sensitive_columns ON public.profiles;
CREATE TRIGGER trg_guard_profile_sensitive_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_sensitive_columns();

-- =============================================================================
-- [#A2] guard_business_sensitive_columns
-- Protege owner_id, is_featured, is_selected_for_monthly_scrape, los campos de
-- scraping y source_search_url. Mismo patrón que profiles.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.guard_business_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
    NEW.is_featured := false;
    NEW.is_selected_for_monthly_scrape := false;
    NEW.last_google_scrape_at := NULL;
    NEW.last_google_scrape_new_reviews := NULL;
    NEW.source_search_url := NULL;
    RETURN NEW;
  END IF;

  -- UPDATE: bloquear cambios a campos protegidos.
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id
     OR NEW.is_featured IS DISTINCT FROM OLD.is_featured
     OR NEW.is_selected_for_monthly_scrape IS DISTINCT FROM OLD.is_selected_for_monthly_scrape
     OR NEW.last_google_scrape_at IS DISTINCT FROM OLD.last_google_scrape_at
     OR NEW.last_google_scrape_new_reviews IS DISTINCT FROM OLD.last_google_scrape_new_reviews
     OR NEW.source_search_url IS DISTINCT FROM OLD.source_search_url
  THEN
    RAISE EXCEPTION 'No autorizado: campos protegidos del negocio sólo pueden modificarlos admin o service_role.';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_business_sensitive_columns ON public.businesses;
CREATE TRIGGER trg_guard_business_sensitive_columns
  BEFORE INSERT OR UPDATE ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_business_sensitive_columns();

-- =============================================================================
-- [#B1] admin_update_user_role — protección contra NULL caller_role.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_update_user_role(
    target_user_id uuid,
    new_role public.user_role,
    business_name_to_set text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  caller_role public.user_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado.';
  END IF;

  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role IS DISTINCT FROM 'admin'::public.user_role THEN
    RAISE EXCEPTION 'Permiso denegado: Debes ser un administrador para cambiar roles de usuario.';
  END IF;

  UPDATE public.profiles SET role = new_role WHERE id = target_user_id;

  IF new_role = 'business_owner' THEN
    IF business_name_to_set IS NULL OR trim(business_name_to_set) = '' THEN
      RAISE EXCEPTION 'El nombre del negocio es obligatorio al asignar el rol de propietario.';
    END IF;

    IF EXISTS (SELECT 1 FROM public.businesses WHERE name = business_name_to_set) THEN
      RAISE EXCEPTION 'El nombre de negocio "%" ya está en uso.', business_name_to_set;
    END IF;

    INSERT INTO public.businesses (owner_id, name) VALUES (target_user_id, business_name_to_set);
  END IF;
END;
$function$;

-- =============================================================================
-- [#B2] admin_assign_business_owner — añadir check de admin.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_assign_business_owner(
    business_id uuid,
    user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  caller_role public.user_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado.';
  END IF;

  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role IS DISTINCT FROM 'admin'::public.user_role THEN
    RAISE EXCEPTION 'Permiso denegado: solo administradores.';
  END IF;

  UPDATE public.profiles SET role = 'business_owner' WHERE id = user_id;
  UPDATE public.businesses SET owner_id = user_id WHERE id = business_id;
END;
$function$;

-- =============================================================================
-- [#B3] admin_resolve_claim — fix NULL pitfall + search_path.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_resolve_claim(
    p_claim_id bigint,
    p_new_status public.claim_status,
    p_admin_notes text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_claim_user_id uuid;
    v_claim_business_id uuid;
    v_caller_role public.user_role;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'No autenticado.';
    END IF;

    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    IF v_caller_role IS DISTINCT FROM 'admin'::public.user_role THEN
        RAISE EXCEPTION 'Acción solo para administradores.';
    END IF;

    SELECT user_id, business_id INTO v_claim_user_id, v_claim_business_id
    FROM public.claims
    WHERE id = p_claim_id;

    IF v_claim_user_id IS NULL OR v_claim_business_id IS NULL THEN
        RAISE EXCEPTION 'Reclamación no encontrada.';
    END IF;

    IF p_new_status = 'approved' THEN
        PERFORM public.admin_assign_business_owner(v_claim_business_id, v_claim_user_id);
    END IF;

    UPDATE public.claims
    SET status = p_new_status,
        admin_notes = p_admin_notes,
        resolved_at = timezone('utc'::text, now()),
        resolved_by = auth.uid()
    WHERE id = p_claim_id;
END;
$function$;

-- =============================================================================
-- [#B4] resolve_review_appeal — fix NULL pitfall + search_path.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.resolve_review_appeal(
    p_appeal_id bigint,
    p_new_status text,
    p_admin_notes text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_appeal_review_id bigint;
    v_caller_role public.user_role;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'No autenticado.';
    END IF;

    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    IF v_caller_role IS DISTINCT FROM 'admin'::public.user_role THEN
        RAISE EXCEPTION 'Acción solo para administradores.';
    END IF;

    SELECT review_id INTO v_appeal_review_id
    FROM public.review_appeals
    WHERE id = p_appeal_id;

    IF v_appeal_review_id IS NULL THEN
        RAISE EXCEPTION 'Apelación no encontrada.';
    END IF;

    IF p_new_status = 'approved' THEN
        UPDATE public.reviews
        SET status = 'approved',
            published_at = timezone('utc'::text, now()),
            rejection_reason = NULL
        WHERE id = v_appeal_review_id;
    END IF;

    UPDATE public.review_appeals
    SET status = p_new_status,
        admin_notes = p_admin_notes,
        resolved_at = timezone('utc'::text, now()),
        resolved_by = auth.uid()
    WHERE id = p_appeal_id;
END;
$function$;

-- =============================================================================
-- [#B5] upgrade_user_to_business_owner (9-arg) — bloqueo CRÍTICO.
-- El plan ya NO se setea aquí: lo fija exclusivamente el webhook de Stripe.
-- También se añade verificación de auth.uid() y se respeta el business_limit.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.upgrade_user_to_business_owner(
    p_business_name text,
    p_category text,
    p_plan text,                      -- se ignora a propósito (compatibilidad)
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
        WHEN 'enterprise' THEN 2147483647
        ELSE 1
    END;
  END IF;

  SELECT count(*) INTO current_count
  FROM public.businesses WHERE owner_id = auth.uid();

  IF current_count >= effective_limit THEN
    RAISE EXCEPTION 'Has alcanzado el límite de negocios para tu plan (%).', effective_limit;
  END IF;

  -- Sólo se asciende el rol; el plan permanece intacto hasta que Stripe confirme.
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

-- =============================================================================
-- [#B6] upgrade_user_to_business_owner (3-arg) — auth check + búsqueda + arreglo
-- del INSERT (la versión original referenciaba la columna `plan` que NO existe
-- en `businesses`, así que estaba rota).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.upgrade_user_to_business_owner(
    p_business_name text,
    p_category text,
    p_plan text                       -- ignorado a propósito
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
        WHEN 'free' THEN 1 WHEN 'starter' THEN 1 WHEN 'growth' THEN 3
        WHEN 'pro' THEN 10 WHEN 'enterprise' THEN 2147483647 ELSE 1
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

-- =============================================================================
-- [#B7] finish_business_signup — añadir check de auth.uid() + search_path.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.finish_business_signup(
    business_name text,
    p_country character varying
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado.';
  END IF;

  UPDATE public.profiles
  SET role = 'business_owner'
  WHERE id = auth.uid();

  INSERT INTO public.businesses (owner_id, name, country, sedes)
  VALUES (
    auth.uid(), business_name, p_country,
    jsonb_build_array(jsonb_build_object('country_code', p_country))
  );
END;
$function$;

-- =============================================================================
-- [#B8] increment_ai_credits — sólo el propio usuario o service_role.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.increment_ai_credits(
    p_user_id uuid,
    p_credits_used integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'No autorizado: sólo puedes operar sobre tus propios créditos.';
  END IF;

  IF p_credits_used IS NULL OR p_credits_used <= 0 THEN
    RAISE EXCEPTION 'p_credits_used debe ser positivo.';
  END IF;

  UPDATE public.profiles
  SET ai_credits_used = 0,
      ai_credits_last_reset = timezone('utc'::text, now())
  WHERE id = p_user_id
    AND ai_credits_last_reset < (timezone('utc'::text, now()) - interval '1 month');

  UPDATE public.profiles
  SET ai_credits_used = ai_credits_used + p_credits_used
  WHERE id = p_user_id;
END;
$function$;

-- =============================================================================
-- handle_new_user — añadir search_path. Lógica intacta.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  INSERT INTO public.profiles (id, name, role, username, plan)
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'name',
    COALESCE((new.raw_user_meta_data ->> 'role')::public.user_role, 'authenticated'),
    new.raw_user_meta_data ->> 'username',
    COALESCE(new.raw_user_meta_data ->> 'plan', 'free')
  );

  IF (new.raw_user_meta_data ->> 'role') = 'business_owner' THEN
    INSERT INTO public.businesses (owner_id, name, country, sedes)
    VALUES (
      new.id,
      new.raw_user_meta_data ->> 'businessName',
      new.raw_user_meta_data ->> 'country',
      jsonb_build_array(jsonb_build_object('country_code', new.raw_user_meta_data ->> 'country'))
    );
  END IF;

  RETURN new;
END;
$function$;

-- =============================================================================
-- Defensa en profundidad: REVOKE EXECUTE de admin_* a anon. Authenticated puede
-- llamarlas porque ahora cada una valida internamente que el caller sea admin.
-- =============================================================================
REVOKE EXECUTE ON FUNCTION public.admin_update_user_role(uuid, public.user_role, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_assign_business_owner(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_resolve_claim(bigint, public.claim_status, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.resolve_review_appeal(bigint, text, text) FROM anon, public;

-- =============================================================================
-- [#C1] reviews: eliminar la policy SELECT con qual=true que tapa la moderación.
-- Añadir las que faltan (owner del negocio y admin ven todo).
-- =============================================================================
DROP POLICY IF EXISTS "Reviews are viewable by everyone." ON public.reviews;
DROP POLICY IF EXISTS "Business owners can read reviews of their businesses" ON public.reviews;
CREATE POLICY "Business owners can read reviews of their businesses"
  ON public.reviews FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = reviews.business_id AND b.owner_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Admins can read all reviews" ON public.reviews;
CREATE POLICY "Admins can read all reviews"
  ON public.reviews FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  ));

-- =============================================================================
-- [#C2] businesses: eliminar policies SELECT/UPDATE duplicadas (deja una).
-- =============================================================================
DROP POLICY IF EXISTS "Businesses are public and viewable by everyone" ON public.businesses;
DROP POLICY IF EXISTS "Businesses are viewable by everyone." ON public.businesses;
-- Queda "Anyone can view businesses" como única SELECT pública.

DROP POLICY IF EXISTS "Admins can update businesses" ON public.businesses;
DROP POLICY IF EXISTS "Admins can update businesses." ON public.businesses;
-- Queda "Admins can update all businesses" como única admin-update.

-- =============================================================================
-- [#C3] slug_migration_log y translation_cache: cerrar la policy `qual=true`.
-- Estas tablas son de uso interno; sólo service_role escribe.
-- =============================================================================
DROP POLICY IF EXISTS "Service role can manage slug_migration_log" ON public.slug_migration_log;
DROP POLICY IF EXISTS "Only service_role manages slug_migration_log" ON public.slug_migration_log;
CREATE POLICY "Only service_role manages slug_migration_log"
  ON public.slug_migration_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public insert" ON public.translation_cache;
DROP POLICY IF EXISTS "Allow public update" ON public.translation_cache;
DROP POLICY IF EXISTS "Only service_role writes translation_cache" ON public.translation_cache;
CREATE POLICY "Only service_role writes translation_cache"
  ON public.translation_cache FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- =============================================================================
-- [#D1] businesses INSERT: trigger que aplica business_limit en BD.
-- Cubre el camino "directo" (cliente llama supabase.from('businesses').insert()).
-- =============================================================================
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
  -- Bypass: no aplica si el insert no lo hace el propio dueño autenticado.
  -- Esto cubre service_role (auth.uid() NULL) y admin/scraping (owner_id NULL
  -- o distinto a auth.uid()).
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
        WHEN 'free' THEN 1 WHEN 'starter' THEN 1 WHEN 'growth' THEN 3
        WHEN 'pro' THEN 10 WHEN 'enterprise' THEN 2147483647 ELSE 1
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

DROP TRIGGER IF EXISTS trg_enforce_business_limit ON public.businesses;
CREATE TRIGGER trg_enforce_business_limit
  BEFORE INSERT ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_business_limit();

COMMIT;

-- =============================================================================
-- ROLLBACK MANUAL (referencia, NO se ejecuta):
--   DROP TRIGGER trg_guard_profile_sensitive_columns ON public.profiles;
--   DROP TRIGGER trg_guard_business_sensitive_columns ON public.businesses;
--   DROP TRIGGER trg_enforce_business_limit ON public.businesses;
--   DROP FUNCTION public.guard_profile_sensitive_columns();
--   DROP FUNCTION public.guard_business_sensitive_columns();
--   DROP FUNCTION public.enforce_business_limit();
--   Para las SECURITY DEFINER funcs hay que volver a CREATE OR REPLACE con sus
--   bodies originales (guardados en el chat).
--   Para policies: recrearlas desde el dump inicial.
-- =============================================================================
