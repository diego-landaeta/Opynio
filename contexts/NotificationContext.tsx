import React, { createContext, useState, useContext, ReactNode, useCallback, useMemo, useRef } from 'react';

type NotificationType = 'success' | 'error' | 'info';

/** Enlace opcional del aviso («Escribir a soporte», «Iniciar sesión»...). */
export interface NotificationAction {
    label: string;
    /** Ruta interna (react-router). */
    to: string;
}

interface NotificationState {
    message: string;
    type: NotificationType;
    isVisible: boolean;
    action?: NotificationAction;
}

interface NotificationOptions {
    action?: NotificationAction;
}

interface NotificationContextType {
    showNotification: (message: string, type?: NotificationType, options?: NotificationOptions) => void;
    hideNotification: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);
const NotificationStateContext = createContext<NotificationState | undefined>(undefined);


export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [notification, setNotification] = useState<NotificationState>({
        message: '',
        type: 'info',
        isVisible: false,
    });
    // El timeout vive en un ref, no en estado: con estado, showNotification
    // dependia de [timeoutId] y cambiaba de identidad en cada aviso. Las paginas
    // que cargan datos en un useEffect con [showNotification] volvian a cargar,
    // fallaban otra vez, avisaban otra vez... bucle infinito de peticiones
    // (medido: ~160 peticiones en 6 s en /admin/moderacion-resenas).
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showNotification = useCallback((message: string, type: NotificationType = 'info', options?: NotificationOptions) => {
        // Clear any existing timeout to prevent the notification from disappearing prematurely if a new one is shown.
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        setNotification({ message, type, isVisible: true, action: options?.action });

        // Con enlace se deja mas tiempo: hay que leer el mensaje y llegar a pulsarlo.
        timeoutRef.current = setTimeout(() => {
            setNotification(prev => ({ ...prev, isVisible: false }));
        }, options?.action ? 10000 : 5000);
    }, []);

    const hideNotification = useCallback(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setNotification(prev => ({ ...prev, isVisible: false }));
    }, []);

    const contextValue = useMemo(() => ({ showNotification, hideNotification }), [showNotification, hideNotification]);
    
    return (
        <NotificationContext.Provider value={contextValue}>
            <NotificationStateContext.Provider value={notification}>
                 {children}
            </NotificationStateContext.Provider>
        </NotificationContext.Provider>
    );
};

export const useNotification = (): NotificationContextType => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};

export const useNotificationState = (): NotificationState => {
    const context = useContext(NotificationStateContext);
    if (context === undefined) {
        throw new Error('useNotificationState must be used within a NotificationProvider');
    }
    return context;
}