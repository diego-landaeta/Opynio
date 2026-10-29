import type { Plan, Profile } from '../types';
import { AI_ENABLED } from '../services/geminiService';

/**
 * Qué plan desbloquea cada cosa del panel de empresa. UNICA fuente de verdad:
 * la usan el lateral (candados), el manual del panel, los bloqueos de cada
 * sección y la edición del perfil. Si cambia un plan, se cambia aquí y nada más.
 *
 * El plan es el del USUARIO (profiles.plan), no el de la empresa.
 */

// 'v2' (premium de prueba) desbloquea lo mismo que enterprise.
export const PLAN_HIERARCHY: Record<Plan, number> = {
    free: 0,
    starter: 1,
    growth: 2,
    pro: 3,
    v2: 4,
    enterprise: 4,
};

export const hasPlanAccess = (current: Plan | null | undefined, required: Plan): boolean =>
    (PLAN_HIERARCHY[current ?? 'free'] ?? 0) >= PLAN_HIERARCHY[required];

/**
 * ¿Esta en la prueba gratuita con acceso completo (issue #11)? La fecha la escribe el webhook de Stripe
 * mientras la suscripcion esta en 'trialing'; el servidor aplica la misma regla (plan_efectivo, migracion
 * 20261026100000). Pasada la fecha, o sin ella, no hay acceso completo.
 */
export const hasFullAccessTrial = (
    profile: Pick<Profile, 'trial_full_access_until'> | null | undefined,
    now: number = Date.now(),
): boolean => {
    const fin = profile?.trial_full_access_until ? Date.parse(profile.trial_full_access_until) : NaN;
    return Number.isFinite(fin) && fin > now;
};

/**
 * Plan con el que se DECIDE el acceso: durante la prueba, el mas alto; despues, el que eligio.
 * profiles.plan (el elegido, el que se cobrara) no cambia: para MOSTRAR el plan se sigue usando ese.
 */
export const effectivePlan = (
    profile: Pick<Profile, 'plan' | 'trial_full_access_until'> | null | undefined,
): Plan => (hasFullAccessTrial(profile) ? 'enterprise' : (profile?.plan ?? 'free'));

/** Clave de traducción con el nombre visible de un plan. */
export const planNameKey = (plan: Plan): string =>
    `businessDashboard.${plan === 'v2' ? 'pro' : plan}PlanName`;

export type DashboardSectionId =
    | 'overview' | 'reviews' | 'analytics' | 'invitations'
    | 'products' | 'widgets' | 'profile' | 'manual';

export interface DashboardSectionDef {
    id: DashboardSectionId;
    /** Clave de pathTranslations; null = la raíz del panel (el resumen). */
    pathKey: 'dashboardReviews' | 'dashboardAnalytics' | 'dashboardInvitations' | 'dashboardProducts'
        | 'dashboardWidgets' | 'dashboardEdit' | 'dashboardUserManual' | null;
    icon: string;
    labelKey: string;
    minPlan: Plan;
    /** Clave en profiles.feature_permissions (enterprise; ver AdminEnterprisePage). */
    permissionId: string;
}

// En el orden del lateral.
export const DASHBOARD_SECTIONS: readonly DashboardSectionDef[] = [
    { id: 'overview', pathKey: null, icon: 'fa-chart-pie', labelKey: 'businessDashboard.dashboardOverview', minPlan: 'free', permissionId: 'resumen' },
    { id: 'reviews', pathKey: 'dashboardReviews', icon: 'fa-comments', labelKey: 'businessDashboard.dashboardReviews', minPlan: 'free', permissionId: 'reseñas' },
    { id: 'analytics', pathKey: 'dashboardAnalytics', icon: 'fa-magnifying-glass-chart', labelKey: 'businessDashboard.dashboardAnalytics', minPlan: 'growth', permissionId: 'analiticas' },
    { id: 'invitations', pathKey: 'dashboardInvitations', icon: 'fa-paper-plane', labelKey: 'businessDashboard.dashboardInvitations', minPlan: 'starter', permissionId: 'invitaciones' },
    { id: 'products', pathKey: 'dashboardProducts', icon: 'fa-box-open', labelKey: 'businessDashboard.dashboardProducts', minPlan: 'starter', permissionId: 'productos' },
    { id: 'widgets', pathKey: 'dashboardWidgets', icon: 'fa-puzzle-piece', labelKey: 'businessDashboard.dashboardWidgets', minPlan: 'starter', permissionId: 'widgets' },
    // El perfil es gratis: una empresa recien creada tiene que poder poner su
    // telefono, horario y ubicacion. Lo de pago va dentro (PROFILE_PAID_*).
    { id: 'profile', pathKey: 'dashboardEdit', icon: 'fa-store', labelKey: 'businessDashboard.dashboardProfile', minPlan: 'free', permissionId: 'perfil_de_empresa' },
    { id: 'manual', pathKey: 'dashboardUserManual', icon: 'fa-book-open', labelKey: 'businessDashboard.dashboardUserManual', minPlan: 'free', permissionId: 'manual_de_usuario' },
];

export const sectionMinPlan = (id: DashboardSectionId): Plan =>
    DASHBOARD_SECTIONS.find(s => s.id === id)!.minPlan;

export interface SectionAccess {
    locked: boolean;
    /** 'plan': su plan no llega. 'disabled': enterprise con la función apagada por un admin. */
    reason: 'plan' | 'disabled' | null;
    minPlan: Plan;
}

export const getSectionAccess = (
    profile: Pick<Profile, 'plan' | 'feature_permissions' | 'trial_full_access_until'> | null | undefined,
    id: DashboardSectionId,
): SectionAccess => {
    const def = DASHBOARD_SECTIONS.find(s => s.id === id)!;
    if (!hasPlanAccess(effectivePlan(profile), def.minPlan)) {
        return { locked: true, reason: 'plan', minPlan: def.minPlan };
    }
    if (profile?.plan === 'enterprise' && profile.feature_permissions) {
        const permisos = profile.feature_permissions as Record<string, boolean>;
        if (permisos[def.permissionId] === false) return { locked: true, reason: 'disabled', minPlan: def.minPlan };
    }
    return { locked: false, reason: null, minPlan: def.minPlan };
};

/**
 * Perfil de empresa: lo que da ventaja (marca y alcance) es de pago; los datos
 * que hacen util la ficha (nombre, descripcion, categoria, pais, ubicacion,
 * telefono, email, web, horarios) se editan en todos los planes.
 */
export const PROFILE_PAID_MIN_PLAN: Plan = 'starter';

/** Columnas de `businesses` que solo se escriben con PROFILE_PAID_MIN_PLAN o superior. */
export const PROFILE_PAID_FIELDS = ['logo_url', 'social_links', 'sedes', 'offers_international_services'] as const;

export const canEditPaidProfileFields = (plan: Plan | null | undefined): boolean =>
    hasPlanAccess(plan, PROFILE_PAID_MIN_PLAN);

/** Quita de un update las columnas de pago si el plan no llega (no las toca: conserva lo que hubiera). */
export const withoutPaidProfileFields = <T extends Record<string, unknown>>(updates: T, plan: Plan | null | undefined): Partial<T> => {
    if (canEditPaidProfileFields(plan)) return updates;
    const limpio: Record<string, unknown> = { ...updates };
    for (const campo of PROFILE_PAID_FIELDS) delete limpio[campo];
    return limpio as Partial<T>;
};

/**
 * Funciones que anuncia la pagina de Planes y que TODAVIA no existen en el panel
 * (revision QA del 23/10/2026: se buscaron una a una en el codigo y en el navegador).
 * UNICA fuente: la usan la pagina de Planes y «Mis negocios» para marcarlas
 * «Proximamente» en vez de venderlas como incluidas. Al implementar una, quitar
 * su clave de aqui.
 */
const FUNCIONES_PROXIMAMENTE: ReadonlySet<string> = new Set([
    "pricingPage.starterFeature5",    // Filtros basicos de reseñas (el panel no tiene filtros)
    "pricingPage.starterFeature6",    // Exportacion de datos (CSV)
    "pricingPage.starterFeature7",    // Integracion con Google Reviews
    "pricingPage.growthFeature5",     // Archivo de reseñas
    "pricingPage.growthFeature9",     // Acceso a API
    "pricingPage.growthFeature10",    // Informes de rendimiento
    "pricingPage.proFeature3",        // Invitaciones por WhatsApp (solo existe «compartir»)
    "pricingPage.proFeature4",        // Etiquetado avanzado de reseñas
    "pricingPage.proFeature5",        // Filtros de sentimiento con IA
    "pricingPage.proFeature6",        // Alertas de reseñas negativas
    "pricingPage.proFeature7",        // Comparacion con competidores
    "pricingPage.proFeature8",        // Mayor limite de API
    "pricingPage.proFeature9",        // Soporte prioritario
    "pricingPage.enterpriseFeature2", // Invitaciones ilimitadas (hoy: 200 al dia y 50 por envio)
    "pricingPage.enterpriseFeature7", // Informes ejecutivos en PDF
]);

// Dependen de la IA, que esta apagada a proposito (services/geminiService.ts).
const FUNCIONES_CON_IA: ReadonlySet<string> = new Set([
    "pricingPage.starterFeature4",
    "pricingPage.growthFeature8",
    "pricingPage.enterpriseFeature4",
]);

export const isPlanFeatureComingSoon = (key: string): boolean =>
    FUNCIONES_PROXIMAMENTE.has(key) || (!AI_ENABLED && FUNCIONES_CON_IA.has(key));
