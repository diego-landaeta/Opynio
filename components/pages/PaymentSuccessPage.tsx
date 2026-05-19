import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getBusinessesForOwner, getUserProfile, supabase } from '../../services/supabaseService';
import Meta from '../Meta';
import { useI18n, useTranslation, pathTranslations, getLanguageForCountryCode } from '../../contexts/i18nContext';
import { useCountry } from '../../contexts/CountryContext';
import { getPlanBenefits } from '../PlanActivatedModal';
import type { Plan } from '../../types';
import { trackMetaEvent } from '../../utils/metaPixel';

// Confirmación de suscripción tras pago. Diseño tipo documento /
// recibo enterprise: tipografía clara, secciones etiquetadas, sin
// ornamentos. Cabe en el viewport sin scroll en mobile y desktop.
//
// Overlay full-screen (z-[60]) tapa Header (z-30) y Footer del
// MainLayout — pantalla dedicada sin nav.

const PaymentSuccessPage: React.FC = () => {
    const { user, profile, setProfile, setBusinesses } = useAuth();
    const { language } = useI18n();
    const { country } = useCountry();
    const t = useTranslation();
    const location = useLocation();

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

    // Meta Pixel Purchase event — event_id = stripe session_id se comparte con el
    // server-side CAPI en stripe-webhook para que Meta deduplique cliente↔servidor.
    useEffect(() => {
        if (!user) return;
        const params = new URLSearchParams(location.search);
        const sessionId = params.get('session_id');
        if (!sessionId) return;

        let cancelled = false;
        const fire = async () => {
            let value = 0;
            let currency = 'EUR';
            try {
                const { data } = await supabase
                    .from('subscriptions')
                    .select('prices(unit_amount, currency)')
                    .eq('user_id', user.id)
                    .order('created', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                const price = (data as any)?.prices;
                if (price?.unit_amount) value = price.unit_amount / 100;
                if (price?.currency) currency = String(price.currency).toUpperCase();
            } catch (err) {
                console.warn('[meta] could not load subscription price for Purchase event', err);
            }
            if (cancelled) return;
            void trackMetaEvent('Purchase', {
                eventId: sessionId,
                userData: { email: user.email, external_id: user.id },
                customData: { value, currency },
            });
        };
        void fire();
        return () => { cancelled = true; };
    }, [user, location.search]);

    return (
        <>
            <Meta
                title={t('paymentSuccessPage.metaTitle')}
                description={t('paymentSuccessPage.metaDesc')}
                noindex={true}
            />

            {/* Overlay full-screen, layout flex-column para que el documento
                se centre verticalmente y nada exceda 100vh. */}
            <div className="fixed inset-0 z-[60] bg-gray-50 dark:bg-zinc-950 flex flex-col overflow-hidden">

                {/* Top bar slim */}
                <header className="flex-shrink-0 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 sm:py-3.5 flex items-center justify-between">
                        <Link to={`${countryPrefix}/`} className="text-base sm:text-lg font-extrabold text-brand-green tracking-tight">
                            Opynio
                        </Link>
                        <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                            {t('paymentSuccessPage.eyebrow')}
                        </span>
                    </div>
                </header>

                {/* Cuerpo: ocupa el alto restante, contenido centrado y
                    con scroll INTERNO sólo si la pantalla es muy pequeña
                    (móvil tumbado, etc.) — por defecto cabe todo. */}
                <main className="flex-1 min-h-0 overflow-y-auto flex items-center justify-center px-4 sm:px-6 py-4 sm:py-6">
                    <div className="w-full max-w-2xl animate-fade-page">

                        <article className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">

                            {/* Cabecera: check + título + tagline */}
                            <div className="px-4 sm:px-7 pt-5 sm:pt-7 pb-4 sm:pb-5 border-b border-gray-100 dark:border-zinc-800">
                                <div className="flex items-start gap-3 sm:gap-3.5">
                                    <div className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-brand-green/10 dark:bg-brand-green/15 flex items-center justify-center">
                                        <i className="fa-solid fa-check text-brand-green text-sm sm:text-base" aria-hidden="true"></i>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight leading-tight">
                                            {t('paymentSuccessPage.thanksTitle')}
                                        </h1>
                                        <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-snug">
                                            {t('paymentSuccessPage.taglineWithPlan')
                                                .replace('{planName}', planLabel)
                                                .replace('{planTagline}', data.tagline)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* PLAN ACTIVO */}
                            <section className="px-4 sm:px-7 py-4 sm:py-5 border-b border-gray-100 dark:border-zinc-800">
                                <div className="flex items-baseline justify-between mb-2.5">
                                    <h2 className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                                        {t('paymentSuccessPage.activePlanLabel')}
                                    </h2>
                                    <span className="text-[9px] sm:text-[10px] text-gray-400 dark:text-gray-500">
                                        {new Date().toLocaleDateString(language, { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2.5 sm:gap-3">
                                    <div className={`flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-md bg-gradient-to-br ${data.color} flex items-center justify-center shadow-sm`}>
                                        <i className={`fa-solid ${data.icon} text-white text-xs sm:text-sm`} aria-hidden="true"></i>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100 truncate">
                                            {data.title.replace(/[¡!]/g, '').trim()}
                                        </p>
                                        <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">
                                            {data.tagline}
                                        </p>
                                    </div>
                                </div>
                            </section>

                            {/* INCLUYE */}
                            <section className="px-4 sm:px-7 py-4 sm:py-5 border-b border-gray-100 dark:border-zinc-800">
                                <h2 className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400 mb-2.5 sm:mb-3">
                                    {t('paymentSuccessPage.divider')}
                                </h2>
                                <ul className="grid grid-cols-2 gap-x-3 sm:gap-x-5 gap-y-1.5 sm:gap-y-2">
                                    {data.features.map((feat, i) => (
                                        <li key={i} className="flex items-start gap-1.5 sm:gap-2">
                                            <i className="fa-solid fa-check text-brand-green text-[9px] sm:text-[10px] mt-1 flex-shrink-0" aria-hidden="true"></i>
                                            <span className="text-[12px] sm:text-sm text-gray-700 dark:text-gray-200 leading-snug">
                                                {feat}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </section>

                            {/* RECIBO + SOPORTE */}
                            <section className="px-4 sm:px-7 py-3 sm:py-4 bg-gray-50/60 dark:bg-zinc-950/40">
                                <p className="text-[11px] sm:text-xs text-gray-600 dark:text-gray-400 leading-snug">
                                    <i className="fa-solid fa-envelope-open-text mr-1.5 text-gray-400 dark:text-gray-500" aria-hidden="true"></i>
                                    {t('paymentSuccessPage.receiptNote')}
                                </p>
                                <p className="mt-1 text-[11px] sm:text-xs text-gray-600 dark:text-gray-400">
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

                        {/* CTAs */}
                        <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row gap-2 sm:gap-3 max-w-md mx-auto">
                            <Link
                                to={`${countryPrefix}/${paths.myBusinesses}`}
                                className="flex-1 bg-brand-green text-white font-semibold px-5 py-2.5 sm:py-3 rounded-lg text-sm shadow-sm hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
                            >
                                <span>{t('paymentSuccessPage.ctaPrimary')}</span>
                                <i className="fa-solid fa-arrow-right text-[11px]" aria-hidden="true"></i>
                            </Link>
                            <Link
                                to={`${countryPrefix}/${paths.profile}`}
                                className="flex-1 bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-200 font-semibold px-5 py-2.5 sm:py-3 rounded-lg text-sm border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
                            >
                                {t('paymentSuccessPage.ctaSecondary')}
                            </Link>
                        </div>
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
