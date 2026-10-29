-- reset_monthly_ai_credits: el cron «monthly_ai_credit_reset» (job 4, a diario 03:00) fallaba cada
-- noche con «column "ai_credits_last_reset" does not exist» porque actualizaba public.businesses,
-- y esas columnas viven en public.profiles (ahí las lee el panel de facturación y ahí las reinicia
-- ya el consumo de créditos cuando pasa un mes).
--
-- Ahora reinicia los perfiles cuyo último reinicio fue hace más de un mes: el mismo criterio que el
-- reinicio al consumir, así que no cambia ningún límite ni cobra nada. En producción hoy ningún
-- perfil tiene créditos usados, de modo que la primera ejecución no modifica ningún dato visible.
-- El cron corre como postgres, que el guard de columnas protegidas de profiles deja pasar.
--
-- VUELTA ATRAS: restaurar la definición anterior (rota) con
--   CREATE OR REPLACE FUNCTION public.reset_monthly_ai_credits() RETURNS void LANGUAGE plpgsql AS $f$
--   BEGIN UPDATE public.businesses SET ai_credits_used = 0, ai_credits_last_reset = now()
--   WHERE ai_credits_last_reset <= now() - interval '1 month'; END; $f$;

CREATE OR REPLACE FUNCTION public.reset_monthly_ai_credits()
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  UPDATE public.profiles
  SET ai_credits_used = 0,
      ai_credits_last_reset = timezone('utc'::text, now())
  WHERE ai_credits_last_reset <= timezone('utc'::text, now()) - interval '1 month';
END;
$function$;
