-- get_admin_businesses_paginated es SECURITY DEFINER, no comprueba que quien llama
-- sea admin y era ejecutable por cualquiera con la clave anon (publica): devolvia
-- las empresas con datos de gestion y el perfil del dueno (incluido su rol).
-- Ningun codigo del front ni de las Edge Functions la llama (comprobado con grep el
-- 19-oct-2026), asi que se cierra por completo en vez de añadirle una comprobacion.
-- service_role y postgres conservan el permiso.
--
-- Marcha atras (estado anterior, ACL {=X, anon=X, authenticated=X, service_role=X}):
--   GRANT EXECUTE ON FUNCTION public.get_admin_businesses_paginated(integer, integer, text, text, text, text)
--     TO PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_admin_businesses_paginated(integer, integer, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
