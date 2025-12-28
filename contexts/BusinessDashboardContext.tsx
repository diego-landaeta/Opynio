import React, { createContext, useContext, ReactNode } from 'react';
import type { Business, Profile } from '../types';
import { useAuth } from './AuthContext';

interface BusinessDashboardContextType {
    business: Business;
    profile: Profile | null;
}

const BusinessDashboardContext = createContext<BusinessDashboardContextType | undefined>(undefined);

export const BusinessDashboardProvider: React.FC<{ business: Business; children: ReactNode }> = ({ business, children }) => {
    const { profile } = useAuth();
    const value = { business, profile };
    return <BusinessDashboardContext.Provider value={value}>{children}</BusinessDashboardContext.Provider>;
};

export const useBusinessDashboard = (): BusinessDashboardContextType => {
    const context = useContext(BusinessDashboardContext);
    if (context === undefined) {
        throw new Error('useBusinessDashboard must be used within a BusinessDashboardProvider');
    }
    return context;
};
