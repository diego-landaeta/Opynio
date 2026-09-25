-- =============================================================================
-- Seguridad, segunda tanda. 2026-09-23
-- Todo reproducido en local con JWT reales (verificacion por lotes).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Votar la propia resena. La policy solo comprobaba user_id: el autor se
--    daba "util" a si mismo.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can insert their own votes" ON public.review_votes;
CREATE POLICY "Authenticated users can insert their own votes"
  ON public.review_votes FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (SELECT 1 FROM public.reviews r WHERE r.id = review_id AND r.user_id = auth.uid())
  );

-- -----------------------------------------------------------------------------
-- 2. Metricas expuestas a anonimos.
--    - business_stats: vista SECURITY DEFINER que cuenta pendientes y
--      rechazadas y las ensena a cualquiera. No la usa el frontend ni ninguna
--      Edge Function (widget-proxy usa la RPC widget_business_stats).
--    - refresh_business_metrics(): ejecutable por anon (carga gratuita).
--    - businesses_without_reviews(): solo la usa el panel de admin.
--    Solo se retiran permisos; nada se borra.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.business_stats') IS NOT NULL THEN
    EXECUTE 'REVOKE SELECT ON public.business_stats FROM anon, authenticated';
  END IF;
  IF to_regprocedure('public.refresh_business_metrics()') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.refresh_business_metrics() FROM anon, authenticated, public';
  END IF;
  IF to_regprocedure('public.businesses_without_reviews()') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.businesses_without_reviews() FROM anon, public';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.businesses_without_reviews() TO authenticated, service_role';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3. Username unico y fijo.
--    No habia UNIQUE: dos perfiles podian tener el mismo @username y el usuario
--    lo cambiaba por REST aunque la UI dice "No se podra cambiar".
--    Trigger en vez de indice UNIQUE a proposito: un indice fallaria al crearse
--    si produccion ya tiene duplicados. Esto protege desde hoy sin tocar filas.
--    En el alta (INSERT desde handle_new_user) un duplicado NO rompe el
--    registro: se deja el username vacio y la app se lo pide despues.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_username()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  is_admin boolean;
BEGIN
  NEW.username := NULLIF(btrim(NEW.username), '');

  IF TG_OP = 'UPDATE' AND NEW.username IS NOT DISTINCT FROM OLD.username THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') INTO is_admin;

  -- Una vez puesto, solo lo cambia un admin (o el sistema, sin sesion).
  IF TG_OP = 'UPDATE' AND OLD.username IS NOT NULL AND auth.uid() IS NOT NULL AND NOT is_admin THEN
    RAISE EXCEPTION 'El nombre de usuario no se puede cambiar.';
  END IF;

  IF NEW.username IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(username) = lower(NEW.username) AND id <> NEW.id
  ) THEN
    IF TG_OP = 'INSERT' THEN
      NEW.username := NULL;
    ELSE
      RAISE EXCEPTION 'Ese nombre de usuario ya está en uso.' USING ERRCODE = '23505';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_username ON public.profiles;
CREATE TRIGGER trg_guard_username
  BEFORE INSERT OR UPDATE OF username ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_username();

-- -----------------------------------------------------------------------------
-- 4. Limite de empresas saltable por concurrencia. enforce_business_limit
--    cuenta y luego inserta: con 20-25 INSERT simultaneos un free acabo con 3-5
--    empresas. Un bloqueo por dueno, tomado en un trigger que corre ANTES
--    (orden alfabetico: "a_lock..." < "trg_enforce..."), serializa las altas
--    del mismo dueno; la cuenta de enforce_business_limit ve ya las anteriores.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lock_business_owner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('business_owner:' || NEW.owner_id::text, 0));
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS a_lock_business_owner ON public.businesses;
CREATE TRIGGER a_lock_business_owner
  BEFORE INSERT OR UPDATE OF owner_id ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.lock_business_owner();

-- -----------------------------------------------------------------------------
-- 5. Storage business_logos: cualquier autenticado subia a cualquier ruta,
--    incluida la carpeta de productos de otra empresa. La app solo sube a
--    productos/<business_id>/... (uploadProductImage). Se permite:
--      - admin: cualquier ruta del bucket
--      - dueno: solo productos/<id de una empresa suya>/...
--    OJO: en produccion la policy puede llamarse distinto. Revisa antes
--    Storage -> Policies: si hay otra policy de INSERT permisiva para este
--    bucket, hay que quitarla tambien (las policies se suman con OR).
-- -----------------------------------------------------------------------------
-- La comprobacion de propiedad va en una funcion SECURITY DEFINER: evaluada
-- desde la policy de storage, una subconsulta directa a businesses dependia de
-- la RLS de esa tabla y rechazaba tambien al dueno legitimo.
CREATE OR REPLACE FUNCTION public.user_owns_business(p_business_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id::text = p_business_id AND b.owner_id = auth.uid()
  );
$$;
REVOKE EXECUTE ON FUNCTION public.user_owns_business(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.user_owns_business(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.opynio_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;
GRANT EXECUTE ON FUNCTION public.opynio_is_admin() TO authenticated, service_role;

DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
CREATE POLICY "Authenticated users can upload logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'business_logos'
    AND (
      public.opynio_is_admin()
      OR (
        (storage.foldername(name))[1] = 'productos'
        AND public.user_owns_business((storage.foldername(name))[2])
      )
    )
  );

COMMIT;
