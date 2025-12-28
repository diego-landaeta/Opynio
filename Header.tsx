



import React, { useState, useRef, useEffect, useMemo } from 'react';
// FIX: The error "has no exported member 'useHistory'" suggests a react-router-dom version mismatch.
// Migrating to v6 syntax by using useNavigate instead of useHistory.
// FIX: Changed react-router-dom imports to a namespace import to resolve module resolution issues.
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { signOut, markNotificationsAsRead, savePushSubscription } from '../services/supabaseService';
import Spinner from './Spinner';
import { VAPID_PUBLIC_KEY } from '../constants';
import { urlBase64ToUint8Array } from '../utils/urlBase64ToUint8Array';
import { Json } from '../types';
import { useTheme } from '../App';
import { useI18n, useTranslation, pathTranslations, Language } from '../contexts/i18nContext';


const MobileMenu: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    user: any; // Using 'any' for simplicity, should be User | null
    profile: any; // Using 'any' for simplicity, should be Profile | null
    businesses: any[];
    theme: string;
    toggleTheme: (e: React.MouseEvent) => void;
    handleLogout: () => void;
}> = ({ isOpen, onClose, user, profile, businesses, theme, toggleTheme, handleLogout }) => {
    const t = useTranslation();
    const { language, setLanguage } = useI18n();
    const navigate = useNavigate();
    const location = useLocation();

    const handleLanguageChange = (newLang: Language) => {
        if (newLang === language) return;

        const currentPath = location.pathname;
        const currentLangPrefix = `/${language}`;
        const basePath = currentPath.startsWith(currentLangPrefix) ? currentPath.substring(currentLangPrefix.length) : currentPath;

        // Find the key for the current path
        const pathKey = (Object.keys(pathTranslations[language]) as Array<keyof typeof pathTranslations.es>).find(key => {
            const pathValue = pathTranslations[language][key];
            // Handle dynamic parts of paths
            return new RegExp(`^${pathValue.replace(/:[^\s/]+/g, '([^/]+)')}$`).test(basePath);
        });
        
        let newPath;
        if (pathKey) {
            newPath = `/${newLang}/${pathTranslations[newLang][pathKey]}`;
            // Preserve dynamic params
            const currentPathParts = basePath.split('/');
            const newPathParts = newPath.split('/');
            for (let i = 0; i < newPathParts.length; i++) {
                if (newPathParts[i].startsWith(':')) {
                    newPathParts[i] = currentPathParts[i];
                }
            }
            newPath = newPathParts.join('/');
        } else {
             newPath = `/${newLang}${basePath}`; // Fallback for unmatched paths
        }
        
        setLanguage(newLang);
        navigate(newPath);
        onClose();
    };
    
    const langPrefix = `/${language}`;

    const navLinks = useMemo(() => [
        { to: langPrefix, icon: "fa-solid fa-house", label: t('header.home') },
        { to: `${langPrefix}/${pathTranslations[language].explore}`, icon: "fa-solid fa-compass", label: t('header.explore') },
        { to: `${langPrefix}/${pathTranslations[language].businesses}`, icon: "fa-solid fa-store", label: t('header.businesses') },
        { to: `${langPrefix}/${pathTranslations[language].pricing}`, icon: "fa-solid fa-rocket", label: t('header.pricing') },
        { to: `${langPrefix}/${pathTranslations[language].community}`, icon: "fa-solid fa-users", label: t('header.community') },
        { to: `${langPrefix}/${pathTranslations[language].whatsNew}`, icon: "fa-solid fa-newspaper", label: t('header.whatsNew') },
        { to: `${langPrefix}/${pathTranslations[language].support}`, icon: "fa-solid fa-life-ring", label: t('header.support') },
    ], [language, t, langPrefix]);

    return (
        <>
            {/* Overlay */}
            <div
                className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
                aria-hidden={!isOpen}
            ></div>

            {/* Menu Panel */}
            <div
                className={`fixed top-0 left-0 h-full w-72 bg-white dark:bg-zinc-900 shadow-2xl z-50 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="menu-title"
            >
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="flex justify-between items-center p-4 border-b dark:border-zinc-800">
                        <Link to={langPrefix} onClick={onClose} className="flex items-center gap-2">
                            <span id="menu-title" className="text-xl font-bold text-brand-green">Opynio</span>
                        </Link>
                        <button onClick={onClose} className="text-gray-500 dark:text-gray-400 text-2xl" aria-label="Cerrar menú">
                            <i className="fa-solid fa-times"></i>
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-grow p-4 space-y-1 overflow-y-auto">
                        {user && profile && (
                             <Link to={`${langPrefix}/${pathTranslations[language].profile}`} onClick={onClose} className="flex items-center gap-3 p-3 mb-3 rounded-lg bg-gray-50 dark:bg-zinc-800">
                                <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center font-bold overflow-hidden flex-shrink-0">
                                    {profile.avatar_url ? (
                                        <img src={profile.avatar_url} alt="Avatar" width={48} height={48} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="dark:text-gray-200">{profile.name?.charAt(0).toUpperCase()}</span>
                                    )}
                                </div>
                                <div className="truncate">
                                    <p className="font-bold text-gray-800 dark:text-gray-100 truncate">{profile.name}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">@{profile.username || 'Ver Perfil'}</p>
                                </div>
                            </Link>
                        )}
                        
                        {profile?.role === 'business_owner' && businesses && businesses.length > 0 && (
                            <NavLink
                                to={`${langPrefix}/${pathTranslations[language].myBusinesses}`}
                                onClick={onClose}
                                className={({ isActive }) =>
                                    `flex items-center gap-4 px-4 py-3 rounded-lg text-lg font-semibold transition-colors ${
                                    isActive
                                        ? 'bg-brand-green/10 text-brand-green'
                                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
                                    }`
                                }
                            >
                                <i className="fa-solid fa-briefcase w-6 text-center text-base"></i>
                                <span>{t('header.myBusinesses')}</span>
                            </NavLink>
                        )}

                        {navLinks.map(link => (
                            <NavLink
                                key={link.to}
                                to={link.to}
                                end={link.to === langPrefix}
                                onClick={onClose}
                                className={({ isActive }) =>
                                    `flex items-center gap-4 px-4 py-3 rounded-lg text-lg font-semibold transition-colors ${
                                    isActive
                                        ? 'bg-brand-green/10 text-brand-green'
                                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
                                    }`
                                }
                            >
                                <i className={`${link.icon} w-6 text-center text-base`}></i>
                                <span>{link.label}</span>
                            </NavLink>
                        ))}
                    </nav>

                    {/* Actions */}
                    <div className="p-4 border-t dark:border-zinc-800 space-y-4">
                        <Link
                            to={user ? `${langPrefix}/${pathTranslations[language].writeReview}` : `${langPrefix}/${pathTranslations[language].login}`}
                            onClick={onClose}
                            className="w-full bg-brand-green text-white font-bold py-3 px-6 rounded-lg text-center block"
                        >
                            {t('header.writeReview')}
                        </Link>

                        <div className="flex items-center justify-between bg-gray-100 dark:bg-zinc-800 p-2 rounded-lg">
                             <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('header.language')}</span>
                            <div className="flex items-center bg-gray-200 dark:bg-zinc-700 rounded-md">
                                <button onClick={() => handleLanguageChange('es')} className={`px-3 py-1 text-sm rounded-md ${language === 'es' ? 'bg-white dark:bg-zinc-600 shadow font-bold' : 'font-medium'}`}>ES</button>
                                <button onClick={() => handleLanguageChange('en')} className={`px-3 py-1 text-sm rounded-md ${language === 'en' ? 'bg-white dark:bg-zinc-600 shadow font-bold' : 'font-medium'}`}>EN</button>
                            </div>
                        </div>
                        
                        <div className="flex items-center justify-between bg-gray-100 dark:bg-zinc-800 p-2 rounded-lg">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('header.darkMode')}</span>
                            <button
                                onClick={(e) => toggleTheme(e)}
                                className="text-gray-600 dark:text-gray-400 hover:text-brand-green dark:hover:text-brand-green transition-colors text-xl w-8 h-8 flex items-center justify-center rounded-full"
                                aria-label={t('common.aria.changeTheme')}
                            >
                               {theme === 'light' ? <i className="fa-solid fa-moon"></i> : <i className="fa-solid fa-sun"></i>}
                            </button>
                        </div>
                        
                        {user && profile ? (
                            <button onClick={() => { handleLogout(); onClose(); }} className="w-full text-left block px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md font-semibold">
                                <i className="fa-solid fa-right-from-bracket mr-2"></i>
                                {t('header.logout')}
                            </button>
                        ) : (
                             <Link to={`${langPrefix}/${pathTranslations[language].login}`} onClick={onClose} className="w-full text-left block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-md font-semibold">
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


const Header: React.FC = () => {
    const { user, profile, loading, businesses, notifications, setNotifications } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { language, setLanguage } = useI18n();
    const t = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const oauthRedirectHandled = useRef(false);

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [userDropdownOpen, setUserDropdownOpen] = useState(false);
    const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
    const [langDropdownOpen, setLangDropdownOpen] = useState(false);
    const userDropdownRef = useRef<HTMLDivElement>(null);
    const notifDropdownRef = useRef<HTMLDivElement>(null);
    const langDropdownRef = useRef<HTMLDivElement>(null);
    const [showNotifPrompt, setShowNotifPrompt] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
    
    const unreadCount = useMemo(() => notifications.filter(n => !n.is_read).length, [notifications]);

    const langPrefix = `/${language}`;

    // Effect for handling OAuth redirect
    useEffect(() => {
        if (!oauthRedirectHandled.current && !loading && user && location.hash.includes('access_token')) {
            oauthRedirectHandled.current = true;
            navigate(`${langPrefix}/${pathTranslations[language].postLogin}`, { replace: true });
        }
    }, [user, loading, location.hash, navigate, langPrefix, language]);

    useEffect(() => {
        if (!user || !('serviceWorker' in navigator) || !('PushManager' in window)) {
            return;
        }
        const dismissed = localStorage.getItem('notificationPromptDismissed') === 'true';
        if (Notification.permission === 'default' && !dismissed) {
            setShowNotifPrompt(true);
        }
        navigator.serviceWorker.ready.then(registration => {
            registration.pushManager.getSubscription().then(subscription => {
                if (subscription) {
                    setIsSubscribed(true);
                    setShowNotifPrompt(false);
                }
            });
        });
    }, [user]);

    const handleSubscribe = async () => {
        if (!user) return;
        setSubscriptionError(null);
        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                setSubscriptionError('Permiso de notificación denegado.');
                setShowNotifPrompt(false);
                return;
            }
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            });
            await savePushSubscription(user.id, subscription.toJSON() as unknown as Json);
            setIsSubscribed(true);
            setShowNotifPrompt(false);
        } catch (error) {
            console.error('Failed to subscribe to push notifications', error);
            setSubscriptionError('No se pudieron activar las notificaciones.');
        }
    };

    const handleDismissNotifPrompt = () => {
        setShowNotifPrompt(false);
        localStorage.setItem('notificationPromptDismissed', 'true');
    };

    const handleLogout = async () => {
        try {
            await signOut();
            setUserDropdownOpen(false);
            window.location.href = `/${language}`; // Full reload to clear state
        } catch (error) {
            console.error('Error logging out:', error);
        }
    };
    
    const handleNotifClick = async () => {
        setNotifDropdownOpen(!notifDropdownOpen);
        if (!notifDropdownOpen && unreadCount > 0) {
            const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
            if(unreadIds.length > 0) {
                try {
                    await markNotificationsAsRead(unreadIds);
                    setNotifications(current => current.map(n => unreadIds.includes(n.id) ? { ...n, is_read: true } : n));
                } catch(err) {
                    console.error("Failed to mark notifications as read", err);
                }
            }
        }
    };
    
    const handleLanguageChange = (newLang: Language) => {
        if (newLang === language) return;

        const currentPath = location.pathname;
        const currentLangPrefix = `/${language}`;
        const basePath = currentPath.startsWith(currentLangPrefix) ? currentPath.substring(currentLangPrefix.length) : currentPath;

        const pathKey = (Object.keys(pathTranslations[language]) as Array<keyof typeof pathTranslations.es>).find(key => {
            const pathValue = pathTranslations[language][key];
            const pathRegex = new RegExp(`^${pathValue.replace(/:[^\s/]+/g, '([^/]+)')}$`);
            return pathRegex.test(basePath);
        });
        
        let newPath;
        if (pathKey) {
            let newPathSegment = pathTranslations[newLang][pathKey];
            const oldPathParts = basePath.split('/');
            const newPathParts = newPathSegment.split('/');
            
            for (let i = 0; i < newPathParts.length; i++) {
                if (newPathParts[i].startsWith(':') && oldPathParts[i]) {
                    newPathParts[i] = oldPathParts[i];
                }
            }
            newPath = `/${newLang}/${newPathParts.join('/')}`;
        } else {
             newPath = `/${newLang}${basePath === '/' ? '' : basePath}`;
        }
        
        setLanguage(newLang);
        setLangDropdownOpen(false);
        navigate(newPath);
    };
    

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (userDropdownRef.current && !userDropdownRef.current.contains(target)) setUserDropdownOpen(false);
            if (notifDropdownRef.current && !notifDropdownRef.current.contains(target)) setNotifDropdownOpen(false);
            if (langDropdownRef.current && !langDropdownRef.current.contains(target)) setLangDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const NotificationPrompt: React.FC = () => (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm flex items-center justify-between gap-4">
            <div>
                <p className="font-semibold text-yellow-800">{t('header.notifPrompt.title')}</p>
                <p className="text-yellow-700">{t('header.notifPrompt.body')}</p>
                {subscriptionError && <p className="text-red-600 mt-1 text-xs font-medium">{subscriptionError}</p>}
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
                <button onClick={handleSubscribe} className="bg-brand-green text-white font-semibold px-4 py-1.5 rounded-md hover:bg-opacity-90 transition-all shadow-sm whitespace-nowrap text-xs">{t('header.notifPrompt.activateButton')}</button>
                <button onClick={handleDismissNotifPrompt} className="text-yellow-800 hover:text-yellow-900 transition-colors p-1" aria-label={t('header.notifPrompt.closeAriaLabel')}><i className="fa-solid fa-times text-lg"></i></button>
            </div>
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
                    <Link to={`${langPrefix}/${pathTranslations[language].profile}`} onClick={() => setUserDropdownOpen(false)} className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700">{t('header.myProfile')}</Link>
                    {profile?.role === 'business_owner' && businesses && businesses.length > 0 && <Link to={`${langPrefix}/${pathTranslations[language].myBusinesses}`} onClick={() => setUserDropdownOpen(false)} className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700">{t('header.myBusinesses')}</Link>}
                    {profile?.role === 'admin' && <Link to={`${langPrefix}/${pathTranslations[language].adminPanel}`} onClick={() => setUserDropdownOpen(false)} className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700">{t('header.adminDashboard')}</Link>}
                    <button onClick={handleLogout} className="w-full text-left block px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10">{t('header.logout')}</button>
                </div>
            )}
        </div>
    );
    
    const NotificationDropdown: React.FC = () => (
        <div className="relative" ref={notifDropdownRef}>
            <button onClick={handleNotifClick} className="relative text-gray-600 dark:text-gray-300 hover:text-brand-green transition-colors text-xl">
                 <i className="fa-regular fa-bell"></i>
                 {unreadCount > 0 && <span className="absolute -top-1 -right-2 w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">{unreadCount}</span>}
            </button>
            {notifDropdownOpen && (
                 <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-zinc-800 rounded-md shadow-lg z-50 border border-gray-100 dark:border-zinc-700">
                     <div className="px-4 py-3 border-b dark:border-zinc-700"><h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t('header.notifications')}</h3></div>
                     <div className="max-h-96 overflow-y-auto">{notifications.length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400 p-4 text-center">{t('header.noNotifications')}</p> : notifications.map(notification => <Link key={notification.id} to={`/${language}/${pathTranslations[language].business.replace(':identifier', notification.related_business_id || '')}`} onClick={() => setNotifDropdownOpen(false)} className={`block px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 ${!notification.is_read ? 'bg-green-50 dark:bg-green-500/10' : ''}`}><p className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2"><i className="fa-solid fa-reply text-brand-green"></i>{t('header.responseToYourReview')}</p><p className="mt-1 text-gray-600 dark:text-gray-300">{notification.message}</p><p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{new Date(notification.created_at).toLocaleString()}</p></Link>)}</div>
                 </div>
            )}
        </div>
    );
    
    const LanguageSwitcher: React.FC = () => {
        const languages = useMemo(() => [
            { code: 'es', name: 'Español', flag: 'https://flagcdn.com/es.svg' },
            { code: 'en', name: 'English', flag: 'https://flagcdn.com/us.svg' }
        ], []);
    
        const currentLangInfo = languages.find(l => l.code === language) || languages[0];
    
        return (
            <div className="relative" ref={langDropdownRef}>
                <button 
                    onClick={() => setLangDropdownOpen(!langDropdownOpen)} 
                    className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors px-3 py-1.5 rounded-full border dark:border-zinc-700"
                    aria-label="Cambiar idioma"
                >
                    <img src={currentLangInfo.flag} alt={currentLangInfo.name} width={20} height={20} loading="lazy" decoding="async" className="w-5 h-5 rounded-full" />
                    <span className="font-semibold text-xs uppercase">{currentLangInfo.code}</span>
                    <i className="fa-solid fa-chevron-down text-xs text-gray-400"></i>
                </button>
                {langDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-zinc-800 rounded-md shadow-lg py-1 z-50 border border-gray-100 dark:border-zinc-700">
                        {languages.map(lang => (
                            <button 
                                key={lang.code}
                                onClick={() => handleLanguageChange(lang.code as Language)} 
                                className={`w-full text-left flex items-center gap-3 px-4 py-2 text-sm ${language === lang.code ? 'font-bold text-brand-green' : 'text-gray-700 dark:text-gray-300'} hover:bg-gray-100 dark:hover:bg-zinc-700`}
                            >
                                <img src={lang.flag} alt={lang.name} width={20} height={20} loading="lazy" decoding="async" className="w-5 h-5 rounded-full" />
                                <span>{lang.name}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <>
            <header className="bg-white/90 backdrop-blur-md border-b border-gray-200 dark:bg-zinc-900/90 dark:border-zinc-800 sticky top-0 z-30">
                <div className="container mx-auto px-4">
                    <div className="flex justify-between items-center py-4">
                        <Link to={langPrefix} className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-brand-green">Opynio</span>
                        </Link>
                        
                        <div className="hidden md:flex items-center gap-6">
                            <nav className="flex items-center gap-6 text-brand-dark dark:text-gray-300 font-medium">
                                <Link to={langPrefix} className="hover:text-brand-green transition-colors">{t('header.home')}</Link>
                                <Link to={`${langPrefix}/${pathTranslations[language].explore}`} className="hover:text-brand-green transition-colors">{t('header.explore')}</Link>
                                <Link to={`${langPrefix}/${pathTranslations[language].businesses}`} className="hover:text-brand-green transition-colors">{t('header.businesses')}</Link>
                                <Link to={`${langPrefix}/${pathTranslations[language].pricing}`} className="hover:text-brand-green transition-colors">{t('header.pricing')}</Link>
                                <Link to={`${langPrefix}/${pathTranslations[language].community}`} className="hover:text-brand-green transition-colors">{t('header.community')}</Link>
                                <Link to={`${langPrefix}/${pathTranslations[language].whatsNew}`} className="hover:text-brand-green transition-colors">{t('header.whatsNew')}</Link>
                                <Link to={`${langPrefix}/${pathTranslations[language].support}`} className="hover:text-brand-green transition-colors">{t('header.support')}</Link>
                            </nav>
                            
                            <div className="flex items-center gap-4">
                                <LanguageSwitcher />
                                <button onClick={(event) => toggleTheme(event)} className="text-gray-600 dark:text-gray-400 hover:text-brand-green dark:hover:text-brand-green transition-colors text-xl w-8 h-8 flex items-center justify-center rounded-full" aria-label="Toggle dark mode">{theme === 'light' ? <i className="fa-solid fa-moon"></i> : <i className="fa-solid fa-sun"></i>}</button>
                                {loading ? <div className="w-8 h-8"><Spinner /></div> : user ? (
                                    <>
                                        <NotificationDropdown />
                                        <Link to={`${langPrefix}/${pathTranslations[language].writeReview}`} className="bg-brand-green text-white font-semibold px-5 py-2 rounded-md hover:bg-opacity-90 transition-all shadow-sm whitespace-nowrap">{t('header.writeReview')}</Link>
                                        <UserDropdownMenu />
                                    </>
                                ) : (
                                    <>
                                        <Link to={`${langPrefix}/${pathTranslations[language].login}`} className="text-brand-dark dark:text-gray-200 font-medium hover:text-brand-green transition-colors whitespace-nowrap">{t('header.login')}</Link>
                                        <Link to={`${langPrefix}/${pathTranslations[language].register}?type=business`} className="bg-brand-green text-white font-semibold px-5 py-2 rounded-md hover:bg-opacity-90 transition-all shadow-sm whitespace-nowrap hidden sm:block">{t('header.forBusinesses')}</Link>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="md:hidden flex items-center gap-2">
                             <button onClick={(event) => toggleTheme(event)} className="text-gray-600 dark:text-gray-400 hover:text-brand-green dark:hover:text-brand-green transition-colors text-xl w-10 h-10 flex items-center justify-center rounded-full" aria-label="Toggle dark mode">{theme === 'light' ? <i className="fa-solid fa-moon"></i> : <i className="fa-solid fa-sun"></i>}</button>
                            {user && <NotificationDropdown />}
                            <button onClick={() => setIsMenuOpen(true)} className="text-gray-600 dark:text-gray-300 text-2xl w-10 h-10 flex items-center justify-center" aria-label="Abrir menú"><i className="fa-solid fa-bars"></i></button>
                        </div>
                    </div>
                </div>
                {showNotifPrompt && !isSubscribed && <div className="container mx-auto px-4 pb-3"><NotificationPrompt /></div>}
            </header>
            <MobileMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} user={user} profile={profile} businesses={businesses} theme={theme} toggleTheme={toggleTheme} handleLogout={handleLogout} />
        </>
    );
};

export default Header;