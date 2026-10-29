import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    getAdminPlatformStats,
    adminSupportTicketCounts,
    type PlatformStats,
    type PlatformTopBusiness,
} from '../../../services/supabaseService';
import Meta from '../../Meta';
import AdminBackLink, { adminBackState } from './AdminBackLink';
import WeeklyBarChart from './performance/WeeklyBarChart';
import { useTranslation, useI18n, pathTranslations, getLocaleFromLanguage } from '../../../contexts/i18nContext';
import { generateBusinessPath } from '../../../utils/linkUtils';

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

type Tone = 'danger' | 'warn' | 'info';

const SEGMENT_COLORS = ['bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 'bg-purple-500', 'bg-pink-500', 'bg-cyan-500', 'bg-gray-400'];

const PERFORMANCE_PATH = '/admin/rendimiento';

const useFormatters = (locale: string) =>
    useMemo(() => {
        const full = new Intl.NumberFormat(locale, { useGrouping: 'always' } as unknown as Intl.NumberFormatOptions);
        const compact = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 });
        const dec = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 2 });
        const pct = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
        return {
            // Un millon en adelante se compacta (1,2 M) para que el numero grande no desborde la tarjeta en movil.
            n: (v: number) => (Math.abs(v) >= 1_000_000 ? compact.format(v) : full.format(v)),
            full: (v: number) => full.format(v),
            dec: (v: number) => dec.format(v),
            pct: (v: number) => pct.format(v),
        };
    }, [locale]);

/* ------------------------------------------------------------------ */
/* Piezas visuales                                                     */
/* ------------------------------------------------------------------ */

const Card: React.FC<{
    icon: string; accent: string; title: string; manageTo?: string; manageLabel?: string; children: React.ReactNode;
}> = ({ icon, accent, title, manageTo, manageLabel, children }) => (
    <section className="bg-white dark:bg-zinc-800 rounded-xl border dark:border-zinc-700 p-4 sm:p-5 min-w-0 flex flex-col">
        <div className="flex items-center gap-3 mb-4">
            <div className={`w-9 h-9 rounded-lg ${accent} text-white flex items-center justify-center flex-shrink-0`} aria-hidden="true">
                <i className={`fa-solid ${icon}`}></i>
            </div>
            <h2 className="font-bold text-gray-800 dark:text-gray-100 min-w-0 flex-1 truncate">{title}</h2>
            {manageTo && (
                <Link
                    to={manageTo}
                    className="text-sm font-semibold text-brand-green hover:underline inline-flex items-center gap-1 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green rounded whitespace-nowrap"
                >
                    {manageLabel} <i className="fa-solid fa-chevron-right text-xs" aria-hidden="true"></i>
                </Link>
            )}
        </div>
        {children}
    </section>
);

const Unavailable: React.FC<{ text: string; compact?: boolean }> = ({ text, compact }) => (
    <p className={`flex items-center gap-2 text-gray-500 dark:text-gray-400 ${compact ? 'text-xs' : 'text-sm'}`}>
        <i className="fa-solid fa-circle-minus" aria-hidden="true"></i>
        <span>{text}</span>
    </p>
);

const BigNumber: React.FC<{ value: string; title?: string; label: string }> = ({ value, title, label }) => (
    <div className="min-w-0">
        <p className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tabular-nums break-words" title={title}>{value}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
    </div>
);

const Delta: React.FC<{ label: string; value: number | null; fmt: (n: number) => string; signed?: boolean }> = ({ label, value, fmt, signed = true }) => value === null ? null : (
    <div className="min-w-0">
        <p className="text-lg font-bold text-gray-800 dark:text-gray-100 tabular-nums">
            {signed && value > 0 ? '+' : ''}{fmt(value)}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
    </div>
);

const Stat: React.FC<{ label: string; value: string; tone?: 'normal' | 'bad' }> = ({ label, value, tone }) => (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b last:border-b-0 border-gray-100 dark:border-zinc-700">
        <span className="text-sm text-gray-600 dark:text-gray-300 min-w-0">{label}</span>
        <span className={`text-sm font-bold tabular-nums whitespace-nowrap ${tone === 'bad' ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>{value}</span>
    </div>
);

/** Barra apilada + leyenda con el numero: el color nunca es lo unico que informa. */
const Breakdown: React.FC<{
    title: string; items: { key: string; label: string; value: number }[]; fmt: (n: number) => string; pct: (n: number) => string;
}> = ({ title, items, fmt, pct }) => {
    const total = items.reduce((s, i) => s + i.value, 0);
    if (total === 0) return null;
    const sorted = [...items].filter(i => i.value > 0).sort((a, b) => b.value - a.value);
    return (
        <div className="mt-4 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">{title}</p>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100 dark:bg-zinc-700" aria-hidden="true">
                {sorted.map((i, idx) => (
                    <div key={i.key} className={SEGMENT_COLORS[Math.min(idx, SEGMENT_COLORS.length - 1)]} style={{ width: `${(i.value / total) * 100}%` }} />
                ))}
            </div>
            <ul className="mt-2 space-y-1">
                {sorted.map((i, idx) => (
                    <li key={i.key} className="flex items-center gap-2 text-sm min-w-0">
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${SEGMENT_COLORS[Math.min(idx, SEGMENT_COLORS.length - 1)]}`} aria-hidden="true"></span>
                        <span className="text-gray-700 dark:text-gray-300 truncate min-w-0 flex-1" title={i.label}>{i.label}</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{fmt(i.value)}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums w-10 text-right">{pct(i.value / total)}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

const Skeleton: React.FC = () => (
    <div className="space-y-6" role="status" aria-live="polite" aria-busy="true">
        <div className="h-24 rounded-xl bg-gray-200 dark:bg-zinc-800 animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map(i => <div key={i} className="h-72 rounded-xl bg-gray-200 dark:bg-zinc-800 animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map(i => <div key={i} className="h-44 rounded-xl bg-gray-200 dark:bg-zinc-800 animate-pulse" />)}
        </div>
    </div>
);

/* ------------------------------------------------------------------ */
/* Pagina                                                              */
/* ------------------------------------------------------------------ */

const AdminPerformancePage: React.FC = () => {
    const t = useTranslation();
    const { language } = useI18n();
    const locale = getLocaleFromLanguage(language);
    const f = useFormatters(locale);
    const tk = (k: string, p?: Record<string, string | number>) => t(`adminDashboard.${k}`, p);

    const [stats, setStats] = useState<PlatformStats | null>(null);
    const [supportOpen, setSupportOpen] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(false);
    const reqId = useRef(0);

    const load = useCallback(async (isRefresh: boolean) => {
        const id = ++reqId.current;
        if (isRefresh) setRefreshing(true); else setLoading(true);
        setError(false);
        // El soporte va aparte: si la tabla de tickets no existe, no tumba el resto.
        const [s, sup] = await Promise.allSettled([getAdminPlatformStats(), adminSupportTicketCounts()]);
        if (id !== reqId.current) return;
        if (s.status === 'fulfilled') {
            setStats(s.value);
        } else {
            console.error('Error cargando el rendimiento de la plataforma:', s.reason);
            setError(true);
        }
        setSupportOpen(sup.status === 'fulfilled' ? sup.value.open : null);
        setLoading(false);
        setRefreshing(false);
    }, []);

    useEffect(() => {
        load(false);
        return () => { reqId.current++; };
    }, [load]);

    /* ---- etiquetas ---- */
    const planLabel = (p: string) => (p === 'free' ? tk('perfPlanFree') : p.charAt(0).toUpperCase() + p.slice(1));
    const known = (prefix: string, key: string, fallback?: (k: string) => string) => {
        const k = `adminDashboard.${prefix}_${key}`;
        const v = t(k);
        return v === k ? (fallback ? fallback(key) : key) : v;
    };
    const roleLabel = (r: string) => known('perfRole', r);
    const sourceLabel = (s: string) => known('perfSource', s, k => k.charAt(0).toUpperCase() + k.slice(1));
    const subLabel = (s: string) => known('perfSub', s);
    const asItems = (m: Record<string, number> | null, label: (k: string) => string) =>
        m ? Object.entries(m).map(([key, value]) => ({ key, label: label(key), value })) : [];

    const ago = (iso: string): { text: string; hours: number } => {
        const hours = Math.max(0, (Date.now() - new Date(iso).getTime()) / 3600000);
        const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'always' });
        return { hours, text: hours < 48 ? rtf.format(-Math.max(1, Math.round(hours)), 'hour') : rtf.format(-Math.round(hours / 24), 'day') };
    };

    /* ---- requiere atencion ---- */
    type Attention = { key: string; icon: string; label: string; detail?: string; count: number; to?: string; tone: Tone };
    const attention: Attention[] = [];
    if (stats) {
        const rv = stats.reviews;
        if (rv && rv.pending > 0) {
            const old = rv.oldestPending ? ago(rv.oldestPending) : null;
            attention.push({
                key: 'reviews', icon: 'fa-clock', label: tk('perfAttPendingReviews'), count: rv.pending,
                detail: old ? tk('perfAttOldest', { ago: old.text }) : undefined,
                to: `/${pathTranslations.es.adminReviewModeration}`, tone: old && old.hours > 48 ? 'danger' : 'warn',
            });
        }
        const rq = stats.requests;
        if (rq && rq.appealsOpen > 0) attention.push({ key: 'appeals', icon: 'fa-flag', label: tk('perfAttAppeals'), count: rq.appealsOpen, to: `/${pathTranslations.es.adminReviewAppeals}`, tone: 'warn' });
        if (rq && rq.claimsOpen > 0) attention.push({ key: 'claims', icon: 'fa-user-shield', label: tk('perfAttClaims'), count: rq.claimsOpen, to: `/${pathTranslations.es.adminClaims}`, tone: 'warn' });
        if (supportOpen && supportOpen > 0) attention.push({ key: 'support', icon: 'fa-headset', label: tk('perfAttSupport'), count: supportOpen, to: '/admin/soporte', tone: 'warn' });
        if (rq && rq.bugsOpen > 0) attention.push({ key: 'bugs', icon: 'fa-bug', label: tk('perfAttBugs'), count: rq.bugsOpen, to: `/${pathTranslations.es.adminBugs}`, tone: 'info' });
        if (stats.subscriptions && stats.subscriptions.pastDue > 0) attention.push({ key: 'pastdue', icon: 'fa-credit-card', label: tk('perfAttPastDue'), detail: tk('perfAttPastDueHint'), count: stats.subscriptions.pastDue, tone: 'danger' });
        if (stats.scraping && stats.scraping.queueFailed > 0) attention.push({ key: 'scrapfail', icon: 'fa-robot', label: tk('perfAttScrapingFailed'), count: stats.scraping.queueFailed, to: `/${pathTranslations.es.adminScraping}`, tone: 'warn' });
        if (stats.scraping && stats.scraping.queuePending > 0) attention.push({ key: 'scrappend', icon: 'fa-list-check', label: tk('perfAttScrapingPending'), count: stats.scraping.queuePending, to: `/${pathTranslations.es.adminScraping}`, tone: 'info' });
        if (stats.businesses && (stats.businesses.withoutReviews ?? 0) > 0) attention.push({ key: 'noreviews', icon: 'fa-store-slash', label: tk('perfAttNoReviews'), count: stats.businesses.withoutReviews!, to: `/${pathTranslations.es.adminBulkEdit}`, tone: 'info' });
    }
    const toneRank: Record<Tone, number> = { danger: 0, warn: 1, info: 2 };
    attention.sort((a, b) => toneRank[a.tone] - toneRank[b.tone]);
    const toneCls: Record<Tone, string> = {
        danger: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-900 dark:text-red-100',
        warn: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-900 dark:text-orange-100',
        info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100',
    };
    const toneBadge: Record<Tone, string> = {
        danger: 'bg-red-600 text-white',
        warn: 'bg-orange-600 text-white',
        info: 'bg-blue-600 text-white',
    };

    /* ---- render ---- */
    const header = (
        <>
            <AdminBackLink />
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
                <div className="min-w-0">
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-800 dark:text-gray-100">{tk('perfTitle')}</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">{tk('perfSubtitle')}</p>
                </div>
                <div className="flex items-center gap-3">
                    {stats && !error && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            {tk('perfUpdatedAt', { time: new Date(stats.generatedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })}
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={() => load(true)}
                        disabled={loading || refreshing}
                        aria-busy={refreshing}
                        className="min-h-[44px] px-4 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:border-brand-green hover:text-brand-green disabled:opacity-50 flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                    >
                        <i className={`fa-solid fa-rotate ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true"></i>
                        <span>{tk('perfRefresh')}</span>
                    </button>
                </div>
            </div>
        </>
    );

    if (loading) {
        return (
            <>
                <Meta title={`${tk('perfTitle')} - Opynio`} description={tk('perfSubtitle')} />
                <div className="space-y-6">{header}<Skeleton /></div>
            </>
        );
    }

    if (!stats) {
        return (
            <>
                <Meta title={`${tk('perfTitle')} - Opynio`} description={tk('perfSubtitle')} />
                <div className="space-y-6">
                    {header}
                    <div role="alert" className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6 text-center">
                        <i className="fa-solid fa-triangle-exclamation text-3xl text-red-500 mb-3" aria-hidden="true"></i>
                        <h2 className="font-bold text-red-900 dark:text-red-100">{tk('perfLoadError')}</h2>
                        <p className="text-sm text-red-800 dark:text-red-200 mt-1 mb-4">{tk('perfLoadErrorHint')}</p>
                        <button type="button" onClick={() => load(false)} className="min-h-[44px] px-5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 transition-colors">
                            {tk('perfRetry')}
                        </button>
                    </div>
                </div>
            </>
        );
    }

    const { users, businesses, reviews, subscriptions, requests, scraping, trends, top } = stats;
    const na = tk('perfUnavailable');
    const platformEmpty = (businesses?.total ?? 0) === 0 && (reviews?.published ?? 0) === 0 && (reviews?.pending ?? 0) === 0;
    const manage = t('adminDashboard.manage');
    const ratingDist = reviews?.ratingDistribution ?? null;
    const ratingMax = ratingDist ? Math.max(1, ...Object.values(ratingDist)) : 1;

    const chart = (title: string, pick: (w: NonNullable<PlatformStats['trends']>[number]) => number, bar: string) => {
        const pts = (trends ?? []).map(w => ({ weekStart: w.weekStart, value: pick(w) }));
        const total = pts.reduce((s, p) => s + p.value, 0);
        const avg = pts.length ? total / pts.length : 0;
        return (
            <section className="bg-white dark:bg-zinc-800 rounded-xl border dark:border-zinc-700 p-4 sm:p-5 min-w-0">
                <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-1">{title}</h3>
                <div className="flex items-end justify-between gap-3 mb-3">
                    <p className="text-2xl font-extrabold text-gray-900 dark:text-white tabular-nums" title={f.full(total)}>{f.n(total)}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-right">{tk('perfAvgWeek', { value: avg >= 100 ? f.n(Math.round(avg)) : f.dec(avg) })}</p>
                </div>
                <WeeklyBarChart
                    points={pts}
                    barClass={bar}
                    locale={locale}
                    ariaLabel={`${title}. ${tk('perfChartAria', { count: pts.length })}`}
                    describePoint={(week, v) => tk('perfBarLabel', { week, value: f.full(v) })}
                    emptyText={tk('perfNoData')}
                />
            </section>
        );
    };

    const topList = (title: string, note: string | null, list: PlatformTopBusiness[], by: 'reviews' | 'rating') => {
        const maxReviews = Math.max(1, ...list.map(b => b.reviews));
        return (
            <section className="bg-white dark:bg-zinc-800 rounded-xl border dark:border-zinc-700 p-4 sm:p-5 min-w-0">
                <h3 className="font-bold text-gray-800 dark:text-gray-100">{title}</h3>
                {note && <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{note}</p>}
                {!note && <div className="mb-3" />}
                {list.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">{tk(by === 'rating' ? 'perfTopEmptyRating' : 'perfTopEmpty')}</p>
                ) : (
                    <ol className="space-y-2">
                        {list.map((b, i) => (
                            <li key={b.id} className="flex items-center gap-3 min-w-0">
                                <span className="w-6 h-6 rounded-full bg-gray-100 dark:bg-zinc-700 text-xs font-bold text-gray-600 dark:text-gray-300 flex items-center justify-center flex-shrink-0 tabular-nums">{i + 1}</span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Link to={generateBusinessPath({ name: b.name, slug: b.slug, country: b.country })} className="font-semibold text-sm text-gray-800 dark:text-gray-100 hover:text-brand-green truncate min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green rounded" title={b.name}>
                                            {b.name}
                                        </Link>
                                        {b.country && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 flex-shrink-0">{b.country.toUpperCase()}</span>}
                                    </div>
                                    <div className="mt-1 h-1.5 rounded-full bg-gray-100 dark:bg-zinc-700 overflow-hidden" aria-hidden="true">
                                        <div className={`h-full rounded-full ${by === 'reviews' ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${by === 'reviews' ? (b.reviews / maxReviews) * 100 : (b.avgRating / 5) * 100}%` }} />
                                    </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                                        {by === 'reviews' ? f.n(b.reviews) : <><i className="fa-solid fa-star text-amber-500 text-xs" aria-hidden="true"></i> {f.dec(b.avgRating)}</>}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                                        {by === 'reviews' ? <><i className="fa-solid fa-star text-amber-500" aria-hidden="true"></i> {f.dec(b.avgRating)}</> : tk('perfReviewsCount', { count: f.n(b.reviews) })}
                                    </p>
                                </div>
                                <Link
                                    to={`/admin/empresa/editar/${b.id}`}
                                    state={adminBackState(PERFORMANCE_PATH, 'admin.backToPerformance')}
                                    className="w-11 h-11 flex items-center justify-center rounded-lg text-gray-400 hover:text-brand-green hover:bg-gray-100 dark:hover:bg-zinc-700 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                                    aria-label={`${tk('perfEditBusiness')}: ${b.name}`}
                                    title={tk('perfEditBusiness')}
                                >
                                    <i className="fa-solid fa-pen" aria-hidden="true"></i>
                                </Link>
                            </li>
                        ))}
                    </ol>
                )}
            </section>
        );
    };

    return (
        <>
            <Meta title={`${tk('perfTitle')} - Opynio`} description={tk('perfSubtitle')} />
            <div className="space-y-6">
                {header}

                {error && (
                    <div role="alert" className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-900 dark:text-red-100">
                        <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
                        <span className="flex-1 min-w-0">{tk('perfRefreshError')}</span>
                        <button type="button" onClick={() => load(true)} className="font-semibold underline min-h-[44px] px-2">{tk('perfRetry')}</button>
                    </div>
                )}

                {stats.partial && (
                    <div role="status" className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-900 dark:text-amber-100">
                        <i className="fa-solid fa-circle-info mt-0.5" aria-hidden="true"></i>
                        <div className="min-w-0">
                            <p className="font-semibold">{tk('perfPartialTitle')}</p>
                            <p>{tk('perfPartialBody')}</p>
                        </div>
                    </div>
                )}

                {platformEmpty && (
                    <div className="rounded-xl border border-dashed border-gray-300 dark:border-zinc-600 p-6 text-center">
                        <i className="fa-solid fa-chart-column text-3xl text-gray-400 mb-3" aria-hidden="true"></i>
                        <h2 className="font-bold text-gray-800 dark:text-gray-100">{tk('perfEmptyTitle')}</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">{tk('perfEmptyBody')}</p>
                        <Link to={`/${pathTranslations.es.adminCreateBusiness}`} className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-lg bg-brand-green text-white font-semibold hover:bg-opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2">
                            <i className="fa-solid fa-plus" aria-hidden="true"></i>{tk('createBusiness')}
                        </Link>
                    </div>
                )}

                {/* Requiere atencion */}
                <section aria-labelledby="perf-attention">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-1 h-6 rounded-full bg-orange-500"></div>
                        <h2 id="perf-attention" className="text-lg font-bold text-gray-800 dark:text-gray-100">{tk('perfAttentionTitle')}</h2>
                    </div>
                    {supportOpen === null && (
                        <p className="flex items-center gap-2 mb-3 text-xs text-gray-500 dark:text-gray-400">
                            <i className="fa-solid fa-circle-minus" aria-hidden="true"></i>
                            <span>{tk('perfRequestSupport')}: {na}</span>
                        </p>
                    )}
                    {attention.length === 0 ? (
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100">
                            <i className="fa-solid fa-circle-check text-xl text-emerald-600 dark:text-emerald-400" aria-hidden="true"></i>
                            <p className="text-sm font-medium">{tk('perfAttentionNone')}</p>
                        </div>
                    ) : (
                        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                            {attention.map(a => {
                                const inner = (
                                    <>
                                        <i className={`fa-solid ${a.icon} w-5 text-center flex-shrink-0`} aria-hidden="true"></i>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm font-semibold">{a.label}</span>
                                            {a.detail && <span className="block text-xs opacity-80">{a.detail}</span>}
                                        </span>
                                        <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full tabular-nums ${toneBadge[a.tone]}`}>{f.n(a.count)}</span>
                                        {a.to && <i className="fa-solid fa-chevron-right text-xs flex-shrink-0" aria-hidden="true"></i>}
                                    </>
                                );
                                const cls = `flex items-center gap-3 p-3 min-h-[56px] rounded-xl border ${toneCls[a.tone]}`;
                                return (
                                    <li key={a.key}>
                                        {a.to
                                            ? <Link to={a.to} className={`${cls} hover:shadow-md transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green`}>{inner}</Link>
                                            : <div className={cls}>{inner}</div>}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>

                {/* Usuarios, empresas, resenas */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <Card icon="fa-users" accent="bg-blue-500" title={tk('perfUsers')} manageTo={`/${pathTranslations.es.adminUsers}`} manageLabel={manage}>
                        {users ? (
                            <>
                                <BigNumber value={f.n(users.total)} title={f.full(users.total)} label={tk('perfTotal')} />
                                <div className="grid grid-cols-2 gap-3 mt-4">
                                    <Delta label={tk('perfLast7d')} value={users.new7d} fmt={f.n} />
                                    <Delta label={tk('perfLast30d')} value={users.new30d} fmt={f.n} />
                                </div>
                                {users.byRole && <Breakdown title={tk('perfByRole')} items={asItems(users.byRole, roleLabel)} fmt={f.n} pct={f.pct} />}
                                {users.byPlan && <Breakdown title={tk('perfByPlan')} items={asItems(users.byPlan, planLabel)} fmt={f.n} pct={f.pct} />}
                                {!users.byRole && !users.byPlan && <div className="mt-4"><Unavailable text={na} compact /></div>}
                            </>
                        ) : <Unavailable text={na} />}
                    </Card>

                    <Card icon="fa-store" accent="bg-emerald-500" title={tk('perfBusinesses')} manageTo={`/${pathTranslations.es.adminBulkEdit}`} manageLabel={manage}>
                        {businesses ? (
                            <>
                                <BigNumber value={f.n(businesses.total)} title={f.full(businesses.total)} label={tk('perfTotal')} />
                                <div className="grid grid-cols-2 gap-3 mt-4">
                                    <Delta label={tk('perfLast30d')} value={businesses.new30d} fmt={f.n} />
                                    <Delta label={tk('perfFeatured')} value={businesses.featured} fmt={f.n} signed={false} />
                                </div>
                                <div className="mt-4">
                                    {businesses.withOwner !== null && (
                                        <Stat
                                            label={tk('perfWithOwner')}
                                            value={`${f.n(businesses.withOwner)}${businesses.total > 0 ? ` · ${f.pct(businesses.withOwner / businesses.total)}` : ''}`}
                                        />
                                    )}
                                    {businesses.withoutReviews !== null && (
                                        <Stat label={tk('perfWithoutReviews')} value={f.n(businesses.withoutReviews)} tone={businesses.withoutReviews > 0 ? 'bad' : 'normal'} />
                                    )}
                                </div>
                                {businesses.byPlan ? <Breakdown title={tk('perfByPlan')} items={asItems(businesses.byPlan, planLabel)} fmt={f.n} pct={f.pct} /> : <div className="mt-4"><Unavailable text={na} compact /></div>}
                            </>
                        ) : <Unavailable text={na} />}
                    </Card>

                    <Card icon="fa-star" accent="bg-amber-500" title={tk('perfReviews')} manageTo={`/${pathTranslations.es.adminReviewModeration}`} manageLabel={manage}>
                        {reviews ? (
                            <>
                                <div className="flex items-end justify-between gap-3">
                                    <BigNumber value={f.n(reviews.published)} title={f.full(reviews.published)} label={tk('perfPublished')} />
                                    {reviews.avgRating !== null && (
                                        <div className="text-right flex-shrink-0">
                                            <p className="text-2xl font-extrabold text-gray-900 dark:text-white tabular-nums">
                                                <i className="fa-solid fa-star text-amber-500 text-lg" aria-hidden="true"></i> {f.dec(reviews.avgRating)}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{tk('perfAvgRating')}</p>
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-3 gap-3 mt-4">
                                    <Delta label={tk('perfLast7d')} value={reviews.new7d} fmt={f.n} />
                                    <Delta label={tk('perfLast30d')} value={reviews.new30d} fmt={f.n} />
                                    <Delta label={tk('perfInModeration')} value={reviews.pending} fmt={f.n} signed={false} />
                                </div>
                                {ratingDist ? (
                                    <div className="mt-4">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">{tk('perfRatingDist')}</p>
                                        <ul className="space-y-1">
                                            {[5, 4, 3, 2, 1].map(r => {
                                                const v = ratingDist[String(r)] ?? 0;
                                                return (
                                                    <li key={r} className="flex items-center gap-2 text-sm">
                                                        <span className="w-8 text-gray-600 dark:text-gray-300 tabular-nums flex items-center gap-1">{r}<i className="fa-solid fa-star text-amber-500 text-[10px]" aria-hidden="true"></i></span>
                                                        <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-zinc-700 overflow-hidden" aria-hidden="true">
                                                            <div className="h-full rounded-full bg-amber-500" style={{ width: `${(v / ratingMax) * 100}%` }} />
                                                        </div>
                                                        <span className="w-14 text-right font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{f.n(v)}</span>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                ) : <div className="mt-4"><Unavailable text={na} compact /></div>}
                                {reviews.bySource && <Breakdown title={tk('perfBySource')} items={asItems(reviews.bySource, sourceLabel)} fmt={f.n} pct={f.pct} />}
                            </>
                        ) : <Unavailable text={na} />}
                    </Card>
                </div>

                {/* Planes y scraping */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card icon="fa-credit-card" accent="bg-purple-500" title={tk('perfPlansTitle')}>
                        {subscriptions ? (
                            (() => {
                                const paid = Object.values(subscriptions.paidByPlan).reduce((s, n) => s + n, 0);
                                const subTotal = Object.values(subscriptions.byStatus).reduce((s, n) => s + n, 0);
                                return (
                                    <>
                                        <BigNumber value={f.n(paid)} title={f.full(paid)} label={tk('perfPaidUsers')} />
                                        {paid === 0 && <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">{tk('perfNoPaid')}</p>}
                                        <Breakdown title={tk('perfByPlan')} items={asItems(subscriptions.paidByPlan, planLabel)} fmt={f.n} pct={f.pct} />
                                        {subTotal > 0 && <Breakdown title={tk('perfSubsByStatus')} items={asItems(subscriptions.byStatus, subLabel)} fmt={f.n} pct={f.pct} />}
                                        <div className="mt-4">
                                            <Stat label={tk('perfCancelAtEnd')} value={f.n(subscriptions.cancelAtPeriodEnd)} />
                                            <Stat label={tk('perfAttPastDue')} value={f.n(subscriptions.pastDue)} tone={subscriptions.pastDue > 0 ? 'bad' : 'normal'} />
                                        </div>
                                    </>
                                );
                            })()
                        ) : <Unavailable text={na} />}
                    </Card>

                    <Card icon="fa-robot" accent="bg-cyan-500" title={tk('perfScrapingTitle')} manageTo={scraping ? `/${pathTranslations.es.adminScraping}` : undefined} manageLabel={manage}>
                        {scraping ? (
                            <div>
                                <Stat label={tk('perfQueuePending')} value={f.n(scraping.queuePending)} />
                                <Stat label={tk('perfQueueScheduled')} value={f.n(scraping.queueScheduled)} />
                                <Stat label={tk('perfQueueCompleted')} value={f.n(scraping.queueCompleted)} />
                                <Stat label={tk('perfQueueFailed')} value={f.n(scraping.queueFailed)} tone={scraping.queueFailed > 0 ? 'bad' : 'normal'} />
                                <Stat label={tk('perfSessionsRunning')} value={scraping.sessionsRunning === null ? '—' : f.n(scraping.sessionsRunning)} />
                                <Stat label={tk('perfLastSession')} value={scraping.lastSessionAt ? new Date(scraping.lastSessionAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : '—'} />
                            </div>
                        ) : (
                            <div className="space-y-1">
                                <Unavailable text={na} />
                                <p className="text-xs text-gray-500 dark:text-gray-400">{tk('perfScrapingMissing')}</p>
                            </div>
                        )}
                    </Card>
                </div>

                {/* Tendencias */}
                <section aria-labelledby="perf-trends">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-1 h-6 rounded-full bg-amber-500"></div>
                        <h2 id="perf-trends" className="text-lg font-bold text-gray-800 dark:text-gray-100">{tk('perfTrendsTitle')}</h2>
                    </div>
                    {trends ? (
                        <>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {chart(tk('perfChartReviews'), w => w.reviews, 'fill-amber-500')}
                                {chart(tk('perfChartSignups'), w => w.signups, 'fill-blue-500')}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{tk('perfChartNote')}</p>
                        </>
                    ) : <Unavailable text={na} />}
                </section>

                {/* Top empresas */}
                <section aria-labelledby="perf-top">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-1 h-6 rounded-full bg-emerald-500"></div>
                        <h2 id="perf-top" className="text-lg font-bold text-gray-800 dark:text-gray-100">{tk('perfTopTitle')}</h2>
                    </div>
                    {top ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {topList(tk('perfTopByReviews'), null, top.byReviews, 'reviews')}
                            {topList(tk('perfTopByRating'), tk('perfTopRatingNote', { count: top.minReviews }), top.byRating, 'rating')}
                        </div>
                    ) : <Unavailable text={na} />}
                </section>
            </div>
        </>
    );
};

export default AdminPerformancePage;
