
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { updateUserPassword } from '../../services/supabaseService';
import * as ReactRouterDOM from 'react-router-dom';
import Meta from '../Meta';
import { useI18n, localizedPathOrRoot, useTranslation } from '../../contexts/i18nContext';
import { useCountry } from '../../contexts/CountryContext';
import PasswordInput from '../PasswordInput';
import AuthErrorText from '../auth/AuthErrorText';
import { getAuthErrorInfo } from '../../utils/authErrors';

const ResetPasswordPage: React.FC = () => {
    const { session, loading: authLoading } = useAuth();
    const navigate = ReactRouterDOM.useNavigate();
    const { language } = useI18n();
    const t = useTranslation();
    // Prefijo de pais y segmento en el idioma de ESE pais: /es/login (idioma
    // de la UI) daba 404.
    const { country } = useCountry();
    const loginPath = localizedPathOrRoot('login', language, country);
    const forgotPath = localizedPathOrRoot('forgotPassword', language, country);

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<React.ReactNode | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError(t('resetPasswordPage.passwordsDoNotMatch'));
            return;
        }
        if (password.length < 6) {
            setError(t('resetPasswordPage.passwordTooShort'));
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
            await updateUserPassword(password);
            setSuccess(true);
            setTimeout(() => {
                navigate(loginPath);
            }, 3000);
        } catch (err: any) {
            // Nunca el texto crudo de Supabase («New password should be
            // different...»): se traduce por codigo (utils/authErrors).
            setError(<AuthErrorText info={getAuthErrorInfo(err, 'reset')} />);
        } finally {
            setLoading(false);
        }
    };
    
    if (authLoading) {
        return <div className="text-center p-5 sm:p-8 text-sm sm:text-base">Cargando...</div>;
    }

    // Sin sesion de recuperacion (enlace caducado, ya usado o pagina abierta a
    // pelo): antes redirigia al login sin decir nada. Ahora se explica y se
    // lleva a pedir otro enlace. Si la sesion llega despues, aparece el formulario.
    if (!session?.user) {
        return (
            <>
                <Meta title={t('resetPasswordPage.linkExpiredTitle') + " - Opynio"} description={t('resetPasswordPage.linkExpiredMessage')} noindex={true} />
                <div className="max-w-md mx-auto bg-white dark:bg-zinc-800 p-5 sm:p-6 md:p-8 rounded-xl shadow-lg mt-6 sm:mt-8 md:mt-10 text-center" data-testid="reset-link-expired">
                    <i className="fa-solid fa-circle-exclamation text-4xl sm:text-5xl text-amber-500 mb-3 sm:mb-4" aria-hidden="true"></i>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">{t('resetPasswordPage.linkExpiredTitle')}</h1>
                    <p role="alert" className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-2 mb-5 sm:mb-6">{t('resetPasswordPage.linkExpiredMessage')}</p>
                    <ReactRouterDOM.Link to={forgotPath} className="inline-block w-full bg-brand-green text-white font-bold py-2.5 sm:py-3 rounded-lg text-base sm:text-lg hover:bg-opacity-90 transition-colors shadow-md">
                        {t('resetPasswordPage.requestNewLink')}
                    </ReactRouterDOM.Link>
                    <p className="mt-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        <ReactRouterDOM.Link to={loginPath} className="font-semibold text-brand-green hover:underline">{t('forgotPasswordPage.backToLoginLink')}</ReactRouterDOM.Link>
                    </p>
                </div>
            </>
        );
    }

    if (success) {
        return (
            <div className="max-w-md mx-auto bg-white dark:bg-zinc-800 p-5 sm:p-6 md:p-8 rounded-xl shadow-lg mt-6 sm:mt-8 md:mt-10 text-center">
                <i className="fa-solid fa-check-circle text-4xl sm:text-5xl text-brand-green mb-3 sm:mb-4"></i>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">{t('resetPasswordPage.passwordUpdated')}</h1>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-2">{t('resetPasswordPage.passwordUpdatedSubtitle')}</p>
            </div>
        );
    }

    return (
        <>
            <Meta
                title={t('resetPasswordPage.title') + " - Opynio"}
                description="Crea una nueva contraseña segura para tu cuenta de Opynio y recupera el acceso para seguir compartiendo y leyendo reseñas."
            />
            <div className="max-w-md mx-auto bg-white dark:bg-zinc-800 p-5 sm:p-6 md:p-8 rounded-xl shadow-lg mt-6 sm:mt-8 md:mt-10">
                <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-center text-brand-dark dark:text-gray-100">{t('resetPasswordPage.title')}</h1>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-6 sm:mb-8 text-center">{t('resetPasswordPage.subtitle')}</p>

                {error && (
                    <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-300 px-3 sm:px-4 py-2 sm:py-3 rounded-lg relative mb-4 sm:mb-6" role="alert">
                        <span className="block sm:inline text-sm sm:text-base">{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                    <div>
                        <label htmlFor="password" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('resetPasswordPage.newPassword')}</label>
                        <PasswordInput
                            id="password"
                            autoComplete="new-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                            className="w-full p-2.5 sm:p-3 text-sm sm:text-base border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-transparent text-gray-900 dark:text-gray-100"
                        />
                    </div>
                     <div>
                        <label htmlFor="confirmPassword" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('resetPasswordPage.confirmNewPassword')}</label>
                        <PasswordInput
                            id="confirmPassword"
                            autoComplete="new-password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                            className="w-full p-2.5 sm:p-3 text-sm sm:text-base border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-transparent text-gray-900 dark:text-gray-100"
                        />
                    </div>
                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-brand-green text-white font-bold py-2.5 sm:py-3 rounded-lg text-base sm:text-lg hover:bg-opacity-90 transition-colors shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading && <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                            <span>{loading ? t('resetPasswordPage.updating') : t('resetPasswordPage.updatePassword')}</span>
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
};

export default ResetPasswordPage;
