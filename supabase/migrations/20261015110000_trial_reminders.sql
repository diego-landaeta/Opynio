-- =============================================================================
-- Registro de avisos «tu prueba gratuita acaba pronto». 2026-10-15
--
-- Issue #2 (prueba de 3 meses): hay que avisar por correo 7 dias antes de que
-- acabe la prueba, con enlace para cambiar de plan o cancelar. Stripe solo manda
-- el evento customer.subscription.trial_will_end 3 dias antes, asi que lo hace
-- una funcion propia (supabase/functions/trial-ending-reminder) con un cron
-- diario. Esta tabla evita mandar el aviso dos veces a la misma suscripcion.
--
-- No se anade ninguna columna a subscriptions: la fecha de fin de prueba ya esta
-- en subscriptions.current_period_end mientras status = 'trialing' (Stripe pone
-- current_period_end = trial_end durante la prueba y el webhook ya lo guarda).
--
-- - subscription_id: id de la suscripcion de Stripe (sub_...). Clave primaria =
--   un unico aviso por suscripcion. Sin FK a proposito: el esquema base de
--   Opynio se creo a mano y es un simple registro.
-- - trial_end: fin de prueba que se aviso (para auditar).
-- - sent_at: cuando se reservo/envio el aviso.
-- - RLS activada SIN politicas: ni anon ni authenticated leen ni escriben; la
--   funcion usa service_role, que se salta RLS.
--
-- NO aplicada todavia (ver docs/PRECIOS-NUEVOS.md, paso de migracion).
-- Idempotente.
-- =============================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.trial_reminders (
  subscription_id text PRIMARY KEY,
  user_id uuid NOT NULL,
  trial_end timestamptz NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trial_reminders_user_idx ON public.trial_reminders (user_id);

ALTER TABLE public.trial_reminders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trial_reminders FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.trial_reminders TO service_role;

COMMIT;

-- =============================================================================
-- ROLLBACK MANUAL (referencia, NO se ejecuta):
--   DROP TABLE IF EXISTS public.trial_reminders;
-- =============================================================================
