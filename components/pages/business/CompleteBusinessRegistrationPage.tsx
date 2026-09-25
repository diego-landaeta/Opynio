// components/pages/business/CompleteBusinessRegistrationPage.tsx
//
// Wizard de onboarding para usuarios que se convierten en empresa.
// Estética Opynio coherente con PlanActivatedModal y email templates:
//   • Hero verde gradient envolviendo el step indicator
//   • Card flotante con sombra coloreada brand-green
//   • Animación de transición entre sub-pasos
//   • Live preview de la empresa en columna lateral
//   • Eyebrow uppercase + tipografía mismo lenguaje

import React, { useEffect, useRef, useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { finishBusinessSignup, getUserProfile, getBusinessesForOwner, clearCache } from '../../../services/supabaseService';
import Meta from '../../Meta';
import { useNotification } from '../../../contexts/NotificationContext';
import { COUNTRIES, CATEGORIES } from '../../../constants';
import { useAuth } from '../../../contexts/AuthContext';
import { useI18n, pathTranslations, useTranslation, getLanguageForCountryCode } from '../../../contexts/i18nContext';
import { useCountry } from '../../../contexts/CountryContext';
import { triggerPlanActivatedModal } from '../../PlanActivatedModal';
import { useCountryName } from '../../../utils/countryName';
import { getUserFacingError, useUserErrorNotifier } from '../../../utils/userFacingError';
import type { NotificationAction } from '../../../contexts/NotificationContext';


const CompleteBusinessRegistrationPage: React.FC = () => {
    const [businessName, setBusinessName] = useState('');
    const [businessCountry, setBusinessCountry] = useState('ES');
    const [businessCategory, setBusinessCategory] = useState('');
    const [businessDescription, setBusinessDescription] = useState('');
    const [businessMapsUrl, setBusinessMapsUrl] = useState('');
    const [wizardStep, setWizardStep] = useState<'business' | 'personalization'>('business');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Enlace recomendado (Soporte, Planes...) del error del servidor. Va atado al
    // texto: si otra validacion cambia `error`, el enlace deja de mostrarse.
    const [errorAction, setErrorAction] = useState<{ text: string; action: NotificationAction } | null>(null);

    const categoryOptions = Object.keys(CATEGORIES);
    const { showNotification } = useNotification();
    const { actionFor } = useUserErrorNotifier();
    const navigate = ReactRouterDOM.useNavigate();
    const location = ReactRouterDOM.useLocation();
    const { user, profile, setProfile, setBusinesses } = useAuth();
    const { language } = useI18n();
    const { country } = useCountry();
    const t = useTranslation();

    const countryPrefix = country ? `/${country.toLowerCase()}` : '';
    const pathLang = country ? getLanguageForCountryCode(country) : language;
    const paths = pathTranslations[pathLang] || pathTranslations.es;

    // Se marca justo antes de actualizar el perfil al terminar: sin esto, el guard
    // de abajo veia role=business_owner y mandaba a /mis-negocios antes de que la
    // navegacion al panel llegara (rebote /panel -> /mis-negocios).
    const acabaDeTerminarRef = useRef(false);

    // Guard de acceso.
    useEffect(() => {
        if (!profile) return;
        if (acabaDeTerminarRef.current) return;
        if (profile.role === 'business_owner') {
            navigate(`${countryPrefix}/${paths.myBusinesses}`, { replace: true });
            return;
        }
        if (profile.role === 'admin') {
            navigate('/admin/panel', { replace: true });
            return;
        }
        const searchParams = new URLSearchParams(location.search);
        const hasQueryIntent = searchParams.get('type') === 'business';
        const hasMetadataIntent = user?.user_metadata?.intended_role === 'business_owner';
        const hasFlagIntent =
            localStorage.getItem('opynio_business_signup_flow') === 'true' ||
            localStorage.getItem('opynio_pending_business_data') !== null;

        if (!hasQueryIntent && !hasMetadataIntent && !hasFlagIntent) {
            navigate(`${countryPrefix}/${paths.profile}`, { replace: true });
        }
    }, [profile, user, navigate, location.search, countryPrefix, paths]);

    // Pre-fill desde localStorage o user metadata.
    useEffect(() => {
        const raw = localStorage.getItem('opynio_pending_business_data');
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                if (parsed?.name) setBusinessName(parsed.name);
                if (parsed?.country) setBusinessCountry(parsed.country);
                return;
            } catch {
                localStorage.removeItem('opynio_pending_business_data');
            }
        }
        const meta = user?.user_metadata as Record<string, any> | undefined;
        if (meta?.business_name) setBusinessName(String(meta.business_name));
        if (meta?.country) setBusinessCountry(String(meta.country));
    }, [user]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (wizardStep === 'business') {
            if (!businessName.trim()) {
                setError(t('businessWizard.errNameRequired'));
                return;
            }
            setError(null);
            setWizardStep('personalization');
            return;
        }
        if (!user) {
            setError(t('businessWizard.errNoSession'));
            return;
        }
        if (!businessName.trim()) {
            setError(t('businessWizard.errNameEmpty'));
            return;
        }
        setLoading(true);
        setError(null);
        try {
            await finishBusinessSignup(user.id, {
                name: businessName.trim(),
                country: businessCountry,
                category: businessCategory.trim() || 'Sectores Emergentes y Otros', // "General" no es una categoria (se veia cruda)
                description: businessDescription.trim() || undefined,
                google_maps_url: businessMapsUrl.trim() || undefined,
            });
            localStorage.removeItem('opynio_pending_business_data');
            localStorage.removeItem('opynio_business_signup_flow');
            triggerPlanActivatedModal('free');
            showNotification(t('businessWizard.registered'), 'success');

            clearCache(`profile_${user.id}`);
            acabaDeTerminarRef.current = true;
            if (profile) {
                setProfile({ ...profile, role: 'business_owner' });
            }
            // Prefijo del pais que eligio en el asistente. Sin pais en el contexto la
            // URL salia sin /es y aparecia el selector de idioma encima del modal
            // de bienvenida.
            const paisElegido = (businessCountry || country || 'ES').toLowerCase();
            const rutasPais = pathTranslations[getLanguageForCountryCode(paisElegido.toUpperCase())] || pathTranslations.es;
            const prefijo = `/${paisElegido}`;

            // Venia de elegir un plan de pago en /planes: a completar el pago.
            let planPendiente: { plan: string; billingCycle: string } | null = null;
            try {
                planPendiente = JSON.parse(localStorage.getItem('opynio_pending_plan') || 'null');
            } catch { planPendiente = null; }
            localStorage.removeItem('opynio_pending_plan');

            let newBusinessName: string | null = null;
            try {
                const [updatedProfile, newBusinesses] = await Promise.all([
                    getUserProfile(user),
                    getBusinessesForOwner(user.id),
                ]);
                if (updatedProfile) setProfile(updatedProfile);
                if (newBusinesses) {
                    setBusinesses(newBusinesses);
                    const created = newBusinesses.find(b => b.name === businessName.trim()) || newBusinesses[0];
                    newBusinessName = created?.name || null;
                }
            } catch (refetchErr) {
                console.warn('[completeBusinessRegistration] re-fetch failed:', refetchErr);
            }

            if (planPendiente?.plan) {
                showNotification(t('registerPage.completePlanPayment', { plan: planPendiente.plan }), 'info');
                navigate(`${prefijo}/${rutasPais.pricing}?plan=${encodeURIComponent(planPendiente.plan)}&billingCycle=${encodeURIComponent(planPendiente.billingCycle)}`, { replace: true });
            } else if (newBusinessName) {
                const dashboardPath = `${prefijo}/${rutasPais.businessDashboard.replace(
                    ':businessName',
                    encodeURIComponent(newBusinessName.replace(/ /g, '_'))
                )}`;
                navigate(dashboardPath, { replace: true });
            } else {
                navigate(`${prefijo}/${rutasPais.myBusinesses}`, { replace: true });
            }
        } catch (err) {
            // Antes salia el texto de Postgres («duplicate key value violates
            // unique constraint...», «Has alcanzado el límite...» solo en espanol).
            const info = await getUserFacingError(err, { flow: 'businessSignup' });
            const text = t(info.key);
            const action = actionFor(info.action);
            setError(text);
            setErrorAction(action ? { text, action } : null);
            setLoading(false);
        }
    };

    // Las banderas Regional Indicator Symbols no se renderizan en Windows
    // (muestra "US", "ES", etc. en texto plano). Usamos FlagCDN — CDN público
    // con todas las banderas ISO 3166-1 alpha-2 — para garantizar renderizado
    // consistente en todos los SO/navegadores. Wrapper con aspect-ratio fijo
    // para evitar layout shift mientras carga la imagen.
    const CountryFlag: React.FC<{ code: string; size?: 'sm' | 'md' | 'lg' }> = ({ code, size = 'md' }) => {
        const lower = code.toLowerCase();
        const dim = size === 'sm' ? { w: 16, h: 12 } : size === 'lg' ? { w: 28, h: 21 } : { w: 22, h: 16 };
        return (
            <img
                src={`https://flagcdn.com/w40/${lower}.png`}
                srcSet={`https://flagcdn.com/w80/${lower}.png 2x`}
                alt={code}
                width={dim.w}
                height={dim.h}
                loading="lazy"
                className="inline-block rounded-sm shadow-sm align-middle"
                style={{ width: `${dim.w}px`, height: `${dim.h}px`, objectFit: 'cover' }}
            />
        );
    };

    // Pais y categoria traducidos. Pais: clave del locale, si no
    // Intl.DisplayNames, si no el nombre de constants.
    const nombrePais = useCountryName();
    const nombreCategoria = (c: string) => {
        const k = `categories.${c}`;
        const v = t(k);
        return v && v !== k ? v : c;
    };

    const userDisplayName =
        (user?.user_metadata?.full_name as string | undefined) ||
        (user?.user_metadata?.name as string | undefined) ||
        profile?.name ||
        '';
    const firstName = userDisplayName.split(' ')[0] || '';

    const STEPS = [
        { label: t('businessWizard.stepAccount'), icon: 'fa-user-check', done: true, current: false },
        { label: t('businessWizard.stepVerification'), icon: 'fa-envelope-circle-check', done: true, current: false },
        { label: t('businessWizard.stepBusiness'), icon: 'fa-building', done: wizardStep !== 'business', current: wizardStep === 'business' },
        { label: t('businessWizard.stepPersonalization'), icon: 'fa-palette', done: false, current: wizardStep === 'personalization' },
        { label: t('businessWizard.stepDone'), icon: 'fa-rocket', done: false, current: false },
    ];

    return (
        <>
            <Meta
                title={t('businessWizard.metaTitle')}
                description={t('businessWizard.metaDesc')}
            />

            {/* Wrapper con margenes negativos para que el hero verde llegue a los bordes */}
            <div className="relative -mx-3 sm:-mx-4 md:-mx-6 -mt-8 sm:-mt-10 md:-mt-12 pb-12">

                {/* === HERO verde gradient con step indicator ===
                    Sin curva inferior y sin solape: el hero termina recto y las cards
                    se colocan debajo en su flujo natural. Antes intentábamos solapar
                    las cards sobre una curva inferior, pero el resultado generaba un
                    "dent" feo donde la curva chocaba con las esquinas de las cards. */}
                <div className="relative bg-gradient-to-br from-emerald-600 via-brand-green to-teal-500 px-4 pt-10 pb-12 sm:pt-16 sm:pb-16 overflow-hidden">
                    {/* Patrones decorativos radiales — varios para dar profundidad y
                        evitar la sensación de "fondo plano". */}
                    <div className="absolute inset-0 opacity-40 pointer-events-none"
                         style={{ backgroundImage: 'radial-gradient(circle at 15% 20%, rgba(255,255,255,0.22) 0%, transparent 40%), radial-gradient(circle at 85% 75%, rgba(255,255,255,0.16) 0%, transparent 40%), radial-gradient(circle at 50% 100%, rgba(16,185,129,0.35) 0%, transparent 50%)' }}>
                    </div>

                    <div className="relative max-w-4xl mx-auto text-center">
                        <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.18em] text-white/80 mb-3">
                            {t('businessWizard.eyebrow')}
                        </p>
                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white leading-tight tracking-tight">
                            {firstName ? t('businessWizard.titleWithName', { name: firstName }) : t('businessWizard.title')}
                        </h1>
                        <p className="mt-3 text-sm sm:text-base text-white/85 max-w-xl mx-auto">
                            {t('businessWizard.subtitle')}
                        </p>
                    </div>

                    {/* Step indicator integrado en el hero */}
                    <div className="relative max-w-3xl mx-auto mt-8 sm:mt-10 px-2">
                        <div className="flex items-center justify-between">
                            {STEPS.map((step, i, arr) => {
                                const isLast = i === arr.length - 1;
                                const dotClasses = step.done
                                    ? 'bg-white text-brand-green border-white shadow-lg'
                                    : step.current
                                        ? 'bg-white text-brand-green border-white ring-4 ring-white/30 animate-pulse-soft shadow-xl'
                                        : 'bg-white/10 text-white/60 border-white/30';
                                const labelClasses = step.done || step.current
                                    ? 'text-white font-semibold'
                                    : 'text-white/60';
                                const connectorClasses = step.done
                                    ? 'bg-white'
                                    : 'bg-white/25';
                                return (
                                    <React.Fragment key={step.label}>
                                        <div className="flex flex-col items-center gap-1.5 sm:gap-2 min-w-0">
                                            <div className={`w-8 h-8 sm:w-11 sm:h-11 rounded-full border-2 flex items-center justify-center transition-all ${dotClasses}`}>
                                                {step.done ? (
                                                    <i className="fa-solid fa-check text-xs sm:text-sm"></i>
                                                ) : (
                                                    <i className={`fa-solid ${step.icon} text-[10px] sm:text-sm`}></i>
                                                )}
                                            </div>
                                            {/* En mobile (xs) ocultamos labels; sólo se muestran a partir de sm
                                                para evitar texto apretado / overflow. El paso actual mantiene su
                                                label visible siempre como referencia. */}
                                            <span className={`text-[10px] sm:text-xs uppercase tracking-wider whitespace-nowrap ${labelClasses} ${step.current ? 'inline-block' : 'hidden sm:inline-block'}`}>
                                                {step.label}
                                            </span>
                                        </div>
                                        {!isLast && (
                                            <div className={`flex-1 h-0.5 mx-1 sm:mx-2 -mt-4 sm:-mt-6 transition-all ${connectorClasses}`}></div>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* === Cards del wizard === */}
                <div className="relative max-w-5xl mx-auto px-3 sm:px-4 mt-6 sm:mt-8">
                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] gap-5 sm:gap-6 lg:gap-8 items-start">

                        {/* === FORM (columna principal) === */}
                        <div className="relative bg-white dark:bg-zinc-800 rounded-2xl sm:rounded-3xl shadow-2xl shadow-brand-green/20 border border-gray-100 dark:border-zinc-700 overflow-hidden animate-fade-up">
                            <div className="p-5 sm:p-8 md:p-10">
                                {/* Mini-header del paso actual */}
                                <div className="flex items-start gap-4 mb-6">
                                    <div className={`flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center transition-all ${
                                        wizardStep === 'business'
                                            ? 'bg-gradient-to-br from-emerald-500 to-brand-green shadow-lg shadow-brand-green/30'
                                            : 'bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-500/30'
                                    }`}>
                                        <i className={`fa-solid ${wizardStep === 'business' ? 'fa-building' : 'fa-palette'} text-white text-xl sm:text-2xl`}></i>
                                    </div>
                                    <div className="flex-grow min-w-0">
                                        <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.14em] text-brand-green">
                                            {t('businessWizard.stepCounter', { current: wizardStep === 'business' ? 1 : 2, total: 2 })}
                                        </p>
                                        <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight mt-0.5">
                                            {wizardStep === 'business' ? t('businessWizard.essentialsTitle') : t('businessWizard.personalizeTitle')}
                                        </h2>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                            {wizardStep === 'business'
                                                ? t('businessWizard.essentialsSubtitle')
                                                : t('businessWizard.personalizeSubtitle')}
                                        </p>
                                    </div>
                                </div>

                                {error && (
                                    <div className="mb-5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl flex items-start gap-3 animate-fade-up" role="alert">
                                        <i className="fa-solid fa-circle-exclamation mt-0.5" aria-hidden="true"></i>
                                        <span className="text-sm">
                                            {error}
                                            {errorAction && errorAction.text === error && (
                                                <>
                                                    {' '}
                                                    <ReactRouterDOM.Link
                                                        to={errorAction.action.to}
                                                        className="font-semibold underline underline-offset-2 whitespace-nowrap rounded hover:text-red-900 dark:hover:text-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                                                    >
                                                        {errorAction.action.label}
                                                    </ReactRouterDOM.Link>
                                                </>
                                            )}
                                        </span>
                                    </div>
                                )}

                                <form onSubmit={handleSubmit} className="space-y-5">
                                    {wizardStep === 'business' && (
                                        <div className="space-y-5 animate-fade-up">
                                            {/* Nombre */}
                                            <div>
                                                <label htmlFor="businessName" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                                    {t('businessWizard.nameLabel')} <span className="text-red-500">*</span>
                                                </label>
                                                <div className="relative group">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 group-focus-within:text-brand-green transition-colors pointer-events-none">
                                                        <i className="fa-solid fa-briefcase"></i>
                                                    </span>
                                                    <input
                                                        id="businessName"
                                                        type="text"
                                                        value={businessName}
                                                        onChange={(e) => setBusinessName(e.target.value)}
                                                        required
                                                        autoFocus
                                                        placeholder={t('common.placeholders.businessName')}
                                                        className="w-full pl-11 pr-3 py-3.5 text-sm sm:text-base border border-gray-300 dark:border-zinc-600 rounded-xl bg-white dark:bg-zinc-900/40 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-brand-green focus:border-transparent transition-all"
                                                    />
                                                </div>
                                            </div>

                                            {/* País */}
                                            <div>
                                                <label htmlFor="businessCountry" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                                    {t('businessWizard.countryLabel')} <span className="text-red-500">*</span>
                                                </label>
                                                <div className="relative group">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true">
                                                        <CountryFlag code={businessCountry} size="md" />
                                                    </span>
                                                    <select
                                                        id="businessCountry"
                                                        value={businessCountry}
                                                        onChange={(e) => setBusinessCountry(e.target.value)}
                                                        required
                                                        className="w-full pl-12 pr-9 py-3.5 text-sm sm:text-base appearance-none border border-gray-300 dark:border-zinc-600 rounded-xl bg-white dark:bg-zinc-900/40 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-green focus:border-transparent transition-all"
                                                    >
                                                        {COUNTRIES.map(c => (
                                                            <option key={c.code} value={c.code}>{nombrePais(c.code, c.name)}</option>
                                                        ))}
                                                    </select>
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                                        <i className="fa-solid fa-chevron-down text-xs"></i>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {wizardStep === 'personalization' && (
                                        <div className="space-y-5 animate-fade-up">
                                            {/* Resumen del paso anterior, clickeable para volver */}
                                            <button
                                                type="button"
                                                onClick={() => setWizardStep('business')}
                                                className="w-full text-left rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800/40 px-4 py-3 flex items-center justify-between gap-3 hover:border-brand-green hover:shadow-sm transition-all group"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-9 h-9 rounded-lg bg-brand-green/15 flex items-center justify-center flex-shrink-0">
                                                        <i className="fa-solid fa-building text-brand-green text-sm"></i>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{businessName}</p>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mt-0.5">
                                                            <CountryFlag code={businessCountry} size="sm" />
                                                            <span>{nombrePais(businessCountry, COUNTRIES.find(c => c.code === businessCountry)?.name)}</span>
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className="text-xs font-semibold text-brand-green group-hover:underline flex items-center gap-1 flex-shrink-0">
                                                    <i className="fa-solid fa-pen text-[10px]"></i>
                                                    {t('businessWizard.edit')}
                                                </span>
                                            </button>

                                            {/* Categoría */}
                                            <div>
                                                <label htmlFor="businessCategory" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                                    {t('businessWizard.categoryLabel')}
                                                    <span className="ml-2 text-xs font-normal text-gray-400">{t('businessWizard.optional')}</span>
                                                </label>
                                                <div className="relative group">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 group-focus-within:text-brand-green transition-colors pointer-events-none">
                                                        <i className="fa-solid fa-tags"></i>
                                                    </span>
                                                    <select
                                                        id="businessCategory"
                                                        value={businessCategory}
                                                        onChange={(e) => setBusinessCategory(e.target.value)}
                                                        className="w-full pl-11 pr-9 py-3.5 text-sm sm:text-base appearance-none border border-gray-300 dark:border-zinc-600 rounded-xl bg-white dark:bg-zinc-900/40 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-green focus:border-transparent transition-all"
                                                    >
                                                        <option value="">{t('businessWizard.selectCategory')}</option>
                                                        {categoryOptions.map(c => (
                                                            <option key={c} value={c}>{nombreCategoria(c)}</option>
                                                        ))}
                                                    </select>
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                                        <i className="fa-solid fa-chevron-down text-xs"></i>
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Descripción */}
                                            <div>
                                                <label htmlFor="businessDescription" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                                    {t('businessWizard.descriptionLabel')}
                                                    <span className="ml-2 text-xs font-normal text-gray-400">{t('businessWizard.optional')}</span>
                                                </label>
                                                <div className="relative group">
                                                    <span className="absolute left-3 top-3 text-gray-400 dark:text-gray-500 group-focus-within:text-brand-green transition-colors pointer-events-none">
                                                        <i className="fa-solid fa-align-left"></i>
                                                    </span>
                                                    <textarea
                                                        id="businessDescription"
                                                        value={businessDescription}
                                                        onChange={(e) => setBusinessDescription(e.target.value.slice(0, 280))}
                                                        rows={3}
                                                        placeholder={t('businessWizard.descriptionPlaceholder')}
                                                        className="w-full pl-11 pr-3 py-3.5 text-sm border border-gray-300 dark:border-zinc-600 rounded-xl bg-white dark:bg-zinc-900/40 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-brand-green focus:border-transparent transition-all resize-none"
                                                    />
                                                </div>
                                                <div className="mt-1.5 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                                                    <span>{t('businessWizard.descriptionHint')}</span>
                                                    <span className={businessDescription.length > 240 ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''}>
                                                        {businessDescription.length}/280
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Maps URL */}
                                            <div>
                                                <label htmlFor="businessMapsUrl" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                                    {t('businessWizard.mapsLabel')}
                                                    <span className="ml-2 text-xs font-normal text-gray-400">{t('businessWizard.optional')}</span>
                                                </label>
                                                <div className="relative group">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 group-focus-within:text-brand-green transition-colors pointer-events-none">
                                                        <i className="fa-solid fa-location-dot"></i>
                                                    </span>
                                                    <input
                                                        id="businessMapsUrl"
                                                        type="url"
                                                        value={businessMapsUrl}
                                                        onChange={(e) => setBusinessMapsUrl(e.target.value)}
                                                        placeholder="https://maps.google.com/?q=..."
                                                        className="w-full pl-11 pr-3 py-3.5 text-sm border border-gray-300 dark:border-zinc-600 rounded-xl bg-white dark:bg-zinc-900/40 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-brand-green focus:border-transparent transition-all"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* === Action buttons === */}
                                    {wizardStep === 'business' ? (
                                        <button
                                            type="button"
                                            disabled={!businessName.trim()}
                                            onClick={() => {
                                                if (!businessName.trim()) {
                                                    setError(t('businessWizard.errNameRequired'));
                                                    return;
                                                }
                                                setError(null);
                                                setWizardStep('personalization');
                                            }}
                                            className="group w-full bg-gradient-to-r from-emerald-500 to-brand-green text-white font-bold py-4 rounded-xl text-base sm:text-lg shadow-lg shadow-brand-green/30 hover:shadow-xl hover:shadow-brand-green/40 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:from-gray-400 disabled:to-gray-400 disabled:shadow-none disabled:cursor-not-allowed disabled:translate-y-0 flex items-center justify-center gap-2 mt-2"
                                        >
                                            <span>{t('businessWizard.continue')}</span>
                                            <i className="fa-solid fa-arrow-right text-sm transition-transform group-hover:translate-x-1"></i>
                                        </button>
                                    ) : (
                                        <div className="flex flex-col-reverse sm:flex-row gap-3 mt-2">
                                            <button
                                                type="button"
                                                disabled={loading}
                                                onClick={() => {
                                                    setError(null);
                                                    setWizardStep('business');
                                                }}
                                                className="sm:w-1/3 py-4 rounded-xl text-base font-semibold border-2 border-gray-200 dark:border-zinc-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
                                            >
                                                <i className="fa-solid fa-arrow-left text-sm"></i>
                                                <span>{t('businessWizard.back')}</span>
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={loading}
                                                className="group flex-1 bg-gradient-to-r from-emerald-500 to-brand-green text-white font-bold py-4 rounded-xl text-base sm:text-lg shadow-lg shadow-brand-green/30 hover:shadow-xl hover:shadow-brand-green/40 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:from-gray-400 disabled:to-gray-400 disabled:shadow-none disabled:cursor-not-allowed disabled:translate-y-0 flex items-center justify-center gap-2"
                                            >
                                                {loading ? (
                                                    <>
                                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                        <span>{t('businessWizard.creating')}</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <i className="fa-solid fa-rocket text-sm transition-transform group-hover:-translate-y-0.5"></i>
                                                        <span>{t('businessWizard.finish')}</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}

                                    {wizardStep === 'personalization' && !loading && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                const form = (e.currentTarget as HTMLButtonElement).closest('form');
                                                form?.requestSubmit();
                                            }}
                                            className="block mx-auto text-sm text-gray-500 dark:text-gray-400 hover:text-brand-green transition-colors underline-offset-4 hover:underline"
                                        >
                                            {t('businessWizard.skip')}
                                        </button>
                                    )}

                                    {/* Trust badges */}
                                    <div className="pt-5 mt-2 border-t border-gray-100 dark:border-zinc-700/50 grid grid-cols-3 gap-3 text-center">
                                        {[
                                            { icon: 'fa-lock', label: t('businessWizard.trustSecure') },
                                            { icon: 'fa-shield-halved', label: t('businessWizard.trustProtected') },
                                            { icon: 'fa-bolt', label: t('businessWizard.trustFast') },
                                        ].map(b => (
                                            <div key={b.label} className="flex flex-col items-center gap-1.5">
                                                <div className="w-9 h-9 rounded-full bg-brand-green/10 flex items-center justify-center">
                                                    <i className={`fa-solid ${b.icon} text-brand-green text-sm`}></i>
                                                </div>
                                                <span className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium">{b.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </form>
                            </div>
                        </div>

                        {/* === COLUMNA LATERAL (preview + info) === */}
                        <aside className="space-y-5 lg:sticky lg:top-24">
                            {/* === Live preview de la empresa ===
                                Sólo se muestra en el paso de personalización: en el paso 1
                                el usuario aún está rellenando datos esenciales y la preview
                                tendría poco contenido. animate-fade-up para que aparezca
                                con suavidad cuando el wizard cambia de paso. */}
                            {wizardStep === 'personalization' && (
                                <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-lg shadow-brand-green/5 border border-gray-100 dark:border-zinc-700 overflow-hidden animate-fade-up">
                                    <div className="bg-gradient-to-br from-brand-green to-emerald-600 px-5 py-3 flex items-center gap-2">
                                        <i className="fa-solid fa-eye text-white/90 text-xs"></i>
                                        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/90">
                                            {t('businessWizard.preview')}
                                        </span>
                                    </div>
                                    <div className="p-5">
                                        <div className="flex items-start gap-3">
                                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-green/20 to-emerald-500/20 flex items-center justify-center flex-shrink-0">
                                                <i className="fa-solid fa-building text-brand-green text-xl"></i>
                                            </div>
                                            <div className="min-w-0 flex-grow">
                                                <p className="font-bold text-gray-800 dark:text-gray-100 truncate">
                                                    {businessName || t('businessWizard.previewNamePlaceholder')}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                                                    {businessCategory ? nombreCategoria(businessCategory) : t('businessWizard.previewNoCategory')} · {nombrePais(businessCountry, COUNTRIES.find(c => c.code === businessCountry)?.name)}
                                                </p>
                                                {/* Star rating placeholder */}
                                                <div className="flex items-center gap-0.5 mt-1.5">
                                                    {[1,2,3,4,5].map(n => (
                                                        <i key={n} className="fa-solid fa-star text-gray-300 dark:text-zinc-600 text-xs"></i>
                                                    ))}
                                                    <span className="text-[11px] text-gray-400 ml-1.5">{t('businessWizard.previewNoReviews')}</span>
                                                </div>
                                            </div>
                                        </div>
                                        {businessDescription && (
                                            <p className="mt-3 pt-3 border-t border-gray-100 dark:border-zinc-700 text-xs text-gray-600 dark:text-gray-300 line-clamp-3">
                                                {businessDescription}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* === Plan Free incluido ===
                                Fondo neutro (blanco / zinc-800) con accent verde solo en
                                ribbon superior y border. Antes era gradient emerald-50 →
                                teal-50 que en dark mode se mezclaba con el verde del hero
                                y creaba un efecto de "recorte" feo. */}
                            <div className="relative bg-white dark:bg-zinc-800 rounded-2xl border border-gray-100 dark:border-zinc-700 shadow-lg shadow-brand-green/5 overflow-hidden">
                                {/* Ribbon superior verde como acento */}
                                <div className="h-1 bg-gradient-to-r from-emerald-400 via-brand-green to-teal-400"></div>
                                <div className="p-5">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-gray-100">
                                        <i className="fa-solid fa-gift text-brand-green"></i>
                                        {t('businessWizard.freeIncluded')}
                                    </h3>
                                    <span className="text-[10px] font-bold uppercase tracking-wider bg-brand-green text-white px-2 py-0.5 rounded-full">{t('businessWizard.freeBadge')}</span>
                                </div>
                                <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                                    {[
                                        t('businessWizard.freeFeature1'),
                                        t('businessWizard.freeFeature2'),
                                        t('businessWizard.freeFeature3'),
                                        t('businessWizard.freeFeature4'),
                                    ].map(f => (
                                        <li key={f} className="flex items-start gap-2">
                                            <i className="fa-solid fa-check text-brand-green mt-1 text-xs"></i>
                                            <span>{f}</span>
                                        </li>
                                    ))}
                                </ul>
                                <ReactRouterDOM.Link
                                    to={`${countryPrefix}/${paths.pricing}`}
                                    className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-green hover:underline"
                                >
                                    {t('businessWizard.seePremiumPlans')}
                                    <i className="fa-solid fa-arrow-right text-[10px]"></i>
                                </ReactRouterDOM.Link>
                                </div>
                            </div>

                            {/* === Tip === */}
                            <div className="bg-blue-50 dark:bg-blue-900/15 rounded-2xl border border-blue-100 dark:border-blue-800/30 p-4">
                                <div className="flex gap-3">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                                        <i className="fa-solid fa-lightbulb text-blue-500 dark:text-blue-400 text-xs"></i>
                                    </div>
                                    <div className="flex-grow min-w-0">
                                        <p className="text-xs font-semibold text-blue-900 dark:text-blue-200">{t('businessWizard.tipTitle')}</p>
                                        <p className="text-xs text-blue-800/85 dark:text-blue-300/80 mt-1">
                                            {t('businessWizard.tipBody')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </aside>

                    </div>
                </div>
            </div>

            <style>{`
                @keyframes fade-up {
                    0% { opacity: 0; transform: translateY(12px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-up { animation: fade-up 0.4s ease-out forwards; }

                @keyframes pulse-soft {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.5); }
                    50% { box-shadow: 0 0 0 10px rgba(255,255,255,0); }
                }
                .animate-pulse-soft { animation: pulse-soft 2s ease-in-out infinite; }
            `}</style>
        </>
    );
};

export default CompleteBusinessRegistrationPage;
