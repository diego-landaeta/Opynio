-- =============================================================================
-- Aviso al dueno cuando se publica una resena en su empresa. 2026-09-29
--
-- QA del 28/09: «me mande una resena y no me notifica nada». La campana solo
-- avisaba de respuestas a resenas y de soporte; el dueno no se enteraba de las
-- resenas nuevas de su empresa.
--
-- Trigger AFTER INSERT/UPDATE OF status en reviews: cuando una resena pasa a
-- 'approved' (moderacion, aprobacion automatica a las 24 h o insercion ya
-- aprobada) se crea una notificacion 'new_review' para el dueno.
--   - Solo resenas escritas en la web: original_author_name IS NULL. Las
--     importadas (Google, scraping y la carga mensual, que llevan el autor
--     original) no avisan: serian miles de golpe.
--   - No avisa si la empresa no tiene dueno o si el autor es el propio dueno.
--   - Columnas de notifications comunes a produccion y local: user_id, type,
--     message (produccion no tiene `link`; la campana lleva a «Mis negocios»).
--
-- El correo lo manda la Edge Function send-notification-email (al aprobar
-- desde moderacion); la aprobacion automatica solo deja el aviso en la web.
--
-- Idempotente. Rollback: DROP TRIGGER trg_reviews_notify_owner ON reviews;
-- DROP FUNCTION public.notify_owner_new_review().
-- =============================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.notify_owner_new_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_name text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'approved' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' THEN
    RETURN NEW;
  END IF;
  IF NEW.original_author_name IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT b.owner_id, b.name INTO v_owner, v_name
    FROM public.businesses b
   WHERE b.id = NEW.business_id;

  IF v_owner IS NULL OR v_owner = NEW.user_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, message)
  VALUES (
    v_owner,
    'new_review',
    left(coalesce(v_name, '') || ' · ' || NEW.rating || '★' ||
         CASE WHEN coalesce(btrim(NEW.title), '') <> '' THEN ' · ' || btrim(NEW.title) ELSE '' END, 200)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reviews_notify_owner ON public.reviews;
CREATE TRIGGER trg_reviews_notify_owner
  AFTER INSERT OR UPDATE OF status ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.notify_owner_new_review();

REVOKE EXECUTE ON FUNCTION public.notify_owner_new_review() FROM anon, public;

COMMIT;
