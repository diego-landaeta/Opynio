import React, { useState, useEffect, useCallback } from 'react';
// FIX: Changed react-router-dom imports to a namespace import to resolve module resolution issues.
import * as ReactRouterDOM from 'react-router-dom';
import { signUpUser, signUpBusiness, signInWithGoogle, signInWithGoogleForBusiness, isUsernameTaken, getBusinessByName } from '../../services/supabaseService';
import Modal from '../Modal';
import Meta from '../Meta';
import { COUNTRIES } from '../../constants';
import { useTranslation, useI18n, pathTranslations } from '../../contexts/i18nContext';

type RegisterType = 'user' | 'business';
type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken';

const RegisterPage: React.FC = () => {
    const [registerType, setRegisterType] = useState<RegisterType>('user');
    const [formData, setFormData] = useState({
        name: '',
        username: '',
        businessName: '',
        email: '',
        password: '',
        country: 'ES',
    });
    const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [error, setError] = useState<React.ReactNode | null>(null);
    const [success, setSuccess] = useState<boolean>(false);

    const t = useTranslation();
    const { language } = useI18n();
    const navigate = ReactRouterDOM.useNavigate();

    // Set register type from URL query parameter on initial load
    const location = ReactRouterDOM.useLocation();
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const typeParam = params.get('type');

        if (typeParam === 'business') {
            setRegisterType('business');
        }
    }, [location.search]);

    // Debounced username check
    useEffect(() => {
        const username = formData.username.trim();
        if (username.length < 3) {
            setUsernameStatus('idle');
            return;
        }

        setUsernameStatus('checking');
        const debounceId = setTimeout(async () => {
            try {
                const taken = await isUsernameTaken(username);
                setUsernameStatus(taken ? 'taken' : 'available');
            } catch (err) {
                console.error("Username check failed:", err);
                setUsernameStatus('idle'); // Reset on error
            }
        }, 500);

        return () => clearTimeout(debounceId);
    }, [formData.username]);


    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { id, value } = e.target;
        if (id === 'username') {
            // Allow only letters, numbers, and underscores, and convert to lowercase
            const sanitizedValue = value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
            setFormData(prev => ({ ...prev, [id]: sanitizedValue }));
        } else {
            setFormData(prev => ({ ...prev, [id]: value }));
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(false);

        if (usernameStatus === 'taken' || usernameStatus === 'checking') {
            setError(t('registerPage.usernameRequiredError'));
            setLoading(false);
            return;
        }

        try {
            console.log('[signup] handleSubmit start', { registerType, email: formData.email });
            if (registerType === 'user') {
                if (!formData.name || !formData.username) {
                    throw new Error(t('registerPage.allFieldsRequiredError'));
                }
                await signUpUser(formData.email, formData.password, formData.name, formData.username);
                console.log('[signup] user signup completed');
            } else {
                 if (!formData.name || !formData.username || !formData.businessName) {
                    throw new Error(t('registerPage.allFieldsRequiredError'));
                }

                // Check if business name already exists before trying to sign up
                const existingBusiness = await getBusinessByName(formData.businessName.trim());
                if (existingBusiness) {
                    console.warn('[signup] business name already taken', { businessName: formData.businessName });
                    setError(
                        <span dangerouslySetInnerHTML={{ __html: t('registerPage.businessExistsError') }} />
                    );
                    setLoading(false);
                    return;
                }

                // Persist signup intent + pre-collected business data so PostLoginRedirect
                // routes the user to CompleteBusinessRegistrationPage and the form arrives pre-filled.
                localStorage.setItem('opynio_business_signup_flow', 'true');
                localStorage.setItem('opynio_pending_business_data', JSON.stringify({
                    name: formData.businessName.trim(),
                    country: formData.country,
                }));
                console.log('[signup] business flag + pending data persisted to localStorage', {
                    flag: 'opynio_business_signup_flow=true',
                    businessName: formData.businessName.trim(),
                    country: formData.country,
                });

                await signUpBusiness(
                    formData.email,
                    formData.password,
                    formData.businessName,
                    formData.username,
                    formData.country,
                    formData.name,
                );
                console.log('[signup] business signup completed (email confirmation pending)');
            }
            setSuccess(true);
        } catch (err: any) {
            if (err.message === 'Database error saving new user') {
                setError(t('registerPage.registrationErrorDB'));
            } else {
                setError(err.message || t('registerPage.registrationErrorGeneral'));
            }
            console.error(err);
        } finally {
            setLoading(false);
        }
    };
    
    const handleGoogleSignIn = async () => {
        setGoogleLoading(true);
        setError(null);
        try {
            console.log('[signup] Google OAuth start', { registerType });
            if (registerType === 'business') {
                // Mark this as a business signup so PostLoginRedirect can route to the
                // complete-business-registration step after Google returns.
                localStorage.setItem('opynio_business_signup_flow', 'true');
                console.log('[signup] business flag persisted before Google OAuth redirect');
                await signInWithGoogleForBusiness();
            } else {
                await signInWithGoogle();
            }
        } catch (err: any) {
            setError(err.message || t('registerPage.errorGoogle'));
            setGoogleLoading(false);
        }
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


    return (
        <>
            <Meta
                title={t('meta.registerTitle')}
                description={t('meta.registerDesc')}
            />
            <div className="max-w-[95vw] sm:max-w-md mx-auto bg-white dark:bg-zinc-800 p-4 sm:p-6 md:p-8 rounded-xl shadow-lg mt-4 sm:mt-8 md:mt-10">
                <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-center text-brand-dark dark:text-gray-100">{t('registerPage.title')}</h1>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4 sm:mb-6 text-center">{t('registerPage.subtitle')}</p>

                <div className="flex gap-2 p-1 bg-gray-100 dark:bg-zinc-900 rounded-lg mb-6 sm:mb-8">
                    <button onClick={() => setRegisterType('user')} className={`flex-1 py-2 px-2 sm:px-4 rounded-md text-sm sm:text-base font-semibold transition-all ${registerType === 'user' ? 'bg-white dark:bg-zinc-700 shadow' : 'bg-transparent text-gray-600 dark:text-gray-300'}`}>{t('registerPage.iAmAUser')}</button>
                    <button onClick={() => setRegisterType('business')} className={`flex-1 py-2 px-2 sm:px-4 rounded-md text-sm sm:text-base font-semibold transition-all ${registerType === 'business' ? 'bg-white dark:bg-zinc-700 shadow' : 'bg-transparent text-gray-600 dark:text-gray-300'}`}>{t('registerPage.iAmABusiness')}</button>
                </div>

                {error && (
                    <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-300 px-3 sm:px-4 py-2 sm:py-3 rounded-lg relative mb-4 sm:mb-6" role="alert">
                        <span className="block sm:inline text-sm sm:text-base">{error}</span>
                    </div>
                )}


                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                    <div>
                        <label htmlFor="name" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{registerType === 'user' ? t('registerPage.yourFullName') : t('registerPage.yourNameContact')}</label>
                        <input id="name" type="text" value={formData.name} onChange={handleInputChange} required placeholder={t('common.placeholders.businessName')} className="w-full p-2.5 sm:p-3 text-sm sm:text-base border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-transparent text-gray-900 dark:text-gray-100"/>
                    </div>

                    <div>
                        <label htmlFor="username" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.username')}</label>
                        <div className="relative">
                            <input id="username" type="text" value={formData.username} onChange={handleInputChange} required minLength={3} placeholder={t('common.placeholders.socialMedia')} className="w-full p-2.5 sm:p-3 text-sm sm:text-base border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-transparent text-gray-900 dark:text-gray-100"/>
                            <UsernameFeedback />
                        </div>
                        {usernameStatus === 'taken' && <p className="text-xs text-red-600 mt-1">{t('registerPage.usernameInUse')}</p>}
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('registerPage.usernameInfoUnique')}</p>
                    </div>


                    {registerType === 'business' && (
                        <>
                            <div>
                                <label htmlFor="businessName" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('registerPage.businessName')}</label>
                                <input id="businessName" type="text" value={formData.businessName} onChange={handleInputChange} required placeholder={t('common.placeholders.businessName')} className="w-full p-2.5 sm:p-3 text-sm sm:text-base border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-transparent text-gray-900 dark:text-gray-100"/>
                            </div>
                            <div>
                                <label htmlFor="country" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('registerPage.businessCountry')}</label>
                                <select id="country" name="country" value={formData.country} onChange={handleInputChange} required className="w-full p-2.5 sm:p-3 text-sm sm:text-base border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-200">
                                    {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                                </select>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 !-mt-2 text-center">{t('registerPage.businessDetailsLater')}</p>
                        </>
                    )}

                    <div>
                        <label htmlFor="email" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.email')}</label>
                        <input id="email" type="email" value={formData.email} onChange={handleInputChange} required placeholder={t('common.placeholders.email')} className="w-full p-2.5 sm:p-3 text-sm sm:text-base border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-transparent text-gray-900 dark:text-gray-100"/>
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.password')}</label>
                        <input id="password" type="password" value={formData.password} onChange={handleInputChange} required minLength={6} placeholder={t('registerPage.min6Chars')} className="w-full p-2.5 sm:p-3 text-sm sm:text-base border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-transparent text-gray-900 dark:text-gray-100"/>
                    </div>

                    <div className="pt-2">
                        <button type="submit" disabled={loading || googleLoading || usernameStatus !== 'available'} className="w-full bg-brand-green text-white font-bold py-2.5 sm:py-3 rounded-lg text-base sm:text-lg hover:bg-opacity-90 transition-colors shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                            {loading && <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                            <span>{loading ? t('registerPage.registering') : t('registerPage.createAccountButton')}</span>
                        </button>
                    </div>
                </form>

                <div className="relative my-4 sm:my-6">
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
                        <span>{googleLoading ? t('registerPage.redirecting') : t('registerPage.continueWithGoogle')}</span>
                    </button>
                </div>

                <div className="mt-4 sm:mt-6 text-center">
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        {registerType === 'business' ? t('registerPage.alreadyHaveAccountBusiness') : t('registerPage.alreadyHaveAccountUser')}
                        {' '}
                        <ReactRouterDOM.Link to={`/${pathTranslations[language].login}`} className="font-semibold text-brand-green hover:underline">{t('registerPage.logIn')}</ReactRouterDOM.Link>
                    </p>
                </div>

                {success && (
                    <Modal title={t('registerPage.registrationComplete')} onClose={() => setSuccess(false)}>
                        <div className="text-center py-3 sm:py-4">
                            <i className="fa-solid fa-check-circle text-4xl sm:text-5xl text-brand-green mb-3 sm:mb-4"></i>
                            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-2 mb-4 sm:mb-6" dangerouslySetInnerHTML={{ __html: t('registerPage.confirmationEmailSent', { email: formData.email }) }}>
                            </p>
                            <ReactRouterDOM.Link
                                to={`/${pathTranslations[language].login}`}
                                onClick={() => setSuccess(false)}
                                className="inline-block bg-brand-green text-white font-semibold px-5 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base rounded-md hover:bg-opacity-90 transition-all shadow-sm">
                                {t('registerPage.backToLogin')}
                            </ReactRouterDOM.Link>
                        </div>
                    </Modal>
                )}
            </div>
        </>
    );
};

export default RegisterPage;