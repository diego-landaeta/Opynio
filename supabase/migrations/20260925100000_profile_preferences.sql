-- =============================================================================
-- Preferencias del usuario en su perfil. 2026-09-25
--
-- Editar perfil tiene ahora una seccion «Preferencias» (idioma, pais y tema).
-- Se aplican al momento en el navegador (las mismas claves de localStorage que
-- los selectores de la home) y se guardan aqui para que, al iniciar sesion en
-- otro dispositivo, la web arranque con ellas (una vez por inicio de sesion:
-- ver hooks/useProfilePreferencesSync.ts).
--
-- Qué hace: tres columnas NULLABLE en public.profiles, sin default (NULL = «sin
-- preferencia guardada», que es lo que tienen todas las cuentas de hoy), con un
-- CHECK de formato cada una:
--   preferred_language  codigo interno de locale ('es', 'en', 'gb', 'br'...):
--                       dos letras minusculas. No se fija la lista de los 31:
--                       anadir un idioma (docs/playbooks/add-language.md) no
--                       debe exigir otra migracion. El front descarta un valor
--                       que no sea un idioma cableado (isSupportedLanguage).
--   preferred_country   codigo ISO del pais de busqueda ('ES', 'GB'...): dos
--                       letras mayusculas. El front solo aplica los de COUNTRIES.
--   theme               'light' | 'dark' | 'system'.
--
-- RLS y guardas (revisado en local y en opynio_prodlike el 25/09):
--   - UPDATE: "Users can update own profile" (USING auth.uid() = id) y "Admins
--     can update any profile". No se tocan: el usuario solo cambia su fila.
--   - guard_profile_sensitive_columns y guard_profile_extra_columns son listas
--     de columnas PROHIBIDAS (role, plan, billing_cycle, creditos,
--     helpful_review_count, created_at, reviews_count...). Las columnas nuevas
--     no estan en ellas, a proposito: son del usuario. role/plan siguen igual
--     de protegidos (probado: un UPDATE que cambia theme y role a la vez falla)
--     SIEMPRE QUE 3.4 (20260923120000_fix_security_guards) este aplicada: en
--     la copia pristina de prod el guard es SECURITY DEFINER y no para ni ese
--     UPDATE ni uno de role solo. Es un fallo previo que arregla 3.4, no esta
--     migracion, que va despues en orden de fichero.
--   - Grants: los de tabla que ya hay cubren las columnas nuevas; no se anade
--     ninguno.
--   - OJO, lectura: los perfiles son publicos ("Profiles are viewable by
--     everyone.", USING (true)), asi que estas tres columnas se pueden leer con
--     la anon key, como ya pasa con plan, role o avatar_url. Son datos de poca
--     sensibilidad (idioma, pais de busqueda y tema), pero si se quisiera
--     ocultarlos habria que llevarlos a una tabla aparte con RLS propia: un
--     REVOKE por columna rompe los select('*') de profiles.
--
-- Bloqueo: ADD COLUMN sin default es solo catalogo; los CHECK recorren la tabla
-- (pocos miles de filas, todas NULL): milisegundos. lock_timeout de 5 s para
-- no quedarse esperando detras de una transaccion larga (si salta, repetir).
-- Idempotente: se puede aplicar dos veces.
--
-- Compatibilidad: el front actual no lee ni escribe estas columnas
-- (select('*') las recibe y las ignora). El front nuevo las necesita para
-- GUARDAR preferencias; sin la migracion, se aplican solo en ese navegador y
-- se avisa de que no se pudieron guardar en la cuenta.
--
-- Rollback (pierde las preferencias guardadas; el front nuevo lo tolera):
--   ALTER TABLE public.profiles
--     DROP COLUMN IF EXISTS preferred_language,
--     DROP COLUMN IF EXISTS preferred_country,
--     DROP COLUMN IF EXISTS theme;
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_language text,
  ADD COLUMN IF NOT EXISTS preferred_country  text,
  ADD COLUMN IF NOT EXISTS theme              text;

COMMENT ON COLUMN public.profiles.preferred_language IS
  'Idioma de la interfaz elegido por el usuario (codigo de locale: es, en, gb, br...). NULL = sin preferencia.';
COMMENT ON COLUMN public.profiles.preferred_country IS
  'Pais de busqueda elegido por el usuario (ISO, mayusculas). NULL = sin preferencia.';
COMMENT ON COLUMN public.profiles.theme IS
  'Tema elegido: light, dark o system. NULL = sin preferencia (el navegador decide).';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.profiles'::regclass
                   AND conname = 'profiles_preferred_language_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_preferred_language_check
      CHECK (preferred_language IS NULL OR preferred_language ~ '^[a-z]{2}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.profiles'::regclass
                   AND conname = 'profiles_preferred_country_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_preferred_country_check
      CHECK (preferred_country IS NULL OR preferred_country ~ '^[A-Z]{2}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.profiles'::regclass
                   AND conname = 'profiles_theme_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_theme_check
      CHECK (theme IS NULL OR theme IN ('light', 'dark', 'system'));
  END IF;
END $$;

-- Comprobacion: 3 columnas y 3 CHECK validados. Si no, aborta (y el BEGIN
-- deshace todo).
DO $$
DECLARE
  n_cols int;
  n_checks int;
BEGIN
  SELECT count(*) INTO n_cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'profiles'
     AND column_name IN ('preferred_language', 'preferred_country', 'theme');
  SELECT count(*) INTO n_checks
    FROM pg_constraint
   WHERE conrelid = 'public.profiles'::regclass AND contype = 'c' AND convalidated
     AND conname IN ('profiles_preferred_language_check',
                     'profiles_preferred_country_check',
                     'profiles_theme_check');
  IF n_cols <> 3 OR n_checks <> 3 THEN
    RAISE EXCEPTION 'profile_preferences: esperaba 3 columnas y 3 CHECK, hay % y %', n_cols, n_checks;
  END IF;
END $$;

COMMIT;

-- Verificacion (tras aplicar):
--   SELECT count(*) FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='profiles'
--      AND column_name IN ('preferred_language','preferred_country','theme');   -- 3
