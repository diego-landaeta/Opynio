/**
 * Script para actualizar las categorías en todos los archivos de i18n
 *
 * Este script actualiza la sección "categories" en todos los archivos de locales
 * para reflejar las nuevas categorías normalizadas en español.
 */

// Nuevas categorías normalizadas (keys en español estándar)
const NEW_CATEGORIES_ES = {
  'Restaurantes y Ocio': 'Restaurantes y Ocio',
  'Salud y Bienestar': 'Salud y Bienestar',
  'Compras y Retail': 'Compras y Retail',
  'Servicios para el Hogar': 'Servicios para el Hogar',
  'Servicios Profesionales y de Empresa': 'Servicios Profesionales y de Empresa',
  'Automoción': 'Automoción',
  'Educación y Formación': 'Educación y Formación',
  'Finanzas y Legal': 'Finanzas y Legal',
  'Viajes y Transporte': 'Viajes y Transporte',
  'Mascotas': 'Mascotas',
  'Eventos': 'Eventos',
  'Sectores Emergentes y Otros': 'Sectores Emergentes y Otros',
};

const NEW_CATEGORIES_EN = {
  'Restaurantes y Ocio': 'Restaurants and Leisure',
  'Salud y Bienestar': 'Health and Wellness',
  'Compras y Retail': 'Shopping and Retail',
  'Servicios para el Hogar': 'Home Services',
  'Servicios Profesionales y de Empresa': 'Professional and Business Services',
  'Automoción': 'Automotive',
  'Educación y Formación': 'Education and Training',
  'Finanzas y Legal': 'Finance and Legal',
  'Viajes y Transporte': 'Travel and Transport',
  'Mascotas': 'Pets',
  'Eventos': 'Events',
  'Sectores Emergentes y Otros': 'Emerging Sectors and Other',
};

const NEW_CATEGORIES_PT = {
  'Restaurantes y Ocio': 'Restaurantes e Lazer',
  'Salud y Bienestar': 'Saúde e Bem-Estar',
  'Compras y Retail': 'Compras e Varejo',
  'Servicios para el Hogar': 'Serviços Domésticos',
  'Servicios Profesionales y de Empresa': 'Serviços Profissionais e Empresariais',
  'Automoción': 'Automotivo',
  'Educación y Formación': 'Educação e Formação',
  'Finanzas y Legal': 'Finanças e Jurídico',
  'Viajes y Transporte': 'Viagens e Transporte',
  'Mascotas': 'Animais de Estimação',
  'Eventos': 'Eventos',
  'Sectores Emergentes y Otros': 'Setores Emergentes e Outros',
};

const NEW_CATEGORIES_FR = {
  'Restaurantes y Ocio': 'Restaurants et Loisirs',
  'Salud y Bienestar': 'Santé et Bien-être',
  'Compras y Retail': 'Achats et Commerce',
  'Servicios para el Hogar': 'Services à Domicile',
  'Servicios Profesionales y de Empresa': 'Services Professionnels et d\'Entreprise',
  'Automoción': 'Automobile',
  'Educación y Formación': 'Éducation et Formation',
  'Finanzas y Legal': 'Finance et Juridique',
  'Viajes y Transporte': 'Voyages et Transport',
  'Mascotas': 'Animaux de Compagnie',
  'Eventos': 'Événements',
  'Sectores Emergentes y Otros': 'Secteurs Émergents et Autres',
};

const NEW_CATEGORIES_IT = {
  'Restaurantes y Ocio': 'Ristoranti e Tempo Libero',
  'Salud y Bienestar': 'Salute e Benessere',
  'Compras y Retail': 'Acquisti e Vendita al Dettaglio',
  'Servicios para el Hogar': 'Servizi per la Casa',
  'Servicios Profesionales y de Empresa': 'Servizi Professionali e Aziendali',
  'Automoción': 'Automotive',
  'Educación y Formación': 'Istruzione e Formazione',
  'Finanzas y Legal': 'Finanza e Legale',
  'Viajes y Transporte': 'Viaggi e Trasporti',
  'Mascotas': 'Animali Domestici',
  'Eventos': 'Eventi',
  'Sectores Emergentes y Otros': 'Settori Emergenti e Altri',
};

const NEW_CATEGORIES_DE = {
  'Restaurantes y Ocio': 'Restaurants und Freizeit',
  'Salud y Bienestar': 'Gesundheit und Wellness',
  'Compras y Retail': 'Einkaufen und Einzelhandel',
  'Servicios para el Hogar': 'Haushaltsdienstleistungen',
  'Servicios Profesionales y de Empresa': 'Professionelle und Unternehmensdienstleistungen',
  'Automoción': 'Automobil',
  'Educación y Formación': 'Bildung und Ausbildung',
  'Finanzas y Legal': 'Finanzen und Recht',
  'Viajes y Transporte': 'Reisen und Transport',
  'Mascotas': 'Haustiere',
  'Eventos': 'Veranstaltungen',
  'Sectores Emergentes y Otros': 'Aufstrebende Sektoren und Andere',
};

const NEW_CATEGORIES_CN = {
  'Restaurantes y Ocio': '餐厅和休闲',
  'Salud y Bienestar': '健康与养生',
  'Compras y Retail': '购物和零售',
  'Servicios para el Hogar': '家庭服务',
  'Servicios Profesionales y de Empresa': '专业和商业服务',
  'Automoción': '汽车',
  'Educación y Formación': '教育和培训',
  'Finanzas y Legal': '金融和法律',
  'Viajes y Transporte': '旅游和交通',
  'Mascotas': '宠物',
  'Eventos': '活动',
  'Sectores Emergentes y Otros': '新兴行业和其他',
};

const NEW_CATEGORIES_CA = {
  'Restaurantes y Ocio': 'Restaurants i Oci',
  'Salud y Bienestar': 'Salut i Benestar',
  'Compras y Retail': 'Compres i Comerç',
  'Servicios para el Hogar': 'Serveis per a la Llar',
  'Servicios Profesionales y de Empresa': 'Serveis Professionals i d\'Empresa',
  'Automoción': 'Automoció',
  'Educación y Formación': 'Educació i Formació',
  'Finanzas y Legal': 'Finances i Legal',
  'Viajes y Transporte': 'Viatges i Transport',
  'Mascotas': 'Mascotes',
  'Eventos': 'Esdeveniments',
  'Sectores Emergentes y Otros': 'Sectors Emergents i Altres',
};

const CATEGORY_TRANSLATIONS = {
  es: NEW_CATEGORIES_ES,
  br: NEW_CATEGORIES_PT,
  pt: NEW_CATEGORIES_PT,
  en: NEW_CATEGORIES_EN,
  fr: NEW_CATEGORIES_FR,
  it: NEW_CATEGORIES_IT,
  de: NEW_CATEGORIES_DE,
  cn: NEW_CATEGORIES_CN,
  ca: NEW_CATEGORIES_CA,
};

console.log('📝 Generando código de categorías actualizado para cada idioma...\n');

Object.entries(CATEGORY_TRANSLATIONS).forEach(([lang, translations]) => {
  console.log(`\n=== ${lang.toUpperCase()} ===`);
  console.log('categories: {');
  Object.entries(translations).forEach(([key, value]) => {
    // Crear una key válida para TypeScript (sin espacios ni caracteres especiales)
    const tsKey = key
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');

    console.log(`  ${tsKey}: "${value}",`);
  });
  console.log('},');
});

console.log('\n✅ Copia y pega estas secciones "categories" en cada archivo de locale correspondiente.');
