import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Falta configuración: VITE_SUPABASE_URL y (SUPABASE_SERVICE_ROLE_KEY o VITE_SUPABASE_ANON_KEY) son requeridos');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function listCategories() {
  try {
    console.log('🔍 Obteniendo todas las categorías...\n');

    const { data, error } = await supabase
      .from('businesses')
      .select('category')
      .not('category', 'is', null);

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    // Agrupar por categoría y contar
    const categoryCount = new Map<string, number>();

    data.forEach(business => {
      const category = business.category;
      categoryCount.set(category, (categoryCount.get(category) || 0) + 1);
    });

    // Ordenar por cantidad
    const sortedCategories = Array.from(categoryCount.entries())
      .sort((a, b) => b[1] - a[1]);

    // Mostrar resultados
    console.log(`📊 Total de categorías únicas: ${sortedCategories.length}\n`);
    console.log('═'.repeat(80));

    sortedCategories.forEach(([category, count], index) => {
      console.log(`${index + 1}. ${category} (${count} empresas)`);
    });

    console.log('\n' + '═'.repeat(80));
    console.log(`\n✅ Total de empresas con categoría: ${data.length}`);

  } catch (error) {
    console.error('❌ Error inesperado:', error);
  }
}

listCategories();
