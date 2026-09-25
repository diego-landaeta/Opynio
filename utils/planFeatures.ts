import type { Plan, Profile } from '../types';

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
    profile: Pick<Profile, 'plan' | 'feature_permissions'> | null | undefined,
    id: DashboardSectionId,
): SectionAccess => {
    const def = DASHBOARD_SECTIONS.find(s => s.id === id)!;
    if (!hasPlanAccess(profile?.plan, def.minPlan)) {
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
