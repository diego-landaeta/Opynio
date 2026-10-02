-- Tono del logo: permite que el contenedor elija un fondo con contraste suficiente.
--
-- Problema: los logos se pintan sobre un chip claro en tema claro y oscuro en tema
-- oscuro. Un PNG con transparencia cuyo contenido es blanco desaparece sobre el chip
-- claro; uno cuyo contenido es negro desaparece sobre el oscuro. La imagen es de un
-- dominio ajeno y sin cabeceras CORS, asi que el cliente no puede leer sus pixeles
-- (canvas contaminado): la luminancia se mide offline y se guarda aqui.
--
-- Valores:
--   'light'  contenido claro sobre transparencia -> el chip debe ir oscuro en AMBOS temas
--   'dark'   contenido oscuro sobre transparencia -> el chip debe ir claro en AMBOS temas
--   NULL     sin medir, o medida no concluyente -> comportamiento por defecto de la UI
--
-- Se deja NULL por defecto a proposito: una ficha sin medir se comporta exactamente
-- como antes de esta migracion. El backfill se hace desde scripts, por lotes.

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS logo_tone text;

ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_logo_tone_check;

ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_logo_tone_check
  CHECK (logo_tone IS NULL OR logo_tone IN ('light', 'dark'));

COMMENT ON COLUMN public.businesses.logo_tone IS
  'Luminancia del contenido del logo: light = contenido claro (chip oscuro), dark = contenido oscuro (chip claro), NULL = sin medir o no concluyente. Debe ponerse a NULL cada vez que cambia logo_url.';
