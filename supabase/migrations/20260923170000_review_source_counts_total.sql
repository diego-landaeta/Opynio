-- =============================================================================
-- Chips de fuente de la ficha publica que no cuadraban con el total. 2026-09-23
--
-- La ficha decia "82 resenas" y justo debajo "Todas (72)": el chip "Todas"
-- sumaba solo opynio + google + trustindex, y quedaban fuera:
--   - source='manual': las resenas escritas en la web se guardaban con el valor
--     por defecto de la columna ('manual') porque el formulario no fijaba
--     source. Son resenas de Opynio. (Desde la migracion 20260923120000 las
--     nuevas entran como 'opynio'; las antiguas siguen siendo 'manual'.)
--   - source='imported' / 'scraped': ni Opynio ni Google.
--
-- Ahora: `opynio` incluye 'manual', y hay una columna `total` con TODAS las
-- publicadas, que es la que usa el chip "Todas". El tipo de retorno cambia, asi
-- que hay que DROP + CREATE (CREATE OR REPLACE no puede anadir columnas).
-- =============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.review_source_counts(uuid);

CREATE FUNCTION public.review_source_counts(p_business_id uuid)
RETURNS TABLE (opynio bigint, google bigint, trustindex bigint, total bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        count(*) FILTER (WHERE COALESCE(source, 'opynio') IN ('opynio', 'manual'))::bigint,
        count(*) FILTER (WHERE source = 'google')::bigint,
        count(*) FILTER (WHERE source = 'trustindex')::bigint,
        count(*)::bigint
    FROM public.reviews
    WHERE business_id = p_business_id
      AND status = 'approved'
      AND created_at <= now()
      AND rating BETWEEN 1 AND 5;
$$;

COMMENT ON FUNCTION public.review_source_counts(uuid) IS
    'Reseñas publicadas de una empresa por fuente (opynio incluye las antiguas source=manual) y el total de todas las fuentes, para los chips de la ficha pública.';

GRANT EXECUTE ON FUNCTION public.review_source_counts(uuid) TO anon, authenticated, service_role;

COMMIT;
