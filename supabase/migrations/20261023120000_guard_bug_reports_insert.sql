-- =============================================================================
-- bug_reports: lo que crea un usuario entra siempre abierto y sin campos de
-- resolucion.
--
-- 20260923120000_fix_security_guards.sql (seccion 4) ya hace esto con claims,
-- business_claims y review_appeals, pero dejo fuera bug_reports. La policy
-- «Users can create bug reports» solo comprueba user_id, asi que un usuario
-- normal podia insertar su reporte con status = 'resolved' (o 'closed'),
-- admin_notes inventadas y resolved_at: el reporte no aparecia en «Abiertos» y
-- llevaba «notas del administrador» falsas. Verificado en el esquema de prod
-- + migraciones (opynio_prodlike): `INSERT ... status='resolved',
-- admin_notes='hack'` quedaba guardado tal cual.
--
-- No se reutiliza guard_request_status_on_insert(): fuerza status = 'pending' y
-- el CHECK de bug_reports solo admite open / in_progress / resolved / closed.
--
-- Bypass: postgres / supabase_admin / service_role (SQL Editor, Edge Functions)
-- y los administradores (el panel de admin no inserta bugs, pero no se les
-- limita). El formulario de soporte manda status = 'open' y no manda
-- admin_notes ni resolved_at: para un usuario legitimo no cambia nada.
-- jsonb_populate_record: mismo patron que las demas guardas; tolera que una
-- base no tenga alguna de las columnas.
--
-- Idempotente. Solo fichero: aplicarlo a mano en cada entorno.
-- =============================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.guard_bug_report_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  caller_role public.user_role;
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role = 'admin'::public.user_role THEN
    RETURN NEW;
  END IF;

  NEW := jsonb_populate_record(NEW, jsonb_build_object(
    'status', 'open',
    'admin_notes', NULL,
    'resolved_at', NULL
  ));
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_bug_reports_insert ON public.bug_reports;
CREATE TRIGGER trg_guard_bug_reports_insert
  BEFORE INSERT ON public.bug_reports
  FOR EACH ROW EXECUTE FUNCTION public.guard_bug_report_insert();

COMMIT;
