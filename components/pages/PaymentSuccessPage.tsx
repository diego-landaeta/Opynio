import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { clearCache, getBusinessesForOwner, getUserProfile, supabase } from '../../services/supabaseService';
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

// Esperas entre comprobaciones (ms). El webhook de Stripe suele llegar en
// segundos, pero con reintentos puede tardar bastante mas: se sondea ~85 s con
// espera creciente antes de dar el pago por no confirmado.
const ESPERAS_INICIALES = [2000, 2000, 3000, 3000, 4000, 5000, 6000, 8000, 10000, 12000, 15000, 15000];
// «Volver a comprobar»: una ronda corta (~12 s).
const ESPERAS_REINTENTO = [2000, 4000, 6000];
// A partir de aqui el spinner avisa de que esta tardando mas de lo normal.
const AVISO_LENTO_MS = 12000;

// Respuesta de la funcion get-checkout-status (solo lo que usa esta pantalla).
interface CheckoutStatus {
    paid: boolean;
    ready: boolean;
    amount: number | null;
    currency: string | null;
}

type EstadoPago = 'checking' | 'confirmed' | 'paidPending' | 'pending';

const PaymentSuccessPage: React.FC = () => {
    const { user, profile, setProfile, setBusinesses } = useAuth();
    const { language } = useI18n();
    const { country } = useCountry();
    const t = useTranslation();
    const location = useLocation();

    const countryPrefix = country ? `/${country.toLowerCase()}` : '';
    const pathLang = country ? getLanguageForCountryCode(country) : language;
    const paths = pathTranslations[pathLang] || pathTranslations.es;

    // Perfil y empresas ya no se cargan al entrar: se cargan UNA vez, cuando el
    // pago de esta sesion esta aplicado (antes se cargaban dos veces).
    useEffect(() => {
        try { localStorage.removeItem('opynio_pending_plan_welcome'); } catch {}
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prevOverflow;
        };
    }, []);

    const plan: Plan = (profile?.plan as Plan | undefined) ?? 'v2';
    const data = getPlanBenefits(plan, t);
    const planLabel = plan === 'v2' ? 'v.2' : plan.charAt(0).toUpperCase() + plan.slice(1);

    // Se verifica ESTA sesion de pago (session_id de la URL) con la funcion
    // get-checkout-status: que es del usuario, que Stripe la da por pagada y
    // que el webhook ya la ha aplicado (suscripcion, plan y, en un alta, la
    // empresa y el rol). Antes bastaba cualquier suscripcion activa de las
    // ultimas 48 h: se confirmaba antes de que existiera la empresa (y «Mis
    // negocios» rebotaba) o con la suscripcion de un pago anterior.
    // Sin verificacion no hay confirmacion ni Purchase.
    const [estadoPago, setEstadoPago] = useState<EstadoPago>('checking');
    // 0 = sondeo inicial; cada «Volver a comprobar» suma 1 y relanza el efecto.
    const [ronda, setRonda] = useState(0);
    const [tardando, setTardando] = useState(false);
    // Purchase se manda una sola vez aunque se vuelva a comprobar.
    const purchaseEnviado = useRef(false);

    const volverAComprobar = useCallback(() => {
        setEstadoPago('checking');
        setRonda(r => r + 1);
    }, []);

    useEffect(() => {
        if (!user) return;
        const sessionId = new URLSearchParams(location.search).get('session_id');
        // Sin session_id (URL escrita a mano) no hay nada que verificar.
        if (!sessionId) {
            setEstadoPago('pending');
            return;
        }
        let cancelled = false;
        const esperas = ronda === 0 ? ESPERAS_INICIALES : ESPERAS_REINTENTO;
        setTardando(false);
        const avisoLento = ronda === 0 ? setTimeout(() => { if (!cancelled) setTardando(true); }, AVISO_LENTO_MS) : undefined;

        // null = aun no se sabe (red, 5xx...): se vuelve a probar.
        // 'gone' = la sesion no existe, no es de este usuario o el id no vale:
        // reintentar no cambia nada.
        const consultar = async (): Promise<CheckoutStatus | 'gone' | null> => {
            const { data: st, error } = await supabase.functions.invoke('get-checkout-status', {
                body: { session_id: sessionId },
            });
            if (!error) return st as CheckoutStatus;
            const ctx = (error as any)?.context;
            const status = Number(ctx?.status) || 0;
            let code = '';
            try { code = String((await ctx.clone().json())?.code ?? ''); } catch { /* cuerpo no JSON */ }
            if (code === 'checkout_session_not_found' || code === 'invalid_request' || status === 400) return 'gone';
            return null;
        };

        const comprobar = async () => {
            let pagado = false;
            for (let intento = 0; intento <= esperas.length && !cancelled; intento++) {
                let st: CheckoutStatus | 'gone' | null = null;
                try { st = await consultar(); } catch { st = null; }
                if (cancelled) return;
                if (st === 'gone') break;
                if (st?.paid) pagado = true;
                if (st?.ready) {
                    // Perfil y empresas con lo que acaba de escribir el webhook
                    // (plan; en un alta, empresa y rol) ANTES de pintar la
                    // confirmacion: ni un instante con el plan anterior, y «Mis
                    // negocios» ya encuentra la empresa.
                    try {
                        clearCache(`profile_${user.id}`);
                        const [updatedProfile, newBusinesses] = await Promise.all([
                            getUserProfile(user),
                            getBusinessesForOwner(user.id),
                        ]);
                        if (!cancelled && updatedProfile) setProfile(updatedProfile);
                        if (!cancelled && newBusinesses) setBusinesses(newBusinesses);
                    } catch { /* se queda con el perfil que habia */ }
                    if (cancelled) return;
                    setEstadoPago('confirmed');
                    // Meta Pixel Purchase: event_id = session_id, el mismo que
                    // manda el CAPI del webhook (Meta deduplica). Importe y
                    // moneda de ESTA sesion. Una vez por visita.
                    if (!purchaseEnviado.current) {
                        purchaseEnviado.current = true;
                        void trackMetaEvent('Purchase', {
                            eventId: sessionId,
                            userData: { email: user.email, external_id: user.id },
                            customData: {
                                value: typeof st.amount === 'number' ? st.amount : 0,
                                currency: st.currency ? String(st.currency).toUpperCase() : 'EUR',
                            },
                        });
                    }
                    return;
                }
                if (intento < esperas.length) {
                    await new Promise(r => setTimeout(r, esperas[intento]));
                }
            }
            // Pagado pero sin aplicar (webhook lento o fallando): no se confirma,
            // pero tampoco se dice que no hay pago.
            if (!cancelled) setEstadoPago(pagado ? 'paidPending' : 'pending');
        };
        void comprobar();
        return () => {
            cancelled = true;
            if (avisoLento) clearTimeout(avisoLento);
        };
        // Por `user?.id` y no por el objeto: AuthContext lo sustituye al
        // refrescar la sesion y eso reiniciaba el sondeo (y una consulta de mas).
        // setProfile/setBusinesses vienen de AuthContext y son estables.
    }, [user?.id, location.search, ronda]);

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
                            {estadoPago === 'confirmed' ? t('paymentSuccessPage.eyebrow') : ''}
                        </span>
                    </div>
                </header>

                {/* Cuerpo: ocupa el alto restante, contenido centrado y
                    con scroll INTERNO sólo si la pantalla es muy pequeña
                    (móvil tumbado, etc.) — por defecto cabe todo. */}
                <div className="flex-1 min-h-0 overflow-y-auto flex items-center justify-center px-4 sm:px-6 py-4 sm:py-6">
                    {estadoPago !== 'confirmed' ? (
                    <div className="w-full max-w-md text-center animate-fade-page">
                        <article className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-sm px-6 py-8">
                            {estadoPago === 'checking' || !user ? (
                                <>
                                    <div className="mx-auto mb-4 w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin" aria-hidden="true"></div>
                                    <p className="text-sm sm:text-base font-semibold text-gray-800 dark:text-gray-100" role="status">
                                        {t('paymentSuccessPage.verifying')}
                                    </p>
                                    {tardando && (
                                        <p className="mt-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                                            {t('paymentSuccessPage.verifyingSlow')}
                                        </p>
                                    )}
                                </>
                            ) : (
                                <>
                                    <i className="fa-solid fa-clock text-3xl text-amber-500 mb-3" aria-hidden="true"></i>
                                    <p className="text-sm sm:text-base text-gray-700 dark:text-gray-200" role="status">
                                        {estadoPago === 'paidPending'
                                            ? t('paymentSuccessPage.paidNotReady')
                                            : t('paymentSuccessPage.notConfirmed')}
                                    </p>
                                    <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">
                                        <button
                                            type="button"
                                            onClick={volverAComprobar}
                                            className="inline-flex items-center justify-center gap-2 bg-brand-green text-white font-semibold px-5 py-2.5 rounded-lg text-sm hover:bg-emerald-600 transition-colors"
                                        >
                                            <i className="fa-solid fa-rotate-right text-xs" aria-hidden="true"></i>
                                            {t('paymentSuccessPage.checkAgain')}
                                        </button>
                                        {/* Pagado pero sin aplicar: a Soporte, no a Planes
                                            (volver a pagar seria un doble cobro). */}
                                        <Link
                                            to={`${countryPrefix}/${estadoPago === 'paidPending' ? paths.support : paths.pricing}`}
                                            className="inline-flex items-center justify-center bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-200 font-semibold px-5 py-2.5 rounded-lg text-sm border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                                        >
                                            {estadoPago === 'paidPending' ? t('paymentSuccessPage.supportLink') : t('paymentSuccessPage.seePlans')}
                                        </Link>
                                    </div>
                                </>
                            )}
                        </article>
                    </div>
                    ) : (
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
                    )}
                </div>

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
