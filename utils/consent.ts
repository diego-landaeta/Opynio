import { useEffect, useState } from 'react';

// Consentimiento de cookies de medicion y publicidad (Meta Pixel y su
// Conversions API). Sin respuesta o con «rechazar», no se carga el script de
// Meta ni se envia ningun evento (index.html y utils/metaPixel.ts leen esto).
// Solo vive en este navegador: la misma clave la lee el <script> de index.html.

export type CookieConsent = 'granted' | 'denied' | null;

export const CONSENT_KEY = 'opynio_cookie_consent';
const EVENT = 'opynio:consent';

declare global {
    interface Window {
        opynioLoadPixel?: () => void;
    }
}

export const getCookieConsent = (): CookieConsent => {
    try {
        const v = localStorage.getItem(CONSENT_KEY);
        return v === 'granted' || v === 'denied' ? v : null;
    } catch {
        return null;
    }
};

export const hasMarketingConsent = () => getCookieConsent() === 'granted';

// Borra las cookies propias de Meta (_fbp, _fbc) en este dominio y el padre.
const borrarCookiesMeta = () => {
    const host = window.location.hostname;
    const dominios = ['', host, `.${host}`, `.${host.split('.').slice(-2).join('.')}`];
    for (const nombre of ['_fbp', '_fbc']) {
        for (const d of dominios) {
            document.cookie = `${nombre}=; Max-Age=0; path=/${d ? `; domain=${d}` : ''}`;
        }
    }
};

export const setCookieConsent = (value: 'granted' | 'denied') => {
    try { localStorage.setItem(CONSENT_KEY, value); } catch { /* sin almacenamiento: vale para esta visita */ }
    if (value === 'granted') {
        window.opynioLoadPixel?.();
        window.fbq?.('consent', 'grant');
    } else {
        // El script ya cargado no se puede descargar: se le retira el permiso.
        window.fbq?.('consent', 'revoke');
        borrarCookiesMeta();
    }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: value }));
};

export const useCookieConsent = (): CookieConsent => {
    const [value, setValue] = useState<CookieConsent>(getCookieConsent);
    useEffect(() => {
        const actualizar = () => setValue(getCookieConsent());
        window.addEventListener(EVENT, actualizar);
        window.addEventListener('storage', actualizar);
        return () => {
            window.removeEventListener(EVENT, actualizar);
            window.removeEventListener('storage', actualizar);
        };
    }, []);
    return value;
};
