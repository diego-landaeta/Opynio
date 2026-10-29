-- Tareas programadas que llaman a Edge Functions. 2026-10-27
--
-- Estado antes: pg_net NO estaba instalado, asi que toda tarea de pg_cron que llama a una funcion fallaba con
-- «schema "net" does not exist» (la #1 monthly_rescrape: 12 intentos desde 2025-11-01, ninguno bien; la #5 y la #6: 243,
-- ninguno bien). Ademas la #1 leia su secreto de secrets.get('CRON_SECRET'), un esquema que no existe.
--
-- Que hace esta migracion:
--   1. Instala pg_net (esquema net).
--   2. Genera DENTRO de la base de datos un secreto aleatorio y lo guarda en Supabase Vault con el nombre 'cron_secret'.
--      No sale de la base de datos salvo hacia las funciones que lo piden con public.cron_secret() (solo service_role).
--      Las funciones trial-ending-reminder y monthly-rescrape-job aceptan ese secreto ademas de su CRON_SECRET del entorno
--      (supabase/functions/_shared/cronAuth.ts).
--   3. Arregla la tarea #1 (monthly_rescrape): ahora lee el secreto de Vault. Por defecto no procesa ninguna empresa
--      mientras no haya alguna con is_selected_for_monthly_scrape = true (hoy 0).
--   4. Crea la tarea diaria trial-ending-reminder-daily (09:00 UTC): aviso por correo 7 dias antes de acabar la prueba.
--
-- NO toca las tareas #2 (approve_pending_reviews_hourly), #4 (monthly_ai_credit_reset), #5 (auto-migrate-slugs-daily) ni
-- #6 (ping-sitemap-after-migration). Con pg_net instalado la #5 llamara a su funcion SIN cabecera de autorizacion y esa
-- funcion exige JWT: el gateway la rechazara con 401 y no se ejecutara. La #6 hara su GET a Google (el ping de sitemaps
-- de Google esta retirado, sin efecto).
--
-- VUELTA ATRAS:
--   SELECT cron.unschedule('trial-ending-reminder-daily');
--   SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'monthly_rescrape'),
--     command := $$ SELECT net.http_post(url := 'https://hvtrrhxeqrsnjxhngdsj.supabase.co/functions/v1/monthly-rescrape-job', headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secrets.get('CRON_SECRET')), body := '{}'::jsonb, timeout_milliseconds := 540000) $$);
--   DROP FUNCTION public.cron_secret();
--   DELETE FROM vault.secrets WHERE name = 'cron_secret';
--   DROP EXTENSION pg_net;   -- las tareas #1, #5 y #6 vuelven a fallar como antes

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_net;

-- Secreto de las tareas, generado aqui mismo (dos UUID aleatorios sin guiones = 64 hex). Solo si no existe ya.
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'cron_secret') THEN
    PERFORM vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'cron_secret',
      'Secreto de las tareas programadas (pg_cron) que llaman a Edge Functions'
    );
  END IF;
END
$do$;

-- Lo lee la funcion de borde (service_role) para comparar con la cabecera Authorization de la tarea.
CREATE OR REPLACE FUNCTION public.cron_secret()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1;
$fn$;

REVOKE ALL ON FUNCTION public.cron_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cron_secret() TO service_role;

-- Tarea #1: rescrape mensual de resenas de Google (dia 1 a las 00:00).
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'monthly_rescrape'),
  command := $cmd$
    SELECT net.http_post(
      url := 'https://hvtrrhxeqrsnjxhngdsj.supabase.co/functions/v1/monthly-rescrape-job',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1)
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 540000
    );
  $cmd$
);

-- Tarea nueva: aviso de fin de prueba, una pasada diaria a las 09:00 UTC (la funcion es idempotente: trial_reminders).
SELECT cron.schedule(
  'trial-ending-reminder-daily',
  '0 9 * * *',
  $cmd$
    SELECT net.http_post(
      url := 'https://hvtrrhxeqrsnjxhngdsj.supabase.co/functions/v1/trial-ending-reminder',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1)
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 300000
    );
  $cmd$
);

COMMIT;
