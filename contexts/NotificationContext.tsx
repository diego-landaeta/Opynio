import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';

type NotificationType = 'success' | 'error' | 'info';

interface NotificationState {
    message: string;
    type: NotificationType;
    isVisible: boolean;
}

interface NotificationContextType {
    showNotification: (message: string, type?: NotificationType) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);
const NotificationStateContext = createContext<NotificationState | undefined>(undefined);


export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [notification, setNotification] = useState<NotificationState>({
        message: '',
        type: 'info',
        isVisible: false,
    });
    const [timeoutId, setTimeoutId] = useState<ReturnType<typeof setTimeout> | null>(null);

    const showNotification = useCallback((message: string, type: NotificationType = 'info') => {
        // Clear any existing timeout to prevent the notification from disappearing prematurely if a new one is shown.
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        setNotification({ message, type, isVisible: true });

        const newTimeoutId = setTimeout(() => {
            setNotification(prev => ({ ...prev, isVisible: false }));
        }, 5000); // Hide after 5 seconds

        setTimeoutId(newTimeoutId);
    }, [timeoutId]);

    const contextValue = { showNotification };
    
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