import React, { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import { useTranslation, useI18n, getLocaleFromLanguage } from '../../../../contexts/i18nContext';
import { PLAN_HIERARCHY, planNameKey, type DashboardSectionId } from '../../../../utils/planFeatures';
import {
    NEW_PRICING_ENABLED, PAID_PLAN_ORDER, isAnnualToggleAvailable, PRICES_INCLUDE_VAT, TRIAL_MONTHS, TRIAL_REMINDER_DAYS, annualPrice,
    formatAmount, maxAnnualSavingsPercent, monthlyPrice, priceFor, type PaidPlanKey,
} from '../../../../utils/planPrices';
import type { Plan } from '../../../../types';
import { usePricingHref } from './useDashboardSections';

/**
 * Pantalla de una funcion del panel que el plan actual no incluye. Una sola
 * plantilla para Analiticas, Invitaciones, Productos y Widgets (antes cada una
 * era un candado con un boton directo al pago):
 *
 *   1. que es y para que sirve (dos frases),
 *   2. ejemplos visuales marcados como «Ejemplo»,
 *   3. tres beneficios,
 *   4. los planes con precio, interruptor mensual/anual y el que desbloquea la
 *      funcion destacado. Cada boton lleva a Planes, como el candado de antes.
 *
 * Los ejemplos son maquetas: nunca llevan datos de la empresa (ni cifras ni
 * nombres), van etiquetados y se ocultan a los lectores de pantalla.
 */

export type PreviewSectionId = Extract<DashboardSectionId, 'analytics' | 'invitations' | 'products' | 'widgets'>;

export const isPreviewSection = (id: DashboardSectionId): id is PreviewSectionId =>
    id === 'analytics' || id === 'invitations' || id === 'products' || id === 'widgets';

// --- Ejemplos -------------------------------------------------------------

const K = 'businessDashboard.';

/** Estrellas de relleno fijo (maqueta): `value` con medias estrellas. */
const MockStars: React.FC<{ value: number; className?: string }> = ({ value, className = 'text-xs' }) => (
    <span className={`inline-flex gap-0.5 text-yellow-400 ${className}`} aria-hidden="true">
        {[1, 2, 3, 4, 5].map(n => (
            <i key={n} className={`fa-solid ${value >= n ? 'fa-star' : value >= n - 0.5 ? 'fa-star-half-alt' : 'fa-star opacity-30'}`}></i>
        ))}
    </span>
);

/** Marco comun de un ejemplo: titulo, etiqueta «Ejemplo» visible y contenido no interactivo. */
const ExampleFrame: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className = '' }) => {
    const t = useTranslation();
    return (
        <figure className={`m-0 rounded-xl border-2 border-dashed border-amber-300/70 dark:border-amber-500/40 bg-gray-50 dark:bg-zinc-900/50 p-3 sm:p-4 ${className}`}>
            <div className="flex items-center justify-between gap-2 mb-3">
                <p className="min-w-0 text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-200 truncate">{title}</p>
                <span className="flex-shrink-0 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-[11px] font-bold uppercase tracking-wide px-2.5 py-0.5">
                    {t(`${K}lockExampleBadge`)}
                </span>
            </div>
            <div aria-hidden="true" className="select-none pointer-events-none">{children}</div>
            <figcaption className="mt-3 text-[11px] sm:text-xs text-gray-500 dark:text-gray-400">{t(`${K}lockExampleCaption`)}</figcaption>
        </figure>
    );
};

const mockCard = 'bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg';

const AnalyticsExample: React.FC = () => {
    const t = useTranslation();
    const { language } = useI18n();
    const locale = getLocaleFromLanguage(language);
    // Meses fijos de un ano cualquiera: no son fechas de la empresa.
    const meses = [0, 1, 2, 3, 4, 5].map(m => new Date(2000, m, 1).toLocaleDateString(locale, { month: 'short' }));
    const alturas = [32, 46, 41, 64, 78, 96];
    const nota = (4.6).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const productos = [
        { letra: 'A', ancho: 92, nota: 4.8 },
        { letra: 'B', ancho: 70, nota: 4.5 },
        { letra: 'C', ancho: 48, nota: 4.1 },
    ];
    return (
        <ExampleFrame title={t(`${K}dashboardAnalytics`)}>
            <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className={`${mockCard} p-3 sm:col-span-2`}>
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-3">{t(`${K}lockAnaMonthlyTitle`)}</p>
                        <div className="flex items-end gap-1.5 sm:gap-2 h-28 border-b border-gray-200 dark:border-zinc-700">
                            {alturas.map((h, i) => (
                                <div key={i} className="flex-1 bg-brand-green rounded-t" style={{ height: `${h}%` }}></div>
                            ))}
                        </div>
                        <div className="flex gap-1.5 sm:gap-2 mt-1.5">
                            {meses.map((m, i) => (
                                <span key={i} className="flex-1 text-center text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">{m}</span>
                            ))}
                        </div>
                    </div>
                    <div className={`${mockCard} p-3 flex flex-col justify-center items-center text-center`}>
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">{t(`${K}lockAnaAvgTitle`)}</p>
                        <p className="text-3xl sm:text-4xl font-extrabold text-gray-800 dark:text-gray-100 mt-1">{nota}</p>
                        <MockStars value={4.6} className="text-sm mt-1" />
                    </div>
                </div>
                <div className={`${mockCard} p-3`}>
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">{t(`${K}lockAnaCompareTitle`)}</p>
                    <ul className="space-y-2.5">
                        {productos.map(p => (
                            <li key={p.letra} className="flex items-center gap-2 sm:gap-3 text-xs">
                                <span className="w-24 sm:w-40 flex-shrink-0 truncate font-medium text-gray-700 dark:text-gray-200">{t(`${K}lockExampleProduct`, { letter: p.letra })}</span>
                                <span className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-zinc-700">
                                    <span className="block h-2 rounded-full bg-brand-green" style={{ width: `${p.ancho}%` }}></span>
                                </span>
                                <span className="w-10 flex-shrink-0 text-right font-bold text-gray-800 dark:text-gray-100">
                                    <i className="fa-solid fa-star text-yellow-400 mr-1"></i>{p.nota.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </ExampleFrame>
    );
};

const InvitationsExample: React.FC = () => {
    const t = useTranslation();
    const filas = [
        { email: 'cliente.a@example.com', estado: 'sent', clase: 'bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-gray-200' },
        { email: 'cliente.b@example.com', estado: 'opened', clase: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200' },
        { email: 'cliente.c@example.com', estado: 'reviewed', clase: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200' },
    ];
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ExampleFrame title={t(`${K}lockInvEmailCaption`)}>
                <div className={`${mockCard} p-3 sm:p-4`}>
                    <div className="flex items-center gap-2.5 pb-3 border-b border-gray-200 dark:border-zinc-700">
                        <span className="w-8 h-8 rounded-full bg-brand-green/15 text-brand-green flex items-center justify-center flex-shrink-0">
                            <i className="fa-solid fa-envelope text-sm"></i>
                        </span>
                        <span className="min-w-0">
                            <span className="block text-xs font-bold text-gray-800 dark:text-gray-100 truncate">{t(`${K}lockExampleCompany`)}</span>
                            <span className="block text-[11px] text-gray-500 dark:text-gray-400 truncate">{t(`${K}lockInvEmailSubject`)}</span>
                        </span>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 mt-3">{t(`${K}lockInvEmailBody`)}</p>
                    <div className="mt-3 flex items-center gap-3">
                        <MockStars value={5} className="text-sm" />
                    </div>
                    <span className="mt-3 inline-block rounded-md bg-brand-green text-white text-xs sm:text-sm font-bold px-4 py-2">{t(`${K}lockInvEmailButton`)}</span>
                </div>
            </ExampleFrame>
            <ExampleFrame title={t(`${K}lockInvHistoryTitle`)}>
                <ul className={`${mockCard} divide-y divide-gray-200 dark:divide-zinc-700`}>
                    {filas.map(f => (
                        <li key={f.estado} className="flex items-center justify-between gap-2 px-3 py-2.5">
                            <span className="min-w-0 truncate text-xs sm:text-sm text-gray-700 dark:text-gray-200">{f.email}</span>
                            <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-[11px] sm:text-xs font-semibold ${f.clase}`}>
                                {t(`${K}invitationStatus_${f.estado}`)}
                            </span>
                        </li>
                    ))}
                </ul>
            </ExampleFrame>
        </div>
    );
};

const MockReview: React.FC<{ textKey: string; stars: number }> = ({ textKey, stars }) => {
    const t = useTranslation();
    return (
        <div className={`${mockCard} p-3`}>
            <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 flex items-center justify-center flex-shrink-0">
                    <i className="fa-solid fa-user text-xs"></i>
                </span>
                <span className="min-w-0">
                    <span className="block text-xs font-bold text-gray-800 dark:text-gray-100 truncate">{t(`${K}lockExampleCustomer`)}</span>
                    <MockStars value={stars} className="text-[10px]" />
                </span>
            </div>
            <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">{t(`${K}${textKey}`)}</p>
        </div>
    );
};

const ProductsExample: React.FC = () => {
    const t = useTranslation();
    const { language } = useI18n();
    const nota = (4.7).toLocaleString(getLocaleFromLanguage(language), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return (
        <ExampleFrame title={t(`${K}dashboardProducts`)}>
            <div className="space-y-3">
                <div className={`${mockCard} p-3 flex items-center gap-3`}>
                    <span className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-brand-green/15 text-brand-green flex items-center justify-center flex-shrink-0">
                        <i className="fa-solid fa-graduation-cap text-xl"></i>
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block text-sm sm:text-base font-bold text-gray-800 dark:text-gray-100 truncate">{t(`${K}lockProdCourseName`)}</span>
                        <span className="flex items-center gap-2 mt-0.5">
                            <MockStars value={4.7} className="text-xs" />
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{nota}</span>
                        </span>
                    </span>
                </div>
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">{t(`${K}lockProdReviewsTitle`)}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <MockReview textKey="lockExampleReview1" stars={5} />
                    <MockReview textKey="lockExampleReview2" stars={4.5} />
                </div>
            </div>
        </ExampleFrame>
    );
};

const WidgetsExample: React.FC = () => {
    const t = useTranslation();
    const { language } = useI18n();
    const nota = (4.8).toLocaleString(getLocaleFromLanguage(language), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const linea = 'rounded bg-gray-200 dark:bg-zinc-700';
    return (
        <ExampleFrame title={t(`${K}dashboardWidgets`)}>
            <div className={`${mockCard} overflow-hidden`}>
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700">
                    <span className="flex gap-1 flex-shrink-0">
                        <span className="w-2 h-2 rounded-full bg-red-400"></span>
                        <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                        <span className="w-2 h-2 rounded-full bg-green-400"></span>
                    </span>
                    <span className="min-w-0 flex-1 truncate rounded bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 px-2 py-0.5 text-[11px] text-gray-500 dark:text-gray-400">www.example.com</span>
                </div>
                <div className="p-3 sm:p-4 space-y-3">
                    <div className={`${linea} h-4 w-2/3`}></div>
                    <div className={`${linea} h-2.5 w-full`}></div>
                    <div className={`${linea} h-2.5 w-5/6`}></div>
                    <div className="flex items-center gap-2 pt-1">
                        <span className="inline-flex items-center gap-2 rounded-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 shadow-sm px-3 py-1.5">
                            <i className="fa-solid fa-star text-brand-green text-sm"></i>
                            <span className="text-xs font-bold text-gray-800 dark:text-gray-100">{nota}</span>
                            <span className="text-[11px] text-gray-500 dark:text-gray-400">{t(`${K}lockWidBadgeLabel`)}</span>
                        </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <MockReview textKey="lockExampleReview1" stars={5} />
                        <div className="hidden sm:block"><MockReview textKey="lockExampleReview2" stars={4.5} /></div>
                    </div>
                    <div className={`${linea} h-2.5 w-3/4`}></div>
                </div>
            </div>
        </ExampleFrame>
    );
};

// --- Configuracion por funcion ----------------------------------------------

const FEATURES: Record<PreviewSectionId, {
    icon: string;
    nameKey: string;
    introKey: string;
    benefitKeys: [string, string, string];
    Example: React.FC;
}> = {
    analytics: {
        icon: 'fa-magnifying-glass-chart', nameKey: `${K}dashboardAnalytics`, introKey: `${K}lockAnaIntro`,
        benefitKeys: [`${K}lockAnaBenefit1`, `${K}lockAnaBenefit2`, `${K}lockAnaBenefit3`], Example: AnalyticsExample,
    },
    invitations: {
        icon: 'fa-paper-plane', nameKey: `${K}dashboardInvitations`, introKey: `${K}lockInvIntro`,
        benefitKeys: [`${K}lockInvBenefit1`, `${K}lockInvBenefit2`, `${K}lockInvBenefit3`], Example: InvitationsExample,
    },
    products: {
        icon: 'fa-box-open', nameKey: `${K}dashboardProducts`, introKey: `${K}lockProdIntro`,
        benefitKeys: [`${K}lockProdBenefit1`, `${K}lockProdBenefit2`, `${K}lockProdBenefit3`], Example: ProductsExample,
    },
    widgets: {
        icon: 'fa-puzzle-piece', nameKey: `${K}dashboardWidgets`, introKey: `${K}lockWidIntro`,
        benefitKeys: [`${K}lockWidBenefit1`, `${K}lockWidBenefit2`, `${K}lockWidBenefit3`], Example: WidgetsExample,
    },
};

// --- Planes -------------------------------------------------------------------

const PlanCards: React.FC<{ minPlan: Plan }> = ({ minPlan }) => {
    const t = useTranslation();
    const { profile } = useAuth();
    const pricingHref = usePricingHref();
    const [anualElegido, setAnual] = useState(false);
    // Sin el anual disponible en todos los planes (AVAILABLE_BILLING_CYCLES) no se
    // ofrece el interruptor: se enseña solo el pago mensual.
    const anualDisponible = isAnnualToggleAvailable();
    const anual = anualDisponible && anualElegido;

    const nivelMin = PLAN_HIERARCHY[minPlan];
    const planActual = profile?.plan ?? 'free';

    // Prueba gratuita (solo con NEW_PRICING_ENABLED): quien ya paga un plan no la ve.
    // La prueba de 3 meses es sin tarjeta y empieza al registrar la empresa (issue #11),
    // asi que los botones dicen «Elegir plan» y no se promete un primer cobro a 0 €.
    const conPrueba = NEW_PRICING_ENABLED && planActual === 'free';
    const ciclo = anual ? 'annual' : 'monthly';

    return (
        <div>
            {anualDisponible && (
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 mb-5">
                <span className={`text-sm font-semibold ${anual ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>{t('pricingPage.monthlyPayment')}</span>
                <button
                    type="button"
                    role="switch"
                    aria-checked={anual}
                    aria-label={t('pricingPage.toggleAnnual')}
                    onClick={() => setAnual(v => !v)}
                    className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 ${anual ? 'bg-brand-green' : 'bg-gray-300 dark:bg-zinc-600'}`}
                >
                    <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${anual ? 'translate-x-6' : 'translate-x-1'}`}></span>
                </button>
                <span className={`text-sm font-semibold ${anual ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>{t('pricingPage.annualPayment')}</span>
                <span className="rounded-full bg-yellow-200 text-yellow-900 text-xs font-bold px-2.5 py-0.5">{NEW_PRICING_ENABLED ? t('pricingPage.saveUpToPercent', { percent: maxAnnualSavingsPercent() }) : t('pricingPage.save25Percent')}</span>
            </div>
            )}
            {conPrueba && (
                <p className="mb-5 text-center">
                    <span className="inline-block rounded-2xl bg-green-50 dark:bg-green-900/30 text-brand-green font-bold text-sm sm:text-base px-4 py-2">
                        <i className="fa-solid fa-gift mr-2" aria-hidden="true"></i>
                        {t(anual ? 'pricingPage.trialHeadlineAnnual' : 'pricingPage.trialHeadline', {
                            months: String(TRIAL_MONTHS),
                            starter: formatAmount(priceFor('starter', ciclo), true),
                            growth: formatAmount(priceFor('growth', ciclo), true),
                            pro: formatAmount(priceFor('pro', ciclo), true),
                        })}
                    </span>
                </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 pt-3">
                {PAID_PLAN_ORDER.map((id: PaidPlanKey) => {
                    const destacado = id === minPlan;
                    const incluida = PLAN_HIERARCHY[id] >= nivelMin;
                    const esActual = planActual === id;
                    const mensual = monthlyPrice(id);
                    const total = annualPrice(id);
                    const nombre = t(planNameKey(id));
                    return (
                        <div
                            key={id}
                            className={`relative flex flex-col rounded-2xl bg-white dark:bg-zinc-800 p-5 border-2 ${destacado ? 'border-brand-green shadow-lg shadow-brand-green/20' : 'border-gray-200 dark:border-zinc-700'}`}
                        >
                            {destacado && (
                                <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-brand-green text-white text-[11px] sm:text-xs font-bold uppercase tracking-wide px-3 py-1">
                                    {t(`${K}lockPlanUnlocks`)}
                                </span>
                            )}
                            <h4 className="text-xl font-bold text-gray-900 dark:text-gray-100 text-center">{nombre}</h4>
                            <div className="text-center my-4 min-h-[4.5rem] flex flex-col justify-center">
                                {anual ? (
                                    <>
                                        <p>
                                            <span className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">€{formatAmount(total, NEW_PRICING_ENABLED)}</span>
                                            <span className="text-gray-500 dark:text-gray-400 font-medium">{t('pricingPage.perYear')}</span>
                                        </p>
                                        <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mt-1">
                                            ({t('pricingPage.equivalentToPerMonth', { price: formatAmount(total / 12, NEW_PRICING_ENABLED) })})
                                        </p>
                                    </>
                                ) : (
                                    <p>
                                        <span className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">€{formatAmount(mensual, NEW_PRICING_ENABLED)}</span>
                                        <span className="text-gray-500 dark:text-gray-400 font-medium">{t('pricingPage.perMonth')}</span>
                                    </p>
                                )}
                            </div>
                            <p className={`flex items-center justify-center gap-2 text-sm font-semibold mb-4 ${incluida ? 'text-green-700 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                <i className={`fa-solid ${incluida ? 'fa-check' : 'fa-minus'}`} aria-hidden="true"></i>
                                {incluida ? t(`${K}lockPlanIncluded`) : t(`${K}lockPlanNotIncluded`)}
                            </p>
                            <div className="mt-auto">
                                {esActual ? (
                                    <p className="text-center text-sm font-semibold text-gray-600 dark:text-gray-300 py-3">{t(`${K}lockCurrentPlan`)}</p>
                                ) : (
                                    <Link
                                        to={pricingHref}
                                        className={`block w-full text-center font-bold py-3 px-4 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-800 ${destacado ? 'bg-brand-green text-white hover:bg-opacity-90 shadow-md' : 'bg-green-50 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50'}`}
                                    >
                                        {conPrueba ? t('pricingPage.choosePlanCta') : t(`${K}lockChoosePlan`, { plan: nombre })}
                                    </Link>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            {conPrueba && (
                <p className="mt-5 text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400 max-w-3xl mx-auto">
                    {t('pricingPage.trialFooter', { months: String(TRIAL_MONTHS), days: String(TRIAL_REMINDER_DAYS) })}
                    <span className="block mt-1">{PRICES_INCLUDE_VAT ? t('pricingPage.vatIncluded') : t('pricingPage.vatExcluded')}</span>
                </p>
            )}
        </div>
    );
};

// --- Plantilla ------------------------------------------------------------------

const LockedFeaturePreview: React.FC<{ section: PreviewSectionId; minPlan: Plan }> = ({ section, minPlan }) => {
    const t = useTranslation();
    const titleId = useId();
    const { icon, nameKey, introKey, benefitKeys, Example } = FEATURES[section];
    const plan = t(planNameKey(minPlan));
    const cardClass = 'bg-white dark:bg-zinc-800 rounded-xl border dark:border-zinc-700 shadow-sm p-4 sm:p-6';

    return (
        <section aria-labelledby={titleId} className="space-y-5 sm:space-y-6">
            <div className={cardClass}>
                <p className="inline-flex items-center gap-2 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-xs sm:text-sm font-semibold px-3 py-1">
                    <i className="fa-solid fa-lock" aria-hidden="true"></i>
                    {t(`${K}sectionAvailableFrom`, { plan })}
                </p>
                <h2 id={titleId} className="mt-3 flex items-center gap-3 text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-gray-100">
                    <i className={`fa-solid ${icon} text-brand-green`} aria-hidden="true"></i>
                    <span>{t(nameKey)}</span>
                </h2>
                <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-300 max-w-3xl">{t(introKey)}</p>
            </div>

            <div className={cardClass}>
                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">{t(`${K}lockExampleHeading`)}</h3>
                <Example />
            </div>

            <div className={cardClass}>
                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">{t(`${K}lockBenefitsHeading`)}</h3>
                <ul className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                    {benefitKeys.map(key => (
                        <li key={key} className="flex items-start gap-3 text-sm sm:text-base text-gray-700 dark:text-gray-200">
                            <i className="fa-solid fa-circle-check text-brand-green mt-1 flex-shrink-0" aria-hidden="true"></i>
                            <span>{t(key)}</span>
                        </li>
                    ))}
                </ul>
            </div>

            <div className={cardClass}>
                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 text-center">{t(`${K}lockPlansHeading`)}</h3>
                <PlanCards minPlan={minPlan} />
            </div>
        </section>
    );
};

export default LockedFeaturePreview;
