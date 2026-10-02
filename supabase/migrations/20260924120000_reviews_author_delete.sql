-- =============================================================================
-- El autor puede borrar su propia resena. 2026-09-24
--
-- Hallazgo #4 del QA del 23/09: una resena pendiente de moderacion no se podia
-- borrar (no habia boton). La app ya tiene el boton «Eliminar» en el perfil,
-- pero necesita:
--   1. DELETE sobre reviews para el autor. En el esquema documentado
--      (docs/01-DATABASE-SETUP.md) y en la base local NO existia; en produccion
--      se ha visto con el nombre «Users can delete their own reviews.». Esta
--      migracion la deja igual en los dos sitios: si ya existe, se recrea con
--      la misma condicion.
--   2. DELETE en storage sobre review_media, solo en la carpeta del propio
--      usuario (la misma regla que ya tiene el INSERT). Sin esto las fotos y
--      el audio de una resena borrada se quedaban publicos para siempre.
--   3. SELECT de la carpeta propia en review_media: sin ella el DELETE de la
--      API de Storage no ve las filas (ver seccion 3, abajo). Faltaba en prod.
--
-- Lo que cuelga de la resena (review_subject_links, review_votes,
-- review_responses, review_appeals) cae solo por ON DELETE CASCADE.
--
-- Idempotente. Rollback: los tres DROP POLICY (reviews + dos de storage).
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS "Users can delete their own reviews." ON public.reviews;
CREATE POLICY "Users can delete their own reviews."
  ON public.reviews FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own review_media" ON storage.objects;
CREATE POLICY "Users can delete own review_media"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'review_media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3. SELECT de la carpeta propia en review_media (24/09/2026, comprobado en la
--    copia de produccion). La API de Storage borra con
--    `DELETE ... WHERE bucket_id = .. AND name = .. RETURNING *`, y un DELETE con
--    WHERE/RETURNING solo alcanza filas que el rol puede VER. En produccion no
--    hay ninguna politica SELECT sobre review_media (la base local si tiene
--    «Public read review_media»), asi que remove() borraba 0 ficheros sin dar
--    error y la politica de DELETE de arriba no servia de nada.
--    Solo la carpeta propia: listar el bucket entero no hace falta (las fotos se
--    sirven por URL publica, que no pasa por RLS).
DROP POLICY IF EXISTS "Users can read own review_media" ON storage.objects;
CREATE POLICY "Users can read own review_media"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'review_media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

COMMIT;
