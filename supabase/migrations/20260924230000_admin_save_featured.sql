-- =============================================================================
-- Guardar las destacadas en una sola transaccion. 2026-09-24
--
-- /admin/destacados guardaba con varias escrituras desde el navegador (una por
-- empresa para marcarla con su featured_order y otra para desmarcar el resto).
-- Dos arrastres seguidos lanzaban dos guardados a la vez y sus escrituras se
-- mezclaban: featured_order cruzado entre las dos listas, o una recien anadida
-- desmarcada por el otro guardado. Si una escritura fallaba a medias, la lista
-- quedaba a medio guardar.
--
-- admin_save_featured_businesses(ids) hace todo en una transaccion y con un
-- candado: dos guardados (dos pestanas, dos admins) van uno detras de otro, y el
-- ultimo que entra es el que queda. La pagina ademas bloquea el arrastre
-- mientras guarda.
--
-- Nombre nuevo a proposito: en produccion ya existe
-- admin_set_featured_companies(business_ids uuid[]), heredada, que escribe en la
-- tabla featured_companies (maximo 5) y que el front no usa. No se toca.
--
-- Idempotente. Rollback:
--   DROP FUNCTION IF EXISTS public.admin_save_featured_businesses(uuid[]);
-- (el front, sin la RPC, vuelve solo a las escrituras sueltas de antes).
-- =============================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.admin_save_featured_businesses(p_business_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_ids uuid[] := COALESCE(p_business_ids, ARRAY[]::uuid[]);
  v_found integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'::public.user_role
  ) THEN
    RAISE EXCEPTION 'Permiso denegado: solo un administrador puede cambiar las destacadas.'
      USING ERRCODE = '42501';
  END IF;

  IF array_position(v_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'La lista de destacadas tiene un id vacío.' USING ERRCODE = '22004';
  END IF;
  IF (SELECT count(DISTINCT x) FROM unnest(v_ids) AS x) <> cardinality(v_ids) THEN
    RAISE EXCEPTION 'La lista de destacadas tiene una empresa repetida.' USING ERRCODE = '22023';
  END IF;

  -- Un guardado cada vez: el segundo espera a que el primero termine.
  PERFORM pg_advisory_xact_lock(hashtextextended('admin_save_featured_businesses', 0));

  SELECT count(*) INTO v_found FROM public.businesses WHERE id = ANY (v_ids);
  IF v_found <> cardinality(v_ids) THEN
    RAISE EXCEPTION 'Alguna de las empresas ya no existe. Recarga la página.' USING ERRCODE = 'P0002';
  END IF;

  -- Posicion = orden en la lista (1, 2, 3...). Solo se escriben las filas que
  -- cambian, para no mover updated_at de las demas.
  UPDATE public.businesses AS b
     SET is_featured = true,
         featured_order = s.ord::integer
    FROM unnest(v_ids) WITH ORDINALITY AS s(id, ord)
   WHERE b.id = s.id
     AND (b.is_featured IS DISTINCT FROM true OR b.featured_order IS DISTINCT FROM s.ord::integer);

  UPDATE public.businesses
     SET is_featured = false,
         featured_order = NULL
   WHERE (is_featured OR featured_order IS NOT NULL)
     AND NOT (id = ANY (v_ids));
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_save_featured_businesses(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_featured_businesses(uuid[]) TO authenticated;

COMMIT;

-- PostgREST: que vea la funcion nueva sin reiniciar.
NOTIFY pgrst, 'reload schema';
