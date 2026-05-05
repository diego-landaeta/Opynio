import React, { useState } from 'react';
import { useBusinessDashboard } from '../../../../contexts/BusinessDashboardContext';
import * as ReactRouterDOM from 'react-router-dom';
import { supabase } from '../../../../services/supabaseService';
import { useNotification } from '../../../../contexts/NotificationContext';
import { Plan } from '../../../../types';
import { useAuth } from '../../../../contexts/AuthContext';
import { useTranslation, useI18n, pathTranslations } from '../../../../contexts/i18nContext';

const PLAN_CREDIT_LIMITS: Record<Plan, number> = {
    free: 0,
    starter: 200,
    growth: 1000,
    pro: 5000,
    v2: 100000,        // premium test: alto pero finito
    enterprise: 100000,
};

const DashboardBilling: React.FC = () => {
    const { business } = useBusinessDashboard();
    const { profile } = useAuth();
    const { showNotification } = useNotification();
    const t = useTranslation();
    const { language } = useI18n();
    const [isPortalLoading, setIsPortalLoading] = useState(false);

    if (!business || !profile) {
        return null;
    }

    // Plan, billing cycle, expiración y créditos viven en `profiles` (no en `businesses`).
    const { plan, billing_cycle, plan_expires_at, ai_credits_used, ai_credits_last_reset } = profile;

    const renewalDate = plan_expires_at
        ? new Date(plan_expires_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
        : 'N/A';

    const creditLimit = (plan === 'enterprise' && profile.ai_credit_limit)
        ? profile.ai_credit_limit
        : PLAN_CREDIT_LIMITS[plan];
    const creditsUsed = ai_credits_used || 0;
    const creditPercentage = creditLimit > 0 ? (creditsUsed / creditLimit) * 100 : 0;

    // setMonth con día 31 desborda al mes siguiente (ene 31 → mar 3). Para
    // evitarlo, sumamos un mes con clamping al último día del mes destino.
    const computeNextResetDate = (lastResetIso: string | null | undefined): string => {
        if (!lastResetIso) return 'N/A';
        const last = new Date(lastResetIso);
        const target = new Date(last);
        target.setDate(1);
        target.setMonth(target.getMonth() + 1);
        const lastDayOfTargetMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
        target.setDate(Math.min(last.getDate(), lastDayOfTargetMonth));
        return target.toLocaleDateString('es-ES');
    };
    const creditResetDate = computeNextResetDate(ai_credits_last_reset);

    const handleManageSubscription = async () => {
        setIsPortalLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('create-portal-session');
            if (error) throw error;
            window.location.href = data.url;
        } catch (error: any) {
            showNotification(error.message || 'No se pudo abrir el portal de facturación.', 'error');
            setIsPortalLoading(false);
        }
    };

    return (
        <div className="space-y-5 sm:space-y-6 md:space-y-8">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-gray-800 dark:text-gray-100">{t('businessDashboard.billingAndPlanTitle')}</h1>

            <div className="bg-white dark:bg-zinc-800 p-5 sm:p-6 md:p-8 rounded-lg sm:rounded-xl shadow-sm border dark:border-zinc-700 max-w-2xl">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4 sm:mb-6">{t('businessDashboard.yourSubscription')}</h2>

                <div className="space-y-3 sm:space-y-4">
                    <div className="flex justify-between items-center py-2.5 sm:py-3 border-b dark:border-zinc-700 gap-3">
                        <span className="font-medium text-sm sm:text-base text-gray-600 dark:text-gray-400">{t('businessDashboard.currentPlan')}</span>
                        <span className="font-bold text-base sm:text-lg text-brand-green capitalize">{plan}</span>
                    </div>
                    <div className="flex justify-between items-center py-2.5 sm:py-3 border-b dark:border-zinc-700 gap-3">
                        <span className="font-medium text-sm sm:text-base text-gray-600 dark:text-gray-400">{t('businessDashboard.billingCycle')}</span>
                        <span className="font-semibold text-sm sm:text-base text-gray-800 dark:text-gray-200 capitalize">{billing_cycle || 'N/A'}</span>
                    </div>
                     <div className="flex justify-between items-center py-2.5 sm:py-3 border-b dark:border-zinc-700 gap-3">
                        <span className="font-medium text-sm sm:text-base text-gray-600 dark:text-gray-400">{t('businessDashboard.nextRenewal')}</span>
                        <span className="font-semibold text-sm sm:text-base text-gray-800 dark:text-gray-200">{renewalDate}</span>
                    </div>
                </div>

                {creditLimit > 0 && (
                    <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t dark:border-zinc-700">
                        <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100 mb-3 sm:mb-4">{t('businessDashboard.aiCreditUsage')}</h3>
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400" dangerouslySetInnerHTML={{ __html: t('businessDashboard.aiCreditInfo', { used: `<strong>${creditsUsed}</strong>`, limit: `<strong>${creditLimit}</strong>` }) }} />
                        <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-2 sm:h-2.5 mt-2">
                            <div
                                className="bg-brand-green h-2 sm:h-2.5 rounded-full"
                                style={{ width: `${creditPercentage}%` }}
                            ></div>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                            {t('businessDashboard.aiCreditResetDate', { date: creditResetDate })}
                        </p>
                    </div>
                )}

                <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4">
                    <button
                        type="button"
                        onClick={handleManageSubscription}
                        // Sólo planes pagos (no free, no enterprise) gestionan vía Stripe Portal.
                        // Enterprise no factura por Stripe → el portal estaría vacío.
                        className="w-full bg-brand-blue text-white font-bold py-2.5 sm:py-3 px-5 sm:px-6 rounded-lg hover:bg-opacity-90 transition-colors shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed text-sm sm:text-base"
                        disabled={isPortalLoading || plan === 'free' || plan === 'enterprise'}
                        title={plan === 'enterprise' ? 'Tu plan Enterprise no se gestiona por el portal de pagos. Contacta con tu account manager.' : undefined}
                    >
                        {isPortalLoading ? t('businessDashboard.opening') : t('businessDashboard.manageSubscription')}
                    </button>
                    <ReactRouterDOM.Link
                        to={`/${pathTranslations[language].pricing}`}
                        className="w-full text-center bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-200 font-semibold px-5 sm:px-6 py-2.5 sm:py-3 rounded-md hover:bg-gray-200 dark:hover:bg-zinc-600 transition-all text-sm sm:text-base"
                    >
                        {t('businessDashboard.viewAllPlans')}
                    </ReactRouterDOM.Link>
                </div>
            </div>
        </div>
    );
};

export default DashboardBilling;