/**
 * Script para migrar y normalizar categorías de empresas
 *
 * Este script:
 * 1. Lee todas las empresas con sus categorías actuales
 * 2. Aplica el mapeo de normalización
 * 3. Actualiza las categorías en la base de datos
 * 4. Genera un reporte de los cambios realizados
 */

import { createClient } from '@supabase/supabase-js';
import { CATEGORY_MAPPING } from './category-mapping.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Falta configuración: VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Configuración
const DRY_RUN = process.argv.includes('--dry-run'); // Modo prueba sin modificar BD
const BATCH_SIZE = 50; // Procesar en lotes de 50 empresas
const DELAY_BETWEEN_BATCHES = 1000; // 1 segundo entre lotes

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface Business {
  id: string;
  name: string;
  category: string;
}

interface MigrationResult {
  businessId: string;
  businessName: string;
  oldCategory: string;
  newCategory: string;
  changed: boolean;
}

/**
 * Obtiene todas las empresas con categoría
 */
async function getAllBusinessesWithCategory(): Promise<Business[]> {
  console.log('📋 Obteniendo todas las empresas...\n');

  const { data, error } = await supabase
    .from('businesses')
    .select('id, name, category')
    .not('category', 'is', null);

  if (error) {
    throw new Error(`Error obteniendo empresas: ${error.message}`);
  }

  console.log(`✅ Encontradas ${data?.length || 0} empresas con categoría\n`);
  return data || [];
}

/**
 * Normaliza una categoría según el mapeo
 */
function normalizeCategory(oldCategory: string): string {
  // Si está en el mapeo, usar el valor mapeado
  if (CATEGORY_MAPPING[oldCategory]) {
    return CATEGORY_MAPPING[oldCategory];
  }

  // Si no está en el mapeo pero ya tiene el formato correcto, mantenerla
  if (oldCategory.includes(': ') && !oldCategory.includes('_') && oldCategory === oldCategory.trim()) {
    console.log(`⚠️  Categoría no mapeada (se mantiene): "${oldCategory}"`);
    return oldCategory;
  }

  // Si está vacía o es solo espacios
  if (!oldCategory || oldCategory.trim() === '') {
    return 'Sin Categoría';
  }

  // Si no cumple ningún criterio, marcarla para revisión manual
  console.log(`⚠️  Categoría desconocida (se mantiene): "${oldCategory}"`);
  return oldCategory;
}

/**
 * Actualiza la categoría de una empresa
 */
async function updateBusinessCategory(businessId: string, newCategory: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('businesses')
      .update({ category: newCategory })
      .eq('id', businessId);

    if (error) {
      throw error;
    }

    return true;
  } catch (error: any) {
    console.error(`❌ Error actualizando empresa ${businessId}:`, error.message);
    return false;
  }
}

/**
 * Procesa un lote de empresas
 */
async function processBatch(businesses: Business[]): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];

  for (const business of businesses) {
    const oldCategory = business.category;
    const newCategory = normalizeCategory(oldCategory);
    const changed = oldCategory !== newCategory;

    let updateSuccess = true;

    if (changed && !DRY_RUN) {
      updateSuccess = await updateBusinessCategory(business.id, newCategory);
      await sleep(50); // Pequeño delay entre updates individuales
    }

    results.push({
      businessId: business.id,
      businessName: business.name,
      oldCategory,
      newCategory,
      changed: changed && updateSuccess
    });

    if (changed) {
      const icon = DRY_RUN ? '🔍' : (updateSuccess ? '✓' : '✗');
      console.log(`  ${icon} ${business.name.substring(0, 40).padEnd(40)} | ${oldCategory} → ${newCategory}`);
    }
  }

  return results;
}

/**
 * Genera reporte de la migración
 */
function generateReport(results: MigrationResult[]) {
  const totalBusinesses = results.length;
  const changedBusinesses = results.filter(r => r.changed).length;
  const unchangedBusinesses = totalBusinesses - changedBusinesses;

  // Agrupar cambios por transformación
  const transformations = new Map<string, number>();
  results.forEach(r => {
    if (r.changed) {
      const key = `${r.oldCategory} → ${r.newCategory}`;
      transformations.set(key, (transformations.get(key) || 0) + 1);
    }
  });

  // Contar categorías finales
  const finalCategories = new Map<string, number>();
  results.forEach(r => {
    const category = r.newCategory;
    finalCategories.set(category, (finalCategories.get(category) || 0) + 1);
  });

  console.log('\n' + '═'.repeat(80));
  console.log('📊 REPORTE DE MIGRACIÓN');
  console.log('═'.repeat(80));
  console.log(`\n📈 Estadísticas:`);
  console.log(`   - Total de empresas: ${totalBusinesses}`);
  console.log(`   - Empresas modificadas: ${changedBusinesses} (${((changedBusinesses/totalBusinesses)*100).toFixed(1)}%)`);
  console.log(`   - Empresas sin cambios: ${unchangedBusinesses} (${((unchangedBusinesses/totalBusinesses)*100).toFixed(1)}%)`);

  console.log(`\n🔄 Transformaciones realizadas:`);
  const sortedTransformations = Array.from(transformations.entries())
    .sort((a, b) => b[1] - a[1]);

  sortedTransformations.forEach(([transformation, count]) => {
    console.log(`   ${count.toString().padStart(3)} empresas | ${transformation}`);
  });

  console.log(`\n📁 Categorías finales (${finalCategories.size} únicas):`);
  const sortedFinalCategories = Array.from(finalCategories.entries())
    .sort((a, b) => b[1] - a[1]);

  sortedFinalCategories.forEach(([category, count], index) => {
    console.log(`   ${(index + 1).toString().padStart(2)}. ${category.padEnd(60)} (${count} empresas)`);
  });

  console.log('\n' + '═'.repeat(80));
}

/**
 * Función principal
 */
async function main() {
  console.log('🚀 Iniciando migración de categorías...\n');

  if (DRY_RUN) {
    console.log('⚠️  MODO DRY-RUN: No se realizarán cambios en la base de datos\n');
  }

  console.log('⚙️  Configuración:');
  console.log(`   - Batch size: ${BATCH_SIZE} empresas`);
  console.log(`   - Delay entre batches: ${DELAY_BETWEEN_BATCHES}ms`);
  console.log(`   - Total de mapeos definidos: ${Object.keys(CATEGORY_MAPPING).length}`);
  console.log('');

  try {
    // 1. Obtener todas las empresas
    const businesses = await getAllBusinessesWithCategory();

    if (businesses.length === 0) {
      console.log('⚠️  No hay empresas para procesar');
      return;
    }

    // 2. Procesar en lotes
    const allResults: MigrationResult[] = [];
    const totalBatches = Math.ceil(businesses.length / BATCH_SIZE);

    console.log(`📦 Procesando ${businesses.length} empresas en ${totalBatches} lotes...\n`);

    for (let i = 0; i < businesses.length; i += BATCH_SIZE) {
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const batch = businesses.slice(i, i + BATCH_SIZE);

      console.log(`\n📦 Lote ${batchNumber}/${totalBatches} (${batch.length} empresas):`);

      const batchResults = await processBatch(batch);
      allResults.push(...batchResults);

      // Delay entre lotes (excepto en el último)
      if (i + BATCH_SIZE < businesses.length) {
        await sleep(DELAY_BETWEEN_BATCHES);
      }
    }

    // 3. Generar reporte
    generateReport(allResults);

    console.log('\n✅ Migración completada exitosamente\n');

    if (DRY_RUN) {
      console.log('💡 Para aplicar los cambios, ejecuta el script sin --dry-run:\n');
      console.log('   npx tsx scripts/migrate-categories.ts\n');
    }

  } catch (error: any) {
    console.error('\n❌ ERROR FATAL:', error.message);
    process.exit(1);
  }
}

// Ejecutar
main().catch(console.error);
