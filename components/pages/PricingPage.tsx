import React, { useState } from 'react';
import Meta from '../Meta';
import * as ReactRouterDOM from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation, useI18n, pathTranslations } from '../../contexts/i18nContext';
import { useCountry } from '../../contexts/CountryContext';
import { useNotification } from '../../contexts/NotificationContext';
import { supabase } from '../../services/supabaseService';
import { COUNTRIES } from '../../constants';

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
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
    const { user, businesses, profile } = useAuth();
    const { showNotification } = useNotification();
    const [upgradingPlan, setUpgradingPlan] = useState<string | null>(null);
    const [openingPortal, setOpeningPortal] = useState(false);
    const t = useTranslation();
    const { language } = useI18n();
    const { country } = useCountry();

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

    const handleManageBilling = async () => {
        setOpeningPortal(true);
        try {
            const { data, error } = await supabase.functions.invoke('create-portal-session');
            if (error) throw error;
            if (data?.url) {
                window.location.href = data.url;
            } else {
                throw new Error('No se recibió la URL del portal de facturación.');
            }
        } catch (err: any) {
            showNotification(err.message || 'No se pudo abrir el portal de facturación.', 'error');
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
                // El backend devuelve 409 con error: 'duplicate_subscription' si el
                // usuario ya tiene este plan activo. En ese caso, mandamos al portal.
                // deno-lint-ignore no-explicit-any
                const ctx: any = (error as any)?.context;
                const status = ctx?.response?.status ?? ctx?.status;
                if (status === 409) {
                    setUpgradingPlan(null);
                    await handleManageBilling();
                    return;
                }
                throw error;
            }
            if (data?.url) {
                window.location.href = data.url;
            } else {
                throw new Error('No se recibió la URL de pago.');
            }
        } catch (err: any) {
            showNotification(err.message || 'No se pudo iniciar el checkout.', 'error');
            setUpgradingPlan(null);
        }
    };

    // SEO: Obtener nombre del país para títulos únicos
    const countryName = COUNTRIES.find(c => c.code === country)?.name || '';
    const countryInTitle = countryName ? ` ${t('common.in')} ${countryName}` : '';

    const plans = [
        {
            nameKey: 'pricingPage.planStarter',
            audienceKey: 'pricingPage.starterAudience',
            price: { monthly: 95 },
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
            price: { monthly: 215 },
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
            price: { monthly: 419 },
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
            ctaLink: `/${pathTranslations[language].support}`,
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
                description={`${t('pricingPage.findPerfectPlanSubtitle')}${countryInTitle}.`}
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
                </div>

                {/* Billing Cycle Toggle */}
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
                            aria-label="Cambiar a facturación anual"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-brand-green"></div>
                    </label>
                    <span className={`font-semibold transition-colors ${billingCycle === 'annual' ? 'text-brand-dark dark:text-white' : 'text-gray-500'}`}>
                        {t('pricingPage.annualPayment')}
                    </span>
                    <span className={`bg-yellow-200 text-yellow-800 text-xs font-bold px-2.5 py-0.5 rounded-full transition-opacity duration-300 ${billingCycle === 'annual' ? 'opacity-100' : 'opacity-0'}`} aria-live="polite">
                        {t('pricingPage.save25Percent')}
                    </span>
                </div>

                {/* Pricing Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 items-start pt-8">
                    {plans.map((plan) => {
                        const isAnnual = billingCycle === 'annual';
                        const isEnterprise = plan.nameKey === 'pricingPage.planEnterprise';
                        const planName = plan.nameKey.replace('pricingPage.plan', '').toLowerCase();
                        let ctaLinkTarget = plan.ctaLink;

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
                                                        €{((plan.price as {monthly: number}).monthly * 12 * 0.75).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                    <span className="text-gray-500 dark:text-gray-400 font-medium">{t('pricingPage.perYear')}</span>
                                                    <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mt-1">
                                                        ({t('pricingPage.equivalentToPerMonth', { price: (((plan.price as {monthly: number}).monthly * 12 * 0.75) / 12).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })})
                                                    </p>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="text-3xl sm:text-4xl font-extrabold text-brand-dark dark:text-gray-100">
                                                        €{((plan.price as {monthly: number}).monthly).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                    <span className="text-gray-500 dark:text-gray-400 font-medium">{t('pricingPage.perMonth')}</span>
                                                </>
                                            )
                                        ) : (
                                            <span className="text-2xl font-bold text-brand-dark dark:text-gray-100">{t((plan as any).priceKey)}</span>
                                        )}
                                    </div>

                                    {isCurrentSubscription(planName) ? (
                                        <button
                                            type="button"
                                            onClick={handleManageBilling}
                                            disabled={openingPortal}
                                            className={`w-full text-center font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${plan.isPopular ? 'bg-brand-blue text-white hover:bg-opacity-90 shadow-md' : 'bg-blue-50 text-brand-blue hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50'}`}
                                        >
                                            {openingPortal ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                                    <span>Abriendo portal…</span>
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
                                                    <span>Redirigiendo a Stripe…</span>
                                                </>
                                            ) : (
                                                <span>{t('pricingPage.upgradeToThisPlan', { plan: t(plan.nameKey) })}</span>
                                            )}
                                        </button>
                                    ) : (
                                        <ReactRouterDOM.Link to={ctaLinkTarget} className={`w-full block text-center font-semibold py-3 px-6 rounded-lg transition-colors ${plan.isPopular ? 'bg-brand-green text-white hover:bg-opacity-90 shadow-md' : 'bg-green-50 text-brand-green hover:bg-green-100 dark:bg-green-900/30 dark:hover:bg-green-900/50'}`}>
                                            {t(plan.ctaKey)}
                                        </ReactRouterDOM.Link>
                                    )}
                                </div>
                                
                                <ul className="mt-8 space-y-4 text-gray-600 dark:text-gray-300">
                                    {plan.features.map((feature, index) => (
                                        <li key={index} className="flex items-start gap-3">
                                            <i className={`${feature.icon} text-brand-green mt-1 w-4 text-center`}></i>
                                            <span>{t(feature.key)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        );
                    })}
                </div>
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