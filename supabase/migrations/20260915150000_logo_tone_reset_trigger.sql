-- Invalida logo_tone cuando cambia logo_url.
--
-- El tono describe una imagen concreta. Si la ficha pasa a apuntar a otra imagen, el
-- tono anterior deja de valer y aplicarlo podria dejar el logo nuevo PEOR que con el
-- fondo por defecto (un logo oscuro sobre chip oscuro, por ejemplo).
--
-- Se hace con un trigger y no en cada pantalla porque logo_url se escribe desde muchos
-- sitios: el panel del dueno, dos pantallas de admin, la edicion masiva y varias Edge
-- Functions de scraping. Aqui no se puede olvidar ninguna.
--
-- Poner logo_tone a NULL es seguro: la UI vuelve al fondo por defecto, que es como se
-- comportaba todo antes de existir esta columna. El re-calculo se hace luego en lote.

CREATE OR REPLACE FUNCTION public.reset_logo_tone_on_logo_change()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    -- Un proceso que escribe logo_url y logo_tone A LA VEZ (el backfill) avisa con
    -- una variable de sesion y el trigger no toca nada.
    --
    -- Antes esto se adivinaba comparando NEW.logo_tone contra OLD.logo_tone, y esa
    -- heuristica falla justo donde importa: solo hay dos tonos posibles, asi que un
    -- backfill que remide un logo NUEVO y obtiene el MISMO tono que tenia el viejo
    -- veia su valor —recien medido y correcto— puesto a NULL. Pasaba la mitad de las
    -- veces, en silencio.
    IF coalesce(current_setting('opynio.keep_logo_tone', true), '') = 'on' THEN
        RETURN NEW;
    END IF;

    -- IS DISTINCT FROM para que NULL -> url y url -> NULL tambien cuenten como cambio.
    IF NEW.logo_url IS DISTINCT FROM OLD.logo_url THEN
        NEW.logo_tone := NULL;
    END IF;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_reset_logo_tone ON public.businesses;

CREATE TRIGGER trg_reset_logo_tone
    BEFORE UPDATE OF logo_url ON public.businesses
    FOR EACH ROW
    EXECUTE FUNCTION public.reset_logo_tone_on_logo_change();

COMMENT ON FUNCTION public.reset_logo_tone_on_logo_change() IS
  'Pone businesses.logo_tone a NULL cuando cambia logo_url. Un backfill que escriba tono y url a la vez debe hacer antes: SET LOCAL opynio.keep_logo_tone = ''on'';';

-- COMO REESCRIBIR LOGO Y TONO A LA VEZ (backfill):
--
--   BEGIN;
--     SET LOCAL opynio.keep_logo_tone = 'on';
--     UPDATE businesses SET logo_url = $1, logo_tone = $2 WHERE id = $3;
--   COMMIT;
--
-- Sin esa linea, el tono se pondria a NULL aunque lo acabes de medir.
