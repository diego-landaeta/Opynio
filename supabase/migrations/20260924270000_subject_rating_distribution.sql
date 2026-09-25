-- =============================================================================
-- Distribución de valoraciones y chips de fuente de UN producto. 2026-09-24
--
-- En la ficha pública, al elegir un producto en «Productos y servicios
-- valorados», la lista de reseñas ya se filtraba, pero la tarjeta «Distribución
-- de valoraciones» y los chips de fuente seguían con las cifras de TODA la
-- empresa (81 reseñas en academia-local, cuando el curso elegido tiene 9).
--
-- Esta RPC devuelve, para un producto de una empresa y en una sola consulta:
--   - r1..r5: reseñas por estrellas (la distribución),
--   - opynio / google / trustindex / total: los chips de fuente, con el mismo
--     criterio que review_source_counts (opynio incluye las antiguas 'manual').
-- Mismo filtro que el resto de la ficha: status = 'approved' y
-- created_at <= now(). Y la reseña tiene que ser de ESA empresa, igual que la
-- lista (getReviewsOptimized filtra por business_id).
--
-- El total de la empresa NO sale de aquí: sigue siendo review_stats_batch /
-- review_source_counts, que cuentan TODAS sus reseñas (también las que no
-- tienen producto: Google, scrapeadas). Esto es solo el subconjunto del
-- producto.
--
-- Tipos: no se asume el de reviews.id (bigint en producción, uuid en local);
-- solo se compara l.review_id = r.id, que 20260917120000 ya crea del mismo tipo.
--
-- Requiere 20260917120000_review_subjects (review_subjects y
-- review_subject_links): si faltan, aborta sin tocar nada. Idempotente.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.subject_review_stats(uuid, uuid);
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.review_subjects') IS NULL OR to_regclass('public.review_subject_links') IS NULL THEN
    RAISE EXCEPTION 'subject_rating_distribution: faltan review_subjects / review_subject_links. Aplica antes 20260917120000_review_subjects.sql.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.subject_review_stats(p_business_id uuid, p_subject_id uuid)
RETURNS TABLE (
    r1 bigint, r2 bigint, r3 bigint, r4 bigint, r5 bigint,
    opynio bigint, google bigint, trustindex bigint, total bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        count(*) FILTER (WHERE r.rating = 1)::bigint,
        count(*) FILTER (WHERE r.rating = 2)::bigint,
        count(*) FILTER (WHERE r.rating = 3)::bigint,
        count(*) FILTER (WHERE r.rating = 4)::bigint,
        count(*) FILTER (WHERE r.rating = 5)::bigint,
        count(*) FILTER (WHERE COALESCE(r.source, 'opynio') IN ('opynio', 'manual'))::bigint,
        count(*) FILTER (WHERE r.source = 'google')::bigint,
        count(*) FILTER (WHERE r.source = 'trustindex')::bigint,
        count(*)::bigint
    FROM public.review_subject_links l
    JOIN public.review_subjects s
      ON s.id = l.subject_id
     AND s.business_id = p_business_id
    JOIN public.reviews r
      ON r.id = l.review_id
     AND r.business_id = p_business_id
     AND r.status = 'approved'
     AND r.created_at <= now()
    WHERE l.subject_id = p_subject_id;
$$;

COMMENT ON FUNCTION public.subject_review_stats(uuid, uuid) IS
    'Reseñas publicadas de un producto de una empresa: por estrellas (r1..r5) y por fuente (opynio incluye manual, total = todas). Para la ficha pública con un producto elegido.';

REVOKE ALL ON FUNCTION public.subject_review_stats(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.subject_review_stats(uuid, uuid) TO anon, authenticated, service_role;

COMMIT;

-- Verificación:
--   SELECT proconfig, prosecdef FROM pg_proc WHERE proname = 'subject_review_stats';   -- {search_path=public}, t
--   SELECT * FROM public.subject_review_stats('<business uuid>', '<subject uuid>');
--   -- r1+..+r5 = total = review_count de business_subject_stats para ese sujeto
