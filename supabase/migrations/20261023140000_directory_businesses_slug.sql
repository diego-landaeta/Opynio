-- =============================================================================
-- directory_businesses(): devuelve tambien el SLUG de cada empresa.
-- 2026-10-23
--
-- Por que: todos los enlaces internos a una ficha (portada, directorio,
-- Explorar, buscador) se construian con el NOMBRE de la empresa
-- (/es/empresa/Taller_Neumaticos_y_Mecanica_Alcala) y solo despues de cargar
-- la ficha el cliente redirigia al slug (/es/empresa/taller_neumaticos_...).
-- La RPC del directorio no devolvia el slug, asi que las tarjetas no podian
-- enlazar directamente a la URL canonica (issue #4: «ninguna URL con acentos,
-- ñ ni mayusculas»). El front enlaza ahora por slug cuando la fila lo trae y,
-- si no (empresa sin slug, o RPC antigua), sigue enlazando por nombre.
--
-- QUE CAMBIA: una columna mas al FINAL del resultado (slug, text). Postgres
-- no permite cambiar el tipo de retorno con CREATE OR REPLACE, de ahi el
-- DROP + CREATE (en una sola transaccion: nadie ve la funcion a medias).
-- QUE NO CAMBIA: los 12 parametros, el cuerpo de la consulta (filtros, orden,
-- puntuacion, desempate, limite de 100), SECURITY DEFINER, search_path vacio,
-- STABLE, los GRANT (anon, authenticated, service_role; REVOKE a PUBLIC) ni el
-- COMMENT salvo la mencion al slug. El cuerpo es el de 20260924260000 salvo
-- "b.slug::text AS slug" en el CTE fichas y "p.slug" en el SELECT final (se
-- comprueba con diff). slug es una columna publica de businesses (ya la lee la
-- ficha y el sitemap).
--
-- ORDEN DE DESPLIEGUE: indiferente. El front antiguo ignora la columna extra;
-- el front nuevo, sin esta migracion, lee slug = undefined y enlaza por nombre.
--
-- Probada en local y en opynio_prodlike: mismas filas, mismo orden y mismas
-- columnas que la version anterior en una bateria de llamadas, y el plan de
-- consulta con 1.000 empresas / ~50.000 reseñas igual que antes.
--
-- Rollback (devuelve la version anterior, sin slug):
--   BEGIN;
--   DROP FUNCTION IF EXISTS public.directory_businesses(text, text, text, text[], text, numeric, numeric, text, text, text[], integer, integer);
--   -- y ejecutar el CREATE FUNCTION + REVOKE + GRANT + COMMENT de
--   -- supabase/migrations/20260924260000_directory_relevance_order.sql
--   COMMIT;
-- Idempotente (se puede aplicar dos veces).
-- =============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.directory_businesses(text, text, text, text[], text, numeric, numeric, text, text, text[], integer, integer);

CREATE FUNCTION public.directory_businesses(
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
  total_count                   bigint,
  slug                          text
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
    b.slug::text                          AS slug,
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
  count(*) OVER () AS total_count,
  p.slug
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
  'Directorio de empresas: página filtrada y ordenada (relevance por afinidad país/idioma + puntuación; alphabetical; rating; reviews) con total_count y slug. Ver migraciones 20260924260000 y 20261023140000.';

COMMIT;
