-- RPC para las estadísticas que muestra el widget embebido.
--
-- PROBLEMA QUE RESUELVE
-- widget-proxy calculaba el total y la media trayéndose las filas y midiendo el
-- array en JavaScript:
--
--     supabaseAdmin.from('reviews').select('rating').eq('business_id', id)...
--     const reviewCount = allReviews.length;
--
-- PostgREST corta por defecto en 1.000 filas, así que cualquier empresa por
-- encima de ese umbral mostraba exactamente 1.000. Caso real detectado:
-- ISEIE (b94183fd-…) con 1.520 reseñas aprobadas mostraba 1.000 en su widget.
--
-- La media arrastraba el mismo problema y era más difícil de ver: se promediaba
-- sobre una muestra arbitraria de 1.000 filas sin orden garantizado. Coincidía
-- con la real por redondeo a un decimal, pero no era correcta.
--
-- Además evita transferir 1.000 filas en cada carga de widget solo para
-- promediarlas fuera de la base de datos.
--
-- Los filtros replican EXACTAMENTE los que aplicaba widget-proxy:
--   status = 'approved'  ·  created_at <= now()  (las futuras están programadas
--   y no deben contar hasta su fecha, igual que en la ficha pública)

CREATE OR REPLACE FUNCTION public.widget_business_stats(p_business_id uuid)
RETURNS TABLE (review_count bigint, avg_rating numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        count(*)::bigint AS review_count,
        COALESCE(round(avg(rating)::numeric, 1), 0) AS avg_rating
    FROM public.reviews
    WHERE business_id = p_business_id
      AND status = 'approved'
      AND created_at <= now();
$$;

COMMENT ON FUNCTION public.widget_business_stats(uuid) IS
    'Total y media de reseñas aprobadas y ya publicadas de una empresa. La usa widget-proxy para no depender del límite de filas de PostgREST.';

-- La llama widget-proxy con la service-role key. Se concede también a anon y
-- authenticated porque solo devuelve dos agregados públicos, los mismos que ya
-- aparecen en la ficha de la empresa.
GRANT EXECUTE ON FUNCTION public.widget_business_stats(uuid) TO anon, authenticated, service_role;
