-- Estadísticas de reseñas por lote, agregadas en Postgres.
--
-- PROBLEMA QUE RESUELVE
-- Varios puntos del frontend calculaban total, media y distribución trayéndose
-- las filas y midiendo el array en JavaScript. PostgREST corta por defecto en
-- 1.000 filas, así que los agregados salían truncados sin ningún aviso:
--
--   · getReviewRatingDistribution (supabaseService)  -> ficha pública y listados
--   · optimizedQueries.getBusinessesWithStats        -> listados y home
--   · DashboardOverview / analíticas del panel
--   · widget-proxy (ya corregido aparte)
--
-- El caso de optimizedQueries era el más dañino: pedía las reseñas de un LOTE
-- de empresas con .in('business_id', [...]), de modo que el tope de 1.000 se
-- repartía arbitrariamente entre todas y falseaba los conteos de muchas
-- empresas a la vez, no sólo de las que superan las 1.000 reseñas.
--
-- p_include_scheduled distingue los dos comportamientos que ya existían:
--   false (defecto) -> sólo publicadas (created_at <= now). Es lo que aplican
--                      la ficha pública, los listados y el widget.
--   true            -> incluye las programadas. Es lo que ve el dueño en su
--                      panel, donde tiene sentido contar lo que aún no salió.

CREATE OR REPLACE FUNCTION public.review_stats_batch(
    p_business_ids uuid[],
    p_include_scheduled boolean DEFAULT false
)
RETURNS TABLE (
    business_id    uuid,
    total_reviews  bigint,
    average_rating numeric,
    r1 bigint, r2 bigint, r3 bigint, r4 bigint, r5 bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        b.id AS business_id,
        count(r.id)::bigint                                   AS total_reviews,
        COALESCE(round(avg(r.rating)::numeric, 1), 0)         AS average_rating,
        count(r.id) FILTER (WHERE r.rating = 1)::bigint       AS r1,
        count(r.id) FILTER (WHERE r.rating = 2)::bigint       AS r2,
        count(r.id) FILTER (WHERE r.rating = 3)::bigint       AS r3,
        count(r.id) FILTER (WHERE r.rating = 4)::bigint       AS r4,
        count(r.id) FILTER (WHERE r.rating = 5)::bigint       AS r5
    FROM unnest(p_business_ids) AS b(id)
    LEFT JOIN public.reviews r
           ON r.business_id = b.id
          AND r.status = 'approved'
          AND (p_include_scheduled OR r.created_at <= now())
    GROUP BY b.id;
$$;

COMMENT ON FUNCTION public.review_stats_batch(uuid[], boolean) IS
    'Total, media y distribución 1-5 de una o varias empresas, agregados en Postgres. Evita el límite de filas de PostgREST al calcular estadísticas en el cliente.';

GRANT EXECUTE ON FUNCTION public.review_stats_batch(uuid[], boolean) TO anon, authenticated, service_role;
