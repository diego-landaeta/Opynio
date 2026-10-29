-- Rendimiento total de la plataforma para el panel de administracion.
--
-- Una sola llamada devuelve todos los agregados del dashboard
-- (/admin/rendimiento). Se calcula en Postgres a proposito: leer filas desde
-- el cliente para contarlas se trunca en 1.000 (PostgREST) y con ~49.000
-- resenas daba cifras falsas (ver 20260825120000_source_counts_...).
--
-- Criterios (para que las cifras cuadren con el resto de la web):
--   * «Resena publicada» = status 'approved', created_at <= now() (las cargas
--     programadas llevan fecha futura y aun no cuentan) y rating entre 1 y 5.
--     Es el mismo filtro que review_source_counts.
--   * Resenas nuevas 7/30 dias y la serie semanal usan created_at, solo
--     publicadas.
--   * Cola de moderacion = status 'pending' (sin filtro de fecha).
--   * Reclamaciones abiertas = claims 'pending' o 'in_review'; bugs abiertos =
--     'open' o 'in_progress'; apelaciones abiertas = 'pending'.
--   * Top por nota: solo empresas con >= 5 resenas publicadas, para que una
--     empresa con una sola resena de 5 estrellas no encabece la lista.
--   * scraping_queue / scraping_sessions: en produccion existen, en entornos
--     reconstruidos no. Si faltan (o su forma cambia) el bloque `scraping`
--     sale null y el panel muestra «no disponible» sin romperse.
--
-- Solo lectura. SECURITY DEFINER porque cuenta tablas enteras (RLS dejaria al
-- admin ver todo igualmente, pero asi no depende de cada politica); por eso
-- comprueba al principio que quien llama es admin, igual que admin_list_users.

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_platform_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now      timestamptz := now();
  v_week0    timestamptz := date_trunc('week', now()) - interval '11 weeks';
  v_users    jsonb;
  v_biz      jsonb;
  v_reviews  jsonb;
  v_subs     jsonb;
  v_requests jsonb;
  v_scrap    jsonb := NULL;
  v_trends   jsonb;
  v_top      jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin') THEN
    RAISE EXCEPTION 'Acción solo para administradores.' USING ERRCODE = '42501';
  END IF;

  -- Usuarios
  SELECT jsonb_build_object(
    'total',   count(*),
    'new_7d',  count(*) FILTER (WHERE created_at >= v_now - interval '7 days'),
    'new_30d', count(*) FILTER (WHERE created_at >= v_now - interval '30 days'),
    'by_role', COALESCE((SELECT jsonb_object_agg(role, n) FROM (SELECT COALESCE(role::text, 'authenticated') AS role, count(*) AS n FROM public.profiles GROUP BY 1) r), '{}'::jsonb),
    'by_plan', COALESCE((SELECT jsonb_object_agg(plan, n) FROM (SELECT COALESCE(plan, 'free') AS plan, count(*) AS n FROM public.profiles GROUP BY 1) p), '{}'::jsonb)
  ) INTO v_users
  FROM public.profiles;

  -- Empresas
  SELECT jsonb_build_object(
    'total',           count(*),
    'with_owner',      count(*) FILTER (WHERE b.owner_id IS NOT NULL),
    'featured',        count(*) FILTER (WHERE b.is_featured IS TRUE),
    'new_30d',         count(*) FILTER (WHERE b.created_at >= v_now - interval '30 days'),
    -- Misma regla que businesses_without_reviews (ninguna reseña, del estado que sea). Va como subconsulta
    -- aparte: dentro de un FILTER, el NOT EXISTS correlacionado recorre las 50.000 reseñas por cada empresa (14 s en producción);
    -- así el planificador la convierte en un anti-join (unos 40 ms).
    'without_reviews', (SELECT count(*) FROM public.businesses nb WHERE NOT EXISTS (SELECT 1 FROM public.reviews r WHERE r.business_id = nb.id)),
    -- El plan es el del DUEÑO (profiles.plan): businesses no tiene columna plan en produccion.
    'by_plan',         COALESCE((SELECT jsonb_object_agg(plan, n) FROM (SELECT COALESCE(pr.plan, 'free') AS plan, count(*) AS n FROM public.businesses bb LEFT JOIN public.profiles pr ON pr.id = bb.owner_id GROUP BY 1) p), '{}'::jsonb)
  ) INTO v_biz
  FROM public.businesses b;

  -- Resenas
  SELECT jsonb_build_object(
    'total',          count(*),
    'by_status',      COALESCE((SELECT jsonb_object_agg(status, n) FROM (SELECT COALESCE(status, 'unknown') AS status, count(*) AS n FROM public.reviews GROUP BY 1) s), '{}'::jsonb),
    'published',      count(*) FILTER (WHERE status = 'approved' AND created_at <= v_now AND rating BETWEEN 1 AND 5),
    'new_7d',         count(*) FILTER (WHERE status = 'approved' AND created_at <= v_now AND created_at >= v_now - interval '7 days'),
    'new_30d',        count(*) FILTER (WHERE status = 'approved' AND created_at <= v_now AND created_at >= v_now - interval '30 days'),
    'pending',        count(*) FILTER (WHERE status = 'pending'),
    'oldest_pending', min(COALESCE(pending_since, created_at)) FILTER (WHERE status = 'pending'),
    'avg_rating',     round((avg(rating) FILTER (WHERE status = 'approved' AND created_at <= v_now AND rating BETWEEN 1 AND 5))::numeric, 2),
    'rating_distribution', jsonb_build_object(
      '1', count(*) FILTER (WHERE status = 'approved' AND created_at <= v_now AND rating = 1),
      '2', count(*) FILTER (WHERE status = 'approved' AND created_at <= v_now AND rating = 2),
      '3', count(*) FILTER (WHERE status = 'approved' AND created_at <= v_now AND rating = 3),
      '4', count(*) FILTER (WHERE status = 'approved' AND created_at <= v_now AND rating = 4),
      '5', count(*) FILTER (WHERE status = 'approved' AND created_at <= v_now AND rating = 5)
    ),
    'by_source',      COALESCE((SELECT jsonb_object_agg(source, n) FROM (SELECT COALESCE(source, 'opynio') AS source, count(*) AS n FROM public.reviews WHERE status = 'approved' AND created_at <= v_now AND rating BETWEEN 1 AND 5 GROUP BY 1) s), '{}'::jsonb)
  ) INTO v_reviews
  FROM public.reviews;

  -- Suscripciones (Stripe) y planes de pago de los perfiles
  SELECT jsonb_build_object(
    'by_status',        COALESCE((SELECT jsonb_object_agg(status, n) FROM (SELECT COALESCE(status::text, 'unknown') AS status, count(*) AS n FROM public.subscriptions GROUP BY 1) s), '{}'::jsonb),
    'cancel_at_period_end', (SELECT count(*) FROM public.subscriptions WHERE status IN ('active', 'trialing') AND cancel_at_period_end IS TRUE),
    'past_due',         (SELECT count(*) FROM public.subscriptions WHERE status IN ('past_due', 'unpaid')),
    'paid_by_plan',     COALESCE((SELECT jsonb_object_agg(plan, n) FROM (SELECT plan, count(*) AS n FROM public.profiles WHERE plan IS NOT NULL AND plan <> 'free' GROUP BY 1) p), '{}'::jsonb)
  ) INTO v_subs;

  -- Tramites abiertos
  SELECT jsonb_build_object(
    'claims_open',  (SELECT count(*) FROM public.claims WHERE status IN ('pending', 'in_review')),
    'bugs_open',    (SELECT count(*) FROM public.bug_reports WHERE status IN ('open', 'in_progress')),
    'appeals_open', (SELECT count(*) FROM public.review_appeals WHERE status = 'pending')
  ) INTO v_requests;

  -- Scraping: opcional (puede no existir la tabla o tener otra forma)
  IF to_regclass('public.scraping_queue') IS NOT NULL THEN
    BEGIN
      EXECUTE $q$
        SELECT jsonb_build_object(
          'queue_pending',   count(*) FILTER (WHERE status = 'pending'),
          'queue_failed',    count(*) FILTER (WHERE status = 'failed'),
          'queue_scheduled', count(*) FILTER (WHERE status = 'approved'),
          'queue_completed', count(*) FILTER (WHERE status = 'completed')
        ) FROM public.scraping_queue
      $q$ INTO v_scrap;
    EXCEPTION WHEN OTHERS THEN
      v_scrap := NULL;
    END;
    IF v_scrap IS NOT NULL AND to_regclass('public.scraping_sessions') IS NOT NULL THEN
      BEGIN
        EXECUTE $q$
          SELECT $1 || jsonb_build_object(
            'sessions_running', count(*) FILTER (WHERE status = 'running'),
            'sessions_failed_7d', count(*) FILTER (WHERE status = 'failed' AND created_at >= now() - interval '7 days'),
            'last_session_at', max(created_at)
          ) FROM public.scraping_sessions
        $q$ INTO v_scrap USING v_scrap;
      EXCEPTION WHEN OTHERS THEN
        NULL; -- se queda con los datos de la cola
      END;
    END IF;
  END IF;

  -- Tendencias: 12 semanas (lunes a domingo, UTC), con las semanas vacias a 0.
  -- Solo resenas y altas de usuarios; las altas de empresas se dejaron fuera a proposito:
  -- las mueve el scraping masivo (cientos de golpe), no la actividad organica.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'week_start', to_char(w.week_start, 'YYYY-MM-DD'),
           'reviews',    COALESCE(r.n, 0),
           'signups',    COALESCE(u.n, 0)
         ) ORDER BY w.week_start), '[]'::jsonb)
  INTO v_trends
  FROM generate_series(v_week0, date_trunc('week', v_now), interval '1 week') AS w(week_start)
  LEFT JOIN (
    SELECT date_trunc('week', created_at) AS wk, count(*) AS n
    FROM public.reviews
    WHERE status = 'approved' AND created_at <= v_now AND created_at >= v_week0 AND rating BETWEEN 1 AND 5
    GROUP BY 1
  ) r ON r.wk = w.week_start
  LEFT JOIN (
    SELECT date_trunc('week', created_at) AS wk, count(*) AS n
    FROM public.profiles WHERE created_at >= v_week0 GROUP BY 1
  ) u ON u.wk = w.week_start;

  -- Top 5 empresas por resenas publicadas y por nota media (>= 5 resenas).
  -- Llevan slug para enlazar a la ficha por su URL canonica (sin acentos).
  WITH per_business AS (
    SELECT r.business_id, count(*) AS reviews, round(avg(r.rating)::numeric, 2) AS avg_rating
    FROM public.reviews r
    WHERE r.status = 'approved' AND r.created_at <= v_now AND r.rating BETWEEN 1 AND 5
    GROUP BY r.business_id
  ),
  by_reviews AS (
    SELECT b.id, b.name, b.slug, b.country, p.reviews, p.avg_rating
    FROM per_business p JOIN public.businesses b ON b.id = p.business_id
    ORDER BY p.reviews DESC, b.name, b.id
    LIMIT 5
  ),
  by_rating AS (
    SELECT b.id, b.name, b.slug, b.country, p.reviews, p.avg_rating
    FROM per_business p JOIN public.businesses b ON b.id = p.business_id
    WHERE p.reviews >= 5
    ORDER BY p.avg_rating DESC, p.reviews DESC, b.name, b.id
    LIMIT 5
  )
  SELECT jsonb_build_object(
    'by_reviews', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM by_reviews ORDER BY reviews DESC, name, id) x), '[]'::jsonb),
    'by_rating',  COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM by_rating ORDER BY avg_rating DESC, reviews DESC, name, id) x), '[]'::jsonb),
    'min_reviews_for_rating', 5
  ) INTO v_top;

  RETURN jsonb_build_object(
    'generated_at',  v_now,
    'users',         v_users,
    'businesses',    v_biz,
    'reviews',       v_reviews,
    'subscriptions', v_subs,
    'requests',      v_requests,
    'scraping',      v_scrap,
    'trends',        v_trends,
    'top',           v_top
  );
END;
$$;

COMMENT ON FUNCTION public.admin_platform_stats() IS
  'Agregados de rendimiento de la plataforma para /admin/rendimiento. Solo admins (42501 si no). Solo lectura.';

REVOKE EXECUTE ON FUNCTION public.admin_platform_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_platform_stats() TO authenticated, service_role;

COMMIT;
