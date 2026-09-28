-- =============================================================================
-- Avisos por correo: el usuario elige si los recibe. 2026-09-29
--
-- send-notification-email (runbook, funciones) manda dos correos: la respuesta
-- de soporte a quien abrio la solicitud y «nueva reseña publicada» al dueno de
-- la empresa. El panel de ajustes deja ahora desactivar cada uno.
--
-- Qué hace: dos columnas en public.profiles, NOT NULL DEFAULT true (todas las
-- cuentas de hoy siguen recibiendo los correos, como hasta ahora):
--   notify_email_support  respuesta del equipo a una solicitud de soporte.
--   notify_email_reviews  reseña publicada en una empresa de la que es dueno.
-- La funcion lee la columna del destinatario con la service role y, si es
-- false, no envia ({ skipped: true, reason: 'opt-out' }). Si la columna no
-- existe (funcion desplegada antes que esta migracion), envia como antes.
--
-- RLS y guardas: las mismas que las preferencias de 3.28
-- (20260925100000_profile_preferences.sql): UPDATE solo de la propia fila;
-- guard_profile_sensitive_columns / guard_profile_extra_columns son listas de
-- columnas PROHIBIDAS y estas no estan, a proposito: son del usuario. Los
-- perfiles se leen en publico, asi que estos dos booleanos tambien (como theme).
--
-- Bloqueo: ADD COLUMN con DEFAULT constante es solo catalogo desde Postgres 11
-- (no reescribe la tabla). lock_timeout de 5 s. Idempotente.
--
-- Rollback (vuelven a recibirse todos los correos):
--   ALTER TABLE public.profiles
--     DROP COLUMN IF EXISTS notify_email_support,
--     DROP COLUMN IF EXISTS notify_email_reviews;
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_email_support boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_email_reviews boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.notify_email_support IS
  'Recibir por correo las respuestas de soporte. Lo lee send-notification-email.';
COMMENT ON COLUMN public.profiles.notify_email_reviews IS
  'Recibir por correo las resenas publicadas en sus empresas. Lo lee send-notification-email.';

DO $$
BEGIN
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles'
        AND column_name IN ('notify_email_support', 'notify_email_reviews')) <> 2 THEN
    RAISE EXCEPTION 'profile_email_notifications: faltan columnas';
  END IF;
END $$;

COMMIT;
