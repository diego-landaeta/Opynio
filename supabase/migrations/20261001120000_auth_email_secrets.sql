-- Secretos de send-auth-email (hook "Send Email" de Auth) guardados en Supabase Vault.
-- Los valores NO van aquí: se crean aparte con
--   select vault.create_secret('<clave>', 'brevo_api_key');
--   select vault.create_secret('v1,whsec_...', 'send_email_hook_secret');
-- La función los lee con su service_role (variables de entorno BREVO_API_KEY y
-- SEND_EMAIL_HOOK_SECRET, si existen, tienen prioridad).
CREATE OR REPLACE FUNCTION public.auth_email_secrets()
RETURNS TABLE (brevo_api_key text, send_email_hook_secret text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'brevo_api_key' LIMIT 1),
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'send_email_hook_secret' LIMIT 1);
$$;

REVOKE ALL ON FUNCTION public.auth_email_secrets() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_email_secrets() TO service_role;
