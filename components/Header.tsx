



import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { signOut, markNotificationsAsRead, savePushSubscription } from '../services/supabaseService';
import Spinner from './Spinner';
import { VAPID_PUBLIC_KEY, LANGUAGES, COUNTRIES } from '../constants';
import { urlBase64ToUint8Array } from '../utils/urlBase64ToUint8Array';
import { Json } from '../types';
import { useTheme } from '../App';
import { useI18n, useTranslation, pathTranslations, Language, useAutoTranslation, getLanguageForCountryCode } from '../contexts/i18nContext';
import { useNotification } from '../contexts/NotificationContext';
import { useCountry, CountryCode } from '../contexts/CountryContext';
import { markInternalNavigation } from './LanguagePopup';

// Modal de confirmación para cambio de país
const CountryChangeModal: React.FC<{
    isOpen: boolean;
    targetCountry: typeof COUNTRIES[number] | null;
    onConfirm: () => void;
    onCancel: () => void;
}> = ({ isOpen, targetCountry, onConfirm, onCancel }) => {
    const t = useTranslation();

    if (!isOpen || !targetCountry) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onCancel}>
            <div
                className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-fade-in"
                onClick={e => e.stopPropagation()}
            >
                <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand-green/10 flex items-center justify-center">
                        <img src={targetCountry.flag} alt={targetCountry.name} width={40} height={40} loading="lazy" decoding="async" className="w-10 h-10 rounded-full object-cover" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">
                        {t('countrySwitch.confirmTitle')}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        {t('countrySwitch.confirmMessage').replace('{country}', targetCountry.name)}
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={onCancel}
                            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
                        >
                            {t('countrySwitch.cancel')}
                        </button>
                        <button
                            onClick={onConfirm}
                            className="flex-1 px-4 py-2.5 rounded-lg bg-brand-green text-white font-semibold hover:bg-green-600 transition-colors"
                        >
                            {t('countrySwitch.confirm')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Overlay de carga durante cambio de país
const CountryLoadingOverlay: React.FC<{ isVisible: boolean; countryName: string }> = ({ isVisible, countryName }) => {
    const t = useTranslation();

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm z-[100] flex items-center justify-center">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-brand-green border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    {t('countrySwitch.loading').replace('{country}', countryName)}
                </p>
            </div>
        </div>
    );
};

const MobileLanguageSelector: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { language, setLanguage } = useI18n();
    const navigate = useNavigate();
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);
    const t = useTranslation();

    const handleLanguageChange = (newLang: Language) => {
        if (newLang === language) {
            setIsOpen(false);
            onClose();
            return;
        }

        setLanguage(newLang);
        setIsOpen(false);
        onClose();
    };

    const selectedLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

    return (
        <div className="text-lg font-semibold">
            <button 
                onClick={() => setIsOpen(v => !v)}
                className="flex items-center justify-between w-full gap-4 px-4 py-3 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800"
            >
                <div className="flex items-center gap-4">
                    <i className="fa-solid fa-language w-6 text-center text-base"></i>
                    <span className="text-lg font-semibold">{t('header.language')}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <img src={selectedLang.flag} alt={selectedLang.name} width={20} height={20} loading="lazy" decoding="async" className="w-5 h-5 rounded-full object-cover" />
                    <i className={`fa-solid fa-chevron-down text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
                </div>
            </button>
            {isOpen && (
                <div className="pl-8 pt-1 space-y-1 max-h-48 overflow-y-auto">
                    {LANGUAGES.map(lang => (
                        <button
                            key={lang.code}
                            onClick={() => handleLanguageChange(lang.code as Language)}
                            className={`w-full text-left flex items-center gap-3 px-4 py-2 text-base rounded-lg transition-colors ${language === lang.code ? 'font-bold text-brand-green bg-brand-green/10' : 'text-gray-500 dark:text-gray-400'} hover:bg-gray-100 dark:hover:bg-zinc-700`}
                        >
                            <img src={lang.flag} alt={lang.name} width={20} height={20} loading="lazy" decoding="async" className="w-5 h-5 rounded-full object-cover" />
                            <span>{lang.name}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const MobileCountrySelector: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { userCountry, setUserCountry } = useCountry(); // CAMBIO: usar userCountry
    const { setLanguage } = useI18n();
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();
    const t = useTranslation();

    const handleCountryChange = (newCountryCode: string) => {
        setUserCountry(newCountryCode as CountryCode); // CAMBIO: actualizar userCountry
        // Cambiar idioma automáticamente según el país seleccionado
        const newLanguage = getLanguageForCountryCode(newCountryCode);
        setLanguage(newLanguage);
        setIsOpen(false);
        onClose();
        markInternalNavigation();
        navigate(`/${newCountryCode.toLowerCase()}`);
    };

    const selectedCountry = COUNTRIES.find(c => c.code === userCountry);

    return (
        <div className="text-lg font-semibold">
            <button 
                onClick={() => setIsOpen(v => !v)}
                className="flex items-center justify-between w-full gap-4 px-4 py-3 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800"
            >
                <div className="flex items-center gap-4">
                    <i className="fa-solid fa-globe w-6 text-center text-base"></i>
                    <span className="text-lg font-semibold">{t('common.headerCountry')}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    {selectedCountry ? (
                        <img src={selectedCountry.flag} alt={selectedCountry.name} width={20} height={20} loading="lazy" decoding="async" className="w-5 h-5 rounded-full object-cover" />
                    ) : (
                        <span className="text-xs">{t('common.headerSelect')}</span>
                    )}
                    <i className={`fa-solid fa-chevron-down text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
                </div>
            </button>
            {isOpen && (
                <div className="pl-8 pt-1 space-y-1 max-h-48 overflow-y-auto">
                    {COUNTRIES.map(c => (
                        <button
                            key={c.code}
                            onClick={() => handleCountryChange(c.code)}
                            className={`w-full text-left flex items-center gap-3 px-4 py-2 text-base rounded-lg transition-colors ${userCountry === c.code ? 'font-bold text-brand-green bg-brand-green/10' : 'text-gray-500 dark:text-gray-400'} hover:bg-gray-100 dark:hover:bg-zinc-700`}
                        >
                            <img src={c.flag} alt={c.name} width={20} height={20} loading="lazy" decoding="async" className="w-5 h-5 rounded-full object-cover" />
                            <span>{c.name}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};


const MobileMenu: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    user: any;
    profile: any;
    businesses: any[];
    handleLogout: () => void;
    brandName: string;
}> = ({ isOpen, onClose, user, profile, businesses, handleLogout, brandName }) => {
    const t = useTranslation();
    const { userCountry } = useCountry(); // CAMBIO: usar userCountry
    const { language } = useI18n();
    const { theme, toggleTheme } = useTheme();
    const location = useLocation();
    const isAdminRoute = location.pathname.startsWith('/admin');

    // Block body scroll when menu is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Use userCountry directly - don't infer from language
    const countryPrefix = userCountry ? `/${userCountry.toLowerCase()}` : '';
    const pathLang = userCountry ? getLanguageForCountryCode(userCountry) : language;
    const paths = pathTranslations[pathLang] || pathTranslations.es;

    // Check if current path is a business route in any language
    const isBusinessDashboard = useMemo(() => {
        const pathSegments = location.pathname.split('/').filter(Boolean);
        const hasCountryInPath = pathSegments.length > 0 && COUNTRIES.some(c => c.code.toLowerCase() === pathSegments[0]);
        const rawSegment = hasCountryInPath ? pathSegments[1] : pathSegments[0];

        if (!rawSegment) return false;

        // Decode URL-encoded characters (e.g., Chinese characters)
        const relevantSegment = decodeURIComponent(rawSegment);

        const businessPaths = Object.values(pathTranslations).flatMap(lang => [
            lang.myBusinesses,
            lang.businessDashboard?.split('/')[0],
            lang.completeBusinessRegistration?.split('/')[0],
            lang.migrateGoogleReviews?.split('/')[0]
        ]).filter(Boolean);

        return businessPaths.some(p => relevantSegment === p || relevantSegment.startsWith(p + '/'));
    }, [location.pathname]);

    const navLinks = useMemo(() => [
        { to: countryPrefix || '/', icon: "fa-solid fa-house", label: t('header.home') },
        { to: `${countryPrefix}/${paths.explore}`, icon: "fa-solid fa-compass", label: t('header.explore') },
        { to: `${countryPrefix}/${paths.businesses}`, icon: "fa-solid fa-store", label: t('header.businesses') },
        { to: `${countryPrefix}/${paths.forBusinesses}`, icon: "fa-solid fa-briefcase", label: t('header.forBusinessesMenu') },
        { to: `${countryPrefix}/${paths.pricing}`, icon: "fa-solid fa-rocket", label: t('header.pricing') },
    ], [countryPrefix, t, paths, language]);

    const secondaryNavLinks = useMemo(() => [
        { to: `${countryPrefix}/${paths.about}`, icon: "fa-solid fa-building", label: t('header.about') },
        { to: `${countryPrefix}/${paths.howItWorks}`, icon: "fa-solid fa-circle-info", label: t('header.howItWorks') },
        { to: `${countryPrefix}/${paths.widgets}`, icon: "fa-solid fa-puzzle-piece", label: t('header.widgets') },
        { to: `${countryPrefix}/${paths.faq}`, icon: "fa-solid fa-circle-question", label: t('header.faq') },
        { to: `${countryPrefix}/${paths.support}`, icon: "fa-solid fa-life-ring", label: t('header.support') },
    ], [countryPrefix, t, paths, language]);

    return (
        <>
            {/* Backdrop - tap to close */}
            <div
                className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
                onTouchStart={onClose}
                aria-hidden={!isOpen}
            >
                {/* Hint to tap outside to close - positioned in center-right of visible backdrop area */}
                {isOpen && (
                    <div className="absolute top-1/2 right-4 -translate-y-1/2 text-white/80 text-sm flex flex-col items-center gap-2 animate-pulse">
                        <i className="fa-solid fa-xmark text-2xl"></i>
                        <span className="text-xs">{t('common.tapToClose')}</span>
                    </div>
                )}
            </div>
            <div
                className={`fixed top-0 left-0 h-full w-[88vw] max-w-[320px] sm:w-80 bg-white dark:bg-zinc-900 shadow-2xl z-50 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="menu-title"
            >
                <div className="flex flex-col h-full">
                    <div className="flex justify-between items-center p-3 sm:p-4 border-b dark:border-zinc-800">
                        <Link to={countryPrefix || '/'} onClick={onClose} className="flex items-center gap-2">
                            <span id="menu-title" className="text-lg sm:text-xl font-bold text-brand-green truncate">{brandName}</span>
                        </Link>
                        <button onClick={onClose} className="text-gray-500 dark:text-gray-400 text-xl sm:text-2xl flex-shrink-0 w-8 h-8 flex items-center justify-center" aria-label="Cerrar menú">
                            <i className="fa-solid fa-times"></i>
                        </button>
                    </div>

                    <nav className="flex-grow p-3 sm:p-4 space-y-1 overflow-y-auto">
                        {user && profile && (
                             <Link to={`${countryPrefix}/${paths.profile}`} onClick={onClose} className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 mb-2 sm:mb-3 rounded-lg bg-gray-50 dark:bg-zinc-800">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center font-bold overflow-hidden flex-shrink-0 text-sm sm:text-base">
                                    {profile.avatar_url ? (
                                        <img src={profile.avatar_url} alt="Avatar" width={48} height={48} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="dark:text-gray-200">{profile.name?.charAt(0).toUpperCase()}</span>
                                    )}
                                </div>
                                <div className="truncate min-w-0">
                                    <p className="font-bold text-sm sm:text-base text-gray-800 dark:text-gray-100 truncate">{profile.name}</p>
                                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">@{profile.username || 'Ver Perfil'}</p>
                                </div>
                            </Link>
                        )}

                        {profile?.role === 'business_owner' && businesses && businesses.length > 0 && (
                            <NavLink
                                to={`${countryPrefix}/${paths.myBusinesses}`}
                                onClick={onClose}
                                className={({ isActive }) =>`flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-base sm:text-lg font-semibold transition-colors ${isActive ? 'bg-brand-green/10 text-brand-green' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800'}`}
                            >
                                <i className="fa-solid fa-briefcase w-5 sm:w-6 text-center text-sm sm:text-base flex-shrink-0"></i>
                                <span className="truncate">{t('header.myBusinesses')}</span>
                            </NavLink>
                        )}

                        {profile?.role === 'admin' && (
                            <NavLink
                                to="/admin/panel"
                                onClick={onClose}
                                className={({ isActive }) =>`flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-base sm:text-lg font-semibold transition-colors ${isActive ? 'bg-brand-green/10 text-brand-green' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800'}`}
                            >
                                <i className="fa-solid fa-shield-halved w-5 sm:w-6 text-center text-sm sm:text-base flex-shrink-0"></i>
                                <span className="truncate">{t('header.adminDashboard')}</span>
                            </NavLink>
                        )}

                        {navLinks.map(link => (
                            <NavLink key={link.to} to={link.to} end={link.to === (countryPrefix || '/')} onClick={onClose} className={({ isActive }) => `flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-base sm:text-lg font-semibold transition-colors ${isActive ? 'bg-brand-green/10 text-brand-green' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800'}`}>
                                <i className={`${link.icon} w-5 sm:w-6 text-center text-sm sm:text-base flex-shrink-0`}></i>
                                <span className="truncate">{link.label}</span>
                            </NavLink>
                        ))}

                        <div className="py-2 px-3 sm:px-4">
                            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider font-semibold mb-2">{t('header.more')}</p>
                        </div>

                        {secondaryNavLinks.map(link => (
                            <NavLink key={link.to} to={link.to} onClick={onClose} className={({ isActive }) => `flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-sm sm:text-base transition-colors ${isActive ? 'bg-brand-green/10 text-brand-green' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800'}`}>
                                <i className={`${link.icon} w-5 sm:w-6 text-center text-xs sm:text-sm flex-shrink-0`}></i>
                                <span className="truncate">{link.label}</span>
                            </NavLink>
                        ))}

                        <div className="py-2 sm:py-3 px-3 sm:px-4">
                            <hr className="border-gray-200 dark:border-zinc-700" />
                        </div>

                        <div className="px-1 sm:px-2">
                          <Link to={user ? `${countryPrefix}/${paths.writeReview}` : `${countryPrefix}/${paths.login}`} onClick={onClose} className="w-full bg-brand-green text-white font-bold py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg text-center block text-sm sm:text-base">
                              {t('header.writeReview')}
                          </Link>
                        </div>
                    </nav>

                    <div className="p-3 sm:p-4 border-t dark:border-zinc-800 space-y-1.5 sm:space-y-2">
                        {!isAdminRoute && !isBusinessDashboard && <MobileLanguageSelector onClose={onClose} />}
                        {!isAdminRoute && !isBusinessDashboard && <MobileCountrySelector onClose={onClose} />}

                        <div className="flex items-center justify-between w-full gap-3 sm:gap-4 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-base sm:text-lg font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800">
                            <div className="flex items-center gap-3 sm:gap-4">
                                <i className="fa-solid fa-moon w-5 sm:w-6 text-center text-sm sm:text-base flex-shrink-0"></i>
                                <span className="text-sm sm:text-base">{t('common.darkMode')}</span>
                            </div>
                            <button
                                onClick={(e) => toggleTheme(e)}
                                className="text-gray-600 dark:text-gray-400 transition-colors text-lg sm:text-xl w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full flex-shrink-0"
                                aria-label="Cambiar tema"
                            >
                               {theme === 'light' ? <i className="fa-solid fa-toggle-off text-xl sm:text-2xl text-gray-400"></i> : <i className="fa-solid fa-toggle-on text-xl sm:text-2xl text-brand-green"></i>}
                            </button>
                        </div>

                        {user && profile ? (
                            <button onClick={() => { handleLogout(); onClose(); }} className="w-full text-left block px-3 sm:px-4 py-2 text-xs sm:text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md font-semibold">
                                <i className="fa-solid fa-right-from-bracket mr-2"></i>
                                {t('header.logout')}
                            </button>
                        ) : (
                             <Link to={`${countryPrefix}/${paths.login}`} onClick={onClose} className="w-full text-left block px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-md font-semibold">
                                <i className="fa-solid fa-right-to-bracket mr-2"></i>
                                {t('header.login')}
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

const NotificationItem: React.FC<{ notification: any, onClick: () => void }> = ({ notification, onClick }) => {
    const { userCountry } = useCountry(); // CAMBIO: usar userCountry
    const { language } = useI18n();
    const t = useTranslation();
    const { text: translatedMessage } = useAutoTranslation(notification.message);

    // Use userCountry directly - don't infer from language
    const countryPrefix = userCountry ? `/${userCountry.toLowerCase()}` : '';
    const pathLang = userCountry ? getLanguageForCountryCode(userCountry) : language;
    const paths = pathTranslations[pathLang] || pathTranslations.es;

    const businessPathSegment = paths.business.split('/:sede').join('').replace(':identifier', notification.related_business_id || '');
    const targetUrl = `${countryPrefix}/${businessPathSegment}`;
    const localeForDate = 'es-ES';

    return (
        <Link 
            to={targetUrl}
            onClick={onClick} 
            className={`block px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 ${!notification.is_read ? 'bg-green-50 dark:bg-green-500/10' : ''}`}
        >
            <p className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <i className="fa-solid fa-reply text-brand-green"></i>
                {t('header.responseToYourReview')}
            </p>
            <p className="mt-1 text-gray-600 dark:text-gray-300">{translatedMessage}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{new Date(notification.created_at).toLocaleString(localeForDate)}</p>
        </Link>
    );
};


const Header: React.FC = () => {
    const { user, profile, loading, businesses, notifications, setNotifications } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { language, setLanguage } = useI18n();
    const { userCountry, setUserCountry } = useCountry(); // CAMBIO: usar userCountry
    const t = useTranslation();
    const { showNotification } = useNotification();
    const navigate = useNavigate();
    const location = useLocation();
    const oauthRedirectHandled = useRef(false);

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [userDropdownOpen, setUserDropdownOpen] = useState(false);
    const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
    const [langDropdownOpen, setLangDropdownOpen] = useState(false);
    const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
    const [moreDropdownOpen, setMoreDropdownOpen] = useState(false);
    const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);

    const userDropdownRef = useRef<HTMLDivElement>(null);
    const notifDropdownRef = useRef<HTMLDivElement>(null);
    const langDesktopRef = useRef<HTMLDivElement>(null);
    const countryDropdownRef = useRef<HTMLDivElement>(null);
    const moreDropdownRef = useRef<HTMLDivElement>(null);
    const companyDropdownRef = useRef<HTMLDivElement>(null);

    const [showNotifPrompt, setShowNotifPrompt] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [subscriptionError, setSubscriptionError] = useState<string | null>(null);

    // Country change confirmation state
    const [pendingCountryChange, setPendingCountryChange] = useState<typeof COUNTRIES[number] | null>(null);
    const [isChangingCountry, setIsChangingCountry] = useState(false);
    const [changingCountryName, setChangingCountryName] = useState('');

    const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

    // Use userCountry directly - don't infer from language
    const countryPrefix = userCountry ? `/${userCountry.toLowerCase()}` : '';
    const pathLang = userCountry ? getLanguageForCountryCode(userCountry) : language;
    const paths = pathTranslations[pathLang] || pathTranslations.es;

    const countryInfo = useMemo(() => COUNTRIES.find(c => c.code === userCountry), [userCountry]);
    const brandName = 'Opynio'; // Simplified: always "Opynio" in header (SEO titles keep country)
    const isAdminRoute = location.pathname.startsWith('/admin');

    // Check if current path is a business route (my-businesses, business dashboard, etc.) in any language
    const isBusinessDashboardRoute = useMemo(() => {
        const pathSegments = location.pathname.split('/').filter(Boolean);
        // Get the relevant path segment (after country code if present)
        const hasCountryInPath = pathSegments.length > 0 && COUNTRIES.some(c => c.code.toLowerCase() === pathSegments[0]);
        const rawSegment = hasCountryInPath ? pathSegments[1] : pathSegments[0];

        if (!rawSegment) return false;

        // Decode URL-encoded characters (e.g., Chinese characters)
        const relevantSegment = decodeURIComponent(rawSegment);

        // Excluir explícitamente el directorio público de empresas
        const publicBusinessDirectoryPaths = Object.values(pathTranslations).map(lang => lang.businesses).filter(Boolean);
        if (publicBusinessDirectoryPaths.some(p => relevantSegment === p)) {
            return false;
        }

        // Check against all language translations of business routes
        const businessPaths = Object.values(pathTranslations).flatMap(lang => [
            lang.myBusinesses,
            lang.businessDashboard?.split('/')[0],
            lang.completeBusinessRegistration?.split('/')[0],
            lang.migrateGoogleReviews?.split('/')[0]
        ]).filter(Boolean);

        return businessPaths.some(p => relevantSegment === p || relevantSegment.startsWith(p + '/'));
    }, [location.pathname]);


    useEffect(() => {
        if (!oauthRedirectHandled.current && !loading && user && location.hash.includes('access_token')) {
            oauthRedirectHandled.current = true;
            // Use userCountry directly - don't infer from language
            const oauthPathLang = userCountry ? getLanguageForCountryCode(userCountry) : language;
            const postLoginPath = pathTranslations[oauthPathLang]?.postLogin || pathTranslations.es.postLogin;
            const countryPath = userCountry ? `/${userCountry.toLowerCase()}` : '';
            navigate(`${countryPath}/${postLoginPath}`, { replace: true });
        }
    }, [user, loading, location.hash, navigate, userCountry, language]);

    useEffect(() => {
        if (!user || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
        const dismissed = localStorage.getItem('notificationPromptDismissed') === 'true';
        if (Notification.permission === 'default' && !dismissed) setShowNotifPrompt(true);
        navigator.serviceWorker.ready.then(r => r.pushManager.getSubscription().then(s => { if(s){ setIsSubscribed(true); setShowNotifPrompt(false); }}));
    }, [user]);

    const handleSubscribe = async () => {
        if (!user) return;
        setSubscriptionError(null);
        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') { setSubscriptionError('Permiso de notificación denegado.'); setShowNotifPrompt(false); return; }
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource });
            await savePushSubscription(user.id, subscription.toJSON() as unknown as Json);
            setIsSubscribed(true);
            setShowNotifPrompt(false);
        } catch (error) {
            console.error('Failed to subscribe to push notifications', error);
            setSubscriptionError('No se pudieron activar las notificaciones.');
        }
    };

    const handleDismissNotifPrompt = () => { setShowNotifPrompt(false); localStorage.setItem('notificationPromptDismissed', 'true'); };

    const handleLogout = async () => {
        try {
            await signOut();
        } catch (error) {
            // Ignore errors - session might already be expired
            console.warn('SignOut warning (session may have expired):', error);
        } finally {
            // Clear all Supabase auth data from localStorage
            const keysToRemove = Object.keys(localStorage).filter(key =>
                key.startsWith('sb-') || key.includes('supabase')
            );
            keysToRemove.forEach(key => localStorage.removeItem(key));

            // Close dropdown and force full page reload to clear all state
            setUserDropdownOpen(false);
            window.location.href = '/';
        }
    };
    
    const handleNotifClick = async () => {
        setNotifDropdownOpen(!notifDropdownOpen);
        if (!notifDropdownOpen && unreadCount > 0 && user) {
            const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
            if(unreadIds.length > 0) {
                try {
                    await markNotificationsAsRead(user.id, unreadIds);
                    setNotifications(current => current.map(n => unreadIds.includes(n.id) ? { ...n, read: true } : n));
                } catch(err) {
                    console.error("Failed to mark notifications as read", err);
                }
            }
        }
    };
    
    const handleDesktopLanguageChange = (newLang: Language) => {
        if (newLang === language) {
            setLangDropdownOpen(false);
            return;
        }

        setLanguage(newLang);
        setLangDropdownOpen(false);
    };

    const handleCountryChange = (newCountryCode: string) => {
        // If same country, just close dropdown
        if (newCountryCode === userCountry) {
            setCountryDropdownOpen(false);
            return;
        }
        // Show confirmation modal
        const targetCountry = COUNTRIES.find(c => c.code === newCountryCode);
        if (targetCountry) {
            setPendingCountryChange(targetCountry);
            setCountryDropdownOpen(false);
        }
    };

    const handleConfirmCountryChange = () => {
        if (!pendingCountryChange) return;

        const targetCode = pendingCountryChange.code;
        const targetName = pendingCountryChange.name;

        // CRÍTICO: Actualizar userCountry (preferencia del usuario)
        setUserCountry(targetCode);

        // Cambiar idioma automáticamente según el país seleccionado
        const newLanguage = getLanguageForCountryCode(targetCode);
        setLanguage(newLanguage);

        setChangingCountryName(targetName);
        setIsChangingCountry(true);
        setPendingCountryChange(null);

        // Small delay for visual feedback, then navigate
        setTimeout(() => {
            navigate(`/${targetCode.toLowerCase()}`);
            // Reset loading after navigation starts
            setTimeout(() => {
                setIsChangingCountry(false);
                setChangingCountryName('');
                // Show success notification
                showNotification(t('common.countryChanged', { country: targetName }), 'success');
            }, 500);
        }, 300);
    };

    const handleCancelCountryChange = () => {
        setPendingCountryChange(null);
    };
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (userDropdownRef.current && !userDropdownRef.current.contains(target)) setUserDropdownOpen(false);
            if (notifDropdownRef.current && !notifDropdownRef.current.contains(target)) setNotifDropdownOpen(false);
            if (langDesktopRef.current && !langDesktopRef.current.contains(target)) setLangDropdownOpen(false);
            if (countryDropdownRef.current && !countryDropdownRef.current.contains(target)) setCountryDropdownOpen(false);
            if (moreDropdownRef.current && !moreDropdownRef.current.contains(target)) setMoreDropdownOpen(false);
            if (companyDropdownRef.current && !companyDropdownRef.current.contains(target)) setCompanyDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const NotificationPrompt: React.FC = () => (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm flex items-center justify-between gap-4">
            <div><p className="font-semibold text-yellow-800">¡Mantente al día!</p><p className="text-yellow-700">Activa las notificaciones para saber cuándo responden a tus reseñas.</p>{subscriptionError && <p className="text-red-600 mt-1 text-xs font-medium">{subscriptionError}</p>}</div>
            <div className="flex items-center gap-4 flex-shrink-0"><button onClick={handleSubscribe} className="bg-brand-green text-white font-semibold px-4 py-1.5 rounded-md hover:bg-opacity-90 transition-all shadow-sm whitespace-nowrap text-xs">Activar</button><button onClick={handleDismissNotifPrompt} className="text-yellow-800 hover:text-yellow-900 transition-colors p-1" aria-label="Cerrar aviso de notificaciones"><i className="fa-solid fa-times text-lg"></i></button></div>
        </div>
    );

    const UserDropdownMenu: React.FC = () => (
        <div className="relative" ref={userDropdownRef}>
            <button onClick={() => setUserDropdownOpen(!userDropdownOpen)} className="w-10 h-10 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center text-brand-dark dark:text-gray-200 font-bold overflow-hidden">
                {profile?.avatar_url ? <img src={profile.avatar_url} alt="Avatar" width={48} height={48} loading="lazy" decoding="async" className="w-full h-full object-cover" /> : <span>{profile?.name?.charAt(0).toUpperCase()}</span>}
            </button>
            {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-zinc-800 rounded-md shadow-lg py-1 z-50 border border-gray-100 dark:border-zinc-700">
                    <div className="px-4 py-2 border-b dark:border-zinc-700"><p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{profile?.name}</p><p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p></div>
                    <Link to={`${countryPrefix}/${paths.profile}`} onClick={() => setUserDropdownOpen(false)} className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700">{t('header.myProfile')}</Link>
                    {profile?.role === 'business_owner' && businesses && businesses.length > 0 && <Link to={`${countryPrefix}/${paths.myBusinesses}`} onClick={() => setUserDropdownOpen(false)} className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700">{t('header.myBusinesses')}</Link>}
                    {profile?.role === 'admin' && <Link to="/admin/panel" onClick={() => setUserDropdownOpen(false)} className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700">{t('header.adminDashboard')}</Link>}
                    <button onClick={handleLogout} className="w-full text-left block px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10">{t('header.logout')}</button>
                </div>
            )}
        </div>
    );
    
    const NotificationDropdown: React.FC = () => (
        <div className="relative" ref={notifDropdownRef}>
            <button onClick={handleNotifClick} className="relative text-gray-600 dark:text-gray-300 hover:text-brand-green transition-colors text-xl w-10 h-10 flex items-center justify-center rounded-full"><i className="fa-regular fa-bell"></i>{unreadCount > 0 && <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">{unreadCount}</span>}</button>
            {notifDropdownOpen && (<div className="absolute right-0 mt-2 w-80 bg-white dark:bg-zinc-800 rounded-md shadow-lg z-50 border border-gray-100 dark:border-zinc-700"><div className="px-4 py-3 border-b dark:border-zinc-700"><h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t('header.notifications')}</h3></div><div className="max-h-96 overflow-y-auto">{notifications.length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400 p-4 text-center">{t('header.noNotifications')}</p> : notifications.map(n => <NotificationItem key={n.id} notification={n} onClick={() => setNotifDropdownOpen(false)} />)}</div></div>)}
        </div>
    );
    
    const LanguageDropdownPanel: React.FC = () => (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-zinc-800 rounded-md shadow-lg py-1 z-50 border border-gray-100 dark:border-zinc-700 max-h-60 overflow-y-auto">
            {LANGUAGES.map(lang => (
                <button 
                    key={lang.code}
                    onClick={() => handleDesktopLanguageChange(lang.code as Language)}
                    className={`w-full text-left flex items-center gap-3 px-4 py-2 text-sm transition-colors ${language === lang.code ? 'font-bold text-brand-green' : 'text-gray-700 dark:text-gray-300'} hover:bg-gray-100 dark:hover:bg-zinc-700`}
                >
                    <img src={lang.flag} alt={lang.name} width={20} height={20} loading="lazy" decoding="async" className="w-5 h-5 rounded-full object-cover" />
                    <span>{lang.name}</span>
                </button>
            ))}
        </div>
    );

    const CountryDropdownPanel: React.FC = () => (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-zinc-800 rounded-md shadow-lg py-1 z-50 border border-gray-100 dark:border-zinc-700 max-h-60 overflow-y-auto">
            {COUNTRIES.map(c => (
                <button 
                    key={c.code}
                    onClick={() => handleCountryChange(c.code)}
                    className={`w-full text-left flex items-center gap-3 px-4 py-2 text-sm transition-colors ${userCountry === c.code ? 'font-bold text-brand-green' : 'text-gray-700 dark:text-gray-300'} hover:bg-gray-100 dark:hover:bg-zinc-700`}
                >
                    <img src={c.flag} alt={c.name} width={20} height={20} loading="lazy" decoding="async" className="w-5 h-5 rounded-full object-cover" />
                    <span>{c.name}</span>
                </button>
            ))}
        </div>
    );

    const selectedCountry = COUNTRIES.find(c => c.code === userCountry);

    return (
        <>
            <header className="bg-white/90 backdrop-blur-md border-b border-gray-200 dark:bg-zinc-900/90 dark:border-zinc-800 sticky top-0 z-30">
                <div className="container mx-auto px-3 sm:px-4">
                    <div className="flex justify-between items-center py-3 sm:py-4">
                        <Link to={countryPrefix || '/'} className="flex items-center gap-2"><span className="text-xl sm:text-2xl font-bold text-brand-green">{brandName}</span></Link>
                        <div className="hidden xl:flex items-center gap-3 2xl:gap-4">
                            <nav className="flex items-center gap-6 xl:gap-8 text-brand-dark dark:text-gray-300 font-medium text-sm mx-auto">
                                {/* 1. Inicio */}
                                <Link to={countryPrefix || '/'} className="hover:text-brand-green transition-colors">{t('header.home')}</Link>

                                {/* 2. Explorar */}
                                <Link to={`${countryPrefix}/${paths.explore}`} className="hover:text-brand-green transition-colors">{t('header.explore')}</Link>

                                {/* 3. Empresas (Directorio) */}
                                <Link to={`${countryPrefix}/${paths.businesses}`} className="hover:text-brand-green transition-colors">{t('header.businesses')}</Link>

                                {/* 4. Widgets */}
                                <Link to={`${countryPrefix}/${paths.widgets}`} className="hover:text-brand-green transition-colors">{t('header.widgets')}</Link>

                                {/* 5. Precios */}
                                <Link to={`${countryPrefix}/${paths.pricing}`} className="hover:text-brand-green transition-colors">{t('header.pricing')}</Link>

                                {/* 6. Más - dropdown */}
                                <div className="relative" ref={moreDropdownRef}>
                                    <button
                                        onClick={() => setMoreDropdownOpen(v => !v)}
                                        className="flex items-center gap-1.5 hover:text-brand-green transition-colors"
                                    >
                                        <span>{t('header.more')}</span>
                                        <i className={`fa-solid fa-chevron-down text-xs transition-transform ${moreDropdownOpen ? 'rotate-180' : ''}`}></i>
                                    </button>
                                    {moreDropdownOpen && (
                                        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-zinc-800 rounded-lg shadow-xl py-2 z-50 border border-gray-100 dark:border-zinc-700">
                                            <Link to={`${countryPrefix}/${paths.about}`} onClick={() => setMoreDropdownOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors">
                                                <i className="fa-solid fa-building w-5 text-brand-green"></i>
                                                <span>{t('header.about')}</span>
                                            </Link>
                                            <Link to={`${countryPrefix}/${paths.howItWorks}`} onClick={() => setMoreDropdownOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors">
                                                <i className="fa-solid fa-circle-info w-5 text-brand-green"></i>
                                                <span>{t('header.howItWorks')}</span>
                                            </Link>
                                            <Link to={`${countryPrefix}/${paths.caseStudies}`} onClick={() => setMoreDropdownOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors">
                                                <i className="fa-solid fa-trophy w-5 text-brand-green"></i>
                                                <span>{t('header.caseStudies')}</span>
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            </nav>
                            <div className="flex items-center gap-1.5 xl:gap-2">
                                {/* Language selector moved to Footer for desktop - kept in mobile menu */}
                                {!isAdminRoute && !isBusinessDashboardRoute && (
                                    <div className="relative" ref={countryDropdownRef}>
                                        <button
                                          type="button"
                                          className="flex items-center gap-1.5 xl:gap-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors px-2 xl:px-3 py-1.5 rounded-full border dark:border-zinc-700 text-xs xl:text-sm"
                                          onClick={() => setCountryDropdownOpen(v => !v)}
                                          aria-label="Cambiar país"
                                        >
                                            {selectedCountry ? (
                                                <>
                                                    <img src={selectedCountry.flag} alt={selectedCountry.name} width={20} height={20} loading="lazy" decoding="async" className="w-4 h-4 xl:w-5 xl:h-5 rounded-full object-cover" />
                                                    <span className="font-semibold hidden xl:inline">{selectedCountry.name}</span>
                                                </>
                                            ) : (
                                                <span className="font-semibold">{t('header.selectCountry')}</span>
                                            )}
                                            <i className="fa-solid fa-chevron-down text-xs text-gray-400"></i>
                                        </button>
                                        {countryDropdownOpen && <CountryDropdownPanel />}
                                    </div>
                                )}
                                <button onClick={(event) => toggleTheme(event)} className="text-gray-600 dark:text-gray-400 hover:text-brand-green dark:hover:text-brand-green transition-colors text-lg xl:text-xl w-8 h-8 flex items-center justify-center rounded-full" aria-label="Toggle dark mode">{theme === 'light' ? <i className="fa-solid fa-moon"></i> : <i className="fa-solid fa-sun"></i>}</button>
                                {loading ? <div className="w-8 h-8"><Spinner /></div> : user ? (
                                    <>
                                        <NotificationDropdown />
                                        <Link to={`${countryPrefix}/${paths.writeReview}`} className="bg-brand-green text-white font-semibold px-3 xl:px-5 py-2 rounded-md hover:bg-opacity-90 transition-all shadow-sm whitespace-nowrap text-xs xl:text-sm">{t('header.writeReview')}</Link>
                                        <UserDropdownMenu />
                                    </>
                                ) : (
                                    <>
                                        <Link to={`${countryPrefix}/${paths.login}`} className="text-brand-dark dark:text-gray-200 font-medium hover:text-brand-green transition-colors whitespace-nowrap text-sm xl:text-base">{t('header.login')}</Link>
                                        <Link to={`${countryPrefix}/${paths.forBusinesses}`} className="bg-brand-green text-white font-semibold px-3 xl:px-5 py-2 rounded-md hover:bg-opacity-90 transition-all shadow-sm whitespace-nowrap text-xs xl:text-sm">{t('header.forBusinesses')}</Link>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="xl:hidden flex items-center gap-1 sm:gap-2">
                             <button onClick={(event) => toggleTheme(event)} className="text-gray-600 dark:text-gray-400 hover:text-brand-green dark:hover:text-brand-green transition-colors text-lg sm:text-xl w-8 sm:w-10 h-8 sm:h-10 flex items-center justify-center rounded-full" aria-label="Toggle dark mode">{theme === 'light' ? <i className="fa-solid fa-moon"></i> : <i className="fa-solid fa-sun"></i>}</button>
                            {user && <NotificationDropdown />}
                            <button onClick={() => setIsMenuOpen(true)} className="text-gray-600 dark:text-gray-300 text-xl sm:text-2xl w-8 sm:w-10 h-8 sm:h-10 flex items-center justify-center" aria-label="Abrir menú"><i className="fa-solid fa-bars"></i></button>
                        </div>
                    </div>
                </div>
                {showNotifPrompt && !isSubscribed && <div className="container mx-auto px-3 sm:px-4 pb-3"><NotificationPrompt /></div>}
            </header>
            <MobileMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} user={user} profile={profile} businesses={businesses} handleLogout={handleLogout} brandName={brandName} />

            {/* Country change confirmation modal */}
            <CountryChangeModal
                isOpen={!!pendingCountryChange}
                targetCountry={pendingCountryChange}
                onConfirm={handleConfirmCountryChange}
                onCancel={handleCancelCountryChange}
            />

            {/* Country change loading overlay */}
            <CountryLoadingOverlay
                isVisible={isChangingCountry}
                countryName={changingCountryName}
            />
        </>
    );
};

export default Header;