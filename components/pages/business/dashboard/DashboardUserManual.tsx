import React from 'react';
import { useBusinessDashboard } from '../../../../contexts/BusinessDashboardContext';
import { Plan } from '../../../../types';
import { Link } from 'react-router-dom';
import { useTranslation, useI18n, pathTranslations } from '../../../../contexts/i18nContext';
import Spinner from '../../../Spinner';

const PLAN_DESCRIPTIONS: Record<Plan, { nameKey: string; descriptionKey: string; color: string }> = {
    free: { nameKey: 'businessDashboard.freePlanName', descriptionKey: 'businessDashboard.freePlanDesc', color: 'text-gray-500' },
    starter: { nameKey: 'businessDashboard.starterPlanName', descriptionKey: 'businessDashboard.starterPlanDesc', color: 'text-green-500' },
    growth: { nameKey: 'businessDashboard.growthPlanName', descriptionKey: 'businessDashboard.growthPlanDesc', color: 'text-blue-500' },
    pro: { nameKey: 'businessDashboard.proPlanName', descriptionKey: 'businessDashboard.proPlanDesc', color: 'text-purple-500' },
    enterprise: { nameKey: 'businessDashboard.enterprisePlanName', descriptionKey: 'businessDashboard.enterprisePlanDesc', color: 'text-indigo-500' },
};

const FeatureCard: React.FC<{ icon: string; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
    <div className="bg-white dark:bg-zinc-800 p-4 sm:p-5 md:p-6 rounded-lg shadow-sm border dark:border-zinc-700 flex items-start gap-3 sm:gap-4">
        <div className="text-brand-green bg-green-100 dark:bg-green-900/50 p-2 sm:p-2.5 md:p-3 rounded-full mt-1 flex-shrink-0">
            <i className={`fa-solid ${icon} text-lg sm:text-xl w-5 sm:w-6 text-center`}></i>
        </div>
        <div className="min-w-0">
            <h3 className="font-bold text-base sm:text-lg text-gray-800 dark:text-gray-100">{title}</h3>
            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 space-y-2" dangerouslySetInnerHTML={{ __html: children as string }} />
        </div>
    </div>
);

const DashboardUserManual: React.FC = () => {
    const { business, profile } = useBusinessDashboard();
    const t = useTranslation();
    const { language } = useI18n();

    if (!business || !profile) {
        return <div className="flex justify-center items-center h-48 sm:h-64"><Spinner /></div>;
    }

    // Plan is stored in the user's profile, not in the business
    const currentPlan: Plan = profile.plan || 'free';
    const planInfo = PLAN_DESCRIPTIONS[currentPlan];

    return (
        <div className="space-y-5 sm:space-y-6 md:space-y-8">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-gray-800 dark:text-gray-100">{t('businessDashboard.userManualTitle')}</h1>

            <div className={`bg-white dark:bg-zinc-800 p-4 sm:p-5 md:p-6 rounded-lg sm:rounded-xl shadow-sm border-l-4 dark:border-zinc-700 ${planInfo.color.replace('text-', 'border-')}`}>
                <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100">{t('businessDashboard.yourCurrentPlan')}: <span className={`capitalize ${planInfo.color}`}>{t(planInfo.nameKey)}</span></h2>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1.5 sm:mt-2">{t(planInfo.descriptionKey)}</p>
                {currentPlan !== 'enterprise' && (
                    <Link to={`/${language}/${pathTranslations[language].pricing}`} className="text-xs sm:text-sm font-semibold text-brand-green hover:underline mt-3 sm:mt-4 inline-block">
                        {t('businessDashboard.compareAllPlans')} <i className="fa-solid fa-arrow-right ml-1"></i>
                    </Link>
                )}
            </div>

            <div className="space-y-4 sm:space-y-6">
                <FeatureCard icon="fa-chart-pie" title={t('businessDashboard.dashboardOverview')}>
                    {t('businessDashboard.userManual.overviewContent')}
                </FeatureCard>

                <FeatureCard icon="fa-comments" title={t('businessDashboard.dashboardReviews')}>
                   {t('businessDashboard.userManual.reviewsContent')}
                </FeatureCard>

                <FeatureCard icon="fa-magnifying-glass-chart" title={t('businessDashboard.dashboardAnalytics')}>
                    {t('businessDashboard.userManual.analyticsContent')}
                </FeatureCard>

                <FeatureCard icon="fa-paper-plane" title={t('businessDashboard.dashboardInvitations')}>
                    {t('businessDashboard.userManual.invitationsContent')}
                </FeatureCard>

                <FeatureCard icon="fa-puzzle-piece" title={t('businessDashboard.dashboardWidgets')}>
                    {t('businessDashboard.userManual.widgetsContent')}
                </FeatureCard>

                 <FeatureCard icon="fa-store" title={t('businessDashboard.dashboardProfile')}>
                    {t('businessDashboard.userManual.profileContent')}
                </FeatureCard>
            </div>
        </div>
    );
};

export default DashboardUserManual;