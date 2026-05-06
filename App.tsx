
import React, { lazy, Suspense, createContext, useState, useEffect, useContext, ReactNode, Component, ErrorInfo } from 'react';
import { BrowserRouter, Routes, Route, Outlet, useParams, Navigate, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AdminRoute from './components/auth/AdminRoute';
import BusinessRoute from './components/auth/BusinessRoute';
import { NotificationProvider } from './contexts/NotificationContext';
import { ConfirmProvider } from './contexts/ConfirmContext';
import Snackbar from './components/Snackbar';
import RealtimeNotificationHandler from './components/RealtimeNotificationHandler';
import Spinner from './components/Spinner';
import { I18nProvider, useI18n, pathTranslations, Language, getLanguageForCountryCode } from './contexts/i18nContext';
import { CountryProvider, useCountry, CountryCode } from './contexts/CountryContext';
import { getBusinessByName, getBusinessById } from './services/supabaseService';
import { Business } from './types';
import { COUNTRIES } from './constants';
import LanguagePopup from './components/LanguagePopup';
import FloatingLanguageButton from './components/FloatingLanguageButton';
import PlanActivatedModal from './components/PlanActivatedModal';

// Error Boundary to catch render errors and prevent blank pages
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
    constructor(props: { children: ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            // Get browser language to show error in user's language
            const browserLang = navigator.language.toLowerCase();
            let title = "Something went wrong";
            let message = "An unexpected error has occurred. Please try reloading the page.";
            let reloadButton = "Reload page";

            // Simple language detection
            if (browserLang.startsWith('es')) {
                title = "Algo salió mal";
                message = "Ha ocurrido un error inesperado. Por favor, intenta recargar la página.";
                reloadButton = "Recargar página";
            } else if (browserLang.startsWith('pt')) {
                title = "Algo correu mal";
                message = "Ocorreu um erro inesperado. Por favor, tente recarregar a página.";
                reloadButton = "Recarregar página";
            } else if (browserLang.startsWith('fr')) {
                title = "Quelque chose s'est mal passé";
                message = "Une erreur inattendue s'est produite. Veuillez essayer de recharger la page.";
                reloadButton = "Recharger la page";
            } else if (browserLang.startsWith('de')) {
                title = "Etwas ist schief gelaufen";
                message = "Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie, die Seite neu zu laden.";
                reloadButton = "Seite neu laden";
            } else if (browserLang.startsWith('it')) {
                title = "Qualcosa è andato storto";
                message = "Si è verificato un errore imprevisto. Si prega di provare a ricaricare la pagina.";
                reloadButton = "Ricarica pagina";
            } else if (browserLang.startsWith('ca')) {
                title = "Alguna cosa ha anat malament";
                message = "S'ha produït un error inesperat. Si us plau, intenta recarregar la pàgina.";
                reloadButton = "Recarregar pàgina";
            } else if (browserLang.startsWith('zh')) {
                title = "出了点问题";
                message = "发生了意外错误。请尝试重新加载页面。";
                reloadButton = "重新加载页面";
            }

            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-900 p-8">
                    <div className="text-center max-w-lg">
                        <h1 className="text-2xl font-bold text-red-600 mb-4">{title}</h1>
                        <p className="text-gray-600 dark:text-gray-300 mb-4">
                            {message}
                        </p>
                        <pre className="text-xs text-left bg-gray-100 dark:bg-zinc-800 p-4 rounded overflow-auto mb-4">
                            {this.state.error?.message}
                        </pre>
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-brand-green text-white px-6 py-2 rounded-lg hover:bg-green-700"
                        >
                            {reloadButton}
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

// Lazy load all page components
const HomePage = lazy(() => import('./components/pages/HomePage'));
const ExplorePage = lazy(() => import('./components/pages/ExplorePage'));
const WriteReviewPage = lazy(() => import('./components/pages/WriteReviewPage'));
const BusinessPage = lazy(() => import('./components/pages/BusinessPage'));
const LoginPage = lazy(() => import('./components/pages/LoginPage'));
const RegisterPage = lazy(() => import('./components/pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./components/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./components/pages/ResetPasswordPage'));
const ProfilePage = lazy(() => import('./components/pages/ProfilePage'));
const AdminDashboardPage = lazy(() => import('./components/pages/admin/AdminDashboardPage'));
const CommunityPage = lazy(() => import('./components/pages/CommunityPage'));
const BusinessDashboardPage = lazy(() => import('./components/pages/business/BusinessDashboardPage'));
const BusinessListPage = lazy(() => import('./components/pages/business/BusinessListPage'));
const EditProfilePage = lazy(() => import('./components/pages/EditProfilePage'));
const PostLoginRedirect = lazy(() => import('./components/auth/PostLoginRedirect'));
const EditBusinessPage = lazy(() => import('./components/pages/business/EditBusinessPage'));
const SearchResultsPage = lazy(() => import('./components/pages/SearchResultsPage'));
const WhatsNewPage = lazy(() => import('./components/pages/WhatsNewPage'));
const BusinessesPage = lazy(() => import('./components/pages/BusinessesPage'));
const MigrateGoogleReviewsPage = lazy(() => import('./components/pages/business/MigrateGoogleReviewsPage'));
const CompleteBusinessRegistrationPage = lazy(() => import('./components/pages/business/CompleteBusinessRegistrationPage'));
const AdminEditBusinessPage = lazy(() => import('./components/pages/admin/AdminEditBusinessPage'));
const AdminCreateBusinessPage = lazy(() => import('./components/pages/admin/AdminCreateBusinessPage'));
const AdminScrapingPage = lazy(() => import('./components/pages/admin/AdminScrapingPage'));
const SupportPage = lazy(() => import('./components/pages/SupportPage'));
const AdminBulkEditPage = lazy(() => import('./components/pages/admin/AdminBulkEditPage'));
const AdminUsersPage = lazy(() => import('./components/pages/admin/AdminUsersPage'));
const AdminReviewModerationPage = lazy(() => import('./components/pages/admin/AdminReviewModerationPage'));
const PricingPage = lazy(() => import('./components/pages/PricingPage'));
const AssignBusinessPage = lazy(() => import('./components/pages/AssignBusinessPage'));
const PaymentSuccessPage = lazy(() => import('./components/pages/PaymentSuccessPage'));
const PaymentCancelPage = lazy(() => import('./components/pages/PaymentCancelPage'));
const AdminClaimsPage = lazy(() => import('./components/pages/admin/AdminClaimsPage'));
const AdminBugsPage = lazy(() => import('./components/pages/admin/AdminBugsPage'));
const AdminReviewAppealsPage = lazy(() => import('./components/pages/admin/AdminReviewAppealsPage'));
const AdminEnterprisePage = lazy(() => import('./components/pages/admin/AdminEnterprisePage'));
const AdminFeaturedBusinessesPage = lazy(() => import('./components/pages/admin/AdminFeaturedBusinessesPage'));
const AdminUrlManagerPage = lazy(() => import('./components/pages/admin/AdminUrlManagerPage'));
const NotFoundPage = lazy(() => import('./components/pages/NotFoundPage'));

// New auxiliary pages
const WidgetsShowcasePage = lazy(() => import('./components/pages/WidgetsShowcasePage'));
const ForBusinessesPage = lazy(() => import('./components/pages/ForBusinessesPage'));
const HowItWorksPage = lazy(() => import('./components/pages/HowItWorksPage'));
const FAQPage = lazy(() => import('./components/pages/FAQPage'));
const AboutPage = lazy(() => import('./components/pages/AboutPage'));
const CaseStudiesPage = lazy(() => import('./components/pages/CaseStudiesPage'));

// Lazy load business dashboard panels
const DashboardOverview = lazy(() => import('./components/pages/business/dashboard/DashboardOverview'));
const DashboardReviews = lazy(() => import('./components/pages/business/dashboard/DashboardReviews'));
const DashboardAnalytics = lazy(() => import('./components/pages/business/dashboard/DashboardAnalytics'));
const DashboardInvitations = lazy(() => import('./components/pages/business/dashboard/DashboardInvitations'));
const DashboardWidgets = lazy(() => import('./components/pages/business/dashboard/DashboardWidgets'));
const DashboardUserManual = lazy(() => import('./components/pages/business/dashboard/DashboardUserManual'));

// --- Theme Context for Dark Mode ---
type Theme = 'light' | 'dark';
interface ThemeContextType {
    theme: Theme;
    toggleTheme: (event: React.MouseEvent) => void;
}
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [theme, setTheme] = useState<Theme>('light');

    useEffect(() => {
        const root = window.document.documentElement;
        if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            root.classList.add('dark');
            setTheme('dark');
        } else {
            root.classList.remove('dark');
            setTheme('light');
        }
    }, []);

    const toggleTheme = (event: React.MouseEvent) => {
        const isDark = document.documentElement.classList.contains('dark');
        const newTheme = isDark ? 'light' : 'dark';

        // @ts-ignore
        if (!document.startViewTransition) {
            setTheme(newTheme);
            localStorage.setItem('theme', newTheme);
            document.documentElement.classList.toggle('dark');
            return;
        }

        const x = event.clientX;
        const y = event.clientY;
        
        // @ts-ignore
        document.startViewTransition(() => {
            const root = document.documentElement;
            root.style.setProperty('--x', x + 'px');
            root.style.setProperty('--y', y + 'px');
            setTheme(newTheme);
            localStorage.setItem('theme', newTheme);
            root.classList.toggle('dark');
        });
    };

    const value = { theme, toggleTheme };
    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
// --- End Theme Context ---

const MainLayout = () => {
    const { countryCode } = useParams<{ countryCode?: string }>();
    const { userCountry, viewingCountry, setViewingCountry } = useCountry();
    const { language, setLanguage } = useI18n();
    const location = useLocation();

    // Force Spanish language on admin routes
    useEffect(() => {
        if (location.pathname.startsWith('/admin')) {
            setLanguage('es');
        }
    }, [location.pathname, setLanguage]);

    // Sincroniza el idioma de la UI cuando el path no tiene country prefix
    // (p.ej. el usuario entra directo a /register, /preise, /prezzi, etc.).
    // Para paths con country prefix la fuente de verdad es el país, así que
    // no tocamos el idioma aquí (lo gestiona LanguagePopup).
    useEffect(() => {
        if (countryCode) return; // ya hay país, no interferir
        if (location.pathname.startsWith('/admin')) return; // admin = es, ya tratado
        const segs = location.pathname.split('/').filter(Boolean);
        if (segs.length === 0) return;
        const detected = detectLanguageFromPath(segs[0]);
        if (detected && detected !== language) {
            setLanguage(detected);
        }
    }, [location.pathname, countryCode, language, setLanguage]);

    // Sync viewingCountry from URL parameter (NOT userCountry)
    // If no countryCode is in the URL (root path), set viewingCountry to null
    useEffect(() => {
        const newCountryCode = countryCode?.toUpperCase() as CountryCode;
        const isValidCountry = COUNTRIES.some(c => c.code === newCountryCode);

        if (isValidCountry) {
            if (newCountryCode !== viewingCountry) {
                setViewingCountry(newCountryCode); // CAMBIO: actualizar viewingCountry, NO userCountry
            }
        } else {
            // This handles the root '/' case where countryCode is undefined
            if (viewingCountry !== null) {
                setViewingCountry(null);
            }
        }
    }, [countryCode, viewingCountry, setViewingCountry]);

    // Set document lang attribute based on userCountry (not viewingCountry)
    useEffect(() => {
        const langFromUserCountry = userCountry
            ? getLanguageForCountryCode(userCountry)
            : language;
        document.documentElement.lang = langFromUserCountry;
    }, [userCountry, language]);


    return (
        <>
            <RealtimeNotificationHandler />
            <Snackbar />
            <LanguagePopup />
            <FloatingLanguageButton />
            <PlanActivatedModal />
            <LanguagePathValidator>
                <div className="flex flex-col min-h-screen font-sans text-brand-dark dark:text-gray-200">
                    <Header />
                    <main className="flex-grow container mx-auto px-3 sm:px-4 md:px-6 pt-8 sm:pt-10 md:pt-12 pb-20 sm:pb-16 md:pb-12">
                        <Suspense fallback={<div className="flex justify-center items-center h-full py-12 sm:py-16 md:py-20"><Spinner /></div>}>
                           <Outlet/>
                        </Suspense>
                    </main>
                    <Footer />
                </div>
            </LanguagePathValidator>
        </>
    );
};

// Component to handle redirection for public paths that are tried without a country prefix
// but require one. Now it redirects to the homepage to force a country selection.
const PublicRedirector = () => {
  const { country } = useCountry();
  const location = useLocation();

  if (!country) {
      // If there's no country context, the user is on the "original" site.
      // We force them back to the homepage to select a country before accessing country-specific pages.
      return <Navigate to="/" replace />;
  }

  // Rebuild the path with the country prefix and search query
  const newPath = `/${country.toLowerCase()}${location.pathname}${location.search}`;

  return <Navigate to={newPath} replace />;
};

// ScrollToTop component - scrolls to top on route change
const ScrollToTop = () => {
    const { pathname } = useLocation();
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);
    return null;
};

// Helper function to check if a path matches the expected language for a country
// This is used to validate URLs and prevent cross-language path access
const getPathKeyFromPath = (path: string): keyof typeof pathTranslations.es | null => {
    const languages = Object.keys(pathTranslations) as Language[];
    for (const lang of languages) {
        const paths = pathTranslations[lang];
        for (const [key, value] of Object.entries(paths)) {
            // Extract base path without parameters
            const basePath = (value as string).split('/')[0].split(':')[0];
            const pathSegment = path.split('/')[0];
            if (basePath === pathSegment) {
                return key as keyof typeof pathTranslations.es;
            }
        }
    }
    return null;
};

// Detect which language a top-level path segment belongs to. Used in
// MainLayout para sincronizar el idioma de la UI cuando el usuario entra
// a una URL como /register, /login, /pricing... así la i18n del Header
// y resto del shell coincide con el idioma del path.
// Si el segmento aparece en varios idiomas (p.ej. "widgets", "support"
// que comparten texto), devuelve el primer match — irrelevante porque
// el contenido renderizado es el mismo.
const detectLanguageFromPath = (pathSegment: string): Language | null => {
    if (!pathSegment) return null;
    const languages = Object.keys(pathTranslations) as Language[];
    for (const lang of languages) {
        const paths = pathTranslations[lang];
        for (const value of Object.values(paths)) {
            const basePath = (value as string).split('/')[0].split(':')[0];
            if (basePath && (pathSegment === basePath || pathSegment.startsWith(basePath + '/'))) {
                return lang;
            }
        }
    }
    return null;
};

// Component that validates the path language matches the country
// Shows 404 for paths in wrong language (not redirect, to avoid indexing issues)
// Also validates that routes WITHOUT country prefix only accept Spanish paths
// IMPORTANT: Uses window.location.replace for actual HTTP 404 from server (SEO)
const LanguagePathValidator: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const location = useLocation();
    const { countryCode } = useParams<{ countryCode?: string }>();
    const [shouldShow404, setShouldShow404] = useState(false);

    const pathSegments = location.pathname.split('/').filter(Boolean);

    // Effect to handle 404 redirect with real HTTP status
    useEffect(() => {
        if (shouldShow404) {
            // Use hard navigation to /404 so Nginx can return real 404 HTTP status
            // This is critical for SEO - Google recognizes the HTTP status code
            console.log(`🚫 Redirecting to /404 for SEO (HTTP 404 status)`);
            window.location.replace('/404');
        }
    }, [shouldShow404]);

    // If we're about to redirect to 404, show loading spinner
    if (shouldShow404) {
        return (
            <div className="flex justify-center items-center h-64">
                <Spinner />
            </div>
        );
    }

    // Case 1: Routes WITHOUT country prefix (original Opynio site)
    // Aceptamos paths en cualquier idioma (es/en/fr/de/it/br/ca/cn). Antes
    // sólo se admitía español y se forzaba 404 al resto, lo que rompía
    // cosas como /register, /login (en), /preise (de), /prezzi (it), etc.
    // Ahora si el path es válido en cualquier idioma deja pasar; el shell
    // (Header/Footer) sincroniza su idioma a partir del path en MainLayout.
    if (!countryCode) {
        // Cualquier path se deja pasar; los routes registrados en uniquePaths
        // los manejan, y los que no matcheen caen al catch-all 404.
        return <>{children}</>;
    }

    // Case 2: Routes WITH country prefix
    // Check if countryCode is valid
    const isValidCountry = COUNTRIES.some(c => c.code.toLowerCase() === countryCode.toLowerCase());
    if (!isValidCountry) {
        return <>{children}</>; // Let it fall through normally
    }

    // Get expected language for this country
    const expectedLang = getLanguageForCountryCode(countryCode);
    const expectedPaths = pathTranslations[expectedLang];

    // If only country code (homepage), allow
    if (pathSegments.length < 2) {
        return <>{children}</>; // Just the country code, homepage
    }

    const currentPathSegment = pathSegments[1];

    // Check if current path is valid for the expected language
    const isValidForLang = Object.values(expectedPaths).some(p => {
        const basePath = (p as string).split('/')[0].split(':')[0];
        return currentPathSegment === basePath || currentPathSegment.startsWith(basePath + '/');
    });

    if (isValidForLang) {
        return <>{children}</>;
    }

    // Check if it's a valid path in ANOTHER language (wrong language for this country)
    const pathKey = getPathKeyFromPath(currentPathSegment);
    if (pathKey) {
        // This is a valid path but in the wrong language - trigger 404 with real HTTP status
        console.log(`❌ 404: Path "${currentPathSegment}" is valid but wrong language for country ${countryCode} (expected: ${expectedLang})`);
        if (!shouldShow404) {
            setShouldShow404(true);
        }
        return (
            <div className="flex justify-center items-center h-64">
                <Spinner />
            </div>
        );
    }

    // Not a recognized path at all, let it fall through to normal routing
    return <>{children}</>;
};

// Component to handle legacy business URL redirects
const LegacyBusinessRedirect = () => {
    const { identifier } = useParams();
    const [targetUrl, setTargetUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const findAndRedirect = async () => {
            if (!identifier) {
                setTargetUrl('/404');
                setLoading(false);
                return;
            }

            try {
                // El identifier puede llegar como UUID (típico de notificaciones
                // push donde se incrusta business_id) o como nombre slug-ificado
                // (legacy URLs). Detectamos UUID primero para usar la query
                // adecuada — antes siempre se llamaba a getBusinessByName(UUID),
                // que devolvía null y mandaba a /404.
                const decoded = decodeURIComponent(identifier);
                const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decoded);
                const business = isUuid
                    ? await getBusinessById(decoded)
                    : await getBusinessByName(decoded.replace(/_/g, ' '));
                if (business && business.country) {
                    const countryCode = business.country.toLowerCase();
                    const newIdentifier = encodeURIComponent(business.name.replace(/ /g, '_'));
                    const pathLang = getLanguageForCountryCode(business.country);
                    const paths = pathTranslations[pathLang] || pathTranslations.es;
                    const newPath = `/${countryCode}/${paths.business.replace(':identifier', newIdentifier)}`;
                    setTargetUrl(newPath);
                } else {
                    setTargetUrl('/404');
                }
            } catch (error) {
                console.error("Error in legacy redirect:", error);
                setTargetUrl('/404');
            } finally {
                setLoading(false);
            }
        };

        findAndRedirect();
    }, [identifier]);

    if (loading) {
        return <div className="flex justify-center items-center h-64"><Spinner /></div>;
    }

    return <Navigate to={targetUrl || '/404'} replace />;
};



const App = () => {
    // Logic to generate unique paths for all languages
    const languages = Object.keys(pathTranslations) as Language[];
    const uniquePaths: Record<string, string[]> = {};

    for (const lang of languages) {
        for (const key in pathTranslations[lang]) {
            const pathKey = key as keyof typeof pathTranslations.es;
            if (!uniquePaths[pathKey]) uniquePaths[pathKey] = [];
            const path = pathTranslations[lang][pathKey];
            if (path && !uniquePaths[pathKey].includes(path)) {
                uniquePaths[pathKey].push(path);
            }
        }
    }
    
    return (
    <ErrorBoundary>
    <ThemeProvider>
        <NotificationProvider>
        <ConfirmProvider>
            <AuthProvider>
                <CountryProvider>
                    <I18nProvider>
                        <BrowserRouter>
                            <ScrollToTop />
                            <Routes>
                                <Route path="/" element={<MainLayout />}>
                                    <Route index element={<HomePage />} />
                                    
                                    {/* --- Routes WITHOUT country prefix (now multilingual) --- */}
                                    {uniquePaths.explore?.map(p => <Route key={`root-explore-${p}`} path={p} element={<ExplorePage />} />)}
                                    {uniquePaths.businesses?.map(p => <Route key={`root-businesses-${p}`} path={p} element={<BusinessesPage />} />)}
                                    {uniquePaths.pricing?.map(p => <Route key={`root-pricing-${p}`} path={p} element={<PricingPage />} />)}
                                    {uniquePaths.community?.map(p => <Route key={`root-community-${p}`} path={p} element={<CommunityPage />} />)}
                                    {uniquePaths.whatsNew?.map(p => <Route key={`root-whatsNew-${p}`} path={p} element={<WhatsNewPage />} />)}
                                    {uniquePaths.support?.map(p => <Route key={`root-support-${p}`} path={p} element={<SupportPage />} />)}
                                    {uniquePaths.login?.map(p => <Route key={`root-login-${p}`} path={p} element={<LoginPage />} />)}
                                    {uniquePaths.register?.map(p => <Route key={`root-register-${p}`} path={p} element={<RegisterPage />} />)}
                                    {uniquePaths.search?.map(p => <Route key={`root-search-${p}`} path={p} element={<SearchResultsPage />} />)}
                                    {uniquePaths.forgotPassword?.map(p => <Route key={`root-forgotPassword-${p}`} path={p} element={<ForgotPasswordPage />} />)}
                                    {uniquePaths.business?.map(p => <Route key={`root-business-${p}`} path={p} element={<BusinessPage />} />)}

                                    {/* New auxiliary pages */}
                                    {uniquePaths.widgets?.map(p => <Route key={`root-widgets-${p}`} path={p} element={<WidgetsShowcasePage />} />)}
                                    {uniquePaths.forBusinesses?.map(p => <Route key={`root-forBusinesses-${p}`} path={p} element={<ForBusinessesPage />} />)}
                                    {uniquePaths.howItWorks?.map(p => <Route key={`root-howItWorks-${p}`} path={p} element={<HowItWorksPage />} />)}
                                    {uniquePaths.faq?.map(p => <Route key={`root-faq-${p}`} path={p} element={<FAQPage />} />)}
                                    {uniquePaths.about?.map(p => <Route key={`root-about-${p}`} path={p} element={<AboutPage />} />)}
                                    {uniquePaths.caseStudies?.map(p => <Route key={`root-caseStudies-${p}`} path={p} element={<CaseStudiesPage />} />)}

                                    {/* Non-prefixed routes (auth, admin, legacy, etc.) that are independent of country */}
                                    {uniquePaths.resetPassword?.map(p => <Route key={`root-resetPassword-${p}`} path={p} element={<ResetPasswordPage />} />)}

                                    {/* PostLogin handles its own auth check - must NOT be inside ProtectedRoute to avoid race condition */}
                                    {uniquePaths.postLogin?.map(p => <Route key={`root-postLogin-${p}`} path={p} element={<PostLoginRedirect />} />)}

                                    <Route element={<ProtectedRoute><Outlet /></ProtectedRoute>}>
                                        {uniquePaths.profile?.map(p => <Route key={`root-profile-${p}`} path={p} element={<ProfilePage />} />)}
                                        {uniquePaths.editProfile?.map(p => <Route key={`root-editProfile-${p}`} path={p} element={<EditProfilePage />} />)}
                                        {uniquePaths.writeReview?.map(p => <Route key={`root-writeReview-${p}`} path={p} element={<WriteReviewPage />} />)}
                                        {uniquePaths.assignBusiness?.map(p => <Route key={`root-assignBusiness-${p}`} path={p} element={<AssignBusinessPage />} />)}
                                        {uniquePaths.paymentSuccess?.map(p => <Route key={`root-paymentSuccess-${p}`} path={p} element={<PaymentSuccessPage />} />)}
                                        {uniquePaths.paymentCancel?.map(p => <Route key={`root-paymentCancel-${p}`} path={p} element={<PaymentCancelPage />} />)}
                                        {/* Esta ruta es la transición de authenticated → business_owner;
                                            por eso NO va dentro de BusinessRoute (que exige rol ya promovido). */}
                                        {uniquePaths.completeBusinessRegistration?.map(p => <Route key={`root-completeBusinessRegistration-${p}`} path={p} element={<CompleteBusinessRegistrationPage />} />)}
                                    </Route>

                                    <Route element={<BusinessRoute><Outlet /></BusinessRoute>}>
                                        {uniquePaths.myBusinesses?.map(p => <Route key={`root-myBusinesses-${p}`} path={p} element={<BusinessListPage />} />)}
                                        {uniquePaths.migrateGoogleReviews?.map(p => <Route key={`root-migrateGoogleReviews-${p}`} path={p} element={<MigrateGoogleReviewsPage />} />)}
                                        {/* Dashboard tree multilingüe: registra parent + children en
                                            todos los idiomas para que cualquier combo (p.ej. /business/dashboard/X/reviews)
                                            haga match. El LanguagePathValidator se encarga de bloquear
                                            combos cruzados por país (lo que no aplica aquí porque no
                                            hay country prefix, pero no estorba). */}
                                        {uniquePaths.businessDashboard?.map(parentPath => (
                                            <Route key={`root-businessDashboard-${parentPath}`} path={parentPath} element={<BusinessDashboardPage />}>
                                                <Route index element={<DashboardOverview />} />
                                                {uniquePaths.dashboardReviews?.map(p => <Route key={`root-dashReviews-${p}`} path={p} element={<DashboardReviews />} />)}
                                                {uniquePaths.dashboardAnalytics?.map(p => <Route key={`root-dashAnalytics-${p}`} path={p} element={<DashboardAnalytics />} />)}
                                                {uniquePaths.dashboardInvitations?.map(p => <Route key={`root-dashInvitations-${p}`} path={p} element={<DashboardInvitations />} />)}
                                                {uniquePaths.dashboardWidgets?.map(p => <Route key={`root-dashWidgets-${p}`} path={p} element={<DashboardWidgets />} />)}
                                                {uniquePaths.dashboardEdit?.map(p => <Route key={`root-dashEdit-${p}`} path={p} element={<EditBusinessPage />} />)}
                                                {uniquePaths.dashboardUserManual?.map(p => <Route key={`root-dashManual-${p}`} path={p} element={<DashboardUserManual />} />)}
                                            </Route>
                                        ))}
                                    </Route>
                                    
                                    <Route path="admin" element={<AdminRoute><Outlet /></AdminRoute>}>
                                        <Route index element={<Navigate to="panel" replace />} />
                                        <Route path="panel" element={<AdminDashboardPage />} />
                                        <Route path="empresa/editar/:businessId" element={<AdminEditBusinessPage />} />
                                        <Route path="empresa/crear" element={<AdminCreateBusinessPage />} />
                                        <Route path="scraping" element={<AdminScrapingPage />} />
                                        <Route path="empresas/editar-masivo" element={<AdminBulkEditPage />} />
                                        <Route path="usuarios" element={<AdminUsersPage />} />
                                        <Route path="moderacion-resenas" element={<AdminReviewModerationPage />} />
                                        <Route path="reclamaciones" element={<AdminClaimsPage />} />
                                        <Route path="bugs" element={<AdminBugsPage />} />
                                        <Route path="apelaciones-resenas" element={<AdminReviewAppealsPage />} />
                                        <Route path="enterprise" element={<AdminEnterprisePage />} />
                                        <Route path="destacados" element={<AdminFeaturedBusinessesPage />} />
                                        <Route path="urls" element={<AdminUrlManagerPage />} />
                                    </Route>

                                    {/* Legacy redirects */}
                                    <Route path="empresa/:identifier" element={<LegacyBusinessRedirect />} />
                                    <Route path="business/:identifier" element={<LegacyBusinessRedirect />} />
                                    
                                    {/* Explicit 404 route to avoid being caught by :countryCode */}
                                    <Route path="404" element={<NotFoundPage />} />
                                    
                                    {/* --- Routes WITH country prefix --- */}
                                    <Route path=":countryCode">
                                        <Route index element={<HomePage />} />
                                        {uniquePaths.explore?.map(p => <Route key={`explore-${p}`} path={p} element={<ExplorePage />} />)}
                                        {uniquePaths.businesses?.map(p => <Route key={`businesses-${p}`} path={p} element={<BusinessesPage />} />)}
                                        {uniquePaths.business?.map(p => <Route key={`business-${p}`} path={p} element={<BusinessPage />} />)}
                                        {uniquePaths.pricing?.map(p => <Route key={`pricing-${p}`} path={p} element={<PricingPage />} />)}
                                        {uniquePaths.community?.map(p => <Route key={`community-${p}`} path={p} element={<CommunityPage />} />)}
                                        {uniquePaths.whatsNew?.map(p => <Route key={`whatsNew-${p}`} path={p} element={<WhatsNewPage />} />)}
                                        {uniquePaths.support?.map(p => <Route key={`support-${p}`} path={p} element={<SupportPage />} />)}
                                        {uniquePaths.login?.map(p => <Route key={`login-${p}`} path={p} element={<LoginPage />} />)}
                                        {uniquePaths.register?.map(p => <Route key={`register-${p}`} path={p} element={<RegisterPage />} />)}
                                        {uniquePaths.search?.map(p => <Route key={`search-${p}`} path={p} element={<SearchResultsPage />} />)}
                                        {uniquePaths.forgotPassword?.map(p => <Route key={`forgotPassword-${p}`} path={p} element={<ForgotPasswordPage />} />)}
                                        {uniquePaths.resetPassword?.map(p => <Route key={`resetPassword-${p}`} path={p} element={<ResetPasswordPage />} />)}

                                        {/* New auxiliary pages with country prefix */}
                                        {uniquePaths.widgets?.map(p => <Route key={`widgets-${p}`} path={p} element={<WidgetsShowcasePage />} />)}
                                        {uniquePaths.forBusinesses?.map(p => <Route key={`forBusinesses-${p}`} path={p} element={<ForBusinessesPage />} />)}
                                        {uniquePaths.howItWorks?.map(p => <Route key={`howItWorks-${p}`} path={p} element={<HowItWorksPage />} />)}
                                        {uniquePaths.faq?.map(p => <Route key={`faq-${p}`} path={p} element={<FAQPage />} />)}
                                        {uniquePaths.about?.map(p => <Route key={`about-${p}`} path={p} element={<AboutPage />} />)}
                                        {uniquePaths.caseStudies?.map(p => <Route key={`caseStudies-${p}`} path={p} element={<CaseStudiesPage />} />)}

                                        {/* PostLogin handles its own auth check - must NOT be inside ProtectedRoute to avoid race condition */}
                                        {uniquePaths.postLogin?.map(p => <Route key={`postLogin-${p}`} path={p} element={<PostLoginRedirect />} />)}

                                        {/* Protected routes with country prefix */}
                                        <Route element={<ProtectedRoute><Outlet /></ProtectedRoute>}>
                                            {uniquePaths.profile?.map(p => <Route key={`profile-${p}`} path={p} element={<ProfilePage />} />)}
                                            {uniquePaths.editProfile?.map(p => <Route key={`editProfile-${p}`} path={p} element={<EditProfilePage />} />)}
                                            {uniquePaths.writeReview?.map(p => <Route key={`writeReview-${p}`} path={p} element={<WriteReviewPage />} />)}
                                            {uniquePaths.assignBusiness?.map(p => <Route key={`assignBusiness-${p}`} path={p} element={<AssignBusinessPage />} />)}
                                            {uniquePaths.paymentSuccess?.map(p => <Route key={`paymentSuccess-${p}`} path={p} element={<PaymentSuccessPage />} />)}
                                            {uniquePaths.paymentCancel?.map(p => <Route key={`paymentCancel-${p}`} path={p} element={<PaymentCancelPage />} />)}
                                            {/* Esta ruta es la transición de authenticated → business_owner;
                                                por eso NO va dentro de BusinessRoute. */}
                                            {uniquePaths.completeBusinessRegistration?.map(p => <Route key={`country-completeBusinessRegistration-${p}`} path={p} element={<CompleteBusinessRegistrationPage />} />)}
                                        </Route>

                                        {/* Business routes with country prefix */}
                                        <Route element={<BusinessRoute><Outlet /></BusinessRoute>}>
                                            {uniquePaths.myBusinesses?.map(p => <Route key={`country-myBusinesses-${p}`} path={p} element={<BusinessListPage />} />)}
                                            {uniquePaths.migrateGoogleReviews?.map(p => <Route key={`country-migrateGoogleReviews-${p}`} path={p} element={<MigrateGoogleReviewsPage />} />)}
                                            {/* Dashboard tree multilingüe bajo country prefix. Antes
                                                sólo aceptaba paths en español, así que /us/business/dashboard/X
                                                caía al 404. Ahora cada parent path se registra para todos
                                                los idiomas, con todos los children traducidos. */}
                                            {uniquePaths.businessDashboard?.map(parentPath => (
                                                <Route key={`country-businessDashboard-${parentPath}`} path={parentPath} element={<BusinessDashboardPage />}>
                                                    <Route index element={<DashboardOverview />} />
                                                    {uniquePaths.dashboardReviews?.map(p => <Route key={`country-dashReviews-${p}`} path={p} element={<DashboardReviews />} />)}
                                                    {uniquePaths.dashboardAnalytics?.map(p => <Route key={`country-dashAnalytics-${p}`} path={p} element={<DashboardAnalytics />} />)}
                                                    {uniquePaths.dashboardInvitations?.map(p => <Route key={`country-dashInvitations-${p}`} path={p} element={<DashboardInvitations />} />)}
                                                    {uniquePaths.dashboardWidgets?.map(p => <Route key={`country-dashWidgets-${p}`} path={p} element={<DashboardWidgets />} />)}
                                                    {uniquePaths.dashboardEdit?.map(p => <Route key={`country-dashEdit-${p}`} path={p} element={<EditBusinessPage />} />)}
                                                    {uniquePaths.dashboardUserManual?.map(p => <Route key={`country-dashManual-${p}`} path={p} element={<DashboardUserManual />} />)}
                                                </Route>
                                            ))}
                                        </Route>
                                    </Route>

                                    {/* Catch-all must be last */}
                                    <Route path="*" element={<NotFoundPage />} />
                                </Route>
                            </Routes>
                        </BrowserRouter>
                    </I18nProvider>
                </CountryProvider>
            </AuthProvider>
        </ConfirmProvider>
        </NotificationProvider>
    </ThemeProvider>
    </ErrorBoundary>
);
};

export default App;
