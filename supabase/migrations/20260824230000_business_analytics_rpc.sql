-- Analíticas del panel de empresa.
--
-- PROBLEMA QUE RESUELVE
-- getBusinessAnalytics se traía todas las reseñas del periodo y calculaba en
-- JavaScript el total, la media, la tasa de respuesta, la distribución, el
-- reparto por fuente y la serie temporal. Con el tope de 1.000 filas de
-- PostgREST, cualquier empresa con más reseñas en el rango elegido veía TODAS
-- esas métricas calculadas sobre una muestra truncada, sin ningún aviso.
--
-- Es el mismo fallo ya corregido en widget-proxy, en el Resumen del panel, en
-- getReviewRatingDistribution y en optimizedQueries. Este era el último y el
-- más enredado, porque además de agregados necesita las filas para la serie
-- temporal y para la tasa de respuesta.
--
-- Devuelve un único JSON para no multiplicar viajes. La serie viene agrupada
-- por día o por semana según el rango, igual que hacía el cliente. El relleno
-- de días sin reseñas se queda en el frontend: es decisión de presentación.
--
-- Filtros idénticos a los que ya aplicaba la función: status aprobado, dentro
-- del rango de días y sin contar las programadas (created_at <= now).

CREATE OR REPLACE FUNCTION public.business_analytics(
    p_business_id uuid,
    p_days integer
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH periodo AS (
    SELECT r.id, r.rating, r.created_at, COALESCE(r.source, 'opynio') AS source,
           EXISTS (SELECT 1 FROM public.review_responses rr WHERE rr.review_id = r.id) AS respondida
    FROM public.reviews r
    WHERE r.business_id = p_business_id
      AND r.status = 'approved'
      AND r.created_at >= now() - make_interval(days => p_days)
      AND r.created_at <= now()
),
agg AS (
    SELECT
        count(*)::bigint AS total_reviews,
        COALESCE(avg(rating), 0)::numeric AS average_rating,
        CASE WHEN count(*) > 0
             THEN (count(*) FILTER (WHERE respondida)::numeric * 100 / count(*))
             ELSE 0 END AS response_rate,
        count(*) FILTER (WHERE rating = 1)::bigint AS r1,
        count(*) FILTER (WHERE rating = 2)::bigint AS r2,
        count(*) FILTER (WHERE rating = 3)::bigint AS r3,
        count(*) FILTER (WHERE rating = 4)::bigint AS r4,
        count(*) FILTER (WHERE rating = 5)::bigint AS r5
    FROM periodo
),
por_fuente AS (
    SELECT COALESCE(jsonb_object_agg(source, n), '{}'::jsonb) AS obj
    FROM (SELECT source, count(*)::bigint AS n FROM periodo GROUP BY source) t
),
serie AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('date', d, 'count', n) ORDER BY d), '[]'::jsonb) AS arr
    FROM (
        SELECT to_char(
                   date_trunc(CASE WHEN p_days <= 90 THEN 'day' ELSE 'week' END, created_at),
                   'YYYY-MM-DD'
               ) AS d,
               count(*)::bigint AS n
        FROM periodo
        GROUP BY 1
    ) t
)
SELECT jsonb_build_object(
    'totalReviews',   agg.total_reviews,
    'averageRating',  round(agg.average_rating, 2),
    'responseRate',   round(agg.response_rate, 1),
    'ratingDistribution', jsonb_build_object('1', agg.r1, '2', agg.r2, '3', agg.r3, '4', agg.r4, '5', agg.r5),
    'reviewsBySource', por_fuente.obj,
    'reviewsOverTime', serie.arr
)
FROM agg, por_fuente, serie;
$$;

COMMENT ON FUNCTION public.business_analytics(uuid, integer) IS
    'Analíticas de una empresa en un rango de días: total, media, tasa de respuesta, distribución, reparto por fuente y serie temporal. Agrega en Postgres para no depender del límite de filas de PostgREST.';

GRANT EXECUTE ON FUNCTION public.business_analytics(uuid, integer) TO anon, authenticated, service_role;
