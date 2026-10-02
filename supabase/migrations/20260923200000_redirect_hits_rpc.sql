-- =============================================================================
-- Contador de visitas de las redirecciones de slug. 2026-09-23
--
-- El frontend llama a increment_redirect_hits(slug_param), que no existia en
-- ningun SQL del repo. supabase.rpc() no lanza excepcion cuando falla (devuelve
-- { error }), asi que el "fallback" de UPDATE directo nunca se ejecutaba, y
-- ademas un visitante anonimo no tiene permiso de UPDATE en url_redirects:
-- `hits` se quedaba siempre en 0.
-- =============================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.increment_redirect_hits(slug_param text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.url_redirects
  SET hits = COALESCE(hits, 0) + 1
  WHERE old_slug = lower(slug_param);
$$;

GRANT EXECUTE ON FUNCTION public.increment_redirect_hits(text) TO anon, authenticated, service_role;

COMMIT;
