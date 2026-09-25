-- =============================================================================
-- Arreglo de seguridad 2026-09-23
--
-- Auditoria local (Docker) reprodujo, con el JWT de un usuario normal:
--   1. PATCH profiles {"role":"admin","plan":"pro","business_limit":999} -> 204.
--   2. POST reviews {status:'approved', source:'google', original_author_name:...}
--      -> 201 y la resena sale en la ficha publica como de Google.
--   3. POST claims / business_claims / review_appeals ya con status 'approved'.
--   4. PATCH businesses {is_featured, is_verified, plan} sobre la propia empresa.
--
-- Causa de 1 y 4: los triggers guard_* eran SECURITY DEFINER. Dentro de una
-- funcion SECURITY DEFINER `current_user` es su dueno (postgres), asi que el
-- bypass `IF current_user IN ('postgres',...)` se cumplia SIEMPRE.
--
-- Arreglo: los guards pasan a SECURITY INVOKER. Asi `current_user` vuelve a ser
-- el rol real que ejecuta la sentencia:
--   - REST de un usuario           -> 'authenticated'  -> se aplican las reglas
--   - Edge Function con service key -> 'service_role'   -> bypass
--   - RPC SECURITY DEFINER oficial  -> 'postgres'       -> bypass (p.ej.
--     upgrade_user_to_business_owner sube el rol a business_owner)
--   - SQL editor / cron             -> 'postgres'       -> bypass
-- El check de admin lee profiles, que es legible por authenticated (policy
-- publica de lectura), asi que funciona igual en modo invoker.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. profiles: el guard deja de ser SECURITY DEFINER.
-- -----------------------------------------------------------------------------
ALTER FUNCTION public.guard_profile_sensitive_columns() SECURITY INVOKER;

-- Columnas que el guard original no cubre: created_at se muestra como
-- "Miembro desde" (antiguedad falseable) y reviews_count es un contador.
-- Trigger aparte para no reescribir el guard original.
CREATE OR REPLACE FUNCTION public.guard_profile_extra_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  caller_role public.user_role;
  col text;
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role = 'admin'::public.user_role THEN
    RETURN NEW;
  END IF;
  FOREACH col IN ARRAY ARRAY['created_at', 'reviews_count'] LOOP
    IF (to_jsonb(NEW) -> col) IS DISTINCT FROM (to_jsonb(OLD) -> col) THEN
      RAISE EXCEPTION 'No autorizado: campos protegidos del perfil sólo pueden modificarlos admin o service_role.';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_profile_extra_columns ON public.profiles;
CREATE TRIGGER trg_guard_profile_extra_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_extra_columns();

-- El admin necesitaba poder editar perfiles ajenos (cambio de rol, Enterprise,
-- aprobar reclamaciones) y no habia policy: el UPDATE afectaba a 0 filas sin
-- error y la UI decia "ok". El guard sigue impidiendo que un no-admin toque
-- los campos protegidos.
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- -----------------------------------------------------------------------------
-- 2. businesses: invoker + `plan` e `is_verified` pasan a ser protegidos.
--    `plan` activa funciones de pago en la ficha (resumen IA) y solo deben
--    cambiarlo el webhook de Stripe (service_role) o las RPC oficiales.
--
--    Las columnas se comparan via jsonb a proposito. La version anterior
--    nombraba `is_selected_for_monthly_scrape` y `last_google_scrape_*` como
--    campos de NEW; en un esquema donde alguna no exista, eso lanza 42703 y
--    bloquea TODA edicion de empresas. Nunca se noto porque el bypass roto
--    salia antes. jsonb devuelve NULL para una clave ausente y
--    jsonb_populate_record ignora claves que no son columnas.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_business_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  caller_role public.user_role;
  protected_cols text[] := ARRAY[
    'owner_id', 'is_featured', 'featured_order', 'is_verified', 'plan',
    'is_selected_for_monthly_scrape', 'last_google_scrape_at',
    'last_google_scrape_new_reviews', 'source_search_url'
  ];
  col text;
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role = 'admin'::public.user_role THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object(
      'is_featured', false,
      'is_verified', false,
      'plan', 'free',
      'is_selected_for_monthly_scrape', false,
      'last_google_scrape_at', NULL,
      'last_google_scrape_new_reviews', NULL,
      'source_search_url', NULL
    ));
    RETURN NEW;
  END IF;

  FOREACH col IN ARRAY protected_cols LOOP
    IF (to_jsonb(NEW) -> col) IS DISTINCT FROM (to_jsonb(OLD) -> col) THEN
      RAISE EXCEPTION 'No autorizado: campos protegidos del negocio sólo pueden modificarlos admin o service_role.';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

-- -----------------------------------------------------------------------------
-- 3. reviews: una resena creada por un usuario SIEMPRE entra pendiente, como
--    resena de Opynio, sin autor suplantado ni contadores inflados.
--    Tambien corrige que las resenas web se guardaran con source='manual'
--    (default de la tabla) y no contaran en los chips "Todas"/"Opynio".
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_review_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  caller_role public.user_role;
  col text;
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role = 'admin'::public.user_role THEN
    RETURN NEW;
  END IF;

  -- Mismo enfoque jsonb que en businesses: tolera columnas ausentes.
  IF TG_OP = 'INSERT' THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object(
      'status', 'pending',
      'source', 'opynio',
      'source_id', NULL,
      'original_author_name', NULL,
      'original_response_text', NULL,
      'original_response_date', NULL,
      'published_at', NULL,
      'rejection_reason', NULL,
      'helpful_votes', 0,
      'not_helpful_votes', 0,
      'helpful_count', 0,
      'is_verified_customer', false,
      'created_at', now()
    ));
    RETURN NEW;
  END IF;

  FOREACH col IN ARRAY ARRAY[
    'status', 'source', 'source_id', 'user_id', 'business_id',
    'original_author_name', 'published_at', 'rejection_reason',
    'helpful_votes', 'not_helpful_votes', 'helpful_count',
    'is_verified_customer', 'created_at',
    -- La "respuesta de la empresa" importada y el sello de compra verificada:
    -- el autor podia escribirse una respuesta falsa de la empresa en su propia
    -- resena (visible al publico al aprobarse). is_verified_purchase se marca
    -- al crear la resena; despues ya no lo cambia el autor.
    'original_response_text', 'original_response_date', 'is_verified_purchase'
  ] LOOP
    IF (to_jsonb(NEW) -> col) IS DISTINCT FROM (to_jsonb(OLD) -> col) THEN
      RAISE EXCEPTION 'No autorizado: campos protegidos de la reseña sólo pueden modificarlos admin o service_role.';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_review_sensitive_columns ON public.reviews;
CREATE TRIGGER trg_guard_review_sensitive_columns
  BEFORE INSERT OR UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_review_sensitive_columns();

-- El contador de votos actualiza la resena de OTRA persona con los permisos
-- del votante; con RLS eso afectaba a 0 filas y los contadores no se movian.
-- Pasa a SECURITY DEFINER (y, por tanto, bypass del guard anterior).
ALTER FUNCTION public.update_review_vote_counts() SECURITY DEFINER;
ALTER FUNCTION public.update_review_vote_counts() SET search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- 4. claims / business_claims / review_appeals: lo que crea un usuario entra
--    siempre pendiente y sin campos de resolucion.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_request_status_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
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

  -- `status` es enum en claims y text en las otras dos; jsonb_populate_record
  -- hace el cast en ambos casos e ignora las columnas que una tabla no tenga
  -- (resolved_by solo existe en claims).
  NEW := jsonb_populate_record(NEW, jsonb_build_object(
    'status', 'pending',
    'admin_notes', NULL,
    'resolved_at', NULL,
    'resolved_by', NULL
  ));
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_claims_insert ON public.claims;
CREATE TRIGGER trg_guard_claims_insert
  BEFORE INSERT ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.guard_request_status_on_insert();

-- business_claims existe en la base local (docs/01-DATABASE-SETUP.md) pero NO
-- en produccion (bloqueo B2 del runbook docs/DESPLIEGUE-2026-09.md: con el
-- CREATE TRIGGER a pelo, la migracion fallaba entera en prod). Solo si existe.
DO $do$
BEGIN
  IF to_regclass('public.business_claims') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_guard_business_claims_insert ON public.business_claims';
    EXECUTE 'CREATE TRIGGER trg_guard_business_claims_insert
               BEFORE INSERT ON public.business_claims
               FOR EACH ROW EXECUTE FUNCTION public.guard_request_status_on_insert()';
  END IF;
END
$do$;

DROP TRIGGER IF EXISTS trg_guard_review_appeals_insert ON public.review_appeals;
CREATE TRIGGER trg_guard_review_appeals_insert
  BEFORE INSERT ON public.review_appeals
  FOR EACH ROW EXECUTE FUNCTION public.guard_request_status_on_insert();

-- Solo se apela una resena PROPIA y RECHAZADA. La policy anterior solo
-- comprobaba user_id: se podia apelar la resena de otra persona.
DROP POLICY IF EXISTS "Users can create appeals" ON public.review_appeals;
CREATE POLICY "Users can create appeals"
  ON public.review_appeals FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.reviews r
      WHERE r.id = review_id
        AND r.user_id = auth.uid()
        AND r.status = 'rejected'
    )
  );

COMMIT;
