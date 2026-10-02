-- =============================================================================
-- Politicas permisivas de produccion que anulaban los arreglos. 2026-09-24
-- (bloqueo B4 del runbook docs/DESPLIEGUE-2026-09.md)
--
-- Las politicas PERMISSIVE de un mismo comando se suman con OR: si queda una
-- vieja mas amplia, la restriccion nueva no sirve de nada. Produccion tiene
-- politicas creadas a mano, con OTROS nombres, que las migraciones
-- 20260923120000, 20260923160000 y 20260923180000 no borraban:
--
--   review_votes    "Authenticated users can insert votes" (INSERT, solo
--                   auth.uid() = user_id): el autor podia votarse a si mismo.
--                   "Users can update own votes" (UPDATE): con ella se podia
--                   mover un voto propio a la resena propia.
--   review_appeals  "Los usuarios pueden crear y ver sus apelaciones" (ALL):
--                   apelar resenas ajenas o no rechazadas, y cambiar el estado
--                   de la propia apelacion a 'approved'.
--   storage.objects "Business owners can upload logos" (cualquier dueno, a
--                   cualquier ruta de business_logos, incluida la carpeta de
--                   productos de otra empresa).
--                   "Authenticated users can upload avatars" (cualquier
--                   autenticado, a cualquier ruta de avatars).
--                   "Business owners can update their own logo" y "Users can
--                   update their own avatar" (UPDATE por `owner`, con el
--                   WITH CHECK solo sobre el bucket): permitian subir a la
--                   carpeta propia y luego MOVER el fichero a cualquier ruta
--                   del bucket (incluso desde otro bucket), saltandose las
--                   politicas de INSERT por carpeta.
--
-- Lo que sigue funcionando (y se comprueba al principio que exista):
--   - votar resenas ajenas: "Authenticated users can insert their own votes"
--     (20260923160000); cambiar el sentido del voto propio: UPDATE de abajo.
--   - apelar una resena PROPIA y RECHAZADA: "Users can create appeals"
--     (20260923120000); ver las apelaciones propias: SELECT de abajo. El
--     usuario no puede cambiar el estado (no tiene UPDATE); el admin si
--     (politica de admin, que no se toca).
--   - avatar: subir/actualizar/borrar solo en avatars/<uid>/ (20260923180000).
--   - imagenes de producto: el dueno sube a business_logos/productos/<id de
--     una empresa suya>/ ("Authenticated users can upload logos",
--     20260923160000); el UPDATE de abajo le deja reemplazarlas ahi mismo.
--   La app (services/supabaseService.ts) solo usa upload(..., upsert: false) en
--   esas tres rutas: no necesita UPDATE en storage, pero se deja acotado.
--
-- En la base local estas politicas no existen: los DROP ... IF EXISTS no hacen
-- nada. Idempotente.
--
-- Vuelta atras: recrear las politicas borradas con la definicion guardada en el
-- paso 2.0.2 del runbook (reabre los agujeros; mejor arreglar hacia delante).
-- =============================================================================

BEGIN;

-- 0. Precondicion: las politicas que sustituyen a las que se borran ya estan.
--    Sin esto, aplicar este fichero antes de tiempo dejaria sin poder votar,
--    apelar ni subir el avatar.
DO $do$
DECLARE
  v_falta text;
BEGIN
  SELECT string_agg(x.tabla || ' «' || x.politica || '»', ', ') INTO v_falta
  FROM (VALUES
    ('public.review_votes',   'Authenticated users can insert their own votes', 'r.user_id = auth.uid()'),
    ('public.review_appeals', 'Users can create appeals',                       'rejected'),
    ('storage.objects',       'Users upload own avatar',                        'foldername'),
    ('storage.objects',       'Authenticated users can upload logos',           'user_owns_business')
  ) AS x(tabla, politica, contiene)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname || '.' || p.tablename = x.tabla
      AND p.policyname = x.politica
      AND coalesce(p.with_check, '') LIKE '%' || x.contiene || '%'
  );
  IF v_falta IS NOT NULL THEN
    RAISE EXCEPTION 'Faltan (o son las antiguas) las politicas que sustituyen a las que se borran: %. Aplica antes 20260923120000, 20260923160000 y 20260923180000.', v_falta;
  END IF;
END
$do$;

-- 1. review_votes -------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can insert votes" ON public.review_votes;

-- UPDATE: mismo criterio que el INSERT. Nombre de prod y nombre local, para
-- dejar una sola politica en los dos sitios.
DROP POLICY IF EXISTS "Users can update own votes" ON public.review_votes;
DROP POLICY IF EXISTS "Users can update their own votes" ON public.review_votes;
CREATE POLICY "Users can update their own votes"
  ON public.review_votes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (SELECT 1 FROM public.reviews r WHERE r.id = review_id AND r.user_id = auth.uid())
  );

-- 2. review_appeals -----------------------------------------------------------
DROP POLICY IF EXISTS "Los usuarios pueden crear y ver sus apelaciones" ON public.review_appeals;
DROP POLICY IF EXISTS "Users can view own appeals" ON public.review_appeals;
CREATE POLICY "Users can view own appeals"
  ON public.review_appeals FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 3. storage.objects ----------------------------------------------------------
DROP POLICY IF EXISTS "Business owners can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Business owners can update their own logo" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;

-- Reemplazar una imagen de producto: la misma regla que el INSERT.
DROP POLICY IF EXISTS "Owners can update own business images" ON storage.objects;
CREATE POLICY "Owners can update own business images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'business_logos'
    AND (
      public.opynio_is_admin()
      OR ((storage.foldername(name))[1] = 'productos'
          AND public.user_owns_business((storage.foldername(name))[2]))
    )
  )
  WITH CHECK (
    bucket_id = 'business_logos'
    AND (
      public.opynio_is_admin()
      OR ((storage.foldername(name))[1] = 'productos'
          AND public.user_owns_business((storage.foldername(name))[2]))
    )
  );

COMMIT;

-- Comprobacion tras aplicar (esperado):
--   SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE (tablename IN ('review_votes','review_appeals'))
--      OR (schemaname = 'storage' AND tablename = 'objects' AND cmd IN ('INSERT','UPDATE'))
--   ORDER BY 1, 3, 2;
--   review_votes   INSERT: solo «Authenticated users can insert their own votes»
--   review_votes   UPDATE: solo «Users can update their own votes»
--   review_appeals ALL (admin), INSERT «Users can create appeals», SELECT «Users can view own appeals»
--   objects INSERT: review_media / avatars por carpeta, «Authenticated users can upload logos», bucket reviews (legado, por carpeta)
--   objects UPDATE: review_media / avatars por carpeta, «Owners can update own business images»
