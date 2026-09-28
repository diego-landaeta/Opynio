import React, { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useI18n, useTranslation, localizedPathOrRoot } from '../contexts/i18nContext';
import { useCountryName } from '../utils/countryName';
import { COUNTRIES } from '../constants';
import { usePreferenceActions, LANGUAGE_OPTIONS, THEME_OPTIONS } from '../hooks/usePreferenceActions';

// Engranaje de la cabecera: tema, idioma y pais para cualquier visitante, con
// o sin cuenta. Sustituye al boton de la luna y al boton flotante de idioma.
// Con sesion, lo que se elige tambien se guarda en el perfil.
const SELECT = 'w-full p-2 text-sm border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-green focus:border-transparent';
const LABEL = 'block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5';

const SettingsMenu: React.FC<{ buttonClassName: string }> = ({ buttonClassName }) => {
    const t = useTranslation();
    const { language } = useI18n();
    const countryName = useCountryName();
    const { isLoggedIn, requestedLanguage, country, themePreference, changeLanguage, changeCountry, changeTheme } = usePreferenceActions();
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const panelId = useId();
    const titleId = useId();
    const location = useLocation();

    // Al cambiar de pantalla (p. ej. al elegir otro pais) se cierra.
    useEffect(() => { setOpen(false); }, [location.pathname]);

    // Se cierra al pulsar fuera o con Escape (el foco vuelve al engranaje).
    useEffect(() => {
        if (!open) return;
        const onPointerDown = (e: PointerEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { setOpen(false); buttonRef.current?.focus(); }
        };
        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    return (
        <div ref={wrapperRef} className="relative">
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setOpen(o => !o)}
                className={buttonClassName}
                aria-label={t('editProfile.settingsOpen')}
                title={t('editProfile.settingsTitle')}
                aria-expanded={open}
                aria-controls={panelId}
            >
                <i className={`fa-solid fa-gear transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-45' : ''}`} aria-hidden="true"></i>
            </button>
            {open && (
                <div
                    id={panelId}
                    role="dialog"
                    aria-labelledby={titleId}
                    className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-1.5rem)] z-50 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl p-4 text-left"
                >
                    <h2 id={titleId} className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-3">{t('editProfile.settingsTitle')}</h2>

                    <span id={`${panelId}-theme`} className={LABEL}>{t('editProfile.themeLabel')}</span>
                    <div role="radiogroup" aria-labelledby={`${panelId}-theme`} className="grid grid-cols-3 gap-1.5 mb-4">
                        {THEME_OPTIONS.map(o => {
                            const active = themePreference === o.value;
                            return (
                                <button
                                    key={o.value}
                                    type="button"
                                    role="radio"
                                    aria-checked={active}
                                    onClick={() => changeTheme(o.value)}
                                    className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg border text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green ${
                                        active
                                            ? 'border-brand-green bg-brand-green/10 text-brand-green dark:text-green-300'
                                            : 'border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800'
                                    }`}
                                >
                                    <i className={`fa-solid ${o.icon}`} aria-hidden="true"></i>
                                    <span>{t(o.labelKey)}</span>
                                </button>
                            );
                        })}
                    </div>

                    <label htmlFor={`${panelId}-lang`} className={LABEL}>{t('editProfile.languageLabel')}</label>
                    <select id={`${panelId}-lang`} value={requestedLanguage} onChange={(e) => changeLanguage(e.target.value)} className={`${SELECT} mb-4`}>
                        {LANGUAGE_OPTIONS.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                    </select>

                    <label htmlFor={`${panelId}-country`} className={LABEL}>{t('editProfile.countryLabel')}</label>
                    <select id={`${panelId}-country`} value={country || ''} onChange={(e) => changeCountry(e.target.value)} className={SELECT}>
                        {!country && <option value="" disabled>{t('editProfile.countryPlaceholder')}</option>}
                        {COUNTRIES.map(c => <option key={c.code} value={c.code}>{countryName(c.code, c.name)}</option>)}
                    </select>

                    <p className="mt-3 pt-3 border-t border-gray-100 dark:border-zinc-800 text-xs text-gray-500 dark:text-gray-400">
                        {isLoggedIn ? (
                            <Link
                                to={localizedPathOrRoot('editProfile', language, country)}
                                onClick={() => setOpen(false)}
                                className="font-semibold text-brand-green hover:underline"
                            >
                                {t('editProfile.settingsMoreInProfile')} <i className="fa-solid fa-arrow-right text-[10px]" aria-hidden="true"></i>
                            </Link>
                        ) : t('editProfile.settingsGuestNote')}
                    </p>
                </div>
            )}
        </div>
    );
};

export default SettingsMenu;
