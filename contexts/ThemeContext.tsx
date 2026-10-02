import React, { createContext, useState, useEffect, useContext, useCallback, ReactNode } from 'react';
import type { ThemePreference } from '../types';

// --- Theme Context for Dark Mode ---
// Antes vivia en App.tsx y Header lo importaba de '../App' (import circular).
// Con la recarga en caliente, editar App.tsx creaba un ThemeContext nuevo que
// la cabecera ya recargada leia sin proveedor: «useTheme must be used within a
// ThemeProvider» y la pagina (p. ej. /gb, o el login) se quedaba en el error.
// En su propio modulo el contexto es siempre el mismo.
//
// Preferencia (lo que elige el usuario) frente a tema (lo que se ve):
//   'light' / 'dark' -> localStorage.theme con ese valor (como siempre).
//   'system'         -> sin localStorage.theme: sigue al sistema, tambien si
//                       cambia con la pagina abierta.
// El boton de la cabecera (toggleTheme) fija 'light' o 'dark' como antes.
type Theme = 'light' | 'dark';
interface ThemeContextType {
    theme: Theme;
    preference: ThemePreference;
    toggleTheme: (event: React.MouseEvent) => void;
    setThemePreference: (pref: ThemePreference) => void;
}
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const readPreference = (): ThemePreference => {
    try {
        const saved = localStorage.getItem('theme');
        return saved === 'dark' || saved === 'light' ? saved : 'system';
    } catch { return 'system'; }
};
const systemTheme = (): Theme =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
const resolve = (pref: ThemePreference): Theme => (pref === 'system' ? systemTheme() : pref);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [preference, setPreference] = useState<ThemePreference>(readPreference);
    const [theme, setTheme] = useState<Theme>('light');

    // Aplica la clase `dark` segun la preferencia; con 'system', tambien cuando
    // el sistema cambia de claro a oscuro con la pagina abierta.
    useEffect(() => {
        const apply = () => {
            const next = resolve(preference);
            document.documentElement.classList.toggle('dark', next === 'dark');
            setTheme(next);
        };
        apply();
        if (preference !== 'system' || !window.matchMedia) return;
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        mq.addEventListener?.('change', apply);
        return () => mq.removeEventListener?.('change', apply);
    }, [preference]);

    const setThemePreference = useCallback((pref: ThemePreference) => {
        try {
            if (pref === 'system') localStorage.removeItem('theme');
            else localStorage.setItem('theme', pref);
        } catch { /* sin almacenamiento: se aplica igual en esta pestana */ }
        setPreference(pref);
    }, []);

    const toggleTheme = (event: React.MouseEvent) => {
        const isDark = document.documentElement.classList.contains('dark');
        const newTheme: Theme = isDark ? 'light' : 'dark';

        // @ts-ignore
        if (!document.startViewTransition) {
            setThemePreference(newTheme);
            return;
        }

        const x = event.clientX;
        const y = event.clientY;

        // @ts-ignore
        document.startViewTransition(() => {
            const root = document.documentElement;
            root.style.setProperty('--x', x + 'px');
            root.style.setProperty('--y', y + 'px');
            // La clase se cambia dentro de la transicion (la animacion la
            // necesita ya); el efecto de arriba la deja igual.
            root.classList.toggle('dark', newTheme === 'dark');
            setThemePreference(newTheme);
        });
    };

    const value = { theme, preference, toggleTheme, setThemePreference };
    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
