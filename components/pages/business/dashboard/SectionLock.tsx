import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import { useTranslation } from '../../../../contexts/i18nContext';
import { getSectionAccess, planNameKey, type DashboardSectionId } from '../../../../utils/planFeatures';
import { usePricingHref } from './useDashboardSections';
import LockedFeaturePreview, { isPreviewSection } from './LockedFeaturePreview';

interface SectionLockProps {
    section: DashboardSectionId;
    /** Titulo visible del bloqueo (el nombre de la seccion). */
    title: string;
    /**
     * Obsoleto: el mensaje de plan es siempre «Disponible desde el plan {plan}»
     * (businessDashboard.sectionAvailableFrom), igual en todas las secciones y en
     * el lateral. Se acepta para no romper a quien aun lo pasa; no se usa.
     */
    subtitleKey?: string;
    children: React.ReactNode;
}

/**
 * Bloqueo de una seccion entera del panel de empresa. Habia una copia en cada
 * pantalla (Analiticas, Invitaciones, Productos, Widgets, Perfil) y cada una
 * enlazaba a Planes a su manera: /planes sin pais o el idioma sin pais. Ahora
 * el acceso sale de getSectionAccess (utils/planFeatures, lo mismo que el
 * lateral y el manual) y el enlace, de usePricingHref.
 *
 * - Falta plan en Analiticas, Invitaciones, Productos o Widgets: pantalla de la
 *   funcion con ejemplos, beneficios y planes (LockedFeaturePreview). El pago
 *   queda a un paso, no es lo primero que se ve.
 * - Falta plan en otra seccion: texto «Disponible desde el plan X» y boton a
 *   Planes del pais de la URL.
 * - Enterprise con la funcion apagada por un admin: se dice eso y sin boton
 *   (mejorar el plan no la enciende).
 */
const SectionLock: React.FC<SectionLockProps> = ({ section, title, children }) => {
    const { profile } = useAuth();
    const t = useTranslation();
    const pricingHref = usePricingHref();

    if (!profile) {
        return null;
    }

    const access = getSectionAccess(profile, section);
    if (!access.locked) {
        return <>{children}</>;
    }

    const porPlan = access.reason === 'plan';
    if (porPlan && isPreviewSection(section)) {
        return <LockedFeaturePreview section={section} minPlan={access.minPlan} />;
    }

    const plan = t(planNameKey(access.minPlan));

    return (
        <div className="text-center p-6 sm:p-8 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border-2 border-dashed dark:border-zinc-700">
            <div className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-300 rounded-full w-14 h-14 sm:w-16 sm:h-16 inline-flex items-center justify-center shadow-sm border-4 border-white dark:border-zinc-800 mb-3 sm:mb-4">
                <i className="fa-solid fa-lock text-2xl sm:text-3xl" aria-hidden="true"></i>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100">{title}</h2>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-2 max-w-md mx-auto">
                {porPlan
                    ? t('businessDashboard.sectionAvailableFrom', { plan })
                    : t('businessDashboard.sectionDisabledByAdmin')}
            </p>
            {porPlan && (
                <Link
                    to={pricingHref}
                    className="mt-4 sm:mt-6 inline-block bg-brand-green text-white font-bold px-6 sm:px-8 py-2.5 sm:py-3 rounded-md hover:bg-opacity-90 transition-all shadow-lg shadow-brand-green/30 text-base sm:text-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-green"
                >
                    {t('businessDashboard.upgradePlanButton')}
                </Link>
            )}
        </div>
    );
};

export default SectionLock;
