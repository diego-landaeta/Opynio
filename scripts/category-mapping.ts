/**
 * Mapeo de categorías para normalización
 *
 * Este archivo contiene el mapeo de todas las categorías existentes
 * a un formato estandarizado en español: "Categoría Principal: Subcategoría"
 */

export const CATEGORY_MAPPING: Record<string, string> = {
  // ============== RESTAURANTES Y OCIO ==============
  'Ocio y Restauración: Restaurantes': 'Restaurantes y Ocio: Restaurantes',
  'Restauración y Ocio: Restaurantes': 'Restaurantes y Ocio: Restaurantes',
  'leisure_and_dining:restaurants': 'Restaurantes y Ocio: Restaurantes',
  'Leisure & Dining: Restaurants': 'Restaurantes y Ocio: Restaurantes',

  'Ocio y Restauración: Bares y Cafeterías': 'Restaurantes y Ocio: Bares y Cafeterías',

  // ============== SALUD Y BIENESTAR ==============
  'Salud y Bienestar: Clínicas Dentales': 'Salud y Bienestar: Clínicas Dentales',
  'health_and_wellness:dental_clinics': 'Salud y Bienestar: Clínicas Dentales',
  'Health & Wellness: Dental Clinics': 'Salud y Bienestar: Clínicas Dentales',

  'Salud y Bienestar: Fisioterapia y Rehabilitación': 'Salud y Bienestar: Fisioterapia y Rehabilitación',

  'Salud y Bienestar: Psicología y Terapia': 'Salud y Bienestar: Psicología y Terapia',

  'Salud y Bienestar: Peluquerías y Salones de Belleza': 'Salud y Bienestar: Peluquerías y Salones de Belleza',

  'Salud y Bienestar: Nutrición y Dietética': 'Salud y Bienestar: Nutrición y Dietética',

  'Salud y Bienestar: Spas y Centros de Bienestar': 'Salud y Bienestar: Spas y Centros de Bienestar',

  'Salud y Bienestar: Clínicas y Hospitales': 'Salud y Bienestar: Clínicas y Hospitales',
  'health_and_wellness:clinics_hospitals': 'Salud y Bienestar: Clínicas y Hospitales',

  // ============== MASCOTAS ==============
  'Mascotas: Clínicas Veterinarias': 'Mascotas: Clínicas Veterinarias',
  'pets:veterinary_clinics': 'Mascotas: Clínicas Veterinarias',

  // ============== SERVICIOS PROFESIONALES Y DE EMPRESA ==============
  'Servicios Profesionales y de Empresa: Servicios Legales y Abogados': 'Servicios Profesionales y de Empresa: Servicios Legales y Abogados',
  'professional_and_business_services:legal_services_lawyers': 'Servicios Profesionales y de Empresa: Servicios Legales y Abogados',
  'Professional & Business Services: Legal Services & Lawyers': 'Servicios Profesionales y de Empresa: Servicios Legales y Abogados',

  'Servicios Profesionales y de Empresa: Asesoría Fiscal y Contable': 'Servicios Profesionales y de Empresa: Asesoría Fiscal y Contable',

  'Servicios Profesionales y de Empresa: Desarrollo de Software y Servicios TI': 'Servicios Profesionales y de Empresa: Desarrollo de Software y Servicios TI',

  'Servicios Profesionales y de Empresa: Consultoría de Negocios': 'Servicios Profesionales y de Empresa: Consultoría de Negocios',

  'Servicios Profesionales y de Empresa: Agencias de Marketing y Publicidad': 'Servicios Profesionales y de Empresa: Agencias de Marketing y Publicidad',

  // ============== EDUCACIÓN Y FORMACIÓN ==============
  'Educación y Formación: Formación Profesional y Cursos Online': 'Educación y Formación: Formación Profesional y Cursos Online',
  'education_and_training: vocational_training_online_courses': 'Educación y Formación: Formación Profesional y Cursos Online',
  'Education & Training: Vocational Training & Online Courses': 'Educación y Formación: Formación Profesional y Cursos Online',

  'Educación y Formación: Academias de Idiomas': 'Educación y Formación: Academias de Idiomas',

  'Educación y Formación: Clases Particulares y Tutorías': 'Educación y Formación: Clases Particulares y Tutorías',

  'Educación y Formación: Colegios y Escuelas': 'Educación y Formación: Colegios y Escuelas',
  'education_and_training:schools_colleges': 'Educación y Formación: Colegios y Escuelas',

  'Educación y Formación: Universidades y Educación Superior': 'Educación y Formación: Universidades y Educación Superior',
  'education_and_training:universities_higher_education': 'Educación y Formación: Universidades y Educación Superior',
  'education_and_training: universities_higher_education': 'Educación y Formación: Universidades y Educación Superior',

  // ============== SERVICIOS PARA EL HOGAR ==============
  'Servicios para el Hogar: Fontanería, Electricidad y Cerrajería': 'Servicios para el Hogar: Fontanería, Electricidad y Cerrajería',

  'Servicios para el Hogar: Jardinería y Paisajismo': 'Servicios para el Hogar: Jardinería y Paisajismo',

  'Servicios para el Hogar: Mudanzas y Almacenamiento': 'Servicios para el Hogar: Mudanzas y Almacenamiento',

  'Servicios para el Hogar: Reformas y Construcción': 'Servicios para el Hogar: Reformas y Construcción',

  // ============== COMPRAS Y RETAIL ==============
  'Compras y Retail: Supermercados y Tiendas de Alimentación': 'Compras y Retail: Supermercados y Tiendas de Alimentación',
  'shopping_and_retail:supermarkets_food_stores': 'Compras y Retail: Supermercados y Tiendas de Alimentación',

  'Compras y Retail: Tiendas de Electrónica y Tecnología': 'Compras y Retail: Tiendas de Electrónica y Tecnología',

  // ============== AUTOMOCIÓN ==============
  'Automoción: Talleres Mecánicos y Reparación': 'Automoción: Talleres Mecánicos y Reparación',
  'Automotive: Mechanical Workshops & Repair': 'Automoción: Talleres Mecánicos y Reparación',

  // ============== VIAJES Y TRANSPORTE ==============
  'Viajes y Transporte: Hoteles y Alojamientos': 'Viajes y Transporte: Hoteles y Alojamientos',
  'travel_and_transport:hotels_accommodations': 'Viajes y Transporte: Hoteles y Alojamientos',

  'Viajes y Transporte: Agencias de Viajes y Touroperadores': 'Viajes y Transporte: Agencias de Viajes y Touroperadores',

  // ============== EVENTOS ==============
  'Eventos: Salones y Espacios para Eventos': 'Eventos: Salones y Espacios para Eventos',

  'Eventos: Organización de Bodas y Eventos': 'Eventos: Organización de Bodas y Eventos',

  'Eventos: Alquiler de Equipamiento para Eventos': 'Eventos: Alquiler de Equipamiento para Eventos',

  // ============== SECTORES EMERGENTES Y OTROS ==============
  'emerging_and_other: virtual_augmented_reality': 'Sectores Emergentes y Otros: Realidad Virtual y Aumentada',
  'Sectores Emergentes y Otros: Realidad Virtual y Aumentada': 'Sectores Emergentes y Otros: Realidad Virtual y Aumentada',

  // ============== CATEGORÍA VACÍA ==============
  '': 'Sin Categoría',
  ' ': 'Sin Categoría',
};

/**
 * Categorías principales válidas
 */
export const VALID_MAIN_CATEGORIES = [
  'Restaurantes y Ocio',
  'Salud y Bienestar',
  'Mascotas',
  'Servicios Profesionales y de Empresa',
  'Educación y Formación',
  'Servicios para el Hogar',
  'Compras y Retail',
  'Automoción',
  'Viajes y Transporte',
  'Eventos',
  'Sectores Emergentes y Otros',
  'Sin Categoría'
];

/**
 * Lista de todas las categorías normalizadas únicas
 */
export const NORMALIZED_CATEGORIES = Array.from(new Set(Object.values(CATEGORY_MAPPING)));
