-- =====================================================
-- SCRIPT: Añadir subcategoría "Reclutamiento"
-- =====================================================
-- Este script prepara la base de datos para usar la nueva
-- subcategoría "Reclutamiento" dentro de "Servicios Profesionales y de Empresa"
--
-- IMPORTANTE:
-- En este proyecto, las categorías se guardan directamente en el campo
-- 'category' de la tabla 'businesses' en formato:
-- "Categoría Principal: Subcategoría"
--
-- Por ejemplo: "Servicios Profesionales y de Empresa: Reclutamiento"
-- =====================================================

-- 1. Verificar empresas existentes que podrían usar esta nueva subcategoría
SELECT
    id,
    name,
    category,
    country
FROM businesses
WHERE category ILIKE '%Servicios Profesionales y de Empresa%'
  AND (name ILIKE '%reclutamiento%' OR name ILIKE '%recruitment%' OR name ILIKE '%headhunter%')
ORDER BY name;

-- 2. (OPCIONAL) Actualizar empresas que deberían estar en "Reclutamiento"
-- Descomenta y ejecuta solo si quieres reclasificar empresas existentes
/*
UPDATE businesses
SET category = 'Servicios Profesionales y de Empresa: Reclutamiento'
WHERE category = 'Servicios Profesionales y de Empresa: Recursos Humanos y Contratación'
  AND (name ILIKE '%reclutamiento%' OR name ILIKE '%recruitment%' OR name ILIKE '%headhunter%');
*/

-- 3. Verificar el resultado de categorías en "Servicios Profesionales y de Empresa"
SELECT
    category,
    COUNT(*) as total_empresas
FROM businesses
WHERE category ILIKE 'Servicios Profesionales y de Empresa:%'
GROUP BY category
ORDER BY total_empresas DESC;

-- =====================================================
-- NOTA:
-- La nueva subcategoría "Reclutamiento" ya está disponible
-- en el frontend gracias a las traducciones añadidas.
--
-- Cuando crees o edites una empresa, podrás seleccionar:
-- "Servicios Profesionales y de Empresa: Reclutamiento"
--
-- No se requiere ninguna migración de datos a menos que
-- quieras reclasificar empresas existentes.
-- =====================================================
