import React from 'react';
import { useNotificationState } from '../contexts/NotificationContext';

const Snackbar: React.FC = () => {
    const { message, type, isVisible } = useNotificationState();

    const baseClasses = "fixed bottom-4 right-4 sm:bottom-5 sm:right-5 p-3 sm:p-4 rounded-lg shadow-2xl text-white flex items-center gap-2 sm:gap-3 transition-all duration-300 ease-in-out transform z-50 max-w-[85vw] sm:max-w-sm";
    const visibilityClasses = isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0 pointer-events-none";
    
    const typeClasses = {
        info: 'bg-brand-blue dark:bg-blue-600',
        success: 'bg-brand-green dark:bg-green-600',
        error: 'bg-red-600 dark:bg-red-700',
    };
    
    const icons = {
        info: 'fa-solid fa-circle-info',
        success: 'fa-solid fa-check-circle',
        error: 'fa-solid fa-triangle-exclamation',
    }

    return (
        <div className={`${baseClasses} ${typeClasses[type]} ${visibilityClasses}`} role="alert">
            <i className={`${icons[type]} text-sm sm:text-base`}></i>
            <span className="font-semibold text-sm sm:text-base break-words">{message}</span>
        </div>
    );
};

export default Snackbar;