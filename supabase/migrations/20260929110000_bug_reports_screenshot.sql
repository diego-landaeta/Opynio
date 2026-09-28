-- =============================================================================
-- Reportar error: captura adjunta y columnas iguales en local y produccion.
-- 2026-09-29
--
-- QA del 28/09: «En reportar error deberia aparecer la opcion de montar una
-- foto». Y al revisarlo: en PRODUCCION bug_reports tiene (id, created_at,
-- user_id, page_url, description, status, resolved_at, admin_notes), sin
-- title, url ni browser_info, que son las columnas que escribe el formulario
-- de esta rama; en local no hay page_url. Resultado: en produccion el INSERT
-- fallaba (0 reportes guardados nunca).
--
-- 1. bug_reports: title, page_url, browser_info y screenshot_path se anaden
--    si faltan (en los dos sitios queda el mismo juego de columnas). title
--    admite NULL donde se crea aqui; en local sigue su NOT NULL original y el
--    formulario siempre lo rellena.
-- 2. Bucket PRIVADO bug_screenshots (5 MB, solo imagenes). El usuario sube
--    solo en su carpeta (<uid>/...); leen el propio autor y el admin
--    (opynio_is_admin(), como las migraciones del 23-25/09). El admin la ve
--    con URL firmada.
--
-- Idempotente. Rollback: DROP de las politicas y del bucket; las columnas
-- nuevas pueden quedarse (NULL).
-- =============================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';

-- 1. Columnas
ALTER TABLE public.bug_reports ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.bug_reports ADD COLUMN IF NOT EXISTS page_url text;
ALTER TABLE public.bug_reports ADD COLUMN IF NOT EXISTS browser_info text;
ALTER TABLE public.bug_reports ADD COLUMN IF NOT EXISTS screenshot_path text;

-- 2. Bucket privado de capturas
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('bug_screenshots', 'bug_screenshots', false, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Users upload own bug screenshots" ON storage.objects;
CREATE POLICY "Users upload own bug screenshots"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bug_screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Owner or admin read bug screenshots" ON storage.objects;
CREATE POLICY "Owner or admin read bug screenshots"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'bug_screenshots' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.opynio_is_admin()));

COMMIT;
