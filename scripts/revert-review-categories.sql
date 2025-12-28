-- =====================================================
-- REVERTIR MIGRACIÓN DE CATEGORÍAS EN REVIEWS
-- =====================================================
-- Este script revierte los cambios de categorías en reviews
-- usando el backup creado anteriormente
-- =====================================================

-- Restaurar categorías desde el backup
UPDATE reviews r
SET category = backup.category
FROM reviews_backup_categories backup
WHERE r.id = backup.id;

-- Verificar restauración
SELECT
    r.category as review_category,
    COUNT(*) as total_reviews
FROM reviews r
GROUP BY r.category
ORDER BY total_reviews DESC, r.category ASC;

-- Eliminar tabla de backup
DROP TABLE IF EXISTS reviews_backup_categories;
