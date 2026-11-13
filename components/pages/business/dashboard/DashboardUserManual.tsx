import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBusinessDashboard } from '../../../../contexts/BusinessDashboardContext';
import { useCountry } from '../../../../contexts/CountryContext';
import { useTranslation, useI18n, toBcp47, pathTranslations, getLanguageForCountryCode } from '../../../../contexts/i18nContext';
import Spinner from '../../../Spinner';
import { getHelpCenterProgress, type HelpCenterProgress } from '../../../../services/supabaseService';
import { planNameKey, hasFullAccessTrial, type DashboardSectionId } from '../../../../utils/planFeatures';
import { useDashboardSections, type DashboardSectionLink } from './useDashboardSections';

/**
 * Centro de ayuda del panel (antes «Manual de usuario», que era una lista de enlaces con una frase cada uno).
 *  1. Estado de la prueba gratuita (si la hay).
 *  2. «Empieza aquí»: pasos con progreso REAL calculado de los datos de la empresa.
 *  3. Guía por sección: para qué sirve, cómo se usa y un consejo.
 *  4. Preguntas frecuentes y contacto.
 * Todo el texto sale de businessDashboard.help.* (31 idiomas).
 */

const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900';
const CARD = 'bg-white dark:bg-zinc-800 rounded-lg sm:rounded-xl shadow-sm border border-gray-200 dark:border-zinc-700';

const GUIDE_SECTIONS: readonly DashboardSectionId[] = ['overview', 'reviews', 'analytics', 'invitations', 'products', 'widgets', 'profile'];
const FAQ_COUNT = 6;

type EstadoPaso = 'done' | 'pending' | 'unknown' | 'recommended';

const tieneHorarios = (h: unknown): boolean => !!h && typeof h === 'object' && Object.keys(h as object).length > 0;

const Insignia: React.FC<{ estado: EstadoPaso; t: (k: string) => string }> = ({ estado, t }) => {
    if (estado === 'unknown') return null;
    const cfg = {
        done: { icon: 'fa-circle-check', cls: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300', key: 'stepDone' },
        pending: { icon: 'fa-circle', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', key: 'stepPending' },
        recommended: { icon: 'fa-lightbulb', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', key: 'stepRecommended' },
    }[estado];
    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold ${cfg.cls}`}>
            <i className={`fa-solid ${cfg.icon} text-[10px]`} aria-hidden="true"></i>
            {t(`businessDashboard.help${cfg.key[0].toUpperCase()}${cfg.key.slice(1)}`)}
        </span>
    );
};

const DashboardUserManual: React.FC = () => {
    const { business, profile, adminView } = useBusinessDashboard();
    const t = useTranslation();
    const { language } = useI18n();
    const { country } = useCountry();
    const { sections, pricingHref } = useDashboardSections();
    const [progreso, setProgreso] = useState<HelpCenterProgress | null>(null);

    useEffect(() => {
        if (!business?.id) return;
        let vivo = true;
        setProgreso(null);
        getHelpCenterProgress(business.id).then(p => { if (vivo) setProgreso(p); });
        return () => { vivo = false; };
    }, [business?.id]);

    const countryPrefix = country ? `/${country.toLowerCase()}` : '';
    const paths = pathTranslations[country ? getLanguageForCountryCode(country) : language] || pathTranslations.es;
    const soporteHref = `${countryPrefix}/${paths.support}`;

    const porId = useMemo(() => {
        const m = new Map<DashboardSectionId, DashboardSectionLink>();
        sections.forEach(s => m.set(s.id, s));
        return m;
    }, [sections]);

    if (!business || !profile) {
        return <div className="flex justify-center items-center h-48 sm:h-64"><Spinner /></div>;
    }
    const th = (k: string, p?: Record<string, string | number>) => t(`businessDashboard.help${k[0].toUpperCase()}${k.slice(1)}`, p);

    // Prueba de acceso completo (sin tarjeta o con ella): días que quedan.
    const finPrueba = hasFullAccessTrial(profile) ? new Date(profile.trial_full_access_until as string) : null;
    const diasPrueba = finPrueba ? Math.max(0, Math.ceil((finPrueba.getTime() - Date.now()) / 86400000)) : 0;
    const fechaFin = finPrueba ? finPrueba.toLocaleDateString(toBcp47(language), { year: 'numeric', month: 'long', day: 'numeric' }) : '';

    const perfilCompleto = !!business.description?.trim()
        && !!(business.contact_phone || business.contact_email)
        && !!business.website_url
        && tieneHorarios(business.horarios);

    const marcar = (hecho: boolean, cifra: number | null | undefined): EstadoPaso =>
        hecho ? 'done' : (progreso && cifra !== null && cifra !== undefined ? 'pending' : 'unknown');

    const pasos: Array<{ id: DashboardSectionId; clave: string; estado: EstadoPaso }> = [
        { id: 'profile', clave: 'Profile', estado: perfilCompleto ? 'done' : 'pending' },
        // Un admin no puede leer las invitaciones del dueño (permisos de la tabla): devolvería 0 y diría «Pendiente» sin ser verdad.
        { id: 'invitations', clave: 'Invite', estado: adminView ? 'unknown' : marcar((progreso?.invitations ?? 0) > 0, progreso?.invitations) },
        { id: 'reviews', clave: 'Review', estado: marcar((progreso?.reviews ?? 0) > 0, progreso?.reviews) },
        { id: 'reviews', clave: 'Reply', estado: marcar((progreso?.responses ?? 0) > 0, progreso?.responses) },
        { id: 'widgets', clave: 'Web', estado: 'recommended' },
    ];
    // Cuentan para el progreso los pasos con seguimiento: no el recomendado (widget) ni, en la vista de admin, el de invitaciones.
    const seguidos = pasos.filter(p => p.estado !== 'recommended' && !(adminView && p.clave === 'Invite'));
    const hechos = seguidos.filter(p => p.estado === 'done').length;
    const todoListo = hechos === seguidos.length;
    const destino = (id: DashboardSectionId): string => {
        const s = porId.get(id);
        return !s || s.subpath === '.' ? '..' : `../${s.subpath}`;
    };

    return (
        <div className="space-y-5 sm:space-y-6 md:space-y-8">
            <header>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-gray-800 dark:text-gray-100">{th('title')}</h1>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">{th('subtitle')}</p>
            </header>

            {finPrueba && (
                <section aria-labelledby="help-trial" className="rounded-lg sm:rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-900/20 p-4 sm:p-5 md:p-6">
                    <h2 id="help-trial" className="text-base sm:text-lg font-bold text-blue-900 dark:text-blue-100"><i className="fa-solid fa-gift mr-2" aria-hidden="true"></i>{th('trialTitle')}</h2>
                    <p className="text-sm sm:text-base text-blue-900/90 dark:text-blue-100/90 mt-1.5">
                        {diasPrueba <= 1 ? th('trialLastDay', { date: fechaFin }) : th('trialDays', { days: diasPrueba, date: fechaFin })}
                    </p>
                    <Link to={pricingHref} className={`mt-3 inline-block text-sm font-semibold text-blue-800 dark:text-blue-200 underline hover:no-underline rounded ${FOCUS}`}>
                        {t('businessDashboard.compareAllPlans')} <i className="fa-solid fa-arrow-right ml-1" aria-hidden="true"></i>
                    </Link>
                </section>
            )}

            {/* Empieza aquí */}
            <section aria-labelledby="help-start" className={`${CARD} p-4 sm:p-5 md:p-6`}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h2 id="help-start" className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100">{th('startTitle')}</h2>
                    <span className="text-sm font-semibold text-gray-600 dark:text-gray-300" aria-live="polite">{th('progress', { done: hechos, total: seguidos.length })}</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{todoListo ? th('allDone') : th('startSubtitle')}</p>
                <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={seguidos.length}
                    aria-valuenow={hechos}
                    aria-label={th('progress', { done: hechos, total: seguidos.length })}
                    className="mt-3 h-2 rounded-full bg-gray-200 dark:bg-zinc-700 overflow-hidden"
                >
                    <div className="h-full rounded-full bg-brand-green transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${(hechos / seguidos.length) * 100}%` }} />
                </div>
                <ol className="mt-4 divide-y divide-gray-100 dark:divide-zinc-700">
                    {pasos.map((p, i) => {
                        const sec = porId.get(p.id);
                        const bloqueada = !!sec?.access.locked;
                        return (
                            <li key={`${p.clave}-${i}`} className="py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                                <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${p.estado === 'done' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-zinc-700 dark:text-gray-300'}`} aria-hidden="true">
                                    {p.estado === 'done' ? <i className="fa-solid fa-check"></i> : i + 1}
                                </span>
                                <div className="min-w-0 flex-1 basis-56">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="font-semibold text-gray-800 dark:text-gray-100">{th(`step${p.clave}Title`)}</h3>
                                        <Insignia estado={p.estado} t={t} />
                                        {bloqueada && sec && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                                <i className="fa-solid fa-lock text-[10px]" aria-hidden="true"></i>{sec.lockText}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{th(`step${p.clave}Hint`)}</p>
                                </div>
                                {p.estado !== 'done' && (
                                    <Link to={destino(p.id)} className={`px-3 py-1.5 text-sm font-semibold rounded-md border border-brand-green text-brand-green hover:bg-green-50 dark:hover:bg-zinc-700 ${FOCUS}`}>
                                        {th(`step${p.clave}Cta`)}
                                    </Link>
                                )}
                            </li>
                        );
                    })}
                </ol>
            </section>

            {/* Guía por sección */}
            <section aria-labelledby="help-guide">
                <h2 id="help-guide" className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100">{th('guideTitle')}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 mb-3">{th('guideSubtitle')}</p>
                <div className="space-y-3">
                    {GUIDE_SECTIONS.map(id => {
                        const s = porId.get(id);
                        if (!s) return null;
                        const bloqueada = s.access.locked;
                        const etiqueta = bloqueada
                            ? s.lockText
                            : s.minPlan === 'free'
                                ? t('businessDashboard.includedInAllPlans')
                                : t('businessDashboard.sectionAvailableFrom', { plan: t(planNameKey(s.minPlan)) });
                        const etiquetaCls = bloqueada
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                            : s.minPlan === 'free'
                                ? 'bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-gray-200'
                                : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
                        return (
                            <details key={id} className={`group ${CARD} open:shadow-md`}>
                                <summary className={`list-none cursor-pointer p-4 sm:p-5 flex items-center gap-3 sm:gap-4 rounded-lg sm:rounded-xl ${FOCUS}`}>
                                    <span className={`p-2.5 rounded-full flex-shrink-0 ${bloqueada ? 'text-gray-500 bg-gray-100 dark:text-gray-300 dark:bg-zinc-700' : 'text-brand-green bg-green-100 dark:bg-green-900/50'}`}>
                                        <i className={`fa-solid ${s.icon} w-5 text-center`} aria-hidden="true"></i>
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                            <span className="font-bold text-base sm:text-lg text-gray-800 dark:text-gray-100">{s.label}</span>
                                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold ${etiquetaCls}`}>
                                                {bloqueada && <i className="fa-solid fa-lock text-[10px]" aria-hidden="true"></i>}{etiqueta}
                                            </span>
                                        </span>
                                        <span className="block text-sm text-gray-600 dark:text-gray-400 mt-0.5">{th(`${id}What`)}</span>
                                    </span>
                                    <i className="fa-solid fa-chevron-down text-gray-400 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true"></i>
                                </summary>
                                <div className="px-4 sm:px-5 pb-4 sm:pb-5 pl-[4.25rem] sm:pl-[5.25rem]">
                                    <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">{th('howTo')}</h3>
                                    <ol className="mt-2 space-y-1.5 list-decimal list-outside ml-4 text-sm text-gray-700 dark:text-gray-300">
                                        <li>{th(`${id}Step1`)}</li>
                                        <li>{th(`${id}Step2`)}</li>
                                        <li>{th(`${id}Step3`)}</li>
                                    </ol>
                                    <p className="mt-3 text-sm rounded-md bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-700 px-3 py-2 text-gray-700 dark:text-gray-300">
                                        <i className="fa-regular fa-lightbulb mr-1.5 text-amber-500" aria-hidden="true"></i>
                                        <strong>{th('tipLabel')}:</strong> {th(`${id}Tip`)}
                                    </p>
                                    <Link to={destino(id)} className={`mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-green hover:underline rounded ${FOCUS}`}>
                                        {t('businessDashboard.manualGoToSection')} <i className="fa-solid fa-arrow-right text-[11px]" aria-hidden="true"></i>
                                    </Link>
                                </div>
                            </details>
                        );
                    })}
                </div>
            </section>

            {/* Preguntas frecuentes */}
            <section aria-labelledby="help-faq">
                <h2 id="help-faq" className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100 mb-3">{th('faqTitle')}</h2>
                <div className={`${CARD} divide-y divide-gray-100 dark:divide-zinc-700`}>
                    {Array.from({ length: FAQ_COUNT }, (_, i) => i + 1).map(n => (
                        <details key={n} className="group">
                            <summary className={`list-none cursor-pointer px-4 sm:px-5 py-3.5 flex items-center justify-between gap-4 font-semibold text-gray-800 dark:text-gray-100 ${FOCUS}`}>
                                <span>{th(`faq${n}Q`)}</span>
                                <i className="fa-solid fa-chevron-down text-gray-400 flex-shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true"></i>
                            </summary>
                            <p className="px-4 sm:px-5 pb-4 text-sm sm:text-base text-gray-600 dark:text-gray-400">{th(`faq${n}A`)}</p>
                        </details>
                    ))}
                </div>
            </section>

            {/* Contacto */}
            <section aria-labelledby="help-contact" className={`${CARD} p-4 sm:p-5 md:p-6 flex flex-wrap items-center justify-between gap-4`}>
                <div>
                    <h2 id="help-contact" className="text-lg font-bold text-gray-800 dark:text-gray-100">{th('contactTitle')}</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{th('contactText')}</p>
                </div>
                <Link to={soporteHref} className={`px-4 py-2 text-sm font-semibold text-white bg-brand-green rounded-lg hover:bg-opacity-90 ${FOCUS}`}>
                    <i className="fa-solid fa-headset mr-2" aria-hidden="true"></i>{th('contactCta')}
                </Link>
            </section>
        </div>
    );
};

export default DashboardUserManual;
