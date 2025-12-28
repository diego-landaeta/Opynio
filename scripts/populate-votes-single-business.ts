/**
 * Script para poblar votos de una empresa específica
 * Útil para testing o para empresas individuales
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUSINESS_ID = process.argv[2]; // Obtener business_id del primer argumento

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Falta configuración: VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos');
  process.exit(1);
}

if (!BUSINESS_ID) {
  console.error('❌ Debes proporcionar un business_id como argumento');
  console.error('💡 Uso: npm run populate-votes-single <business_id>');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface Config {
  minVotesPerReview: number;
  maxVotesPerReview: number;
  positiveRatio: number;
  delayBetweenInserts: number;
}

const CONFIG: Config = {
  minVotesPerReview: 5,
  maxVotesPerReview: 20,
  positiveRatio: 0.80, // 80% positivos
  delayBetweenInserts: 150,
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const random = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

async function main() {
  console.log(`🚀 Poblando votos para la empresa: ${BUSINESS_ID}\n`);

  try {
    // 1. Verificar que la empresa existe
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id, name, plan')
      .eq('id', BUSINESS_ID)
      .single();

    if (businessError || !business) {
      throw new Error(`Empresa no encontrada: ${BUSINESS_ID}`);
    }

    console.log(`📊 Empresa: ${business.name}`);
    console.log(`📦 Plan: ${business.plan || 'free'}\n`);

    // 2. Obtener reseñas de la empresa
    const { data: reviews, error: reviewsError } = await supabase
      .from('reviews')
      .select('id')
      .eq('business_id', BUSINESS_ID)
      .eq('status', 'approved');

    if (reviewsError) {
      throw new Error(`Error obteniendo reseñas: ${reviewsError.message}`);
    }

    if (!reviews || reviews.length === 0) {
      console.log('⚠️  Esta empresa no tiene reseñas aprobadas');
      return;
    }

    console.log(`📋 Encontradas ${reviews.length} reseñas aprobadas\n`);

    // 3. Obtener usuarios disponibles
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id')
      .limit(100);

    if (usersError || !users || users.length === 0) {
      throw new Error('No hay usuarios disponibles para crear votos');
    }

    const userIds = users.map(u => u.id);
    console.log(`👥 Usando ${userIds.length} usuarios para los votos\n`);

    // 4. Procesar cada reseña
    let totalVotes = 0;
    let totalHelpful = 0;
    let totalNotHelpful = 0;

    for (let i = 0; i < reviews.length; i++) {
      const review = reviews[i];
      const voteCount = random(CONFIG.minVotesPerReview, CONFIG.maxVotesPerReview);

      console.log(`📝 Reseña ${i + 1}/${reviews.length} (${review.id.substring(0, 8)}...):`);

      const votesToInsert = [];
      const usedUserIds = new Set<string>();

      for (let j = 0; j < voteCount; j++) {
        // Seleccionar usuario aleatorio que no haya votado esta reseña
        let userId: string;
        let attempts = 0;
        do {
          userId = userIds[random(0, userIds.length - 1)];
          attempts++;
        } while (usedUserIds.has(userId) && attempts < 50);

        if (usedUserIds.has(userId)) continue;

        usedUserIds.add(userId);

        const isHelpful = Math.random() < CONFIG.positiveRatio;
        votesToInsert.push({
          review_id: review.id,
          user_id: userId,
          is_helpful: isHelpful,
        });

        if (isHelpful) totalHelpful++;
        else totalNotHelpful++;
      }

      // Insertar votos
      if (votesToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('review_votes')
          .insert(votesToInsert);

        if (insertError && insertError.code !== '23505') {
          console.error(`  ✗ Error: ${insertError.message}`);
        } else {
          const helpful = votesToInsert.filter(v => v.is_helpful).length;
          const notHelpful = votesToInsert.length - helpful;
          console.log(`  ✓ ${votesToInsert.length} votos (👍 ${helpful}, 👎 ${notHelpful})`);
          totalVotes += votesToInsert.length;
        }
      }

      await sleep(CONFIG.delayBetweenInserts);
    }

    // 5. Resumen
    console.log('\n' + '='.repeat(60));
    console.log('✅ PROCESO COMPLETADO');
    console.log('='.repeat(60));
    console.log(`📊 Empresa: ${business.name}`);
    console.log(`📝 Reseñas procesadas: ${reviews.length}`);
    console.log(`🗳️  Total de votos: ${totalVotes}`);
    console.log(`👍 Votos útiles: ${totalHelpful} (${((totalHelpful / totalVotes) * 100).toFixed(1)}%)`);
    console.log(`👎 Votos no útiles: ${totalNotHelpful} (${((totalNotHelpful / totalVotes) * 100).toFixed(1)}%)`);
    console.log('='.repeat(60) + '\n');

  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
