import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import * as ReactRouterDOM from 'react-router-dom';
import Spinner from '../../Spinner';
import Meta from '../../Meta';
import { Plan, Business } from '../../../types';
import { BusinessDashboardProvider, useBusinessDashboard } from '../../../contexts/BusinessDashboardContext';
import { useI18n, useTranslation, pathTranslations, useAutoTranslation, getLanguageForCountryCode } from '../../../contexts/i18nContext';
import { useCountry } from '../../../contexts/CountryContext';
import { getBusinessById, getBusinessByName } from '../../../services/supabaseService';

// FIX: Add 'enterprise' plan to PLAN_HIERARCHY to match the Plan type definition.
const PLAN_HIERARCHY: Record<Plan, number> = {
    free: 0,
    starter: 1,
    growth: 2,
    pro: 3,
    enterprise: 4,
};

const DashboardSidebar: React.FC = () => {
    const { business } = useBusinessDashboard(); // Use the new context to get the specific business
    const { profile } = useAuth();
    const t = useTranslation();
    const { language } = useI18n();
    const { country } = useCountry();
    const { text: translatedName } = useAutoTranslation(business?.name || '');
    const [imageError, setImageError] = useState(false);

    // Use country directly - don't infer from language
    const countryPrefix = country ? `/${country.toLowerCase()}` : '';
    const pathLang = country ? getLanguageForCountryCode(country) : language;
    const paths = pathTranslations[pathLang] || pathTranslations.es;

    // Always use Spanish paths for dashboard subroutes since routes are defined in Spanish
    const dashboardPaths = pathTranslations.es;

    const navLinks = useMemo(() => {
        return [
            { to: '.', icon: 'fa-solid fa-chart-pie', label: t('businessDashboard.dashboardOverview'), exact: true, requiredPlan: 'free' as Plan, featureId: 'resumen' },
            { to: dashboardPaths.dashboardReviews, icon: 'fa-solid fa-comments', label: t('businessDashboard.dashboardReviews'), requiredPlan: 'free' as Plan, featureId: 'reseñas' },
            { to: dashboardPaths.dashboardAnalytics, icon: 'fa-solid fa-magnifying-glass-chart', label: t('businessDashboard.dashboardAnalytics'), requiredPlan: 'growth' as Plan, featureId: 'analiticas' },
            { to: dashboardPaths.dashboardInvitations, icon: 'fa-solid fa-paper-plane', label: t('businessDashboard.dashboardInvitations'), requiredPlan: 'starter' as Plan, featureId: 'invitaciones' },
            { to: dashboardPaths.dashboardWidgets, icon: 'fa-solid fa-puzzle-piece', label: t('businessDashboard.dashboardWidgets'), requiredPlan: 'starter' as Plan, featureId: 'widgets' },
            { to: dashboardPaths.dashboardEdit, icon: 'fa-solid fa-store', label: t('businessDashboard.dashboardProfile'), requiredPlan: 'starter' as Plan, featureId: 'perfil_de_empresa' },
            { to: dashboardPaths.dashboardUserManual, icon: 'fa-solid fa-book-open', label: t('businessDashboard.dashboardUserManual'), requiredPlan: 'free' as Plan, featureId: 'manual_de_usuario' },
        ];
    }, [t, dashboardPaths]);

    return (
        <aside className="w-full lg:w-64 flex-shrink-0 bg-white dark:bg-zinc-800 p-3 sm:p-4 rounded-lg sm:rounded-xl shadow-lg border dark:border-zinc-700 lg:sticky lg:top-24 self-start">
            <div className="flex items-center gap-2 sm:gap-3 border-b dark:border-zinc-700 pb-3 sm:pb-4 mb-3 sm:mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gray-100 dark:bg-zinc-700 flex-shrink-0 overflow-hidden shadow-sm border dark:border-zinc-600">
                     {business?.logo_url && !imageError ? (
                        <img src={business.logo_url} alt={`${business.name} logo`} width={48} height={48} loading="lazy" decoding="async" className="w-full h-full object-cover" onError={() => setImageError(true)} />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400"><i className="fa-solid fa-store text-xl sm:text-2xl"></i></div>
                    )}
                </div>
                <div className="truncate min-w-0">
                    <h2 className="font-bold text-sm sm:text-base text-gray-800 dark:text-gray-100 truncate">{translatedName}</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{profile?.plan} Plan</p>
                </div>
            </div>
            <nav className="space-y-1">
                {navLinks.map(link => {
                    const requiredPlanLevel = PLAN_HIERARCHY[link.requiredPlan];
                    const currentPlanLevel = profile ? PLAN_HIERARCHY[profile.plan] : 0;

                    let isLocked = currentPlanLevel < requiredPlanLevel;

                    // For enterprise users, also check their specific permissions
                    if (profile?.plan === 'enterprise' && profile.feature_permissions) {
                        const permissions = profile.feature_permissions as Record<string, boolean>;
                        if (permissions[link.featureId] === false) {
                            isLocked = true;
                        }
                    }

                    const titleText = isLocked
                        ? (profile?.plan === 'enterprise' ? 'Función desactivada por el administrador' : `Requiere plan ${link.requiredPlan}`)
                        : '';

                    return (
                        <ReactRouterDOM.NavLink
                            key={link.to}
                            to={isLocked ? `${countryPrefix}/${paths.pricing}` : link.to}
                            end={link.exact}
                            className={({ isActive }) =>
                                `flex items-center justify-between px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                                isActive && !isLocked
                                    ? 'bg-brand-green/10 text-brand-green'
                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700'
                                } ${isLocked ? 'opacity-70' : ''}`
                            }
                        >
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                <i className={`${link.icon} w-4 sm:w-5 text-center flex-shrink-0`}></i>
                                <span className="truncate">{link.label}</span>
                            </div>
                            {isLocked && <i className="fa-solid fa-lock text-xs text-yellow-500 flex-shrink-0" title={titleText}></i>}
                        </ReactRouterDOM.NavLink>
                    );
                })}
            </nav>
            <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t dark:border-zinc-700">
                <ReactRouterDOM.Link
                    to={`${countryPrefix}/${paths.myBusinesses}`}
                    className="flex items-center gap-2 sm:gap-3 px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
                >
                    <i className="fa-solid fa-arrow-left w-4 sm:w-5 text-center flex-shrink-0"></i>
                    <span className="truncate">{t('businessDashboard.backToMyBusinesses')}</span>
                </ReactRouterDOM.Link>
            </div>
        </aside>
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

    useEffect(() => {
        if (!identifier || !user) {
            setLoadingBusiness(false);
            return;
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
                    : await getBusinessByName(businessName);

                console.log('Business data found:', businessData ? { id: businessData.id, name: businessData.name, owner_id: businessData.owner_id } : null);
                console.log('Current user ID:', user?.id);
                
                // If accessed via UUID, redirect to the name-based URL for better SEO and user experience
                // Skip redirect if the name contains special characters that cause URL issues
                const hasSpecialChars = /[|,<>{}[\]\\^~`]/.test(businessData?.name || '');
                if (businessData && isUuid && !hasSpecialChars) {
                    const pathParts = location.pathname.split('/');
                    const subRouteIndex = pathParts.indexOf(identifier) + 1;
                    const subRoute = pathParts.slice(subRouteIndex).join('/');

                    const newPath = `/${pathTranslations.es.businessDashboard.replace(':businessName', encodeURIComponent(businessData.name.replace(/ /g, '_')))}`;

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
        <BusinessDashboardProvider business={business}>
            <Meta
                title={`${t('businessDashboard.dashboardOverview')} de ${business.name} - Opynio`}
                description={`Gestiona el perfil de ${business.name} en Opynio. Responde a reseñas, analiza tus estadísticas y mejora tu reputación online.`}
            />
            <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 lg:gap-8 -mt-6 sm:-mt-8">
                <DashboardSidebar />
                <main className="flex-grow min-w-0">
                    <ReactRouterDOM.Outlet />
                </main>
            </div>
        </BusinessDashboardProvider>
    );
};

export default BusinessDashboardPage;