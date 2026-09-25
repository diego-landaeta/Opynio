-- =====================================================
-- review_subjects.code: solo lo ve el dueno de la empresa y el admin
-- =====================================================
-- 20260917120000_review_subjects.sql recorto la columna `code` (referencia
-- interna del negocio: codigo de curso, SKU) solo para `anon`. Cualquier usuario
-- `authenticated` -- basta con registrarse -- podia leer los codigos de TODAS
-- las empresas, porque la politica "Anyone can view active subjects" deja ver
-- las filas activas y el privilegio de tabla incluia la columna.
--
-- La RLS filtra filas, no columnas, asi que se hace con privilegios por
-- columna: `authenticated` pierde SELECT sobre `code` y el panel del dueno lo
-- obtiene con una funcion SECURITY DEFINER que comprueba propiedad o admin.
--
-- Lo que NO cambia:
--   - INSERT/UPDATE de `code` siguen permitidos (privilegio de tabla + RLS del
--     dueno): el dueno escribe el codigo, solo que no puede leerlo por la API
--     directa sino por la funcion.
--   - service_role sigue leyendolo todo.
--   - Consecuencia para el cliente: `select=*` (y `.insert().select()` sin
--     lista de columnas) sobre review_subjects falla con 42501 para anon y
--     authenticated. El frontend pide siempre columnas explicitas.
--
-- OJO: un `GRANT ALL ON public.review_subjects TO authenticated` (o
-- `GRANT SELECT ON ALL TABLES ...`) posterior vuelve a abrir la columna. Si se
-- anade uno, repetir despues el REVOKE/GRANT de esta migracion.
--
-- Comprobacion tras aplicar:
--   SELECT grantee, privilege_type, column_name
--   FROM information_schema.column_privileges
--   WHERE table_schema = 'public' AND table_name = 'review_subjects'
--     AND column_name = 'code' AND privilege_type = 'SELECT';
--   -> solo postgres y service_role.

BEGIN;

-- 1. Sin SELECT de tabla para anon ni authenticated; SELECT por columnas sin `code`
REVOKE SELECT ON public.review_subjects FROM anon, authenticated;
GRANT SELECT (
  id, business_id, type, name, slug, description, image_url, is_active, created_at, updated_at
) ON public.review_subjects TO anon, authenticated;

-- 2. Codigos de los productos de una empresa, solo para su dueno o un admin
-- Devuelve cero filas (no un error) a cualquier otro: el panel pinta el
-- listado sin codigos en vez de romperse.
CREATE OR REPLACE FUNCTION public.business_subject_codes(p_business_id uuid)
RETURNS TABLE (subject_id uuid, code text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT s.id, s.code
  FROM public.review_subjects s
  WHERE s.business_id = p_business_id
    AND s.code IS NOT NULL
    AND (public.opynio_is_admin() OR public.user_owns_business(p_business_id::text))
  ORDER BY s.id;
$$;

COMMENT ON FUNCTION public.business_subject_codes(uuid) IS
  'Codigos internos (review_subjects.code) de los productos de una empresa. Solo devuelve filas al dueno de la empresa o a un admin; la columna no es legible por anon/authenticated.';

REVOKE EXECUTE ON FUNCTION public.business_subject_codes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.business_subject_codes(uuid) TO authenticated, service_role;

COMMIT;
