import React from 'react';
import { Link } from 'react-router-dom';
import { useNotification, useNotificationState } from '../contexts/NotificationContext';
import { useTranslation } from '../contexts/i18nContext';

const Snackbar: React.FC = () => {
    const { message, type, isVisible, action } = useNotificationState();
    const { hideNotification } = useNotification();
    const t = useTranslation();

    // bottom-24 deja espacio sobre el FloatingLanguageButton (también en bottom-right)
    // para que no se solapen visualmente.
    const baseClasses = "fixed bottom-24 right-4 sm:bottom-28 sm:right-5 p-3 sm:p-4 rounded-lg shadow-2xl text-white flex items-center gap-2 sm:gap-3 transition-all duration-300 ease-in-out transform z-50 max-w-[85vw] sm:max-w-sm";
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
        <div className={`${baseClasses} ${typeClasses[type]} ${visibilityClasses} ${action ? 'items-start' : ''}`} role="alert">
            <i className={`${icons[type]} text-sm sm:text-base ${action ? 'mt-1' : ''}`} aria-hidden="true"></i>
            <span className="font-semibold text-sm sm:text-base break-words">
                {message}
                {action && (
                    <>
                        {' '}
                        {/* Accion recomendada del error (Soporte, Iniciar sesion, Planes). */}
                        <Link
                            to={action.to}
                            onClick={hideNotification}
                            tabIndex={isVisible ? 0 : -1}
                            className="underline underline-offset-2 font-bold whitespace-nowrap rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        >
                            {action.label}
                        </Link>
                    </>
                )}
            </span>
            {action && (
                <button
                    type="button"
                    onClick={hideNotification}
                    tabIndex={isVisible ? 0 : -1}
                    aria-label={t('common.close')}
                    className="-m-1 ml-auto flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-white/90 hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                    <i className="fa-solid fa-xmark" aria-hidden="true"></i>
                </button>
            )}
        </div>
    );
};

export default Snackbar;
