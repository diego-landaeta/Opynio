
import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { COUNTRIES, isServedUrlPrefix } from '../constants';
import { pathTranslations, getLanguageForCountryCode, useI18n } from './i18nContext';

export type CountryCode = typeof COUNTRIES[number]['code'];

const USER_COUNTRY_STORAGE_KEY = 'opynio_user_country';

interface CountryContextType {
    // País de búsqueda del usuario: su preferencia. Solo la cambian el selector
    // de país (cabecera, home) o la primera visita sin preferencias guardadas
    // (LanguagePopup). Abrir una ficha o una URL de otro país NO la cambia.
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

/** true si el usuario ya tiene país de búsqueda guardado (elegido o de una visita anterior). */
export const hasSavedCountry = (): boolean => {
    try {
        const saved = localStorage.getItem(USER_COUNTRY_STORAGE_KEY);
        return !!saved && COUNTRIES.some(c => c.code === saved);
    } catch {
        return false;
    }
};

/**
 * La misma página en otro país: /es/planes -> /gb/pricing. Se conserva la
 * página si es genérica (explorar, planes, soporte...) traduciendo su ruta al
 * idioma del país de destino; fichas de empresa, paneles y demás rutas con
 * parámetros son propias de un país y van a la home de ese país.
 * (Antes vivía en Header.tsx como `rutaEnPais`; ahora la usa también el aviso
 * de «estás viendo otro país».)
 */
export const pathInCountry = (pathname: string, targetCode: string): string => {
    const destino = `/${targetCode.toLowerCase()}`;
    const segs = pathname.split('/').filter(Boolean);
    // Tambien los alias (/en, /ve, /cn): /cn/探索 -> /de/entdecken, no /de.
    if (segs[0] && isServedUrlPrefix(segs[0])) segs.shift();
    let resto = segs.join('/');
    try { resto = decodeURIComponent(resto); } catch { /* tal cual */ }
    if (!resto) return destino;
    for (const rutas of Object.values(pathTranslations) as Record<string, string>[]) {
        const clave = Object.keys(rutas).find(k => rutas[k] === resto && !rutas[k].includes(':'));
        if (clave) {
            const rutasDestino = (pathTranslations as any)[getLanguageForCountryCode(targetCode)] || pathTranslations.es;
            const traducida = rutasDestino[clave];
            return traducida ? `${destino}/${traducida}` : destino;
        }
    }
    return destino;
};

/**
 * Cambiar de pais de busqueda como el selector de la home: guarda el pais
 * (opynio_user_country), pone el idioma de ese pais (opynio_language, via
 * setLanguage) y lleva a la misma pagina en ese pais (pathInCountry). Lo usan
 * los selectores de la cabecera (home) y Editar perfil, para que hagan
 * exactamente lo mismo. Sin confirmacion ni avisos: eso es de cada pantalla.
 */
export const useSwitchCountry = () => {
    const { setUserCountry } = useCountry();
    const { setLanguage } = useI18n();
    const navigate = useNavigate();
    return useCallback((code: CountryCode) => {
        setUserCountry(code);
        setLanguage(getLanguageForCountryCode(code));
        navigate(pathInCountry(window.location.pathname, code));
    }, [setUserCountry, setLanguage, navigate]);
};

/** Código de país conocido (en cualquier caja: 'it' o 'IT'). */
export const isValidCountryCode = (code: string | null | undefined): boolean =>
    !!code && COUNTRIES.some(c => c.code === code.toUpperCase());

export const CountryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // País del usuario (persistido en localStorage)
    const [userCountry, setUserCountry] = useState<CountryCode | null>(() => {
        let savedCountry: string | null = null;
        try { savedCountry = localStorage.getItem(USER_COUNTRY_STORAGE_KEY); } catch { /* sin almacenamiento */ }
        const validCountry = COUNTRIES.some(c => c.code === savedCountry);
        return (validCountry ? savedCountry as CountryCode : null);
    });

    // País de visualización (derivado de URL, NO persistido)
    const [viewingCountry, setViewingCountry] = useState<CountryCode | null>(null);

    const [isChangingCountry, setIsChangingCountry] = useState(false);

    // Persistir userCountry en localStorage
    useEffect(() => {
        try {
            if (userCountry) {
                localStorage.setItem(USER_COUNTRY_STORAGE_KEY, userCountry);
            } else {
                localStorage.removeItem(USER_COUNTRY_STORAGE_KEY);
            }
        } catch { /* sin almacenamiento */ }
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

/**
 * País del CONTENIDO de la página: el prefijo de la URL (/it/esplora -> IT),
 * que es la versión canónica para buscadores. Sin prefijo (/explorar), el país
 * de búsqueda del usuario. Se lee de la ruta en el mismo render (viewingCountry
 * llega un render tarde y provocaba una carga doble).
 *
 * `isForeign`: la página es de un país distinto del país de búsqueda del
 * usuario. Las páginas lo indican con discreción; la preferencia no cambia.
 */
export const useContentCountry = () => {
    const { userCountry } = useCountry();
    const { countryCode } = useParams<{ countryCode?: string }>();
    const fromUrl: CountryCode | null = countryCode && isValidCountryCode(countryCode)
        ? (countryCode.toUpperCase() as CountryCode)
        : null;
    const contentCountry = fromUrl || userCountry;
    return {
        contentCountry,
        userCountry,
        isForeign: !!(fromUrl && userCountry && fromUrl !== userCountry),
    };
};
