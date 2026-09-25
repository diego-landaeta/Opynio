-- =============================================================================
-- Slug de producto: solo [a-z0-9_-]. 2026-09-24
--
-- review_subjects.slug lo escribe el dueño de la empresa (panel de productos,
-- o directamente por la API con su sesión) y acaba tal cual en la URL pública
-- y en el <loc> de generate-sitemap. Un valor con `&`, `<`, `"`, espacios o
-- mayúsculas rompía el sitemap entero (ya se escapa en la función) y daba URLs
-- raras. Esta migración impide valores nuevos fuera del patrón:
--
--   CHECK (slug ~ '^[a-z0-9_-]+$')     -- NULL sigue permitido
--
-- Se crea NOT VALID (no revisa las filas existentes al crearla, así que no
-- falla por datos viejos) y a continuación se valida SOLO si no hay ninguna
-- fila fuera de patrón. Si las hay, se queda NOT VALID y lo avisa con un
-- NOTICE: esas filas siguen ahí y sus URLs no cambian (regla: no modificar
-- URLs), pero ojo, cualquier UPDATE de una de ellas fallará hasta que se
-- corrija su slug a mano (un CHECK se comprueba en cada INSERT/UPDATE, aunque
-- sea NOT VALID). Cuando estén corregidas:
--   ALTER TABLE public.review_subjects VALIDATE CONSTRAINT review_subjects_slug_check;
--
-- Comprobación previa (SQL Editor, solo lectura):
--   SELECT id, business_id, slug FROM public.review_subjects
--   WHERE slug !~ '^[a-z0-9_-]+$' ORDER BY business_id, slug;
-- 24/09/2026: en producción la tabla aún no existe (la crea 20260917120000);
-- los 4.143 slugs de scripts/_catalogo/carga.sql cumplen el patrón (0 fuera),
-- y los 4.156 de la base local también. Así que en prod queda VALIDADA y la
-- carga del catálogo (después) pasa.
--
-- Ojo con el panel: slugify() de utils/slugify.ts (lo usa createBusinessProduct
-- en services/supabaseService.ts) quita tildes y los signos más comunes, pero
-- deja pasar rayas –/—, guion no separable ‑, espacio de ancho cero, ª/º, ß,
-- comillas tipográficas, emoji, CJK... Con esta migración, crear un producto
-- con uno de esos nombres falla con 23514 (check_violation) en vez de guardar
-- un slug raro. En el catálogo real serían 9 de 4.143 nombres. El arreglo es
-- del front (limpiar todo lo que no sea [a-z0-9_-] tras slugify), no de aquí.
--
-- Requiere 20260917120000_review_subjects. Idempotente.
-- Rollback:
--   ALTER TABLE public.review_subjects DROP CONSTRAINT IF EXISTS review_subjects_slug_check;
-- =============================================================================

BEGIN;

DO $$
DECLARE
  fuera int;
BEGIN
  IF to_regclass('public.review_subjects') IS NULL THEN
    RAISE EXCEPTION 'review_subjects_slug_check: no existe public.review_subjects. Aplica antes 20260917120000_review_subjects.sql.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.review_subjects'::regclass
      AND conname = 'review_subjects_slug_check'
  ) THEN
    ALTER TABLE public.review_subjects
      ADD CONSTRAINT review_subjects_slug_check CHECK (slug ~ '^[a-z0-9_-]+$') NOT VALID;
  END IF;

  SELECT count(*) INTO fuera FROM public.review_subjects WHERE slug !~ '^[a-z0-9_-]+$';

  IF fuera = 0 THEN
    ALTER TABLE public.review_subjects VALIDATE CONSTRAINT review_subjects_slug_check;
  ELSE
    RAISE NOTICE 'review_subjects_slug_check: % fila(s) con slug fuera de patrón; la restricción queda NOT VALID (sus URLs no se tocan). Lista: SELECT id, business_id, slug FROM public.review_subjects WHERE slug !~ ''^[a-z0-9_-]+$'';', fuera;
  END IF;
END $$;

COMMENT ON CONSTRAINT review_subjects_slug_check ON public.review_subjects IS
  'Slug de producto en la URL pública y en el sitemap: solo a-z, 0-9, _ y -. Ver 20260924210000.';

COMMIT;

-- Verificación:
--   SELECT convalidated, pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conname = 'review_subjects_slug_check';
--   -- true | CHECK ((slug ~ '^[a-z0-9_-]+$'::text))   (false + NOT VALID si había filas fuera)
