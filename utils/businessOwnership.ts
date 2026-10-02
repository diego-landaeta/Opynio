import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCountry } from '../contexts/CountryContext';
import { useI18n, pathTranslations, getLanguageForCountryCode, localizedPathOrRoot, type Language } from '../contexts/i18nContext';
import type { Business } from '../types';

/** Secciones del panel de empresa que se pueden abrir directamente. */
export type DashboardSection =
    | 'dashboardReviews'
    | 'dashboardAnalytics'
    | 'dashboardInvitations'
    | 'dashboardWidgets'
    | 'dashboardProducts'
    | 'dashboardEdit';

/**
 * Ruta del panel de una empresa, con el mismo criterio que "Mis negocios":
 * idioma y prefijo del país de la empresa (o el idioma actual si no tiene país).
 */
export function getBusinessDashboardPath(
    business: Pick<Business, 'name'> & { country?: string | null },
    section?: DashboardSection,
    fallbackLanguage: Language = 'es',
): string {
    const lang = business.country ? getLanguageForCountryCode(business.country) : fallbackLanguage;
    const rutas = pathTranslations[lang] ?? pathTranslations.es;
    const prefijo = business.country ? `/${business.country.toLowerCase()}` : '';
    const base = `${prefijo}/${rutas.businessDashboard.replace(':businessName', encodeURIComponent(business.name.trim().replace(/ /g, '_')))}`;
    return section ? `${base}/${rutas[section]}` : base;
}

/** Lo mínimo de una fila de empresa para saber si es del usuario. */
export type OwnableBusiness = { id: string; owner_id?: string | null };

// Índice id -> empresa de la lista de AuthContext. Se guarda por referencia de
// la lista (WeakMap): todas las tarjetas de una página comparten el mismo Map y
// se rehace solo cuando AuthContext cambia la lista. Así, 100 tarjetas con badge
// cuestan 100 búsquedas O(1), no 100 recorridos de la lista.
const indicePorLista = new WeakMap<Business[], Map<string, Business>>();
function indiceDe(businesses: Business[]): Map<string, Business> {
    let indice = indicePorLista.get(businesses);
    if (!indice) {
        indice = new Map(businesses.map(b => [b.id, b]));
        indicePorLista.set(businesses, indice);
    }
    return indice;
}

function buscarPropia(
    business: OwnableBusiness | null | undefined,
    userId: string | undefined,
    businesses: Business[],
): Business | null {
    if (!business || !userId) return null;
    const propia = indiceDe(businesses).get(business.id);
    if (propia) return propia;
    return business.owner_id && business.owner_id === userId ? (business as Business) : null;
}

/**
 * Empresa del usuario con ese id, o null. Usa las empresas que AuthContext ya
 * cargó (sin consultas extra); el owner_id de la fila cubre el caso de que la
 * lista aún no esté cargada.
 */
export function useOwnBusiness(business: OwnableBusiness | null | undefined): Business | null {
    const { user, businesses } = useAuth();
    return buscarPropia(business, user?.id, businesses);
}

/**
 * La misma comprobación como función, para código que no puede llamar a un
 * hook por fila (p. ej. los popups del mapa, que son HTML de Leaflet). Su
 * identidad solo cambia si cambian el usuario o sus empresas: sirve como
 * dependencia de un efecto.
 */
export function useOwnBusinessLookup(): (business: OwnableBusiness | null | undefined) => Business | null {
    const { user, businesses } = useAuth();
    const userId = user?.id;
    return useCallback(
        (business: OwnableBusiness | null | undefined) => buscarPropia(business, userId, businesses),
        [userId, businesses],
    );
}

/**
 * Destino de los CTA de "empezar gratis / registra tu empresa":
 * - sin sesión: registro de empresa (como siempre);
 * - con sesión y UNA empresa: su panel (en la sección pedida, p. ej. widgets);
 * - con sesión y VARIAS: "Mis negocios", para que elija cuál (el panel es por
 *   empresa y elegir la primera sería arbitrario);
 * - con sesión y sin empresa: el asistente de alta, nunca un registro nuevo;
 * - admin sin empresas propias: "Mis negocios" (el asistente lo pasaría a
 *   business_owner).
 */
export function useBusinessStartPath(section?: DashboardSection): string {
    const { user, profile, businesses } = useAuth();
    const { country } = useCountry();
    const { language } = useI18n();
    // Prefijo del pais con el segmento en el idioma de ESE pais: con las rutas
    // del idioma de la UI, /es + «register» daba 404 al que tenia la UI en ingles.
    const ruta = (key: 'register' | 'myBusinesses' | 'completeBusinessRegistration') =>
        localizedPathOrRoot(key, language, country);

    if (!user) return `${ruta('register')}?type=business`;
    if (businesses.length === 1) return getBusinessDashboardPath(businesses[0], section, language);
    if (businesses.length > 1 || profile?.role === 'admin') return ruta('myBusinesses');
    return `${ruta('completeBusinessRegistration')}?type=business`;
}
