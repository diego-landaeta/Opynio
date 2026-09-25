-- =============================================================================
-- El dueno de una empresa no puede resenar su propia empresa. 2026-09-24
--
-- Hasta ahora solo lo impedia el cliente (WriteReviewPage). Con el token de la
-- sesion cualquiera podia saltarselo insertando directamente en /rest/v1/reviews.
-- En produccion quedo una resena "El negocio es mio." de una duena.
--
-- Regla: BEFORE INSERT OR UPDATE OF business_id, user_id en reviews. Si
-- NEW.user_id es el owner_id de NEW.business_id, error:
--   SQLSTATE  OPY01  (PostgREST lo devuelve como `code: "OPY01"`, HTTP 400)
--   mensaje   OWN_BUSINESS_REVIEW: ...
-- El frontend (services/supabaseService.ts) traduce ese codigo a
-- businessPage.cannotReviewOwnBusiness.
--
-- Excepciones (decididas, no por defecto):
--   1. user_id NULL: resenas importadas y cargas manuales mensuales (se insertan
--      con user_id NULL y original_author_name). No tienen autor Opynio.
--   2. Importaciones de terceros (source google/scraped/trustindex/imported)
--      hechas por un llamador de confianza (service_role/postgres o admin). Los
--      scrapers (admin-rescrape-google-reviews, process-scraping-queue,
--      approve-and-process-now, instant-full-scrape) guardan la resena de Google
--      con user_id = el admin o el usuario que lanza la importacion; no es una
--      opinion suya y no debe romper si ese usuario es tambien el dueno.
--      Para un usuario normal no hace falta mirar el llamador:
--      guard_review_sensitive_columns ya fuerza source='opynio' en su INSERT, y
--      este trigger se llama trg_reviews_... para ejecutarse DESPUES de
--      trg_guard_... (orden alfabetico), asi ve el source ya saneado.
--   NO hay excepcion general para admins: un admin que es dueno de una empresa
--   tampoco debe opinar de ella, y las cargas manuales ya van con user_id NULL.
--
-- En UPDATE solo se comprueba si business_id o user_id cambian de verdad, para
-- no bloquear la edicion de filas antiguas que ya incumplian la regla (la
-- migracion NO toca datos existentes). Tampoco cubre el caso inverso (asignar
-- como dueno a alguien que ya reseno la empresa): eso es una operacion de admin
-- sobre businesses.
--
-- Idempotente. Rollback:
--   DROP TRIGGER IF EXISTS trg_reviews_block_owner_self_review ON public.reviews;
--   DROP FUNCTION IF EXISTS public.block_owner_self_review();
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.block_owner_self_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner uuid;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id
     AND NEW.business_id IS NOT DISTINCT FROM OLD.business_id THEN
    RETURN NEW;
  END IF;

  -- session_user y no current_user: dentro de SECURITY DEFINER current_user es
  -- el dueno de la funcion. Por PostgREST session_user es 'authenticator' y el
  -- rol real sale del JWT (auth.role()).
  IF NEW.source IN ('google', 'scraped', 'trustindex', 'imported')
     AND (session_user IN ('postgres', 'supabase_admin')
          OR auth.role() = 'service_role'
          OR public.opynio_is_admin()) THEN
    RETURN NEW;
  END IF;

  SELECT owner_id INTO v_owner FROM public.businesses WHERE id = NEW.business_id;

  IF v_owner IS NOT NULL AND v_owner = NEW.user_id THEN
    RAISE EXCEPTION USING
      ERRCODE = 'OPY01',
      MESSAGE = 'OWN_BUSINESS_REVIEW: el dueño de una empresa no puede reseñar su propia empresa.',
      HINT    = 'La reseña debe escribirla un cliente, no la cuenta dueña de la empresa.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.block_owner_self_review() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_reviews_block_owner_self_review ON public.reviews;
CREATE TRIGGER trg_reviews_block_owner_self_review
  BEFORE INSERT OR UPDATE OF business_id, user_id ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.block_owner_self_review();

COMMIT;
