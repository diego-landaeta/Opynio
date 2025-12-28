-- =====================================================
-- DIAGNÓSTICO DE CATEGORÍAS EN REVIEWS
-- =====================================================
-- Este script verifica el estado actual de las categorías
-- en la tabla reviews
-- =====================================================

-- Ver todas las categorías únicas en reviews
SELECT
    category as review_category,
    COUNT(*) as total_reviews
FROM reviews
GROUP BY category
ORDER BY total_reviews DESC, category ASC;

-- Ver si hay reviews con categorías que no coinciden con su business
SELECT
    r.id,
    r.category as review_category,
    b.category as business_category,
    b.name as business_name
FROM reviews r
INNER JOIN businesses b ON r.business_id = b.id
WHERE r.category != b.category OR r.category IS NULL
LIMIT 50;

-- Contar reviews con categorías desincronizadas
SELECT
    COUNT(*) as reviews_desincronizadas
FROM reviews r
INNER JOIN businesses b ON r.business_id = b.id
WHERE r.category != b.category OR r.category IS NULL;
