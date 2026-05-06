import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getBusinessesForOwner, getUserProfile } from '../../services/supabaseService';
import Meta from '../Meta';
import { useI18n, pathTranslations, getLanguageForCountryCode } from '../../contexts/i18nContext';
import { useCountry } from '../../contexts/CountryContext';
import { PLAN_BENEFITS } from '../PlanActivatedModal';
import type { Plan } from '../../types';

// Pantalla dedicada de "gracias por tu suscripción". Diseño full-bleed
// (rompe el container del MainLayout via negative margins) con composición
// tipográfica sobria — sin confeti ni elementos juguetones — pensada para
// transmitir seriedad, agradecimiento y confianza tras el pago.
//
// Esta página NO dispara el PlanActivatedModal global: la propia página ES
// la celebración. El modal sigue usándose en el flujo de registro free
// (CompleteBusinessRegistrationPage) donde no hay /pago-exitoso.

const PaymentSuccessPage: React.FC = () => {
    const { user, profile, setProfile, setBusinesses } = useAuth();
    const { language } = useI18n();
    const { country } = useCountry();

    const countryPrefix = country ? `/${country.toLowerCase()}` : '';
    const pathLang = country ? getLanguageForCountryCode(country) : language;
    const paths = pathTranslations[pathLang] || pathTranslations.es;

    // Tras el pago, refresca profile y businesses para que cualquier
    // navegación posterior use los datos actualizados (plan ya promocionado
    // por el webhook de Stripe). Además limpia el flag del PlanActivatedModal
    // para evitar que el popup se asome encima de la nueva pantalla — la
    // propia página es la celebración.
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
    const data = PLAN_BENEFITS[plan] ?? PLAN_BENEFITS.v2;
    const planLabel = plan === 'v2' ? 'v.2' : plan.charAt(0).toUpperCase() + plan.slice(1);

    return (
        <>
            <Meta
                title="¡Suscripción activada! - Opynio"
                description="Gracias por tu suscripción a Opynio."
                noindex={true}
            />

            {/* Wrapper full-bleed: negative margins rompen el padding del MainLayout
                para que el hero respire de borde a borde. */}
            <div className="relative -mx-3 sm:-mx-4 md:-mx-6 -mt-8 sm:-mt-10 md:-mt-12 -mb-20 sm:-mb-16 md:-mb-12 min-h-[calc(100vh-72px)] flex items-center justify-center overflow-hidden bg-white dark:bg-zinc-950">

                {/* Línea superior fina con el gradient del plan — único acento de
                    color, anuncia identidad sin ser invasivo. */}
                <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${data.color}`} aria-hidden="true" />

                {/* Background pattern muy sutil para evitar el plano absoluto */}
                <div
                    className="absolute inset-0 opacity-[0.025] dark:opacity-[0.04] pointer-events-none"
                    style={{
                        backgroundImage:
                            'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
                        backgroundSize: '32px 32px',
                    }}
                    aria-hidden="true"
                />

                {/* Contenido — composición vertical centrada con breathing room amplio */}
                <div className="relative z-10 w-full max-w-2xl mx-auto px-6 py-16 sm:py-20">
                    <div className="text-center animate-fade-in-page">
                        {/* Eyebrow discreto */}
                        <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
                            Suscripción confirmada
                        </p>

                        {/* Icono de plan — elemento gráfico principal, contenido y proporcionado */}
                        <div className="mt-8 flex items-center justify-center">
                            <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br ${data.color} flex items-center justify-center shadow-lg`}>
                                <i className={`fa-solid ${data.icon} text-white text-3xl sm:text-4xl`}></i>
                            </div>
                        </div>

                        {/* Título principal */}
                        <h1 className="mt-8 text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100 leading-[1.1]">
                            Gracias por confiar
                            <br className="hidden sm:block" />
                            <span className="sm:hidden"> </span>
                            en Opynio
                        </h1>

                        {/* Tagline + plan name */}
                        <p className="mt-5 text-base sm:text-lg text-gray-600 dark:text-gray-400 max-w-lg mx-auto leading-relaxed">
                            Tu plan <strong className="text-gray-900 dark:text-gray-100 font-bold">{planLabel}</strong> ya está activo. {data.tagline}
                        </p>

                        {/* Separador visual minimal */}
                        <div className="mt-12 flex items-center gap-4 max-w-md mx-auto">
                            <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-800" />
                            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                                Lo que incluye tu plan
                            </span>
                            <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-800" />
                        </div>

                        {/* Features — lista vertical limpia, sin tarjetas, sin animación */}
                        <ul className="mt-8 space-y-3.5 text-left max-w-md mx-auto">
                            {data.features.map((feat, i) => (
                                <li key={i} className="flex items-start gap-3.5">
                                    <span className="flex-shrink-0 mt-0.5">
                                        <i className="fa-solid fa-check-circle text-brand-green text-base"></i>
                                    </span>
                                    <span className="text-sm sm:text-base text-gray-700 dark:text-gray-200 leading-relaxed">
                                        {feat}
                                    </span>
                                </li>
                            ))}
                        </ul>

                        {/* CTAs — primario gradient + secundario outline */}
                        <div className="mt-12 flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
                            <Link
                                to={`${countryPrefix}/${paths.myBusinesses}`}
                                className={`flex-1 bg-gradient-to-r ${data.color} text-white font-semibold px-6 py-3.5 rounded-lg text-sm sm:text-base shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2`}
                            >
                                <span>Ir a mis negocios</span>
                                <i className="fa-solid fa-arrow-right text-xs"></i>
                            </Link>
                            <Link
                                to={`${countryPrefix}/${paths.profile}`}
                                className="flex-1 bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-200 font-semibold px-6 py-3.5 rounded-lg text-sm sm:text-base border border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-zinc-600 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors flex items-center justify-center gap-2"
                            >
                                <i className="fa-solid fa-user text-xs"></i>
                                <span>Ver mi perfil</span>
                            </Link>
                        </div>

                        {/* Footer con info de recibo + soporte */}
                        <div className="mt-14 pt-8 border-t border-gray-100 dark:border-zinc-800/60 max-w-md mx-auto">
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-500 leading-relaxed">
                                <i className="fa-solid fa-envelope-open-text mr-1.5 text-gray-400"></i>
                                Recibirás el recibo de la suscripción en tu correo en los próximos minutos.
                            </p>
                            <p className="mt-2 text-xs sm:text-sm text-gray-500 dark:text-gray-500">
                                ¿Tienes alguna duda?{' '}
                                <Link
                                    to={`${countryPrefix}/${paths.support}`}
                                    className="text-brand-green hover:underline font-medium"
                                >
                                    Habla con nuestro equipo
                                </Link>
                                .
                            </p>
                        </div>
                    </div>
                </div>

                <style>{`
                    @keyframes fade-in-page {
                        from { opacity: 0; transform: translateY(8px); }
                        to   { opacity: 1; transform: translateY(0); }
                    }
                    .animate-fade-in-page {
                        animation: fade-in-page 0.5s ease-out forwards;
                    }
                `}</style>
            </div>
        </>
    );
};

export default PaymentSuccessPage;
