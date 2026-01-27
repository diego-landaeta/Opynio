const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuración de Supabase
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: Variables de entorno no configuradas');
  console.error('Asegúrate de tener .env con:');
  console.error('  - VITE_SUPABASE_URL');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY o VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Script para indexar reseñas a una empresa
 *
 * USO:
 * node scripts/index-reviews.cjs <business_id> <archivo_reviews.json>
 *
 * O editar directamente el array REVIEWS abajo
 */

// ============================================
// CONFIGURACIÓN
// ============================================

// ID de la empresa a la que indexar las reseñas
const BUSINESS_ID = process.argv[2] || 'TU_BUSINESS_ID_AQUI';

// ID del usuario que aparecerá como autor (usar uno existente o crear uno genérico)
const DEFAULT_USER_ID = 'sistema'; // O usar un UUID de usuario real

// ============================================
// RESEÑAS A INDEXAR
// ============================================

const REVIEWS = [
  {
    rating: 5,
    title: 'Excelente servicio',
    review_text: 'Muy satisfecho con la atención recibida. Recomendado 100%.',
    status: 'approved',
    source: 'google',
    original_author_name: 'Juan Pérez',
    is_verified_customer: false,
    created_at: '2024-01-15T10:30:00Z'
  },
  {
    rating: 4,
    title: 'Buena experiencia',
    review_text: 'En general bien, aunque el tiempo de espera fue un poco largo.',
    status: 'approved',
    source: 'google',
    original_author_name: 'María García',
    is_verified_customer: false,
    created_at: '2024-01-20T15:45:00Z'
  },
  // Agregar más reseñas aquí...
];

// ============================================
// FUNCIONES
// ============================================

async function getOrCreateSystemUser() {
  console.log('🔍 Verificando usuario del sistema...');

  // Intentar obtener el usuario 'sistema'
  const { data: existingUser, error: fetchError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', DEFAULT_USER_ID)
    .single();

  if (existingUser) {
    console.log('✅ Usuario del sistema encontrado:', DEFAULT_USER_ID);
    return DEFAULT_USER_ID;
  }

  // Si no existe, intentar crear uno
  console.log('⚠️  Usuario del sistema no encontrado, creando...');

  const { data: newUser, error: createError } = await supabase
    .from('profiles')
    .insert({
      id: DEFAULT_USER_ID,
      name: 'Sistema de Reseñas',
      username: 'sistema',
      role: 'authenticated'
    })
    .select()
    .single();

  if (createError) {
    console.warn('⚠️  No se pudo crear usuario del sistema:', createError.message);
    console.log('💡 Usando ID temporal. Asegúrate de que el usuario exista.');
    return DEFAULT_USER_ID;
  }

  console.log('✅ Usuario del sistema creado:', DEFAULT_USER_ID);
  return DEFAULT_USER_ID;
}

async function verifyBusiness(businessId) {
  console.log('🔍 Verificando empresa...');

  const { data: business, error } = await supabase
    .from('businesses')
    .select('id, name, country')
    .eq('id', businessId)
    .single();

  if (error || !business) {
    console.error('❌ Error: Empresa no encontrada:', businessId);
    console.error('   Verifica que el ID sea correcto');
    return null;
  }

  console.log('✅ Empresa encontrada:', business.name, `(${business.country})`);
  return business;
}

async function indexReview(review, businessId, userId) {
  const reviewData = {
    business_id: businessId,
    user_id: userId,
    rating: review.rating,
    title: review.title || null,
    review_text: review.review_text || review.text,
    status: review.status || 'approved',
    source: review.source || 'manual',
    original_author_name: review.original_author_name || null,
    original_response_text: review.original_response_text || null,
    original_response_date: review.original_response_date || null,
    is_verified_customer: review.is_verified_customer || false,
    is_verified_purchase: review.is_verified_purchase || false,
    helpful_votes: review.helpful_votes || 0,
    not_helpful_votes: review.not_helpful_votes || 0,
    images: review.images || review.image_urls || null,
    audio_url: review.audio_url || null,
    category: review.category || null,
    tags: review.tags || null,
    created_at: review.created_at || new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('reviews')
    .insert(reviewData)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function indexAllReviews() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🚀 SCRIPT DE INDEXACIÓN DE RESEÑAS');
  console.log('═══════════════════════════════════════════════════════\n');

  // Validar business ID
  if (!BUSINESS_ID || BUSINESS_ID === 'TU_BUSINESS_ID_AQUI') {
    console.error('❌ Error: Debes especificar un BUSINESS_ID válido');
    console.error('\nUSO:');
    console.error('  1. Edita el script y cambia BUSINESS_ID');
    console.error('  2. O ejecuta: node scripts/index-reviews.cjs <business_id>');
    console.error('\nEjemplo:');
    console.error('  node scripts/index-reviews.cjs 123e4567-e89b-12d3-a456-426614174000');
    process.exit(1);
  }

  // Validar que hay reseñas
  if (REVIEWS.length === 0) {
    console.error('❌ Error: No hay reseñas para indexar');
    console.error('Edita el array REVIEWS en el script y agrega reseñas');
    process.exit(1);
  }

  try {
    // Verificar empresa
    const business = await verifyBusiness(BUSINESS_ID);
    if (!business) {
      process.exit(1);
    }

    // Verificar/crear usuario del sistema
    const userId = await getOrCreateSystemUser();

    console.log('\n📝 Reseñas a indexar:', REVIEWS.length);
    console.log('═══════════════════════════════════════════════════════\n');

    // Indexar reseñas
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < REVIEWS.length; i++) {
      const review = REVIEWS[i];
      const num = i + 1;

      try {
        console.log(`[${num}/${REVIEWS.length}] Indexando reseña de "${review.original_author_name || 'Anónimo'}"...`);

        const indexed = await indexReview(review, BUSINESS_ID, userId);

        console.log(`✅ [${num}/${REVIEWS.length}] Reseña indexada con ID: ${indexed.id}`);
        console.log(`   Rating: ${review.rating}★ | Título: "${review.title || 'Sin título'}"`);
        console.log();

        successCount++;
      } catch (error) {
        console.error(`❌ [${num}/${REVIEWS.length}] Error al indexar reseña:`, error.message);
        console.error(`   Reseña: "${review.title || 'Sin título'}"`);
        console.error();
        errorCount++;
      }
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 RESUMEN');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Total de reseñas:     ${REVIEWS.length}`);
    console.log(`✅ Indexadas:         ${successCount}`);
    console.log(`❌ Errores:           ${errorCount}`);
    console.log('═══════════════════════════════════════════════════════\n');

    if (successCount > 0) {
      console.log('✅ Proceso completado exitosamente!');
      console.log(`\n🔗 Ver empresa: https://web.opynio.com/empresa/${business.id}`);
    } else {
      console.log('⚠️  No se indexaron reseñas. Revisa los errores arriba.');
    }

  } catch (error) {
    console.error('\n❌ Error fatal:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// ============================================
// EJECUCIÓN
// ============================================

// Cargar reseñas desde archivo JSON si se proporciona
if (process.argv[3]) {
  const fs = require('fs');
  const filePath = process.argv[3];

  try {
    console.log(`📂 Cargando reseñas desde: ${filePath}`);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const loadedReviews = JSON.parse(fileContent);

    if (Array.isArray(loadedReviews)) {
      REVIEWS.splice(0, REVIEWS.length, ...loadedReviews);
      console.log(`✅ ${loadedReviews.length} reseñas cargadas desde archivo\n`);
    } else if (loadedReviews.reviews && Array.isArray(loadedReviews.reviews)) {
      REVIEWS.splice(0, REVIEWS.length, ...loadedReviews.reviews);
      console.log(`✅ ${loadedReviews.reviews.length} reseñas cargadas desde archivo\n`);
    } else {
      console.error('❌ Formato de archivo incorrecto. Debe ser un array de reseñas.');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error al leer archivo:', error.message);
    process.exit(1);
  }
}

// Ejecutar
indexAllReviews();
