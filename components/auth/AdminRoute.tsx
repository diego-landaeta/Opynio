import React from 'react';
// FIX: The error "has no exported member 'Redirect'" suggests a react-router-dom version mismatch.
// Migrating to v6 syntax by using Navigate instead of Redirect.
// FIX: Changed react-router-dom imports to a namespace import to resolve module resolution issues.
import * as ReactRouterDOM from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Spinner from '../Spinner';
import { useI18n } from '../../contexts/i18nContext';

const AdminRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
    const { user, profile, loading } = useAuth();
    // FIX: Using namespace import from react-router-dom v6
    const location = ReactRouterDOM.useLocation();
    const { language } = useI18n();

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Spinner />
            </div>
        );
    }

    if (!user || profile?.role !== 'admin') {
        // Redirect them to the home page if not an admin
        // FIX: Using namespace import from react-router-dom v6
        return <ReactRouterDOM.Navigate to={`/${language}`} state={{ from: location }} replace />;
    }

    return children;
};

export default AdminRoute;
