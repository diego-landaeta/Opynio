// components/pages/business/CompleteBusinessRegistrationPage.tsx

import React, { useEffect, useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { finishBusinessSignup, getUserProfile, getBusinessesForOwner, clearCache } from '../../../services/supabaseService';
import Meta from '../../Meta';
import { useNotification } from '../../../contexts/NotificationContext';
import { COUNTRIES } from '../../../constants';
import { useAuth } from '../../../contexts/AuthContext';
import { useI18n, pathTranslations, useTranslation, getLanguageForCountryCode } from '../../../contexts/i18nContext';
import { useCountry } from '../../../contexts/CountryContext';


const CompleteBusinessRegistrationPage: React.FC = () => {
    const [businessName, setBusinessName] = useState('');
    const [businessCountry, setBusinessCountry] = useState('ES');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { showNotification } = useNotification();
    const navigate = ReactRouterDOM.useNavigate();
    const { user, profile, setProfile, setBusinesses } = useAuth();
    const { language } = useI18n();
    const { country } = useCountry();
    const t = useTranslation();

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
                category: 'General',
            });
            console.log('[completeBusinessRegistration] RPC succeeded, business created and role promoted');
            localStorage.removeItem('opynio_pending_business_data');
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

            // Re-fetch real (en background) para sincronizar TODOS los campos
            try {
                const [updatedProfile, newBusinesses] = await Promise.all([
                    getUserProfile(user),
                    getBusinessesForOwner(user.id),
                ]);
                if (updatedProfile) setProfile(updatedProfile);
                if (newBusinesses) setBusinesses(newBusinesses);
            } catch (refetchErr) {
                console.warn('[completeBusinessRegistration] re-fetch failed but role already promoted in context:', refetchErr);
            }

            // Use country directly - don't infer from language
            const countryPrefix = country ? `/${country.toLowerCase()}` : '';
            const pathLang = country ? getLanguageForCountryCode(country) : language;
            const paths = pathTranslations[pathLang] || pathTranslations.es;
            const myBusinessesPath = `${countryPrefix}/${paths.myBusinesses}`;
            console.log('[completeBusinessRegistration] navigating to', myBusinessesPath);
            navigate(myBusinessesPath, { replace: true });
            
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
            <div className="min-h-[calc(100vh-200px)] flex items-start justify-center px-4 py-8 sm:py-12">
                <div className="w-full max-w-lg">
                    {/* Step indicator */}
                    <div className="flex items-center justify-center gap-2 mb-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        <span className="w-8 h-1 rounded-full bg-brand-green"></span>
                        <span className="w-8 h-1 rounded-full bg-brand-green"></span>
                        <span className="ml-2">Último paso</span>
                    </div>

                    <div className="relative bg-white dark:bg-zinc-800 rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-700 overflow-hidden animate-fade-up">
                        {/* Decorative gradient bar */}
                        <div className="h-1.5 bg-gradient-to-r from-brand-green via-emerald-400 to-brand-green"></div>

                        <div className="p-6 sm:p-10">
                            {/* Hero icon + headline */}
                            <div className="flex flex-col items-center text-center">
                                <div className="w-16 h-16 rounded-2xl bg-brand-green/10 dark:bg-brand-green/20 flex items-center justify-center mb-5 ring-4 ring-brand-green/10">
                                    <i className="fa-solid fa-building text-3xl text-brand-green"></i>
                                </div>
                                <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">
                                    {firstName ? `¡Casi listo, ${firstName}!` : '¡Casi listo!'}
                                </h1>
                                <p className="mt-2 text-sm sm:text-base text-gray-500 dark:text-gray-400 max-w-sm">
                                    Cuéntanos un par de detalles sobre tu empresa para crear tu perfil de negocio.
                                </p>
                                {user?.email && (
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

                            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                                {/* Business name */}
                                <div>
                                    <label htmlFor="businessName" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                        Nombre de tu empresa
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
                                        País de la empresa
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

                                {/* Submit */}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="group w-full bg-brand-green text-white font-bold py-3.5 rounded-xl text-base sm:text-lg shadow-lg shadow-brand-green/20 hover:shadow-xl hover:shadow-brand-green/30 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:bg-gray-400 disabled:shadow-none disabled:cursor-not-allowed disabled:translate-y-0 flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            <span>Creando empresa…</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Finalizar registro</span>
                                            <i className="fa-solid fa-arrow-right text-sm transition-transform group-hover:translate-x-1"></i>
                                        </>
                                    )}
                                </button>

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

                    <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
                        Podrás editar todos estos datos más tarde desde el panel de tu empresa.
                    </p>
                </div>
            </div>

            <style>{`
                @keyframes fade-up {
                    0% { opacity: 0; transform: translateY(12px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-up { animation: fade-up 0.4s ease-out forwards; }
            `}</style>
        </>
    );
};

export default CompleteBusinessRegistrationPage;