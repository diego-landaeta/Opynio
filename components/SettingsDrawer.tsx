import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useI18n, useTranslation, localizedPathOrRoot } from '../contexts/i18nContext';
import { useCountryName } from '../utils/countryName';
import { COUNTRIES } from '../constants';
import { usePreferenceActions, LANGUAGE_OPTIONS, THEME_OPTIONS } from '../hooks/usePreferenceActions';

// Panel lateral de configuracion («Todos los ajustes» desde el engranaje de la
// home). Lo mismo que la configuracion rapida mas los accesos de la cuenta.
// Sin URL propia: es un panel encima de la pagina.
const SELECT = 'w-full p-2.5 text-sm border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-green focus:border-transparent';
const SECTION = 'text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3';
const LINK = 'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors';

const SettingsDrawer: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const t = useTranslation();
    const { language } = useI18n();
    const countryName = useCountryName();
    const { isLoggedIn, requestedLanguage, country, themePreference, changeLanguage, changeCountry, changeTheme } = usePreferenceActions();
    const panelRef = useRef<HTMLDivElement>(null);
    const path = (key: Parameters<typeof localizedPathOrRoot>[0]) => localizedPathOrRoot(key, language, country);

    // Escape cierra; el foco entra en el panel y no se desplaza la pagina de detras.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        panelRef.current?.focus();
        return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
    }, [onClose]);

    return createPortal(
        <div className="fixed inset-0 z-[60]" role="presentation">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
            <div
                ref={panelRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-labelledby="settings-drawer-title"
                className="absolute right-0 top-0 h-full w-full max-w-sm bg-white dark:bg-zinc-900 shadow-2xl flex flex-col focus:outline-none"
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-zinc-800">
                    <h2 id="settings-drawer-title" className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <i className="fa-solid fa-gear text-brand-green" aria-hidden="true"></i>
                        {t('editProfile.settingsTitle')}
                    </h2>
                    <button type="button" onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800" aria-label={t('common.close')}>
                        <i className="fa-solid fa-xmark text-lg" aria-hidden="true"></i>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-5 space-y-7">
                    <section>
                        <h3 className={SECTION}>{t('editProfile.settingsAppearance')}</h3>
                        <div role="radiogroup" aria-label={t('editProfile.themeLabel')} className="grid grid-cols-3 gap-2">
                            {THEME_OPTIONS.map(o => {
                                const active = themePreference === o.value;
                                return (
                                    <button
                                        key={o.value}
                                        type="button"
                                        role="radio"
                                        aria-checked={active}
                                        onClick={() => changeTheme(o.value)}
                                        className={`flex flex-col items-center gap-1.5 py-3 rounded-lg border text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green ${
                                            active ? 'border-brand-green bg-brand-green/10 text-brand-green dark:text-green-300' : 'border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800'
                                        }`}
                                    >
                                        <i className={`fa-solid ${o.icon} text-base`} aria-hidden="true"></i>
                                        <span>{t(o.labelKey)}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    <section>
                        <h3 className={SECTION}>{t('editProfile.settingsLanguageRegion')}</h3>
                        <div className="space-y-3">
                            <div>
                                <label htmlFor="drawer-lang" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('editProfile.languageLabel')}</label>
                                <select id="drawer-lang" value={requestedLanguage} onChange={(e) => changeLanguage(e.target.value)} className={SELECT}>
                                    {LANGUAGE_OPTIONS.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="drawer-country" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('editProfile.countryLabel')}</label>
                                <select id="drawer-country" value={country || ''} onChange={(e) => changeCountry(e.target.value)} className={SELECT}>
                                    {!country && <option value="" disabled>{t('editProfile.countryPlaceholder')}</option>}
                                    {COUNTRIES.map(c => <option key={c.code} value={c.code}>{countryName(c.code, c.name)}</option>)}
                                </select>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('editProfile.countryHint')}</p>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h3 className={SECTION}>{t('editProfile.accountTitle')}</h3>
                        {isLoggedIn ? (
                            <nav className="space-y-1" onClick={onClose}>
                                <Link to={path('editProfile')} className={LINK}><i className="fa-regular fa-user w-4 text-center" aria-hidden="true"></i>{t('profilePage.editProfile')}</Link>
                                <Link to={path('editProfile')} className={LINK}><i className="fa-solid fa-key w-4 text-center" aria-hidden="true"></i>{t('editProfile.changePasswordTitle')}</Link>
                                <Link to={path('editProfile')} className={LINK}><i className="fa-regular fa-bell w-4 text-center" aria-hidden="true"></i>{t('editProfile.pushNotifications')}</Link>
                                <Link to={`${path('profile')}#soporte`} className={LINK}><i className="fa-solid fa-headset w-4 text-center" aria-hidden="true"></i>{t('supportPage.myRequestsTitle')}</Link>
                                <Link to={path('support')} state={{ ticketType: 'account_deletion' }} className={`${LINK} text-red-600 dark:text-red-400`}><i className="fa-solid fa-user-xmark w-4 text-center" aria-hidden="true"></i>{t('editProfile.deleteAccountTitle')}</Link>
                            </nav>
                        ) : (
                            <div className="space-y-3">
                                <p className="text-sm text-gray-600 dark:text-gray-300">{t('editProfile.settingsGuestAccount')}</p>
                                <div className="flex gap-2" onClick={onClose}>
                                    <Link to={path('login')} className="flex-1 text-center px-4 py-2.5 rounded-lg bg-brand-green text-white text-sm font-semibold hover:bg-opacity-90">{t('common.login')}</Link>
                                    <Link to={path('register')} className="flex-1 text-center px-4 py-2.5 rounded-lg border border-brand-green text-brand-green dark:text-green-300 text-sm font-semibold hover:bg-brand-green/10">{t('common.register')}</Link>
                                </div>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default SettingsDrawer;
