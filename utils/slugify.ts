/**
 * Utilidades para generación y validación de slugs SEO-friendly
 */

/**
 * Convierte un texto a slug limpio para URLs
 * - Minúsculas
 * - Sin acentos
 * - Sin caracteres especiales
 * - Espacios convertidos a guiones bajos
 *
 * @example
 * slugify("Café María & Compañía") // "cafe_maria_compania"
 * slugify("EMPRESA | Servicios S.A.") // "empresa_servicios_sa"
 */
export function slugify(text: string): string {
  if (!text) return '';

  return text
    .toLowerCase()                                    // minúsculas
    .normalize('NFD')                                 // separar caracteres de acentos
    .replace(/[\u0300-\u036f]/g, '')                 // eliminar acentos
    .replace(/ñ/g, 'n')                              // ñ → n (después de normalize)
    .replace(/[|,;:'"!?¿¡@#$%^&*()+=\[\]{}\\/<>]/g, '') // eliminar caracteres especiales
    .replace(/\./g, '')                              // eliminar puntos
    .replace(/\s+/g, '_')                            // espacios → guiones bajos
    .replace(/-+/g, '_')                             // guiones → guiones bajos
    .replace(/_+/g, '_')                             // múltiples _ → uno solo
    .replace(/^_|_$/g, '');                          // quitar _ al inicio/final
}

/**
 * Valida si un string es un slug válido
 * Solo permite: letras minúsculas, números y guiones bajos
 */
export function isValidSlug(slug: string): boolean {
  if (!slug) return false;
  return /^[a-z0-9_]+$/.test(slug);
}

/**
 * Genera un slug único agregando un sufijo numérico si es necesario
 * Útil para cuando el slug base ya existe
 *
 * @example
 * generateUniqueSlug("cafe_maria", ["cafe_maria", "cafe_maria_2"]) // "cafe_maria_3"
 */
export function generateUniqueSlug(baseSlug: string, existingSlugs: string[]): string {
  if (!existingSlugs.includes(baseSlug)) {
    return baseSlug;
  }

  let counter = 2;
  let newSlug = `${baseSlug}_${counter}`;

  while (existingSlugs.includes(newSlug)) {
    counter++;
    newSlug = `${baseSlug}_${counter}`;
  }

  return newSlug;
}

/**
 * Detecta si una URL/nombre de empresa tiene caracteres problemáticos para SEO
 */
export function hasProblematicCharacters(text: string): boolean {
  if (!text) return false;

  // Tiene acentos
  const hasAccents = /[áéíóúàèìòùâêîôûäëïöüãõñ]/i.test(text);

  // Tiene caracteres especiales problemáticos
  const hasSpecialChars = /[|,;:'"!?¿¡@#$%^&*()+=\[\]{}\\/<>]/.test(text);

  // Tiene mayúsculas (URLs deben ser lowercase)
  const hasMixedCase = /[A-Z]/.test(text);

  // Tiene espacios (deberían ser guiones bajos)
  const hasSpaces = /\s/.test(text);

  return hasAccents || hasSpecialChars || hasMixedCase || hasSpaces;
}

/**
 * Extrae el identificador de una URL de empresa
 * Maneja tanto URLs codificadas como sin codificar
 */
export function extractIdentifierFromUrl(url: string): string {
  // Decodificar URL si está codificada
  let decoded = url;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    // Si falla decodificar, usar original
  }

  // Extraer último segmento después de /empresa/ o /business/
  const match = decoded.match(/\/(?:empresa|business|entreprise|unternehmen|azienda|公司)\/([^/?]+)/i);

  return match ? match[1] : decoded;
}
