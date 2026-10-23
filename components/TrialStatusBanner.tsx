import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation, useI18n, toBcp47 } from '../contexts/i18nContext';
import { useTrialStatus } from '../hooks/useTrialStatus';
import { isPaidPlanKey, formatPlanPrice } from '../utils/planPrices';

/**
 * «Prueba gratuita: te quedan X dias · despues, plan Growth €49/mes» + fecha del
 * primer cobro (issue #2). Solo se pinta con NEW_PRICING_ENABLED y una suscripcion
 * en 'trialing' (useTrialStatus); en cualquier otro caso devuelve null, asi que se
 * puede colocar sin condiciones en las pantallas donde el cliente mira su plan.
 */
const TrialStatusBanner: React.FC<{ className?: string }> = ({ className = '' }) => {
    const t = useTranslation();
    const { language } = useI18n();
    const { profile } = useAuth();
    const trial = useTrialStatus();
    const plan = profile?.plan;
    if (!trial || !isPaidPlanKey(plan)) return null;

    const cycle = profile?.billing_cycle === 'annual' ? 'annual' : 'monthly';
    const amount = formatPlanPrice(plan, cycle);
    return (
        <div role="status" className={`rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3 sm:p-4 text-sm sm:text-base text-green-900 dark:text-green-100 ${className}`}>
            <p className="font-bold">
                <i className="fa-solid fa-gift mr-2" aria-hidden="true"></i>
                {t(trial.daysLeft === 1 ? 'pricingPage.trialStatusOne' : 'pricingPage.trialStatus', {
                    days: String(trial.daysLeft),
                    plan: plan.charAt(0).toUpperCase() + plan.slice(1),
                    price: amount + t(cycle === 'annual' ? 'pricingPage.perYear' : 'pricingPage.perMonth'),
                })}
            </p>
            <p className="mt-1 text-xs sm:text-sm opacity-90">
                {t('pricingPage.trialNextCharge', {
                    amount,
                    date: trial.endsAt.toLocaleDateString(toBcp47(language), { year: 'numeric', month: 'long', day: 'numeric' }),
                })}
            </p>
        </div>
    );
};

export default TrialStatusBanner;
