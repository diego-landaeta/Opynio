import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { COUNTRIES } from '../constants';
import { useTranslation } from '../contexts/i18nContext';
import { useContentCountry, pathInCountry } from '../contexts/CountryContext';
import { useCountryName } from '../utils/countryName';

/**
 * Aviso discreto para listados (home, explorar, empresas) abiertos con el
 * prefijo de un país distinto del país de búsqueda del usuario, p. ej. un
 * enlace compartido a /it/esplora para alguien de España. El contenido es el
 * del prefijo (versión canónica); la preferencia del usuario no cambia y la
 * cabecera sigue mostrándola. Aquí se explica la diferencia y se ofrece, sin
 * forzar, la misma página en su país.
 */
const ForeignCountryNotice: React.FC<{ className?: string }> = ({ className = '' }) => {
    const t = useTranslation();
    const location = useLocation();
    const countryNameOf = useCountryName();
    const { contentCountry, userCountry, isForeign } = useContentCountry();

    if (!isForeign || !contentCountry || !userCountry) return null;

    const content = COUNTRIES.find(c => c.code === contentCountry);
    const contentName = countryNameOf(contentCountry, content?.name || contentCountry);
    const userName = countryNameOf(userCountry, COUNTRIES.find(c => c.code === userCountry)?.name || userCountry);

    return (
        <div
            role="note"
            className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 rounded-lg border border-blue-200 dark:border-blue-800/60 bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-900 dark:text-blue-200 ${className}`}
        >
            <span className="flex items-center gap-2 min-w-0">
                {content && (
                    <img src={content.flag} alt="" width={20} height={20} className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                )}
                <span>{t('common.viewingOtherCountry', { country: contentName, userCountry: userName })}</span>
            </span>
            <Link
                to={pathInCountry(location.pathname, userCountry)}
                className="sm:ml-auto inline-flex items-center gap-1.5 font-semibold text-brand-green hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-green rounded whitespace-nowrap"
            >
                {t('common.goToCountrySite', { country: userName })}
                <i className="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i>
            </Link>
        </div>
    );
};

export default ForeignCountryNotice;
