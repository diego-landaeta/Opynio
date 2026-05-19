import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getBusinessesForOwner, getUserProfile, supabase } from '../../services/supabaseService';
import Meta from '../Meta';
import { useI18n, pathTranslations, getLanguageForCountryCode } from '../../contexts/i18nContext';
import { useCountry } from '../../contexts/CountryContext';
import { trackMetaEvent } from '../../utils/metaPixel';

const PaymentSuccessPage: React.FC = () => {
    // FIX: Use setBusinesses from context to handle an array of businesses.
    const { user, setProfile, setBusinesses } = useAuth();
    const { language } = useI18n();
    const { country } = useCountry();
    const location = useLocation();

    // Use country directly - don't infer from language
    const countryPrefix = country ? `/${country.toLowerCase()}` : '';
    const pathLang = country ? getLanguageForCountryCode(country) : language;
    const paths = pathTranslations[pathLang] || pathTranslations.es;

    useEffect(() => {
        // After a successful payment, the user's plan and role may have changed.
        // We re-fetch their data to ensure the context is up-to-date.
        const refreshUserData = async () => {
            if (user) {
                try {
                    // FIX: Call getBusinessesForOwner which returns an array.
                    const [updatedProfile, newBusinesses] = await Promise.all([
                        getUserProfile(user),
                        getBusinessesForOwner(user.id),
                    ]);
                    if (updatedProfile) setProfile(updatedProfile);
                    // FIX: Update the context with the new array of businesses.
                    if (newBusinesses) setBusinesses(newBusinesses);
                } catch (error) {
                    console.error("Failed to refresh user data after payment:", error);
                }
            }
        };

        refreshUserData();
    }, [user, setProfile, setBusinesses]);

    // Meta Pixel Purchase event (deduplicated server-side via session_id event_id)
    useEffect(() => {
        if (!user) return;
        const params = new URLSearchParams(location.search);
        const sessionId = params.get('session_id');
        if (!sessionId) return;

        let cancelled = false;
        const fire = async () => {
            let value = 0;
            let currency = 'EUR';
            try {
                const { data } = await supabase
                    .from('subscriptions')
                    .select('prices(unit_amount, currency)')
                    .eq('user_id', user.id)
                    .order('created', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                const price = (data as any)?.prices;
                if (price?.unit_amount) value = price.unit_amount / 100;
                if (price?.currency) currency = String(price.currency).toUpperCase();
            } catch (err) {
                console.warn('[meta] could not load subscription price for Purchase event', err);
            }
            if (cancelled) return;
            void trackMetaEvent('Purchase', {
                eventId: sessionId,
                userData: { email: user.email, external_id: user.id },
                customData: { value, currency },
            });
        };
        void fire();
        return () => { cancelled = true; };
    }, [user, location.search]);

    return (
        <>
            <Meta title="¡Pago Exitoso! - Opynio" description="Gracias por tu suscripción a Opynio." noindex={true} />
            <div className="max-w-2xl mx-auto text-center py-12">
                <div className="bg-white dark:bg-zinc-800 p-8 rounded-xl shadow-lg">
                    <div className="bg-green-100 dark:bg-green-900/50 text-brand-green rounded-full w-20 h-20 inline-flex items-center justify-center shadow-sm mb-6">
                        <i className="fa-solid fa-check-circle text-5xl"></i>
                    </div>
                    <h1 className="text-3xl font-extrabold text-gray-800 dark:text-gray-100">¡Gracias por tu suscripción!</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-4 text-lg">
                        Tu plan ha sido activado. Ahora tienes acceso a todas las nuevas funcionalidades.
                    </p>
                    <Link
                        to={`${countryPrefix}/${paths.myBusinesses}`}
                        className="mt-8 inline-block bg-brand-green text-white font-bold px-8 py-3 rounded-md hover:bg-opacity-90 transition-all shadow-lg shadow-brand-green/30 text-lg"
                    >
                        Ir a Mis Negocios
                    </Link>
                </div>
            </div>
        </>
    );
};

export default PaymentSuccessPage;