import React, { useEffect, useRef, useState } from 'react';
import Meta from '../Meta';
import * as ReactRouterDOM from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation, useI18n, pathTranslations } from '../../contexts/i18nContext';
import { useContentCountry } from '../../contexts/CountryContext';
import { descriptionWithCountry } from '../../utils/metaText';
import { supabase } from '../../services/supabaseService';
import { getUserFacingError, useUserErrorNotifier } from '../../utils/userFacingError';
import { COUNTRIES } from '../../constants';
import {
    NEW_PRICING_ENABLED,
    PRICES_INCLUDE_VAT,
    TRIAL_MONTHS,
    TRIAL_REMINDER_DAYS,
    PaidPlanKey,
    isAnnualToggleAvailable,
    annualPrice,
    annualSavings,
    formatAmount,
    formatEur,
    maxAnnualSavingsPercent,
    monthlyPrice,
    priceFor,
} from '../../utils/planPrices';
import { isPlanFeatureComingSoon } from '../../utils/planFeatures';

// FAQ Item Component
const FaqItem: React.FC<{ question: string; children: React.ReactNode }> = ({ question, children }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="border-b border-gray-200 dark:border-zinc-700">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center text-left py-4 font-semibold text-md md:text-lg text-gray-800 dark:text-gray-100"
                aria-expanded={isOpen}
            >
                <span>{question}</span>
                <i className={`fa-solid fa-chevron-down transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}></i>
            </button>
            <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                    <div className="pb-4 text-gray-600 dark:text-gray-300">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};


const PricingPage = () => {
    const [selectedCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
    // Si el anual no se puede contratar en todos los planes (falta algun Price ID
    // en el servidor, ver AVAILABLE_BILLING_CYCLES) no se ofrece el interruptor y
    // la pagina enseña solo el pago mensual: nadie llega a un error de pago.
    const annualToggleAvailable = isAnnualToggleAvailable();
    const billingCycle: 'monthly' | 'annual' = annualToggleAvailable ? selectedCycle : 'monthly';
    const { user, businesses, profile } = useAuth();
    const { notifyError, showUserError } = useUserErrorNotifier();
    const [upgradingPlan, setUpgradingPlan] = useState<string | null>(null);
    const [openingPortal, setOpeningPortal] = useState(false);
    const t = useTranslation();
    const { language } = useI18n();
    const { contentCountry } = useContentCountry();

    // Si el user ya tiene al menos un negocio, "elegir plan" se interpreta como
    // upgrade del plan de la empresa existente (Stripe checkout directo) en
    // lugar de mandarlo a /asignar-empresa a crear otra.
    const hasExistingBusinesses = !!user && businesses && businesses.length > 0;
    const primaryBusinessId = businesses?.[0]?.id;

    // Plan + ciclo actuales según profile (la fuente de verdad mirror del webhook).
    const currentPlanName = profile?.plan ?? null;
    const currentBillingCycle = profile?.billing_cycle ?? null;

    // El usuario ya está suscrito al mismo (plan, ciclo) que está mirando.
    // En ese caso, en lugar de re-checkout, abrimos el portal de Stripe.
    const isCurrentSubscription = (planName: string) =>
        !!user &&
        currentPlanName === planName &&
        currentBillingCycle === billingCycle &&
        planName !== 'free' &&
        planName !== 'enterprise';

    // Con `target` (cambio de plan), el portal se abre en la confirmacion del
    // cambio a ese plan, con el prorrateo que calcula Stripe; si la
    // configuracion del portal no lo permite, en su pagina principal.
    const handleManageBilling = async (target?: { plan: string; billingCycle: 'monthly' | 'annual' }) => {
        setOpeningPortal(true);
        try {
            const { data, error } = await supabase.functions.invoke('create-portal-session', target ? { body: target } : undefined);
            if (error) throw error;
            if (data?.url) {
                window.location.href = data.url;
            } else {
                throw new Error('create-portal-session: respuesta sin url');
            }
        } catch (err) {
            // Mensaje traducido con accion (Soporte / Iniciar sesion); nunca el
            // texto tecnico («Edge Function returned a non-2xx status code»).
            await notifyError(err, { flow: 'portal' });
            setOpeningPortal(false);
        }
    };

    const handleUpgradeExistingBusiness = async (planName: string) => {
        if (!primaryBusinessId) return;
        setUpgradingPlan(planName);
        try {
            const { data, error } = await supabase.functions.invoke('create-checkout-session', {
                body: { plan: planName, billingCycle, businessId: primaryBusinessId },
            });
            if (error) {
                const info = await getUserFacingError(error, { flow: 'checkout' });
                // 409 'duplicate_subscription' (ya tiene este plan) o
                // 'has_active_subscription' (tiene otro): al portal, que cambia
                // el plan de la suscripcion que ya paga. Antes se abria un
                // Checkout nuevo y acababa con dos suscripciones cobradas.
                if (info.kind === 'duplicateSubscription') {
                    setUpgradingPlan(null);
                    await handleManageBilling({ plan: planName, billingCycle });
                    return;
                }
                // «No se ha podido iniciar el pago. No se ha realizado ningun
                // cargo...» con enlace a Soporte (o el caso concreto: sesion
                // caducada, limite de empresas, sin conexion).
                showUserError(info);
                setUpgradingPlan(null);
                return;
            }
            if (data?.url) {
                window.location.href = data.url;
            } else {
                throw new Error('create-checkout-session: respuesta sin url');
            }
        } catch (err) {
            await notifyError(err, { flow: 'checkout' });
            setUpgradingPlan(null);
        }
    };

    // #6: desde una pantalla con candado, «Elegir plan X» llega aquí con ?plan=X. Si la cuenta ya tiene
    // empresa, se inicia el pago de ese plan directamente (una sola vez; se quita el parametro para que
    // volver atras no lo repita). Sin sesion o sin empresa solo se enseñan los planes, como siempre.
    const [searchParams, setSearchParams] = ReactRouterDOM.useSearchParams();
    const planPedido = (searchParams.get('plan') || '').toLowerCase();
    const pagoAutoIniciado = useRef(false);
    useEffect(() => {
        if (pagoAutoIniciado.current) return;
        if (!['starter', 'growth', 'pro'].includes(planPedido)) return;
        if (!user || !hasExistingBusinesses || !primaryBusinessId) return;
        pagoAutoIniciado.current = true;
        const resto = new URLSearchParams(searchParams);
        resto.delete('plan');
        setSearchParams(resto, { replace: true });
        if (isCurrentSubscription(planPedido)) return;
        void handleUpgradeExistingBusiness(planPedido);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [planPedido, user, hasExistingBusinesses, primaryBusinessId]);

    // Prueba gratuita (solo con NEW_PRICING_ENABLED). Quien ya paga un plan no
    // ve la promesa de «gratis» al cambiar de plan; quien no (visitante o plan
    // free) si. La prueba de 3 meses es SIN tarjeta y empieza al registrar la
    // empresa (issue #11): los botones dicen «Elegir plan» y no se promete un
    // primer cobro a 0 €; el pie de la pagina lo explica.
    // Quien ya gastó la prueba (fecha de fin en el pasado) tampoco ve la promesa, ni una cuenta con sesion que
    // ya tenia empresa y nunca la recibio (solo se concede a la PRIMERA empresa).
    const trialYaUsada = !!user && (profile?.trial_full_access_until
        ? Date.parse(profile.trial_full_access_until) <= Date.now()
        : businesses.length > 0);
    const showTrialCopy = NEW_PRICING_ENABLED && !(user && currentPlanName && currentPlanName !== 'free') && !trialYaUsada;
    const trialHeadlineKey = billingCycle === 'annual' ? 'pricingPage.trialHeadlineAnnual' : 'pricingPage.trialHeadline';
    const trialHeadline = t(trialHeadlineKey, {
        months: String(TRIAL_MONTHS),
        starter: formatAmount(priceFor('starter', billingCycle), true),
        growth: formatAmount(priceFor('growth', billingCycle), true),
        pro: formatAmount(priceFor('pro', billingCycle), true),
    });

    // SEO: Obtener nombre del país para títulos únicos
    const countryName = COUNTRIES.find(c => c.code === contentCountry)?.name || '';
    const countryInTitle = countryName ? ` ${t('common.in')} ${countryName}` : '';

    const plans = [
        {
            nameKey: 'pricingPage.planStarter',
            audienceKey: 'pricingPage.starterAudience',
            price: { monthly: monthlyPrice('starter') },
            ctaKey: 'pricingPage.startNow',
            ctaLink: `/${pathTranslations[language].register}?type=business&plan=starter`,
            features: [
                { key: 'pricingPage.starterFeature2', icon: 'fa-solid fa-paper-plane' },
                { key: 'pricingPage.starterFeature3', icon: 'fa-solid fa-puzzle-piece' },
                { key: 'pricingPage.starterFeature4', icon: 'fa-solid fa-robot' },
                { key: 'pricingPage.starterFeature5', icon: 'fa-solid fa-filter' },
                { key: 'pricingPage.starterFeature6', icon: 'fa-solid fa-file-csv' },
                { key: 'pricingPage.starterFeature7', icon: 'fa-solid fa-plug-circle-bolt' },
            ],
            isPopular: false,
        },
        {
            nameKey: 'pricingPage.planGrowth',
            audienceKey: 'pricingPage.growthAudience',
            price: { monthly: monthlyPrice('growth') },
            ctaKey: 'pricingPage.startNow',
            ctaLink: `/${pathTranslations[language].register}?type=business&plan=growth`,
            features: [
                { key: 'pricingPage.growthFeature1', icon: 'fa-solid fa-star' },
                { key: 'pricingPage.growthFeature3', icon: 'fa-solid fa-puzzle-piece' },
                { key: 'pricingPage.growthFeature4', icon: 'fa-solid fa-store' },
                { key: 'pricingPage.growthFeature5', icon: 'fa-solid fa-box-archive' },
                { key: 'pricingPage.growthFeature6', icon: 'fa-solid fa-qrcode' },
                { key: 'pricingPage.growthFeature7', icon: 'fa-solid fa-magnifying-glass-chart' },
                { key: 'pricingPage.growthFeature8', icon: 'fa-solid fa-robot' },
                { key: 'pricingPage.growthFeature9', icon: 'fa-solid fa-code' },
                { key: 'pricingPage.growthFeature10', icon: 'fa-solid fa-chart-line' },
            ],
            isPopular: true,
        },
        {
            nameKey: 'pricingPage.planPro',
            audienceKey: 'pricingPage.proAudience',
            price: { monthly: monthlyPrice('pro') },
            ctaKey: 'pricingPage.startNow',
            ctaLink: `/${pathTranslations[language].register}?type=business&plan=pro`,
            features: [
                { key: 'pricingPage.proFeature1', icon: 'fa-solid fa-star' },
                { key: 'pricingPage.proFeature3', icon: 'fa-brands fa-whatsapp' },
                { key: 'pricingPage.proFeature4', icon: 'fa-solid fa-tags' },
                { key: 'pricingPage.proFeature5', icon: 'fa-solid fa-filter-circle-dollar' },
                { key: 'pricingPage.proFeature6', icon: 'fa-solid fa-bell' },
                { key: 'pricingPage.proFeature7', icon: 'fa-solid fa-table-cells-large' },
                { key: 'pricingPage.proFeature8', icon: 'fa-solid fa-code-compare' },
                { key: 'pricingPage.proFeature9', icon: 'fa-solid fa-headset' },
            ],
            isPopular: false,
        },
        {
            nameKey: 'pricingPage.planEnterprise',
            audienceKey: 'pricingPage.enterpriseAudience',
            priceKey: 'pricingPage.customPrice',
            ctaKey: 'pricingPage.contactSales',
            // Sin login: el formulario de contacto de «Sobre nosotros» (Soporte exige iniciar sesión).
            ctaLink: `/${pathTranslations[language].about}#contacto`,
            features: [
                { key: 'pricingPage.enterpriseFeature1', icon: 'fa-solid fa-infinity' },
                { key: 'pricingPage.enterpriseFeature2', icon: 'fa-solid fa-paper-plane' },
                { key: 'pricingPage.enterpriseFeature3', icon: 'fa-solid fa-shield-halved' },
                { key: 'pricingPage.enterpriseFeature4', icon: 'fa-solid fa-robot' },
                { key: 'pricingPage.enterpriseFeature5', icon: 'fa-solid fa-globe' },
                { key: 'pricingPage.enterpriseFeature6', icon: 'fa-solid fa-plug-circle-bolt' },
                { key: 'pricingPage.enterpriseFeature7', icon: 'fa-solid fa-file-pdf' },
                { key: 'pricingPage.enterpriseFeature8', icon: 'fa-solid fa-handshake' },
            ],
            isPopular: false,
        },
    ];

    return (
        <>
            <Meta
                title={`${t('footer.pricingAndPlans')} - Opynio${countryInTitle}`}
                description={descriptionWithCountry(t('pricingPage.findPerfectPlanSubtitle'), countryInTitle)}
            />
            <div className="py-12">
                {/* Header */}
                <div className="text-center max-w-3xl mx-auto mb-12 px-4">
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-brand-dark dark:text-gray-100 leading-tight">
                        {t('pricingPage.findPerfectPlanTitle')}{countryInTitle}
                    </h1>
                    <p className="text-lg text-gray-600 dark:text-gray-400 mt-4">
                        {t('pricingPage.findPerfectPlanSubtitle')}
                    </p>
                    {showTrialCopy && (
                        <p className="inline-block mt-5 bg-green-50 dark:bg-green-900/30 text-brand-green font-bold text-base sm:text-lg px-4 sm:px-5 py-2 rounded-2xl">
                            <i className="fa-solid fa-gift mr-2" aria-hidden="true"></i>{trialHeadline}
                        </p>
                    )}
                </div>

                {/* Billing Cycle Toggle (solo si el anual esta disponible en todos los planes) */}
                {annualToggleAvailable && (
                <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2 mb-10 px-4">
                    <span className={`font-semibold transition-colors ${billingCycle === 'monthly' ? 'text-brand-dark dark:text-white' : 'text-gray-500'}`}>
                        {t('pricingPage.monthlyPayment')}
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={billingCycle === 'annual'}
                            onChange={() => setBillingCycle(prev => prev === 'monthly' ? 'annual' : 'monthly')}
                            aria-label={t('pricingPage.toggleAnnual')}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-brand-green"></div>
                    </label>
                    <span className={`font-semibold transition-colors ${billingCycle === 'annual' ? 'text-brand-dark dark:text-white' : 'text-gray-500'}`}>
                        {t('pricingPage.annualPayment')}
                    </span>
                    <span className={`bg-yellow-200 text-yellow-800 text-xs font-bold px-2.5 py-0.5 rounded-full transition-opacity duration-300 ${NEW_PRICING_ENABLED || billingCycle === 'annual' ? 'opacity-100' : 'opacity-0'}`} aria-live="polite">
                        {NEW_PRICING_ENABLED ? t('pricingPage.saveUpToPercent', { percent: maxAnnualSavingsPercent() }) : t('pricingPage.save25Percent')}
                    </span>
                </div>
                )}

                {/* Pricing Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 items-start pt-8">
                    {plans.map((plan) => {
                        const isAnnual = billingCycle === 'annual';
                        const isEnterprise = plan.nameKey === 'pricingPage.planEnterprise';
                        const planName = plan.nameKey.replace('pricingPage.plan', '').toLowerCase();
                        // El visitante conserva el ciclo elegido (anual/mensual) hasta el alta.
                        let ctaLinkTarget = plan.ctaLink.includes('plan=') ? `${plan.ctaLink}&billingCycle=${billingCycle}` : plan.ctaLink;

                        // 1) Sin login: ir a /registro?type=business&plan=X (default).
                        // 2) Con login y SIN negocios: ir a /asignar-empresa?plan=X&billingCycle=Y.
                        // 3) Con login Y CON negocios: el botón se convierte en click handler
                        //    que dispara el checkout de Stripe directamente para upgrade.
                        if (user && !isEnterprise && !hasExistingBusinesses) {
                            ctaLinkTarget = `/${pathTranslations[language].assignBusiness}?plan=${planName}&billingCycle=${billingCycle}`;
                        }
                        const shouldUpgradeInPlace = user && !isEnterprise && hasExistingBusinesses;

                        return (
                            <div
                                key={plan.nameKey}
                                className={`relative bg-white dark:bg-zinc-800 p-6 rounded-2xl shadow-lg border-2 transition-all duration-300 ${plan.isPopular ? 'border-brand-green shadow-green-200/50 dark:shadow-green-900/50 transform lg:scale-105' : 'border-gray-200 dark:border-zinc-700'}`}
                            >
                                {plan.isPopular && (
                                    <div className="absolute top-0 -translate-y-1/2 left-1/2 -translate-x-1/2 bg-brand-green text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wider">
                                        {t('pricingPage.mostPopular')}
                                    </div>
                                )}
                                <div className="text-center">
                                    <h3 className="text-2xl font-bold text-brand-dark dark:text-gray-100">{t(plan.nameKey)}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 min-h-[2rem]">{t(plan.audienceKey)}</p>
                                    
                                    <div className="my-6 min-h-[5rem] flex flex-col justify-center">
                                        {'price' in plan ? (
                                            isAnnual ? (
                                                <>
                                                    <span className="text-3xl sm:text-4xl font-extrabold text-brand-dark dark:text-gray-100">
                                                        {formatEur(annualPrice(planName as PaidPlanKey), NEW_PRICING_ENABLED)}
                                                    </span>
                                                    <span className="text-gray-500 dark:text-gray-400 font-medium">{t('pricingPage.perYear')}</span>
                                                    <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mt-1">
                                                        ({t('pricingPage.equivalentToPerMonth', { price: formatAmount(annualPrice(planName as PaidPlanKey) / 12, NEW_PRICING_ENABLED) })})
                                                    </p>
                                                    {NEW_PRICING_ENABLED && annualSavings(planName as PaidPlanKey) > 0 && (
                                                        <p className="text-sm font-bold text-brand-green mt-1">
                                                            {t('pricingPage.saveAmount', { amount: formatEur(annualSavings(planName as PaidPlanKey), true) })}
                                                        </p>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    <span className="text-3xl sm:text-4xl font-extrabold text-brand-dark dark:text-gray-100">
                                                        {formatEur((plan.price as {monthly: number}).monthly, NEW_PRICING_ENABLED)}
                                                    </span>
                                                    <span className="text-gray-500 dark:text-gray-400 font-medium">{t('pricingPage.perMonth')}</span>
                                                </>
                                            )
                                        ) : (
                                            <span className="text-2xl font-bold text-brand-dark dark:text-gray-100">{t((plan as any).priceKey)}</span>
                                        )}
                                    </div>

                                    {/* Plan anual: el año empieza al acabar la prueba (issue #2). */}
                                    {showTrialCopy && isAnnual && 'price' in plan && (
                                        <p className="-mt-2 mb-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400">{t('pricingPage.trialAnnualNote')}</p>
                                    )}

                                    {isCurrentSubscription(planName) ? (
                                        <button
                                            type="button"
                                            onClick={() => handleManageBilling()}
                                            disabled={openingPortal}
                                            className={`w-full text-center font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${plan.isPopular ? 'bg-brand-blue text-white hover:bg-opacity-90 shadow-md' : 'bg-blue-50 text-brand-blue hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50'}`}
                                        >
                                            {openingPortal ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                                    <span>{t('common.openingPortal')}</span>
                                                </>
                                            ) : (
                                                <span><i className="fa-solid fa-credit-card mr-2"></i>{t('myBusinesses.manageBilling')}</span>
                                            )}
                                        </button>
                                    ) : shouldUpgradeInPlace ? (
                                        <button
                                            type="button"
                                            onClick={() => handleUpgradeExistingBusiness(planName)}
                                            disabled={upgradingPlan !== null}
                                            className={`w-full text-center font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${plan.isPopular ? 'bg-brand-green text-white hover:bg-opacity-90 shadow-md' : 'bg-green-50 text-brand-green hover:bg-green-100 dark:bg-green-900/30 dark:hover:bg-green-900/50'}`}
                                        >
                                            {upgradingPlan === planName ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                                    <span>{t('common.redirectingToStripe')}</span>
                                                </>
                                            ) : (
                                                <span>{showTrialCopy ? t('pricingPage.choosePlanCta') : t('pricingPage.upgradeToThisPlan', { plan: t(plan.nameKey) })}</span>
                                            )}
                                        </button>
                                    ) : (
                                        <ReactRouterDOM.Link to={ctaLinkTarget} className={`w-full block text-center font-semibold py-3 px-6 rounded-lg transition-colors ${plan.isPopular ? 'bg-brand-green text-white hover:bg-opacity-90 shadow-md' : 'bg-green-50 text-brand-green hover:bg-green-100 dark:bg-green-900/30 dark:hover:bg-green-900/50'}`}>
                                            {showTrialCopy && !isEnterprise ? t('pricingPage.choosePlanCta') : t(plan.ctaKey)}
                                        </ReactRouterDOM.Link>
                                    )}
                                </div>
                                
                                <ul className="mt-8 space-y-4 text-gray-600 dark:text-gray-300">
                                    {plan.features.map((feature, index) => (
                                        <li key={index} className="flex items-start gap-3">
                                            <i className={`${feature.icon} text-brand-green mt-1 w-4 text-center`}></i>
                                            <span>{t(feature.key)}{isPlanFeatureComingSoon(feature.key) && <span className="text-xs text-yellow-600 dark:text-yellow-400 font-semibold ml-2">({t('common.comingSoon')})</span>}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        );
                    })}
                </div>

                {NEW_PRICING_ENABLED && (
                    <div className="max-w-3xl mx-auto mt-10 px-4 text-center text-sm text-gray-500 dark:text-gray-400 space-y-2">
                        {showTrialCopy && (
                            <p>{t('pricingPage.trialFooter', { months: String(TRIAL_MONTHS), days: String(TRIAL_REMINDER_DAYS) })}</p>
                        )}
                        <p>{PRICES_INCLUDE_VAT ? t('pricingPage.vatIncluded') : t('pricingPage.vatExcluded')}</p>
                    </div>
                )}
            </div>

            {/* FAQ Section */}
            <div className="py-16 mt-16 bg-gray-50 dark:bg-zinc-900/50 rounded-2xl">
                <div className="max-w-3xl mx-auto px-4">
                    <div className="text-center mb-10">
                        <h2 className="text-3xl font-extrabold text-brand-dark dark:text-gray-100">
                            {t('pricingPage.faqTitle')}
                        </h2>
                    </div>
                    <div className="space-y-4">
                        <FaqItem question={t('pricingPage.faq1Question')}>
                            <p>{t('pricingPage.faq1Answer')}</p>
                        </FaqItem>
                        <FaqItem question={t('pricingPage.faq2Question')}>
                            <p>{t('pricingPage.faq2Answer')}</p>
                        </FaqItem>
                        <FaqItem question={t('pricingPage.faq3Question')}>
                            <p>{t('pricingPage.faq3Answer')}</p>
                        </FaqItem>
                        <FaqItem question={t('pricingPage.faq4Question')}>
                            <p>{t('pricingPage.faq4Answer')}</p>
                        </FaqItem>
                    </div>
                </div>
            </div>
        </>
    );
};

export default PricingPage;