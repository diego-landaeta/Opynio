-- =====================================================
-- MIGRACIÓN DE CATEGORÍAS - NORMALIZACIÓN
-- =====================================================
-- Este script normaliza todas las categorías de empresas
-- a un formato estándar en español: "Categoría: Subcategoría"
--
-- IMPORTANTE:
-- 1. Revisa los cambios antes de ejecutar
-- 2. Haz un backup de la tabla businesses
-- 3. Ejecuta en el SQL Editor de Supabase
-- =====================================================

-- Crear una tabla temporal para el backup (opcional pero recomendado)
CREATE TABLE IF NOT EXISTS businesses_backup_categories AS
SELECT id, name, category
FROM businesses;

-- =====================================================
-- RESTAURANTES Y OCIO
-- =====================================================

UPDATE businesses
SET category = 'Restaurantes y Ocio: Restaurantes'
WHERE category IN (
    'Ocio y Restauración: Restaurantes',
    'Restauración y Ocio: Restaurantes',
    'leisure_and_dining:restaurants',
    'Leisure & Dining: Restaurants'
);

UPDATE businesses
SET category = 'Restaurantes y Ocio: Bares y Cafeterías'
WHERE category = 'Ocio y Restauración: Bares y Cafeterías';

-- =====================================================
-- SALUD Y BIENESTAR
-- =====================================================

UPDATE businesses
SET category = 'Salud y Bienestar: Clínicas Dentales'
WHERE category IN (
    'health_and_wellness:dental_clinics',
    'Health & Wellness: Dental Clinics'
);

UPDATE businesses
SET category = 'Salud y Bienestar: Clínicas y Hospitales'
WHERE category = 'health_and_wellness:clinics_hospitals';

-- =====================================================
-- MASCOTAS
-- =====================================================

UPDATE businesses
SET category = 'Mascotas: Clínicas Veterinarias'
WHERE category = 'pets:veterinary_clinics';

-- =====================================================
-- SERVICIOS PROFESIONALES Y DE EMPRESA
-- =====================================================

UPDATE businesses
SET category = 'Servicios Profesionales y de Empresa: Servicios Legales y Abogados'
WHERE category IN (
    'professional_and_business_services:legal_services_lawyers',
    'Professional & Business Services: Legal Services & Lawyers'
);

-- =====================================================
-- EDUCACIÓN Y FORMACIÓN
-- =====================================================

UPDATE businesses
SET category = 'Educación y Formación: Formación Profesional y Cursos Online'
WHERE category IN (
    'education_and_training: vocational_training_online_courses',
    'Education & Training: Vocational Training & Online Courses'
);

UPDATE businesses
SET category = 'Educación y Formación: Universidades y Educación Superior'
WHERE category IN (
    'education_and_training:universities_higher_education',
    'education_and_training: universities_higher_education'
);

UPDATE businesses
SET category = 'Educación y Formación: Colegios y Escuelas'
WHERE category = 'education_and_training:schools_colleges';

-- =====================================================
-- COMPRAS Y RETAIL
-- =====================================================

UPDATE businesses
SET category = 'Compras y Retail: Supermercados y Tiendas de Alimentación'
WHERE category = 'shopping_and_retail:supermarkets_food_stores';

-- =====================================================
-- AUTOMOCIÓN
-- =====================================================

UPDATE businesses
SET category = 'Automoción: Talleres Mecánicos y Reparación'
WHERE category = 'Automotive: Mechanical Workshops & Repair';

-- =====================================================
-- VIAJES Y TRANSPORTE
-- =====================================================

UPDATE businesses
SET category = 'Viajes y Transporte: Hoteles y Alojamientos'
WHERE category = 'travel_and_transport:hotels_accommodations';

-- =====================================================
-- SECTORES EMERGENTES Y OTROS
-- =====================================================

UPDATE businesses
SET category = 'Sectores Emergentes y Otros: Realidad Virtual y Aumentada'
WHERE category = 'emerging_and_other: virtual_augmented_reality';

-- =====================================================
-- CATEGORÍAS VACÍAS
-- =====================================================

UPDATE businesses
SET category = 'Sin Categoría'
WHERE category = '' OR category = ' ' OR category IS NULL;

-- =====================================================
-- VERIFICACIÓN - Ver el resultado de la migración
-- =====================================================

SELECT
    category,
    COUNT(*) as total_empresas
FROM businesses
GROUP BY category
ORDER BY total_empresas DESC, category ASC;

-- =====================================================
-- ESTADÍSTICAS POST-MIGRACIÓN
-- =====================================================

SELECT
    'Total de empresas' as metrica,
    COUNT(*) as valor
FROM businesses
UNION ALL
SELECT
    'Categorías únicas' as metrica,
    COUNT(DISTINCT category) as valor
FROM businesses
UNION ALL
SELECT
    'Empresas sin categoría' as metrica,
    COUNT(*) as valor
FROM businesses
WHERE category = 'Sin Categoría' OR category IS NULL;

-- =====================================================
-- OPCIONAL: Eliminar backup si todo está correcto
-- =====================================================
-- DROP TABLE IF EXISTS businesses_backup_categories;

-- =====================================================
-- NOTA: Las categorías ahora están en español estándar
-- Las traducciones a otros idiomas se manejarán en el frontend
-- mediante el sistema i18n
-- =====================================================
