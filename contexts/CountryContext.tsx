
import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { COUNTRIES } from '../constants';

export type CountryCode = typeof COUNTRIES[number]['code'];

interface CountryContextType {
    // País del usuario (preferencia explícita, afecta marca/idioma)
    userCountry: CountryCode | null;
    setUserCountry: (country: CountryCode | null) => void;

    // País de visualización actual (de la URL/página, solo afecta datos)
    viewingCountry: CountryCode | null;
    setViewingCountry: (country: CountryCode | null) => void;

    // Estado de cambio de país
    isChangingCountry: boolean;
    setIsChangingCountry: (loading: boolean) => void;

    // DEPRECADO - Mantener por compatibilidad temporal
    country: CountryCode | null;
    setCountry: (country: CountryCode | null) => void;
}

const CountryContext = createContext<CountryContextType | undefined>(undefined);

export const CountryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // País del usuario (persistido en localStorage)
    const [userCountry, setUserCountry] = useState<CountryCode | null>(() => {
        const savedCountry = localStorage.getItem('opynio_user_country');
        const validCountry = COUNTRIES.some(c => c.code === savedCountry);
        return (validCountry ? savedCountry as CountryCode : null);
    });

    // País de visualización (derivado de URL, NO persistido)
    const [viewingCountry, setViewingCountry] = useState<CountryCode | null>(null);

    const [isChangingCountry, setIsChangingCountry] = useState(false);

    // Persistir userCountry en localStorage
    useEffect(() => {
        if (userCountry) {
            localStorage.setItem('opynio_user_country', userCountry);
        } else {
            localStorage.removeItem('opynio_user_country');
        }
    }, [userCountry]);

    // Compatibilidad temporal: country = userCountry
    const country = userCountry;
    const setCountry = setUserCountry;

    const value = {
        userCountry,
        setUserCountry,
        viewingCountry,
        setViewingCountry,
        isChangingCountry,
        setIsChangingCountry,
        // Deprecados
        country,
        setCountry
    };

    return <CountryContext.Provider value={value}>{children}</CountryContext.Provider>;
};

export const useCountry = () => {
    const context = useContext(CountryContext);
    if (context === undefined) {
        throw new Error('useCountry must be used within a CountryProvider');
    }
    return context;
};
