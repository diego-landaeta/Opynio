-- =============================================================================
-- Listado de usuarios del panel de admin. 2026-09-23
--
-- /admin/usuarios ignoraba la busqueda y el filtro de rol (la funcion del
-- servicio no leia su tercer argumento) y el email salia siempre
-- "No disponible": profiles no tiene email, vive en auth.users, que solo se
-- lee desde el servidor.
--
-- Esta RPC pagina, busca (nombre, username o email) y filtra por rol, y
-- devuelve el email. Solo la puede usar un admin: lo comprueba dentro, asi que
-- aunque la llame cualquier usuario autenticado no filtra ningun email.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_search text DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  name text,
  username text,
  email text,
  role text,
  plan text,
  avatar_url text,
  created_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_search text := NULLIF(btrim(p_search), '');
  v_role text := NULLIF(NULLIF(btrim(p_role), ''), 'all');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin') THEN
    RAISE EXCEPTION 'Acción solo para administradores.';
  END IF;

  RETURN QUERY
  SELECT p.id, p.name, p.username, u.email::text, p.role::text, p.plan, p.avatar_url, p.created_at,
         count(*) OVER () AS total_count
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE (v_role IS NULL OR p.role::text = v_role)
    AND (v_search IS NULL
         OR p.name ILIKE '%' || v_search || '%'
         OR p.username ILIKE '%' || v_search || '%'
         OR u.email ILIKE '%' || v_search || '%')
  ORDER BY p.created_at DESC, p.id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 200)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_list_users(text, text, int, int) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text, text, int, int) TO authenticated, service_role;

COMMIT;
