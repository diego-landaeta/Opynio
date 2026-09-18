-- Anade logo_tone al RPC del directorio.
--
-- get_businesses_with_review_stats devuelve un TABLE(...) fijo, asi que incluir una
-- columna nueva obliga a recrear la funcion (CREATE OR REPLACE no permite cambiar el
-- tipo de retorno). Se hace dentro de una transaccion para que el directorio no vea
-- una ventana sin funcion.
--
-- logo_tone va AL FINAL de la lista para no mover la posicion de las columnas ya
-- existentes. El cuerpo es identico al anterior salvo esa columna y su GROUP BY.

BEGIN;

DROP FUNCTION IF EXISTS public.get_businesses_with_review_stats();

CREATE FUNCTION public.get_businesses_with_review_stats()
RETURNS TABLE(
    id uuid,
    name text,
    description text,
    category text,
    country text,
    logo_url text,
    avg_rating numeric,
    review_count bigint,
    logo_tone text
)
LANGUAGE plpgsql
SECURITY DEFINER
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
        reviews r ON b.id = r.business_id AND r.status = 'approved'
    GROUP BY
        b.id, b.name, b.description, b.category, b.country, b.logo_url, b.logo_tone
    ORDER BY
        review_count DESC,
        avg_rating DESC,
        b.name ASC;
END;
$function$;

-- Mismos permisos que tenia antes del DROP.
GRANT EXECUTE ON FUNCTION public.get_businesses_with_review_stats() TO anon;
GRANT EXECUTE ON FUNCTION public.get_businesses_with_review_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_businesses_with_review_stats() TO service_role;

COMMIT;
