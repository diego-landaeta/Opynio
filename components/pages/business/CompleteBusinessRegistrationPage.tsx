// components/pages/business/CompleteBusinessRegistrationPage.tsx

import React, { useEffect, useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { finishBusinessSignup, getUserProfile, getBusinessesForOwner, clearCache } from '../../../services/supabaseService';
import Meta from '../../Meta';
import { useNotification } from '../../../contexts/NotificationContext';
import { COUNTRIES, CATEGORIES } from '../../../constants';
import { useAuth } from '../../../contexts/AuthContext';
import { useI18n, pathTranslations, useTranslation, getLanguageForCountryCode } from '../../../contexts/i18nContext';
import { useCountry } from '../../../contexts/CountryContext';


const CompleteBusinessRegistrationPage: React.FC = () => {
    const [businessName, setBusinessName] = useState('');
    const [businessCountry, setBusinessCountry] = useState('ES');
    const [businessCategory, setBusinessCategory] = useState('');
    const [businessDescription, setBusinessDescription] = useState('');
    const [businessMapsUrl, setBusinessMapsUrl] = useState('');
    // Wizard interno de 2 pasos: 'business' (datos esenciales) → 'personalization' (categoría + extras).
    // El step indicator del top se sincroniza con esto.
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

    // Guard de acceso: esta página es la transición authenticated → business_owner.
    // SOLO debe ser accesible para users con intención explícita de signup-empresa.
    // Para todos los demás (visitantes random, business_owners ya promovidos, admins,
    // authenticated sin intent), redirige a su panel correspondiente.
    useEffect(() => {
        if (!profile) return; // ProtectedRoute ya garantiza login; espera al perfil

        // Caso 1: ya es business_owner → no necesita esta página, va a Mis Empresas.
        if (profile.role === 'business_owner') {
            navigate(`${countryPrefix}/${paths.myBusinesses}`, { replace: true });
            return;
        }

        // Caso 2: admin → directo al panel admin.
        if (profile.role === 'admin') {
            navigate('/admin/panel', { replace: true });
            return;
        }

        // Caso 3: authenticated. Solo se permite el acceso si hay alguna señal real de
        // intent de signup-empresa: ?type=business en URL, intended_role en metadata,
        // o flag/datos en localStorage del flujo de signup.
        const searchParams = new URLSearchParams(location.search);
        const hasQueryIntent = searchParams.get('type') === 'business';
        const hasMetadataIntent = user?.user_metadata?.intended_role === 'business_owner';
        const hasFlagIntent =
            localStorage.getItem('opynio_business_signup_flow') === 'true' ||
            localStorage.getItem('opynio_pending_business_data') !== null;

        if (!hasQueryIntent && !hasMetadataIntent && !hasFlagIntent) {
            console.log('[completeBusinessRegistration] no business signup intent detected, redirecting to profile');
            navigate(`${countryPrefix}/${paths.profile}`, { replace: true });
        }
    }, [profile, user, navigate, location.search, countryPrefix, paths]);

    // Pre-fill from data captured at the email-signup step so the user does not retype it.
    // Try localStorage first (same-device flow); fall back to auth user_metadata for the
    // cross-device case (user confirms email on a different browser/device).
    useEffect(() => {
        const raw = localStorage.getItem('opynio_pending_business_data');
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                if (parsed?.name) setBusinessName(parsed.name);
                if (parsed?.country) setBusinessCountry(parsed.country);
                console.log('[completeBusinessRegistration] prefilled from localStorage', parsed);
                return;
            } catch {
                console.warn('[completeBusinessRegistration] localStorage payload corrupted, removing');
                localStorage.removeItem('opynio_pending_business_data');
            }
        }

        const meta = user?.user_metadata as Record<string, any> | undefined;
        if (meta?.business_name) setBusinessName(String(meta.business_name));
        if (meta?.country) setBusinessCountry(String(meta.country));
        console.log('[completeBusinessRegistration] prefill source', {
            usedLocalStorage: false,
            usedMetadata: !!(meta?.business_name || meta?.country),
            metadataKeys: meta ? Object.keys(meta) : [],
        });
    }, [user]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        // Guard: si estamos en el paso "business" no se debe crear nada todavía.
        // Salta al paso de personalización en su lugar (esto cubre el caso de Enter en el input).
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
            setError("El nombre de la empresa no puede estar vacío.");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            console.log('[completeBusinessRegistration] submitting RPC upgrade_user_to_business_owner', {
                userId: user.id,
                businessName: businessName.trim(),
                businessCountry,
            });
            await finishBusinessSignup(user.id, {
                name: businessName.trim(),
                country: businessCountry,
                category: businessCategory.trim() || 'General',
                description: businessDescription.trim() || undefined,
                google_maps_url: businessMapsUrl.trim() || undefined,
            });
            console.log('[completeBusinessRegistration] RPC succeeded, business created and role promoted');
            localStorage.removeItem('opynio_pending_business_data');
            // El flag legacy de same-device signup también se limpia aquí (PostLoginRedirect
            // ya no lo borra hasta que el flow esté realmente completo).
            localStorage.removeItem('opynio_business_signup_flow');
            showNotification('¡Tu empresa ha sido registrada! Redirigiendo...', 'success');

            // Limpiar el cache in-memory de profile antes del re-fetch: el RPC acaba de
            // cambiar profile.role a 'business_owner' en BD, pero getUserProfile tiene
            // un cache de 60s que devolvería el profile viejo (role='authenticated')
            // y BusinessRoute rechazaría al user al navegar a /mis-negocios.
            clearCache(`profile_${user.id}`);

            // Promover el profile en el contexto INMEDIATAMENTE para que el siguiente
            // BusinessRoute (en /mis-negocios) no rechace al user antes de que llegue
            // el re-fetch. El re-fetch se hace en background para sincronizar el resto
            // de campos (plan_expires_at, etc).
            if (profile) {
                setProfile({ ...profile, role: 'business_owner' });
            }

            // Re-fetch real (en background) para sincronizar TODOS los campos.
            // Necesitamos el negocio recién creado para mandar al user a su panel.
            let newBusinessName: string | null = null;
            try {
                const [updatedProfile, newBusinesses] = await Promise.all([
                    getUserProfile(user),
                    getBusinessesForOwner(user.id),
                ]);
                if (updatedProfile) setProfile(updatedProfile);
                if (newBusinesses) {
                    setBusinesses(newBusinesses);
                    // El más reciente (el que acabamos de crear) coincide con el nombre del form.
                    const created = newBusinesses.find(b => b.name === businessName.trim()) || newBusinesses[0];
                    newBusinessName = created?.name || null;
                }
            } catch (refetchErr) {
                console.warn('[completeBusinessRegistration] re-fetch failed but role already promoted in context:', refetchErr);
            }

            // Cierra el flujo en el panel del negocio recién creado, que es el siguiente
            // paso natural de "Personalización" (logo, descripción, ubicación, etc.).
            // Si por algún motivo el re-fetch no devolvió el negocio, fallback a la
            // lista de mis-negocios.
            if (newBusinessName) {
                const dashboardPath = `${countryPrefix}/${paths.businessDashboard.replace(
                    ':businessName',
                    encodeURIComponent(newBusinessName.replace(/ /g, '_'))
                )}`;
                console.log('[completeBusinessRegistration] navigating to business panel', dashboardPath);
                navigate(dashboardPath, { replace: true });
            } else {
                const myBusinessesPath = `${countryPrefix}/${paths.myBusinesses}`;
                console.log('[completeBusinessRegistration] fallback to my businesses', myBusinessesPath);
                navigate(myBusinessesPath, { replace: true });
            }
            
        } catch (err: any) {
            setError(err.message || 'Error al completar el registro. Inténtalo de nuevo.');
            setLoading(false);
        }
    };

    // Convierte un código ISO de país en emoji bandera regional.
    const flagEmoji = (code: string) =>
        code.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)));

    const userDisplayName =
        (user?.user_metadata?.full_name as string | undefined) ||
        (user?.user_metadata?.name as string | undefined) ||
        profile?.name ||
        '';
    const firstName = userDisplayName.split(' ')[0] || '';

    return (
        <>
            <Meta
                title="Completar Registro de Empresa - Opynio"
                description="Finaliza el registro de tu empresa en Opynio para empezar a gestionar tu reputación online."
            />
            <div className="min-h-[calc(100vh-200px)] px-4 py-8 sm:py-12">
                <div className="mx-auto w-full max-w-5xl">
                    {/* Step indicator */}
                    <div className="mb-10">
                        <div className="flex items-center justify-center max-w-2xl mx-auto px-2 sm:px-4">
                            {[
                                { label: 'Cuenta', icon: 'fa-user-check', state: 'done' as const },
                                { label: 'Verificación', icon: 'fa-envelope-circle-check', state: 'done' as const },
                                {
                                    label: 'Tu empresa',
                                    icon: 'fa-building',
                                    state: (wizardStep === 'business' ? 'current' : 'done') as 'current' | 'done',
                                },
                                {
                                    label: 'Personalización',
                                    icon: 'fa-palette',
                                    state: (wizardStep === 'personalization' ? 'current' : 'pending') as 'current' | 'pending',
                                },
                                { label: 'Listo', icon: 'fa-rocket', state: 'pending' as const },
                            ].map((step, i, arr) => {
                                const isLast = i === arr.length - 1;
                                const dotClasses =
                                    step.state === 'done'
                                        ? 'bg-brand-green text-white border-brand-green'
                                        : step.state === 'current'
                                            ? 'bg-white dark:bg-zinc-800 text-brand-green border-brand-green ring-4 ring-brand-green/20 animate-pulse-soft'
                                            : 'bg-white dark:bg-zinc-800 text-gray-400 dark:text-gray-500 border-gray-300 dark:border-zinc-600';
                                const labelClasses =
                                    step.state === 'pending'
                                        ? 'text-gray-400 dark:text-gray-500'
                                        : 'text-gray-700 dark:text-gray-200 font-semibold';
                                const connectorClasses =
                                    step.state === 'done' ? 'bg-brand-green' : 'bg-gray-200 dark:bg-zinc-700';
                                return (
                                    <React.Fragment key={step.label}>
                                        <div className="flex flex-col items-center gap-2 min-w-0">
                                            <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full border-2 flex items-center justify-center transition-all ${dotClasses}`}>
                                                {step.state === 'done' ? (
                                                    <i className="fa-solid fa-check text-sm"></i>
                                                ) : (
                                                    <i className={`fa-solid ${step.icon} text-sm`}></i>
                                                )}
                                            </div>
                                            <span className={`text-[11px] sm:text-xs uppercase tracking-wider ${labelClasses} text-center whitespace-nowrap`}>
                                                {step.label}
                                            </span>
                                        </div>
                                        {!isLast && (
                                            <div className={`flex-1 h-0.5 mx-1 sm:mx-3 -mt-5 sm:-mt-6 ${connectorClasses}`}></div>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] gap-6 lg:gap-10 items-start">

                    {/* === FORM (columna principal) === */}
                    <div className="relative bg-white dark:bg-zinc-800 rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-700 overflow-hidden animate-fade-up">
                        {/* Decorative gradient bar */}
                        <div className="h-1.5 bg-gradient-to-r from-brand-green via-emerald-400 to-brand-green"></div>

                        <div className="p-6 sm:p-10">
                            {/* Hero icon + headline (cambia según paso) */}
                            <div className="flex flex-col items-center text-center">
                                <div className="w-16 h-16 rounded-2xl bg-brand-green/10 dark:bg-brand-green/20 flex items-center justify-center mb-5 ring-4 ring-brand-green/10">
                                    <i className={`fa-solid ${wizardStep === 'business' ? 'fa-building' : 'fa-palette'} text-3xl text-brand-green`}></i>
                                </div>
                                <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">
                                    {wizardStep === 'business'
                                        ? (firstName ? `¡Casi listo, ${firstName}!` : '¡Casi listo!')
                                        : 'Personaliza tu empresa'}
                                </h1>
                                <p className="mt-2 text-sm sm:text-base text-gray-500 dark:text-gray-400 max-w-sm">
                                    {wizardStep === 'business'
                                        ? 'Empezamos por lo esencial: el nombre de tu empresa y su país.'
                                        : 'Añade los detalles que quieras ahora. Todo lo demás (logo, horarios, redes…) lo edita tu desde el panel cuando quieras.'}
                                </p>
                                {user?.email && wizardStep === 'business' && (
                                    <p className="mt-3 inline-flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-zinc-900/60 px-3 py-1 rounded-full">
                                        <i className="fa-solid fa-envelope text-[10px]"></i>
                                        <span>{user.email}</span>
                                    </p>
                                )}
                            </div>

                            {error && (
                                <div className="mt-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg flex items-start gap-3" role="alert">
                                    <i className="fa-solid fa-circle-exclamation mt-0.5"></i>
                                    <span className="text-sm">{error}</span>
                                </div>
                            )}

                            {/* Banner de ayuda: aclara que TODO es editable después */}
                            <div className="mt-6 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 rounded-xl px-4 py-3 flex items-start gap-3">
                                <i className="fa-solid fa-wand-magic-sparkles text-emerald-600 dark:text-emerald-400 mt-0.5"></i>
                                <div className="text-xs sm:text-sm text-emerald-900 dark:text-emerald-200/90">
                                    <p className="font-semibold">
                                        {wizardStep === 'business' ? 'Te ayudamos a empezar con buen pie' : '¿No tienes todo a mano?'}
                                    </p>
                                    <p className="mt-0.5 text-emerald-800/80 dark:text-emerald-300/80">
                                        {wizardStep === 'business'
                                            ? 'Solo necesitamos el nombre y el país. En el siguiente paso añadirás categoría, descripción y ubicación si quieres.'
                                            : <>Sin problema, todos los campos son opcionales y podrás <strong>editarlos y ampliarlos</strong> en cualquier momento desde el panel de tu empresa.</>}
                                    </p>
                                </div>
                            </div>

                            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                                {wizardStep === 'business' && (
                                    <div className="space-y-5 animate-fade-up">
                                        {/* Section label */}
                                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 pt-1">
                                            <i className="fa-solid fa-star text-brand-green text-[10px]"></i>
                                            <span>Datos esenciales</span>
                                        </div>

                                        {/* Business name */}
                                        <div>
                                            <label htmlFor="businessName" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                                Nombre de tu empresa <span className="text-red-500">*</span>
                                            </label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none">
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
                                                    className="w-full pl-10 pr-3 py-3 text-sm sm:text-base border border-gray-300 dark:border-zinc-600 rounded-xl bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-brand-green focus:border-transparent transition-all"
                                                />
                                            </div>
                                        </div>

                                        {/* Country selector */}
                                        <div>
                                            <label htmlFor="businessCountry" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                                País de la empresa <span className="text-red-500">*</span>
                                            </label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg pointer-events-none" aria-hidden="true">
                                                    {flagEmoji(businessCountry)}
                                                </span>
                                                <select
                                                    id="businessCountry"
                                                    name="businessCountry"
                                                    value={businessCountry}
                                                    onChange={(e) => setBusinessCountry(e.target.value)}
                                                    required
                                                    className="w-full pl-11 pr-9 py-3 text-sm sm:text-base appearance-none border border-gray-300 dark:border-zinc-600 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-green focus:border-transparent transition-all"
                                                >
                                                    {COUNTRIES.map(c => (
                                                        <option key={c.code} value={c.code}>
                                                            {c.name}
                                                        </option>
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
                                        {/* Section label */}
                                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 pt-1">
                                            <i className="fa-solid fa-palette text-brand-green text-[10px]"></i>
                                            <span>Personalización (opcional)</span>
                                        </div>

                                        {/* Resumen del paso anterior */}
                                        <div className="rounded-xl bg-gray-50 dark:bg-zinc-900/40 border border-gray-200 dark:border-zinc-700 px-4 py-3 flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <i className="fa-solid fa-building text-brand-green"></i>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{businessName}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                                                        <span aria-hidden="true">{flagEmoji(businessCountry)}</span>
                                                        <span>{COUNTRIES.find(c => c.code === businessCountry)?.name || businessCountry}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setWizardStep('business')}
                                                className="text-xs font-semibold text-brand-green hover:underline flex items-center gap-1 flex-shrink-0"
                                            >
                                                <i className="fa-solid fa-pen text-[10px]"></i>
                                                Editar
                                            </button>
                                        </div>

                                        {/* Category selector */}
                                        <div>
                                            <label htmlFor="businessCategory" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                                Categoría principal
                                                <span className="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">(podrás cambiarla después)</span>
                                            </label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none">
                                                    <i className="fa-solid fa-tags"></i>
                                                </span>
                                                <select
                                                    id="businessCategory"
                                                    value={businessCategory}
                                                    onChange={(e) => setBusinessCategory(e.target.value)}
                                                    className="w-full pl-10 pr-9 py-3 text-sm sm:text-base appearance-none border border-gray-300 dark:border-zinc-600 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-green focus:border-transparent transition-all"
                                                >
                                                    <option value="">Selecciona una categoría (opcional)</option>
                                                    {categoryOptions.map(c => (
                                                        <option key={c} value={c}>{c}</option>
                                                    ))}
                                                </select>
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                                    <i className="fa-solid fa-chevron-down text-xs"></i>
                                                </span>
                                            </div>
                                            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                                                Ayuda a tus clientes a encontrarte cuando busquen por sector.
                                            </p>
                                        </div>

                                        {/* Descripción corta */}
                                        <div>
                                            <label htmlFor="businessDescription" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                                Descripción corta
                                            </label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-3 text-gray-400 dark:text-gray-500 pointer-events-none">
                                                    <i className="fa-solid fa-align-left"></i>
                                                </span>
                                                <textarea
                                                    id="businessDescription"
                                                    value={businessDescription}
                                                    onChange={(e) => setBusinessDescription(e.target.value.slice(0, 280))}
                                                    rows={3}
                                                    placeholder="En pocas palabras: ¿a qué se dedica tu empresa? ¿qué la hace especial?"
                                                    className="w-full pl-10 pr-3 py-3 text-sm border border-gray-300 dark:border-zinc-600 rounded-xl bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-brand-green focus:border-transparent transition-all resize-none"
                                                />
                                            </div>
                                            <div className="mt-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                                                <span>Aparecerá en la cabecera de tu perfil público.</span>
                                                <span className={businessDescription.length > 240 ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''}>
                                                    {businessDescription.length}/280
                                                </span>
                                            </div>
                                        </div>

                                        {/* Google Maps URL */}
                                        <div>
                                            <label htmlFor="businessMapsUrl" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                                Enlace de Google Maps
                                            </label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none">
                                                    <i className="fa-solid fa-location-dot"></i>
                                                </span>
                                                <input
                                                    id="businessMapsUrl"
                                                    type="url"
                                                    value={businessMapsUrl}
                                                    onChange={(e) => setBusinessMapsUrl(e.target.value)}
                                                    placeholder="https://maps.google.com/?q=..."
                                                    className="w-full pl-10 pr-3 py-3 text-sm border border-gray-300 dark:border-zinc-600 rounded-xl bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-brand-green focus:border-transparent transition-all"
                                                />
                                            </div>
                                            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                                                Pega el enlace para mostrar tu ubicación en el perfil.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* === Action buttons (cambian según paso) === */}
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
                                        className="group w-full bg-brand-green text-white font-bold py-3.5 rounded-xl text-base sm:text-lg shadow-lg shadow-brand-green/20 hover:shadow-xl hover:shadow-brand-green/30 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:bg-gray-400 disabled:shadow-none disabled:cursor-not-allowed disabled:translate-y-0 flex items-center justify-center gap-2"
                                    >
                                        <span>Continuar</span>
                                        <i className="fa-solid fa-arrow-right text-sm transition-transform group-hover:translate-x-1"></i>
                                    </button>
                                ) : (
                                    <div className="flex flex-col-reverse sm:flex-row gap-3">
                                        <button
                                            type="button"
                                            disabled={loading}
                                            onClick={() => {
                                                setError(null);
                                                setWizardStep('business');
                                            }}
                                            className="sm:w-1/3 py-3.5 rounded-xl text-base font-semibold border-2 border-gray-200 dark:border-zinc-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
                                        >
                                            <i className="fa-solid fa-arrow-left text-sm"></i>
                                            <span>Atrás</span>
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="group flex-1 bg-brand-green text-white font-bold py-3.5 rounded-xl text-base sm:text-lg shadow-lg shadow-brand-green/20 hover:shadow-xl hover:shadow-brand-green/30 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:bg-gray-400 disabled:shadow-none disabled:cursor-not-allowed disabled:translate-y-0 flex items-center justify-center gap-2"
                                        >
                                            {loading ? (
                                                <>
                                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                    <span>Creando empresa…</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span>Finalizar registro</span>
                                                    <i className="fa-solid fa-rocket text-sm transition-transform group-hover:translate-x-1"></i>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}

                                {/* Saltar — finaliza el registro con los campos opcionales como estén ahora */}
                                {wizardStep === 'personalization' && !loading && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            const form = (e.currentTarget as HTMLButtonElement).closest('form');
                                            form?.requestSubmit();
                                        }}
                                        className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-brand-green dark:hover:text-brand-green underline-offset-2 hover:underline transition-colors"
                                    >
                                        Saltar y rellenarlo después desde el panel
                                    </button>
                                )}

                                {/* Trust badges */}
                                <div className="pt-3 grid grid-cols-3 gap-3 text-center text-xs text-gray-500 dark:text-gray-400">
                                    <div className="flex flex-col items-center gap-1">
                                        <i className="fa-solid fa-lock text-brand-green text-base"></i>
                                        <span>Conexión segura</span>
                                    </div>
                                    <div className="flex flex-col items-center gap-1">
                                        <i className="fa-solid fa-shield-halved text-brand-green text-base"></i>
                                        <span>Datos protegidos</span>
                                    </div>
                                    <div className="flex flex-col items-center gap-1">
                                        <i className="fa-solid fa-bolt text-brand-green text-base"></i>
                                        <span>Listo en segundos</span>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* === COLUMNA LATERAL (info) === */}
                    <aside className="space-y-6 lg:sticky lg:top-24">
                        {/* Qué pasa después */}
                        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-gray-100 dark:border-zinc-700 p-6 shadow-sm">
                            <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-gray-100">
                                <i className="fa-solid fa-list-check text-brand-green"></i>
                                ¿Qué pasa al finalizar?
                            </h2>
                            <ol className="mt-4 space-y-4">
                                <li className="flex gap-3">
                                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-green/10 text-brand-green text-xs font-bold flex items-center justify-center">1</span>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Creamos tu perfil de empresa</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Tu negocio queda visible y listo para recibir reseñas.</p>
                                    </div>
                                </li>
                                <li className="flex gap-3">
                                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-green/10 text-brand-green text-xs font-bold flex items-center justify-center">2</span>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Personalizas tu perfil</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Desde el panel de tu empresa podrás editar y ampliar todo: logo, horarios, categorías, redes sociales y más.</p>
                                    </div>
                                </li>
                                <li className="flex gap-3">
                                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-green/10 text-brand-green text-xs font-bold flex items-center justify-center">3</span>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Empiezas a recibir reseñas</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Comparte tu enlace o invita a tus clientes desde el panel.</p>
                                    </div>
                                </li>
                            </ol>
                        </div>

                        {/* Plan Free incluido */}
                        <div className="bg-gradient-to-br from-brand-green/5 to-emerald-50 dark:from-brand-green/10 dark:to-zinc-800 rounded-2xl border border-brand-green/20 dark:border-brand-green/30 p-6">
                            <div className="flex items-center justify-between">
                                <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-gray-100">
                                    <i className="fa-solid fa-gift text-brand-green"></i>
                                    Tu plan Free incluye
                                </h2>
                                <span className="text-xs font-semibold uppercase tracking-wider bg-brand-green text-white px-2 py-0.5 rounded">Gratis</span>
                            </div>
                            <ul className="mt-4 space-y-2.5 text-sm text-gray-700 dark:text-gray-300">
                                <li className="flex items-start gap-2">
                                    <i className="fa-solid fa-check text-brand-green mt-1 text-xs"></i>
                                    <span>1 perfil de empresa público</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <i className="fa-solid fa-check text-brand-green mt-1 text-xs"></i>
                                    <span>Reseñas ilimitadas de tus clientes</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <i className="fa-solid fa-check text-brand-green mt-1 text-xs"></i>
                                    <span>Responder a las reseñas</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <i className="fa-solid fa-check text-brand-green mt-1 text-xs"></i>
                                    <span>Estadísticas básicas</span>
                                </li>
                            </ul>
                            <ReactRouterDOM.Link
                                to={`${countryPrefix}/${paths.pricing}`}
                                className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-green hover:underline"
                            >
                                <i className="fa-solid fa-rocket"></i>
                                ¿Necesitas más? Mira los planes premium
                                <i className="fa-solid fa-arrow-right text-[10px]"></i>
                            </ReactRouterDOM.Link>
                        </div>

                        {/* Tip */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800/50 p-5">
                            <div className="flex gap-3">
                                <i className="fa-solid fa-pen-to-square text-blue-500 dark:text-blue-400 mt-0.5"></i>
                                <div>
                                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">Todo es editable después</p>
                                    <p className="text-xs text-blue-800/80 dark:text-blue-300/80 mt-1">
                                        Nombre, país, categoría, descripción, logo, ubicación, horarios, redes… Cuando quieras, ve a <strong>Mi empresa → Editar perfil</strong> y cámbialo en segundos.
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
                    0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.35); }
                    50% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
                }
                .animate-pulse-soft { animation: pulse-soft 2s ease-in-out infinite; }
            `}</style>
        </>
    );
};

export default CompleteBusinessRegistrationPage;