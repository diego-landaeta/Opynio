import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Meta from '../../Meta';
import { useTranslation } from '../../../contexts/i18nContext';
import {
    adminPaymentsOverview,
    AdminPaymentsMissingError,
    type AdminPaymentRow,
    type AdminPaymentsOverview,
} from '../../../services/supabaseService';

/**
 * Apartado «Pagos» del admin: las suscripciones de Stripe que Opynio tiene sincronizadas (tabla subscriptions),
 * con quién paga, qué plan, cuánto, en qué estado y cuándo toca el próximo cobro o termina la prueba.
 * Solo lectura. El detalle de cada factura vive en Stripe: cada fila enlaza al cliente y a la suscripción.
 */

type Filtro = 'all' | 'trialing' | 'active' | 'pastDue' | 'canceled' | 'cancelling' | 'refunded';
type Estado = 'loading' | 'ready' | 'error' | 'missing';

const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-800';
const VIVAS = new Set(['trialing', 'active', 'past_due']);
const IMPAGO = new Set(['past_due', 'unpaid']);
const TERMINADAS = new Set(['canceled', 'incomplete_expired', 'incomplete']);

/**
 * Reembolsada del todo, la suscripción sigue viva y no está programada para terminar: Stripe le volverá a cobrar en la
 * próxima renovación aunque ya recuperó su dinero. Un reembolso no cancela la suscripción; hay que cancelarla en Stripe.
 */
const enRiesgoDeRecobro = (r: AdminPaymentRow): boolean =>
    !!r.refund && r.refund.full && r.refund.action !== 'cancelled' && VIVAS.has(r.status) && !r.cancelAtPeriodEnd;

const STRIPE_CLIENTE = (id: string) => `https://dashboard.stripe.com/customers/${encodeURIComponent(id)}`;
const STRIPE_SUSCRIPCION = (id: string) => `https://dashboard.stripe.com/subscriptions/${encodeURIComponent(id)}`;

const STATUS_BADGE: Record<string, { icon: string; cls: string }> = {
    trialing: { icon: 'fa-gift', cls: 'bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200' },
    active: { icon: 'fa-circle-check', cls: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200' },
    past_due: { icon: 'fa-triangle-exclamation', cls: 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200' },
    unpaid: { icon: 'fa-triangle-exclamation', cls: 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200' },
    incomplete: { icon: 'fa-hourglass-half', cls: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200' },
    canceled: { icon: 'fa-ban', cls: 'bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-gray-200' },
    incomplete_expired: { icon: 'fa-ban', cls: 'bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-gray-200' },
};

const normalizar = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const AdminPaymentsPage: React.FC = () => {
    const t = useTranslation();
    const tk = useCallback((k: string, p?: Record<string, string | number>) => t(`adminDashboard.${k}`, p), [t]);

    const [data, setData] = useState<AdminPaymentsOverview | null>(null);
    const [estado, setEstado] = useState<Estado>('loading');
    const [refrescando, setRefrescando] = useState(false);
    const [filtro, setFiltro] = useState<Filtro>('all');
    const [busqueda, setBusqueda] = useState('');
    const reqId = useRef(0);
    const dataRef = useRef<AdminPaymentsOverview | null>(null);
    dataRef.current = data;

    const cargar = useCallback(async (esRefresco: boolean) => {
        const id = ++reqId.current;
        if (esRefresco) setRefrescando(true); else setEstado('loading');
        try {
            const d = await adminPaymentsOverview();
            if (id !== reqId.current) return;
            setData(d);
            setEstado('ready');
        } catch (e) {
            if (id !== reqId.current) return;
            console.error('Error cargando los pagos del panel de administración:', e);
            // Con datos ya en pantalla, un fallo al actualizar los conserva; sin datos, pantalla de error.
            if (!(esRefresco && dataRef.current)) setEstado(e instanceof AdminPaymentsMissingError ? 'missing' : 'error');
        } finally {
            if (id === reqId.current) setRefrescando(false);
        }
    }, []);

    useEffect(() => {
        cargar(false);
        return () => { reqId.current++; };
        // Una sola carga al entrar: las actualizaciones las pide la persona.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const locale = 'es-ES';
    const dinero = useCallback((centimos: number | null | undefined, moneda?: string | null): string => {
        if (centimos == null) return '—';
        try { return new Intl.NumberFormat(locale, { style: 'currency', currency: (moneda || 'eur').toUpperCase() }).format(centimos / 100); }
        catch { return `${(centimos / 100).toFixed(2)} ${(moneda || '').toUpperCase()}`.trim(); }
    }, []);
    const fecha = useCallback((iso: string | null | undefined): string => {
        if (!iso) return '—';
        const d = new Date(iso);
        return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
    }, []);

    const filas = data?.rows ?? [];
    const ahora = data ? (new Date(data.generatedAt).getTime() || Date.now()) : Date.now();

    // Totales (se agrupan por moneda: hoy todo es EUR, pero no se suman monedas distintas).
    const resumen = useMemo(() => {
        const sumar = (lista: AdminPaymentRow[], mensualizar: boolean): Record<string, number> => {
            const acc: Record<string, number> = {};
            for (const r of lista) {
                if (r.amount == null) continue;
                const mon = (r.currency || 'eur').toLowerCase();
                const v = mensualizar && r.interval === 'year' ? r.amount / 12 : r.amount;
                acc[mon] = (acc[mon] || 0) + v;
            }
            return acc;
        };
        const enPrueba = filas.filter(r => r.status === 'trialing');
        const activas = filas.filter(r => r.status === 'active');
        const conImpago = filas.filter(r => IMPAGO.has(r.status));
        const en30 = filas.filter(r => (r.status === 'trialing' || r.status === 'active') && !r.cancelAtPeriodEnd && r.periodEnd
            && new Date(r.periodEnd).getTime() >= ahora && new Date(r.periodEnd).getTime() <= ahora + 30 * 864e5);
        return {
            enPrueba: enPrueba.length,
            primerCobro: sumar(enPrueba.filter(r => !r.cancelAtPeriodEnd), false),
            activas: activas.length,
            mrr: sumar(activas, true),
            conImpago: conImpago.length,
            en30: en30.length,
            importe30: sumar(en30, false),
        };
    }, [filas, ahora]);

    const texto = (m: Record<string, number>): string => {
        const e = Object.entries(m);
        return e.length === 0 ? dinero(0, 'eur') : e.map(([mon, v]) => dinero(Math.round(v), mon)).join(' + ');
    };

    const cuentas = useMemo(() => ({
        all: filas.length,
        trialing: filas.filter(r => r.status === 'trialing').length,
        active: filas.filter(r => r.status === 'active').length,
        pastDue: filas.filter(r => IMPAGO.has(r.status)).length,
        canceled: filas.filter(r => TERMINADAS.has(r.status)).length,
        cancelling: filas.filter(r => VIVAS.has(r.status) && r.cancelAtPeriodEnd).length,
        refunded: filas.filter(r => !!r.refund).length,
        // Reembolsadas del todo y que siguen cobrando: el cliente recuperó su dinero y se le volverá a cobrar.
        refundedAtRisk: filas.filter(enRiesgoDeRecobro).length,
    }), [filas]);

    const visibles = useMemo(() => {
        const q = normalizar(busqueda.trim());
        return filas.filter(r => {
            if (filtro === 'trialing' && r.status !== 'trialing') return false;
            if (filtro === 'active' && r.status !== 'active') return false;
            if (filtro === 'pastDue' && !IMPAGO.has(r.status)) return false;
            if (filtro === 'canceled' && !TERMINADAS.has(r.status)) return false;
            if (filtro === 'cancelling' && !(VIVAS.has(r.status) && r.cancelAtPeriodEnd)) return false;
            if (filtro === 'refunded' && !r.refund) return false;
            if (!q) return true;
            const pajar = normalizar([r.userName, r.userEmail, r.productName, r.plan, r.id, r.stripeCustomerId, ...r.businesses].filter(Boolean).join(' '));
            return pajar.includes(q);
        });
    }, [filas, filtro, busqueda]);

    const hayFiltros = filtro !== 'all' || busqueda.trim() !== '';
    const limpiar = () => { setFiltro('all'); setBusqueda(''); };

    const etiquetaEstado = (s: string): string => {
        const k = `payStatus_${s}`;
        const v = tk(k);
        return v === `adminDashboard.${k}` ? s : v;
    };

    const FILTROS: { id: Filtro; label: string; n: number }[] = [
        { id: 'all', label: tk('payFilterAll'), n: cuentas.all },
        { id: 'trialing', label: tk('payFilterTrialing'), n: cuentas.trialing },
        { id: 'active', label: tk('payFilterActive'), n: cuentas.active },
        { id: 'pastDue', label: tk('payFilterPastDue'), n: cuentas.pastDue },
        { id: 'cancelling', label: tk('payFilterCancelling'), n: cuentas.cancelling },
        { id: 'canceled', label: tk('payFilterCanceled'), n: cuentas.canceled },
        { id: 'refunded', label: tk('payFilterRefunded'), n: cuentas.refunded },
    ];

    const tarjeta = (titulo: string, valor: string, pista: string, alerta = false) => (
        <div className={`rounded-2xl border p-4 bg-white dark:bg-zinc-800 shadow-sm ${alerta ? 'border-red-300 dark:border-red-800' : 'dark:border-zinc-700'}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{titulo}</p>
            <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{valor}</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{pista}</p>
        </div>
    );

    const cabecera = (
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
                <h1 className="text-3xl sm:text-4xl font-bold text-brand-dark dark:text-gray-100">{tk('payTitle')}</h1>
                <p className="mt-2 text-base text-gray-700 dark:text-gray-300 max-w-3xl">{tk('paySub')}</p>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                {data && <span>{tk('payUpdated', { time: new Date(data.generatedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })}</span>}
                <button
                    type="button"
                    onClick={() => cargar(true)}
                    disabled={refrescando || estado === 'loading'}
                    className={`inline-flex items-center gap-2 font-semibold text-brand-green hover:underline disabled:opacity-60 min-h-[44px] px-1 ${FOCUS}`}
                >
                    <i className={`fa-solid fa-rotate ${refrescando ? 'fa-spin' : ''}`} aria-hidden="true"></i>
                    {refrescando ? tk('payRefreshing') : tk('payRefresh')}
                </button>
            </div>
        </div>
    );

    let cuerpo: React.ReactNode;
    if (estado === 'loading') {
        cuerpo = (
            <div className="space-y-4" role="status" aria-busy="true" aria-label={tk('payLoading')}>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[0, 1, 2, 3].map(i => <div key={i} className="h-28 rounded-2xl bg-gray-100 dark:bg-zinc-800 animate-pulse motion-reduce:animate-none" />)}</div>
                <div className="h-64 rounded-2xl bg-gray-100 dark:bg-zinc-800 animate-pulse motion-reduce:animate-none" />
            </div>
        );
    } else if (estado === 'missing') {
        cuerpo = (
            <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-5 text-amber-900 dark:text-amber-100">
                <p className="font-bold">{tk('payMissingTitle')}</p>
                <p className="mt-1 text-sm">{tk('payMissingHint')}</p>
            </div>
        );
    } else if (estado === 'error') {
        cuerpo = (
            <div role="alert" className="rounded-2xl border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-5 text-red-900 dark:text-red-100">
                <p className="font-bold">{tk('payErrorTitle')}</p>
                <button type="button" onClick={() => cargar(false)} className={`mt-3 inline-flex items-center gap-2 rounded-lg bg-white dark:bg-zinc-800 border px-4 min-h-[44px] font-semibold ${FOCUS}`}>
                    <i className="fa-solid fa-rotate" aria-hidden="true"></i>{tk('payErrorRetry')}
                </button>
            </div>
        );
    } else if (filas.length === 0) {
        cuerpo = (
            <div className="rounded-2xl border border-dashed dark:border-zinc-700 p-10 text-center bg-white dark:bg-zinc-800">
                <i className="fa-solid fa-credit-card text-3xl text-gray-400" aria-hidden="true"></i>
                <p className="mt-3 text-lg font-bold text-gray-800 dark:text-gray-100">{tk('payEmptyTitle')}</p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{tk('payEmptyHint')}</p>
            </div>
        );
    } else {
        cuerpo = (
            <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {tarjeta(tk('payCardTrial'), String(resumen.enPrueba), tk('payCardTrialHint', { amount: texto(resumen.primerCobro) }))}
                    {tarjeta(tk('payCardActive'), String(resumen.activas), tk('payCardActiveHint', { amount: texto(resumen.mrr) }))}
                    {tarjeta(tk('payCardPastDue'), String(resumen.conImpago), resumen.conImpago > 0 ? tk('payCardPastDueHint') : tk('payCardPastDueNone'), resumen.conImpago > 0)}
                    {tarjeta(tk('payCardNext30'), texto(resumen.importe30), tk('payCardNext30Hint', { count: resumen.en30 }))}
                </div>

                {cuentas.refundedAtRisk > 0 && (
                    <div role="alert" className="rounded-2xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                        <i className="fa-solid fa-triangle-exclamation text-red-700 dark:text-red-300 text-lg flex-shrink-0" aria-hidden="true"></i>
                        <p className="flex-1 text-sm font-semibold text-red-900 dark:text-red-200">{tk('payRefundBanner', { count: cuentas.refundedAtRisk })}</p>
                        <button type="button" onClick={() => setFiltro('refunded')} className={`min-h-[40px] px-4 rounded-lg text-sm font-bold bg-white dark:bg-zinc-800 text-red-800 dark:text-red-200 border border-red-300 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40 ${FOCUS}`}>
                            {tk('payRefundBannerAction')}
                        </button>
                    </div>
                )}

                <div className="rounded-2xl border dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-sm">
                    <div className="p-4 border-b dark:border-zinc-700 space-y-3">
                        <div className="flex flex-wrap gap-2" role="group" aria-label={tk('payFilterAria')}>
                            {FILTROS.map(f => (
                                <button
                                    key={f.id}
                                    type="button"
                                    onClick={() => setFiltro(f.id)}
                                    aria-pressed={filtro === f.id}
                                    className={`inline-flex items-center gap-2 rounded-full px-3 min-h-[40px] text-sm font-semibold border transition-colors ${FOCUS} ${
                                        filtro === f.id
                                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-brand-green/10 dark:text-emerald-300 dark:border-emerald-800'
                                            : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-zinc-600 hover:bg-gray-50 dark:hover:bg-zinc-700'
                                    }`}
                                >
                                    {f.label}
                                    <span className="text-xs tabular-nums rounded-full bg-gray-100 dark:bg-zinc-700 px-2 py-0.5">{f.n}</span>
                                </button>
                            ))}
                        </div>
                        <div className="relative">
                            <label htmlFor="pagos-busqueda" className="sr-only">{tk('paySearchAria')}</label>
                            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true"></i>
                            <input
                                id="pagos-busqueda"
                                type="search"
                                value={busqueda}
                                onChange={e => setBusqueda(e.target.value)}
                                placeholder={tk('paySearch')}
                                className={`w-full min-h-[44px] pl-10 pr-3 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 ${FOCUS}`}
                            />
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400" role="status" aria-live="polite">{tk('payCount', { shown: visibles.length, total: filas.length })}</p>
                    </div>

                    {visibles.length === 0 ? (
                        <div className="p-10 text-center">
                            <p className="font-bold text-gray-800 dark:text-gray-100">{tk('payNoResults')}</p>
                            {hayFiltros && (
                                <button type="button" onClick={limpiar} className={`mt-3 inline-flex items-center gap-2 font-semibold text-brand-green hover:underline min-h-[44px] ${FOCUS}`}>
                                    <i className="fa-solid fa-xmark" aria-hidden="true"></i>{tk('payClear')}
                                </button>
                            )}
                        </div>
                    ) : (
                        <ul className="divide-y dark:divide-zinc-700">
                            <li aria-hidden="true" className="hidden lg:grid grid-cols-12 gap-4 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                <span className="col-span-3">{tk('payColCustomer')}</span>
                                <span className="col-span-3">{tk('payColPlan')}</span>
                                <span className="col-span-2">{tk('payColStatus')}</span>
                                <span className="col-span-2">{tk('payColDates')}</span>
                                <span className="col-span-2">{tk('payColStripe')}</span>
                            </li>
                            {visibles.map(r => {
                                const badge = STATUS_BADGE[r.status] || STATUS_BADGE.canceled;
                                const importe = r.amount == null ? '—' : `${dinero(r.amount, r.currency)}${r.interval === 'year' ? tk('payPerYear') : tk('payPerMonth')}`;
                                const vive = VIVAS.has(r.status);
                                let fechaTexto: string;
                                if (r.status === 'trialing') fechaTexto = tk('payDateTrialEnd', { date: fecha(r.periodEnd) });
                                else if (vive) fechaTexto = tk(r.cancelAtPeriodEnd ? 'payDateCancelling' : 'payDateNextCharge', { date: fecha(r.periodEnd) });
                                else fechaTexto = tk('payDateEnded', { date: fecha(r.endedAt || r.periodEnd) });
                                return (
                                    <li key={r.id} className="px-4 py-4 flex flex-col gap-3 lg:grid lg:grid-cols-12 lg:gap-4 lg:items-center" data-testid="fila-pago">
                                        <div className="lg:col-span-3 min-w-0">
                                            <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{r.userName || tk('payNoName')}</p>
                                            <p className="text-sm text-gray-600 dark:text-gray-300 truncate" title={r.userEmail || ''}>{r.userEmail || tk('payNoEmail')}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate" title={r.businesses.join(', ')}>
                                                {r.businessCount > 0
                                                    ? r.businesses.slice(0, 2).join(', ') + (r.businessCount > 2 ? ` +${r.businessCount - 2}` : '')
                                                    : tk('payNoBusiness')}
                                            </p>
                                        </div>
                                        <div className="lg:col-span-3 min-w-0">
                                            <p className="font-semibold text-gray-800 dark:text-gray-100 truncate">{r.productName || (r.plan ? r.plan.charAt(0).toUpperCase() + r.plan.slice(1) : '—')}</p>
                                            <p className="text-sm text-gray-600 dark:text-gray-300 tabular-nums">{importe}</p>
                                        </div>
                                        <div className="lg:col-span-2">
                                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${badge.cls}`}>
                                                <i className={`fa-solid ${badge.icon}`} aria-hidden="true"></i>{etiquetaEstado(r.status)}
                                            </span>
                                            {vive && r.cancelAtPeriodEnd && <span className="block mt-1 text-xs font-semibold text-amber-700 dark:text-amber-300">{tk('payWillCancel')}</span>}
                                            {r.refund && (
                                                enRiesgoDeRecobro(r) ? (
                                                    <span className="block mt-1 text-xs font-bold text-red-700 dark:text-red-300">
                                                        <i className="fa-solid fa-rotate-left mr-1" aria-hidden="true"></i>
                                                        {tk(r.refund.kind === 'dispute' ? 'payDisputedActive' : 'payRefundedActive', { amount: dinero(r.refund.amount, r.refund.currency || r.currency), date: fecha(r.periodEnd) })}
                                                    </span>
                                                ) : (
                                                    <span className="block mt-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
                                                        <i className="fa-solid fa-rotate-left mr-1" aria-hidden="true"></i>
                                                        {tk(r.refund.kind === 'dispute'
                                                            ? (r.refund.action === 'cancelled' ? 'payDisputedCancelled' : 'payDisputed')
                                                            : r.refund.full ? (r.refund.action === 'cancelled' ? 'payRefundedCancelled' : 'payRefundedFull') : 'payRefundedPartial',
                                                            { amount: dinero(r.refund.amount, r.refund.currency || r.currency) })}
                                                    </span>
                                                )
                                            )}
                                        </div>
                                        <div className="lg:col-span-2 text-sm text-gray-700 dark:text-gray-200">{fechaTexto}</div>
                                        <div className="lg:col-span-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                                            {r.stripeCustomerId && (
                                                <a href={STRIPE_CLIENTE(r.stripeCustomerId)} target="_blank" rel="noopener noreferrer" className={`font-semibold text-brand-green hover:underline min-h-[32px] inline-flex items-center gap-1 ${FOCUS}`}>
                                                    {tk('payStripeCustomer')}<i className="fa-solid fa-arrow-up-right-from-square text-[10px]" aria-hidden="true"></i><span className="sr-only">{tk('payOpensNew')}</span>
                                                </a>
                                            )}
                                            <a href={STRIPE_SUSCRIPCION(r.id)} target="_blank" rel="noopener noreferrer" className={`font-semibold text-brand-green hover:underline min-h-[32px] inline-flex items-center gap-1 ${FOCUS}`}>
                                                {tk('payStripeSub')}<i className="fa-solid fa-arrow-up-right-from-square text-[10px]" aria-hidden="true"></i><span className="sr-only">{tk('payOpensNew')}</span>
                                            </a>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{tk('payNote')}</p>
            </>
        );
    }

    return (
        <>
            <Meta title={`${tk('payTitle')} - Opynio`} description={tk('paySub')} noindex />
            <div className="space-y-5">
                {cabecera}
                {cuerpo}
            </div>
        </>
    );
};

export default AdminPaymentsPage;
