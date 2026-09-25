import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import * as ReactRouterDOM from 'react-router-dom';
import Spinner from '../../Spinner';
import BusinessLogo from '../../BusinessLogo';
import Meta from '../../Meta';
import { Business } from '../../../types';
import { planNameKey } from '../../../utils/planFeatures';
import { useDashboardSections } from './dashboard/useDashboardSections';
import { BusinessDashboardProvider, useBusinessDashboard } from '../../../contexts/BusinessDashboardContext';
import { useI18n, useTranslation, pathTranslations, useAutoTranslation, getLanguageForCountryCode } from '../../../contexts/i18nContext';
import { useCountry } from '../../../contexts/CountryContext';
import { getBusinessById, getBusinessByName, getOwnedBusinessByIdentifier } from '../../../services/supabaseService';

// Los enlaces del panel se usan en DOS sitios: el lateral de escritorio y el
// cajon de movil. Salen de useDashboardSections (que tambien usa el manual), y
// el plan que desbloquea cada seccion, de utils/planFeatures.
const useDashboardNav = () => {
    const { language } = useI18n();
    const { country } = useCountry();
    const { sections, pricingHref } = useDashboardSections();

    // Use country directly - don't infer from language
    const countryPrefix = country ? `/${country.toLowerCase()}` : '';
    const pathLang = country ? getLanguageForCountryCode(country) : language;
    const paths = pathTranslations[pathLang] || pathTranslations.es;

    const navLinks = useMemo(() => sections.map(s => ({
        to: s.subpath,
        icon: `fa-solid ${s.icon}`,
        label: s.label,
        exact: s.id === 'overview',
        locked: s.access.locked,
        lockText: s.lockText,
    })), [sections]);

    return { navLinks, countryPrefix, paths, pricingHref };
};

// Contenido del menu. `onNavigate` solo lo pasa el cajon de movil: al pulsar un
// enlace hay que cerrarlo, o el usuario se queda mirando el menu encima de la
// pantalla a la que acaba de ir.
const SidebarContent: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
    const { business } = useBusinessDashboard();
    const { profile } = useAuth();
    const t = useTranslation();
    const { navLinks, countryPrefix, paths, pricingHref } = useDashboardNav();

    return (
        <>
            <div className="flex items-center gap-2 sm:gap-3 border-b dark:border-zinc-700 pb-3 sm:pb-4 mb-3 sm:mb-4">
                <BusinessLogo
                    logoUrl={business?.logo_url}
                    businessName={business?.name || ''}
                    tone={business?.logo_tone}
                    className="w-10 h-10 sm:w-12 sm:h-12"
                    iconSize="text-xl sm:text-2xl"
                    fit="cover"
                    padding=""
                    defaultChip="bg-gray-100 dark:bg-zinc-700 shadow-sm border-gray-200 dark:border-zinc-600"
                    width={48}
                    height={48}
                />
                <div className="truncate min-w-0">
                    <h2 className="font-bold text-sm sm:text-base text-gray-800 dark:text-gray-100 truncate">{business?.name}</h2>
                    {profile && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('businessDashboard.planLabel', { plan: t(planNameKey(profile.plan)) })}</p>
                    )}
                </div>
            </div>
            <nav className="space-y-1">
                {navLinks.map(link => {
                    const isLocked = link.locked;
                    return (
                        <ReactRouterDOM.NavLink
                            key={link.to}
                            // Bloqueada: lleva a Planes (en el pais y el idioma de la URL).
                            to={isLocked ? pricingHref : link.to}
                            end={link.exact}
                            onClick={onNavigate}
                            title={isLocked ? link.lockText : undefined}
                            className={({ isActive }) =>
                                `flex items-center justify-between px-2.5 sm:px-3 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green ${
                                isActive && !isLocked
                                    ? 'bg-brand-green/10 text-brand-green'
                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700'
                                } ${isLocked ? 'opacity-70' : ''}`
                            }
                        >
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                <i className={`${link.icon} w-4 sm:w-5 text-center flex-shrink-0`} aria-hidden="true"></i>
                                <span className="truncate">{link.label}</span>
                            </div>
                            {isLocked && (
                                <>
                                    <i className="fa-solid fa-lock text-xs text-amber-600 dark:text-amber-400 flex-shrink-0" aria-hidden="true"></i>
                                    <span className="sr-only">{`(${link.lockText})`}</span>
                                </>
                            )}
                        </ReactRouterDOM.NavLink>
                    );
                })}
            </nav>
            <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t dark:border-zinc-700">
                <ReactRouterDOM.Link
                    to={`${countryPrefix}/${paths.myBusinesses}`}
                    onClick={onNavigate}
                    className="flex items-center gap-2 sm:gap-3 px-2.5 sm:px-3 py-2.5 rounded-lg text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
                >
                    <i className="fa-solid fa-arrow-left w-4 sm:w-5 text-center flex-shrink-0"></i>
                    <span className="truncate">{t('businessDashboard.backToMyBusinesses')}</span>
                </ReactRouterDOM.Link>
            </div>
        </>
    );
};

// Lateral fijo, solo a partir de lg. En movil ocupaba la pantalla entera antes
// de llegar al contenido: ocho secciones para leer un dato.
const DashboardSidebar: React.FC = () => (
    <aside className="hidden lg:block w-64 flex-shrink-0 bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-lg border dark:border-zinc-700 lg:sticky lg:top-24 self-start">
        <SidebarContent />
    </aside>
);

// Movil: una barra que dice DONDE estas y abre el menu. Mismo patron de cajon
// que el menu principal de la cabecera (entra y sale por la izquierda), para
// que se comporte como lo que el usuario ya conoce.
const DashboardMobileNav: React.FC = () => {
    const { business } = useBusinessDashboard();
    const t = useTranslation();
    const { navLinks } = useDashboardNav();
    const location = ReactRouterDOM.useLocation();
    const [abierto, setAbierto] = useState(false);
    const botonRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    const cerrar = useCallback(() => setAbierto(false), []);

    // Seccion actual: el ultimo tramo de la URL. Si no casa con ninguna, es el
    // resumen (su ruta es la del propio panel, sin tramo extra).
    const seccionActual = useMemo(() => {
        const ultimo = location.pathname.replace(/\/$/, '').split('/').pop() || '';
        const encontrado = navLinks.find(l => l.to !== '.' && l.to === decodeURIComponent(ultimo));
        return encontrado || navLinks[0];
    }, [location.pathname, navLinks]);

    // Escape cierra, y el scroll del fondo se bloquea mientras esta abierto.
    useEffect(() => {
        if (!abierto) return;
        const alPulsar = (e: KeyboardEvent) => { if (e.key === 'Escape') { cerrar(); botonRef.current?.focus(); } };
        document.addEventListener('keydown', alPulsar);
        document.body.style.overflow = 'hidden';
        panelRef.current?.focus();
        return () => {
            document.removeEventListener('keydown', alPulsar);
            document.body.style.overflow = '';
        };
    }, [abierto, cerrar]);

    // Al cerrar, el foco vuelve al boton que lo abrio.
    const cerrarYDevolverFoco = useCallback(() => {
        cerrar();
        botonRef.current?.focus();
    }, [cerrar]);

    return (
        <div className="lg:hidden">
            <button
                ref={botonRef}
                type="button"
                onClick={() => setAbierto(true)}
                aria-expanded={abierto}
                aria-controls="menu-panel-empresa"
                className="w-full min-h-[52px] flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-zinc-800 rounded-xl shadow-sm border dark:border-zinc-700 text-left focus:outline-none focus:ring-2 focus:ring-brand-green transition-[background-color,transform] duration-100 active:scale-[0.99] motion-reduce:transform-none"
            >
                <i className="fa-solid fa-bars text-gray-500 dark:text-gray-400 flex-shrink-0" aria-hidden="true"></i>
                <span className="min-w-0 flex-1">
                    <span className="block text-[11px] text-gray-500 dark:text-gray-400 truncate">{business?.name}</span>
                    <span className="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-gray-100">
                        <i className={`${seccionActual.icon} text-brand-green`} aria-hidden="true"></i>
                        <span className="truncate">{seccionActual.label}</span>
                    </span>
                </span>
                <i className="fa-solid fa-chevron-down text-xs text-gray-400 flex-shrink-0" aria-hidden="true"></i>
            </button>

            <div
                className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 ${abierto ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={cerrarYDevolverFoco}
                aria-hidden={!abierto}
            ></div>
            <div
                ref={panelRef}
                tabIndex={-1}
                id="menu-panel-empresa"
                role="dialog"
                aria-modal="true"
                aria-label={t('businessDashboard.dashboardOverview')}
                className={`fixed top-0 left-0 h-full w-[88vw] max-w-[320px] bg-white dark:bg-zinc-900 shadow-2xl z-50 overflow-y-auto p-4 transition-transform duration-300 ease-in-out motion-reduce:transition-none focus:outline-none ${abierto ? 'translate-x-0' : '-translate-x-full'}`}
            >
                <div className="flex justify-end mb-1">
                    <button
                        type="button"
                        onClick={cerrarYDevolverFoco}
                        aria-label={t('common.close')}
                        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-brand-green"
                    >
                        <i className="fa-solid fa-times text-lg" aria-hidden="true"></i>
                    </button>
                </div>
                <SidebarContent onNavigate={cerrarYDevolverFoco} />
            </div>
        </div>
    );
};

const BusinessDashboardPage: React.FC = () => {
    const { businessName: identifier } = ReactRouterDOM.useParams<{ businessName: string }>();
    const navigate = ReactRouterDOM.useNavigate();
    const location = ReactRouterDOM.useLocation();
    const { user, loading: authLoading } = useAuth();
    const t = useTranslation();
    const { language } = useI18n();

    const [business, setBusiness] = useState<Business | null>(null);
    const [loadingBusiness, setLoadingBusiness] = useState(true);
    const businessRef = React.useRef<Business | null>(null);
    businessRef.current = business;

    // Titulo de la pestana del navegador segun la seccion del panel. Antes
    // decia "Resumen" en todas. La URL puede venir en cualquier idioma.
    const seccionActual = React.useMemo(() => {
        const ultimo = decodeURIComponent(location.pathname.replace(/\/+$/, '').split('/').pop() || '');
        const secciones = ['dashboardReviews', 'dashboardAnalytics', 'dashboardInvitations', 'dashboardProducts',
            'dashboardWidgets', 'dashboardEdit', 'dashboardUserManual'] as const;
        const etiqueta: Record<string, string> = {
            dashboardReviews: 'businessDashboard.dashboardReviews', dashboardAnalytics: 'businessDashboard.dashboardAnalytics',
            dashboardInvitations: 'businessDashboard.dashboardInvitations', dashboardProducts: 'businessDashboard.dashboardProducts',
            dashboardWidgets: 'businessDashboard.dashboardWidgets', dashboardEdit: 'businessDashboard.dashboardProfile',
            dashboardUserManual: 'businessDashboard.dashboardUserManual',
        };
        for (const clave of secciones) {
            if (Object.values(pathTranslations).some((rutas: any) => rutas?.[clave] === ultimo)) return t(etiqueta[clave]);
        }
        return t('businessDashboard.dashboardOverview');
    }, [location.pathname, t]);

    useEffect(() => {
        if (!identifier || !user) {
            setLoadingBusiness(false);
            return;
        }

        // Tras renombrar, EditBusinessPage cambia la URL al nombre nuevo: la
        // empresa ya esta cargada y no hace falta volver a buscarla.
        const yaCargada = businessRef.current;
        if (yaCargada && yaCargada.owner_id === user.id) {
            let nombreUrl = identifier;
            try { nombreUrl = decodeURIComponent(identifier); } catch { /* tal cual */ }
            if (nombreUrl.replace(/_/g, ' ') === yaCargada.name) return;
        }

        const fetchBusiness = async () => {
            setLoadingBusiness(true);
            try {
                console.log('=== BusinessDashboardPage Debug ===');
                console.log('Raw identifier from URL:', identifier);

                const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
                console.log('Is UUID:', isUuid);

                // Safely decode the identifier - React Router v7 may already decode it
                let decodedName = identifier;
                try {
                    decodedName = decodeURIComponent(identifier);
                    console.log('Decoded name:', decodedName);
                } catch (e) {
                    // If decodeURIComponent fails, use the identifier as-is
                    console.warn('Failed to decode URI component:', identifier, e);
                }
                // Replace underscores with spaces for URL-friendly names
                const businessName = decodedName.replace(/_/g, ' ');
                console.log('Final business name to search:', businessName);

                const businessData = isUuid
                    ? await getBusinessById(identifier)
                    : ((user && await getOwnedBusinessByIdentifier(user.id, decodedName))
                        || await getBusinessByName(businessName));

                console.log('Business data found:', businessData ? { id: businessData.id, name: businessData.name, owner_id: businessData.owner_id } : null);
                console.log('Current user ID:', user?.id);
                
                // If accessed via UUID, redirect to the name-based URL for better SEO and user experience
                // Skip redirect if the name contains special characters that cause URL issues
                const hasSpecialChars = /[|,<>{}[\]\\^~`]/.test(businessData?.name || '');
                if (businessData && isUuid && !hasSpecialChars) {
                    const pathParts = location.pathname.split('/');
                    const subRouteIndex = pathParts.indexOf(identifier) + 1;
                    const subRoute = pathParts.slice(subRouteIndex).join('/');

                    // Conserva el country prefix actual (si lo hay) y usa el
                    // idioma del país de la empresa para construir el path
                    // traducido. Antes saltaba siempre a /empresa/panel/...
                    // (es, sin country), rompiendo la navegación en otros idiomas.
                    const segs = location.pathname.split('/').filter(Boolean);
                    const firstSeg = (segs[0] || '').toLowerCase();
                    const looksLikeCountry = firstSeg.length === 2 && /^[a-z]{2}$/.test(firstSeg);
                    const countryPrefix = looksLikeCountry ? `/${firstSeg}` : '';
                    const targetLang = businessData.country
                        ? getLanguageForCountryCode(businessData.country)
                        : language;
                    const targetPaths = pathTranslations[targetLang] ?? pathTranslations.es;
                    const newPath = `${countryPrefix}/${targetPaths.businessDashboard.replace(':businessName', encodeURIComponent(businessData.name.replace(/ /g, '_')))}`;

                    navigate(`${newPath}${subRoute ? `/${subRoute}` : ''}`, { replace: true });
                    return; // Stop execution to let redirect happen
                }
                
                // Security check: ensure the logged-in user owns this business
                if (businessData && businessData.owner_id === user.id) {
                    setBusiness(businessData);
                } else {
                    setBusiness(null); // Or show an error
                }
            } catch (error) {
                console.error("Failed to fetch business for dashboard:", error);
                setBusiness(null);
            } finally {
                setLoadingBusiness(false);
            }
        };

        fetchBusiness();
    }, [identifier, user?.id]); // Only re-fetch when identifier or user ID changes


    if (authLoading || loadingBusiness) {
        return <div className="flex justify-center items-center h-64 sm:h-96"><Spinner /></div>;
    }

    if (!business) {
        return <div className="text-center text-sm sm:text-base text-red-500 bg-red-50 dark:bg-red-900/30 p-4 sm:p-6 rounded-lg">{t('businessDashboard.businessNotFoundOrNoPermission')}</div>;
    }

    return (
        <BusinessDashboardProvider
            business={business}
            onBusinessChange={(changes) => setBusiness(prev => (prev ? { ...prev, ...changes } : prev))}
        >
            <Meta
                title={`${seccionActual} de ${business.name} - Opynio`}
                description={`Gestiona el perfil de ${business.name} en Opynio. Responde a reseñas, analiza tus estadísticas y mejora tu reputación online.`}
            />
            <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 lg:gap-8 -mt-6 sm:-mt-8">
                <DashboardMobileNav />
                <DashboardSidebar />
                <main className="flex-grow min-w-0">
                    <ReactRouterDOM.Outlet />
                </main>
            </div>
        </BusinessDashboardProvider>
    );
};

export default BusinessDashboardPage;