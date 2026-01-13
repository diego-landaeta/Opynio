// Replace with your actual Supabase project URL and anon key
// The user provided these:
// Project ID: hvtrrhxeqrsnjxhngdsj
// Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2dHJyaHhlcXJzbmp4aG5nZHNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2ODU4MjAsImV4cCI6MjA3MDI2MTgyMH0.9pkukI3fhJ3ce8RQyyrD88mZ7oEk7VcmYLQCvgE07vU
export const SUPABASE_URL = 'https://hvtrrhxeqrsnjxhngdsj.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2dHJyaHhlcXJzbmp4aG5nZHNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2ODU4MjAsImV4cCI6MjA3MDI2MTgyMH0.9pkukI3fhJ3ce8RQyyrD88mZ7oEk7VcmYLQCvgE07vU';

// Replace with your actual Stripe publishable key
export const STRIPE_PUBLISHABLE_KEY = 'pk_live_51SH1BWRJqlZctcvhLsSCz7wgkGP7LUJ0UlPuIm58v65IbCLcRaC6h6ZQNp7cWWk5GwqzJA1S8zf58DynCLqMYf1x00lSMzGhbM';

// Replace with your actual Stripe Price IDs from your Stripe Dashboard
// IMPORTANT: These are PRICE IDs (price_...), NOT PRODUCT IDs (prod_...).
export const STRIPE_PRICE_IDS = {
  starter: {
    monthly: 'price_1SIEGvRJqlZctcvhh3VMcupC',
    annual: 'price_1SIESFRJqlZctcvhzjdQHBzL',
  },
  growth: {
    monthly: 'price_1SIEJeRJqlZctcvhrzuA4wR8',
    annual: 'price_1SIET4RJqlZctcvhy9Rwy8ka',
  },
  pro: {
    monthly: 'price_1SIELiRJqlZctcvhQ3xP8rwa',
    annual: 'price_1SIEU1RJqlZctcvhRze5EeNR',
  },
};

export const HOMEPAGE_CATEGORIES = [
    { key: 'cat_restaurants_and_food', icon: 'fa-utensils' },
    { key: 'cat_education_and_training', icon: 'fa-graduation-cap' },
    { key: 'cat_health_and_wellness', icon: 'fa-heart-pulse' },
    { key: 'cat_shopping_and_stores', icon: 'fa-bag-shopping' },
    { key: 'cat_automotive', icon: 'fa-car' },
    { key: 'cat_travel_and_leisure', icon: 'fa-plane-departure' },
];

// Mapeo de claves del homepage a claves de CATEGORIES
export const HOMEPAGE_TO_CATEGORY_MAP: { [key: string]: string } = {
    'cat_restaurants_and_food': 'Restaurantes y Ocio',
    'cat_education_and_training': 'Educación y Formación',
    'cat_health_and_wellness': 'Salud y Bienestar',
    'cat_shopping_and_stores': 'Compras y Retail',
    'cat_automotive': 'Automoción',
    'cat_travel_and_leisure': 'Viajes y Transporte',
};

// Main categories (Spanish format as stored in database)
// These are used for filtering - they will match the beginning of category strings in DB
export const CATEGORIES: { [key: string]: string[] } = {
    'Restaurantes y Ocio': [
        'restaurantes',
        'bares_y_cafeterias',
    ],
    'Salud y Bienestar': [
        'clinicas_dentales',
        'fisioterapia_y_rehabilitacion',
        'clinicas_y_hospitales',
        'psicologia_y_terapia',
        'peluquerias_y_salones_de_belleza',
        'nutricion_y_dietetica',
        'spas_y_centros_de_bienestar',
    ],
    'Mascotas': [
        'clinicas_veterinarias',
    ],
    'Servicios Profesionales y de Empresa': [
        'servicios_legales_y_abogados',
        'asesoria_fiscal_y_contable',
        'desarrollo_de_software_y_servicios_ti',
        'consultoria_de_negocios',
        'agencias_de_marketing_y_publicidad',
        'recruitment',
    ],
    'Educación y Formación': [
        'formacion_profesional_y_cursos_online',
        'academias_de_idiomas',
        'universidades_y_educacion_superior',
        'colegios_y_escuelas',
        'clases_particulares_y_tutorias',
    ],
    'Servicios para el Hogar': [
        'fontaneria_electricidad_y_cerrajeria',
        'jardineria_y_paisajismo',
        'mudanzas_y_almacenamiento',
        'reformas_y_construccion',
        'climatizacion_aerotermia_y_energia_solar',
    ],
    'Compras y Retail': [
        'supermercados_y_tiendas_de_alimentacion',
        'tiendas_de_electronica_y_tecnologia',
    ],
    'Automoción': [
        'talleres_mecanicos_y_reparacion',
    ],
    'Viajes y Transporte': [
        'hoteles_y_alojamientos',
        'agencias_de_viajes_y_touroperadores',
    ],
    'Eventos': [
        'salones_y_espacios_para_eventos',
        'organizacion_de_bodas_y_eventos',
        'alquiler_de_equipamiento_para_eventos',
    ],
    'Sectores Emergentes y Otros': [
        'realidad_virtual_y_aumentada',
    ],
};

export const LANGUAGES = [
  { code: 'es', name: 'Español', flag: 'https://flagcdn.com/es.svg' },
  { code: 'en', name: 'English', flag: 'https://flagcdn.com/gb.svg' },
  { code: 'br', name: 'Português', flag: 'https://flagcdn.com/br.svg' },
  { code: 'ca', name: 'Català', flag: 'https://flagcdn.com/ad.svg' },
  { code: 'fr', name: 'Français', flag: 'https://flagcdn.com/fr.svg' },
  { code: 'de', name: 'Deutsch', flag: 'https://flagcdn.com/de.svg' },
  { code: 'it', name: 'Italiano', flag: 'https://flagcdn.com/it.svg' },
  { code: 'cn', name: '简体中文', flag: 'https://flagcdn.com/cn.svg' },
];

export const COUNTRIES = [
  { code: 'ES', name: 'España', flag: 'https://flagcdn.com/es.svg' },
  { code: 'US', name: 'United States', flag: 'https://flagcdn.com/us.svg' },
  { code: 'GB', name: 'United Kingdom', flag: 'https://flagcdn.com/gb.svg' },
  { code: 'MX', name: 'México', flag: 'https://flagcdn.com/mx.svg' },
  { code: 'BR', name: 'Brasil', flag: 'https://flagcdn.com/br.svg' },
  { code: 'CO', name: 'Colombia', flag: 'https://flagcdn.com/co.svg' },
  { code: 'AR', name: 'Argentina', flag: 'https://flagcdn.com/ar.svg' },
  { code: 'PE', name: 'Perú', flag: 'https://flagcdn.com/pe.svg' },
  { code: 'CL', name: 'Chile', flag: 'https://flagcdn.com/cl.svg' },
  { code: 'EC', name: 'Ecuador', flag: 'https://flagcdn.com/ec.svg' },
  { code: 'GT', name: 'Guatemala', flag: 'https://flagcdn.com/gt.svg' },
  { code: 'CR', name: 'Costa Rica', flag: 'https://flagcdn.com/cr.svg' },
  { code: 'PA', name: 'Panamá', flag: 'https://flagcdn.com/pa.svg' },
  { code: 'UY', name: 'Uruguay', flag: 'https://flagcdn.com/uy.svg' },
  { code: 'PT', name: 'Portugal', flag: 'https://flagcdn.com/pt.svg' },
  { code: 'FR', name: 'France', flag: 'https://flagcdn.com/fr.svg' },
  { code: 'DE', name: 'Deutschland', flag: 'https://flagcdn.com/de.svg' },
  { code: 'IT', name: 'Italia', flag: 'https://flagcdn.com/it.svg' },
  { code: 'AD', name: 'Andorra', flag: 'https://flagcdn.com/ad.svg' },
];

export const SEDE_COUNTRIES = [
  { code: 'ES', name: 'España', flag: 'https://flagcdn.com/es.svg', disabled: false },
  { code: 'US', name: 'United States', flag: 'https://flagcdn.com/us.svg', disabled: false },
  { code: 'GB', name: 'United Kingdom', flag: 'https://flagcdn.com/gb.svg', disabled: false },
  { code: 'MX', name: 'México', flag: 'https://flagcdn.com/mx.svg', disabled: false },
  { code: 'BR', name: 'Brasil', flag: 'https://flagcdn.com/br.svg', disabled: false },
  { code: 'CO', name: 'Colombia', flag: 'https://flagcdn.com/co.svg', disabled: false },
  { code: 'AR', name: 'Argentina', flag: 'https://flagcdn.com/ar.svg', disabled: false },
  { code: 'PE', name: 'Perú', flag: 'https://flagcdn.com/pe.svg', disabled: false },
  { code: 'VE', name: 'Venezuela', flag: 'https://flagcdn.com/ve.svg', disabled: false },
  { code: 'CL', name: 'Chile', flag: 'https://flagcdn.com/cl.svg', disabled: false },
  { code: 'EC', name: 'Ecuador', flag: 'https://flagcdn.com/ec.svg', disabled: false },
  { code: 'GT', name: 'Guatemala', flag: 'https://flagcdn.com/gt.svg', disabled: false },
  { code: 'CR', name: 'Costa Rica', flag: 'https://flagcdn.com/cr.svg', disabled: false },
  { code: 'PA', name: 'Panamá', flag: 'https://flagcdn.com/pa.svg', disabled: false },
  { code: 'UY', name: 'Uruguay', flag: 'https://flagcdn.com/uy.svg', disabled: false },
  { code: 'PT', name: 'Portugal', flag: 'https://flagcdn.com/pt.svg', disabled: false },
  { code: 'FR', name: 'France', flag: 'https://flagcdn.com/fr.svg', disabled: false },
  { code: 'DE', name: 'Deutschland', flag: 'https://flagcdn.com/de.svg', disabled: false },
  { code: 'IT', name: 'Italia', flag: 'https://flagcdn.com/it.svg', disabled: false },
  { code: 'AD', name: 'Andorra', flag: 'https://flagcdn.com/ad.svg', disabled: false },
  { code: 'CN', name: '中国', flag: 'https://flagcdn.com/cn.svg', disabled: false },
];

export const APP_LANGUAGES = [
  { code: 'es', name: 'España', flag: 'https://flagcdn.com/es.svg', disabled: false },
  { code: 'en', name: 'Reino Unido', flag: 'https://flagcdn.com/gb.svg', disabled: false },
  { code: 'br', name: 'Brasil', flag: 'https://flagcdn.com/br.svg', disabled: false },
  { code: 'pt', name: 'Portugal', flag: 'https://flagcdn.com/pt.svg', disabled: false },
  { code: 'ca', name: 'Andorra', flag: 'https://flagcdn.com/ad.svg', disabled: false },
  { code: 'fr', name: 'Francia', flag: 'https://flagcdn.com/fr.svg', disabled: false },
  { code: 'de', name: 'Alemania', flag: 'https://flagcdn.com/de.svg', disabled: false },
  { code: 'it', name: 'Italia', flag: 'https://flagcdn.com/it.svg', disabled: false },
  { code: 'mx', name: 'México', flag: 'https://flagcdn.com/mx.svg', disabled: false },
  { code: 'ar', name: 'Argentina', flag: 'https://flagcdn.com/ar.svg', disabled: false },
  { code: 'co', name: 'Colombia', flag: 'https://flagcdn.com/co.svg', disabled: false },
  { code: 'pe', name: 'Perú', flag: 'https://flagcdn.com/pe.svg', disabled: false },
  { code: 've', name: 'Venezuela', flag: 'https://flagcdn.com/ve.svg', disabled: false },
  { code: 'cl', name: 'Chile', flag: 'https://flagcdn.com/cl.svg', disabled: false },
  { code: 'ec', name: 'Ecuador', flag: 'https://flagcdn.com/ec.svg', disabled: false },
  { code: 'gt', name: 'Guatemala', flag: 'https://flagcdn.com/gt.svg', disabled: false },
  { code: 'cr', name: 'Costa Rica', flag: 'https://flagcdn.com/cr.svg', disabled: false },
  { code: 'pa', name: 'Panamá', flag: 'https://flagcdn.com/pa.svg', disabled: false },
  { code: 'uy', name: 'Uruguay', flag: 'https://flagcdn.com/uy.svg', disabled: false },
  { code: 'us', name: 'Estados Unidos', flag: 'https://flagcdn.com/us.svg', disabled: false },
  { code: 'cn', name: '中国', flag: 'https://flagcdn.com/cn.svg', disabled: false },
];


// This key is used by the push service to identify the application server.
// The corresponding private key must be used on the server to send notifications.
export const VAPID_PUBLIC_KEY = 'BPhgcyzi1O0wF2j_v5V_MfYj1vQj8-2hO9-4nF6gI3d3W4eX8rJ6p6c5Z8s7K9l0R8n7M6i5T4o3E2w';