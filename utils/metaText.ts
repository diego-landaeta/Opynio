/**
 * Meta descripcion de una pagina con el pais al final («... widgets y mas en Espana.»).
 * Los textos de los locales ya terminan en punto, asi que se quita antes de añadir el pais:
 * sin esto salia «... y mas. en Espana.» (y «..» cuando no hay pais).
 */
export const descriptionWithCountry = (base: string, countryInTitle: string): string =>
    `${(base || '').replace(/[.。]\s*$/u, '')}${countryInTitle}.`;
