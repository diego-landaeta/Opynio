-- Garantías del modelo de productos, comprobadas contra el Supabase LOCAL
-- (PostgREST, RLS y roles reales), no contra una maqueta.
--
--   docker exec -i supabase_db_Opynio psql -U postgres -d postgres -f - < scripts/local/pruebas.sql
--
-- Todo ocurre dentro de una transacción que termina en ROLLBACK: no deja rastro.

BEGIN;

CREATE TEMP TABLE resultados (n SERIAL, etiqueta TEXT, ok BOOLEAN, detalle TEXT) ON COMMIT DROP;
-- Parte de las comprobaciones corren como `anon`, y ese rol tambien tiene que
-- poder anotar su resultado aqui.
GRANT INSERT, SELECT ON resultados TO anon;
GRANT USAGE, SELECT ON SEQUENCE resultados_n_seq TO anon;

DO $pruebas$
DECLARE
  emp        UUID;
  otra_emp   UUID;
  prod       UUID;
  otro_prod  UUID;
  resena     UUID;
  suelta     UUID;
  total_emp  INT;
  suma_prod  INT;
  v          INT;
  n          NUMERIC;
  n2         NUMERIC;
BEGIN
  SELECT id INTO emp FROM businesses WHERE slug = 'academia-local';
  IF emp IS NULL THEN
    RAISE EXCEPTION 'No hay datos locales. Ejecuta antes scripts/local/reconstruir.sh';
  END IF;

  SELECT id INTO prod      FROM review_subjects WHERE business_id = emp AND code = 'MKT-101';
  SELECT id INTO otro_prod FROM review_subjects WHERE business_id = emp AND code = 'PRL-200';
  SELECT l.review_id INTO resena FROM review_subject_links l WHERE l.subject_id = prod LIMIT 1;
  SELECT r.id INTO suelta FROM reviews r
    WHERE r.business_id = emp
      AND NOT EXISTS (SELECT 1 FROM review_subject_links l WHERE l.review_id = r.id)
    LIMIT 1;

  -- ---------------------------------------------------------------- 1
  -- El total de la empresa NO es la suma de sus productos: las reseñas de
  -- Google y las importadas cuentan para la empresa y no tienen producto.
  SELECT review_count INTO total_emp FROM widget_business_stats(emp);
  SELECT COALESCE(SUM(review_count), 0) INTO suma_prod FROM business_subject_stats(emp);
  INSERT INTO resultados(etiqueta, ok, detalle) VALUES (
    'el total de la empresa es independiente de los productos',
    total_emp > suma_prod,
    'empresa=' || total_emp || ' suma de productos=' || suma_prod);

  -- ---------------------------------------------------------------- 2
  -- Lo no asignado cuadra exactamente con la diferencia.
  SELECT business_unassigned_review_count(emp) INTO v;
  INSERT INTO resultados(etiqueta, ok, detalle) VALUES (
    'las resenas sin asignar cuadran con la diferencia',
    v = total_emp - suma_prod,
    'sin asignar=' || v || ' esperado=' || (total_emp - suma_prod));

  -- ---------------------------------------------------------------- 3
  -- Una reseña no puede pertenecer a dos productos.
  BEGIN
    INSERT INTO review_subject_links (review_id, subject_id) VALUES (resena, otro_prod);
    INSERT INTO resultados(etiqueta, ok, detalle) VALUES (
      'una resena no puede estar en dos productos', false, 'SE PERMITIO');
  EXCEPTION WHEN unique_violation THEN
    INSERT INTO resultados(etiqueta, ok, detalle) VALUES (
      'una resena no puede estar en dos productos', true, 'rechazado por UNIQUE');
  END;

  -- ---------------------------------------------------------------- 4
  -- No se puede enlazar una reseña al producto de OTRA empresa.
  -- Con el MISMO dueno a proposito: asi se comprueba que la barrera es la
  -- empresa y no el propietario. Ademas el limite de productos mira el plan del
  -- dueno, y una empresa sin dueno se queda en el plan free (0 productos).
  INSERT INTO businesses (name, slug, category, country, plan, owner_id)
    VALUES ('Empresa Ajena', 'empresa-ajena-prueba', 'Educación y Formación', 'ES', 'pro',
            (SELECT owner_id FROM businesses WHERE id = emp))
    RETURNING id INTO otra_emp;
  INSERT INTO review_subjects (business_id, name, slug, is_active)
    VALUES (otra_emp, 'Curso ajeno', 'curso_ajeno', true)
    RETURNING id INTO otro_prod;
  BEGIN
    INSERT INTO review_subject_links (review_id, subject_id) VALUES (suelta, otro_prod);
    INSERT INTO resultados(etiqueta, ok, detalle) VALUES (
      'no se enlaza a un producto de otra empresa', false, 'SE PERMITIO');
  EXCEPTION WHEN others THEN
    INSERT INTO resultados(etiqueta, ok, detalle) VALUES (
      'no se enlaza a un producto de otra empresa', true, 'rechazado: ' || left(SQLERRM, 40));
  END;

  -- ---------------------------------------------------------------- 5
  -- La nota del producto sale solo de SUS reseñas.
  -- A UN decimal: es lo que redondea la propia RPC
  -- (round(avg(r.rating)::numeric, 1)). Comparar con dos decimales daba un
  -- falso fallo, 4.30 frente a 4.33.
  SELECT avg_rating::numeric INTO n FROM widget_subject_stats(prod);
  -- n2 es NUMERIC a proposito: con una variable INT la media se redondearia a
  -- entero y la comparacion fallaria siempre.
  SELECT round(AVG(r.rating)::numeric, 1) INTO n2 FROM reviews r
    JOIN review_subject_links l ON l.review_id = r.id
    WHERE l.subject_id = prod AND r.status = 'approved';
  INSERT INTO resultados(etiqueta, ok, detalle) VALUES (
    'la nota del producto sale de sus propias resenas',
    n = n2, 'rpc=' || n || ' calculada=' || n2);

  -- ---------------------------------------------------------------- 6
  -- Un producto sin reseñas devuelve 0, no desaparece del listado.
  SELECT COUNT(*) INTO v FROM business_subject_stats(emp) WHERE review_count = 0;
  INSERT INTO resultados(etiqueta, ok, detalle) VALUES (
    'un producto sin resenas aparece con 0',
    v >= 1, 'productos a cero=' || v);

  -- ---------------------------------------------------------------- 7
  -- El anónimo no lee la referencia interna (permiso por columna).
  SET LOCAL ROLE anon;
  BEGIN
    SELECT COUNT(*) INTO v FROM review_subjects WHERE code IS NOT NULL;
    INSERT INTO resultados(etiqueta, ok, detalle) VALUES (
      'el anonimo no lee el codigo interno', false, 'SE PERMITIO');
  EXCEPTION WHEN insufficient_privilege THEN
    INSERT INTO resultados(etiqueta, ok, detalle) VALUES (
      'el anonimo no lee el codigo interno', true, 'permiso denegado');
  END;

  -- ---------------------------------------------------------------- 8
  -- El anónimo sí ve los productos activos (el widget depende de esto).
  BEGIN
    SELECT COUNT(*) INTO v FROM review_subjects;
    INSERT INTO resultados(etiqueta, ok, detalle) VALUES (
      'el anonimo ve los productos activos', v > 0, 'visibles=' || v);
  EXCEPTION WHEN others THEN
    INSERT INTO resultados(etiqueta, ok, detalle) VALUES (
      'el anonimo ve los productos activos', false, left(SQLERRM, 40));
  END;

  -- ---------------------------------------------------------------- 9
  -- El anónimo no ve los productos retirados.
  SELECT COUNT(*) INTO v FROM review_subjects WHERE NOT is_active;
  INSERT INTO resultados(etiqueta, ok, detalle) VALUES (
    'el anonimo no ve los productos retirados', v = 0, 'retirados visibles=' || v);

  -- ---------------------------------------------------------------- 10
  -- El anónimo no puede crear productos.
  BEGIN
    INSERT INTO review_subjects (business_id, name, slug) VALUES (emp, 'Colado', 'colado');
    INSERT INTO resultados(etiqueta, ok, detalle) VALUES (
      'el anonimo no crea productos', false, 'SE PERMITIO');
  EXCEPTION WHEN others THEN
    INSERT INTO resultados(etiqueta, ok, detalle) VALUES (
      'el anonimo no crea productos', true, 'rechazado: ' || left(SQLERRM, 40));
  END;
  RESET ROLE;
END
$pruebas$;

SELECT CASE WHEN ok THEN 'PASA' ELSE '*** FALLA ***' END AS r, etiqueta, detalle
FROM resultados ORDER BY n;

SELECT count(*) FILTER (WHERE NOT ok) AS fallos, count(*) AS total FROM resultados;

ROLLBACK;
