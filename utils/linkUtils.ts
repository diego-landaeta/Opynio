import { pathTranslations, getLanguageForCountryCode, type Language } from '../contexts/i18nContext';

/**
 * Generates a business profile path based on the business name and country
 * @param businessOrName - The business object with name, or just a string name
 * @param countryCodeArg - The country code (e.g., 'ES', 'US')
 * @returns The generated path for the business profile
 */
export function generateBusinessPath(
  businessOrName: string | { name: string; country?: string | null },
  countryCodeArg?: string
): string {
  let name: string;
  let country: string;

  if (typeof businessOrName === 'object' && businessOrName !== null) {
    name = businessOrName.name;
    country = businessOrName.country || 'es';
  } else {
    name = typeof businessOrName === 'string' ? businessOrName : '';
    country = countryCodeArg || 'es';
  }

  const safeCountry = (country || 'es').toLowerCase();
  const language = getLanguageForCountryCode(safeCountry);
  const paths = pathTranslations[language] || pathTranslations.es;

  // Trim the name to remove leading/trailing spaces, then replace internal spaces with underscores
  const trimmedName = name.trim();
  const nameWithUnderscores = trimmedName.replace(/ /g, '_');
  const encodedName = encodeURIComponent(nameWithUnderscores);

  // Generate the path using the translated business path template
  const businessPath = paths.business.replace(':identifier', encodedName);

  return `/${safeCountry}/${businessPath}`;
}

/**
 * Generates a category path based on the category key and country
 * @param categoryKey - The category key
 * @param country - The country code
 * @returns The generated path for the category
 */
export function generateCategoryPath(categoryKey: string, country?: string): string {
  if (!country) {
    return `/explorar?categoria=${categoryKey}`;
  }
  
  const countryCode = country.toLowerCase();
  const language = getLanguageForCountryCode(country);
  const paths = pathTranslations[language] || pathTranslations.es;
  
  return `/${countryCode}/${paths.explore}?categoria=${categoryKey}`;
}

export default {
  generateBusinessPath,
  generateCategoryPath,
};
