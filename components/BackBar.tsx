import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation, isHomeRoute, pathTranslations } from '../contexts/i18nContext';

// «← Volver» comun encima de cada seccion (QA: faltaba volver en la mayoria
// de pantallas, p. ej. la ficha de una empresa). No sale en la home ni donde
// ya hay una vuelta propia: el admin (AdminBackLink) y el panel de empresa
// («Volver a Mis Empresas»), el alta y la migracion de resenas (con su
// propio «volver»), ni en pantallas de paso sin contenido.
const OWN_BACK_PREFIXES = Array.from(new Set(
    Object.values(pathTranslations).flatMap(paths => [
        paths.businessDashboard.split('/:')[0],
        paths.postLogin,
        paths.completeBusinessRegistration,
        paths.migrateGoogleReviews,
    ])
));

const hasOwnBack = (pathname: string): boolean => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.includes('admin')) return true;
    const rest = '/' + segments.join('/') + '/';
    return OWN_BACK_PREFIXES.some(prefix => rest.includes(`/${prefix}/`));
};

const BackBar: React.FC = () => {
    const t = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();

    if (isHomeRoute(location.pathname) || hasOwnBack(location.pathname)) return null;

    // Si se llego desde otra pantalla del sitio, vuelve a ella; si se entro
    // directamente (enlace externo, recarga), a la home del pais de la URL.
    const goBack = () => {
        const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
        if (idx > 0) { navigate(-1); return; }
        const first = location.pathname.split('/').filter(Boolean)[0];
        navigate(first && isHomeRoute(`/${first}`) ? `/${first}` : '/');
    };

    return (
        <div className="mb-4 sm:mb-5 -mt-3 sm:-mt-4">
            <button
                type="button"
                onClick={goBack}
                className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-brand-green dark:hover:text-brand-green transition-colors rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green px-1 py-1"
            >
                <i className="fa-solid fa-arrow-left text-xs" aria-hidden="true"></i>
                {t('common.goBack')}
            </button>
        </div>
    );
};

export default BackBar;
