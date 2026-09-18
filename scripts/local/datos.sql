-- Datos del entorno LOCAL: una academia con catalogo y resenas repartidas.
-- Lo llama reconstruir_local.sh. No se aplica a produccion.

INSERT INTO public.businesses (id, name, slug, description, category, country, owner_id, plan, is_verified)
SELECT '11111111-1111-1111-1111-111111111111', 'Academia Local', 'academia-local',
       'Centro de formacion de prueba en el entorno local.', 'Educación y Formación', 'ES',
       (SELECT id FROM auth.users WHERE email = 'jefa@local.test'), 'pro', true
WHERE NOT EXISTS (SELECT 1 FROM public.businesses WHERE slug = 'academia-local');

DO $seed$
DECLARE
  emp UUID := '11111111-1111-1111-1111-111111111111';
  p RECORD;
  i INT;
  nota INT;
  nueva UUID;
  autores TEXT[] := ARRAY['Maria G.','Carlos R.','Lucia P.','Andres T.','Nuria S.','Javier M.','Elena F.','Pablo D.','Rocio V.','Sergio L.','Marta B.','Ivan C.'];
  titulos TEXT[] := ARRAY['Excelente','Muy completo','Cumple lo que promete','Buen acompanamiento','Repetire','Mejorable','Justo lo que buscaba','Contenido actualizado'];
BEGIN
  FOR p IN
    SELECT * FROM (VALUES
      ('Curso de Marketing Digital',              'MKT-101', 'Formacion online de 40 horas con tutor asignado y certificado final.', true,  9, 5),
      ('Master en Prevencion de Riesgos Laborales','PRL-200', 'Titulacion propia de 600 horas, modalidad mixta.',                      true, 14, 4),
      ('Curso de Excel Avanzado',                 'EXC-050', NULL,                                                                     true,  7, 5),
      ('Ingles B2 preparacion Cambridge',         'ENG-B2',  'Preparacion intensiva con simulacros de examen.',                        true, 11, 4),
      ('Curso de Contabilidad para Autonomos',    'CON-010', 'Practico, con casos reales y plantillas.',                               true,  5, 4),
      ('Diseno Grafico con Adobe Suite',          'DIS-300', 'Photoshop, Illustrator e InDesign desde cero.',                          true,  6, 5),
      ('Consultoria personalizada',               NULL,      'Sesion individual de dos horas.',                                        true,  3, 3),
      ('Curso de Community Manager',              'CM-120',  NULL,                                                                     true,  4, 4),
      ('Programa Superior en Direccion de Recursos Humanos y Gestion del Talento', 'RRHH-900', 'Programa anual para mandos intermedios.', true, 2, 5),
      ('Curso de Primeros Auxilios',              'PAX-001', 'Presencial, 20 horas, certificado oficial.',                             true,  0, 0),
      ('Taller de Oratoria',                      'ORA-015', 'Dos jornadas intensivas.',                                               true,  1, 5),
      ('Curso de Photoshop (retirado)',           'PS-OLD',  'Sustituido por Diseno Grafico con Adobe Suite.',                         false, 2, 3)
    ) AS t(nombre, codigo, descripcion, activo, resenas, base)
  LOOP
    INSERT INTO review_subjects (business_id, name, code, slug, description, is_active)
    VALUES (emp, p.nombre, p.codigo,
            lower(regexp_replace(translate(p.nombre, 'áéíóúñÁÉÍÓÚÑ', 'aeiounAEIOUN'), '[^a-zA-Z0-9]+', '_', 'g')),
            p.descripcion, p.activo)
    ON CONFLICT (business_id, slug) DO NOTHING
    RETURNING id INTO nueva;
    CONTINUE WHEN nueva IS NULL;

    FOR i IN 1..p.resenas LOOP
      nota := GREATEST(1, LEAST(5, p.base - (i % 3) + (i % 2)));
      INSERT INTO reviews (business_id, user_id, rating, title, review_text, status, source,
                           original_author_name, category, created_at)
      VALUES (emp, NULL, nota,
              titulos[1 + (i % array_length(titulos,1))],
              'Opinion sobre ' || p.nombre || '. ' || titulos[1 + ((i+2) % array_length(titulos,1))] || '.',
              'approved', 'opynio',
              autores[1 + (i % array_length(autores,1))], 'Educación y Formación',
              NOW() - ((i * 3) || ' days')::interval)
      RETURNING id INTO nueva;
      INSERT INTO review_subject_links (review_id, subject_id)
      VALUES (nueva, (SELECT id FROM review_subjects WHERE business_id = emp AND name = p.nombre));
    END LOOP;
  END LOOP;

  -- Resenas de Google e importadas: nunca tendran producto asignado.
  FOR i IN 1..13 LOOP
    INSERT INTO reviews (business_id, user_id, rating, title, review_text, status, source,
                         original_author_name, category, created_at)
    VALUES (emp, NULL, 3 + (i % 3), 'Opinion general',
            'Buena experiencia con la academia en general.', 'approved',
            CASE WHEN i % 2 = 0 THEN 'google' ELSE 'imported' END,
            autores[1 + (i % array_length(autores,1))], 'Educación y Formación',
            NOW() - ((i * 5) || ' days')::interval);
  END LOOP;
END
$seed$;
