import React, { useEffect, useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Spinner from '../Spinner';
import { useI18n, pathTranslations, getLanguageForCountryCode } from '../../contexts/i18nContext';
import { useCountry } from '../../contexts/CountryContext';

const PostLoginRedirect: React.FC = () => {
    const { profile, loading, user } = useAuth();
    const { language } = useI18n();
    const { country } = useCountry();
    const navigate = ReactRouterDOM.useNavigate();
    const [waitTime, setWaitTime] = useState(0);

    // Timeout fallback: if profile doesn't load after 5 seconds, redirect to home
    useEffect(() => {
        const timer = setInterval(() => {
            setWaitTime(prev => prev + 1);
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    // Fallback redirect after timeout
    useEffect(() => {
        if (waitTime >= 5 && !loading && !profile) {
            console.warn("PostLoginRedirect: Timeout waiting for profile, redirecting to home");
            const effectiveCountry = country || 'es';
            navigate(`/${effectiveCountry.toLowerCase()}`, { replace: true });
        }
    }, [waitTime, loading, profile, navigate, country]);

    useEffect(() => {
        // Debug logging
        console.log("PostLoginRedirect state:", { loading, hasProfile: !!profile, hasUser: !!user, waitTime });

        if (!loading && profile) {
            // Use country directly - don't infer from language
            const countryPrefix = country ? `/${country.toLowerCase()}` : '';
            const pathLang = country ? getLanguageForCountryCode(country) : language;
            const paths = pathTranslations[pathLang] || pathTranslations.es;

            const postLoginActionRaw = localStorage.getItem('postLoginAction');
            if (postLoginActionRaw) {
                try {
                    const postLoginAction = JSON.parse(postLoginActionRaw);
                    if (postLoginAction.action === 'write_review' && postLoginAction.businessId) {
                        localStorage.removeItem('postLoginAction');
                        const writePath = `${countryPrefix}/${paths.writeReview}`;
                        navigate(writePath, {
                            replace: true,
                            state: { businessId: postLoginAction.businessId }
                        });
                        return;
                    }
                } catch (e) {
                    console.error("Failed to parse postLoginAction from localStorage", e);
                    localStorage.removeItem('postLoginAction');
                }
            }

            // The user signed up choosing the "business" tab if EITHER:
            //  - localStorage flag is set (same-device flow), OR
            //  - the auth metadata says intended_role=business_owner (cross-device email confirm).
            const flagBusinessSignUp = localStorage.getItem('opynio_business_signup_flow') === 'true';
            const metadataBusinessSignUp = user?.user_metadata?.intended_role === 'business_owner';
            const wantsBusinessSignUp = flagBusinessSignUp || metadataBusinessSignUp;

            if (wantsBusinessSignUp) {
                localStorage.removeItem('opynio_business_signup_flow');
                // Only route to the completion form if the user has not been promoted yet.
                // If profile.role is already 'business_owner' it means signup is complete
                // (e.g. they already finished it earlier), fall through to the default routing.
                if (profile.role === 'authenticated') {
                    const completePath = `${countryPrefix}/${paths.completeBusinessRegistration}`;
                    navigate(completePath, { replace: true });
                    return;
                }
            }

            console.log("PostLoginRedirect: Redirecting based on role:", profile.role);
            switch (profile.role) {
                case 'admin':
                    // Admin routes are NOT prefixed with country code
                    navigate('/admin/panel', { replace: true });
                    break;
                case 'business_owner':
                    navigate(`${countryPrefix}/${paths.myBusinesses}`, { replace: true });
                    break;
                default:
                    navigate(`${countryPrefix}/${paths.profile}`, { replace: true });
            }
        }
    }, [profile, loading, navigate, country, language, user, waitTime]);

    return (
        <div className="flex flex-col justify-center items-center h-64">
            <div className="flex items-center">
                <Spinner />
                <p className="ml-4 text-gray-600 dark:text-gray-400">Redirigiendo a tu panel...</p>
            </div>
            {waitTime >= 3 && !profile && (
                <p className="mt-4 text-sm text-gray-500 dark:text-gray-500">
                    Cargando perfil... {waitTime}s
                </p>
            )}
        </div>
    );
};

export default PostLoginRedirect;