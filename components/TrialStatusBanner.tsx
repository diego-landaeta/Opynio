import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCountry } from '../contexts/CountryContext';
import { useTranslation, useI18n, toBcp47, pathTranslations, getLanguageForCountryCode } from '../contexts/i18nContext';
import { useTrialStatus } from '../hooks/useTrialStatus';
import { isPaidPlanKey, formatPlanPrice, NEW_PRICING_ENABLED } from '../utils/planPrices';

/**
 * Aviso de la prueba gratuita. Dos casos (useTrialStatus):
 *  - 'stripe': «Prueba gratuita: te quedan X dias · despues, plan Growth €49/mes» + fecha
 *    del primer cobro (issue #2).
 *  - 'noCard': prueba de 90 dias sin tarjeta (issue #11): dias que quedan, que al acabar
 *    vuelve al plan gratuito y enlace a la pagina de planes.
 *  - Prueba sin tarjeta ya terminada: aviso de que ha vuelto al plan gratuito y enlace a planes.
 * En cualquier otro caso devuelve null, asi que se puede colocar sin condiciones en las
 * pantallas donde el cliente mira su plan.
 */
const TrialStatusBanner: React.FC<{ className?: string }> = ({ className = '' }) => {
    const t = useTranslation();
    const { language } = useI18n();
    const { country } = useCountry();
    const { profile } = useAuth();
    const trial = useTrialStatus();
    const plan = profile?.plan;
    const formatDate = (d: Date) => d.toLocaleDateString(toBcp47(language), { year: 'numeric', month: 'long', day: 'numeric' });
    const countryPrefix = country ? `/${country.toLowerCase()}` : '';
    const paths = pathTranslations[country ? getLanguageForCountryCode(country) : language] || pathTranslations.es;
    const choosePlanLink = (
        <Link to={`${countryPrefix}/${paths.pricing}`} className="font-semibold underline hover:no-underline">
            {t('pricingPage.trialNoCardChoosePlan')}
        </Link>
    );

    if (!trial) {
        // Prueba sin tarjeta ya terminada: sigue en plan gratuito con la fecha de fin en el pasado. Se le
        // invita a elegir plan (issue #11). La prueba con tarjeta no deja este rastro: al acabar o
        // cancelarse, el webhook pone un plan de pago o borra la fecha.
        const fin = profile?.trial_full_access_until ? new Date(profile.trial_full_access_until) : null;
        if (!NEW_PRICING_ENABLED || (plan ?? 'free') !== 'free' || !fin || Number.isNaN(fin.getTime()) || fin.getTime() > Date.now()) {
            return null;
        }
        return (
            <div role="status" className={`rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 sm:p-4 text-sm sm:text-base text-amber-900 dark:text-amber-100 ${className}`}>
                <p>
                    <i className="fa-solid fa-hourglass-end mr-2" aria-hidden="true"></i>
                    {t('pricingPage.trialNoCardEnded', { date: formatDate(fin) })}{' '}
                    {choosePlanLink}
                </p>
            </div>
        );
    }

    const fecha = formatDate(trial.endsAt);

    if (trial.kind === 'noCard') {
        return (
            <div role="status" className={`rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3 sm:p-4 text-sm sm:text-base text-green-900 dark:text-green-100 ${className}`}>
                <p className="font-bold">
                    <i className="fa-solid fa-gift mr-2" aria-hidden="true"></i>
                    {t(trial.daysLeft === 1 ? 'pricingPage.trialNoCardStatusOne' : 'pricingPage.trialNoCardStatus', { days: String(trial.daysLeft) })}
                </p>
                <p className="mt-1 text-xs sm:text-sm opacity-90">
                    {t('pricingPage.trialNoCardAfter', { date: fecha })}{' '}
                    {choosePlanLink}
                </p>
            </div>
        );
    }

    if (!isPaidPlanKey(plan)) return null;

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
                {t('pricingPage.trialNextCharge', { amount, date: fecha })}
            </p>
        </div>
    );
};

export default TrialStatusBanner;
