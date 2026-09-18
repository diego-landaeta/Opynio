-- RPCs del widget por sujeto (producto).
--
-- Funciones NUEVAS, con nombres nuevos. widget_business_stats no se redefine ni
-- se toca: el widget de empresa sigue devolviendo exactamente los mismos
-- numeros que hoy.
--
-- Los filtros replican EXACTAMENTE los de widget_business_stats:
--   status = 'approved'  ·  created_at <= now()  (las programadas no cuentan
--   hasta su fecha, igual que en la ficha publica)
-- y ademas exigen enlace explicito al sujeto. Sin enlace no hay fila: un
-- producto sin resenas asignadas devuelve 0, nunca las de su empresa.

CREATE OR REPLACE FUNCTION public.widget_subject_stats(p_subject_id uuid)
RETURNS TABLE (review_count bigint, avg_rating numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        count(*)::bigint AS review_count,
        COALESCE(round(avg(r.rating)::numeric, 1), 0) AS avg_rating
    FROM public.review_subject_links l
    JOIN public.reviews r ON r.id = l.review_id
    WHERE l.subject_id = p_subject_id
      AND r.status = 'approved'
      AND r.created_at <= now();
$$;

COMMENT ON FUNCTION public.widget_subject_stats(uuid) IS
    'Total y media de las reseñas aprobadas y publicadas asignadas a un sujeto (producto). Devuelve 0 si no tiene ninguna asignada.';

-- Las resenas que pinta el widget del producto. Mismo conjunto de columnas y
-- mismos filtros de calidad que usa widget-proxy para la empresa (titulo y
-- texto no vacios), para que las tarjetas se rendericen igual.
CREATE OR REPLACE FUNCTION public.widget_subject_reviews(p_subject_id uuid, p_limit int DEFAULT 20)
RETURNS TABLE (
    title text,
    review_text text,
    rating integer,
    original_author_name text,
    source text,
    created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT r.title, r.review_text, r.rating, r.original_author_name, r.source, r.created_at
    FROM public.review_subject_links l
    JOIN public.reviews r ON r.id = l.review_id
    WHERE l.subject_id = p_subject_id
      AND r.status = 'approved'
      AND r.created_at <= now()
      AND r.title IS NOT NULL AND r.title <> ''
      AND r.review_text IS NOT NULL AND r.review_text <> ''
    ORDER BY r.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
$$;

COMMENT ON FUNCTION public.widget_subject_reviews(uuid, int) IS
    'Reseñas visibles de un sujeto para el widget embebido. Solo las enlazadas explícitamente.';

-- Las llama widget-proxy con la service-role key. Se conceden tambien a anon y
-- authenticated porque solo devuelven datos publicos, los mismos que ya
-- aparecen en la ficha de la empresa.
GRANT EXECUTE ON FUNCTION public.widget_subject_stats(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.widget_subject_reviews(uuid, int) TO anon, authenticated, service_role;

-- Estadisticas de TODOS los productos de una empresa en una sola llamada, para
-- el listado del dashboard. Sin esto el panel haria una consulta por producto.
-- LEFT JOIN: un producto sin resenas asignadas sale con 0, no desaparece de la
-- lista.
CREATE OR REPLACE FUNCTION public.business_subject_stats(p_business_id uuid)
RETURNS TABLE (subject_id uuid, review_count bigint, avg_rating numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        s.id AS subject_id,
        count(r.id)::bigint AS review_count,
        COALESCE(round(avg(r.rating)::numeric, 1), 0) AS avg_rating
    FROM public.review_subjects s
    LEFT JOIN public.review_subject_links l ON l.subject_id = s.id
    LEFT JOIN public.reviews r
           ON r.id = l.review_id
          AND r.status = 'approved'
          AND r.created_at <= now()
    WHERE s.business_id = p_business_id
    GROUP BY s.id;
$$;

COMMENT ON FUNCTION public.business_subject_stats(uuid) IS
    'Nota y número de reseñas de cada sujeto de una empresa, en una sola consulta. Para el listado del panel.';

GRANT EXECUTE ON FUNCTION public.business_subject_stats(uuid) TO anon, authenticated, service_role;

-- Resenas aprobadas de una empresa que NO estan asignadas a ningun producto.
--
-- POR QUE EXISTE
-- Google y el scraping siguen trayendo resenas cada mes, y ninguna se asigna
-- sola. Sin este contador, el widget de un producto se queda congelado mientras
-- el de la empresa sube, y nadie se entera. PostgREST no sabe expresar un
-- NOT EXISTS, asi que va aqui.
CREATE OR REPLACE FUNCTION public.business_unassigned_review_count(p_business_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT count(*)::bigint
    FROM public.reviews r
    WHERE r.business_id = p_business_id
      AND r.status = 'approved'
      AND r.created_at <= now()
      AND NOT EXISTS (
          SELECT 1 FROM public.review_subject_links l WHERE l.review_id = r.id
      );
$$;

COMMENT ON FUNCTION public.business_unassigned_review_count(uuid) IS
    'Cuántas reseñas aprobadas de la empresa no están asignadas a ningún producto. Para avisar en el panel.';

-- Solo la usa el panel del dueño; el widget publico no la necesita.
GRANT EXECUTE ON FUNCTION public.business_unassigned_review_count(uuid) TO authenticated, service_role;
