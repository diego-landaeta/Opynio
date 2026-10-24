-- Portada del panel de administracion (/admin/panel): lo que hay que hacer, en
-- una sola llamada y sin recorrer tablas desde el cliente.
--
-- Devuelve, por cada cola (resenas por moderar, reclamaciones, apelaciones,
-- informes de errores, pagos fallidos): cuantas hay, la fecha de la mas antigua
-- y los 5 primeros elementos ordenados de MAS ANTIGUO a mas reciente (el que
-- lleva mas tiempo esperando va primero). Ademas:
--   * Pildoras de la cola de resenas: todas / mas de 3 dias / 1-2 estrellas /
--     con imagen, cada una con su recuento y sus 5 primeros elementos, para que
--     cambiar de pildora no lance otra consulta.
--   * Esta semana frente a la anterior: los 7 ultimos dias y los 7 anteriores
--     (rodantes, no semanas naturales) de resenas publicadas, usuarios nuevos,
--     empresas nuevas y nota media.
--   * Totales y `empty_businesses`: cuantas empresas borra «Eliminar empresas
--     vacias». Se obtiene llamando a businesses_without_reviews(), la MISMA
--     funcion que usa el boton, para que el numero de la pantalla y lo que se
--     borra no puedan desviarse.
--
-- No sustituye a admin_platform_stats() (20261023100000), que sigue alimentando
-- /admin/rendimiento con tendencias de 12 semanas, rankings y scraping: eso es
-- demasiado trabajo para una pagina de entrada y no trae los elementos de cada
-- cola ni la semana anterior.
--
-- Criterios (los mismos que admin_platform_stats, para que las cifras cuadren):
--   * «Resena publicada» = status 'approved', created_at <= now() y rating 1-5.
--   * Antiguedad de una resena pendiente = COALESCE(pending_since, created_at).
--   * Reclamaciones abiertas = 'pending' o 'in_review'; errores abiertos =
--     'open' o 'in_progress'; apelaciones abiertas = 'pending'; pago fallido =
--     suscripcion 'past_due' o 'unpaid'.
--
-- Compatible con el esquema de produccion, que difiere del local:
--   * reviews.id / bug_reports.id / review_appeals.* son bigint en produccion y
--     uuid en local; claims.business_id es uuid en produccion y text en local.
--     Los ids salen en el jsonb tal cual y los cruces de claims van por ::text.
--   * profiles.role, subscriptions.status y claims.status son enums: se
--     comparan siempre como texto.
--   * businesses NO tiene columna plan en produccion (no se usa).
--   * subscriptions: current_period_start y created existen solo en produccion,
--     updated_at y created_at solo en local; bug_reports.page_url y url varian.
--     Se leen con to_jsonb(fila)->>'columna', que da NULL si la columna falta
--     en vez de romper al planificar la consulta.
--
-- Sin correos electronicos: de quien reclama o paga sale el nombre de su perfil
-- (o su usuario), como ya hace la pantalla de reclamaciones.
--
-- Solo lectura. SECURITY DEFINER para no depender de cada politica RLS; por eso
-- comprueba al principio que quien llama es admin, igual que admin_platform_stats.

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_dashboard_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now   timestamptz := now();
  v_d3    timestamptz := now() - interval '3 days';
  v_d7    timestamptz := now() - interval '7 days';
  v_d14   timestamptz := now() - interval '14 days';
  v_rev   jsonb;
  v_claim jsonb;
  v_app   jsonb;
  v_bug   jsonb;
  v_due   jsonb;
  v_week  jsonb;
  v_tot   jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text = 'admin') THEN
    RAISE EXCEPTION 'Acción solo para administradores.' USING ERRCODE = '42501';
  END IF;

  -- ---------------------------------------------------------------- reseñas
  WITH pend AS (
    SELECT r.id, r.rating, r.title, r.review_text, r.category, r.created_at,
           COALESCE(r.pending_since, r.created_at) AS since,
           COALESCE(cardinality(r.image_urls), 0) AS images,
           r.business_id, r.user_id, r.original_author_name
    FROM public.reviews r
    WHERE r.status = 'pending'
  ),
  top_all  AS (SELECT id FROM pend ORDER BY since, id LIMIT 5),
  top_late AS (SELECT id FROM pend WHERE since < v_d3 ORDER BY since, id LIMIT 5),
  top_low  AS (SELECT id FROM pend WHERE rating <= 2 ORDER BY since, id LIMIT 5),
  top_img  AS (SELECT id FROM pend WHERE images > 0 ORDER BY since, id LIMIT 5),
  need AS (
    SELECT id FROM top_all UNION SELECT id FROM top_late
    UNION SELECT id FROM top_low UNION SELECT id FROM top_img
  ),
  detail AS (
    SELECT p.id, p.since,
           jsonb_build_object(
             'id',                p.id,
             'rating',            p.rating,
             'title',             left(btrim(COALESCE(p.title, '')), 200),
             'excerpt',           left(btrim(COALESCE(p.review_text, '')), 301),
             'since',             p.since,
             'images',            p.images,
             'business_id',       b.id,
             'business_name',     b.name,
             'business_country',  b.country,
             'business_category', COALESCE(b.category, p.category),
             'business_logo_url', b.logo_url,
             'business_logo_tone', b.logo_tone,
             -- Mismo orden que utils/reviewDisplay: autor original (importada) y, si no, perfil.
             'author',            COALESCE(NULLIF(btrim(p.original_author_name), ''), NULLIF(btrim(pr.name), ''), NULLIF(btrim(pr.username), ''))
           ) AS j
    FROM pend p
    JOIN need n ON n.id = p.id
    LEFT JOIN public.businesses b ON b.id = p.business_id
    LEFT JOIN public.profiles pr ON pr.id = p.user_id
  )
  SELECT jsonb_build_object(
    'pending',         (SELECT count(*) FROM pend),
    'oldest_pending',  (SELECT min(since) FROM pend),
    'counts', jsonb_build_object(
      'all',   (SELECT count(*) FROM pend),
      'late',  (SELECT count(*) FROM pend WHERE since < v_d3),
      'low',   (SELECT count(*) FROM pend WHERE rating <= 2),
      'image', (SELECT count(*) FROM pend WHERE images > 0)
    ),
    'items', jsonb_build_object(
      'all',   COALESCE((SELECT jsonb_agg(d.j ORDER BY d.since, d.id) FROM detail d WHERE d.id IN (SELECT id FROM top_all)),  '[]'::jsonb),
      'late',  COALESCE((SELECT jsonb_agg(d.j ORDER BY d.since, d.id) FROM detail d WHERE d.id IN (SELECT id FROM top_late)), '[]'::jsonb),
      'low',   COALESCE((SELECT jsonb_agg(d.j ORDER BY d.since, d.id) FROM detail d WHERE d.id IN (SELECT id FROM top_low)),  '[]'::jsonb),
      'image', COALESCE((SELECT jsonb_agg(d.j ORDER BY d.since, d.id) FROM detail d WHERE d.id IN (SELECT id FROM top_img)),  '[]'::jsonb)
    )
  ) INTO v_rev;

  -- ---------------------------------------------------------- reclamaciones
  WITH open_claims AS (
    SELECT c.id, c.created_at, c.business_id::text AS business_id, c.user_id
    FROM public.claims c
    WHERE c.status::text IN ('pending', 'in_review')
  ),
  top AS (SELECT * FROM open_claims ORDER BY created_at, id LIMIT 5)
  SELECT jsonb_build_object(
    'open',   (SELECT count(*) FROM open_claims),
    'oldest', (SELECT min(created_at) FROM open_claims),
    'items',  COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id',               t.id,
               'since',            t.created_at,
               'business_name',    b.name,
               'business_country', b.country,
               'business_logo_url', b.logo_url,
               'business_logo_tone', b.logo_tone,
               'claimant',         COALESCE(NULLIF(btrim(pr.name), ''), NULLIF(btrim(pr.username), ''))
             ) ORDER BY t.created_at, t.id)
      FROM top t
      LEFT JOIN public.businesses b ON b.id::text = t.business_id
      LEFT JOIN public.profiles pr ON pr.id = t.user_id
    ), '[]'::jsonb)
  ) INTO v_claim;

  -- ------------------------------------------------------------ apelaciones
  WITH open_appeals AS (
    SELECT a.id, a.created_at, a.review_id, a.reason
    FROM public.review_appeals a
    WHERE a.status = 'pending'
  ),
  top AS (SELECT * FROM open_appeals ORDER BY created_at, id LIMIT 5)
  SELECT jsonb_build_object(
    'open',   (SELECT count(*) FROM open_appeals),
    'oldest', (SELECT min(created_at) FROM open_appeals),
    'items',  COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id',               t.id,
               'since',            t.created_at,
               'reason',           left(btrim(COALESCE(t.reason, '')), 161),
               'business_name',    b.name,
               'business_country', b.country,
               'business_logo_url', b.logo_url,
               'business_logo_tone', b.logo_tone
             ) ORDER BY t.created_at, t.id)
      FROM top t
      LEFT JOIN public.reviews r ON r.id = t.review_id
      LEFT JOIN public.businesses b ON b.id = r.business_id
    ), '[]'::jsonb)
  ) INTO v_app;

  -- ------------------------------------------------------ informes de errores
  WITH open_bugs AS (
    SELECT g.id, g.created_at, g.title, g.description, g.browser_info,
           COALESCE(to_jsonb(g)->>'page_url', to_jsonb(g)->>'url') AS page_url
    FROM public.bug_reports g
    WHERE g.status IN ('open', 'in_progress')
  ),
  top AS (SELECT * FROM open_bugs ORDER BY created_at, id LIMIT 5)
  SELECT jsonb_build_object(
    'open',   (SELECT count(*) FROM open_bugs),
    'oldest', (SELECT min(created_at) FROM open_bugs),
    'items',  COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id',        t.id,
               'since',     t.created_at,
               'title',     left(btrim(COALESCE(NULLIF(btrim(t.title), ''), t.description, '')), 161),
               'page_url',  left(t.page_url, 300),
               -- NULL cuando no hay datos del navegador: no se inventa «escritorio».
               'mobile',    CASE WHEN NULLIF(btrim(t.browser_info), '') IS NULL THEN NULL
                                 ELSE t.browser_info ~* '(mobi|android|iphone|ipad)' END
             ) ORDER BY t.created_at, t.id)
      FROM top t
    ), '[]'::jsonb)
  ) INTO v_bug;

  -- ----------------------------------------------------------- pagos fallidos
  WITH due AS (
    SELECT s.id, s.user_id, s.status::text AS status,
           -- Cuando venció el cobro que fallo: current_period_start (produccion);
           -- si falta, la ultima modificacion o el alta, segun el esquema.
           COALESCE(
             (to_jsonb(s)->>'current_period_start'),
             (to_jsonb(s)->>'updated_at'),
             (to_jsonb(s)->>'created_at'),
             (to_jsonb(s)->>'created')
           )::timestamptz AS since
    FROM public.subscriptions s
    WHERE s.status::text IN ('past_due', 'unpaid')
  ),
  top AS (SELECT * FROM due ORDER BY since NULLS LAST, id LIMIT 5)
  SELECT jsonb_build_object(
    'count',  (SELECT count(*) FROM due),
    'oldest', (SELECT min(since) FROM due),
    'items',  COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id',       t.id,
               'since',    t.since,
               'status',   t.status,
               'plan',     pr.plan,
               'user',     COALESCE(NULLIF(btrim(pr.name), ''), NULLIF(btrim(pr.username), '')),
               'username', NULLIF(btrim(pr.username), '')
             ) ORDER BY t.since NULLS LAST, t.id)
      FROM top t
      LEFT JOIN public.profiles pr ON pr.id = t.user_id
    ), '[]'::jsonb)
  ) INTO v_due;

  -- -------------------------------------- esta semana frente a la anterior
  SELECT jsonb_build_object(
    'reviews', jsonb_build_object(
      'this', count(*) FILTER (WHERE r.status = 'approved' AND r.rating BETWEEN 1 AND 5 AND r.created_at <= v_now AND r.created_at >= v_d7),
      'prev', count(*) FILTER (WHERE r.status = 'approved' AND r.rating BETWEEN 1 AND 5 AND r.created_at <  v_d7  AND r.created_at >= v_d14)
    ),
    'avg_rating', jsonb_build_object(
      'this', round((avg(r.rating) FILTER (WHERE r.status = 'approved' AND r.rating BETWEEN 1 AND 5 AND r.created_at <= v_now AND r.created_at >= v_d7))::numeric, 2),
      'prev', round((avg(r.rating) FILTER (WHERE r.status = 'approved' AND r.rating BETWEEN 1 AND 5 AND r.created_at <  v_d7  AND r.created_at >= v_d14))::numeric, 2)
    )
  ) INTO v_week
  FROM public.reviews r
  WHERE r.created_at >= v_d14;

  v_week := v_week || jsonb_build_object(
    'users', (SELECT jsonb_build_object(
                'this', count(*) FILTER (WHERE created_at >= v_d7),
                'prev', count(*) FILTER (WHERE created_at <  v_d7 AND created_at >= v_d14))
              FROM public.profiles WHERE created_at >= v_d14),
    'businesses', (SELECT jsonb_build_object(
                'this', count(*) FILTER (WHERE created_at >= v_d7),
                'prev', count(*) FILTER (WHERE created_at <  v_d7 AND created_at >= v_d14))
              FROM public.businesses WHERE created_at >= v_d14)
  );

  -- ----------------------------------------------------------------- totales
  SELECT jsonb_build_object(
    'users',            (SELECT count(*) FROM public.profiles),
    'businesses',       (SELECT count(*) FROM public.businesses),
    'businesses_with_owner', (SELECT count(*) FROM public.businesses WHERE owner_id IS NOT NULL),
    -- Ninguna resena, del estado que sea (criterio de admin_platform_stats).
    'businesses_without_reviews', (SELECT count(*) FROM public.businesses b WHERE NOT EXISTS (SELECT 1 FROM public.reviews r WHERE r.business_id = b.id)),
    'reviews_published', (SELECT count(*) FROM public.reviews WHERE status = 'approved' AND rating BETWEEN 1 AND 5 AND created_at <= v_now),
    -- Lo que borraria «Eliminar empresas vacias»: la misma funcion que usa el boton.
    'empty_businesses', (SELECT count(*) FROM public.businesses_without_reviews())
  ) INTO v_tot;

  RETURN jsonb_build_object(
    'generated_at', v_now,
    'reviews',      v_rev,
    'claims',       v_claim,
    'appeals',      v_app,
    'bugs',         v_bug,
    'past_due',     v_due,
    'week',         v_week,
    'totals',       v_tot
  );
END;
$$;

COMMENT ON FUNCTION public.admin_dashboard_overview() IS
  'Portada de /admin/panel: colas con sus 5 primeros elementos (mas antiguos primero), semana actual frente a la anterior y totales. Solo admins (42501 si no). Solo lectura.';

REVOKE EXECUTE ON FUNCTION public.admin_dashboard_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_overview() TO authenticated, service_role;

COMMIT;
