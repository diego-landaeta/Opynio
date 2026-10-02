import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useI18n, useTranslation, isSupportedLanguage, getLanguageForCountryCode, Language } from '../contexts/i18nContext';
import { useCountry, useSwitchCountry, isValidCountryCode, CountryCode } from '../contexts/CountryContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNotification } from '../contexts/NotificationContext';
import { updateUserProfile } from '../services/supabaseService';
import { markProfilePreferencesApplied } from './useProfilePreferencesSync';
import { LANGUAGES, COUNTRIES } from '../constants';
import type { ThemePreference } from '../types';

// Idioma, pais y tema: lo mismo desde el engranaje de la cabecera (cualquier
// visitante) y desde «Editar perfil». Se aplica al momento en este navegador;
// con sesion, ademas se guarda en el perfil para otros dispositivos.

// Los 31 idiomas cableados en i18nContext, con su nombre nativo.
export const LANGUAGE_OPTIONS = LANGUAGES.filter(l => isSupportedLanguage(l.code));

export const THEME_OPTIONS: { value: ThemePreference; icon: string; labelKey: string }[] = [
    { value: 'system', icon: 'fa-circle-half-stroke', labelKey: 'editProfile.themeSystem' },
    { value: 'light', icon: 'fa-sun', labelKey: 'editProfile.themeLight' },
    { value: 'dark', icon: 'fa-moon', labelKey: 'editProfile.themeDark' },
];

export type PrefStatus = 'idle' | 'saving' | 'saved' | 'error';

export const usePreferenceActions = () => {
    const { user, setProfile } = useAuth();
    const { requestedLanguage, setLanguage } = useI18n();
    const t = useTranslation();
    const { country } = useCountry();
    const switchCountry = useSwitchCountry();
    const { preference: themePreference, setThemePreference } = useTheme();
    const { showNotification } = useNotification();
    const [status, setStatus] = useState<PrefStatus>('idle');

    // Antes se marca como «aplicado» (useProfilePreferencesSync) para que el
    // perfil guardado no se vuelva a aplicar encima. Si falla (p. ej. sin la
    // migracion 20260925100000), la preferencia sigue valiendo en este navegador.
    const save = useCallback(async (updates: { preferred_language?: string; preferred_country?: string; theme?: ThemePreference }) => {
        if (!user) return;
        markProfilePreferencesApplied(user.id);
        setStatus('saving');
        try {
            const updated = await updateUserProfile(user.id, updates);
            if (updated) setProfile(updated);
            setStatus('saved');
        } catch (err) {
            console.error('No se pudieron guardar las preferencias en el perfil:', err);
            setStatus('error');
        }
    }, [user, setProfile]);

    // Como los selectores de idioma de la home: solo cambia el idioma, sin navegar.
    const changeLanguage = useCallback((lang: string) => {
        if (!isSupportedLanguage(lang) || lang === requestedLanguage) return;
        setLanguage(lang as Language);
        void save({ preferred_language: lang });
    }, [requestedLanguage, setLanguage, save]);

    // Como el selector de pais de la home (useSwitchCountry): pais, idioma de
    // ese pais y esta misma pagina en ese pais.
    const changeCountry = useCallback((code: string) => {
        if (!isValidCountryCode(code) || code === country) return;
        const target = COUNTRIES.find(c => c.code === code);
        void save({ preferred_country: code, preferred_language: getLanguageForCountryCode(code) });
        switchCountry(code as CountryCode);
        if (target) showNotification(t('common.countryChanged', { country: target.name }), 'success');
    }, [country, save, switchCountry, showNotification, t]);

    const changeTheme = useCallback((pref: ThemePreference) => {
        if (pref === themePreference) return;
        setThemePreference(pref);
        void save({ theme: pref });
    }, [themePreference, setThemePreference, save]);

    return {
        isLoggedIn: !!user,
        requestedLanguage,
        country,
        themePreference,
        status,
        changeLanguage,
        changeCountry,
        changeTheme,
    };
};
