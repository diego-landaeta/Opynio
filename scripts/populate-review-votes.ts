/**
 * Script para poblar votos de reseñas de forma controlada
 *
 * Características:
 * - Procesamiento por lotes para no saturar Supabase
 * - Protección especial para empresas premium (más votos positivos)
 * - Distribución realista de votos
 * - Rate limiting entre requests
 * - Retry logic para errores temporales
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Falta configuración: VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos');
  console.error('💡 Usa: VITE_SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx npm run populate-votes');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ==================== CONFIGURACIÓN ====================

interface Config {
  // Cuántos votos promedio por reseña
  minVotesPerReview: number;
  maxVotesPerReview: number;

  // Ratio de votos positivos vs negativos (0-1)
  // 0.8 = 80% positivos, 20% negativos
  defaultPositiveRatio: number;

  // Ratio especial para empresas premium (más positivos)
  premiumPositiveRatio: number;

  // Batch size - procesar N reseñas a la vez
  batchSize: number;

  // Delay entre batches (ms) para no saturar
  delayBetweenBatches: number;

  // Delay entre inserts dentro de un batch (ms)
  delayBetweenInserts: number;

  // Máximo de reintentos en caso de error
  maxRetries: number;

  // Planes considerados como premium
  premiumPlans: string[];
}

const CONFIG: Config = {
  minVotesPerReview: 3,
  maxVotesPerReview: 25,
  defaultPositiveRatio: 0.75,
  premiumPositiveRatio: 0.90,
  batchSize: 50,
  delayBetweenBatches: 2000,
  delayBetweenInserts: 100,
  maxRetries: 3,
  premiumPlans: ['starter', 'growth', 'pro', 'enterprise'],
};

// ==================== UTILIDADES ====================

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const random = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const getRandomBoolean = (trueRatio: number): boolean => {
  return Math.random() < trueRatio;
};

// ==================== FUNCIONES PRINCIPALES ====================

interface Review {
  id: string;
  business_id: string;
}

interface Business {
  id: string;
  plan: string | null;
}

interface VoteToInsert {
  review_id: string;
  user_id: string;
  is_helpful: boolean;
}

/**
 * Obtiene todas las reseñas aprobadas
 */
async function getAllApprovedReviews(): Promise<Review[]> {
  console.log('📋 Obteniendo reseñas aprobadas...');

  const { data, error } = await supabase
    .from('reviews')
    .select('id, business_id')
    .eq('status', 'approved');

  if (error) {
    throw new Error(`Error obteniendo reseñas: ${error.message}`);
  }

  console.log(`✅ Encontradas ${data?.length || 0} reseñas aprobadas`);
  return data || [];
}

/**
 * Obtiene el plan de una empresa
 */
async function getBusinessPlan(businessId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('businesses')
    .select('plan')
    .eq('id', businessId)
    .single();

  if (error) {
    console.warn(`⚠️  No se pudo obtener el plan de la empresa ${businessId}`);
    return null;
  }

  return data?.plan || null;
}

/**
 * Crea usuarios ficticios para los votos
 * Retorna un array de user_ids
 */
async function getOrCreateVoterUsers(count: number): Promise<string[]> {
  console.log(`👥 Verificando usuarios para votos...`);

  // Intentamos obtener usuarios existentes primero
  const { data: existingUsers, error: fetchError } = await supabase
    .from('profiles')
    .select('id')
    .limit(count);

  if (fetchError) {
    console.error('❌ Error obteniendo usuarios existentes:', fetchError.message);
  }

  const userIds: string[] = existingUsers?.map(u => u.id) || [];

  console.log(`✅ Usando ${userIds.length} usuarios existentes para generar votos`);

  if (userIds.length === 0) {
    throw new Error('❌ No hay usuarios en la base de datos. Crea algunos usuarios primero.');
  }

  return userIds;
}

/**
 * Genera votos para una reseña
 */
function generateVotesForReview(
  review: Review,
  availableUserIds: string[],
  isPremium: boolean
): VoteToInsert[] {
  const voteCount = random(CONFIG.minVotesPerReview, CONFIG.maxVotesPerReview);
  const positiveRatio = isPremium ? CONFIG.premiumPositiveRatio : CONFIG.defaultPositiveRatio;

  const votes: VoteToInsert[] = [];
  const usedUserIds = new Set<string>();

  // Asegurarnos de no usar más usuarios de los disponibles
  const maxVotes = Math.min(voteCount, availableUserIds.length);

  for (let i = 0; i < maxVotes; i++) {
    // Seleccionar un usuario aleatorio que no haya votado esta reseña
    let userId: string;
    let attempts = 0;
    do {
      userId = availableUserIds[random(0, availableUserIds.length - 1)];
      attempts++;
    } while (usedUserIds.has(userId) && attempts < 100);

    if (usedUserIds.has(userId)) {
      // Si después de 100 intentos no encontramos un usuario único, saltamos
      continue;
    }

    usedUserIds.add(userId);

    votes.push({
      review_id: review.id,
      user_id: userId,
      is_helpful: getRandomBoolean(positiveRatio),
    });
  }

  return votes;
}

/**
 * Inserta votos con retry logic
 */
async function insertVotesWithRetry(
  votes: VoteToInsert[],
  retryCount = 0
): Promise<void> {
  try {
    const { error } = await supabase
      .from('review_votes')
      .insert(votes);

    if (error) {
      // Si es un error de duplicado, lo ignoramos
      if (error.code === '23505') {
        console.log('⚠️  Algunos votos ya existían (duplicados), continuando...');
        return;
      }
      throw error;
    }
  } catch (error: any) {
    if (retryCount < CONFIG.maxRetries) {
      console.log(`⚠️  Error insertando votos, reintento ${retryCount + 1}/${CONFIG.maxRetries}...`);
      await sleep(1000 * (retryCount + 1)); // Backoff exponencial
      return insertVotesWithRetry(votes, retryCount + 1);
    }
    throw new Error(`Error insertando votos después de ${CONFIG.maxRetries} intentos: ${error.message}`);
  }
}

/**
 * Procesa un batch de reseñas
 */
async function processBatch(
  reviews: Review[],
  businessPlans: Map<string, string | null>,
  availableUserIds: string[]
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const review of reviews) {
    try {
      const businessPlan = businessPlans.get(review.business_id);
      const isPremium = businessPlan ? CONFIG.premiumPlans.includes(businessPlan) : false;

      const votes = generateVotesForReview(review, availableUserIds, isPremium);

      if (votes.length > 0) {
        await insertVotesWithRetry(votes);
        success++;

        const helpfulCount = votes.filter(v => v.is_helpful).length;
        const notHelpfulCount = votes.length - helpfulCount;
        console.log(
          `  ✓ Reseña ${review.id.substring(0, 8)}... - ` +
          `${votes.length} votos (👍 ${helpfulCount}, 👎 ${notHelpfulCount}) ` +
          `${isPremium ? '⭐ PREMIUM' : ''}`
        );
      }

      await sleep(CONFIG.delayBetweenInserts);
    } catch (error: any) {
      console.error(`  ✗ Error en reseña ${review.id}:`, error.message);
      failed++;
    }
  }

  return { success, failed };
}

/**
 * Función principal
 */
async function main() {
  console.log('🚀 Iniciando población de votos en reseñas...\n');
  console.log('⚙️  Configuración:');
  console.log(`   - Votos por reseña: ${CONFIG.minVotesPerReview}-${CONFIG.maxVotesPerReview}`);
  console.log(`   - Ratio positivo normal: ${(CONFIG.defaultPositiveRatio * 100).toFixed(0)}%`);
  console.log(`   - Ratio positivo premium: ${(CONFIG.premiumPositiveRatio * 100).toFixed(0)}%`);
  console.log(`   - Batch size: ${CONFIG.batchSize} reseñas`);
  console.log(`   - Delay entre batches: ${CONFIG.delayBetweenBatches}ms`);
  console.log(`   - Delay entre inserts: ${CONFIG.delayBetweenInserts}ms\n`);

  try {
    // 1. Obtener todas las reseñas
    const reviews = await getAllApprovedReviews();

    if (reviews.length === 0) {
      console.log('⚠️  No hay reseñas para procesar');
      return;
    }

    // 2. Obtener usuarios disponibles
    const availableUserIds = await getOrCreateVoterUsers(1000);

    if (availableUserIds.length < 10) {
      console.warn('⚠️  Hay muy pocos usuarios disponibles. Los resultados pueden no ser realistas.');
    }

    // 3. Obtener planes de todas las empresas únicas
    console.log('\n📊 Obteniendo planes de empresas...');
    const uniqueBusinessIds = [...new Set(reviews.map(r => r.business_id))];
    const businessPlans = new Map<string, string | null>();

    for (const businessId of uniqueBusinessIds) {
      const plan = await getBusinessPlan(businessId);
      businessPlans.set(businessId, plan);
    }

    const premiumCount = Array.from(businessPlans.values()).filter(
      plan => plan && CONFIG.premiumPlans.includes(plan)
    ).length;

    console.log(`✅ ${uniqueBusinessIds.length} empresas (${premiumCount} premium)\n`);

    // 4. Procesar en batches
    console.log(`📦 Procesando ${reviews.length} reseñas en batches de ${CONFIG.batchSize}...\n`);

    const totalBatches = Math.ceil(reviews.length / CONFIG.batchSize);
    let totalSuccess = 0;
    let totalFailed = 0;

    for (let i = 0; i < reviews.length; i += CONFIG.batchSize) {
      const batchNumber = Math.floor(i / CONFIG.batchSize) + 1;
      const batch = reviews.slice(i, i + CONFIG.batchSize);

      console.log(`\n📦 Batch ${batchNumber}/${totalBatches} (${batch.length} reseñas):`);

      const { success, failed } = await processBatch(batch, businessPlans, availableUserIds);

      totalSuccess += success;
      totalFailed += failed;

      console.log(`\n   Batch completado: ${success} exitosas, ${failed} fallidas`);

      // Delay entre batches (excepto en el último)
      if (i + CONFIG.batchSize < reviews.length) {
        console.log(`\n⏳ Esperando ${CONFIG.delayBetweenBatches}ms antes del siguiente batch...`);
        await sleep(CONFIG.delayBetweenBatches);
      }
    }

    // 5. Resumen final
    console.log('\n' + '='.repeat(60));
    console.log('✅ PROCESO COMPLETADO');
    console.log('='.repeat(60));
    console.log(`📊 Total de reseñas procesadas: ${reviews.length}`);
    console.log(`✓  Exitosas: ${totalSuccess}`);
    console.log(`✗  Fallidas: ${totalFailed}`);
    console.log(`📈 Tasa de éxito: ${((totalSuccess / reviews.length) * 100).toFixed(1)}%`);
    console.log('='.repeat(60) + '\n');

    if (totalFailed > 0) {
      console.log('⚠️  Algunas reseñas fallaron. Revisa los logs arriba para más detalles.');
    }

  } catch (error: any) {
    console.error('\n❌ ERROR FATAL:', error.message);
    process.exit(1);
  }
}

// Ejecutar
main().catch(console.error);
