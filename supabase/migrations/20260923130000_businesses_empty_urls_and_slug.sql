-- =============================================================================
-- businesses: cadenas vacias en columnas UNIQUE y empresas sin slug
-- 2026-09-23
--
-- 1. Los formularios (alta en /asignar-empresa, editar perfil de empresa,
--    crear/editar empresa en admin) mandan google_maps_url = '' cuando el campo
--    esta vacio. La columna es UNIQUE: la primera empresa guarda '' y TODAS las
--    demas reciben 409 (23505) al crear o guardar sin URL de Maps. Reproducido
--    en local con Playwright en "Editar perfil de empresa".
--    Se normaliza en BD para no depender de que cada formulario lo haga bien.
--
-- 2. Las empresas creadas por upgrade_user_to_business_owner,
--    process_checkout_completion y el alta del asistente quedan con slug NULL
--    (el slug solo lo generaba el navegador en userCreateBusiness y
--    updateUserRole). Se genera aqui en cualquier INSERT sin slug, con la misma
--    forma que utils/slugify.ts: minusculas, sin acentos, [a-z0-9_] y sufijo
--    _2, _3... si ya existe.
--
-- No toca slugs existentes ni rellena los NULL antiguos: cambiar la URL
-- canonica de empresas ya publicadas es una decision aparte.
--
-- 24/09/2026: el trigger ya no recorta en un UPDATE valores que la sentencia
-- no esta cambiando (antes, cualquier UPDATE de una empresa habria recortado
-- un slug con espacios y cambiado su URL). En un UPDATE solo toca lo que se
-- edita y las cadenas vacias. Los unicos datos que cambia la migracion son
-- cadenas vacias -> NULL (en prod el 24/09: 29 google_maps_url y 1 slug).
-- No toca url_redirects.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.opynio_slugify(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT btrim(
    regexp_replace(
      regexp_replace(
        -- Puntos y comillas se eliminan (no se convierten en _), como en JS:
        -- "Servicios S.A." -> servicios_sa, "O'Brien" -> obrien.
        regexp_replace(
          translate(
            lower(coalesce(p_text, '')),
            'áàäâãåéèëêíìïîóòöôõúùüûñçýÿ',
            'aaaaaaeeeeiiiiooooouuuuncyy'
          ),
          '[.''"`´]', '', 'g'
        ),
        '[^a-z0-9]+', '_', 'g'
      ),
      '_+', '_', 'g'
    ),
    '_'
  );
$function$;

CREATE OR REPLACE FUNCTION public.normalize_business_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  base_slug text;
  candidate text;
  n int := 2;
BEGIN
  -- NUNCA se modifica un valor ya guardado (regla: no cambiar URLs de empresas
  -- existentes). En un UPDATE solo se normaliza:
  --   - el valor que la propia sentencia esta cambiando (se recorta), y
  --   - la cadena vacia o de solo espacios, que pasa a NULL.
  -- Un slug existente que no se esta editando se queda EXACTAMENTE igual,
  -- aunque tuviera espacios o mayusculas.
  IF TG_OP = 'INSERT' OR NEW.google_maps_url IS DISTINCT FROM OLD.google_maps_url THEN
    NEW.google_maps_url := NULLIF(btrim(NEW.google_maps_url), '');
  ELSIF btrim(NEW.google_maps_url) = '' THEN
    NEW.google_maps_url := NULL;
  END IF;

  IF TG_OP = 'INSERT' OR NEW.slug IS DISTINCT FROM OLD.slug THEN
    NEW.slug := NULLIF(btrim(NEW.slug), '');
  ELSIF btrim(NEW.slug) = '' THEN
    NEW.slug := NULL;
  END IF;

  IF TG_OP = 'INSERT' OR NEW.logo_url IS DISTINCT FROM OLD.logo_url THEN
    NEW.logo_url := NULLIF(btrim(NEW.logo_url), '');
  ELSIF btrim(NEW.logo_url) = '' THEN
    NEW.logo_url := NULL;
  END IF;

  -- Solo en altas nuevas sin slug. Las empresas que ya existen sin slug no se
  -- tocan aqui (darles uno cambia su URL canonica: decision aparte, 7.1 del runbook).
  IF TG_OP = 'INSERT' AND NEW.slug IS NULL THEN
    base_slug := public.opynio_slugify(NEW.name);
    IF base_slug = '' THEN
      base_slug := 'empresa';
    END IF;
    candidate := base_slug;
    -- SECURITY DEFINER: la comprobacion ve todas las empresas, no solo las
    -- que la RLS del usuario le deja ver.
    WHILE EXISTS (SELECT 1 FROM public.businesses WHERE slug = candidate) LOOP
      candidate := base_slug || '_' || n;
      n := n + 1;
    END LOOP;
    NEW.slug := candidate;
  END IF;

  RETURN NEW;
END;
$function$;

-- El nombre empieza por "a_" para que corra antes que los guards (los
-- triggers BEFORE del mismo evento se ejecutan en orden alfabetico).
DROP TRIGGER IF EXISTS a_normalize_business_fields ON public.businesses;
CREATE TRIGGER a_normalize_business_fields
  BEFORE INSERT OR UPDATE ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_business_fields();

-- Limpieza de las filas que ya guardaron cadena vacia. Sin esto, la empresa
-- que tiene '' seguiria chocando con la siguiente que intente guardar ''.
-- (El trigger ya las pasa a NULL al tocarlas, pero hay que tocarlas.)
UPDATE public.businesses SET google_maps_url = NULL WHERE btrim(google_maps_url) = '';
UPDATE public.businesses SET slug = NULL WHERE btrim(slug) = '';
UPDATE public.businesses SET logo_url = NULL WHERE btrim(logo_url) = '';

COMMIT;
