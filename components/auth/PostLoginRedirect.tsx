import React, { useEffect, useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Spinner from '../Spinner';
import { useI18n, pathTranslations, getLanguageForCountryCode } from '../../contexts/i18nContext';
import { useCountry } from '../../contexts/CountryContext';

// Detecta si la sesión actual es signup-empresa, por orden de robustez:
//   1) ?type=business en la URL del callback (lo añade signInWithGoogleForBusiness).
//   2) user_metadata.intended_role === 'business_owner' (email signup vía signUpBusiness).
//   3) localStorage flag opynio_business_signup_flow (legacy/same-device).
function detectBusinessSignUpIntent(searchParams: URLSearchParams, userMetadata: any): {
    wants: boolean;
    source: 'query' | 'metadata' | 'flag' | 'none';
} {
    if (searchParams.get('type') === 'business') return { wants: true, source: 'query' };
    if (userMetadata?.intended_role === 'business_owner') return { wants: true, source: 'metadata' };
    if (typeof window !== 'undefined' && localStorage.getItem('opynio_business_signup_flow') === 'true') {
        return { wants: true, source: 'flag' };
    }
    return { wants: false, source: 'none' };
}

const PostLoginRedirect: React.FC = () => {
    const { profile, loading, user } = useAuth();
    const { language } = useI18n();
    const { country } = useCountry();
    const navigate = ReactRouterDOM.useNavigate();
    const location = ReactRouterDOM.useLocation();
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

            // The user signed up choosing the "business" tab if any of:
            //  - ?type=business in URL (added by signInWithGoogleForBusiness redirectTo).
            //  - user_metadata.intended_role === 'business_owner' (email signup).
            //  - localStorage flag (legacy / same-device).
            const searchParams = new URLSearchParams(location.search);
            const intent = detectBusinessSignUpIntent(searchParams, user?.user_metadata);

            console.log('[postLogin] business intent detection', {
                source: intent.source,
                wantsBusinessSignUp: intent.wants,
                profileRole: profile.role,
                searchParams: Object.fromEntries(searchParams),
                userMetadata: user?.user_metadata,
            });

            if (intent.wants) {
                // Only route to the completion form if the user has not been promoted yet.
                // If profile.role is already 'business_owner' it means signup is complete
                // (e.g. they already finished it earlier), fall through to the default routing.
                if (profile.role === 'authenticated') {
                    // Propaga ?type=business al destino para que el guard de
                    // CompleteBusinessRegistrationPage detecte la intención de empresa
                    // incluso cuando es Google OAuth (no hay user_metadata.intended_role)
                    // y aunque el flag de localStorage se haya perdido por cualquier motivo.
                    // El cleanup del flag se hace en handleSubmit cuando el RPC termina con éxito.
                    const completePath = `${countryPrefix}/${paths.completeBusinessRegistration}?type=business`;
                    console.log('[postLogin] routing to completeBusinessRegistration', { completePath });
                    navigate(completePath, { replace: true });
                    return;
                }
                // Profile ya está promovido → intent ya cumplido, podemos borrar el flag.
                localStorage.removeItem('opynio_business_signup_flow');
                console.log('[postLogin] business intent detected but profile.role already promoted, falling through to role switch', { profileRole: profile.role });
            }

            console.log('[postLogin] redirecting by role', { role: profile.role });
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