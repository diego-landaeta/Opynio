import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation, useI18n, localizedPath, isHomeRoute, pathTranslations } from '../contexts/i18nContext';
import { useCountry } from '../contexts/CountryContext';

// Boton flotante «Escribe una resena» (circulo con lapiz, abajo a la derecha)
// en todo el sitio, para quien tenga o no sesion: la ruta pide acceso y vuelve
// al formulario. Al pasar el raton o con el foco muestra el texto. No sale en
// el propio formulario ni en el admin o el panel de empresa.
const HIDDEN_PREFIXES = Array.from(new Set(
    Object.values(pathTranslations).flatMap(paths => [
        paths.writeReview,
        paths.businessDashboard.split('/:')[0],
    ])
));

const WriteReviewFab: React.FC = () => {
    const t = useTranslation();
    const { language } = useI18n();
    const { userCountry } = useCountry();
    const { pathname } = useLocation();

    const segments = pathname.split('/').filter(Boolean);
    const rest = '/' + segments.join('/') + '/';
    if (segments.includes('admin') || HIDDEN_PREFIXES.some(p => rest.includes(`/${p}/`))) return null;

    // El pais de la URL manda (mismo prefijo que la pagina); si no hay, el del usuario.
    const urlCountry = segments[0] && isHomeRoute(`/${segments[0]}`) ? segments[0] : null;
    const to = localizedPath('writeReview', language, urlCountry || userCountry || 'es');
    const label = t('header.writeReview');

    return (
        <Link
            to={to}
            aria-label={label}
            title={label}
            className="group fixed bottom-6 right-4 sm:right-6 z-40 flex items-center h-14 rounded-full bg-brand-green text-white shadow-lg hover:shadow-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-green/40 transition-shadow"
        >
            <span className="w-14 h-14 flex items-center justify-center flex-shrink-0">
                <i className="fa-solid fa-pencil text-xl" aria-hidden="true"></i>
            </span>
            <span className="max-w-0 overflow-hidden whitespace-nowrap font-semibold text-sm transition-[max-width,padding] duration-200 motion-reduce:transition-none group-hover:max-w-[12rem] group-hover:pr-5 group-focus-visible:max-w-[12rem] group-focus-visible:pr-5">
                {label}
            </span>
        </Link>
    );
};

export default WriteReviewFab;
