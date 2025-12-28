// components/pages/business/CompleteBusinessRegistrationPage.tsx

import React, { useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { finishBusinessSignup, getUserProfile, getBusinessesForOwner } from '../../../services/supabaseService';
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

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!businessName.trim()) {
            setError("El nombre de la empresa no puede estar vacío.");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            await finishBusinessSignup(businessName.trim(), businessCountry);
            showNotification('¡Tu empresa ha sido registrada! Redirigiendo...', 'success');

            // Manually re-fetch user data to update the context with the new role and business
            if (user && profile) {
                const [updatedProfile, newBusinesses] = await Promise.all([
                    getUserProfile(user),
                    getBusinessesForOwner(user.id),
                ]);
                if (updatedProfile) setProfile(updatedProfile);
                if (newBusinesses) setBusinesses(newBusinesses);
            }

            // Use country directly - don't infer from language
            const countryPrefix = country ? `/${country.toLowerCase()}` : '';
            const pathLang = country ? getLanguageForCountryCode(country) : language;
            const paths = pathTranslations[pathLang] || pathTranslations.es;
            const myBusinessesPath = `${countryPrefix}/${paths.myBusinesses}`;
            navigate(myBusinessesPath, { replace: true });
            
        } catch (err: any) {
            setError(err.message || 'Error al completar el registro. Inténtalo de nuevo.');
            setLoading(false);
        }
    };

    return (
        <>
            <Meta
                title="Completar Registro de Empresa - Opynio"
                description="Finaliza el registro de tu empresa en Opynio para empezar a gestionar tu reputación online."
            />
            <div className="max-w-md mx-auto bg-white dark:bg-zinc-800 p-8 rounded-xl shadow-lg mt-10">
                <h1 className="text-3xl font-bold mb-2 text-center text-brand-dark">¡Casi listo!</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-8 text-center">Solo un paso más para configurar tu cuenta de empresa.</p>
                
                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-6" role="alert">
                        <span className="block sm:inline">{error}</span>
                    </div>
                )}
                
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="businessName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre de tu Empresa</label>
                        <input 
                            id="businessName"
                            type="text" 
                            value={businessName}
                            onChange={(e) => setBusinessName(e.target.value)}
                            required
                            placeholder={t('common.placeholders.businessName')} 
                            className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent"
                        />
                    </div>
                     <div>
                        <label htmlFor="businessCountry" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">País de la empresa</label>
                        <select id="businessCountry" name="businessCountry" value={businessCountry} onChange={(e) => setBusinessCountry(e.target.value)} required className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-white dark:bg-zinc-800">
                            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="pt-2">
                        <button 
                            type="submit"
                            disabled={loading}
                            className="w-full bg-brand-green text-white font-bold py-3 rounded-lg text-lg hover:bg-opacity-90 transition-colors shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading && <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                            <span>{loading ? 'Creando empresa...' : 'Finalizar Registro'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
};

export default CompleteBusinessRegistrationPage;