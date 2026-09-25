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

/**
 * Escapes HTML special characters.
 * Required for any user-provided value interpolated into a translation that is
 * rendered with dangerouslySetInnerHTML (a profile name like
 * `<img src=x onerror=...>` would otherwise run in the admin's session).
 */
export const escapeHtml = (value: unknown): string => {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};
