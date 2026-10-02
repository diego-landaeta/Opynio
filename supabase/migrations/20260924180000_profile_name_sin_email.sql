-- =============================================================================
-- El nombre publico de un perfil nuevo no lleva nada con pinta de email. 2026-09-24
--
-- handle_new_user copia tal cual full_name/name de los metadatos del alta. Con
-- Google eso es el nombre que el usuario puso en su cuenta de Google, y hay
-- quien pone ahi su correo: en produccion hay un perfil llamado
-- «<usuario>@<dominio> <apellido>» (el nombre publico de sus resenas). No es un
-- fallo de concatenacion del codigo: el dato viene asi de Google.
--
-- Este trigger, solo en INSERT, quita de `name` los trozos «@loquesea»:
--   «Nombre@dominio Apellido» -> «Nombre Apellido»
--   «pepe@gmail.com»           -> «pepe»
-- y si no queda nada usa el mismo respaldo que handle_new_user ('Nuevo Usuario').
-- Va aparte de handle_new_user para no pisar ese trigger y para cubrir tambien
-- el alta de respaldo que hace AuthContext desde el cliente.
-- En UPDATE no actua: si el propio usuario edita su nombre, se respeta.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.profile_name_sin_email()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
DECLARE
  limpio text;
BEGIN
  limpio := btrim(regexp_replace(regexp_replace(NEW.name, '@[^[:space:]]*', '', 'g'), '[[:space:]]+', ' ', 'g'));
  NEW.name := COALESCE(NULLIF(limpio, ''), 'Nuevo Usuario');
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS profiles_name_sin_email ON public.profiles;
CREATE TRIGGER profiles_name_sin_email
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  WHEN (NEW.name LIKE '%@%')
  EXECUTE FUNCTION public.profile_name_sin_email();

COMMIT;

-- Datos ya existentes (NO se aplica aqui; ejecutar a mano tras revisarlo):
-- UPDATE public.profiles
--    SET name = COALESCE(NULLIF(btrim(regexp_replace(regexp_replace(name, '@[^[:space:]]*', '', 'g'), '[[:space:]]+', ' ', 'g')), ''), 'Nuevo Usuario')
--  WHERE name LIKE '%@%';
