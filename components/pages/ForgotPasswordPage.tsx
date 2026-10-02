
import React, { useState } from 'react';
import { sendPasswordResetEmail } from '../../services/supabaseService';
import Modal from '../Modal';
import * as ReactRouterDOM from 'react-router-dom';
import Meta from '../Meta';
import { useTranslation, useI18n, localizedPathOrRoot } from '../../contexts/i18nContext';
import { escapeHtml } from '../../utils/textUtils';
import { useCountry } from '../../contexts/CountryContext';
import AuthErrorText from '../auth/AuthErrorText';
import { getAuthErrorInfo, type AuthErrorInfo } from '../../utils/authErrors';

const ForgotPasswordPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<AuthErrorInfo | null>(null);
    const [success, setSuccess] = useState(false);
    const t = useTranslation();
    const { language } = useI18n();
    // Prefijo de pais y segmento en el idioma de ESE pais (/es/restablecer-...).
    // Con el segmento del idioma de la UI salia /es/reset-password = 404.
    const { country } = useCountry();
    const loginPath = localizedPathOrRoot('login', language, country);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(false);
        try {
            await sendPasswordResetEmail(email, localizedPathOrRoot('resetPassword', language, country));
            setSuccess(true);
        } catch (err: any) {
            // Antes salia el texto crudo de Supabase («Error sending recovery
            // email»), en ingles y como si la direccion estuviera mal. Limite de
            // envios -> esperar; fallo del servidor -> es del servicio (con
            // enlace a Soporte); email invalido -> validacion.
            console.error('[forgot-password]', err);
            setError(getAuthErrorInfo(err, 'recover'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Meta
                title={t('forgotPasswordPage.title') + " - Opynio"}
                description="¿Olvidaste tu contraseña de Opynio? Introduce tu correo electrónico y te enviaremos un enlace para restablecerla de forma segura."
            />
            <div className="max-w-md mx-auto bg-white dark:bg-zinc-800 p-5 sm:p-6 md:p-8 rounded-xl shadow-lg mt-6 sm:mt-8 md:mt-10">
                <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-center text-brand-dark dark:text-gray-100">{t('forgotPasswordPage.title')}</h1>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-6 sm:mb-8 text-center">{t('forgotPasswordPage.subtitle')}</p>

                {error && (
                    <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-300 px-3 sm:px-4 py-2 sm:py-3 rounded-lg relative mb-4 sm:mb-6" role="alert">
                        <span className="block sm:inline text-sm sm:text-base"><AuthErrorText info={error} /></span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                    <div>
                        <label htmlFor="email" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('forgotPasswordPage.emailLabel')}</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder={t('common.placeholders.email')}
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
                            <span>{loading ? t('forgotPasswordPage.sending') : t('forgotPasswordPage.sendLink')}</span>
                        </button>
                    </div>
                </form>

                <div className="mt-4 sm:mt-6 text-center">
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        {t('forgotPasswordPage.rememberPassword')}{' '}
                        <ReactRouterDOM.Link to={loginPath} className="font-semibold text-brand-green hover:underline">{t('forgotPasswordPage.backToLoginLink')}</ReactRouterDOM.Link>
                    </p>
                </div>
            </div>
            {success && (
                <Modal title={t('forgotPasswordPage.checkYourEmail')} onClose={() => setSuccess(false)}>
                    <div className="text-center py-3 sm:py-4">
                        <i className="fa-solid fa-envelope-circle-check text-4xl sm:text-5xl text-brand-green mb-3 sm:mb-4"></i>
                        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-2 mb-4 sm:mb-6" dangerouslySetInnerHTML={{ __html: t('forgotPasswordPage.passwordResetEmailSent', { email: escapeHtml(email) }) }} />
                        <ReactRouterDOM.Link
                            to={loginPath}
                            onClick={() => setSuccess(false)}
                            className="inline-block bg-brand-green text-white font-semibold px-5 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base rounded-md hover:bg-opacity-90 transition-all shadow-sm"
                        >
                            {t('forgotPasswordPage.backToLogin')}
                        </ReactRouterDOM.Link>
                    </div>
                </Modal>
            )}
        </>
    );
};

export default ForgotPasswordPage;
