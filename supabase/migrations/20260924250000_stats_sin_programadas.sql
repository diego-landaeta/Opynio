-- =============================================================================
-- Estadísticas sin reseñas programadas + RPC de business_metrics cerradas.
-- 2026-09-24
--
-- 1. Reseñas programadas (created_at en el futuro): el front no las enseña
--    hasta su fecha (.lte('created_at', now)), pero dos RPC ya las contaban:
--      - business_review_stats(uuid)          panel del dueño (DashboardOverview)
--      - get_businesses_with_review_stats()   directorio
--    24/09 en producción: 25 reseñas aprobadas con fecha futura en 22 empresas
--    (del 25/09 al 21/10). Se añade `created_at <= now()` a su recuento y a su
--    media. NADA más cambia: firma, tipo devuelto, SECURITY DEFINER, dueño y
--    permisos (CREATE OR REPLACE los conserva) y el resto del cuerpo, copiado
--    de pg_get_functiondef en producción. get_businesses_with_review_stats no
--    tenía search_path: se le fija `public` (business_review_stats ya lo tenía).
--    Revisadas y ya correctas (prod, prodlike y local): review_stats_batch
--    (filtra salvo p_include_scheduled = true, y todos sus llamadores, bundle
--    de prod y rama, pasan false), review_source_counts y su `total`
--    (created_at <= now()), widget_business_stats, business_analytics y las RPC
--    de productos/widget de la rama. get_business_analytics también cuenta el
--    futuro, pero nadie la llama.
--
-- 2. La vista materializada business_metrics (media y número de reseñas por
--    empresa) no se refresca nunca: el 24/09 tenía 984 filas para 1.019
--    empresas y cifras distintas de las reales (o ninguna fila) en 617. Tres
--    RPC la leen y son ejecutables por
--    anon/authenticated:
--      - get_featured_companies_with_details()               SECURITY DEFINER
--      - get_public_businesses_with_details(integer,integer)  SECURITY DEFINER
--      - get_public_businesses(integer, integer, text, text, double precision,
--          double precision, double precision, double precision, integer)
--          (SECURITY INVOKER; la otra sobrecarga, con real, no lee la vista)
--    Nadie las llama: 0 apariciones en el bundle de producción (35 chunks), en
--    el repo (front y supabase/functions) y en las 20 Edge Functions
--    desplegadas. Se les quita EXECUTE a PUBLIC, anon y authenticated
--    (service_role y postgres lo conservan). No se borran.
--    Aparte (no se toca aquí): anon y authenticated siguen pudiendo leer la
--    vista business_metrics directamente (SELECT de tabla); tampoco la lee
--    ningún front.
--
-- Requiere 20260915144500_directory_rpc_logo_tone (get_businesses_with_review_stats
-- con logo_tone, como en producción): si falta, aborta sin tocar nada.
-- Idempotente.
--
-- Rollback:
--   - Las dos funciones: el mismo CREATE OR REPLACE sin «AND created_at <= now()»
--     / «AND r.created_at <= now()» (y, en la segunda, sin SET search_path:
--     ALTER FUNCTION public.get_businesses_with_review_stats() RESET search_path;).
--   - Permisos (ACL de producción el 24/09):
--     GRANT EXECUTE ON FUNCTION public.get_featured_companies_with_details() TO PUBLIC, anon, authenticated;
--     GRANT EXECUTE ON FUNCTION public.get_public_businesses_with_details(integer, integer) TO PUBLIC, anon, authenticated;
--     GRANT EXECUTE ON FUNCTION public.get_public_businesses(integer, integer, text, text, double precision, double precision, double precision, double precision, integer) TO PUBLIC, anon, authenticated;
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.get_businesses_with_review_stats()') IS NULL
     OR pg_get_function_result('public.get_businesses_with_review_stats()'::regprocedure) NOT LIKE '%logo_tone text%' THEN
    RAISE EXCEPTION 'stats_sin_programadas: get_businesses_with_review_stats() no devuelve logo_tone. Aplica antes 20260915144500_directory_rpc_logo_tone.sql.';
  END IF;
END $$;

-- 1a. Panel del dueño --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.business_review_stats(p_business_id uuid)
 RETURNS TABLE(total_reviews bigint, average_rating numeric, r1 bigint, r2 bigint, r3 bigint, r4 bigint, r5 bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT
        count(*)::bigint                                   AS total_reviews,
        COALESCE(avg(rating)::numeric, 0)                  AS average_rating,
        count(*) FILTER (WHERE rating = 1)::bigint         AS r1,
        count(*) FILTER (WHERE rating = 2)::bigint         AS r2,
        count(*) FILTER (WHERE rating = 3)::bigint         AS r3,
        count(*) FILTER (WHERE rating = 4)::bigint         AS r4,
        count(*) FILTER (WHERE rating = 5)::bigint         AS r5
    FROM public.reviews
    WHERE business_id = p_business_id
      AND status = 'approved'
      AND created_at <= now();
$function$;

-- 1b. Directorio ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_businesses_with_review_stats()
 RETURNS TABLE(id uuid, name text, description text, category text, country text, logo_url text, avg_rating numeric, review_count bigint, logo_tone text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        b.id,
        b.name,
        b.description,
        b.category,
        b.country::TEXT,
        b.logo_url,
        COALESCE(AVG(r.rating), 0)::NUMERIC AS avg_rating,
        COUNT(r.id) FILTER (WHERE r.status = 'approved')::BIGINT AS review_count,
        b.logo_tone
    FROM
        businesses b
    LEFT JOIN
        reviews r ON b.id = r.business_id AND r.status = 'approved' AND r.created_at <= now()
    GROUP BY
        b.id, b.name, b.description, b.category, b.country, b.logo_url, b.logo_tone
    ORDER BY
        review_count DESC,
        avg_rating DESC,
        b.name ASC;
END;
$function$;

-- 2. RPC que leen business_metrics: fuera anon/authenticated -------------------
DO $$
DECLARE
  f text;
  p regprocedure;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.get_featured_companies_with_details()',
    'public.get_public_businesses_with_details(integer,integer)',
    'public.get_public_businesses(integer,integer,text,text,double precision,double precision,double precision,double precision,integer)'
  ] LOOP
    p := to_regprocedure(f);
    IF p IS NULL THEN
      RAISE NOTICE 'stats_sin_programadas: % no existe en esta base; nada que hacer.', f;
      CONTINUE;
    END IF;
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', p);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', p);
    IF has_function_privilege('anon', p, 'EXECUTE') OR has_function_privilege('authenticated', p, 'EXECUTE') THEN
      RAISE EXCEPTION 'stats_sin_programadas: % sigue siendo ejecutable por anon/authenticated.', f;
    END IF;
  END LOOP;
END $$;

COMMIT;

-- Verificación:
--   SELECT position('created_at <= now()' in prosrc) > 0 AS sin_programadas, proconfig
--   FROM pg_proc WHERE proname IN ('business_review_stats', 'get_businesses_with_review_stats');   -- true, {search_path=public}
--   SELECT p.oid::regprocedure, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon      -- false
--   FROM pg_proc p WHERE p.proname IN ('get_featured_companies_with_details','get_public_businesses_with_details','get_public_businesses');
--   -- (la sobrecarga de get_public_businesses con real, que no lee business_metrics, sigue en true)
