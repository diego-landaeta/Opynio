-- =============================================================================
-- Limites de tipo y tamano en los buckets publicos. 2026-09-23
--
-- Ninguno de los dos buckets tenia limite. Reproducido en local:
--   - review_media aceptaba un SVG con <script>; se sirve como image/svg+xml y
--     el script se ejecuta al abrir la foto de la resena en una pestana.
--   - business_logos acepto un .html subido por un usuario cualquiera.
-- El formulario de resenas ya filtra, pero el filtro de cliente se salta
-- arrastrando el fichero o llamando a la API de Storage directamente.
--
-- Solo cambia la configuracion de los buckets; no borra ni mueve ficheros ya
-- subidos. Si el bucket no existe en este entorno, el UPDATE no hace nada.
-- =============================================================================

BEGIN;

-- Fotos (formulario: JPG/PNG/WebP, 8 MB) y audio de resenas. MediaRecorder
-- graba audio/webm en Chrome y audio/mp4 en Safari; el selector de fichero
-- admite ademas mp3, m4a, ogg y wav.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
      'image/jpeg', 'image/png', 'image/webp',
      'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/x-m4a',
      'audio/ogg', 'audio/wav', 'audio/x-wav'
    ],
    file_size_limit = 15 * 1024 * 1024
WHERE id = 'review_media';

-- Logos de empresa e imagenes de producto.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    file_size_limit = 5 * 1024 * 1024
WHERE id = 'business_logos';

COMMIT;
