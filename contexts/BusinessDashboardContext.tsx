import React, { createContext, useContext, ReactNode } from 'react';
import type { Business, Profile } from '../types';
import { useAuth } from './AuthContext';

/** Un administrador mirando el panel de otro usuario (solo lectura). `null` = el dueño en su propio panel. */
export interface AdminViewInfo {
    ownerId: string;
    ownerName: string;
}

interface BusinessDashboardContextType {
    business: Business;
    /** Perfil con el que se pintan los planes, candados y créditos: el del dueño en la vista de admin, el propio en cualquier otro caso. */
    profile: Profile | null;
    adminView: AdminViewInfo | null;
    // Tras guardar cambios (p. ej. renombrar) el lateral y la cabecera se
    // quedaban con el nombre viejo hasta recargar.
    updateBusiness: (changes: Partial<Business>) => void;
}

const BusinessDashboardContext = createContext<BusinessDashboardContextType | undefined>(undefined);

export const BusinessDashboardProvider: React.FC<{
    business: Business;
    onBusinessChange?: (changes: Partial<Business>) => void;
    /** Vista de administrador: el perfil del dueño sustituye al del usuario conectado. */
    adminView?: { ownerProfile: Profile | null; info: AdminViewInfo } | null;
    children: ReactNode;
}> = ({ business, onBusinessChange, adminView, children }) => {
    const { profile: miPerfil } = useAuth();
    const profile = adminView ? adminView.ownerProfile : miPerfil;
    const value = { business, profile, adminView: adminView ? adminView.info : null, updateBusiness: onBusinessChange ?? (() => {}) };
    return <BusinessDashboardContext.Provider value={value}>{children}</BusinessDashboardContext.Provider>;
};

export const useBusinessDashboard = (): BusinessDashboardContextType => {
    const context = useContext(BusinessDashboardContext);
    if (context === undefined) {
        throw new Error('useBusinessDashboard must be used within a BusinessDashboardProvider');
    }
    return context;
};
