import React, { useState } from 'react';
import { useTranslation } from '../contexts/i18nContext';
import { setCookieConsent, useCookieConsent } from '../utils/consent';
import SettingsDrawer from './SettingsDrawer';

// Aviso de cookies: sale mientras el visitante no haya aceptado ni rechazado.
// Aceptar y rechazar con el mismo peso (criterio de la AEPD). «Configurar»
// abre el panel de ajustes, donde se puede cambiar despues.
const CookieBanner: React.FC = () => {
    const t = useTranslation();
    const consent = useCookieConsent();
    const [ajustes, setAjustes] = useState(false);

    if (consent !== null && !ajustes) return null;

    const BTN = 'flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green';
    return (
        <>
            {consent === null && (
                <div
                    role="region"
                    aria-labelledby="cookie-banner-title"
                    className="fixed z-[45] bottom-3 left-3 right-3 sm:right-auto sm:left-4 sm:bottom-4 sm:max-w-sm rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl p-4"
                >
                    <h2 id="cookie-banner-title" className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-1.5">
                        <i className="fa-solid fa-cookie-bite text-brand-green" aria-hidden="true"></i>
                        {t('editProfile.cookiesTitle')}
                    </h2>
                    <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-300 mb-3">{t('editProfile.cookiesText')}</p>
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setCookieConsent('denied')} className={`${BTN} border border-gray-300 dark:border-zinc-600 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-zinc-800`}>
                            {t('editProfile.cookiesReject')}
                        </button>
                        <button type="button" onClick={() => setCookieConsent('granted')} className={`${BTN} bg-brand-green text-white hover:bg-brand-green/90`}>
                            {t('editProfile.cookiesAccept')}
                        </button>
                    </div>
                    <button type="button" onClick={() => setAjustes(true)} className="mt-2 w-full text-xs font-semibold text-brand-green hover:underline">
                        {t('editProfile.cookiesSettings')}
                    </button>
                </div>
            )}
            {ajustes && <SettingsDrawer onClose={() => setAjustes(false)} />}
        </>
    );
};

export default CookieBanner;
