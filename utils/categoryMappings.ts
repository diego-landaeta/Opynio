/**
 * Mapping from English snake_case main category names (as stored in database)
 * to their Spanish names (used as keys in locale files)
 *
 * This is needed because database stores main categories in English snake_case format
 * but translation keys in locale files use Spanish names
 * Keys are normalized to lowercase for case-insensitive lookups
 */
export const CATEGORY_ENGLISH_TO_SPANISH: { [key: string]: string } = {
  "restaurants_and_leisure": "Restaurantes y Ocio",
  "health_and_wellness": "Salud y Bienestar",
  "pets": "Mascotas",
  "professional_and_business_services": "Servicios Profesionales y de Empresa",
  "education_and_training": "Educación y Formación",
  "home_services": "Servicios para el Hogar",
  "shopping_and_retail": "Compras y Retail",
  "automotive": "Automoción",
  "travel_and_transportation": "Viajes y Transporte",
  "events": "Eventos",
  "emerging_sectors_and_others": "Sectores Emergentes y Otros",
};

/**
 * Get the Spanish name for an English category name
 * Handles case-insensitive lookups
 */
export function getCategorySpanishName(englishName: string): string {
  const normalizedName = englishName.toLowerCase();
  return CATEGORY_ENGLISH_TO_SPANISH[normalizedName] || englishName;
}

/**
 * Mapping from Spanish subcategory names (as stored in database)
 * to their English translation keys (used in locale files)
 *
 * This is needed because database stores "Category: Subcategory" in Spanish format
 * but translation keys in locale files use English snake_case keys
 */
export const SUBCATEGORY_SPANISH_TO_KEY: { [key: string]: string } = {
  // Restaurantes y Ocio
  "Restaurantes": "restaurants",
  "Bares y Cafeterías": "bars_cafes",
  "Comida Rápida": "fast_food",
  "Vida Nocturna y Discotecas": "nightlife_clubs",
  "Cines, Teatros y Espectáculos": "cinemas_theaters_shows",
  "Parques Temáticos y de Atracciones": "theme_parks",

  // Salud y Bienestar
  "Clínicas y Hospitales": "clinics_hospitals",
  "Clínicas Dentales": "dental_clinics",
  "Farmacias y Ópticas": "pharmacies_opticians",
  "Fisioterapia y Rehabilitación": "physiotherapy_rehabilitation",
  "Psicología y Terapia": "psychology_therapy",
  "Nutrición y Dietética": "nutrition_dietetics",
  "Gimnasios y Centros Deportivos": "gyms_sports_centers",
  "Peluquerías y Salones de Belleza": "hair_salons_beauty_salons",
  "Spas y Centros de Bienestar": "spas_wellness_centers",

  // Compras y Retail
  "Supermercados y Tiendas de Alimentación": "supermarkets_food_stores",
  "Tiendas de Ropa y Moda": "clothing_fashion_stores",
  "Tiendas de Electrónica y Tecnología": "electronics_technology_stores",
  "Tiendas de Muebles y Decoración": "furniture_decoration_stores",
  "Grandes Almacenes": "department_stores",
  "Joyerías y Relojerías": "jewelry_watch_stores",
  "Librerías y Papelerías": "bookstores_stationery",
  "Jugueterías y Tiendas Infantiles": "toy_stores_children_stores",

  // Servicios para el Hogar
  "Reformas y Construcción": "renovations_construction",
  "Limpieza y Mantenimiento": "cleaning_maintenance",
  "Fontanería, Electricidad y Cerrajería": "plumbing_electricity_locksmithing",
  "Jardinería y Paisajismo": "gardening_landscaping",
  "Mudanzas y Almacenamiento": "moving_storage",
  "Seguridad del Hogar": "home_security",
  "Climatización, Aerotermia Y Energía Solar": "climatizacion_aerotermia_y_energia_solar",

  // Servicios Profesionales y Empresariales
  "Asesoría Fiscal y Contable": "tax_accounting_advisory",
  "Servicios Legales y Abogados": "legal_services_lawyers",
  "Agencias de Marketing y Publicidad": "marketing_advertising_agencies",
  "Desarrollo de Software y Servicios TI": "software_development_it_services",
  "Consultoría de Negocios": "business_consulting",
  "Recursos Humanos y Contratación": "human_resources_recruitment",
  "Reclutamiento": "recruitment",

  // Automoción
  "Concesionarios de Vehículos": "vehicle_dealerships",
  "Talleres Mecánicos y Reparación": "mechanical_workshops_repair",
  "Alquiler de Vehículos": "vehicle_rental",
  "Estaciones de Servicio y Lavados de Coches": "service_stations_car_washes",
  "Tiendas de Repuestos y Accesorios": "parts_accessories_stores",

  // Educación y Formación
  "Universidades y Educación Superior": "universities_higher_education",
  "Colegios y Escuelas": "schools_colleges",
  "Formación Profesional y Cursos Online": "vocational_training_online_courses",
  "Academias de Idiomas": "language_academies",
  "Autoescuelas": "driving_schools",
  "Clases Particulares y Tutorías": "private_lessons_tutoring",
  "Asistente Académico": "academic_assistant",

  // Finanzas e Inmobiliaria
  "Bancos y Entidades Financieras": "banks_financial_entities",
  "Compañías de Seguros": "insurance_companies",
  "Servicios de Inversión": "investment_services",
  "Inmobiliarias": "real_estate_agencies",

  // Viajes y Transporte
  "Hoteles y Alojamientos": "hotels_accommodations",
  "Agencias de Viajes y Touroperadores": "travel_agencies_tour_operators",
  "Aerolíneas y Transporte": "airlines_transport",
  "Atracciones Turísticas y Museos": "tourist_attractions_museums",

  // Mascotas
  "Clínicas Veterinarias": "veterinary_clinics",
  "Tiendas para Mascotas": "pet_stores",
  "Peluquerías y Cuidadores de Mascotas": "pet_grooming_pet_sitters",
  "Adiestramiento Canino": "dog_training",

  // Eventos
  "Organización de Bodas y Eventos": "wedding_event_planning",
  "Salones y Espacios para Eventos": "event_halls_venues",
  "Servicios de Catering": "catering_services",
  "Alquiler de Equipamiento para Eventos": "event_equipment_rental",

  // Sectores Emergentes y Otros
  "Energías Renovables": "renewable_energies",
  "Coworking y Oficinas Flexibles": "coworking_flexible_offices",
  "Servicios de Drones": "drone_services",
  "Realidad Virtual y Aumentada": "virtual_augmented_reality",
};

/**
 * Get the translation key for a Spanish subcategory name
 */
export function getSubcategoryKey(spanishName: string): string | null {
  return SUBCATEGORY_SPANISH_TO_KEY[spanishName] || null;
}

/**
 * Extract only the subcategory from a full category string
 * @param categoryString - Full category string like "Servicios para el Hogar: Climatización..."
 * @returns Just the subcategory part (after the colon)
 */
export function extractSubcategory(categoryString: string | null | undefined): string {
  if (!categoryString) return '';

  if (categoryString.includes(':')) {
    const parts = categoryString.split(':');
    return parts[1]?.trim() || '';
  }

  return categoryString;
}
