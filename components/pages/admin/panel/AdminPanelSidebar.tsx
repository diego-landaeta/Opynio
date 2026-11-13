import React, { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import BusinessLogo from '../../../BusinessLogo';
import { useAuth } from '../../../../contexts/AuthContext';
import { useCountry } from '../../../../contexts/CountryContext';
import { useI18n, useTranslation, pathTranslations, getLocaleFromLanguage } from '../../../../contexts/i18nContext';
import { useNumberFormats } from './overviewUtils';
import AdminGlobalSearch from './AdminGlobalSearch';

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

    const item = (key: string, to: string, icon: string, label: string, queue?: QueueCount): NavItem => ({ key, to, icon, label, queue });

    // Cinco bloques con nombre: el resumen suelto, lo que hay que revisar (colas con contador), personas y planes,
    // todo lo de empresas y el sistema.
    const gruposBase: Array<{ titulo?: string; items: NavItem[] }> = [
        { items: [item('summary', '/admin/panel', 'fa-chart-pie', tk('ovNavSummary'))] },
        {
            titulo: tk('ovGroupReview'),
            items: [
                item('moderation', `/${es.adminReviewModeration}`, 'fa-comments', tk('ovNavModeration'), queues.moderation),
                item('claims', `/${es.adminClaims}`, 'fa-user-shield', tk('ovNavClaims'), queues.claims),
                item('appeals', `/${es.adminReviewAppeals}`, 'fa-scale-balanced', tk('ovNavAppeals'), queues.appeals),
                item('bugs', `/${es.adminBugs}`, 'fa-bug', tk('ovNavBugs'), queues.bugs),
                item('support', '/admin/soporte', 'fa-headset', tk('ovNavSupport'), queues.support),
            ],
        },
        {
            titulo: tk('ovGroupPeople'),
            items: [
                item('users', `/${es.adminUsers}`, 'fa-users', tk('users')),
                item('enterprise', `/${es.adminEnterprise}`, 'fa-building', tk('enterprisePlan')),
                item('payments', '/admin/pagos', 'fa-credit-card', tk('ovNavPayments')),
            ],
        },
        {
            titulo: tk('ovGroupBusinesses'),
            items: [
                item('featured', `/${es.adminFeatured}`, 'fa-star', tk('ovNavFeatured')),
                item('create', `/${es.adminCreateBusiness}`, 'fa-circle-plus', tk('createBusiness')),
                item('bulk', `/${es.adminBulkEdit}`, 'fa-pen-to-square', tk('ovNavBulk')),
                item('urls', `/${es.adminUrls}`, 'fa-link', tk('ovNavUrls')),
                item('scraping', `/${es.adminScraping}`, 'fa-robot', tk('scraping')),
            ],
        },
        {
            titulo: tk('ovGroupSystem'),
            items: [
                item('performance', '/admin/rendimiento', 'fa-gauge-high', tk('ovPerformance')),
                item('site', country ? `/${country.toLowerCase()}` : '/', 'fa-arrow-left', tk('ovBackSite')),
            ],
        },
    ];

    // El apartado actual sale de la ruta (coincidencia exacta o una subruta: /admin/empresa/editar/:id no tiene enlace propio).
    const grupos = gruposBase.map(g => ({ ...g, items: g.items.map(i => ({ ...i, current: i.key !== 'site' && esActual(pathname, i.to) })) }));
    const actual = grupos.flatMap(g => g.items).find(i => i.current) ?? { icon: 'fa-shield-halved', label: tk('ovAdminName') };
    return { grupos, actual, tk };
};

/** Contenido de la barra: identidad arriba y tres grupos de enlaces. */
const SidebarContent: React.FC<{ queues: SidebarQueues; pathname: string; onNavigate?: () => void }> = ({ queues, pathname, onNavigate }) => {
    const { profile } = useAuth();
    const { grupos, tk } = useNavGroups(queues, pathname);

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
            <AdminGlobalSearch onNavigate={onNavigate} />
            {grupos.map((g, idx) => (
                <div key={g.titulo ?? 'inicio'} className={idx === 0 ? '' : 'mt-3'}>
                    {g.titulo && <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">{g.titulo}</p>}
                    <NavList items={g.items} onNavigate={onNavigate} />
                </div>
            ))}
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
