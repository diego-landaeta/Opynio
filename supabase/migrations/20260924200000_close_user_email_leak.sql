-- =============================================================================
-- Cerrar la fuga de emails por RPC. 2026-09-24
--
-- Es la misma corrección que scripts/_datos-prod/00-hotfix-fuga-emails.sql
-- (paso 0-bis del runbook, que se pega en producción antes que nada). Aquí
-- queda en el repo para que cualquier base nueva o restaurada salga igual.
-- Si el hotfix ya se aplicó, esta migración no cambia nada (idempotente).
--
-- Problema (leído en producción el 24/09, solo SELECT):
--   public.search_assignable_users(text) y
--   public.get_admin_users_paginated(integer, integer, text, text)
--   son SECURITY DEFINER (dueño postgres), sin search_path, no comprueban que
--   quien llama sea admin, hacen JOIN con auth.users y devuelven u.email, y
--   tienen EXECUTE para PUBLIC, anon y authenticated: con la anon key del bundle
--   cualquiera lista los emails de todas las cuentas. Nadie legítimo las llama:
--   ni el front de producción ni el de esta rama (usa admin_list_users,
--   20260923190000), ni las Edge Functions, ni otras funciones, ni pg_cron.
--   public.refresh_business_metrics() tiene el mismo patrón con escritura
--   (REFRESH MATERIALIZED VIEW CONCURRENTLY sin comprobar identidad: carga
--   gratuita). 20260923160000_security_extras ya le quita anon/authenticated;
--   se repite aquí para que esta migración deje lo mismo que el hotfix.
--
-- Qué hace: quita EXECUTE a PUBLIC, anon y authenticated en las tres y
-- asegura el de service_role (postgres, dueño, lo conserva siempre). No toca
-- definiciones ni datos. Si una función no existe (p. ej. en la base local,
-- que no tiene las dos de la fuga), la salta con un NOTICE. Al final comprueba
-- el resultado y aborta (sin dejar nada a medias) si anon o authenticated
-- siguieran pudiendo ejecutarla.
--
-- Revisadas y fuera (ver la cabecera del hotfix para el detalle):
-- get_admin_businesses_paginated (sin comprobar admin, pero solo devuelve lo
-- que anon ya lee por RLS) y get_business_analytics (su comprobación deja
-- pasar a anon, pero solo devuelve agregados de reseñas aprobadas).
--
-- Rollback (reabre la fuga; ACL exacta de producción el 24/09):
--   GRANT EXECUTE ON FUNCTION public.search_assignable_users(text)                         TO PUBLIC, anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.get_admin_users_paginated(integer, integer, text, text) TO PUBLIC, anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.refresh_business_metrics()                            TO PUBLIC, anon, authenticated;
-- =============================================================================

BEGIN;

DO $$
DECLARE
  f text;
  p regprocedure;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.search_assignable_users(text)',
    'public.get_admin_users_paginated(integer,integer,text,text)',
    'public.refresh_business_metrics()'
  ] LOOP
    p := to_regprocedure(f);
    IF p IS NULL THEN
      RAISE NOTICE 'close_user_email_leak: % no existe en esta base; nada que hacer.', f;
      CONTINUE;
    END IF;

    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', p);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', p);

    IF has_function_privilege('anon', p, 'EXECUTE')
       OR has_function_privilege('authenticated', p, 'EXECUTE') THEN
      RAISE EXCEPTION 'close_user_email_leak: % sigue siendo ejecutable por anon/authenticated (¿un rol hereda el permiso de otro?).', f;
    END IF;
  END LOOP;
END $$;

COMMIT;

-- Verificación:
--   SELECT f, has_function_privilege('anon', to_regprocedure(f), 'EXECUTE')          AS anon,           -- false
--             has_function_privilege('authenticated', to_regprocedure(f), 'EXECUTE') AS authenticated,  -- false
--             has_function_privilege('service_role', to_regprocedure(f), 'EXECUTE')  AS service_role    -- true
--   FROM unnest(ARRAY['public.search_assignable_users(text)',
--                     'public.get_admin_users_paginated(integer,integer,text,text)',
--                     'public.refresh_business_metrics()']) f
--   WHERE to_regprocedure(f) IS NOT NULL;
