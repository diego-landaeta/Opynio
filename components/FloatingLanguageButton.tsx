import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useI18n, Language, isDashboardRoute } from '../contexts/i18nContext';
import { LANGUAGES } from '../constants';

const DISMISSED_KEY = 'opynio_lang_button_dismissed';

const FloatingLanguageButton: React.FC = () => {
    const { language, setLanguage } = useI18n();
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);
    const [isDismissed, setIsDismissed] = useState(() => {
        return sessionStorage.getItem(DISMISSED_KEY) === 'true';
    });
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Oculta el botón en dashboards (admin / panel business owner) — la URL
    // está atada al país de la empresa y cambiar el idioma desde aquí
    // rompería la navegación.
    const hideOnDashboard = isDashboardRoute(location.pathname);

    // Get current language info
    const currentLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleLanguageSelect = (lang: Language) => {
        setLanguage(lang);
        setIsOpen(false);
    };

    const handleDismiss = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsDismissed(true);
        sessionStorage.setItem(DISMISSED_KEY, 'true');
    };

    if (isDismissed) return null;
    if (hideOnDashboard) return null;

    return (
        <div
            ref={dropdownRef}
            className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6"
        >
            {/* Language dropdown */}
            {isOpen && (
                <div className="absolute bottom-full right-0 mb-2 bg-white dark:bg-zinc-800 rounded-xl shadow-2xl border border-gray-200 dark:border-zinc-700 overflow-hidden min-w-[200px] animate-fade-in-up">
                    <div className="p-3 border-b border-gray-200 dark:border-zinc-700 flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                            <i className="fa-solid fa-globe mr-2 text-brand-green"></i>
                            Idioma / Language
                        </span>
                        <button
                            onClick={handleDismiss}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
                            title="Ocultar este botón"
                        >
                            <i className="fa-solid fa-times text-xs"></i>
                        </button>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                        {LANGUAGES.map((lang) => (
                            <button
                                key={lang.code}
                                onClick={() => handleLanguageSelect(lang.code as Language)}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors ${
                                    language === lang.code
                                        ? 'bg-brand-green/10 text-brand-green'
                                        : 'text-gray-700 dark:text-gray-200'
                                }`}
                            >
                                <img
                                    src={lang.flag}
                                    alt={lang.name}
                                    className="w-6 h-6 rounded-full object-cover ring-1 ring-gray-200 dark:ring-zinc-600"
                                    loading="lazy"
                                />
                                <span className="font-medium text-sm">{lang.name}</span>
                                {language === lang.code && (
                                    <i className="fa-solid fa-check ml-auto text-brand-green"></i>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Floating button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`relative flex items-center gap-2 px-3 py-2.5 rounded-full shadow-lg transition-all duration-200 ${
                    isOpen
                        ? 'bg-brand-green text-white'
                        : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700'
                } border border-gray-200 dark:border-zinc-700`}
            >
                <img
                    src={currentLang.flag}
                    alt={currentLang.name}
                    className="w-5 h-5 rounded-full object-cover"
                />
                <span className="text-sm font-medium hidden sm:inline">
                    {currentLang.code.toUpperCase()}
                </span>
                <i className={`fa-solid fa-chevron-${isOpen ? 'down' : 'up'} text-xs`}></i>
            </button>
        </div>
    );
};

export default FloatingLanguageButton;
