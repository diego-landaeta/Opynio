-- =============================================================================
-- Resena propia: sin editar ni borrar; solo solicitar su eliminacion. 2026-09-29
--
-- Decision del usuario tras el QA del 28/09: el autor NO edita ni borra su
-- resena directamente (se podia borrar «sin asco» y volver a escribirla, y asi
-- dejar varias en la misma empresa). Solo puede «Solicitar eliminacion» con un
-- motivo: se abre una solicitud de soporte de tipo 'review_deletion' que revisa
-- el admin (y la retira desde moderacion si procede).
--
-- 1. Fuera los permisos del autor sobre public.reviews:
--    - DELETE «Users can delete their own reviews.» (20260924120000 y la que
--      ya existia en produccion con ese mismo nombre).
--    - UPDATE «Authors can edit own pending or approved reviews»
--      (20260924160000) y los nombres antiguos que esa migracion ya quitaba.
--    Crear una resena no necesita ninguno: las fotos se suben antes del
--    INSERT. Los cambios del admin van por sus propias politicas.
-- 2. DELETE en storage de review_media del propio usuario: sin borrar la
--    resena, borrar sus fotos la dejaria con imagenes rotas.
-- 3. support_tickets.type admite 'review_deletion'.
--
-- Idempotente. Rollback: volver a crear las politicas de 20260924120000 y
-- 20260924160000 y restaurar el CHECK anterior (sin 'review_deletion').
-- =============================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';

-- 1. Resenas: el autor no las edita ni las borra.
DROP POLICY IF EXISTS "Users can delete their own reviews." ON public.reviews;
DROP POLICY IF EXISTS "Users can delete their own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Authors can edit own pending or approved reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can update own pending reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can update their own reviews." ON public.reviews;
DROP POLICY IF EXISTS "Users can update their own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can update own reviews" ON public.reviews;

-- 2. Fotos y audio de la resena: el autor tampoco los borra.
DROP POLICY IF EXISTS "Users can delete own review_media" ON storage.objects;

-- 3. Nuevo tipo de solicitud de soporte.
ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_type_check;
ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_type_check
  CHECK (type = ANY (ARRAY['question', 'account', 'billing', 'business', 'account_deletion', 'review_deletion', 'other']));

-- Comprobacion: no queda ninguna politica de UPDATE/DELETE para usuarios
-- normales sobre reviews que dependa de auth.uid() = user_id.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'reviews'
     AND cmd IN ('UPDATE', 'DELETE')
     AND coalesce(qual, '') ~ 'auth\.uid\(\)\s*=\s*user_id';
  IF n > 0 THEN
    RAISE EXCEPTION 'Quedan % politicas de edicion/borrado del autor en reviews', n;
  END IF;
END $$;

COMMIT;
