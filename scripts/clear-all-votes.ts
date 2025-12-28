/**
 * Script para limpiar TODOS los votos de la base de datos
 *
 * ⚠️ PELIGRO: Este script eliminará TODOS los votos de review_votes
 *
 * Útil para:
 * - Volver a ejecutar el script de población desde cero
 * - Testing
 * - Resetear votos incorrectos
 */

import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Falta configuración: VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Crear interfaz de readline para input del usuario
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function main() {
  console.log('⚠️  ' + '='.repeat(60));
  console.log('⚠️  ADVERTENCIA: LIMPIEZA DE VOTOS');
  console.log('⚠️  ' + '='.repeat(60));
  console.log('');
  console.log('Este script eliminará TODOS los votos de la tabla review_votes.');
  console.log('Los contadores de helpful_votes y not_helpful_votes se resetearán a 0.');
  console.log('');
  console.log('⚠️  Esta operación NO se puede deshacer.');
  console.log('');

  try {
    // Obtener conteo actual de votos
    const { count, error: countError } = await supabase
      .from('review_votes')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      throw new Error(`Error obteniendo conteo de votos: ${countError.message}`);
    }

    console.log(`📊 Votos actuales en la base de datos: ${count || 0}`);
    console.log('');

    if (count === 0) {
      console.log('✅ No hay votos para eliminar. La base de datos ya está limpia.');
      rl.close();
      return;
    }

    // Confirmar con el usuario
    const answer = await askQuestion('¿Estás seguro de que quieres eliminar TODOS los votos? (escribe "SI" para confirmar): ');

    if (answer.trim().toLowerCase() !== 'si') {
      console.log('\n❌ Operación cancelada por el usuario.');
      rl.close();
      return;
    }

    console.log('\n🗑️  Eliminando votos...\n');

    // Eliminar todos los votos
    const { error: deleteError } = await supabase
      .from('review_votes')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Condición que siempre es verdadera

    if (deleteError) {
      throw new Error(`Error eliminando votos: ${deleteError.message}`);
    }

    console.log('✅ Votos eliminados exitosamente');

    // Los triggers deberían actualizar automáticamente los contadores,
    // pero por si acaso, los reseteamos manualmente
    console.log('\n🔄 Reseteando contadores en la tabla reviews...\n');

    const { error: updateError } = await supabase
      .from('reviews')
      .update({
        helpful_votes: 0,
        not_helpful_votes: 0,
      })
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Condición que siempre es verdadera

    if (updateError) {
      console.warn('⚠️  Advertencia: No se pudieron resetear los contadores automáticamente.');
      console.warn('   Los triggers deberían haberlo hecho. Si ves números incorrectos,');
      console.warn('   ejecuta este SQL manualmente:');
      console.warn('');
      console.warn('   UPDATE reviews SET helpful_votes = 0, not_helpful_votes = 0;');
      console.warn('');
    } else {
      console.log('✅ Contadores reseteados exitosamente');
    }

    // Verificar resultado final
    const { count: finalCount, error: finalCountError } = await supabase
      .from('review_votes')
      .select('*', { count: 'exact', head: true });

    if (finalCountError) {
      console.warn('⚠️  No se pudo verificar el conteo final');
    } else {
      console.log('\n' + '='.repeat(60));
      console.log('✅ LIMPIEZA COMPLETADA');
      console.log('='.repeat(60));
      console.log(`📊 Votos restantes: ${finalCount || 0}`);
      console.log('='.repeat(60));
      console.log('');
      console.log('💡 Ahora puedes ejecutar el script de población nuevamente:');
      console.log('   npm run populate-votes');
      console.log('');
    }

  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main().catch(console.error);
