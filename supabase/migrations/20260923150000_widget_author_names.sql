-- =============================================================================
-- Nombre del autor en los widgets embebidos. 2026-09-23
--
-- Los widgets (empresa y producto) solo leian reviews.original_author_name,
-- que existe en las resenas importadas de Google. Toda resena escrita en
-- Opynio salia como "Anonimo" en la web del cliente. Reproducido en local con
-- scripts/local/web-cliente.html: el widget de empresa mostraba seis
-- "Anonimo" seguidos.
--
-- Regla (una sola, para los dos widgets):
--   - resena importada con nombre original -> ese nombre, tal cual
--   - resena de Opynio -> "Nombre I." a partir del perfil (primer nombre e
--     inicial del segundo), el mismo formato que ya tienen las importadas.
-- No se expone el nombre completo del usuario en webs de terceros.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.widget_author_label(p_original text, p_profile_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN NULLIF(btrim(p_original), '') IS NOT NULL THEN btrim(p_original)
    WHEN NULLIF(btrim(p_profile_name), '') IS NULL THEN NULL
    WHEN split_part(btrim(p_profile_name), ' ', 2) = '' THEN split_part(btrim(p_profile_name), ' ', 1)
    ELSE split_part(btrim(p_profile_name), ' ', 1) || ' ' || upper(left(split_part(btrim(p_profile_name), ' ', 2), 1)) || '.'
  END;
$$;

-- Producto: mismas columnas y firma que antes (widget-proxy no cambia aqui);
-- solo original_author_name pasa a venir relleno tambien para Opynio.
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
    SELECT r.title, r.review_text, r.rating,
           public.widget_author_label(r.original_author_name, p.name),
           r.source, r.created_at
    FROM public.review_subject_links l
    JOIN public.reviews r ON r.id = l.review_id
    LEFT JOIN public.profiles p ON p.id = r.user_id
    WHERE l.subject_id = p_subject_id
      AND r.status = 'approved'
      AND r.created_at <= now()
      AND r.title IS NOT NULL AND r.title <> ''
      AND r.review_text IS NOT NULL AND r.review_text <> ''
    ORDER BY r.created_at DESC, r.id DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
$$;

-- Empresa: el mismo conjunto que widget-proxy pedia con una consulta directa,
-- ahora con el nombre resuelto. widget-proxy pasa a usar esta RPC.
CREATE OR REPLACE FUNCTION public.widget_business_reviews(p_business_id uuid, p_limit int DEFAULT 20)
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
    SELECT r.title, r.review_text, r.rating,
           public.widget_author_label(r.original_author_name, p.name),
           r.source, r.created_at
    FROM public.reviews r
    LEFT JOIN public.profiles p ON p.id = r.user_id
    WHERE r.business_id = p_business_id
      AND r.status = 'approved'
      AND r.created_at <= now()
      AND r.title IS NOT NULL AND r.title <> ''
      AND r.review_text IS NOT NULL AND r.review_text <> ''
    ORDER BY r.created_at DESC, r.id DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
$$;

COMMENT ON FUNCTION public.widget_business_reviews(uuid, int) IS
    'Reseñas visibles de una empresa para el widget embebido, con el nombre del autor resuelto (original o "Nombre I." del perfil).';

GRANT EXECUTE ON FUNCTION public.widget_author_label(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.widget_subject_reviews(uuid, int) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.widget_business_reviews(uuid, int) TO anon, authenticated, service_role;

COMMIT;
