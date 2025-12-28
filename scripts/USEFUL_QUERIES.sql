-- =====================================================
-- CONSULTAS ÚTILES PARA ANALIZAR VOTOS
-- =====================================================
-- Usa estas consultas en Supabase Dashboard → SQL Editor
-- para verificar y analizar los votos generados

-- =====================================================
-- 1. ESTADÍSTICAS GENERALES
-- =====================================================

-- Total de votos en el sistema
SELECT COUNT(*) as total_votes FROM review_votes;

-- Distribución de votos (útiles vs no útiles)
SELECT
  is_helpful,
  COUNT(*) as count,
  ROUND(COUNT(*)::numeric / (SELECT COUNT(*) FROM review_votes) * 100, 2) as percentage
FROM review_votes
GROUP BY is_helpful;

-- Promedio de votos por reseña
SELECT
  ROUND(AVG(helpful_votes + not_helpful_votes), 2) as avg_votes_per_review,
  MIN(helpful_votes + not_helpful_votes) as min_votes,
  MAX(helpful_votes + not_helpful_votes) as max_votes
FROM reviews
WHERE status = 'approved'
  AND (helpful_votes + not_helpful_votes) > 0;

-- =====================================================
-- 2. TOP RESEÑAS POR VOTOS
-- =====================================================

-- Top 20 reseñas más votadas
SELECT
  r.id,
  b.name as business_name,
  r.rating,
  r.helpful_votes,
  r.not_helpful_votes,
  r.helpful_votes + r.not_helpful_votes as total_votes,
  ROUND(r.helpful_votes::float / NULLIF(r.helpful_votes + r.not_helpful_votes, 0) * 100, 1) as positive_ratio
FROM reviews r
JOIN businesses b ON b.id = r.business_id
WHERE r.status = 'approved'
  AND (r.helpful_votes + r.not_helpful_votes) > 0
ORDER BY total_votes DESC
LIMIT 20;

-- Top 20 reseñas con mejor ratio de votos positivos
SELECT
  r.id,
  b.name as business_name,
  r.rating,
  r.helpful_votes,
  r.not_helpful_votes,
  ROUND(r.helpful_votes::float / NULLIF(r.helpful_votes + r.not_helpful_votes, 0) * 100, 1) as positive_ratio
FROM reviews r
JOIN businesses b ON b.id = r.business_id
WHERE r.status = 'approved'
  AND (r.helpful_votes + r.not_helpful_votes) >= 5  -- Al menos 5 votos
ORDER BY positive_ratio DESC, r.helpful_votes DESC
LIMIT 20;

-- =====================================================
-- 3. ANÁLISIS POR EMPRESA
-- =====================================================

-- Top empresas por votos totales
SELECT
  b.id,
  b.name,
  b.plan,
  COUNT(DISTINCT r.id) as total_reviews,
  SUM(r.helpful_votes) as total_helpful,
  SUM(r.not_helpful_votes) as total_not_helpful,
  SUM(r.helpful_votes + r.not_helpful_votes) as total_votes,
  ROUND(AVG(r.helpful_votes::float / NULLIF(r.helpful_votes + r.not_helpful_votes, 0)) * 100, 1) as avg_positive_ratio
FROM businesses b
JOIN reviews r ON r.business_id = b.id
WHERE r.status = 'approved'
  AND (r.helpful_votes + r.not_helpful_votes) > 0
GROUP BY b.id, b.name, b.plan
ORDER BY total_votes DESC
LIMIT 20;

-- Comparación: Empresas Premium vs Normales
SELECT
  CASE
    WHEN b.plan IN ('starter', 'growth', 'pro', 'enterprise') THEN 'Premium'
    ELSE 'Normal'
  END as business_type,
  COUNT(DISTINCT b.id) as num_businesses,
  COUNT(DISTINCT r.id) as total_reviews,
  SUM(r.helpful_votes) as total_helpful,
  SUM(r.not_helpful_votes) as total_not_helpful,
  ROUND(AVG(r.helpful_votes + r.not_helpful_votes), 2) as avg_votes_per_review,
  ROUND(AVG(r.helpful_votes::float / NULLIF(r.helpful_votes + r.not_helpful_votes, 0)) * 100, 1) as avg_positive_ratio
FROM businesses b
JOIN reviews r ON r.business_id = b.id
WHERE r.status = 'approved'
  AND (r.helpful_votes + r.not_helpful_votes) > 0
GROUP BY business_type
ORDER BY business_type;

-- =====================================================
-- 4. ANÁLISIS POR USUARIO
-- =====================================================

-- Usuarios más activos votando
SELECT
  p.id,
  p.name,
  p.username,
  COUNT(*) as total_votes,
  SUM(CASE WHEN rv.is_helpful THEN 1 ELSE 0 END) as helpful_votes,
  SUM(CASE WHEN NOT rv.is_helpful THEN 1 ELSE 0 END) as not_helpful_votes,
  ROUND(SUM(CASE WHEN rv.is_helpful THEN 1 ELSE 0 END)::float / COUNT(*) * 100, 1) as helpful_percentage
FROM profiles p
JOIN review_votes rv ON rv.user_id = p.id
GROUP BY p.id, p.name, p.username
ORDER BY total_votes DESC
LIMIT 20;

-- =====================================================
-- 5. DISTRIBUCIÓN TEMPORAL
-- =====================================================

-- Votos creados por día (últimos 30 días)
SELECT
  DATE(rv.created_at) as vote_date,
  COUNT(*) as total_votes,
  SUM(CASE WHEN rv.is_helpful THEN 1 ELSE 0 END) as helpful_votes,
  SUM(CASE WHEN NOT rv.is_helpful THEN 1 ELSE 0 END) as not_helpful_votes
FROM review_votes rv
WHERE rv.created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(rv.created_at)
ORDER BY vote_date DESC;

-- =====================================================
-- 6. DETECCIÓN DE ANOMALÍAS
-- =====================================================

-- Reseñas con ratios extremos (posiblemente anómalas)
SELECT
  r.id,
  b.name as business_name,
  b.plan,
  r.rating,
  r.helpful_votes,
  r.not_helpful_votes,
  ROUND(r.helpful_votes::float / NULLIF(r.helpful_votes + r.not_helpful_votes, 0) * 100, 1) as positive_ratio
FROM reviews r
JOIN businesses b ON b.id = r.business_id
WHERE r.status = 'approved'
  AND (r.helpful_votes + r.not_helpful_votes) >= 10
  AND (
    -- Ratio muy bajo (< 30%)
    (r.helpful_votes::float / NULLIF(r.helpful_votes + r.not_helpful_votes, 0)) < 0.30
    OR
    -- Ratio muy alto (> 95%)
    (r.helpful_votes::float / NULLIF(r.helpful_votes + r.not_helpful_votes, 0)) > 0.95
  )
ORDER BY positive_ratio DESC;

-- Empresas sin ningún voto
SELECT
  b.id,
  b.name,
  b.plan,
  COUNT(r.id) as total_reviews
FROM businesses b
LEFT JOIN reviews r ON r.business_id = b.id AND r.status = 'approved'
WHERE NOT EXISTS (
  SELECT 1
  FROM review_votes rv
  JOIN reviews r2 ON r2.id = rv.review_id
  WHERE r2.business_id = b.id
)
GROUP BY b.id, b.name, b.plan
HAVING COUNT(r.id) > 0
ORDER BY total_reviews DESC
LIMIT 20;

-- =====================================================
-- 7. VERIFICACIÓN DE INTEGRIDAD
-- =====================================================

-- Verificar que los contadores coincidan con los votos reales
SELECT
  r.id,
  r.helpful_votes as counter_helpful,
  r.not_helpful_votes as counter_not_helpful,
  (SELECT COUNT(*) FROM review_votes rv WHERE rv.review_id = r.id AND rv.is_helpful = true) as actual_helpful,
  (SELECT COUNT(*) FROM review_votes rv WHERE rv.review_id = r.id AND rv.is_helpful = false) as actual_not_helpful,
  CASE
    WHEN r.helpful_votes = (SELECT COUNT(*) FROM review_votes rv WHERE rv.review_id = r.id AND rv.is_helpful = true)
      AND r.not_helpful_votes = (SELECT COUNT(*) FROM review_votes rv WHERE rv.review_id = r.id AND rv.is_helpful = false)
    THEN '✓ OK'
    ELSE '✗ MISMATCH'
  END as status
FROM reviews r
WHERE r.status = 'approved'
  AND (r.helpful_votes > 0 OR r.not_helpful_votes > 0)
ORDER BY status DESC, r.id
LIMIT 50;

-- =====================================================
-- 8. REPORTES POR CATEGORÍA
-- =====================================================

-- Análisis de votos por categoría de empresa
SELECT
  b.category,
  COUNT(DISTINCT b.id) as num_businesses,
  COUNT(DISTINCT r.id) as total_reviews,
  SUM(r.helpful_votes + r.not_helpful_votes) as total_votes,
  ROUND(AVG(r.helpful_votes + r.not_helpful_votes), 2) as avg_votes_per_review,
  ROUND(AVG(r.helpful_votes::float / NULLIF(r.helpful_votes + r.not_helpful_votes, 0)) * 100, 1) as avg_positive_ratio
FROM businesses b
JOIN reviews r ON r.business_id = b.id
WHERE r.status = 'approved'
  AND (r.helpful_votes + r.not_helpful_votes) > 0
  AND b.category IS NOT NULL
GROUP BY b.category
ORDER BY total_votes DESC;

-- =====================================================
-- 9. LIMPIEZA Y MANTENIMIENTO
-- =====================================================

-- Resetear TODOS los votos (¡PELIGRO! Solo para desarrollo)
-- DELETE FROM review_votes;
-- UPDATE reviews SET helpful_votes = 0, not_helpful_votes = 0;

-- Resetear votos de UNA empresa específica
-- DELETE FROM review_votes
-- WHERE review_id IN (
--   SELECT r.id FROM reviews r WHERE r.business_id = 'TU_BUSINESS_ID_AQUI'
-- );

-- Resetear votos de UNA reseña específica
-- DELETE FROM review_votes WHERE review_id = 'TU_REVIEW_ID_AQUI';

-- Recalcular contadores manualmente (en caso de desincronización)
-- UPDATE reviews r
-- SET
--   helpful_votes = (SELECT COUNT(*) FROM review_votes rv WHERE rv.review_id = r.id AND rv.is_helpful = true),
--   not_helpful_votes = (SELECT COUNT(*) FROM review_votes rv WHERE rv.review_id = r.id AND rv.is_helpful = false)
-- WHERE r.id = 'TU_REVIEW_ID_AQUI';

-- =====================================================
-- 10. EXPORTAR DATOS
-- =====================================================

-- Exportar resumen de votos por empresa (listo para CSV)
SELECT
  b.name as "Empresa",
  b.plan as "Plan",
  COUNT(DISTINCT r.id) as "Total Reseñas",
  SUM(r.helpful_votes) as "Votos Útiles",
  SUM(r.not_helpful_votes) as "Votos No Útiles",
  SUM(r.helpful_votes + r.not_helpful_votes) as "Total Votos",
  ROUND(AVG(r.helpful_votes::float / NULLIF(r.helpful_votes + r.not_helpful_votes, 0)) * 100, 1) || '%' as "% Positivos"
FROM businesses b
JOIN reviews r ON r.business_id = b.id
WHERE r.status = 'approved'
  AND (r.helpful_votes + r.not_helpful_votes) > 0
GROUP BY b.id, b.name, b.plan
ORDER BY SUM(r.helpful_votes + r.not_helpful_votes) DESC;

-- =====================================================
-- FIN DE CONSULTAS ÚTILES
-- =====================================================
