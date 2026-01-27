-- ============================================
-- SCRIPT SQL PARA INDEXAR RESEÑAS A UNA EMPRESA
-- ============================================
-- USO:
-- 1. Cambiar el UUID de BUSINESS_ID abajo
-- 2. Editar las reseñas en el INSERT
-- 3. Ejecutar en Supabase SQL Editor
-- ============================================

-- ============================================
-- CONFIGURACIÓN
-- ============================================

-- ⚠️ CAMBIAR ESTE UUID POR EL DE TU EMPRESA ⚠️
DO $$
DECLARE
    BUSINESS_ID UUID := 'TU_BUSINESS_ID_AQUI'; -- ← CAMBIAR ESTO
    USER_ID TEXT := 'sistema'; -- Usuario del sistema (o usar UUID de usuario real)
BEGIN

-- ============================================
-- VERIFICAR QUE LA EMPRESA EXISTE
-- ============================================

IF NOT EXISTS (SELECT 1 FROM businesses WHERE id = BUSINESS_ID) THEN
    RAISE EXCEPTION 'Error: Empresa con ID % no encontrada. Verifica el UUID.', BUSINESS_ID;
END IF;

RAISE NOTICE '✅ Empresa encontrada: %', (SELECT name FROM businesses WHERE id = BUSINESS_ID);

-- ============================================
-- VERIFICAR/CREAR USUARIO DEL SISTEMA
-- ============================================

IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = USER_ID) THEN
    RAISE NOTICE '⚠️  Usuario sistema no existe, creando...';
    INSERT INTO profiles (id, name, username, role)
    VALUES (USER_ID, 'Sistema de Reseñas', 'sistema', 'authenticated')
    ON CONFLICT (id) DO NOTHING;
    RAISE NOTICE '✅ Usuario del sistema creado';
ELSE
    RAISE NOTICE '✅ Usuario del sistema encontrado';
END IF;

-- ============================================
-- INSERTAR RESEÑAS
-- ============================================

RAISE NOTICE '📝 Insertando reseñas...';

INSERT INTO reviews (
    business_id,
    user_id,
    rating,
    title,
    review_text,
    status,
    source,
    original_author_name,
    is_verified_customer,
    helpful_votes,
    not_helpful_votes,
    created_at
) VALUES
-- Reseña 1
(
    BUSINESS_ID,
    USER_ID,
    5,
    'Excelente servicio y atención',
    'Muy satisfecho con la atención recibida. El personal es muy amable y profesional. Recomendado 100%. Volveré sin duda.',
    'approved',
    'google',
    'Juan Pérez',
    false,
    0,
    0,
    '2024-01-15 10:30:00+00'
),
-- Reseña 2
(
    BUSINESS_ID,
    USER_ID,
    4,
    'Buena experiencia en general',
    'El servicio fue bueno, aunque el tiempo de espera fue un poco largo. La calidad del producto es excelente y el precio justo.',
    'approved',
    'google',
    'María García',
    false,
    0,
    0,
    '2024-01-20 15:45:00+00'
),
-- Reseña 3
(
    BUSINESS_ID,
    USER_ID,
    5,
    'Superó mis expectativas',
    'No esperaba un servicio tan bueno. Desde el primer contacto hasta la entrega final, todo fue perfecto. Muy profesionales.',
    'approved',
    'google',
    'Carlos Rodríguez',
    true,
    0,
    0,
    '2024-02-01 09:15:00+00'
),
-- Reseña 4
(
    BUSINESS_ID,
    USER_ID,
    3,
    'Servicio aceptable',
    'La experiencia fue correcta, aunque hay aspectos que podrían mejorar. El precio es un poco elevado para lo que ofrecen.',
    'approved',
    'google',
    'Ana Martínez',
    false,
    0,
    0,
    '2024-02-10 14:20:00+00'
),
-- Reseña 5
(
    BUSINESS_ID,
    USER_ID,
    5,
    'Lo mejor de la zona',
    'Sin duda, el mejor lugar de la zona. Calidad excepcional, buen precio y atención de primera. Muy recomendable.',
    'approved',
    'google',
    'Luis Fernández',
    true,
    0,
    0,
    '2024-02-15 11:00:00+00'
),
-- Reseña 6
(
    BUSINESS_ID,
    USER_ID,
    4,
    'Muy recomendable',
    'Gran experiencia. El equipo es muy profesional y el resultado final fue excelente. Solo un pequeño detalle en los tiempos de entrega.',
    'approved',
    'google',
    'Laura Sánchez',
    false,
    0,
    0,
    '2024-02-20 16:30:00+00'
),
-- Reseña 7
(
    BUSINESS_ID,
    USER_ID,
    5,
    'Perfecto en todos los aspectos',
    'No puedo poner ningún pero. Servicio rápido, eficiente y con gran atención al detalle. Definitivamente volveré y lo recomendaré.',
    'approved',
    'google',
    'Pedro González',
    true,
    0,
    0,
    '2024-02-25 10:45:00+00'
),
-- Reseña 8
(
    BUSINESS_ID,
    USER_ID,
    4,
    'Buena relación calidad-precio',
    'Estoy satisfecho con el servicio recibido. La relación calidad-precio es buena y el personal es atento. Recomendable.',
    'approved',
    'google',
    'Carmen López',
    false,
    0,
    0,
    '2024-03-01 13:00:00+00'
),
-- Reseña 9
(
    BUSINESS_ID,
    USER_ID,
    5,
    'Increíble atención al cliente',
    'La atención al cliente es excepcional. Resolvieron todas mis dudas con paciencia y profesionalidad. Muy contentos con el resultado.',
    'approved',
    'google',
    'Miguel Torres',
    true,
    0,
    0,
    '2024-03-05 09:30:00+00'
),
-- Reseña 10
(
    BUSINESS_ID,
    USER_ID,
    4,
    'Satisfecho con el servicio',
    'El servicio cumplió con mis expectativas. Profesionales competentes y buenos precios. Algunas mejoras en comunicación serían bienvenidas.',
    'approved',
    'google',
    'Isabel Ruiz',
    false,
    0,
    0,
    '2024-03-10 15:15:00+00'
);

-- ============================================
-- RESUMEN
-- ============================================

RAISE NOTICE '✅ ¡Reseñas insertadas exitosamente!';
RAISE NOTICE 'Total de reseñas insertadas: %', (SELECT COUNT(*) FROM reviews WHERE business_id = BUSINESS_ID);
RAISE NOTICE 'Rating promedio: %', (SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE business_id = BUSINESS_ID AND status = ''approved'');

END $$;

-- ============================================
-- VERIFICAR RESULTADO
-- ============================================

-- Ver todas las reseñas de la empresa
-- Cambiar TU_BUSINESS_ID_AQUI por el UUID de tu empresa
/*
SELECT
    r.id,
    r.rating,
    r.title,
    r.original_author_name,
    r.status,
    r.created_at
FROM reviews r
WHERE r.business_id = 'TU_BUSINESS_ID_AQUI'
ORDER BY r.created_at DESC;
*/

-- Ver estadísticas
/*
SELECT
    COUNT(*) as total_reviews,
    ROUND(AVG(rating)::numeric, 2) as avg_rating,
    COUNT(CASE WHEN rating = 5 THEN 1 END) as five_stars,
    COUNT(CASE WHEN rating = 4 THEN 1 END) as four_stars,
    COUNT(CASE WHEN rating = 3 THEN 1 END) as three_stars,
    COUNT(CASE WHEN rating = 2 THEN 1 END) as two_stars,
    COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star
FROM reviews
WHERE business_id = 'TU_BUSINESS_ID_AQUI' AND status = 'approved';
*/
