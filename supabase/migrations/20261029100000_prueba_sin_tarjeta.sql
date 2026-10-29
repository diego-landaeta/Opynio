-- Prueba gratuita de 3 meses SIN tarjeta (issue #11, cambio de alcance del 29/10/2026). 2026-10-29
--
-- Hasta ahora el acceso completo de 90 dias solo lo concedia el webhook de Stripe al empezar el
-- checkout, que pide la tarjeta. Ahora se concede al crear o reclamar la PRIMERA empresa, sin Stripe:
-- se escribe profiles.trial_full_access_until (la misma columna de la migracion 20261026100000), y
-- plan_efectivo() y los candados del panel (utils/planFeatures.ts -> effectivePlan) ya desbloquean
-- todo mientras esa fecha este en el futuro. profiles.plan NO cambia: sigue en 'free' y, al acabar
-- la prueba, la empresa vuelve sola a las funciones del plan gratuito.
--
-- Reglas:
--   - Solo al recibir su PRIMERA empresa (alta o reclamacion aprobada). Las cuentas gratuitas que ya
--     tienen empresa no reciben la prueba (propuesta de la issue: solo empresas nuevas).
--   - Una sola vez por usuario y una sola vez por empresa (si la empresa cambia de dueno, el nuevo
--     dueno no recibe otra prueba por esa empresa). Lo garantiza free_trial_grants con dos UNIQUE.
--   - No se concede a administradores, a quien ya tiene un plan de pago ni a quien ya tuvo una
--     suscripcion de Stripe (en prueba o pagada).
--
-- El aviso por correo 7 dias antes del fin lo envia trial-ending-reminder (tarea diaria de la migracion
-- 20261027120000), que lee esta tabla ademas de las suscripciones de Stripe.
--
-- Fuera de esta migracion (pendiente, toca Stripe): create-checkout-session sigue dando 90 dias de
-- prueba en el checkout; quien tuvo esta prueba sin tarjeta y despues paga recibiria otra.
--
-- VUELTA ATRAS:
--   DROP TRIGGER IF EXISTS trg_conceder_prueba_sin_tarjeta ON public.businesses;
--   DROP FUNCTION IF EXISTS public.conceder_prueba_sin_tarjeta();
--   DROP TABLE IF EXISTS public.free_trial_grants;
--   (las fechas ya concedidas en profiles.trial_full_access_until se quedan; para quitarlas:
--    UPDATE public.profiles SET trial_full_access_until = NULL WHERE id IN (SELECT user_id FROM ...);)

-- 1. Registro de pruebas concedidas sin tarjeta.
CREATE TABLE IF NOT EXISTS public.free_trial_grants (
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- SET NULL, no CASCADE: si se borra la empresa, la prueba sigue constando como usada por ese
  -- usuario (si no, el checkout le daria otros 90 dias). La UNIQUE no choca con varios NULL.
  business_id uuid        REFERENCES public.businesses(id) ON DELETE SET NULL,
  granted_at  timestamptz NOT NULL DEFAULT now(),
  ends_at     timestamptz NOT NULL,
  -- Aviso por correo antes de acabar (trial-ending-reminder). NULL = aun no enviado; la funcion lo
  -- reserva con un UPDATE ... WHERE reminder_sent_at IS NULL y lo vuelve a NULL si el envio falla.
  reminder_sent_at timestamptz,
  CONSTRAINT free_trial_grants_user_unique     UNIQUE (user_id),
  CONSTRAINT free_trial_grants_business_unique UNIQUE (business_id)
);
COMMENT ON TABLE public.free_trial_grants IS
  'Pruebas gratuitas de acceso completo concedidas sin tarjeta (issue #11). Una por usuario y una por empresa.';

-- Solo la escribe el disparador (SECURITY DEFINER). Sin politicas para anon ni authenticated: no hay acceso.
ALTER TABLE public.free_trial_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.free_trial_grants FROM anon, authenticated;

-- 2. Concesion al recibir la primera empresa.
CREATE OR REPLACE FUNCTION public.conceder_prueba_sin_tarjeta()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  c_dias CONSTANT interval := interval '90 days';  -- igual que TRIAL_DAYS del checkout
  v_role public.user_role;
  v_plan text;
  v_hasta timestamptz;
BEGIN
  -- Solo cuando la empresa estrena dueno (alta con dueno o reclamacion que asigna dueno).
  IF NEW.owner_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.owner_id IS NOT DISTINCT FROM NEW.owner_id THEN
    RETURN NEW;
  END IF;

  SELECT p.role, p.plan, p.trial_full_access_until
    INTO v_role, v_plan, v_hasta
  FROM public.profiles p WHERE p.id = NEW.owner_id;

  IF NOT FOUND
     OR v_role = 'admin'::public.user_role
     OR COALESCE(v_plan, 'free') <> 'free'
     OR v_hasta IS NOT NULL
  THEN
    RETURN NEW;
  END IF;

  -- Primera empresa: no tiene ninguna otra.
  IF EXISTS (SELECT 1 FROM public.businesses b WHERE b.owner_id = NEW.owner_id AND b.id <> NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Ya tuvo una suscripcion de Stripe (en prueba o pagada).
  IF EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.user_id = NEW.owner_id) THEN
    RETURN NEW;
  END IF;

  -- Una vez por usuario y por empresa: si ya existe, no se concede de nuevo.
  INSERT INTO public.free_trial_grants (user_id, business_id, ends_at)
  VALUES (NEW.owner_id, NEW.id, now() + c_dias)
  ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Corre como el dueno de la funcion (postgres): guard_profile_sensitive_columns lo permite.
  UPDATE public.profiles
     SET trial_full_access_until = now() + c_dias
   WHERE id = NEW.owner_id;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.conceder_prueba_sin_tarjeta() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_conceder_prueba_sin_tarjeta ON public.businesses;
CREATE TRIGGER trg_conceder_prueba_sin_tarjeta
  AFTER INSERT OR UPDATE OF owner_id ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.conceder_prueba_sin_tarjeta();
