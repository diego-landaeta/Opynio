// components/pages/business/CompleteBusinessRegistrationPage.tsx
//
// Wizard de onboarding para usuarios que se convierten en empresa.
// Estética Opynio coherente con PlanActivatedModal y email templates:
//   • Hero verde gradient envolviendo el step indicator
//   • Card flotante con sombra coloreada brand-green
//   • Animación de transición entre sub-pasos
//   • Live preview de la empresa en columna lateral
//   • Eyebrow uppercase + tipografía mismo lenguaje

import React, { useEffect, useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { finishBusinessSignup, getUserProfile, getBusinessesForOwner, clearCache } from '../../../services/supabaseService';
import Meta from '../../Meta';
import { useNotification } from '../../../contexts/NotificationContext';
import { COUNTRIES, CATEGORIES } from '../../../constants';
import { useAuth } from '../../../contexts/AuthContext';
import { useI18n, pathTranslations, useTranslation, getLanguageForCountryCode } from '../../../contexts/i18nContext';
import { useCountry } from '../../../contexts/CountryContext';
import { triggerPlanActivatedModal } from '../../PlanActivatedModal';


const CompleteBusinessRegistrationPage: React.FC = () => {
    const [businessName, setBusinessName] = useState('');
    const [businessCountry, setBusinessCountry] = useState('ES');
    const [businessCategory, setBusinessCategory] = useState('');
    const [businessDescription, setBusinessDescription] = useState('');
    const [businessMapsUrl, setBusinessMapsUrl] = useState('');
    const [wizardStep, setWizardStep] = useState<'business' | 'personalization'>('business');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const categoryOptions = Object.keys(CATEGORIES);
    const { showNotification } = useNotification();
    const navigate = ReactRouterDOM.useNavigate();
    const location = ReactRouterDOM.useLocation();
    const { user, profile, setProfile, setBusinesses } = useAuth();
    const { language } = useI18n();
    const { country } = useCountry();
    const t = useTranslation();

    const countryPrefix = country ? `/${country.toLowerCase()}` : '';
    const pathLang = country ? getLanguageForCountryCode(country) : language;
    const paths = pathTranslations[pathLang] || pathTranslations.es;

    // Guard de acceso (sin cambios funcionales).
    useEffect(() => {
        if (!profile) return;
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
                setError('Indica el nombre de tu empresa para continuar.');
                return;
            }
            setError(null);
            setWizardStep('personalization');
            return;
        }
        if (!user) {
            setError('No hay una sesión activa. Vuelve a iniciar sesión e inténtalo de nuevo.');
            return;
        }
        if (!businessName.trim()) {
            setError('El nombre de la empresa no puede estar vacío.');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            await finishBusinessSignup(user.id, {
                name: businessName.trim(),
                country: businessCountry,
                category: businessCategory.trim() || 'General',
                description: businessDescription.trim() || undefined,
                google_maps_url: businessMapsUrl.trim() || undefined,
            });
            localStorage.removeItem('opynio_pending_business_data');
            localStorage.removeItem('opynio_business_signup_flow');
            triggerPlanActivatedModal('free');
            showNotification('¡Tu empresa ha sido registrada! Redirigiendo...', 'success');

            clearCache(`profile_${user.id}`);
            if (profile) {
                setProfile({ ...profile, role: 'business_owner' });
            }

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

            if (newBusinessName) {
                const dashboardPath = `${countryPrefix}/${paths.businessDashboard.replace(
                    ':businessName',
                    encodeURIComponent(newBusinessName.replace(/ /g, '_'))
                )}`;
                navigate(dashboardPath, { replace: true });
            } else {
                navigate(`${countryPrefix}/${paths.myBusinesses}`, { replace: true });
            }
        } catch (err: any) {
            setError(err.message || 'Error al completar el registro. Inténtalo de nuevo.');
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

    const userDisplayName =
        (user?.user_metadata?.full_name as string | undefined) ||
        (user?.user_metadata?.name as string | undefined) ||
        profile?.name ||
        '';
    const firstName = userDisplayName.split(' ')[0] || '';

    const STEPS = [
        { label: 'Cuenta', icon: 'fa-user-check', done: true, current: false },
        { label: 'Verificación', icon: 'fa-envelope-circle-check', done: true, current: false },
        { label: 'Tu empresa', icon: 'fa-building', done: wizardStep !== 'business', current: wizardStep === 'business' },
        { label: 'Personalización', icon: 'fa-palette', done: false, current: wizardStep === 'personalization' },
        { label: 'Listo', icon: 'fa-rocket', done: false, current: false },
    ];

    return (
        <>
            <Meta
                title="Completa el registro de tu empresa - Opynio"
                description="Finaliza el registro de tu empresa en Opynio para empezar a gestionar tu reputación online."
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
                            Registro de empresa
                        </p>
                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white leading-tight tracking-tight">
                            {firstName ? `¡Casi listo, ${firstName}!` : '¡Vamos a registrar tu empresa!'}
                        </h1>
                        <p className="mt-3 text-sm sm:text-base text-white/85 max-w-xl mx-auto">
                            Solo nos faltan unos datos. En menos de 2 minutos tendrás tu negocio en Opynio.
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
                                            Paso {wizardStep === 'business' ? '1 de 2' : '2 de 2'}
                                        </p>
                                        <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight mt-0.5">
                                            {wizardStep === 'business' ? 'Datos esenciales' : 'Personaliza tu empresa'}
                                        </h2>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                            {wizardStep === 'business'
                                                ? 'Empezamos por lo más importante: nombre y país.'
                                                : 'Añade lo que tengas a mano. Todo es editable después.'}
                                        </p>
                                    </div>
                                </div>

                                {error && (
                                    <div className="mb-5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl flex items-start gap-3 animate-fade-up" role="alert">
                                        <i className="fa-solid fa-circle-exclamation mt-0.5"></i>
                                        <span className="text-sm">{error}</span>
                                    </div>
                                )}

                                <form onSubmit={handleSubmit} className="space-y-5">
                                    {wizardStep === 'business' && (
                                        <div className="space-y-5 animate-fade-up">
                                            {/* Nombre */}
                                            <div>
                                                <label htmlFor="businessName" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                                    Nombre de tu empresa <span className="text-red-500">*</span>
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
                                                    País <span className="text-red-500">*</span>
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
                                                            <option key={c.code} value={c.code}>{c.name}</option>
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
                                                            <span>{COUNTRIES.find(c => c.code === businessCountry)?.name || businessCountry}</span>
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className="text-xs font-semibold text-brand-green group-hover:underline flex items-center gap-1 flex-shrink-0">
                                                    <i className="fa-solid fa-pen text-[10px]"></i>
                                                    Editar
                                                </span>
                                            </button>

                                            {/* Categoría */}
                                            <div>
                                                <label htmlFor="businessCategory" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                                    Categoría principal
                                                    <span className="ml-2 text-xs font-normal text-gray-400">(opcional)</span>
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
                                                        <option value="">Selecciona una categoría</option>
                                                        {categoryOptions.map(c => (
                                                            <option key={c} value={c}>{c}</option>
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
                                                    Descripción corta
                                                    <span className="ml-2 text-xs font-normal text-gray-400">(opcional)</span>
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
                                                        placeholder="¿A qué se dedica tu empresa? ¿Qué la hace especial?"
                                                        className="w-full pl-11 pr-3 py-3.5 text-sm border border-gray-300 dark:border-zinc-600 rounded-xl bg-white dark:bg-zinc-900/40 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-brand-green focus:border-transparent transition-all resize-none"
                                                    />
                                                </div>
                                                <div className="mt-1.5 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                                                    <span>Aparecerá en tu perfil público.</span>
                                                    <span className={businessDescription.length > 240 ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''}>
                                                        {businessDescription.length}/280
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Maps URL */}
                                            <div>
                                                <label htmlFor="businessMapsUrl" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                                    Enlace de Google Maps
                                                    <span className="ml-2 text-xs font-normal text-gray-400">(opcional)</span>
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
                                                    setError('Indica el nombre de tu empresa para continuar.');
                                                    return;
                                                }
                                                setError(null);
                                                setWizardStep('personalization');
                                            }}
                                            className="group w-full bg-gradient-to-r from-emerald-500 to-brand-green text-white font-bold py-4 rounded-xl text-base sm:text-lg shadow-lg shadow-brand-green/30 hover:shadow-xl hover:shadow-brand-green/40 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:from-gray-400 disabled:to-gray-400 disabled:shadow-none disabled:cursor-not-allowed disabled:translate-y-0 flex items-center justify-center gap-2 mt-2"
                                        >
                                            <span>Continuar</span>
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
                                                <span>Atrás</span>
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={loading}
                                                className="group flex-1 bg-gradient-to-r from-emerald-500 to-brand-green text-white font-bold py-4 rounded-xl text-base sm:text-lg shadow-lg shadow-brand-green/30 hover:shadow-xl hover:shadow-brand-green/40 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:from-gray-400 disabled:to-gray-400 disabled:shadow-none disabled:cursor-not-allowed disabled:translate-y-0 flex items-center justify-center gap-2"
                                            >
                                                {loading ? (
                                                    <>
                                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                        <span>Creando empresa…</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <i className="fa-solid fa-rocket text-sm transition-transform group-hover:-translate-y-0.5"></i>
                                                        <span>Finalizar registro</span>
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
                                            Saltar y rellenarlo después
                                        </button>
                                    )}

                                    {/* Trust badges */}
                                    <div className="pt-5 mt-2 border-t border-gray-100 dark:border-zinc-700/50 grid grid-cols-3 gap-3 text-center">
                                        {[
                                            { icon: 'fa-lock', label: 'Conexión segura' },
                                            { icon: 'fa-shield-halved', label: 'Datos protegidos' },
                                            { icon: 'fa-bolt', label: 'Listo en segundos' },
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
                                            Vista previa
                                        </span>
                                    </div>
                                    <div className="p-5">
                                        <div className="flex items-start gap-3">
                                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-green/20 to-emerald-500/20 flex items-center justify-center flex-shrink-0">
                                                <CountryFlag code={businessCountry} size="lg" />
                                            </div>
                                            <div className="min-w-0 flex-grow">
                                                <p className="font-bold text-gray-800 dark:text-gray-100 truncate">
                                                    {businessName || 'Tu empresa'}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                                                    {businessCategory || 'Sin categoría'} · {COUNTRIES.find(c => c.code === businessCountry)?.name || businessCountry}
                                                </p>
                                                {/* Star rating placeholder */}
                                                <div className="flex items-center gap-0.5 mt-1.5">
                                                    {[1,2,3,4,5].map(n => (
                                                        <i key={n} className="fa-solid fa-star text-gray-300 dark:text-zinc-600 text-xs"></i>
                                                    ))}
                                                    <span className="text-[11px] text-gray-400 ml-1.5">Aún sin reseñas</span>
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
                                        Plan Free incluido
                                    </h3>
                                    <span className="text-[10px] font-bold uppercase tracking-wider bg-brand-green text-white px-2 py-0.5 rounded-full">Gratis</span>
                                </div>
                                <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                                    {[
                                        '1 perfil de empresa público',
                                        'Reseñas ilimitadas',
                                        'Responder a tus reseñas',
                                        'Estadísticas básicas',
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
                                    Ver planes premium
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
                                        <p className="text-xs font-semibold text-blue-900 dark:text-blue-200">¿Sabías que...?</p>
                                        <p className="text-xs text-blue-800/85 dark:text-blue-300/80 mt-1">
                                            Todo es editable después: logo, horarios, categoría, descripción, redes…
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
