-- =====================================================
-- MIGRACIÓN DE CATEGORÍAS EN REVIEWS
-- =====================================================
-- Este script actualiza el campo 'category' en la tabla reviews
-- para que coincida con la categoría actualizada de su business
--
-- IMPORTANTE:
-- 1. Revisa los cambios antes de ejecutar
-- 2. Haz un backup de la tabla reviews (opcional)
-- 3. Ejecuta en el SQL Editor de Supabase
-- =====================================================

-- Crear una tabla temporal para el backup (opcional pero recomendado)
CREATE TABLE IF NOT EXISTS reviews_backup_categories AS
SELECT id, business_id, category
FROM reviews;

-- =====================================================
-- ACTUALIZAR CATEGORÍAS DE REVIEWS
-- =====================================================
-- Actualiza cada review con la categoría actual de su business

UPDATE reviews r
SET category = b.category
FROM businesses b
WHERE r.business_id = b.id
  AND (r.category IS NULL OR r.category != b.category);

-- =====================================================
-- VERIFICACIÓN - Ver el resultado de la migración
-- =====================================================

SELECT
    r.category as review_category,
    COUNT(*) as total_reviews
FROM reviews r
GROUP BY r.category
ORDER BY total_reviews DESC, r.category ASC;

-- =====================================================
-- COMPARACIÓN ANTES/DESPUÉS
-- =====================================================

SELECT
    'Reviews con categoría actualizada' as metrica,
    COUNT(*) as valor
FROM reviews r
INNER JOIN businesses b ON r.business_id = b.id
WHERE r.category = b.category
UNION ALL
SELECT
    'Reviews con categoría desactualizada' as metrica,
    COUNT(*) as valor
FROM reviews r
INNER JOIN businesses b ON r.business_id = b.id
WHERE r.category != b.category OR r.category IS NULL;

-- =====================================================
-- OPCIONAL: Eliminar backup si todo está correcto
-- =====================================================
-- DROP TABLE IF EXISTS reviews_backup_categories;
