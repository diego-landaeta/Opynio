-- Estadísticas del panel de empresa (Resumen).
--
-- PROBLEMA QUE RESUELVE
-- DashboardOverview calculaba total, media y distribución trayéndose las filas
-- y midiendo el array en JavaScript:
--
--     supabase.from('reviews').select('rating').eq('business_id', id).eq('status','approved')
--     const totalReviews = ratingsData.length;
--
-- Es el mismo fallo que ya se corrigió en widget-proxy: PostgREST corta por
-- defecto en 1.000 filas, así que cualquier empresa por encima mostraba
-- exactamente 1.000. Caso real: ISEIE (b94183fd-…), con 1.520 reseñas
-- aprobadas, mostraba "Total de Reseñas: 1000" en su panel.
--
-- Aquí además afectaba al gráfico "Distribución de Valoraciones", que se
-- construía sobre esa misma muestra truncada de 1.000 filas.
--
-- FILTRO: se replica EXACTAMENTE el que aplicaba el panel, es decir sólo
-- status = 'approved'. A diferencia del widget y de la ficha pública, el panel
-- NO filtra por created_at <= now(): el dueño ve también sus reseñas
-- programadas. Ese comportamiento se mantiene tal cual.

CREATE OR REPLACE FUNCTION public.business_review_stats(p_business_id uuid)
RETURNS TABLE (
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
        count(*)::bigint                                   AS total_reviews,
        COALESCE(avg(rating)::numeric, 0)                  AS average_rating,
        count(*) FILTER (WHERE rating = 1)::bigint         AS r1,
        count(*) FILTER (WHERE rating = 2)::bigint         AS r2,
        count(*) FILTER (WHERE rating = 3)::bigint         AS r3,
        count(*) FILTER (WHERE rating = 4)::bigint         AS r4,
        count(*) FILTER (WHERE rating = 5)::bigint         AS r5
    FROM public.reviews
    WHERE business_id = p_business_id
      AND status = 'approved';
$$;

COMMENT ON FUNCTION public.business_review_stats(uuid) IS
    'Total, media y distribución 1-5 de las reseñas aprobadas de una empresa. La usa el Resumen del panel para no depender del límite de filas de PostgREST.';

GRANT EXECUTE ON FUNCTION public.business_review_stats(uuid) TO anon, authenticated, service_role;
