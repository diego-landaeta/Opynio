import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getBusinessesForOwner, getUserProfile } from '../../services/supabaseService';
import Meta from '../Meta';
import { useI18n, useTranslation, pathTranslations, getLanguageForCountryCode } from '../../contexts/i18nContext';
import { useCountry } from '../../contexts/CountryContext';
import { getPlanBenefits } from '../PlanActivatedModal';
import type { Plan } from '../../types';

// Pantalla dedicada de "gracias por tu suscripción". Composición tipográfica
// sobria — sin confeti ni elementos juguetones — pensada para transmitir
// seriedad, agradecimiento y confianza tras el pago.
//
// Esta página NO dispara el PlanActivatedModal global: la propia página ES
// la celebración. El modal sigue usándose en el flujo de registro free
// (CompleteBusinessRegistrationPage) donde no hay /pago-exitoso.

const PaymentSuccessPage: React.FC = () => {
    const { user, profile, setProfile, setBusinesses } = useAuth();
    const { language } = useI18n();
    const { country } = useCountry();
    const t = useTranslation();

    const countryPrefix = country ? `/${country.toLowerCase()}` : '';
    const pathLang = country ? getLanguageForCountryCode(country) : language;
    const paths = pathTranslations[pathLang] || pathTranslations.es;

    // Tras el pago refresca profile y businesses para que cualquier
    // navegación posterior use los datos actualizados (plan ya promocionado
    // por el webhook de Stripe). Limpia también el flag del PlanActivatedModal
    // para evitar que el popup se asome encima — la propia página ya celebra.
    useEffect(() => {
        try { localStorage.removeItem('opynio_pending_plan_welcome'); } catch {}
        const refreshUserData = async () => {
            if (!user) return;
            try {
                const [updatedProfile, newBusinesses] = await Promise.all([
                    getUserProfile(user),
                    getBusinessesForOwner(user.id),
                ]);
                if (updatedProfile) setProfile(updatedProfile);
                if (newBusinesses) setBusinesses(newBusinesses);
            } catch (error) {
                console.error('Failed to refresh user data after payment:', error);
            }
        };
        refreshUserData();
    }, [user, setProfile, setBusinesses]);

    // Plan info — usa profile.plan si está cargado, fallback v2 (asumimos
    // que el flujo de pago aterriza aquí solo para planes pagos).
    const plan: Plan = (profile?.plan as Plan | undefined) ?? 'v2';
    const data = getPlanBenefits(plan, t);
    const planLabel = plan === 'v2' ? 'v.2' : plan.charAt(0).toUpperCase() + plan.slice(1);

    // Tagline con el plan name interpolado en la cadena traducida.
    const taglineTpl = t('paymentSuccessPage.taglineWithPlan');
    const taglineWithPlan = taglineTpl
        .replace('{planName}', planLabel)
        .replace('{planTagline}', data.tagline);

    return (
        <>
            <Meta
                title={t('paymentSuccessPage.metaTitle')}
                description={t('paymentSuccessPage.metaDesc')}
                noindex={true}
            />

            {/* Card contenida con border y shadow suave — composición tipo
                "documento" en lugar de full-bleed vacío. Centro en la página
                pero sin forzar viewport completo. */}
            <div className="max-w-xl mx-auto py-8 sm:py-12">
                <div className="relative bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden animate-fade-in-page">

                    {/* Línea fina superior con el gradient del plan */}
                    <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${data.color}`} aria-hidden="true" />

                    <div className="px-6 sm:px-10 pt-10 sm:pt-12 pb-8 sm:pb-10 text-center">

                        {/* Icono circular pequeño con check verde — primer signal de éxito */}
                        <div className="mx-auto w-12 h-12 rounded-full bg-brand-green/10 dark:bg-brand-green/15 flex items-center justify-center mb-6">
                            <i className="fa-solid fa-check text-brand-green text-lg" aria-hidden="true"></i>
                        </div>

                        {/* Eyebrow */}
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
                            {t('paymentSuccessPage.eyebrow')}
                        </p>

                        {/* Título principal — una sola línea */}
                        <h1 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                            {t('paymentSuccessPage.thanksTitle')}
                        </h1>

                        {/* Tagline + plan */}
                        <p className="mt-3 text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                            {taglineWithPlan}
                        </p>

                        {/* Plan icon discreto — pequeño badge identificador del plan,
                            no es la estrella del show, sólo refuerza qué se compró */}
                        <div className={`inline-flex items-center gap-2 mt-6 px-3 py-1.5 rounded-full bg-gradient-to-r ${data.color} text-white text-[11px] sm:text-xs font-semibold uppercase tracking-wider shadow-sm`}>
                            <i className={`fa-solid ${data.icon}`}></i>
                            <span>{planLabel}</span>
                        </div>

                        {/* Separador antes de features */}
                        <div className="mt-8 flex items-center gap-3">
                            <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-800" />
                            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                                {t('paymentSuccessPage.divider')}
                            </span>
                            <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-800" />
                        </div>

                        {/* Features — lista compacta */}
                        <ul className="mt-6 space-y-2.5 text-left">
                            {data.features.map((feat, i) => (
                                <li key={i} className="flex items-start gap-3">
                                    <span className="flex-shrink-0 mt-0.5">
                                        <i className="fa-solid fa-check-circle text-brand-green text-sm" aria-hidden="true"></i>
                                    </span>
                                    <span className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
                                        {feat}
                                    </span>
                                </li>
                            ))}
                        </ul>

                        {/* CTAs */}
                        <div className="mt-8 flex flex-col sm:flex-row gap-2.5">
                            <Link
                                to={`${countryPrefix}/${paths.myBusinesses}`}
                                className={`flex-1 bg-gradient-to-r ${data.color} text-white font-semibold px-5 py-3 rounded-lg text-sm shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2`}
                            >
                                <span>{t('paymentSuccessPage.ctaPrimary')}</span>
                                <i className="fa-solid fa-arrow-right text-[11px]"></i>
                            </Link>
                            <Link
                                to={`${countryPrefix}/${paths.profile}`}
                                className="flex-1 bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 font-semibold px-5 py-3 rounded-lg text-sm border border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-zinc-600 hover:bg-gray-50 dark:hover:bg-zinc-800/70 transition-colors flex items-center justify-center gap-2"
                            >
                                <i className="fa-solid fa-user text-[11px]"></i>
                                <span>{t('paymentSuccessPage.ctaSecondary')}</span>
                            </Link>
                        </div>
                    </div>

                    {/* Footer con info de recibo + soporte — separado del cuerpo principal */}
                    <div className="px-6 sm:px-10 py-5 bg-gray-50/60 dark:bg-zinc-950/40 border-t border-gray-100 dark:border-zinc-800/60 text-center">
                        <p className="text-xs text-gray-500 dark:text-gray-500 leading-relaxed">
                            <i className="fa-solid fa-envelope-open-text mr-1.5 text-gray-400"></i>
                            {t('paymentSuccessPage.receiptNote')}
                        </p>
                        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-500">
                            {t('paymentSuccessPage.supportPrompt')}{' '}
                            <Link
                                to={`${countryPrefix}/${paths.support}`}
                                className="text-brand-green hover:underline font-medium"
                            >
                                {t('paymentSuccessPage.supportLink')}
                            </Link>
                        </p>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes fade-in-page {
                    from { opacity: 0; transform: translateY(6px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-page {
                    animation: fade-in-page 0.4s ease-out forwards;
                }
            `}</style>
        </>
    );
};

export default PaymentSuccessPage;
