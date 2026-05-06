import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getBusinessesForOwner, getUserProfile } from '../../services/supabaseService';
import Meta from '../Meta';
import { useI18n, useTranslation, pathTranslations, getLanguageForCountryCode } from '../../contexts/i18nContext';
import { useCountry } from '../../contexts/CountryContext';
import { getPlanBenefits } from '../PlanActivatedModal';
import type { Plan } from '../../types';

// Confirmación de suscripción tras pago. Diseño tipo "documento" /
// recibo enterprise: tipografía clara, secciones etiquetadas, sin
// ornamentos (gradient text, halos, orbes…). Brand-green sólo en el
// check y el CTA primario; color del plan limitado al badge.
//
// Overlay full-screen (z-[60]) tapando Header (z-30) y Footer del
// MainLayout — no se ve navegación, la pantalla es dedicada.
//
// No dispara el PlanActivatedModal global (esta página ya celebra).

const PaymentSuccessPage: React.FC = () => {
    const { user, profile, setProfile, setBusinesses } = useAuth();
    const { language } = useI18n();
    const { country } = useCountry();
    const t = useTranslation();

    const countryPrefix = country ? `/${country.toLowerCase()}` : '';
    const pathLang = country ? getLanguageForCountryCode(country) : language;
    const paths = pathTranslations[pathLang] || pathTranslations.es;

    useEffect(() => {
        try { localStorage.removeItem('opynio_pending_plan_welcome'); } catch {}
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

    const plan: Plan = (profile?.plan as Plan | undefined) ?? 'v2';
    const data = getPlanBenefits(plan, t);
    const planLabel = plan === 'v2' ? 'v.2' : plan.charAt(0).toUpperCase() + plan.slice(1);

    return (
        <>
            <Meta
                title={t('paymentSuccessPage.metaTitle')}
                description={t('paymentSuccessPage.metaDesc')}
                noindex={true}
            />

            <div className="fixed inset-0 z-[60] overflow-y-auto bg-gray-50 dark:bg-zinc-950">

                {/* ───────── Top bar: solo wordmark, sin nav ───────── */}
                <header className="border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                    <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
                        <Link to={`${countryPrefix}/`} className="text-lg font-extrabold text-brand-green tracking-tight">
                            Opynio
                        </Link>
                        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                            {t('paymentSuccessPage.eyebrow')}
                        </span>
                    </div>
                </header>

                {/* ───────── Documento de confirmación ───────── */}
                <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 animate-fade-page">
                    <article className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">

                        {/* Cabecera del documento */}
                        <div className="px-6 sm:px-10 pt-10 pb-8 border-b border-gray-100 dark:border-zinc-800">
                            <div className="flex items-start gap-4">
                                <div className="flex-shrink-0 w-11 h-11 rounded-full bg-brand-green/10 dark:bg-brand-green/15 flex items-center justify-center">
                                    <i className="fa-solid fa-check text-brand-green text-base" aria-hidden="true"></i>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight leading-tight">
                                        {t('paymentSuccessPage.thanksTitle')}
                                    </h1>
                                    <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                                        {t('paymentSuccessPage.taglineWithPlan')
                                            .replace('{planName}', planLabel)
                                            .replace('{planTagline}', data.tagline)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Sección: PLAN ACTIVO */}
                        <section className="px-6 sm:px-10 py-7 border-b border-gray-100 dark:border-zinc-800">
                            <div className="flex items-baseline justify-between mb-4">
                                <h2 className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                                    Plan activo
                                </h2>
                                <span className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500">
                                    {new Date().toLocaleDateString(language, { day: 'numeric', month: 'long', year: 'numeric' })}
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className={`flex-shrink-0 w-9 h-9 rounded-md bg-gradient-to-br ${data.color} flex items-center justify-center shadow-sm`}>
                                    <i className={`fa-solid ${data.icon} text-white text-sm`} aria-hidden="true"></i>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-base font-bold text-gray-900 dark:text-gray-100">
                                        {data.title.replace(/[¡!]/g, '').trim()}
                                    </p>
                                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                        {data.tagline}
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Sección: INCLUYE */}
                        <section className="px-6 sm:px-10 py-7 border-b border-gray-100 dark:border-zinc-800">
                            <h2 className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400 mb-4">
                                {t('paymentSuccessPage.divider')}
                            </h2>
                            <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
                                {data.features.map((feat, i) => (
                                    <li key={i} className="flex items-start gap-2.5">
                                        <i className="fa-solid fa-check text-brand-green text-xs mt-1.5 flex-shrink-0" aria-hidden="true"></i>
                                        <span className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
                                            {feat}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </section>

                        {/* Sección: RECIBO + SOPORTE */}
                        <section className="px-6 sm:px-10 py-6 bg-gray-50/50 dark:bg-zinc-950/40">
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                                <i className="fa-solid fa-envelope-open-text mr-1.5 text-gray-400 dark:text-gray-500" aria-hidden="true"></i>
                                {t('paymentSuccessPage.receiptNote')}
                            </p>
                            <p className="mt-1.5 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                                {t('paymentSuccessPage.supportPrompt')}{' '}
                                <Link
                                    to={`${countryPrefix}/${paths.support}`}
                                    className="text-brand-green hover:underline font-semibold"
                                >
                                    {t('paymentSuccessPage.supportLink')}
                                </Link>
                            </p>
                        </section>
                    </article>

                    {/* ───────── CTAs fuera del documento — focus en acción ───────── */}
                    <div className="mt-8 flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                        <Link
                            to={`${countryPrefix}/${paths.myBusinesses}`}
                            className="flex-1 bg-brand-green text-white font-semibold px-6 py-3.5 rounded-lg text-sm sm:text-base shadow-sm hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
                        >
                            <span>{t('paymentSuccessPage.ctaPrimary')}</span>
                            <i className="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i>
                        </Link>
                        <Link
                            to={`${countryPrefix}/${paths.profile}`}
                            className="flex-1 bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-200 font-semibold px-6 py-3.5 rounded-lg text-sm sm:text-base border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
                        >
                            {t('paymentSuccessPage.ctaSecondary')}
                        </Link>
                    </div>
                </main>

                <style>{`
                    @keyframes fade-page {
                        from { opacity: 0; transform: translateY(4px); }
                        to   { opacity: 1; transform: translateY(0); }
                    }
                    .animate-fade-page {
                        animation: fade-page 0.35s ease-out forwards;
                    }
                `}</style>
            </div>
        </>
    );
};

export default PaymentSuccessPage;
