import React, { createContext, useContext, ReactNode } from 'react';
import type { Business, Profile } from '../types';
import { useAuth } from './AuthContext';

interface BusinessDashboardContextType {
    business: Business;
    profile: Profile | null;
    // Tras guardar cambios (p. ej. renombrar) el lateral y la cabecera se
    // quedaban con el nombre viejo hasta recargar.
    updateBusiness: (changes: Partial<Business>) => void;
}

const BusinessDashboardContext = createContext<BusinessDashboardContextType | undefined>(undefined);

export const BusinessDashboardProvider: React.FC<{
    business: Business;
    onBusinessChange?: (changes: Partial<Business>) => void;
    children: ReactNode;
}> = ({ business, onBusinessChange, children }) => {
    const { profile } = useAuth();
    const value = { business, profile, updateBusiness: onBusinessChange ?? (() => {}) };
    return <BusinessDashboardContext.Provider value={value}>{children}</BusinessDashboardContext.Provider>;
};

export const useBusinessDashboard = (): BusinessDashboardContextType => {
    const context = useContext(BusinessDashboardContext);
    if (context === undefined) {
        throw new Error('useBusinessDashboard must be used within a BusinessDashboardProvider');
    }
    return context;
};
