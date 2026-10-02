-- =============================================================================
-- Cuota diaria de invitaciones por email. 2026-09-24
--
-- send-invitation-email manda correos en nombre de Opynio (via Make) a la lista
-- que escribe el dueno. Tenia tope por envio (50) pero no por dia, y el plan
-- solo se comprobaba en el front (FeatureLock en DashboardInvitations): un
-- dueno free, o uno de pago con un bucle, podia mandar miles de correos al dia.
--
-- La funcion ahora exige plan >= starter en servidor y reserva la cuota con
-- reserve_invitation_quota() ANTES de enviar. No habia ningun dato del que
-- contar los envios, de ahi la tabla.
--
-- - invitation_sends: una fila por envio (usuario, empresa, n.º destinatarios).
--   RLS activada y SIN politicas: solo la edge function (service_role) la toca;
--   el dueno no puede borrar filas para resetear su cuota.
-- - reserve_invitation_quota(): suma lo enviado en las ultimas 24 h y, si cabe,
--   inserta la reserva. Bloqueo consultivo por usuario para que dos envios en
--   paralelo no lean el mismo total y pasen los dos. Solo service_role.
--
-- Vuelta atras:
--   DROP FUNCTION IF EXISTS public.reserve_invitation_quota(uuid, uuid, integer, integer);
--   DROP TABLE IF EXISTS public.invitation_sends;
--   (y desplegar la version anterior de send-invitation-email, que no la usa)
-- =============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.invitation_sends (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  recipients  integer NOT NULL CHECK (recipients > 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invitation_sends_user_created
  ON public.invitation_sends (user_id, created_at DESC);

ALTER TABLE public.invitation_sends ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.invitation_sends FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.reserve_invitation_quota(
  p_user_id     uuid,
  p_business_id uuid,
  p_recipients  integer,
  p_daily_limit integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_used       integer;
  v_next_free  timestamptz;
BEGIN
  IF p_user_id IS NULL OR p_recipients IS NULL OR p_recipients <= 0
     OR p_daily_limit IS NULL OR p_daily_limit <= 0 THEN
    RAISE EXCEPTION 'reserve_invitation_quota: parametros no validos';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('invitation_quota:' || p_user_id::text, 0));

  SELECT COALESCE(SUM(recipients), 0)::integer, MIN(created_at) + interval '24 hours'
    INTO v_used, v_next_free
  FROM public.invitation_sends
  WHERE user_id = p_user_id
    AND created_at > now() - interval '24 hours';

  IF v_used + p_recipients > p_daily_limit THEN
    RETURN jsonb_build_object(
      'allowed',    false,
      'used',       v_used,
      'limit',      p_daily_limit,
      'remaining',  GREATEST(p_daily_limit - v_used, 0),
      'next_free',  v_next_free
    );
  END IF;

  INSERT INTO public.invitation_sends (user_id, business_id, recipients)
  VALUES (p_user_id, p_business_id, p_recipients);

  -- Fuera de la ventana ya no cuentan; se guardan 30 dias por si hay que
  -- revisar un abuso y luego se limpian.
  DELETE FROM public.invitation_sends
  WHERE user_id = p_user_id
    AND created_at < now() - interval '30 days';

  RETURN jsonb_build_object(
    'allowed',   true,
    'used',      v_used + p_recipients,
    'limit',     p_daily_limit,
    'remaining', p_daily_limit - v_used - p_recipients
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_invitation_quota(uuid, uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_invitation_quota(uuid, uuid, integer, integer) TO service_role;

COMMIT;
