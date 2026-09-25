import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useI18n, isSupportedLanguage, getLanguageForCountryCode } from '../contexts/i18nContext';
import { useCountry, isValidCountryCode, CountryCode } from '../contexts/CountryContext';
import { useTheme } from '../contexts/ThemeContext';
import type { ThemePreference } from '../types';

/**
 * Preferencias guardadas en el perfil (idioma, pais de busqueda y tema, ver
 * 20260925100000_profile_preferences) -> este navegador, UNA vez por inicio de
 * sesion.
 *
 * - Se aplican cuando llega el perfil de un usuario para el que este navegador
 *   aun no las aplico (marca en localStorage con su id). Asi, al entrar en otro
 *   dispositivo la web se pone en su idioma, su pais y su tema.
 * - Despues no se vuelven a aplicar: lo que el usuario elija a mano (selectores
 *   de la home, boton de tema, Editar perfil) manda hasta que cierre sesion. Un
 *   cambio de perfil que llegue por realtime desde otro dispositivo tampoco
 *   pisa lo de este.
 * - Al cerrar sesion se borra la marca: el siguiente inicio de sesion vuelve a
 *   aplicar lo guardado.
 * - Sin nada guardado no se marca: cuando se guarde algo (desde otro
 *   dispositivo, o aqui, que marca antes de guardar) se aplicara.
 *
 * No navega: aplicar el pais no cambia la URL de la pagina que se esta viendo
 * (como la preferencia de pais en general: la URL es el pais del contenido).
 * Tampoco hace nada al abrir fichas: solo mira el perfil.
 */
const APPLIED_KEY = 'opynio_profile_prefs_applied';

/** Marca las preferencias del perfil como ya aplicadas en este navegador. */
export const markProfilePreferencesApplied = (userId: string) => {
    try { localStorage.setItem(APPLIED_KEY, userId); } catch { /* sin almacenamiento */ }
};

const readApplied = (): string | null => {
    try { return localStorage.getItem(APPLIED_KEY); } catch { return null; }
};

const isThemePreference = (v: unknown): v is ThemePreference => v === 'light' || v === 'dark' || v === 'system';

export const useProfilePreferencesSync = () => {
    const { user, profile, loading } = useAuth();
    const { setLanguage } = useI18n();
    const { setUserCountry } = useCountry();
    const { setThemePreference } = useTheme();

    useEffect(() => {
        if (loading) return;
        if (!user) {
            try { localStorage.removeItem(APPLIED_KEY); } catch { /* sin almacenamiento */ }
            return;
        }
        if (!profile || profile.id !== user.id) return;
        if (readApplied() === user.id) return;

        const lang = isSupportedLanguage(profile.preferred_language) ? profile.preferred_language : null;
        const country = isValidCountryCode(profile.preferred_country)
            ? (profile.preferred_country!.toUpperCase() as CountryCode)
            : null;
        const theme = isThemePreference(profile.theme) ? profile.theme : null;
        if (!lang && !country && !theme) return;

        // Primero el pais y despues el idioma: el idioma guardado manda sobre
        // el del pais (alguien en GB que lee en espanol).
        if (country) setUserCountry(country);
        if (lang) setLanguage(lang);
        else if (country) setLanguage(getLanguageForCountryCode(country));
        if (theme) setThemePreference(theme);
        markProfilePreferencesApplied(user.id);
    }, [loading, user, profile, setLanguage, setUserCountry, setThemePreference]);
};
