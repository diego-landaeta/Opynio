import React from 'react';
// FIX: The error "has no exported member 'Redirect'" suggests a react-router-dom version mismatch.
// Migrating to v6 syntax by using Navigate instead of Redirect.
// FIX: Changed react-router-dom imports to a namespace import to resolve module resolution issues.
import * as ReactRouterDOM from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Spinner from '../Spinner';
import { useI18n, countryPrefixFor, localizedPath } from '../../contexts/i18nContext';
import { useCountry } from '../../contexts/CountryContext';

const BusinessRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
    const { user, profile, loading } = useAuth();
    // FIX: Using namespace import from react-router-dom v6
    const location = ReactRouterDOM.useLocation();
    const { language } = useI18n();
    const { country } = useCountry();

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Spinner />
            </div>
        );
    }

    if (!user) {
        // Sin sesion: al login, recordando a donde queria ir (antes a la home).
        return <ReactRouterDOM.Navigate to={localizedPath('login', language, country)} state={{ from: location }} replace />;
    }

    // El admin tambien entra: «Comenzar gratis» y el resto de CTA de empresa
    // lo mandan a Mis negocios (useBusinessStartPath), y aqui lo devolviamos a
    // la home sin explicacion. Ve SUS empresas (owner_id = el), vacio si no
    // tiene ninguna; el panel solo abre las suyas (BusinessDashboardPage
    // compara owner_id) y la BD aplica RLS igual que a cualquier dueno.
    if (profile?.role !== 'business_owner' && profile?.role !== 'admin') {
        // Con sesion pero sin permiso: a la home de su pais.
        return <ReactRouterDOM.Navigate to={countryPrefixFor(language, country)} replace />;
    }

    return children;
};

export default BusinessRoute;
