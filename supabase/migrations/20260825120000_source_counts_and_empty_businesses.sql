-- Segunda ronda del mismo fallo: agregados calculados contando filas en el
-- cliente, truncados en silencio por el límite de 1.000 filas de PostgREST.
--
-- La primera ronda cubrió widget-proxy, el Resumen del panel,
-- getReviewRatingDistribution, optimizedQueries y las analíticas. Al revisar
-- los filtros de la ficha pública aparecieron cuatro puntos más. Dos se
-- resuelven con las funciones de aquí; los otros dos son cambios de cliente.


-- 1) CONTEO POR FUENTE (chips "Todas (n)" / "Opynio (n)" de la ficha pública)
--
-- getReviewSourceCounts se traía source+rating de todas las reseñas y las
-- contaba con un forEach. Caso real: ISEIE mostraba "Todas (1000)" y
-- "Opynio (1000)" bajo un encabezado que ya decía correctamente 1616 reseñas.
--
-- Filtros idénticos a los que aplicaba la función: aprobadas, ya publicadas y
-- con valoración válida de 1 a 5, para que los chips cuadren con la
-- distribución de estrellas que se muestra al lado.

CREATE OR REPLACE FUNCTION public.review_source_counts(p_business_id uuid)
RETURNS TABLE (opynio bigint, google bigint, trustindex bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        count(*) FILTER (WHERE COALESCE(source, 'opynio') = 'opynio')::bigint,
        count(*) FILTER (WHERE source = 'google')::bigint,
        count(*) FILTER (WHERE source = 'trustindex')::bigint
    FROM public.reviews
    WHERE business_id = p_business_id
      AND status = 'approved'
      AND created_at <= now()
      AND rating BETWEEN 1 AND 5;
$$;

COMMENT ON FUNCTION public.review_source_counts(uuid) IS
    'Reseñas publicadas de una empresa desglosadas por fuente. La usan los filtros de la ficha pública para no depender del límite de filas de PostgREST.';

GRANT EXECUTE ON FUNCTION public.review_source_counts(uuid) TO anon, authenticated, service_role;


-- 2) EMPRESAS SIN NINGUNA RESEÑA
--
-- ATENCIÓN: esta función sustituye a un cálculo que era destructivo.
--
-- deleteBusinessesWithoutReviews (panel de administración, botón "eliminar
-- negocios vacíos") hacía esto:
--
--     const { data } = await supabase.from('reviews').select('business_id');
--     const businessIds = [...new Set(data?.map(r => r.business_id))];
--     await supabase.from('businesses').delete().not('id', 'in', `(${businessIds})`);
--
-- Es decir, deducía qué empresas tienen reseñas leyendo la tabla entera. Con
-- 48.654 reseñas, PostgREST devolvía 1.000 filas sin orden garantizado, que
-- pertenecían a sólo 15 empresas distintas. El DELETE se ejecutaba entonces
-- sobre todo lo que no estuviera en esas 15: 1.003 de las 1.018 empresas, y
-- con ellas, por ON DELETE CASCADE en reviews.business_id, sus 48.654 reseñas.
--
-- No es un conteo mal mostrado como los demás casos: es pérdida de datos.
--
-- Aquí el cálculo se hace en Postgres, donde no hay tope de filas, con
-- NOT EXISTS sobre reviews. Se considera "vacía" la empresa sin NINGUNA reseña
-- en ningún estado (ni pendientes, ni rechazadas, ni programadas), que es la
-- lectura conservadora: si hay cualquier rastro, no se toca.

-- Se excluyen ademas las fichas con owner_id. Una ficha reclamada por su
-- dueno no es basura del catalogo aunque no tenga resenas todavia: es el caso
-- normal de un cliente recien dado de alta. Hoy las 37 fichas con dueno tienen
-- resenas y ninguna caeria en la lista, pero la primera alta nueva si lo haria.

CREATE OR REPLACE FUNCTION public.businesses_without_reviews()
RETURNS TABLE (id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT b.id, b.name
    FROM public.businesses b
    WHERE b.owner_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.reviews r WHERE r.business_id = b.id
    )
    ORDER BY b.name;
$$;

COMMENT ON FUNCTION public.businesses_without_reviews() IS
    'Empresas sin ninguna reseña en ningún estado. Se calcula en Postgres porque la versión anterior lo deducía leyendo la tabla de reseñas desde el cliente y el límite de filas la volvía destructiva.';

-- Sólo administración. No se concede a anon.
GRANT EXECUTE ON FUNCTION public.businesses_without_reviews() TO authenticated, service_role;
