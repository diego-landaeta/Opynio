-- Script para añadir la subcategoría "Reclutamiento" a "Servicios Profesionales y de Empresa"
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Primero, verifica que no exista ya la subcategoría
SELECT * FROM subcategories
WHERE name_es = 'Reclutamiento';

-- 2. Inserta la nueva subcategoría
-- NOTA: Ajusta el main_category_id según tu base de datos
-- Primero encuentra el ID de "Servicios Profesionales y de Empresa"
SELECT id, name_es FROM main_categories
WHERE name_es = 'Servicios Profesionales y de Empresa';

-- 3. Inserta la subcategoría usando el ID encontrado arriba
-- Reemplaza 'MAIN_CATEGORY_ID' con el ID real de la consulta anterior
INSERT INTO subcategories (name_es, name_en, key, main_category_id)
VALUES (
  'Reclutamiento',
  'Recruitment',
  'recruitment',
  (SELECT id FROM main_categories WHERE name_es = 'Servicios Profesionales y de Empresa' LIMIT 1)
);

-- 4. Verifica que se insertó correctamente
SELECT
  sc.id,
  sc.name_es,
  sc.name_en,
  sc.key,
  mc.name_es as main_category
FROM subcategories sc
JOIN main_categories mc ON sc.main_category_id = mc.id
WHERE sc.key = 'recruitment';

-- 5. Si necesitas actualizar empresas existentes a esta nueva subcategoría:
-- NOTA: Solo ejecuta esto si tienes empresas que necesitan ser reclasificadas
/*
UPDATE businesses
SET category = 'Servicios Profesionales y de Empresa: Reclutamiento'
WHERE category = 'Servicios Profesionales y de Empresa: Recursos Humanos y Contratación'
  AND name ILIKE '%reclutamiento%';
*/
