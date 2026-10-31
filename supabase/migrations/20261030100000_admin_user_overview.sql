-- Ficha de usuario del panel de admin. 2026-10-30
--
-- /admin/usuarios solo listaba, buscaba y cambiaba el rol. Para atender a un usuario hace falta ver de un vistazo
-- quién es, qué reseñas ha publicado, qué empresas tiene, si paga, y qué ha abierto en soporte. Dos RPC de LECTURA:
--
--   admin_user_overview(p_user_id)  -> jsonb con la cuenta, contadores, reseñas, empresas, suscripciones y trámites.
--   admin_users_stats(p_ids)        -> reseñas, votos, empresas y último acceso de los usuarios de la página del listado.
-- Incluye los votos de «útil / no útil»: los que han recibido sus reseñas y los que ha dado él (review_votes).
--
-- El correo, el último acceso y el método de acceso viven en auth.users (no se pueden leer desde el cliente), por eso
-- son SECURITY DEFINER; lo que impide que las use cualquiera es la comprobación de rol de dentro (igual que
-- admin_list_users y admin_payments_overview): quien no es admin recibe un error y ningún dato.
--
-- NO escriben nada ni tocan ninguna tabla. Leen las columnas que pueden variar entre esquemas con to_jsonb().
--
-- VUELTA ATRAS: DROP FUNCTION public.admin_user_overview(uuid); DROP FUNCTION public.admin_users_stats(uuid[]);

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_user_overview(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_cuenta jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Acción solo para administradores.' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
           'id', p.id,
           'name', p.name,
           'username', p.username,
           'email', u.email,
           'role', p.role,
           'plan', p.plan,
           'billing_cycle', p.billing_cycle,
           'plan_expires_at', p.plan_expires_at,
           'trial_full_access_until', to_jsonb(p) ->> 'trial_full_access_until',
           'avatar_url', p.avatar_url,
           'created_at', p.created_at,
           'last_sign_in_at', u.last_sign_in_at,
           'email_confirmed', (u.email_confirmed_at IS NOT NULL),
           'provider', u.raw_app_meta_data ->> 'provider',
           'preferred_language', p.preferred_language,
           'preferred_country', p.preferred_country,
           'ai_credits_used', p.ai_credits_used,
           'ai_credit_limit', p.ai_credit_limit,
           'business_limit', p.business_limit,
           'stripe_customer_id', (SELECT c.stripe_customer_id FROM public.customers c WHERE c.id = p.id)
         )
    INTO v_cuenta
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
   WHERE p.id = p_user_id;

  IF v_cuenta IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado.' USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object(
    'generatedAt', now(),
    'account', v_cuenta,
    'counts', jsonb_build_object(
      'reviews_total',    (SELECT count(*) FROM public.reviews r WHERE r.user_id = p_user_id),
      'reviews_approved', (SELECT count(*) FROM public.reviews r WHERE r.user_id = p_user_id AND r.status = 'approved'),
      'reviews_pending',  (SELECT count(*) FROM public.reviews r WHERE r.user_id = p_user_id AND r.status = 'pending'),
      'reviews_rejected', (SELECT count(*) FROM public.reviews r WHERE r.user_id = p_user_id AND r.status = 'rejected'),
      'likes_received',    (SELECT COALESCE(sum(r.helpful_votes), 0) FROM public.reviews r WHERE r.user_id = p_user_id),
      'dislikes_received', (SELECT COALESCE(sum(r.not_helpful_votes), 0) FROM public.reviews r WHERE r.user_id = p_user_id),
      'votes_given_helpful',     (SELECT count(*) FROM public.review_votes v WHERE v.user_id = p_user_id AND v.is_helpful),
      'votes_given_not_helpful', (SELECT count(*) FROM public.review_votes v WHERE v.user_id = p_user_id AND NOT v.is_helpful),
      'businesses',       (SELECT count(*) FROM public.businesses b WHERE b.owner_id = p_user_id),
      'tickets',          (SELECT count(*) FROM public.support_tickets t WHERE t.user_id = p_user_id),
      'bugs',             (SELECT count(*) FROM public.bug_reports g WHERE g.user_id = p_user_id),
      'claims',           (SELECT count(*) FROM public.claims c WHERE c.user_id = p_user_id),
      'appeals',          (SELECT count(*) FROM public.review_appeals a WHERE a.user_id = p_user_id)
    ),
    -- Reseñas que ha escrito él (las últimas 100), con la empresa a la que van.
    'reviews', COALESCE((
      SELECT jsonb_agg(x.fila ORDER BY x.creada DESC, x.id DESC)
      FROM (
        SELECT r.id, r.created_at AS creada,
               jsonb_build_object(
                 'id', r.id,
                 'business_id', r.business_id,
                 'business_name', b.name,
                 'business_slug', b.slug,
                 'business_country', b.country,
                 'rating', r.rating,
                 'title', r.title,
                 'text', left(COALESCE(r.review_text, ''), 400),
                 'status', r.status,
                 'rejection_reason', r.rejection_reason,
                 'source', r.source,
                 'helpful_votes', COALESCE(r.helpful_votes, 0),
                 'not_helpful_votes', COALESCE(r.not_helpful_votes, 0),
                 'created_at', r.created_at,
                 'published_at', r.published_at
               ) AS fila
        FROM public.reviews r
        LEFT JOIN public.businesses b ON b.id = r.business_id
        WHERE r.user_id = p_user_id
        ORDER BY r.created_at DESC, r.id DESC
        LIMIT 100
      ) x
    ), '[]'::jsonb),
    -- Empresas de las que es dueño, con su actividad.
    'businesses', COALESCE((
      SELECT jsonb_agg(x.fila ORDER BY x.creada DESC, x.id)
      FROM (
        SELECT b.id, b.created_at AS creada,
               jsonb_build_object(
                 'id', b.id,
                 'name', b.name,
                 'slug', b.slug,
                 'country', b.country,
                 'category', b.category,
                 'logo_url', b.logo_url,
                 'is_featured', b.is_featured,
                 'created_at', b.created_at,
                 'reviews_approved', (SELECT count(*) FROM public.reviews r WHERE r.business_id = b.id AND r.status = 'approved'),
                 'reviews_pending',  (SELECT count(*) FROM public.reviews r WHERE r.business_id = b.id AND r.status = 'pending'),
                 'avg_rating', (SELECT round(avg(r.rating)::numeric, 2) FROM public.reviews r
                                 WHERE r.business_id = b.id AND r.status = 'approved' AND r.rating BETWEEN 1 AND 5),
                 'invitations_sent', (SELECT count(*) FROM public.review_invitations i WHERE i.business_id = b.id)
               ) AS fila
        FROM public.businesses b
        WHERE b.owner_id = p_user_id
        ORDER BY b.created_at DESC, b.id
        LIMIT 100
      ) x
    ), '[]'::jsonb),
    -- Votos de «útil / no útil» que ha dado él a reseñas de otros (los últimos 100).
    'votes', COALESCE((
      SELECT jsonb_agg(x.fila ORDER BY x.creada DESC, x.id DESC)
      FROM (
        SELECT v.id, v.created_at AS creada,
               jsonb_build_object(
                 'id', v.id,
                 'review_id', v.review_id,
                 'is_helpful', v.is_helpful,
                 'review_title', r.title,
                 'review_rating', r.rating,
                 'review_status', r.status,
                 'business_id', r.business_id,
                 'business_name', b.name,
                 'business_slug', b.slug,
                 'business_country', b.country,
                 'created_at', v.created_at
               ) AS fila
        FROM public.review_votes v
        LEFT JOIN public.reviews r ON r.id = v.review_id
        LEFT JOIN public.businesses b ON b.id = r.business_id
        WHERE v.user_id = p_user_id
        ORDER BY v.created_at DESC, v.id DESC
        LIMIT 100
      ) x
    ), '[]'::jsonb),
    'subscriptions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', s.id,
               'status', s.status,
               'price_id', s.price_id,
               'cancel_at_period_end', s.cancel_at_period_end,
               'created', COALESCE(NULLIF(to_jsonb(s) ->> 'created', ''), to_jsonb(s) ->> 'created_at'),
               'current_period_end', s.current_period_end,
               'trial_end', to_jsonb(s) ->> 'trial_end',
               'canceled_at', to_jsonb(s) ->> 'canceled_at'
             ) ORDER BY COALESCE(NULLIF(to_jsonb(s) ->> 'created', ''), to_jsonb(s) ->> 'created_at') DESC NULLS LAST)
      FROM public.subscriptions s
      WHERE s.user_id = p_user_id
    ), '[]'::jsonb),
    'tickets', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', t.id, 'type', t.type, 'subject', t.subject, 'status', t.status,
                                           'created_at', t.created_at) ORDER BY t.created_at DESC)
      FROM (SELECT * FROM public.support_tickets WHERE user_id = p_user_id ORDER BY created_at DESC LIMIT 20) t
    ), '[]'::jsonb),
    'bugs', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', g.id, 'title', g.title, 'description', left(COALESCE(g.description, ''), 200),
                                           'status', g.status, 'created_at', g.created_at) ORDER BY g.created_at DESC)
      FROM (SELECT * FROM public.bug_reports WHERE user_id = p_user_id ORDER BY created_at DESC LIMIT 20) g
    ), '[]'::jsonb),
    'claims', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', c.id, 'business_id', c.business_id, 'business_name', b.name,
                                           'business_slug', b.slug, 'status', c.status, 'created_at', c.created_at)
                       ORDER BY c.created_at DESC)
      FROM (SELECT * FROM public.claims WHERE user_id = p_user_id ORDER BY created_at DESC LIMIT 20) c
      LEFT JOIN public.businesses b ON b.id = c.business_id
    ), '[]'::jsonb),
    'appeals', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', a.id, 'review_id', a.review_id, 'review_title', r.title,
                                           'status', a.status, 'created_at', a.created_at)
                       ORDER BY a.created_at DESC)
      FROM (SELECT * FROM public.review_appeals WHERE user_id = p_user_id ORDER BY created_at DESC LIMIT 20) a
      LEFT JOIN public.reviews r ON r.id = a.review_id
    ), '[]'::jsonb)
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_user_overview(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_user_overview(uuid) TO authenticated, service_role;

-- Cifras de los usuarios de la página del listado (una sola llamada para los 15 de la página).
CREATE OR REPLACE FUNCTION public.admin_users_stats(p_ids uuid[])
RETURNS TABLE (
  id uuid,
  reviews_count bigint,
  votes_count bigint,
  businesses_count bigint,
  last_sign_in_at timestamptz,
  provider text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Acción solo para administradores.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT p.id,
         (SELECT count(*) FROM public.reviews r WHERE r.user_id = p.id),
         (SELECT count(*) FROM public.review_votes v WHERE v.user_id = p.id),
         (SELECT count(*) FROM public.businesses b WHERE b.owner_id = p.id),
         u.last_sign_in_at,
         u.raw_app_meta_data ->> 'provider'
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE p.id = ANY (COALESCE(p_ids, ARRAY[]::uuid[]))
  LIMIT 200;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_users_stats(uuid[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_users_stats(uuid[]) TO authenticated, service_role;

COMMIT;
