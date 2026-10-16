-- =============================================================================
-- Historial de invitaciones a reseñar. 2026-10-15  (issue #5)
--
-- Hasta ahora las invitaciones no se guardaban en ninguna tabla: el panel decia
-- "enviada" y no habia historial ("Proximamente"). send-invitation-email manda
-- ahora cada correo por Brevo y guarda una fila por destinatario aqui.
--
-- - review_invitations: empresa, correo, producto, mensaje, estado
--   (sent | failed | opened | reviewed) y error si lo hay.
--   RLS: el dueno de la empresa solo LEE sus filas. Nadie escribe desde el
--   navegador: inserta la edge function con service_role y el estado solo cambia
--   por las dos funciones de abajo.
-- - mark_invitation_opened(id): la pagina de escribir reseña la llama al abrir el
--   enlace (anonimo). El id es un uuid aleatorio que solo recibe el destinatario.
-- - mark_invitation_reviewed(id): la llama el formulario tras publicar. Exige
--   sesion y que ESE usuario tenga una reseña de la empresa de la invitacion.
--
-- No depende del tipo de reviews.id (bigint en produccion, uuid en local): no
-- guarda el id de la reseña, solo comprueba que existe.
--
-- Vuelta atras (no toca datos reales):
--   DROP FUNCTION IF EXISTS public.mark_invitation_reviewed(uuid);
--   DROP FUNCTION IF EXISTS public.mark_invitation_opened(uuid);
--   DROP TABLE IF EXISTS public.review_invitations;
--   (y desplegar la version anterior de send-invitation-email)
-- =============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.review_invitations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  sent_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email        text NOT NULL CHECK (length(email) BETWEEN 3 AND 320),
  product_id   uuid REFERENCES public.review_subjects(id) ON DELETE SET NULL,
  message      text CHECK (message IS NULL OR length(message) <= 1000),
  status       text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'opened', 'reviewed')),
  error        text CHECK (error IS NULL OR length(error) <= 500),
  created_at   timestamptz NOT NULL DEFAULT now(),
  opened_at    timestamptz,
  reviewed_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_review_invitations_business_created
  ON public.review_invitations (business_id, created_at DESC);

ALTER TABLE public.review_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.review_invitations FROM anon, authenticated;
GRANT SELECT ON TABLE public.review_invitations TO authenticated;

DROP POLICY IF EXISTS "Owner reads own invitations" ON public.review_invitations;
CREATE POLICY "Owner reads own invitations"
  ON public.review_invitations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = review_invitations.business_id AND b.owner_id = auth.uid()
  ));

-- El destinatario abrio el enlace (sin sesion). Solo sent -> opened.
CREATE OR REPLACE FUNCTION public.mark_invitation_opened(p_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.review_invitations
     SET status = 'opened', opened_at = COALESCE(opened_at, now())
   WHERE id = p_id AND status = 'sent';
$$;

-- El destinatario publico su reseña. Devuelve false si la invitacion no existe
-- o si ese usuario no tiene ninguna reseña de la empresa.
CREATE OR REPLACE FUNCTION public.mark_invitation_reviewed(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_business uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT business_id INTO v_business FROM public.review_invitations WHERE id = p_id;
  IF v_business IS NULL THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.reviews r
    WHERE r.user_id = auth.uid() AND r.business_id = v_business
      AND r.created_at >= (SELECT i.created_at FROM public.review_invitations i WHERE i.id = p_id)
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.review_invitations
     SET status = 'reviewed',
         opened_at = COALESCE(opened_at, now()),
         reviewed_at = COALESCE(reviewed_at, now())
   WHERE id = p_id AND status IN ('sent', 'opened', 'reviewed');
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_invitation_opened(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_invitation_reviewed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_invitation_opened(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_invitation_reviewed(uuid) TO authenticated;

COMMIT;
