import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { updateUserProfile, uploadAvatar, deleteOwnAvatarByUrl, savePushSubscription, deletePushSubscription, isUsernameTaken, updateUserPassword } from '../../services/supabaseService';
// FIX: Changed react-router-dom imports to a namespace import to resolve module resolution issues.
import * as ReactRouterDOM from 'react-router-dom';
import Spinner from '../Spinner';
import { VAPID_PUBLIC_KEY, PUSH_NOTIFICATIONS_ENABLED, LANGUAGES, COUNTRIES } from '../../constants';
import { urlBase64ToUint8Array } from '../../utils/urlBase64ToUint8Array';
import { Json, ThemePreference } from '../../types';
import Meta from '../Meta';
import PasswordInput from '../PasswordInput';
import { useTranslation, useI18n, localizedPathOrRoot, isSupportedLanguage, getLanguageForCountryCode, Language } from '../../contexts/i18nContext';
import { useCountry, useSwitchCountry, isValidCountryCode, CountryCode } from '../../contexts/CountryContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useNotification } from '../../contexts/NotificationContext';
import { markProfilePreferencesApplied } from '../../hooks/useProfilePreferencesSync';
import { prepareAvatar, AvatarPrepError } from '../../utils/avatarImage';
import { getUserFacingError } from '../../utils/userFacingError';
import { getAuthErrorInfo } from '../../utils/authErrors';

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken';

// Minimo de Supabase Auth (supabase/config.toml, minimum_password_length), el
// mismo que piden el registro y «Restablecer contrasena».
const MIN_PASSWORD_LENGTH = 6;

// Los 31 idiomas cableados en i18nContext, con su nombre nativo (LANGUAGES es
// la lista de los selectores de la home).
const LANGUAGE_OPTIONS = LANGUAGES.filter(l => isSupportedLanguage(l.code));

const THEME_OPTIONS: { value: ThemePreference; icon: string; labelKey: string }[] = [
    { value: 'light', icon: 'fa-sun', labelKey: 'editProfile.themeLight' },
    { value: 'dark', icon: 'fa-moon', labelKey: 'editProfile.themeDark' },
    { value: 'system', icon: 'fa-circle-half-stroke', labelKey: 'editProfile.themeSystem' },
];

type PrefStatus = 'idle' | 'saving' | 'saved' | 'error';

const SECTION_TITLE = 'text-lg font-semibold text-gray-700 dark:text-gray-300';
const FIELD_LABEL = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
// Fondo explicito (no transparente): la lista desplegable de un <select> en
// modo oscuro salia con texto claro sobre fondo blanco.
const FIELD_SELECT = 'w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100';
const FIELD_PASSWORD = 'w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-transparent text-gray-900 dark:text-gray-100';

const EditProfilePage: React.FC = () => {
    const { user, profile, loading: authLoading, setProfile } = useAuth();
    // FIX: Using namespace import from react-router-dom v6
    const navigate = ReactRouterDOM.useNavigate();
    const location = ReactRouterDOM.useLocation();
    const t = useTranslation();
    const { language, requestedLanguage, setLanguage } = useI18n();
    // Volver al perfil DENTRO del pais del usuario (useCountry): con
    // `/${pathTranslations[language].profile}` se mandaba a /perfil sin el
    // /gb, /de... delante. Sin pais guardado, la ruta sin prefijo (/perfil).
    const { country } = useCountry();
    const profilePath = localizedPathOrRoot('profile', language, country);
    // Soporte con el prefijo de la URL actual (/es/perfil/editar -> /es/soporte);
    // sin prefijo, el del pais del usuario o, sin pais, la ruta sin prefijo.
    const { countryCode: urlCountryCode } = ReactRouterDOM.useParams<{ countryCode?: string }>();
    const supportPath = localizedPathOrRoot('support', language, urlCountryCode || country);
    const switchCountry = useSwitchCountry();
    const { preference: themePreference, setThemePreference } = useTheme();
    const { showNotification } = useNotification();

    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    // Error de la foto (tipo, tamano o subida). Va aparte de `error` porque no
    // debe impedir guardar el nombre ni el username.
    const [avatarError, setAvatarError] = useState<string | null>(null);
    const [avatarProcessing, setAvatarProcessing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [isPushSubscribed, setIsPushSubscribed] = useState(false);
    const [pushLoading, setPushLoading] = useState(true);

    // Preferencias: se aplican al momento y se guardan en el perfil aparte del
    // formulario de arriba (no esperan a «Guardar cambios»).
    const [prefStatus, setPrefStatus] = useState<PrefStatus>('idle');

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [passwordSuccess, setPasswordSuccess] = useState(false);

    useEffect(() => {
        if (profile) {
            setName(profile.name || '');
            setUsername(profile.username || '');
            setAvatarPreview(profile.avatar_url || null);
        }
    }, [profile]);
    
    // Debounced username check
    useEffect(() => {
        // Only check if username is being created for the first time
        if (profile?.username) {
            setUsernameStatus('idle');
            return;
        }

        const usernameToCheck = username.trim();
        if (usernameToCheck.length < 3) {
            setUsernameStatus('idle');
            return;
        }

        setUsernameStatus('checking');
        const debounceId = setTimeout(async () => {
            try {
                const taken = await isUsernameTaken(usernameToCheck);
                setUsernameStatus(taken ? 'taken' : 'available');
            } catch (err) {
                console.error("Username check failed:", err);
                setUsernameStatus('idle'); // Reset on error
            }
        }, 500);

        return () => clearTimeout(debounceId);
    }, [username, profile?.username]);


    useEffect(() => {
        if (!PUSH_NOTIFICATIONS_ENABLED || !('serviceWorker' in navigator) || !('PushManager' in window)) {
            setPushLoading(false);
            return;
        }
        navigator.serviceWorker.ready.then(reg => {
            reg.pushManager.getSubscription().then(sub => {
                setIsPushSubscribed(!!sub);
                setPushLoading(false);
            });
        });
    }, []);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const original = e.target.files?.[0] || null;
        // Permite volver a elegir el mismo fichero tras un error.
        e.target.value = '';
        setAvatarError(null);
        if (avatarPreview && avatarPreview.startsWith('blob:')) {
            URL.revokeObjectURL(avatarPreview);
        }
        if (!original) {
            setAvatarFile(null);
            setAvatarPreview(profile?.avatar_url || null);
            return;
        }
        // El bucket `avatars` solo admite JPEG/PNG/WebP de hasta 2 MB. La foto se
        // reduce aqui a 512 px (ver utils/avatarImage) para que una foto de
        // movil de varios MB tambien valga; si no se puede, se avisa y se
        // descarta la foto sin tocar el resto del formulario.
        setAvatarProcessing(true);
        try {
            const file = await prepareAvatar(original);
            setAvatarFile(file);
            setAvatarPreview(URL.createObjectURL(file));
        } catch (err) {
            const reason = err instanceof AvatarPrepError ? err.reason : 'tooLarge';
            setAvatarError(t(reason === 'invalidType' ? 'editProfile.avatarInvalidType' : 'editProfile.avatarTooLarge'));
            setAvatarFile(null);
            setAvatarPreview(profile?.avatar_url || null);
        } finally {
            setAvatarProcessing(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!user) return;

        if (!profile?.username) {
            if (username.trim().length < 3) {
                setError(t('editProfile.usernameMinChars'));
                return;
            }
            if (usernameStatus !== 'available') {
                setError(t('editProfile.usernameNotAvailable'));
                return;
            }
        }
        
        setLoading(true);
        setError(null);
        setSuccess(null);
        setAvatarError(null);

        try {
            const updates: { name: string, username?: string, avatar_url?: string } = {
                name: name.trim(),
            };
            // La foto se sube a Storage y en el perfil se guarda su URL. Antes se
            // mandaba el File como columna (400) y fallaba todo el guardado.
            // Si la subida falla, se guarda el resto igual y se avisa de la foto.
            let avatarFallo = false;
            // La foto anterior, para borrarla del bucket si el cambio se guarda.
            const avatarAnterior = profile?.avatar_url || null;
            let avatarNuevo: string | null = null;
            if (avatarFile) {
                try {
                    avatarNuevo = await uploadAvatar(user.id, avatarFile);
                    updates.avatar_url = avatarNuevo;
                } catch (uploadError) {
                    console.error('No se pudo subir la foto de perfil:', uploadError);
                    avatarFallo = true;
                }
            }
            if (!profile?.username && username.trim()) {
                updates.username = username.trim();
            }

            let updatedProfile;
            try {
                updatedProfile = await updateUserProfile(user.id, updates);
            } catch (saveError) {
                // El perfil no se guardo: la foto recien subida no la usa nadie
                // y es publica (cache de un año). Fuera.
                if (avatarNuevo) await deleteOwnAvatarByUrl(user.id, avatarNuevo);
                throw saveError;
            }
            // Guardado: la foto anterior ya no la usa el perfil y seguia publica
            // para siempre. Solo se borra si es de su carpeta avatars/<uid>/
            // (una de Google u otra URL externa se deja).
            if (avatarNuevo && avatarAnterior && avatarAnterior !== avatarNuevo) {
                void deleteOwnAvatarByUrl(user.id, avatarAnterior);
            }
            // Manually update the profile in the auth context to avoid stale data on redirect.
            if (updatedProfile) {
                setProfile(updatedProfile);
            }
            setSuccess(t('editProfile.changesSaved'));
            setAvatarFile(null);
            if (avatarFallo) {
                // Sin redirigir: el usuario tiene que ver que la foto no se subio.
                // Se queda la foto anterior (el perfil recargado la vuelve a pintar).
                setAvatarError(t('editProfile.avatarUploadFailed'));
                return;
            }
            // Si se llego aqui desde "Escribe una resena" (faltaba el username),
            // se vuelve al formulario, que conserva el borrador. Solo rutas
            // internas.
            const volver = new URLSearchParams(location.search).get('volver');
            const destino = volver && volver.startsWith('/') && !volver.startsWith('//')
                ? volver
                : profilePath;
            setTimeout(() => {
                navigate(destino);
            }, 1500);
        } catch (err) {
            // Traducido: nunca el texto de PostgREST o del trigger. El nombre de
            // usuario repetido llega como 23505 (guard_username).
            const info = await getUserFacingError(err, { fallbackKey: 'editProfile.errorUpdating' });
            setError(t(info.kind === 'conflict' ? 'editProfile.usernameTaken' : info.key));
        } finally {
            setLoading(false);
        }
    };

    const handleTogglePushNotifications = async () => {
        setPushLoading(true);
        setError(null);
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                await deletePushSubscription(subscription.endpoint);
                const unsubscribed = await subscription.unsubscribe();
                if (unsubscribed) {
                    setIsPushSubscribed(false);
                }
            } else if (user) {
                 const permission = await Notification.requestPermission();
                 if (permission !== 'granted') throw new Error('PUSH_PERMISSION_DENIED');

                const newSubscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
                });
                // FIX: The PushSubscriptionJSON type from the browser API is not directly assignable to the generic Json type.
                // Casting it to `unknown` first and then to `Json` resolves the type mismatch.
                await savePushSubscription(user.id, newSubscription.toJSON() as unknown as Json);
                setIsPushSubscribed(true);
            }
        } catch (error: any) {
            console.error("Error toggling push notifications", error);
            // Traducido: el navegador responde en ingles («Registration failed...»).
            setError(error?.message === 'PUSH_PERMISSION_DENIED'
                ? t('editProfile.notificationPermissionDenied')
                : t((await getUserFacingError(error, { fallbackKey: 'editProfile.notificationError' })).key));
        } finally {
            setPushLoading(false);
        }
    };
    
    // Guarda en el perfil lo que ya se ha aplicado en este navegador. Antes se
    // marca como «aplicado» (useProfilePreferencesSync) para que el perfil
    // guardado no se vuelva a aplicar encima. Si falla (p. ej. sin la migracion
    // 20260925100000), la preferencia sigue valiendo en este dispositivo.
    const savePreferences = async (updates: { preferred_language?: string; preferred_country?: string; theme?: ThemePreference }) => {
        if (!user) return;
        markProfilePreferencesApplied(user.id);
        setPrefStatus('saving');
        try {
            const updated = await updateUserProfile(user.id, updates);
            if (updated) setProfile(updated);
            setPrefStatus('saved');
        } catch (err) {
            console.error('No se pudieron guardar las preferencias en el perfil:', err);
            setPrefStatus('error');
        }
    };

    // Como los selectores de idioma de la home: solo cambia el idioma, sin navegar.
    const handleLanguageChange = (lang: string) => {
        if (!isSupportedLanguage(lang) || lang === requestedLanguage) return;
        setLanguage(lang as Language);
        void savePreferences({ preferred_language: lang });
    };

    // Como el selector de pais de la home (useSwitchCountry): pais, idioma de
    // ese pais y esta misma pagina en ese pais (/es/perfil/editar ->
    // /gb/profile/edit).
    const handleCountryChange = (code: string) => {
        if (!isValidCountryCode(code) || code === country) return;
        const target = COUNTRIES.find(c => c.code === code);
        void savePreferences({ preferred_country: code, preferred_language: getLanguageForCountryCode(code) });
        switchCountry(code as CountryCode);
        if (target) showNotification(t('common.countryChanged', { country: target.name }), 'success');
    };

    const handleThemeChange = (pref: ThemePreference) => {
        if (pref === themePreference) return;
        setThemePreference(pref);
        void savePreferences({ theme: pref });
    };

    const handlePasswordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setPasswordError(null);
        setPasswordSuccess(false);
        if (newPassword.length < MIN_PASSWORD_LENGTH) {
            setPasswordError(t('resetPasswordPage.passwordTooShort'));
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError(t('resetPasswordPage.passwordsDoNotMatch'));
            return;
        }
        setPasswordLoading(true);
        try {
            await updateUserPassword(newPassword);
            setPasswordSuccess(true);
            setNewPassword('');
            setConfirmPassword('');
        } catch (err) {
            // Traducido por codigo (misma contrasena, debil, limite de
            // peticiones, sin red...): nunca el texto crudo de Supabase Auth.
            console.error('No se pudo cambiar la contrasena:', err);
            setPasswordError(t(getAuthErrorInfo(err, 'login', 'editProfile.passwordChangeError').key));
        } finally {
            setPasswordLoading(false);
        }
    };

    // No borra nada: abre Soporte con el ticket de eliminacion de cuenta
    // preseleccionado (SupportPage lee state.ticketType) y el equipo lo tramita.
    const handleRequestDeletion = () => {
        navigate(supportPath, { state: { ticketType: 'account_deletion' } });
    };

    const UsernameFeedback = () => {
        switch(usernameStatus) {
            case 'checking':
                return <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>;
            case 'available':
                return <i className="fa-solid fa-check-circle text-green-500 absolute right-3 top-1/2 -translate-y-1/2"></i>;
            case 'taken':
                 return <i className="fa-solid fa-times-circle text-red-500 absolute right-3 top-1/2 -translate-y-1/2"></i>;
            default:
                return null;
        }
    };


    if (authLoading) {
        return <div className="flex justify-center items-center h-64"><Spinner /></div>;
    }

    return (
        <>
            <Meta
                title={t('editProfile.metaTitle')}
                description={t('editProfile.metaDescription')}
                noindex={true}
            />
            <div className="max-w-xl mx-auto bg-white dark:bg-zinc-800 p-5 sm:p-8 rounded-xl shadow-lg">
                <h1 className="text-3xl font-bold mb-2 dark:text-gray-100">{t('editProfile.title')}</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-8">{t('editProfile.subtitle')}</p>

                {error && (
                    <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg mb-6" role="alert">
                        <span>{error}</span>
                    </div>
                )}
                {success && (
                    <div className="bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg mb-6" role="alert">
                        <span>{success}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('editProfile.nameLabel')}</label>
                        <input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-transparent text-gray-900 dark:text-gray-100"
                        />
                    </div>

                    <div>
                        <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('editProfile.usernameLabel')}</label>
                        <div className="relative">
                            <input
                                id="username"
                                type="text"
                                value={username}
                                onChange={(e) => {
                                    const sanitizedValue = e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
                                    setUsername(sanitizedValue);
                                }}
                                disabled={!!profile?.username}
                                className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-transparent text-gray-900 dark:text-gray-100 disabled:bg-gray-100 disabled:dark:bg-zinc-700 disabled:text-gray-500 disabled:cursor-not-allowed"
                            />
                             {!profile?.username && <UsernameFeedback />}
                        </div>
                        {profile?.username ? (
                             <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('editProfile.usernameCannotChange')}</p>
                        ) : (
                             <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('editProfile.usernameChoose')}</p>
                        )}
                        {!profile?.username && usernameStatus === 'taken' && <p className="text-xs text-red-600 mt-1">{t('editProfile.usernameTaken')}</p>}
                    </div>


                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('editProfile.profilePhoto')}</label>
                        <div className="flex items-center gap-4">
                            <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-zinc-700 flex-shrink-0 overflow-hidden">
                                 {avatarPreview ? (
                                    <img src={avatarPreview} alt={t('editProfile.profilePhoto')} width={80} height={80} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                        <i className="fa-solid fa-user text-3xl"></i>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="py-2 px-4 rounded-full text-sm font-semibold bg-green-50 dark:bg-green-900/50 text-brand-green dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900 cursor-pointer transition-colors">
                                    {t('editProfile.chooseFile')}
                                    <input
                                        type="file"
                                        accept="image/png, image/jpeg, image/webp"
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />
                                </label>
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                    {avatarProcessing
                                        ? <span className="inline-block w-4 h-4 align-middle border-2 border-gray-400 border-t-transparent rounded-full animate-spin" aria-hidden="true"></span>
                                        : avatarFile ? avatarFile.name : t('editProfile.noFileChosen')}
                                </span>
                            </div>
                        </div>
                        {avatarError && (
                            <p className="text-sm text-red-600 dark:text-red-400 mt-2" role="alert">{avatarError}</p>
                        )}
                    </div>

                    <div className="pt-4 flex items-center justify-end gap-4">
                         <button type="button" onClick={() => navigate(profilePath)} className="text-sm font-semibold text-gray-600 dark:text-gray-300 hover:underline">
                            {t('editProfile.cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={loading || avatarProcessing || (!profile?.username && usernameStatus !== 'available')}
                            className="bg-brand-green text-white font-bold py-2 px-6 rounded-lg hover:bg-opacity-90 transition-colors shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading && <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                            <span>{loading ? t('editProfile.saving') : t('editProfile.saveChanges')}</span>
                        </button>
                    </div>
                </form>

                {PUSH_NOTIFICATIONS_ENABLED && (
                <div className="mt-8 pt-6 border-t dark:border-zinc-700">
                    <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">{t('editProfile.pushNotifications')}</h2>
                    <div className="flex items-center justify-between mt-2">
                        <p className="text-sm text-gray-600 dark:text-gray-400">{t('editProfile.pushNotificationsDesc')}</p>
                        <button
                            onClick={handleTogglePushNotifications}
                            disabled={pushLoading}
                            className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors disabled:opacity-50 ${
                                isPushSubscribed
                                ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300 dark:hover:bg-red-900'
                                : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-300 dark:hover:bg-green-900'
                            }`}
                        >
                            {pushLoading ? t('editProfile.loading') : isPushSubscribed ? t('editProfile.deactivate') : t('editProfile.activate')}
                        </button>
                    </div>
                </div>
                )}

                <section className="mt-8 pt-6 border-t dark:border-zinc-700" aria-labelledby="prefs-title">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <h2 id="prefs-title" className={SECTION_TITLE}>{t('editProfile.preferencesTitle')}</h2>
                        <p className="text-xs" aria-live="polite">
                            {prefStatus === 'saving' && <span className="text-gray-500 dark:text-gray-400">{t('editProfile.saving')}</span>}
                            {prefStatus === 'saved' && <span className="text-green-700 dark:text-green-400"><i className="fa-solid fa-check mr-1" aria-hidden="true"></i>{t('editProfile.preferencesSaved')}</span>}
                        </p>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('editProfile.preferencesDesc')}</p>
                    {prefStatus === 'error' && (
                        <p className="text-sm text-red-600 dark:text-red-400 mt-2" role="alert">{t('editProfile.preferencesSaveError')}</p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                        <div>
                            <label htmlFor="pref-language" className={FIELD_LABEL}>{t('editProfile.languageLabel')}</label>
                            <select
                                id="pref-language"
                                value={requestedLanguage}
                                onChange={(e) => handleLanguageChange(e.target.value)}
                                className={FIELD_SELECT}
                            >
                                {LANGUAGE_OPTIONS.map(l => (
                                    <option key={l.code} value={l.code}>{l.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="pref-country" className={FIELD_LABEL}>{t('editProfile.countryLabel')}</label>
                            <select
                                id="pref-country"
                                value={country || ''}
                                onChange={(e) => handleCountryChange(e.target.value)}
                                aria-describedby="pref-country-hint"
                                className={FIELD_SELECT}
                            >
                                {!country && <option value="" disabled>{t('editProfile.countryPlaceholder')}</option>}
                                {COUNTRIES.map(c => (
                                    <option key={c.code} value={c.code}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <p id="pref-country-hint" className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('editProfile.countryHint')}</p>

                    <div className="mt-5">
                        <span id="pref-theme" className={FIELD_LABEL}>{t('editProfile.themeLabel')}</span>
                        <div role="radiogroup" aria-labelledby="pref-theme" className="grid grid-cols-3 gap-2">
                            {THEME_OPTIONS.map(o => {
                                const active = themePreference === o.value;
                                return (
                                    <button
                                        key={o.value}
                                        type="button"
                                        role="radio"
                                        aria-checked={active}
                                        onClick={() => handleThemeChange(o.value)}
                                        className={`flex items-center justify-center gap-2 py-2.5 px-2 rounded-lg border text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green ${
                                            active
                                                ? 'border-brand-green bg-brand-green/10 text-brand-green dark:text-green-300'
                                                : 'border-gray-300 dark:border-zinc-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700'
                                        }`}
                                    >
                                        <i className={`fa-solid ${o.icon}`} aria-hidden="true"></i>
                                        <span>{t(o.labelKey)}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </section>

                <section className="mt-8 pt-6 border-t dark:border-zinc-700" aria-labelledby="account-title">
                    <h2 id="account-title" className={SECTION_TITLE}>{t('editProfile.accountTitle')}</h2>
                    <form onSubmit={handlePasswordSubmit} className="space-y-4 mt-4" noValidate>
                        <div>
                            <label htmlFor="account-email" className={FIELD_LABEL}>{t('editProfile.emailLabel')}</label>
                            {/* Dentro del formulario de contrasena y con autocomplete
                                username: el gestor de contrasenas sabe de que cuenta es. */}
                            <input
                                id="account-email"
                                type="email"
                                value={user?.email || ''}
                                readOnly
                                autoComplete="username"
                                aria-describedby="account-email-hint"
                                className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                            />
                            <p id="account-email-hint" className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('editProfile.emailReadOnly')}</p>
                        </div>

                        <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 pt-2">{t('editProfile.changePasswordTitle')}</h3>
                        {passwordError && (
                            <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm" role="alert">{passwordError}</div>
                        )}
                        {passwordSuccess && (
                            <div className="bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg text-sm" role="status">{t('editProfile.passwordChanged')}</div>
                        )}
                        <div>
                            <label htmlFor="new-password" className={FIELD_LABEL}>{t('editProfile.newPasswordLabel')}</label>
                            <PasswordInput
                                id="new-password"
                                autoComplete="new-password"
                                value={newPassword}
                                onChange={(e) => { setNewPassword(e.target.value); setPasswordSuccess(false); }}
                                minLength={MIN_PASSWORD_LENGTH}
                                aria-describedby="new-password-hint"
                                className={FIELD_PASSWORD}
                            />
                            <p id="new-password-hint" className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('editProfile.passwordMinHint', { min: MIN_PASSWORD_LENGTH })}</p>
                        </div>
                        <div>
                            <label htmlFor="confirm-password" className={FIELD_LABEL}>{t('editProfile.confirmPasswordLabel')}</label>
                            <PasswordInput
                                id="confirm-password"
                                autoComplete="new-password"
                                value={confirmPassword}
                                onChange={(e) => { setConfirmPassword(e.target.value); setPasswordSuccess(false); }}
                                minLength={MIN_PASSWORD_LENGTH}
                                className={FIELD_PASSWORD}
                            />
                        </div>
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={passwordLoading || !newPassword || !confirmPassword}
                                className="bg-brand-green text-white font-bold py-2 px-6 rounded-lg hover:bg-opacity-90 transition-colors shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {passwordLoading && <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                                <span>{passwordLoading ? t('editProfile.changingPassword') : t('editProfile.changePasswordButton')}</span>
                            </button>
                        </div>
                    </form>
                </section>

                <section className="mt-8 pt-6 border-t dark:border-zinc-700" aria-labelledby="delete-title">
                    <h2 id="delete-title" className="text-lg font-semibold text-red-700 dark:text-red-400">{t('editProfile.deleteAccountTitle')}</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('editProfile.deleteAccountDesc')}</p>
                    <button
                        type="button"
                        onClick={handleRequestDeletion}
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                        <i className="fa-solid fa-user-xmark" aria-hidden="true"></i>
                        <span>{t('editProfile.deleteAccountButton')}</span>
                    </button>
                </section>

            </div>
        </>
    );
};

export default EditProfilePage;