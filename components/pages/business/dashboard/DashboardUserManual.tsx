import React from 'react';
import { useBusinessDashboard } from '../../../../contexts/BusinessDashboardContext';
import { Plan } from '../../../../types';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../../../contexts/i18nContext';
import Spinner from '../../../Spinner';
import { planNameKey, PROFILE_PAID_MIN_PLAN, type DashboardSectionId } from '../../../../utils/planFeatures';
import { useDashboardSections, type DashboardSectionLink } from './useDashboardSections';

const PLAN_DESCRIPTIONS: Record<Plan, { descriptionKey: string; color: string }> = {
    free: { descriptionKey: 'businessDashboard.freePlanDesc', color: 'text-gray-500' },
    starter: { descriptionKey: 'businessDashboard.starterPlanDesc', color: 'text-green-500' },
    growth: { descriptionKey: 'businessDashboard.growthPlanDesc', color: 'text-blue-500' },
    pro: { descriptionKey: 'businessDashboard.proPlanDesc', color: 'text-purple-500' },
    v2: { descriptionKey: 'businessDashboard.proPlanDesc', color: 'text-pink-500' },
    enterprise: { descriptionKey: 'businessDashboard.enterprisePlanDesc', color: 'text-indigo-500' },
};

// Texto de cada tarjeta. El plan que la desbloquea NO va en el texto: lo pinta
// la etiqueta de la tarjeta a partir de utils/planFeatures.
const MANUAL_CONTENT: Partial<Record<DashboardSectionId, string>> = {
    overview: 'businessDashboard.userManual.overviewContent',
    reviews: 'businessDashboard.userManual.reviewsContent',
    analytics: 'businessDashboard.userManual.analyticsContent',
    invitations: 'businessDashboard.userManual.invitationsContent',
    products: 'businessDashboard.userManual.productsContent',
    widgets: 'businessDashboard.userManual.widgetsContent',
    profile: 'businessDashboard.userManual.profileContent',
};

// Cada tarjeta es un enlace a su seccion (mismas subrutas que el lateral) o,
// si el plan no llega, a Planes.
const ManualCard: React.FC<{ section: DashboardSectionLink; pricingHref: string; html: string }> = ({ section, pricingHref, html }) => {
    const t = useTranslation();
    const { locked } = section.access;
    const base = `manual-${section.id}`;

    // El manual es una subruta del panel: '..' sube a la raiz del panel.
    const destino = locked ? pricingHref : section.subpath === '.' ? '..' : `../${section.subpath}`;

    const etiqueta = locked
        ? section.lockText
        : section.minPlan === 'free'
            ? t('businessDashboard.includedInAllPlans')
            : t('businessDashboard.sectionAvailableFrom', { plan: t(planNameKey(section.minPlan)) });

    const etiquetaClase = locked
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
        : section.minPlan === 'free'
            ? 'bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-gray-200'
            : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';

    return (
        <Link
            to={destino}
            aria-labelledby={`${base}-title ${base}-cta`}
            aria-describedby={`${base}-badge ${base}-desc`}
            className="group block bg-white dark:bg-zinc-800 p-4 sm:p-5 md:p-6 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 transition-[border-color,box-shadow] hover:border-brand-green/60 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
        >
            <div className="flex items-start gap-3 sm:gap-4">
                <div className={`p-2 sm:p-2.5 md:p-3 rounded-full mt-1 flex-shrink-0 ${locked ? 'text-gray-500 bg-gray-100 dark:text-gray-300 dark:bg-zinc-700' : 'text-brand-green bg-green-100 dark:bg-green-900/50'}`}>
                    <i className={`fa-solid ${section.icon} text-lg sm:text-xl w-5 sm:w-6 text-center`} aria-hidden="true"></i>
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <h3 id={`${base}-title`} className="font-bold text-base sm:text-lg text-gray-800 dark:text-gray-100">{section.label}</h3>
                        <span id={`${base}-badge`} className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold ${etiquetaClase}`}>
                            {locked && <i className="fa-solid fa-lock text-[10px]" aria-hidden="true"></i>}
                            {etiqueta}
                        </span>
                    </div>
                    <div
                        id={`${base}-desc`}
                        className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1.5 space-y-2"
                        dangerouslySetInnerHTML={{ __html: html }}
                    />
                    <span id={`${base}-cta`} className="mt-3 inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-brand-green group-hover:underline">
                        {locked ? t('businessDashboard.seePlansLink') : t('businessDashboard.manualGoToSection')}
                        <i className="fa-solid fa-arrow-right text-[11px] transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true"></i>
                    </span>
                </div>
            </div>
        </Link>
    );
};

const DashboardUserManual: React.FC = () => {
    const { business, profile } = useBusinessDashboard();
    const t = useTranslation();
    const { sections, pricingHref } = useDashboardSections();

    if (!business || !profile) {
        return <div className="flex justify-center items-center h-48 sm:h-64"><Spinner /></div>;
    }

    // Plan is stored in the user's profile, not in the business
    const currentPlan: Plan = profile.plan || 'free';
    const planInfo = PLAN_DESCRIPTIONS[currentPlan];
    const paidPlanName = t(planNameKey(PROFILE_PAID_MIN_PLAN));

    return (
        <div className="space-y-5 sm:space-y-6 md:space-y-8">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-gray-800 dark:text-gray-100">{t('businessDashboard.userManualTitle')}</h1>

            <div className={`bg-white dark:bg-zinc-800 p-4 sm:p-5 md:p-6 rounded-lg sm:rounded-xl shadow-sm border-l-4 dark:border-zinc-700 ${planInfo.color.replace('text-', 'border-')}`}>
                <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100">{t('businessDashboard.yourCurrentPlan')}: <span className={`capitalize ${planInfo.color}`}>{t(planNameKey(currentPlan))}</span></h2>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1.5 sm:mt-2">{t(planInfo.descriptionKey)}</p>
                {currentPlan !== 'enterprise' && (
                    <Link to={pricingHref} className="text-xs sm:text-sm font-semibold text-brand-green hover:underline mt-3 sm:mt-4 inline-block rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green">
                        {t('businessDashboard.compareAllPlans')} <i className="fa-solid fa-arrow-right ml-1" aria-hidden="true"></i>
                    </Link>
                )}
            </div>

            <div className="space-y-4 sm:space-y-6">
                {sections.filter(s => MANUAL_CONTENT[s.id]).map(section => (
                    <ManualCard
                        key={section.id}
                        section={section}
                        pricingHref={pricingHref}
                        html={t(MANUAL_CONTENT[section.id]!, { plan: paidPlanName })}
                    />
                ))}
            </div>
        </div>
    );
};

export default DashboardUserManual;
