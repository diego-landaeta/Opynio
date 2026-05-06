import React, { useState } from 'react';
// FIX: The error "has no exported member 'useHistory'" suggests a react-router-dom version mismatch.
// Migrating to v6 syntax by using useNavigate instead of useHistory.
// FIX: Changed react-router-dom imports to a namespace import to resolve module resolution issues.
import * as ReactRouterDOM from 'react-router-dom';
import { signIn, signInWithGoogle } from '../../services/supabaseService';
import Meta from '../Meta';
import { useTranslation, useI18n, pathTranslations } from '../../contexts/i18nContext';

const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = ReactRouterDOM.useNavigate();
    const t = useTranslation();
    const { language } = useI18n();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await signIn(email, password);
            navigate(`/${pathTranslations[language].postLogin}`);
        } catch (err: any) {
            setError(t('loginPage.error'));
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setGoogleLoading(true);
        setError(null);
        try {
            await signInWithGoogle();
        } catch (err: any) {
            setError(t('loginPage.errorGoogle'));
            setGoogleLoading(false);
        }
    };


    return (
        <>
            <Meta
                title={t('meta.loginTitle')}
                description={t('meta.loginDesc')}
            />
            <div className="max-w-[95vw] sm:max-w-md mx-auto bg-white dark:bg-zinc-800 p-4 sm:p-6 md:p-8 rounded-lg sm:rounded-xl shadow-lg mt-4 sm:mt-8 md:mt-10">
                <h1 className="text-2xl sm:text-3xl font-bold mb-1.5 sm:mb-2 text-center text-brand-dark dark:text-gray-100">{t('loginPage.title')}</h1>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-6 sm:mb-8 text-center">{t('loginPage.welcomeBack')}</p>

                {error && (
                    <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-300 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg relative mb-4 sm:mb-6 text-sm sm:text-base" role="alert">
                        <span className="block sm:inline">{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                    <div>
                        <label htmlFor="email" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.email')}</label>
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
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label htmlFor="password" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">{t('common.password')}</label>
                            <ReactRouterDOM.Link to={`/${pathTranslations[language].forgotPassword}`} className="text-xs sm:text-sm font-semibold text-brand-green hover:underline">
                                {t('loginPage.forgotPasswordLink')}
                            </ReactRouterDOM.Link>
                        </div>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                            className="w-full p-2.5 sm:p-3 text-sm sm:text-base border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-transparent text-gray-900 dark:text-gray-100"
                        />
                    </div>
                    <div className="pt-1 sm:pt-2">
                        <button
                            type="submit"
                            disabled={loading || googleLoading}
                            className="w-full bg-brand-green text-white font-bold py-2.5 sm:py-3 rounded-lg text-base sm:text-lg hover:bg-opacity-90 transition-colors shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading && <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                            <span>{loading ? t('loginPage.loggingIn') : t('loginPage.logInButton')}</span>
                        </button>
                    </div>
                </form>

                <div className="relative my-5 sm:my-6">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300 dark:border-zinc-600"></div>
                    </div>
                    <div className="relative flex justify-center text-xs sm:text-sm">
                        <span className="px-2 bg-white dark:bg-zinc-800 text-gray-500 dark:text-gray-400">{t('common.or')}</span>
                    </div>
                </div>

                <div>
                    <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={loading || googleLoading}
                        className="w-full flex justify-center items-center gap-2 sm:gap-3 py-2.5 sm:py-3 px-3 sm:px-4 border border-gray-300 dark:border-zinc-600 rounded-lg text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
                    >
                        <i className="fab fa-google text-base sm:text-lg"></i>
                        <span>{googleLoading ? t('loginPage.redirecting') : t('loginPage.continueWithGoogle')}</span>
                    </button>
                </div>

                <div className="mt-5 sm:mt-6 text-center">
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        {t('loginPage.noAccount')}{' '}
                        <ReactRouterDOM.Link to={`/${pathTranslations[language].register}`} className="font-semibold text-brand-green hover:underline">{t('loginPage.signUpHere')}</ReactRouterDOM.Link>
                    </p>
                </div>
            </div>
        </>
    );
};

export default LoginPage;