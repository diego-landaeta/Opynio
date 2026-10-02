import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n, useTranslation } from '../contexts/i18nContext';
import {
    useOwnBusiness,
    getBusinessDashboardPath,
    type DashboardSection,
    type OwnableBusiness,
} from '../utils/businessOwnership';
import { escapeHtml } from '../utils/textUtils';

/**
 * Etiqueta «Tu negocio» para cualquier sitio donde sale una empresa del usuario
 * con sesión. Si la empresa no es suya (o no hay sesión) no pinta nada, así que
 * se puede poner sin condición al lado de cualquier nombre de empresa.
 *
 * La comprobación sale de las empresas que AuthContext ya tiene cargadas, con un
 * índice compartido por todas las tarjetas: ninguna consulta y O(1) por fila.
 */

// Tono esmeralda = familia del verde de marca (brand-green es emerald-500), pero
// más oscuro para el texto: el verde de marca sobre green-50 se quedaba en ~2,4:1.
// Claro: emerald-800 sobre emerald-50 ≈ 7,3:1. Oscuro: emerald-200 sobre
// emerald-900/40 ≈ 10:1 (sobre zinc-800 y zinc-900).
const PILL_SHAPE = 'inline-flex items-center gap-1 rounded-full border font-semibold whitespace-nowrap align-middle max-w-full';
const PILL_LIGHT = 'border-emerald-600/25 bg-emerald-50 text-emerald-800';
const PILL_DARK = 'dark:border-emerald-400/30 dark:bg-emerald-900/40 dark:text-emerald-200';
const PILL = `${PILL_SHAPE} ${PILL_LIGHT} ${PILL_DARK}`;

const SIZES = {
    sm: 'px-2 py-0.5 text-[11px] sm:text-xs leading-4',
    md: 'px-2.5 py-0.5 text-xs sm:text-sm leading-5',
} as const;

/**
 * El badge compacto como HTML, para contenido que no es React (popups de
 * Leaflet). Solo colores claros: el popup de Leaflet es blanco también en tema
 * oscuro, y las variantes dark: sobre blanco se quedaban sin contraste.
 */
export function ownBusinessBadgeHtml(label: string, title: string): string {
    return `<span class="${PILL_SHAPE} ${PILL_LIGHT} ${SIZES.sm}" title="${escapeHtml(title)}" data-own-business-badge="compact">`
        + `<i class="fa-solid fa-store" aria-hidden="true"></i>${escapeHtml(label)}</span>`;
}

interface OwnBusinessBadgeProps {
    business: (OwnableBusiness & { name?: string | null; country?: string | null }) | null | undefined;
    /**
     * Sin valor: solo la etiqueta. Es la que va DENTRO de tarjetas que ya son un
     * enlace o un botón (un <a> dentro de otro <a> o de un <button> es HTML
     * inválido y el clic acaba donde no toca).
     * true o una sección del panel: la etiqueta enlaza al panel de esa empresa
     * y dice «Gestionar».
     */
    manage?: boolean | DashboardSection;
    size?: keyof typeof SIZES;
    className?: string;
}

const OwnBusinessBadge: React.FC<OwnBusinessBadgeProps> = ({ business, manage, size = 'sm', className = '' }) => {
    const t = useTranslation();
    const { language } = useI18n();
    const own = useOwnBusiness(business);
    if (!own || !business) return null;

    const title = t('businessPage.ownBusinessTitle');

    if (!manage) {
        return (
            <span className={`${PILL} ${SIZES[size]} ${className}`} title={title} data-own-business-badge="compact">
                <i className="fa-solid fa-store" aria-hidden="true"></i>
                {t('businessPage.ownBusinessBadge')}
            </span>
        );
    }

    const name = own.name || business.name || '';
    const path = getBusinessDashboardPath(
        { name, country: own.country ?? business.country ?? null },
        typeof manage === 'string' ? manage : undefined,
        language,
    );
    const label = t('businessPage.ownBusinessManageAria', { name });

    return (
        <Link
            to={path}
            // Dentro de tarjetas que se abren/pliegan al pulsar (Explorar): ir al
            // panel no debe además plegar la tarjeta.
            onClick={e => e.stopPropagation()}
            aria-label={label}
            title={label}
            data-own-business-badge="manage"
            className={`${PILL} ${SIZES[size]} group min-h-[28px] hover:bg-emerald-100 dark:hover:bg-emerald-900/70 hover:border-emerald-600/50 dark:hover:border-emerald-300/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-800 ${className}`}
        >
            <i className="fa-solid fa-store" aria-hidden="true"></i>
            <span>{t('businessPage.ownBusinessBadge')}</span>
            <span aria-hidden="true" className="opacity-60">·</span>
            <span className="underline-offset-2 group-hover:underline">{t('businessPage.manageBusiness')}</span>
            <i className="fa-solid fa-arrow-right text-[0.7em]" aria-hidden="true"></i>
        </Link>
    );
};

export default React.memo(OwnBusinessBadge);
