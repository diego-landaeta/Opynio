-- =============================================================================
-- Dos RPC de admin rotas (hoy sin uso en el frontend). 2026-09-23
-- Se arreglan en vez de borrarlas: no cuesta nada y no rompen si algo las llama.
--
-- admin_update_user_role: al dar el rol de dueno insertaba la empresa sin
-- `category` (NOT NULL) y fallaba siempre (23502).
--
-- resolve_review_appeal (en la base local): el tipo del id no coincidia con el
-- de la tabla (22P02) y escribia resolved_by, que alli no existe. Aprobar la
-- apelacion debe rehabilitar la resena.
--
-- 24/09/2026 (bloqueo B3 del runbook docs/DESPLIEGUE-2026-09.md): en
-- PRODUCCION review_appeals.id y review_id son BIGINT y SI existe resolved_by;
-- en la base local son UUID y no existe. La primera version pasaba la funcion a
-- uuid y borraba la de bigint: en prod habria dejado una funcion que falla
-- siempre. Ahora:
--   - p_appeal_id y la variable del review_id usan review_appeals.id%TYPE /
--     review_id%TYPE (bigint en prod, uuid en local);
--   - solo se borra la sobrecarga cuyo tipo NO coincide con review_appeals.id
--     (en prod no se borra nada: CREATE OR REPLACE reescribe la de bigint);
--   - resolved_by se rellena solo si la columna existe.
--
-- Categoria por defecto: "Sectores Emergentes y Otros", que existe en los 31
-- locales. "General" no es una categoria y se veia cruda.
-- =============================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.admin_update_user_role(
  target_user_id uuid, new_role public.user_role, business_name_to_set text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  caller_role public.user_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado.';
  END IF;
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role IS DISTINCT FROM 'admin'::public.user_role THEN
    RAISE EXCEPTION 'Permiso denegado: Debes ser un administrador para cambiar roles de usuario.';
  END IF;

  UPDATE public.profiles SET role = new_role WHERE id = target_user_id;

  IF new_role = 'business_owner' THEN
    IF business_name_to_set IS NULL OR trim(business_name_to_set) = '' THEN
      RAISE EXCEPTION 'El nombre del negocio es obligatorio al asignar el rol de propietario.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.businesses WHERE name = business_name_to_set) THEN
      RAISE EXCEPTION 'El nombre de negocio "%" ya está en uso.', business_name_to_set;
    END IF;
    INSERT INTO public.businesses (owner_id, name, category)
    VALUES (target_user_id, business_name_to_set, 'Sectores Emergentes y Otros');
  END IF;
END;
$function$;

-- Solo la sobrecarga con un tipo distinto del de review_appeals.id (la que no
-- puede funcionar nunca). En produccion no hay ninguna.
DO $do$
DECLARE
  v_tipo oid;
  r record;
BEGIN
  SELECT a.atttypid INTO v_tipo
  FROM pg_attribute a
  WHERE a.attrelid = 'public.review_appeals'::regclass AND a.attname = 'id' AND NOT a.attisdropped;

  FOR r IN
    SELECT p.oid::regprocedure AS firma
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname = 'resolve_review_appeal'
      AND p.proargtypes[0] <> v_tipo
  LOOP
    RAISE NOTICE 'Se borra %: su id no es del tipo de review_appeals.id', r.firma;
    EXECUTE 'DROP FUNCTION ' || r.firma;
  END LOOP;
END
$do$;

CREATE OR REPLACE FUNCTION public.resolve_review_appeal(
  p_appeal_id public.review_appeals.id%TYPE, p_new_status text, p_admin_notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_review_id public.review_appeals.review_id%TYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acción solo para administradores.';
  END IF;
  IF p_new_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Estado no válido: %', p_new_status;
  END IF;

  UPDATE public.review_appeals
  SET status = p_new_status, admin_notes = p_admin_notes, resolved_at = now()
  WHERE id = p_appeal_id
  RETURNING review_id INTO v_review_id;

  IF v_review_id IS NULL THEN
    RAISE EXCEPTION 'Apelación no encontrada.';
  END IF;

  -- resolved_by existe en produccion y no en la base local. SQL dinamico para
  -- que la funcion compile y funcione en las dos.
  IF EXISTS (SELECT 1 FROM pg_attribute
             WHERE attrelid = 'public.review_appeals'::regclass
               AND attname = 'resolved_by' AND NOT attisdropped) THEN
    EXECUTE 'UPDATE public.review_appeals SET resolved_by = $1 WHERE id = $2'
      USING auth.uid(), p_appeal_id;
  END IF;

  IF p_new_status = 'approved' THEN
    UPDATE public.reviews
    SET status = 'approved', rejection_reason = NULL, published_at = now()
    WHERE id = v_review_id;
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.resolve_review_appeal(public.review_appeals.id%TYPE, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.resolve_review_appeal(public.review_appeals.id%TYPE, text, text) TO authenticated, service_role;

COMMIT;
