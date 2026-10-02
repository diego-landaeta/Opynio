-- =============================================================================
-- Directorio de empresas (/es/empresas): orden por relevancia en el servidor.
-- 2026-09-24
--
-- Antes el directorio pedía las empresas a PostgREST ordenadas por nombre, por
-- grupos (las del país y detrás las internacionales de fuera) y paginaba por
-- rango; «Mejor valoradas» y «Más reseñas» solo reordenaban la página ya
-- cargada, y con búsqueda o filtro de valoración se traían TODAS las filas al
-- navegador (topadas en 1000 por PostgREST: con 1.019 empresas en producción
-- las últimas por orden alfabético no salían nunca en una búsqueda).
--
-- directory_businesses() devuelve una página ya filtrada y ordenada, con su
-- número de reseñas, su media y el total (count(*) OVER ()), así que la
-- paginación es correcta con cualquier número de empresas y el contador sale
-- de la misma consulta que el listado.
--
-- QUÉ EMPRESAS SALEN (idéntico a lo que hacía el front, NO cambia):
--   Con país (p_country, el de la URL / cabecera):
--     «del país»           = country = país, o con una sede en él.
--     «internacionales de fuera» = de otro país, offers_international_services
--                            y sin sede en el país.
--     all           -> del país + internacionales de fuera
--     local         -> del país que NO ofrecen servicio internacional
--     international -> del país que lo ofrecen + internacionales de fuera
--   Sin país («Todos los países»): todas / solo no internacionales / solo
--   internacionales. Más categoría (prefijo, ILIKE), búsqueda sin acentos en
--   nombre o descripción y rango de valoración media (redondeada a 1 decimal,
--   0 si no hay reseñas), como antes.
--
-- ORDEN (p_sort):
--   Con búsqueda, primero las que EMPIEZAN por el término, luego las que lo
--   contienen en el nombre y al final las que solo lo tienen en la descripción
--   (como antes). Después:
--
--   relevance (por defecto) — grupos por afinidad con el usuario:
--     0. del país de búsqueda del usuario (o con sede en él): p_country si
--        el ámbito es un país; p_home_country con «Todos los países».
--     1. de un país que habla el idioma de la interfaz (p_language_countries,
--        lo calcula el front con getLanguageForCountryCode: con español MX, AR,
--        CO...; con inglés US, GB, IE, AU...).
--     2. el resto.
--     Dentro de cada grupo, primero las que tienen reseñas y después por
--     puntuación (0-100):
--       n      = reseñas aprobadas con created_at <= now() (las mismas que
--                cuentan review_stats_batch y la tarjeta)
--       bayes  = (3,5 * 10 + suma de estrellas) / (10 + n)
--                media bayesiana: 10 reseñas «virtuales» de 3,5*. 1 reseña de
--                5* -> 3,64; 200 de 4,6* -> 4,55; 20 de 4,9* -> 4,43.
--       score  = 50 * (bayes - 1) / 4                         calidad
--              + 25 * min(1, ln(1 + n) / ln(501))              volumen (satura en 500)
--              + 10 * exp(-días desde la última reseña / 90)   actividad reciente
--              +  5 si está reclamada (owner_id)
--              +  5 si su dueño tiene un plan de pago vigente
--                   (profiles.plan <> 'free' y plan_expires_at nulo o futuro)
--              + 2,5 si tiene logo + 2,5 si la descripción tiene >= 80 caracteres
--       Sin reseñas los tres primeros términos valen 0 (y van al final del
--       grupo de todas formas). Los días se cuentan por fecha UTC, así que la
--       puntuación no cambia entre dos páginas pedidas el mismo día.
--   alphabetical — nombre.
--   rating       — media real desc, luego nº de reseñas; sin reseñas al final.
--   reviews      — nº de reseñas desc, luego media.
--   En estos tres, con país, primero las del país y luego las de fuera (como
--   antes); con «Todos los países», sin grupos: es un orden pedido a mano.
--   Desempate final SIEMPRE por id: orden total y estable, la paginación no
--   repite ni se salta empresas.
--
-- SEGURIDAD: SECURITY DEFINER con search_path vacío (todo va cualificado).
-- Devuelve solo columnas públicas de businesses (las mismas que ya pedía el
-- directorio) y agregados de reseñas APROBADAS. El plan del dueño solo pesa en
-- el orden; ni el plan, ni owner_id, ni la puntuación salen en el resultado.
-- p_limit se limita a 100 por llamada.
--
-- Probada en local y en opynio_prodlike (country varchar(2) nullable, lat/lng
-- double precision; en local son text / numeric: se castea todo).
-- Rendimiento: el cuerpo, ejecutado en SOLO LECTURA contra producción (1.019
-- empresas, 49.950 reseñas), tarda 60-75 ms en caliente, con o sin búsqueda.
-- Todo es lineal (hash join, sin nested loops sobre tablas); el grueso es
-- agregar las reseñas, que con idx_reviews_approved_stats (abajo) se lee del
-- índice: en una copia con el volumen de producción, 314 páginas leídas en
-- frío en vez de 12.311 y 30 ms en caliente.
-- Idempotente.
--
-- Rollback:
--   DROP INDEX IF EXISTS public.idx_reviews_approved_stats;
--   DROP FUNCTION IF EXISTS public.directory_businesses(text, text, text, text[], text, numeric, numeric, text, text, text[], integer, integer);
--   y volver a la versión anterior de getBusinessesForDirectoryPaginated /
--   getTotalBusinessCount en services/supabaseService.ts (el front nuevo
--   necesita esta función: aplicar la migración ANTES de subir el build).
-- =============================================================================

BEGIN;

-- Cifras de reseñas de TODAS las empresas en cada página del directorio: con
-- este índice parcial y cubriente se leen del índice (~2 MB) en vez de la
-- tabla (117 MB en producción el 24/09, por el texto de las reseñas), que en
-- frío tardaba segundos. 50k filas: se crea en menos de un segundo.
CREATE INDEX IF NOT EXISTS idx_reviews_approved_stats
  ON public.reviews (business_id, created_at, rating)
  WHERE status = 'approved';

CREATE OR REPLACE FUNCTION public.directory_businesses(
  p_country            text    DEFAULT NULL,
  p_service_type       text    DEFAULT 'all',
  p_category           text    DEFAULT NULL,
  p_countries          text[]  DEFAULT NULL,
  p_search             text    DEFAULT NULL,
  p_min_rating         numeric DEFAULT NULL,
  p_max_rating         numeric DEFAULT NULL,
  p_sort               text    DEFAULT 'relevance',
  p_home_country       text    DEFAULT NULL,
  p_language_countries text[]  DEFAULT NULL,
  p_limit              integer DEFAULT 10,
  p_offset             integer DEFAULT 0
)
RETURNS TABLE (
  id                            uuid,
  name                          text,
  country                       text,
  logo_url                      text,
  logo_tone                     text,
  category                      text,
  description                   text,
  latitude                      double precision,
  longitude                     double precision,
  sedes                         jsonb,
  offers_international_services boolean,
  review_count                  bigint,
  avg_rating                    numeric,
  total_count                   bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
WITH arg AS (
  SELECT
    nullif(btrim(p_country), '')      AS pais,
    nullif(btrim(p_home_country), '') AS casa,
    -- Topes: es una RPC pública; nadie legítimo manda más de unas decenas de
    -- países ni busca más de 200 caracteres.
    coalesce(p_language_countries[1:300], '{}'::text[]) AS idioma,
    p_countries[1:300] AS paises,
    CASE WHEN p_service_type IN ('local', 'international') THEN p_service_type ELSE 'all' END AS alcance,
    CASE WHEN p_sort IN ('alphabetical', 'rating', 'reviews') THEN p_sort ELSE 'relevance' END AS orden,
    nullif(p_category, '') AS categoria,
    -- Búsqueda sin acentos, igual que el removeAccents del front: minúsculas,
    -- descomposición NFD y fuera las marcas combinantes U+0300-U+036F
    -- (normalize() es nativa desde Postgres 13; no hace falta unaccent, que
    -- no está en producción).
    '[' || chr(768) || '-' || chr(879) || ']' AS marcas,
    (now() AT TIME ZONE 'UTC')::date AS hoy
),
arg2 AS (
  SELECT a.*, regexp_replace(normalize(lower(left(nullif(p_search, ''), 200)), NFD), a.marcas, '', 'g') AS termino
  FROM arg a
),
-- Reseñas que se ven: aprobadas y ya publicadas (las programadas no cuentan).
stats AS (
  SELECT r.business_id,
         count(*)          AS n,
         sum(r.rating)     AS suma,
         avg(r.rating)     AS media,
         max(r.created_at) AS ultima
  FROM public.reviews r
  WHERE r.status = 'approved'
    AND r.created_at <= now()
  GROUP BY r.business_id
),
-- Cada empresa con sus cifras. MATERIALIZED y SIN filtros a propósito: así el
-- planificador ve las filas reales de las dos tablas y las une con un hash
-- join. Con los filtros (que dependen de los parámetros) dentro, estimaba ~3
-- filas y hacía un nested loop empresas x estadísticas, cuadrático en cuanto
-- haya miles de empresas.
fichas AS MATERIALIZED (
  SELECT
    b.id,
    b.name::text                          AS name,
    b.country::text                       AS country,
    b.logo_url::text                      AS logo_url,
    b.logo_tone::text                     AS logo_tone,
    b.category::text                      AS category,
    b.description::text                   AS description,
    b.latitude::double precision          AS latitude,
    b.longitude::double precision         AS longitude,
    b.sedes,
    b.offers_international_services,
    (b.owner_id IS NOT NULL)              AS reclamada,
    -- Plan de pago vigente del dueño. Solo para las reclamadas y por clave
    -- primaria de profiles (nada de unir todos los perfiles).
    (b.owner_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = b.owner_id
        AND pr.plan IS NOT NULL AND pr.plan <> 'free'
        AND (pr.plan_expires_at IS NULL OR pr.plan_expires_at > now())
    ))                                    AS de_pago,
    coalesce(s.n, 0)                      AS n,
    s.suma,
    s.media,
    s.ultima
  FROM public.businesses b
  LEFT JOIN stats s ON s.business_id = b.id
),
-- Nombre sin acentos, calculado UNA vez por fila y solo si hay búsqueda
-- (MATERIALIZED: si no, el planificador copia la expresión en cada uso).
planas AS MATERIALIZED (
  SELECT
    f.*,
    CASE WHEN a.termino IS NULL THEN NULL
         ELSE regexp_replace(normalize(lower(coalesce(f.name, '')), NFD), a.marcas, '', 'g') END AS nombre_plano
  FROM fichas f
  CROSS JOIN arg2 a
  WHERE (a.categoria IS NULL OR f.category ILIKE a.categoria || '%')
    AND (a.paises IS NULL OR cardinality(a.paises) = 0 OR f.country = ANY (a.paises))
),
base AS (
  SELECT
    x.*,
    coalesce(x.offers_international_services, false) AS intl,
    -- «del país»: la columna country o una sede (las de otro país con sede
    -- aquí; country NULL no entra, como el .neq() de antes).
    coalesce(a.pais IS NOT NULL AND (
      x.country = a.pais
      OR (x.country <> a.pais
          AND x.sedes @> jsonb_build_array(jsonb_build_object('country_code', a.pais)))
    ), false) AS del_pais,
    coalesce(a.pais IS NOT NULL AND x.country <> a.pais, false) AS de_otro_pais,
    coalesce(a.casa IS NOT NULL AND (
      x.country = a.casa
      OR x.sedes @> jsonb_build_array(jsonb_build_object('country_code', a.casa))
    ), false) AS de_casa,
    coalesce(x.country = ANY (a.idioma), false) AS de_idioma,
    CASE
      WHEN a.termino IS NULL THEN 0
      WHEN strpos(x.nombre_plano, a.termino) = 1 THEN 0
      WHEN strpos(x.nombre_plano, a.termino) > 0 THEN 1
      ELSE 2
    END AS coincidencia,
    coalesce(round(x.media::numeric, 1), 0) AS media1
  FROM planas x
  CROSS JOIN arg2 a
  WHERE a.termino IS NULL
     OR strpos(x.nombre_plano, a.termino) > 0
     OR strpos(regexp_replace(normalize(lower(coalesce(x.description, '')), NFD), a.marcas, '', 'g'), a.termino) > 0
),
visibles AS (
  SELECT x.*
  FROM base x
  CROSS JOIN arg2 a
  WHERE CASE
          WHEN a.pais IS NULL THEN
            CASE a.alcance WHEN 'local' THEN NOT x.intl WHEN 'international' THEN x.intl ELSE true END
          WHEN a.alcance = 'local' THEN x.del_pais AND NOT x.intl
          WHEN a.alcance = 'international' THEN x.intl AND (x.del_pais OR x.de_otro_pais)
          ELSE x.del_pais OR (x.de_otro_pais AND x.intl)
        END
    -- Rango de valoración: media redondeada a 1 decimal, 0 sin reseñas (como antes).
    AND (p_min_rating IS NULL OR x.media1 >= p_min_rating)
    AND (p_max_rating IS NULL OR x.media1 <= p_max_rating)
),
puntuadas AS (
  SELECT
    v.*,
    CASE
      WHEN a.orden = 'relevance' THEN
        CASE
          WHEN a.pais IS NOT NULL THEN CASE WHEN v.del_pais THEN 0 WHEN v.de_idioma THEN 1 ELSE 2 END
          ELSE CASE WHEN v.de_casa THEN 0 WHEN v.de_idioma THEN 1 ELSE 2 END
        END
      ELSE CASE WHEN a.pais IS NOT NULL AND NOT v.del_pais THEN 1 ELSE 0 END
    END AS grupo,
    -- Puntuación de relevancia (ver cabecera). numeric: determinista.
      CASE WHEN v.n = 0 THEN 0::numeric ELSE
          50 * (((3.5 * 10 + v.suma) / (10 + v.n)) - 1) / 4
        + 25 * least(1::numeric, ln(1 + v.n::numeric) / ln(501::numeric))
        + 10 * exp(-((a.hoy - (v.ultima AT TIME ZONE 'UTC')::date)::numeric) / 90)
      END
    + CASE WHEN v.reclamada THEN 5 ELSE 0 END
    + CASE WHEN v.de_pago THEN 5 ELSE 0 END
    + CASE WHEN nullif(btrim(v.logo_url), '') IS NOT NULL THEN 2.5 ELSE 0 END
    + CASE WHEN length(btrim(coalesce(v.description, ''))) >= 80 THEN 2.5 ELSE 0 END
      AS puntuacion
  FROM visibles v
  CROSS JOIN arg2 a
)
SELECT
  p.id, p.name, p.country, p.logo_url, p.logo_tone, p.category, p.description,
  p.latitude, p.longitude, p.sedes, p.offers_international_services,
  p.n::bigint      AS review_count,
  p.media1         AS avg_rating,
  count(*) OVER () AS total_count
FROM puntuadas p
CROSS JOIN arg2 a
ORDER BY
  p.coincidencia,
  p.grupo,
  CASE WHEN a.orden = 'alphabetical' THEN p.name END,
  CASE WHEN a.orden IN ('relevance', 'rating') THEN p.n = 0 END,
  CASE WHEN a.orden = 'relevance' THEN p.puntuacion END DESC,
  CASE WHEN a.orden = 'rating' THEN p.media END DESC NULLS LAST,
  CASE WHEN a.orden <> 'alphabetical' THEN p.n END DESC,
  CASE WHEN a.orden = 'reviews' THEN p.media END DESC NULLS LAST,
  p.id
LIMIT least(greatest(coalesce(p_limit, 10), 0), 100)
OFFSET greatest(coalesce(p_offset, 0), 0);
$function$;

REVOKE ALL ON FUNCTION public.directory_businesses(text, text, text, text[], text, numeric, numeric, text, text, text[], integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.directory_businesses(text, text, text, text[], text, numeric, numeric, text, text, text[], integer, integer) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.directory_businesses(text, text, text, text[], text, numeric, numeric, text, text, text[], integer, integer) IS
  'Directorio de empresas: página filtrada y ordenada (relevance por afinidad país/idioma + puntuación; alphabetical; rating; reviews) con total_count. Ver migración 20260924260000.';

COMMIT;
