-- contact_messages.notified_at: marca de «ya se avisó al equipo por correo».
--
-- El formulario de contacto guardaba el mensaje y nada más: el equipo solo lo veía abriendo
-- /admin/soporte. La función notify-contact-message envía el correo y marca la fila para no
-- avisar dos veces (una fila = un correo como mucho).
--
-- Solo añade una columna nullable. Idempotente.
-- VUELTA ATRAS: ALTER TABLE public.contact_messages DROP COLUMN IF EXISTS notified_at;

ALTER TABLE public.contact_messages ADD COLUMN IF NOT EXISTS notified_at timestamptz;

COMMENT ON COLUMN public.contact_messages.notified_at IS
  'Cuándo se envió el aviso por correo al equipo (notify-contact-message). NULL = sin avisar.';
