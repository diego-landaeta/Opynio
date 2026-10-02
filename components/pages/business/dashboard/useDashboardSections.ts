import { useMemo } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';
import { useCountry } from '../../../../contexts/CountryContext';
import { useI18n, useTranslation, pathTranslations, localizedPath } from '../../../../contexts/i18nContext';
import { DASHBOARD_SECTIONS, getSectionAccess, planNameKey, type DashboardSectionDef, type SectionAccess } from '../../../../utils/planFeatures';

export interface DashboardSectionLink extends DashboardSectionDef {
    label: string;
    /** Subruta relativa a la raiz del panel ('.' = el resumen). */
    subpath: string;
    access: SectionAccess;
    /** Por que esta bloqueada (tooltip y lector de pantalla); '' si esta abierta. */
    lockText: string;
}

/**
 * Planes en el pais y el idioma de la URL actual (/es/planes, /gb/pricing). Es
 * el destino de todo lo bloqueado del panel: lateral, manual, bloqueos de cada
 * seccion y campos de pago del perfil.
 */
export const usePricingHref = (): string => {
    const { language } = useI18n();
    const { country } = useCountry();
    return localizedPath('pricing', language, country);
};

/**
 * Secciones del panel con su estado de bloqueo para el usuario actual. Lo usan
 * el lateral y el manual, para que los dos enlacen igual y digan lo mismo.
 */
export const useDashboardSections = () => {
    const { profile } = useAuth();
    const t = useTranslation();
    const pricingHref = usePricingHref();

    const sections = useMemo<DashboardSectionLink[]>(() => {
        // Las subrutas del panel van siempre con el segmento en español: es lo
        // que ha usado siempre el lateral y el router las acepta en cualquier idioma.
        const rutasPanel = pathTranslations.es;
        return DASHBOARD_SECTIONS.map(def => {
            const access = getSectionAccess(profile, def.id);
            const lockText = !access.locked
                ? ''
                : access.reason === 'disabled'
                    ? t('businessDashboard.sectionDisabledByAdmin')
                    : t('businessDashboard.sectionAvailableFrom', { plan: t(planNameKey(access.minPlan)) });
            return {
                ...def,
                label: t(def.labelKey),
                subpath: def.pathKey ? rutasPanel[def.pathKey] : '.',
                access,
                lockText,
            };
        });
    }, [profile, t]);

    return { sections, pricingHref };
};
