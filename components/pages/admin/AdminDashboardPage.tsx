import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    getAdminDashboardOverview,
    deleteBusinessesWithoutReviews,
    adminSupportTicketCounts,
    adminContactNewCount,
    AdminOverviewMissingError,
    type AdminOverview,
    type OverviewReviewFilter,
} from '../../../services/supabaseService';
import { useNotification } from '../../../contexts/NotificationContext';
import { useConfirm } from '../../../contexts/ConfirmContext';
import Meta from '../../Meta';
import { useTranslation, useI18n, pathTranslations, getLocaleFromLanguage } from '../../../contexts/i18nContext';
import { useAdminQueuesPublisher } from './AdminLayout';
import WeekComparison from './panel/WeekComparison';
import RichText from './panel/RichText';
import { ActionLink, EmptyQueue, PanelSkeleton, QueueCard, QueueRow, ReviewItem } from './panel/PanelParts';
import { isLate, joinList, pathOf, relativeAge, useNumberFormats } from './panel/overviewUtils';

const es = pathTranslations.es;
const PATHS = {
    moderation: `/${es.adminReviewModeration}`,
    claims: `/${es.adminClaims}`,
    appeals: `/${es.adminReviewAppeals}`,
    bugs: `/${es.adminBugs}`,
    users: `/${es.adminUsers}`,
    performance: '/admin/rendimiento',
};

type Status = 'loading' | 'ready' | 'error' | 'missing';

const FILTERS: { id: OverviewReviewFilter; labelKey: string }[] = [
    { id: 'all', labelKey: 'ovFilterAll' },
    { id: 'late', labelKey: 'ovFilterLate' },
    { id: 'low', labelKey: 'ovFilterLow' },
    { id: 'image', labelKey: 'ovFilterImage' },
];

const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-800';

const AdminDashboardPage: React.FC = () => {
    const t = useTranslation();
    const { language } = useI18n();
    const locale = getLocaleFromLanguage(language);
    const f = useNumberFormats(locale);
    const tk = useCallback((k: string, p?: Record<string, string | number>) => t(`adminDashboard.${k}`, p), [t]);
    const { showNotification } = useNotification();
    const { confirm } = useConfirm();

    const [data, setData] = useState<AdminOverview | null>(null);
    // Soporte va aparte: si las tablas de tickets no existen (entornos reconstruidos), el resto carga igual.
    const [support, setSupport] = useState<number | null>(null);
    // Mensajes del formulario de contacto sin leer (tabla propia): tambien son trabajo pendiente del equipo.
    const [contactNew, setContactNew] = useState<number | null>(null);
    const [status, setStatus] = useState<Status>('loading');
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<OverviewReviewFilter>('all');
    const [deleting, setDeleting] = useState(false);
    const reqId = useRef(0);
    // Refs para que load() no cambie de identidad (t y showNotification cambian en cada render del contexto) y la carga sea una sola.
    const publishQueues = useAdminQueuesPublisher();
    const dataRef = useRef<AdminOverview | null>(null);
    dataRef.current = data;
    const tRef = useRef(t);
    tRef.current = t;
    const notifyRef = useRef(showNotification);
    notifyRef.current = showNotification;

    const load = useCallback(async (isRefresh: boolean) => {
        const id = ++reqId.current;
        if (isRefresh) setRefreshing(true); else setStatus('loading');
        const [ov, sup, con] = await Promise.allSettled([getAdminDashboardOverview(), adminSupportTicketCounts(), adminContactNewCount()]);
        if (id !== reqId.current) return;
        if (ov.status === 'fulfilled') {
            setData(ov.value);
            setStatus('ready');
        } else {
            console.error('Error cargando la portada del panel de administración:', ov.reason);
            // Con datos ya en pantalla, un fallo al actualizar los conserva y avisa; sin datos, pantalla de error.
            if (isRefresh && dataRef.current) notifyRef.current(tRef.current('adminDashboard.perfRefreshError'), 'error');
            else setStatus(ov.reason instanceof AdminOverviewMissingError ? 'missing' : 'error');
        }
        setSupport(sup.status === 'fulfilled' ? sup.value.open : null);
        setContactNew(con.status === 'fulfilled' ? con.value : null);
        setRefreshing(false);
    }, []);

    useEffect(() => {
        load(false);
        return () => { reqId.current++; };
        // Una sola carga al entrar: las actualizaciones las pide la persona.
    }, []);

    // «Ahora» = el reloj del servidor al calcular los datos: las antigüedades no dependen de la hora del equipo.
    const now = useMemo(() => (data ? new Date(data.generatedAt).getTime() || Date.now() : Date.now()), [data]);

    const handleDeleteEmpty = async () => {
        if (!data || deleting) return;
        setDeleting(true);
        try {
            // El numero que ve quien confirma tiene que ser el de AHORA, no el de hace diez minutos.
            const fresh = await getAdminDashboardOverview().catch(() => null);
            const count = (fresh ?? data).totals.emptyBusinesses;
            if (fresh) setData(fresh);
            if (count === 0) return;
            const ok = await confirm({
                title: tk('deleteEmpty'),
                message: tk(count === 1 ? 'ovConfirmDeleteOne' : 'ovConfirmDeleteMany', { count: f.n(count) }),
                confirmText: t('common.delete'),
                cancelText: t('common.cancel'),
                danger: true,
            });
            if (!ok) return;
            const deleted = await deleteBusinessesWithoutReviews();
            showNotification(tk('deleteEmptySuccess', { count: deleted }), 'success');
            await load(true);
        } catch (error) {
            console.error('Error eliminando empresas vacías:', error);
            showNotification(tk('errorDeletingEmpty'), 'error');
        } finally {
            setDeleting(false);
        }
    };

    const sidebarQueues = {
        moderation: { count: data?.reviews.pending, late: isLate(data?.reviews.oldest, now) },
        claims: { count: data?.claims.open, late: isLate(data?.claims.oldest, now) },
        appeals: { count: data?.appeals.open, late: isLate(data?.appeals.oldest, now) },
        bugs: { count: data?.bugs.open, late: isLate(data?.bugs.oldest, now) },
        // «Soporte» agrupa los tickets abiertos y los mensajes de contacto sin leer (las dos pestañas de /admin/soporte).
        support: { count: support === null && contactNew === null ? null : (support ?? 0) + (contactNew ?? 0) },
    };

    // La capa comun (AdminLayout) pinta el lateral: se le publican los contadores ya calculados.
    useEffect(() => {
        if (data) publishQueues(sidebarQueues);
        // sidebarQueues se recalcula en cada render; solo importa cuando cambian los datos.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, support, contactNew]);

    /** Frase de cabecera con los datos reales; las cifras en negrita salen de las propias claves. */
    const lead = (() => {
        if (!data) return '';
        const { reviews, claims, appeals, pastDue } = data;
        const one = (n: number, base: string) => tk(n === 1 ? `${base}One` : `${base}Many`, { count: f.n(n) });
        const extras: string[] = [];
        if (claims.open > 0) extras.push(one(claims.open, 'ovCountClaims'));
        if (appeals.open > 0) extras.push(one(appeals.open, 'ovCountAppeals'));
        if (support && support > 0) extras.push(one(support, 'ovCountSupport'));
        if (contactNew && contactNew > 0) extras.push(one(contactNew, 'ovCountContact'));
        if (pastDue.count > 0) extras.push(one(pastDue.count, 'ovCountPastDue'));
        if (reviews.pending === 0 && extras.length === 0) return tk('ovLeadNothing');
        const first = reviews.pending > 0
            ? tk(reviews.pending === 1 ? 'ovLeadReviewsOne' : 'ovLeadReviewsMany', {
                count: f.n(reviews.pending),
                age: relativeAge(reviews.oldest, locale, now),
            })
            : tk('ovLeadNoReviews');
        return extras.length ? `${first} ${tk('ovLeadAlso', { list: joinList(extras, locale) })}` : first;
    })();

    const seeAll = (to: string, n: number, queue: string, feminine = true) => ({
        to,
        text: n === 1 ? tk('ovSeeOpen') : tk(feminine ? 'ovSeeAllF' : 'ovSeeAllM', { count: f.n(n) }),
        ariaLabel: `${n === 1 ? tk('ovSeeOpen') : tk(feminine ? 'ovSeeAllF' : 'ovSeeAllM', { count: f.n(n) })}: ${queue}`,
    });

    const header = (
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 sm:min-h-[44px]">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-800 dark:text-gray-100 break-words">{tk('ovTitle')}</h1>
            {status === 'ready' && data && (
                <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2 flex-shrink-0">
                    <span>{tk('perfUpdatedAt', { time: new Date(data.generatedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })}</span>
                    <button
                        type="button"
                        onClick={() => load(true)}
                        disabled={refreshing}
                        aria-busy={refreshing}
                        className={`inline-flex items-center gap-1.5 min-h-[44px] px-2 font-semibold text-emerald-700 dark:text-emerald-400 hover:underline disabled:opacity-60 rounded ${FOCUS}`}
                    >
                        <i className={`fa-solid fa-rotate ${refreshing ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true"></i>
                        {tk('perfRefresh')}
                    </button>
                </p>
            )}
        </div>
    );

    let body: React.ReactNode;
    if (status === 'loading') {
        body = <PanelSkeleton />;
    } else if (status === 'error' || status === 'missing' || !data) {
        body = (
            <div role="alert" className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-red-200 dark:border-red-800 p-6 sm:p-8">
                <div className="flex items-start gap-3">
                    <i className="fa-solid fa-triangle-exclamation text-xl text-red-600 dark:text-red-400 mt-0.5" aria-hidden="true"></i>
                    <div className="min-w-0">
                        <h2 className="font-bold text-lg text-gray-900 dark:text-gray-100">{tk('perfLoadError')}</h2>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{status === 'missing' ? tk('ovMissing') : tk('perfLoadErrorHint')}</p>
                        <button
                            type="button"
                            onClick={() => load(false)}
                            className={`mt-4 min-h-[44px] px-5 rounded-lg bg-red-700 text-white font-semibold hover:bg-red-800 transition-colors ${FOCUS}`}
                        >
                            {tk('perfRetry')}
                        </button>
                    </div>
                </div>
            </div>
        );
    } else {
        const { reviews, claims, appeals, bugs, pastDue, week, totals } = data;
        const shown = reviews.items[filter];
        const remaining = Math.max(0, reviews.counts[filter] - shown.length);
        const reviewsTitle = tk('ovReviewsTitle');
        body = (
            <div className="space-y-5">
                <p className="text-base text-gray-700 dark:text-gray-300 max-w-3xl leading-relaxed" data-testid="panel-lead">
                    <RichText text={lead} />
                </p>

                <QueueCard
                    id="cola-resenas"
                    title={reviewsTitle}
                    seeAll={reviews.pending > 0 ? seeAll(PATHS.moderation, reviews.pending, reviewsTitle) : undefined}
                >
                    {reviews.pending === 0 ? (
                        <EmptyQueue hint={tk('ovEmptyReviews')} />
                    ) : (
                        <>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{tk('ovReviewsHint')}</p>
                            <div role="group" aria-label={tk('ovFilterAria')} className="flex flex-wrap gap-2 mt-3 mb-4">
                                {FILTERS.map(p => {
                                    const active = filter === p.id;
                                    return (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => setFilter(p.id)}
                                            aria-pressed={active}
                                            className={`min-h-[44px] sm:min-h-[36px] px-3.5 rounded-full text-xs sm:text-[13px] font-semibold transition-colors ${FOCUS} ${
                                                active
                                                    ? 'bg-emerald-700 text-white dark:bg-brand-green dark:text-zinc-900'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-700 dark:text-gray-200 dark:hover:bg-zinc-600'
                                            }`}
                                        >
                                            {tk(p.labelKey)} ({f.n(reviews.counts[p.id])})
                                        </button>
                                    );
                                })}
                            </div>
                            {shown.length === 0 ? (
                                <EmptyQueue hint={tk('ovEmptyFilter')} />
                            ) : (
                                <ul className="space-y-3">
                                    {shown.map(r => <ReviewItem key={r.id} review={r} now={now} reviewTo={PATHS.moderation} />)}
                                </ul>
                            )}
                            {remaining > 0 && (
                                <Link
                                    to={PATHS.moderation}
                                    className={`mt-3 flex items-center justify-center min-h-[44px] text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:underline rounded ${FOCUS}`}
                                >
                                    {tk('ovMoreReviews', { count: f.n(remaining) })}
                                    <i className="fa-solid fa-arrow-right text-xs ml-1.5" aria-hidden="true"></i>
                                </Link>
                            )}
                        </>
                    )}
                </QueueCard>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                    <QueueCard id="cola-reclamaciones" title={tk('ovNavClaims')} seeAll={claims.open > 0 ? seeAll(PATHS.claims, claims.open, tk('ovNavClaims')) : undefined}>
                        {claims.items.length === 0 ? <EmptyQueue hint={tk('ovEmptyClaims')} /> : (
                            <ul>
                                {claims.items.map(c => (
                                    <QueueRow
                                        key={c.id}
                                        business={c.business}
                                        title={c.business.name || t('adminClaims.businessDeleted')}
                                        sub={tk('ovClaimedBy', { user: c.claimant || t('adminClaims.userNotFound') })}
                                        since={c.since}
                                        now={now}
                                        action={<ActionLink to={PATHS.claims} label={tk('ovResolve')} ariaLabel={`${tk('ovResolve')}: ${c.business.name || ''}`} />}
                                    />
                                ))}
                            </ul>
                        )}
                    </QueueCard>

                    <QueueCard id="cola-pagos" title={tk('ovPastDueTitle')}>
                        {pastDue.items.length === 0 ? <EmptyQueue hint={tk('ovEmptyPastDue')} /> : (
                            <>
                                <ul>
                                    {pastDue.items.map(s => {
                                        const plan = s.plan && s.plan !== 'free' ? tk('ovPastDuePlan', { plan: planLabel(s.plan, t) }) : null;
                                        const state = tk(s.status === 'unpaid' ? 'ovPastDueUnpaid' : 'ovPastDueRetrying');
                                        const who = s.user || s.username || '—';
                                        return (
                                            <QueueRow
                                                key={s.id}
                                                fallbackIcon="fa-credit-card"
                                                title={who}
                                                sub={plan ? `${plan} · ${state}` : state}
                                                since={s.since}
                                                now={now}
                                                action={(s.username || s.user)
                                                    ? <ActionLink to={`${PATHS.users}?q=${encodeURIComponent(s.username || s.user || '')}`} label={tk('ovViewUser')} ariaLabel={`${tk('ovViewUser')}: ${who}`} />
                                                    : null}
                                            />
                                        );
                                    })}
                                </ul>
                                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{tk('ovPastDueNote')}</p>
                            </>
                        )}
                    </QueueCard>

                    <QueueCard id="cola-errores" title={tk('ovBugsTitle')} seeAll={bugs.open > 0 ? seeAll(PATHS.bugs, bugs.open, tk('ovBugsTitle'), false) : undefined}>
                        {bugs.items.length === 0 ? <EmptyQueue hint={tk('ovEmptyBugs')} /> : (
                            <ul>
                                {bugs.items.map(b => {
                                    const page = pathOf(b.pageUrl);
                                    const device = b.mobile === null ? '' : tk(b.mobile ? 'ovDeviceMobile' : 'ovDeviceDesktop');
                                    return (
                                        <QueueRow
                                            key={b.id}
                                            fallbackIcon="fa-bug"
                                            title={b.title || page || '—'}
                                            sub={[page, device].filter(Boolean).join(' · ') || undefined}
                                            since={b.since}
                                            now={now}
                                            action={<ActionLink to={PATHS.bugs} label={tk('ovOpen')} ariaLabel={`${tk('ovOpen')}: ${b.title}`} />}
                                        />
                                    );
                                })}
                            </ul>
                        )}
                    </QueueCard>

                    <QueueCard id="cola-apelaciones" title={tk('ovNavAppeals')} seeAll={appeals.open > 0 ? seeAll(PATHS.appeals, appeals.open, tk('ovNavAppeals')) : undefined}>
                        {appeals.items.length === 0 ? <EmptyQueue hint={tk('ovEmptyAppeals')} /> : (
                            <ul>
                                {appeals.items.map(a => (
                                    <QueueRow
                                        key={a.id}
                                        business={a.business}
                                        title={a.business.name || t('adminClaims.businessDeleted')}
                                        sub={a.reason || tk('ovAppealDefault')}
                                        since={a.since}
                                        now={now}
                                        action={<ActionLink to={PATHS.appeals} label={tk('ovReview')} ariaLabel={`${tk('ovReview')}: ${a.business.name || ''}`} />}
                                    />
                                ))}
                            </ul>
                        )}
                    </QueueCard>
                </div>

                <QueueCard
                    id="semana"
                    title={tk('ovWeekTitle')}
                    seeAll={{ to: PATHS.performance, text: tk('ovPerformance'), ariaLabel: tk('ovPerformance') }}
                >
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{tk('ovWeekHint')}</p>
                    <WeekComparison week={week} totals={totals} />
                </QueueCard>

                <p className="text-sm text-gray-600 dark:text-gray-400">
                    {totals.emptyBusinesses > 0 ? (
                        <>
                            {tk('ovMaint')}{' '}
                            <button
                                type="button"
                                onClick={handleDeleteEmpty}
                                disabled={deleting}
                                aria-busy={deleting}
                                className={`inline-flex items-center min-h-[44px] underline underline-offset-2 text-red-700 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-60 rounded ${FOCUS}`}
                            >
                                {deleting && <span className="w-3 h-3 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                                {tk('ovMaintDelete', { count: f.n(totals.emptyBusinesses) })}
                            </button>
                        </>
                    ) : tk('ovMaintNone')}
                </p>
            </div>
        );
    }

    return (
        <>
            <Meta title={`${tk('ovTitle')} - Opynio`} description={tk('ovTitle')} />
            <div className="space-y-5">
                {header}
                {body}
            </div>
        </>
    );
};

/** Nombre visible de un plan: la clave del panel de empresa y, si no existe, el propio identificador. */
function planLabel(plan: string, t: (k: string) => string): string {
    const key = `businessDashboard.${plan === 'v2' ? 'pro' : plan}PlanName`;
    const v = t(key);
    return v === key ? plan.charAt(0).toUpperCase() + plan.slice(1) : v;
}

export default AdminDashboardPage;
