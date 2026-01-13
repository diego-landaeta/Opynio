/**
 * Utilities for text manipulation
 */

/**
 * Removes accents/diacritics from a string
 * Example: "psicólogo" -> "psicologo"
 * Example: "José María" -> "Jose Maria"
 */
export const removeAccents = (text: string): string => {
  return text
    .normalize('NFD') // Descompone caracteres acentuados
    .replace(/[\u0300-\u036f]/g, '') // Elimina los diacríticos
    .toLowerCase();
};

/**
 * Normalizes search term for accent-insensitive search
 * - Removes accents
 * - Converts to lowercase
 * - Trims whitespace
 */
export const normalizeSearchTerm = (term: string): string => {
  return removeAccents(term.trim());
};

/**
 * Checks if a text matches a search term (accent-insensitive)
 */
export const matchesSearch = (text: string, searchTerm: string): boolean => {
  const normalizedText = removeAccents(text);
  const normalizedSearch = removeAccents(searchTerm);
  return normalizedText.includes(normalizedSearch);
};
