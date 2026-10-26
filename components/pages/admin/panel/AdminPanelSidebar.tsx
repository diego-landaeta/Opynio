import React, { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import BusinessLogo from '../../../BusinessLogo';
import { useAuth } from '../../../../contexts/AuthContext';
import { useCountry } from '../../../../contexts/CountryContext';
import { useI18n, useTranslation, pathTranslations, getLocaleFromLanguage } from '../../../../contexts/i18nContext';
import { useNumberFormats } from './overviewUtils';

/** Cola con su contador. `late` = lo que espera lleva mas de 3 dias. */
export interface QueueCount {
    count: number | null | undefined;
    late?: boolean;
}

export interface SidebarQueues {
    moderation: QueueCount;
    claims: QueueCount;
    appeals: QueueCount;
    bugs: QueueCount;
    support: QueueCount;
}

interface NavItem {
    key: string;
    to: string;
    icon: string;
    label: string;
    queue?: QueueCount;
    current?: boolean;
}

const es = pathTranslations.es;

const normalizar = (ruta: string): string => ruta.replace(/\/+$/, '') || '/';
const esActual = (pathname: string, to: string): boolean => {
    const p = normalizar(pathname);
    const t = normalizar(to);
    return p === t || p.startsWith(t + '/');
};

const BAR_FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green';

const NavList: React.FC<{ items: NavItem[]; onNavigate?: () => void }> = ({ items, onNavigate }) => {
    const t = useTranslation();
    const { language } = useI18n();
    const f = useNumberFormats(getLocaleFromLanguage(language));
    return (
        <ul className="space-y-1">
            {items.map(item => {
                const count = item.queue?.count;
                const show = typeof count === 'number' && count > 0;
                return (
                    <li key={item.key}>
                        <Link
                            to={item.to}
                            onClick={onNavigate}
                            aria-current={item.current ? 'page' : undefined}
                            className={`flex items-center gap-3 px-3 py-2 min-h-[44px] lg:min-h-[40px] rounded-lg text-sm font-semibold transition-colors ${BAR_FOCUS} ${
                                item.current
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-brand-green/10 dark:text-emerald-400'
                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700'
                            }`}
                        >
                            <i
                                className={`fa-solid ${item.icon} w-5 text-center flex-shrink-0 ${item.current ? 'text-brand-green' : 'text-gray-500 dark:text-gray-400'}`}
                                aria-hidden="true"
                            ></i>
                            {/* Una sola linea siempre: si un idioma no cabe, se acorta la clave. */}
                            <span className="min-w-0 flex-1 truncate whitespace-nowrap" title={item.label}>{item.label}</span>
                            {show && (
                                <span
                                    className={`flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full tabular-nums ${
                                        item.queue?.late
                                            ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                                            : 'bg-gray-100 text-gray-600 dark:bg-zinc-700 dark:text-gray-300'
                                    }`}
                                >
                                    <span aria-hidden="true">{f.badge(count as number)}</span>
                                    <span className="sr-only">
                                        {t(item.queue?.late ? 'adminDashboard.ovBadgeLateSr' : 'adminDashboard.ovBadgeSr', { count: f.n(count as number) })}
                                    </span>
                                </span>
                            )}
                        </Link>
                    </li>
                );
            })}
        </ul>
    );
};

/** Los tres grupos de enlaces con el apartado actual marcado por la ruta, y el apartado actual (para la barra movil). */
const useNavGroups = (queues: SidebarQueues, pathname: string) => {
    const t = useTranslation();
    const { country } = useCountry();
    const tk = (k: string) => t(`adminDashboard.${k}`);

    const colasBase: NavItem[] = [
        { key: 'summary', to: '/admin/panel', icon: 'fa-chart-pie', label: tk('ovNavSummary') },
        { key: 'moderation', to: `/${es.adminReviewModeration}`, icon: 'fa-comments', label: tk('ovNavModeration'), queue: queues.moderation },
        { key: 'claims', to: `/${es.adminClaims}`, icon: 'fa-user-shield', label: tk('ovNavClaims'), queue: queues.claims },
        { key: 'appeals', to: `/${es.adminReviewAppeals}`, icon: 'fa-scale-balanced', label: tk('ovNavAppeals'), queue: queues.appeals },
        { key: 'bugs', to: `/${es.adminBugs}`, icon: 'fa-bug', label: tk('ovNavBugs'), queue: queues.bugs },
        { key: 'support', to: '/admin/soporte', icon: 'fa-headset', label: tk('ovNavSupport'), queue: queues.support },
    ];
    const datosBase: NavItem[] = [
        { key: 'users', to: `/${es.adminUsers}`, icon: 'fa-users', label: tk('users') },
        { key: 'enterprise', to: `/${es.adminEnterprise}`, icon: 'fa-building', label: tk('enterprisePlan') },
        { key: 'featured', to: `/${es.adminFeatured}`, icon: 'fa-star', label: tk('ovNavFeatured') },
        { key: 'urls', to: `/${es.adminUrls}`, icon: 'fa-link', label: tk('ovNavUrls') },
        { key: 'create', to: `/${es.adminCreateBusiness}`, icon: 'fa-circle-plus', label: tk('createBusiness') },
        { key: 'scraping', to: `/${es.adminScraping}`, icon: 'fa-robot', label: tk('scraping') },
        { key: 'bulk', to: `/${es.adminBulkEdit}`, icon: 'fa-pen-to-square', label: tk('ovNavBulk') },
    ];
    const salidasBase: NavItem[] = [
        { key: 'performance', to: '/admin/rendimiento', icon: 'fa-gauge-high', label: tk('ovPerformance') },
        { key: 'site', to: country ? `/${country.toLowerCase()}` : '/', icon: 'fa-arrow-left', label: tk('ovBackSite') },
    ];

    // El apartado actual sale de la ruta (coincidencia exacta o una subruta: /admin/empresa/editar/:id no tiene enlace propio).
    const marcar = (items: NavItem[]): NavItem[] => items.map(i => ({ ...i, current: i.key !== 'site' && esActual(pathname, i.to) }));
    const colas = marcar(colasBase);
    const datos = marcar(datosBase);
    const salidas = marcar(salidasBase);
    const actual = [...colas, ...datos, ...salidas].find(i => i.current) ?? { icon: 'fa-shield-halved', label: tk('ovAdminName') };
    return { colas, datos, salidas, actual, tk };
};

/** Contenido de la barra: identidad arriba y tres grupos de enlaces. */
const SidebarContent: React.FC<{ queues: SidebarQueues; pathname: string; onNavigate?: () => void }> = ({ queues, pathname, onNavigate }) => {
    const { profile } = useAuth();
    const { colas, datos, salidas, tk } = useNavGroups(queues, pathname);

    return (
        <nav aria-label={tk('ovNavAria')}>
            <div className="flex items-center gap-3 border-b dark:border-zinc-700 pb-3 mb-2">
                <BusinessLogo
                    logoUrl={null}
                    businessName=""
                    className="w-12 h-12"
                    iconSize="text-xl"
                    fallbackIcon="fa-shield-halved"
                    rounded="rounded-lg"
                    defaultChip="bg-gray-100 dark:bg-zinc-700 shadow-sm border-gray-200 dark:border-zinc-600"
                />
                <div className="min-w-0">
                    <p className="font-bold text-base text-gray-800 dark:text-gray-100 truncate">{tk('ovAdminName')}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{profile?.name || profile?.username || 'Opynio'}</p>
                </div>
            </div>
            <NavList items={colas} onNavigate={onNavigate} />
            <div className="my-2 border-t dark:border-zinc-700" role="separator" />
            <NavList items={datos} onNavigate={onNavigate} />
            <div className="my-2 border-t dark:border-zinc-700" role="separator" />
            <NavList items={salidas} onNavigate={onNavigate} />
        </nav>
    );
};

/**
 * Lateral fijo a partir de lg; en movil, una barra que dice donde estas y
 * despliega el mismo menu justo debajo (plegado por defecto: ocho a quince
 * enlaces no deben tapar el contenido).
 */
const AdminPanelSidebar: React.FC<{ queues: SidebarQueues; pathname: string }> = ({ queues, pathname }) => {
    const t = useTranslation();
    const { actual } = useNavGroups(queues, pathname);
    const [open, setOpen] = useState(false);
    const panelId = useId();
    return (
        <>
            <div className="lg:hidden">
                <button
                    type="button"
                    onClick={() => setOpen(o => !o)}
                    aria-expanded={open}
                    aria-controls={panelId}
                    className={`w-full min-h-[52px] flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-zinc-800 rounded-xl shadow-sm border dark:border-zinc-700 text-left ${BAR_FOCUS}`}
                >
                    <i className="fa-solid fa-bars text-gray-500 dark:text-gray-400 flex-shrink-0" aria-hidden="true"></i>
                    <span className="min-w-0 flex-1">
                        <span className="block text-[11px] text-gray-500 dark:text-gray-400 truncate">{t('adminDashboard.ovAdminName')}</span>
                        <span className="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-gray-100">
                            <i className={`fa-solid ${actual.icon} text-brand-green`} aria-hidden="true"></i>
                            <span className="truncate">{actual.label}</span>
                        </span>
                    </span>
                    <i className={`fa-solid fa-chevron-down text-xs text-gray-400 flex-shrink-0 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} aria-hidden="true"></i>
                </button>
                <div id={panelId} hidden={!open} className="mt-2 bg-white dark:bg-zinc-800 p-4 rounded-2xl shadow-sm border dark:border-zinc-700">
                    <SidebarContent queues={queues} pathname={pathname} onNavigate={() => setOpen(false)} />
                </div>
            </div>
            <aside className="hidden lg:block w-64 flex-shrink-0 bg-white dark:bg-zinc-800 p-4 rounded-2xl shadow-sm border dark:border-zinc-700 lg:sticky lg:top-24 self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
                <SidebarContent queues={queues} pathname={pathname} />
            </aside>
        </>
    );
};

export default AdminPanelSidebar;
