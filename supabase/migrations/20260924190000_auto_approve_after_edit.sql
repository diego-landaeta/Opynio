-- =============================================================================
-- La aprobacion automatica cuenta 24 h desde que la resena ENTRO en pendiente.
-- 2026-09-24
--
-- En PRODUCCION hay un cron (approve_pending_reviews_hourly, «0 * * * *», como
-- postgres) que llama a public.approve_old_pending_reviews():
--   UPDATE reviews SET status = 'approved', published_at = timezone('utc', now())
--   WHERE status = 'pending' AND created_at < timezone('utc', now()) - 24 h
-- Desde 20260924160000 el autor puede editar una resena aprobada y esta vuelve a
-- 'pending' para moderarla. Pero su created_at es antiguo: el cron la volvia a
-- aprobar en menos de una hora, SIN que nadie viera el texto nuevo.
--
-- Ahora:
--   1. reviews.pending_since (timestamptz, default now()): cuando entro por
--      ultima vez en 'pending'. Las filas existentes quedan NULL (sin reescribir
--      la tabla); las pendientes de hoy se rellenan con created_at.
--   2. Trigger trg_reviews_pending_since (BEFORE INSERT OR UPDATE; se llama
--      trg_reviews_* para correr DESPUES de trg_guard_review_sensitive_columns,
--      que es quien pone status = 'pending'). Pone pending_since = now():
--        - en toda alta hecha por un cliente (lo que mande se ignora);
--        - cuando una resena PASA a 'pending' (cualquier llamador);
--        - cuando un cliente (no postgres/service_role) cambia el contenido de
--          una resena que ya estaba pendiente: el texto que se publica solo
--          tiene que haber estado 24 h en la cola.
--      Los contadores de votos (update_review_vote_counts, que corre como
--      postgres) no lo mueven: votar una pendiente no la retrasa. Un cliente no
--      puede fijar pending_since a mano; postgres/service_role si (backfill).
--   3. approve_old_pending_reviews(): misma firma, mismo SECURITY INVOKER y
--      mismo dueno; aprueba WHERE status = 'pending' AND
--      coalesce(pending_since, created_at) < now() - 24 h. published_at se pone
--      como hoy, solo al aprobar. El cron no se toca (sigue llamando a la misma
--      funcion). Solo la ejecutan postgres (el cron) y service_role: antes
--      tambien anon/authenticated, sin uso en el codigo.
--
-- En la base local no hay cron: la funcion se crea igual (CREATE OR REPLACE).
-- Idempotente.
--
-- Vuelta atras:
--   DROP TRIGGER IF EXISTS trg_reviews_pending_since ON public.reviews;
--   DROP FUNCTION IF EXISTS public.reviews_pending_since();
--   recrear approve_old_pending_reviews() con la definicion de arriba (created_at)
--   ALTER TABLE public.reviews DROP COLUMN IF EXISTS pending_since;  -- opcional
-- =============================================================================

BEGIN;

-- 1. Columna ------------------------------------------------------------------
-- Sin DEFAULT en el ADD: las filas existentes quedan NULL y no se reescribe la
-- tabla. El DEFAULT se pone despues y vale para las altas nuevas.
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS pending_since timestamptz;
ALTER TABLE public.reviews ALTER COLUMN pending_since SET DEFAULT now();

COMMENT ON COLUMN public.reviews.pending_since IS
  'Cuando entro la resena por ultima vez en pending. La aprobacion automatica (approve_old_pending_reviews) cuenta 24 h desde aqui.';

-- 2. Trigger ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reviews_pending_since()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_confianza boolean := current_user IN ('postgres', 'supabase_admin', 'service_role');
  v_fuera text[] := ARRAY['updated_at', 'pending_since', 'helpful_votes', 'not_helpful_votes', 'helpful_count'];
BEGIN
  -- Un proceso de confianza que fija el valor a mano (backfill, importacion).
  IF v_confianza AND (TG_OP = 'INSERT' OR NEW.pending_since IS DISTINCT FROM OLD.pending_since) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.pending_since := now();
    RETURN NEW;
  END IF;

  IF NEW.status = 'pending' AND (
       OLD.status IS DISTINCT FROM 'pending'
       OR (NOT v_confianza AND (to_jsonb(NEW) - v_fuera) IS DISTINCT FROM (to_jsonb(OLD) - v_fuera))
     ) THEN
    NEW.pending_since := now();
  ELSE
    NEW.pending_since := OLD.pending_since;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.reviews_pending_since() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_reviews_pending_since ON public.reviews;
CREATE TRIGGER trg_reviews_pending_since
  BEFORE INSERT OR UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.reviews_pending_since();

-- Pendientes de hoy: cuentan desde su alta, como hasta ahora (en prod, 0 el 24/09).
UPDATE public.reviews
SET pending_since = created_at
WHERE status = 'pending' AND pending_since IS NULL;

-- 3. Aprobacion automatica ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_old_pending_reviews()
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE public.reviews
  SET
    status = 'approved',
    published_at = timezone('utc'::text, now())
  WHERE
    status = 'pending'
    AND coalesce(pending_since, created_at) < now() - interval '24 hours';
END;
$function$;

COMMENT ON FUNCTION public.approve_old_pending_reviews() IS
  'La llama el cron approve_pending_reviews_hourly. Aprueba las pendientes que llevan 24 h en la cola (pending_since), no desde su alta.';

REVOKE EXECUTE ON FUNCTION public.approve_old_pending_reviews() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_old_pending_reviews() TO service_role;

COMMIT;

-- Comprobacion tras aplicar:
--   SELECT column_default FROM information_schema.columns
--   WHERE table_name = 'reviews' AND column_name = 'pending_since';            -- now()
--   SELECT tgname FROM pg_trigger WHERE tgname = 'trg_reviews_pending_since';  -- 1 fila
--   SELECT position('pending_since' in prosrc) > 0, prosecdef
--   FROM pg_proc WHERE proname = 'approve_old_pending_reviews';                -- true, false
