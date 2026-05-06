import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getBusinessesForOwner, getUserProfile } from '../../services/supabaseService';
import Meta from '../Meta';
import { useI18n, useTranslation, pathTranslations, getLanguageForCountryCode } from '../../contexts/i18nContext';
import { useCountry } from '../../contexts/CountryContext';
import { getPlanBenefits } from '../PlanActivatedModal';
import type { Plan } from '../../types';

// Pantalla dedicada de "gracias por tu suscripción". Se monta como overlay
// fijo full-screen (z-[60]) que tapa el Header (z-30) y el Footer del
// MainLayout — el flujo post-pago tiene su propio chrome dedicado, sin
// distracciones de navegación. Sin confeti pero con atmósfera (gradient
// orbs blureados, halo en el check, gradient text en el título) para
// transmitir celebración serena, premium.
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
        // Bloqueamos el scroll del body mientras el overlay está montado para
        // que la celebración se sienta como una toma full-screen real.
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
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
        return () => {
            document.body.style.overflow = prevOverflow;
        };
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

            {/* Overlay full-screen z-[60] tapando Header (z-30) y Footer */}
            <div className="fixed inset-0 z-[60] overflow-y-auto bg-white dark:bg-zinc-950 animate-fade-in-page">

                {/* Atmósfera — orbes gradient blureados muy sutiles, evocan
                    celebración sin recurrir a confeti */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
                    <div className={`absolute -top-[20%] -left-[15%] w-[700px] h-[700px] rounded-full bg-gradient-to-br ${data.color} opacity-[0.10] dark:opacity-[0.18] blur-[120px]`} />
                    <div className={`absolute -bottom-[20%] -right-[15%] w-[700px] h-[700px] rounded-full bg-gradient-to-br ${data.color} opacity-[0.08] dark:opacity-[0.14] blur-[120px]`} />
                </div>

                {/* Línea fina superior con gradient del plan */}
                <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${data.color}`} aria-hidden="true" />

                {/* Mini header con sólo el wordmark — recuerda dónde estás */}
                <div className="relative z-10 px-6 py-5 flex items-center justify-center">
                    <Link to={`${countryPrefix}/`} className="text-xl font-extrabold text-brand-green tracking-tight">
                        Opynio
                    </Link>
                </div>

                {/* Contenido centrado vertical */}
                <div className="relative z-10 min-h-[calc(100vh-80px)] flex items-center justify-center px-6 pb-12">
                    <div className="w-full max-w-2xl text-center">

                        {/* Hero check con halo pulsante — "ganas" sin ser juguetón */}
                        <div className="relative mx-auto w-20 h-20 mb-7">
                            <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${data.color} opacity-40 blur-2xl animate-pulse-soft`} aria-hidden="true" />
                            <div className={`relative w-full h-full rounded-full bg-gradient-to-br ${data.color} flex items-center justify-center shadow-xl`}>
                                <i className="fa-solid fa-check text-white text-3xl" aria-hidden="true"></i>
                            </div>
                        </div>

                        {/* Eyebrow */}
                        <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
                            {t('paymentSuccessPage.eyebrow')}
                        </p>

                        {/* Título con gradient text — gana presencia sin gritar */}
                        <h1 className={`mt-3 text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r ${data.color} bg-clip-text text-transparent leading-[1.05] pb-1`}>
                            {t('paymentSuccessPage.thanksTitle')}
                        </h1>

                        {/* Tagline con plan name */}
                        <p className="mt-5 text-base sm:text-lg text-gray-600 dark:text-gray-400 max-w-xl mx-auto leading-relaxed">
                            {taglineWithPlan}
                        </p>

                        {/* Plan badge prominente con icono del plan */}
                        <div className={`inline-flex items-center gap-2.5 mt-7 px-5 py-2.5 rounded-full bg-gradient-to-r ${data.color} text-white text-xs sm:text-sm font-bold uppercase tracking-wider shadow-xl`}>
                            <i className={`fa-solid ${data.icon} text-base`} aria-hidden="true"></i>
                            <span>Plan {planLabel}</span>
                        </div>

                        {/* Features en grid 2-col — mejor uso del ancho, ritmo visual */}
                        <div className="mt-12 grid sm:grid-cols-2 gap-x-6 gap-y-3 text-left max-w-xl mx-auto">
                            {data.features.map((feat, i) => (
                                <div
                                    key={i}
                                    className="flex items-start gap-3 p-3 rounded-lg bg-white/60 dark:bg-zinc-900/60 backdrop-blur-sm border border-gray-200/60 dark:border-zinc-800/60 animate-fade-up-page"
                                    style={{ animationDelay: `${120 + i * 80}ms` }}
                                >
                                    <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full bg-brand-green/15 text-brand-green flex items-center justify-center">
                                        <i className="fa-solid fa-check text-[10px]" aria-hidden="true"></i>
                                    </span>
                                    <span className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                                        {feat}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* CTAs — primario grande con shadow glow del color del plan */}
                        <div className="mt-12 flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
                            <Link
                                to={`${countryPrefix}/${paths.myBusinesses}`}
                                className={`flex-1 bg-gradient-to-r ${data.color} text-white font-bold px-7 py-4 rounded-xl text-base shadow-xl hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2`}
                            >
                                <span>{t('paymentSuccessPage.ctaPrimary')}</span>
                                <i className="fa-solid fa-arrow-right text-sm" aria-hidden="true"></i>
                            </Link>
                            <Link
                                to={`${countryPrefix}/${paths.profile}`}
                                className="flex-1 bg-white/80 dark:bg-zinc-900/80 backdrop-blur text-gray-700 dark:text-gray-200 font-semibold px-7 py-4 rounded-xl text-base border border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-zinc-600 hover:bg-white dark:hover:bg-zinc-900 transition-colors flex items-center justify-center gap-2"
                            >
                                <i className="fa-solid fa-user text-sm" aria-hidden="true"></i>
                                <span>{t('paymentSuccessPage.ctaSecondary')}</span>
                            </Link>
                        </div>

                        {/* Footer minimal — info del recibo + soporte */}
                        <div className="mt-12 pt-6 border-t border-gray-200/60 dark:border-zinc-800/60 max-w-md mx-auto text-xs text-gray-500 dark:text-gray-500 leading-relaxed">
                            <p>
                                <i className="fa-solid fa-envelope-open-text mr-1.5 text-gray-400" aria-hidden="true"></i>
                                {t('paymentSuccessPage.receiptNote')}
                            </p>
                            <p className="mt-1.5">
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
                        from { opacity: 0; }
                        to   { opacity: 1; }
                    }
                    .animate-fade-in-page {
                        animation: fade-in-page 0.4s ease-out forwards;
                    }
                    @keyframes fade-up-page {
                        from { opacity: 0; transform: translateY(8px); }
                        to   { opacity: 1; transform: translateY(0); }
                    }
                    .animate-fade-up-page {
                        opacity: 0;
                        animation: fade-up-page 0.5s ease-out forwards;
                    }
                    @keyframes pulse-soft {
                        0%, 100% { opacity: 0.40; transform: scale(1); }
                        50%      { opacity: 0.60; transform: scale(1.08); }
                    }
                    .animate-pulse-soft {
                        animation: pulse-soft 2.4s ease-in-out infinite;
                    }
                `}</style>
            </div>
        </>
    );
};

export default PaymentSuccessPage;
