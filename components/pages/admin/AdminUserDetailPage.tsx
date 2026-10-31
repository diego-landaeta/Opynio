import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Meta from '../../Meta';
import Spinner from '../../Spinner';
import { useTranslation, pathTranslations, getLanguageForCountryCode } from '../../../contexts/i18nContext';
import { useNotification } from '../../../contexts/NotificationContext';
import { useConfirm } from '../../../contexts/ConfirmContext';
import { businessUrlId } from '../../../utils/slugify';
import {
    adminUserOverview,
    adminUpdateReviewStatus,
    sendNotificationEmail,
    AdminUserOverviewMissingError,
    type AdminUserOverview,
} from '../../../services/supabaseService';
import { adminBackState } from './AdminBackLink';
import AdminRoleChangeModal from './AdminRoleChangeModal';

/**
 * Ficha de un usuario del admin: quién es, qué reseñas ha publicado, qué empresas tiene (con acceso a verlas como el
 * dueño, en solo lectura), si paga y qué ha abierto en soporte. Los datos vienen de la RPC admin_user_overview.
 * Las únicas acciones que escriben son aprobar / rechazar una de sus reseñas, con confirmación.
 */

type Seccion = 'reviews' | 'votes' | 'businesses' | 'subs' | 'activity';
type Estado = 'loading' | 'ready' | 'error' | 'missing' | 'notFound';

const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-800';
const CARD = 'bg-white dark:bg-zinc-800 rounded-xl shadow-md border dark:border-zinc-700';
const STRIPE_CLIENTE = (id: string) => `https://dashboard.stripe.com/customers/${encodeURIComponent(id)}`;
const STRIPE_SUSCRIPCION = (id: string) => `https://dashboard.stripe.com/subscriptions/${encodeURIComponent(id)}`;

const fecha = (v?: string | null): string => (v ? new Date(v).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const fechaHora = (v?: string | null): string => (v ? new Date(v).toLocaleString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

const REVIEW_BADGE: Record<string, string> = {
    approved: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200',
    pending: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
    rejected: 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200',
};
const SUB_BADGE: Record<string, string> = {
    trialing: 'bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
    active: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200',
    past_due: 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200',
    unpaid: 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200',
    canceled: 'bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-gray-200',
};
const ROLE_BADGE: Record<string, string> = {
    authenticated: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    business_owner: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
    admin: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
};

const Estrellas: React.FC<{ n: number }> = ({ n }) => (
    <span className="text-amber-500 whitespace-nowrap" role="img" aria-label={`${n} / 5`}>
        {'★'.repeat(Math.max(0, Math.min(5, n)))}<span className="text-gray-300 dark:text-zinc-600">{'★'.repeat(5 - Math.max(0, Math.min(5, n)))}</span>
    </span>
);

const AdminUserDetailPage: React.FC = () => {
    const { userId } = useParams<{ userId: string }>();
    const t = useTranslation();
    const tk = useCallback((k: string, p?: Record<string, string | number>) => t(`adminDashboard.${k}`, p), [t]);
    const { showNotification } = useNotification();
    const { confirm } = useConfirm();

    const [data, setData] = useState<AdminUserOverview | null>(null);
    const [estado, setEstado] = useState<Estado>('loading');
    const [seccion, setSeccion] = useState<Seccion>('reviews');
    const [filtroResenas, setFiltroResenas] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');
    const [trabajando, setTrabajando] = useState<number | null>(null);
    const [copiado, setCopiado] = useState(false);
    const [rolAbierto, setRolAbierto] = useState(false);
    const reqId = useRef(0);

    const cargar = useCallback(async () => {
        if (!userId) { setEstado('notFound'); return; }
        const mine = ++reqId.current;
        setEstado('loading');
        try {
            const d = await adminUserOverview(userId);
            if (mine !== reqId.current) return;
            setData(d);
            setEstado('ready');
        } catch (e: any) {
            if (mine !== reqId.current) return;
            if (e instanceof AdminUserOverviewMissingError) setEstado('missing');
            else if (e?.code === 'P0002' || /no encontrado/i.test(e?.message || '')) setEstado('notFound');
            else { console.error('adminUserOverview', e); setEstado('error'); }
        }
    }, [userId]);

    useEffect(() => { cargar(); }, [cargar]);

    const copiarCorreo = async (correo: string) => {
        try {
            await navigator.clipboard.writeText(correo);
            setCopiado(true);
            window.setTimeout(() => setCopiado(false), 1800);
        } catch { showNotification(tk('udCopyError'), 'error'); }
    };

    const moderar = async (reviewId: number, nuevo: 'approved' | 'rejected') => {
        if (!data) return;
        const ok = await confirm({
            title: tk(nuevo === 'approved' ? 'udApproveTitle' : 'udRejectTitle'),
            message: tk(nuevo === 'approved' ? 'udApproveMessage' : 'udRejectMessage'),
            confirmText: tk(nuevo === 'approved' ? 'udApprove' : 'udReject'),
            cancelText: t('common.cancel'),
            danger: nuevo === 'rejected',
        });
        if (!ok) return;
        setTrabajando(reviewId);
        try {
            await adminUpdateReviewStatus(String(reviewId), nuevo);
            // Igual que en Moderación: publicada = el dueño ya tiene el aviso en la web (disparador) y además el correo.
            if (nuevo === 'approved') void sendNotificationEmail({ kind: 'review_published', reviewId });
            showNotification(tk(nuevo === 'approved' ? 'udApproved' : 'udRejected'), 'success');
            setData(prev => {
                if (!prev) return prev;
                const antes = prev.reviews.find(r => r.id === reviewId)?.status;
                const reviews = prev.reviews.map(r => (r.id === reviewId ? { ...r, status: nuevo, rejection_reason: null } : r));
                const counts = { ...prev.counts };
                if (antes && antes !== nuevo) {
                    const k = (s: string) => `reviews_${s}` as 'reviews_approved' | 'reviews_pending' | 'reviews_rejected';
                    counts[k(antes)] = Math.max(0, counts[k(antes)] - 1);
                    counts[k(nuevo)] += 1;
                }
                return { ...prev, reviews, counts };
            });
        } catch (e: any) {
            showNotification(e?.message || tk('udModerateError'), 'error');
        } finally {
            setTrabajando(null);
        }
    };

    if (estado === 'loading') {
        return <div className="flex justify-center items-center h-64" role="status" aria-label={tk('udLoading')}><Spinner /></div>;
    }
    const volver = (
        <Link to="/admin/usuarios" className={`inline-flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:text-brand-green rounded ${FOCUS}`}>
            <i className="fa-solid fa-arrow-left" aria-hidden="true"></i><span>{tk('udBack')}</span>
        </Link>
    );
    if (estado !== 'ready' || !data) {
        const msg = estado === 'missing' ? tk('udMissing') : estado === 'notFound' ? tk('udNotFound') : tk('udError');
        return (
            <>
                <Meta title={`${tk('udTitle')} - Admin`} description="" />
                <div className="mb-4">{volver}</div>
                <div className={`${CARD} p-8 text-center`} role="alert">
                    <p className="font-semibold text-gray-800 dark:text-gray-100">{msg}</p>
                    {estado === 'error' && (
                        <button type="button" onClick={cargar} className={`mt-4 px-4 py-2 text-sm font-semibold text-white bg-brand-green rounded-lg hover:bg-opacity-90 ${FOCUS}`}>{tk('udRetry')}</button>
                    )}
                </div>
            </>
        );
    }

    const a = data.account;
    const nombre = a.name || a.username || a.email || '—';
    const enPrueba = !!a.trial_full_access_until && new Date(a.trial_full_access_until) > new Date();
    const resenas = data.reviews.filter(r => filtroResenas === 'all' || r.status === filtroResenas);
    const proveedor = a.provider === 'google' ? 'Google' : a.provider === 'email' ? tk('udProviderEmail') : (a.provider || '—');

    const rutaPanelDueno = (b: AdminUserOverview['businesses'][number]): string => {
        const lang = b.country ? getLanguageForCountryCode(b.country) : 'es';
        const base = (pathTranslations[lang] ?? pathTranslations.es).businessDashboard.replace(':businessName', businessUrlId(b));
        return `${b.country ? `/${b.country.toLowerCase()}` : ''}/${base}`;
    };
    const rutaPublica = (slug: string | null, country: string | null): string | null => {
        if (!slug) return null;
        const lang = country ? getLanguageForCountryCode(country) : 'es';
        return `${country ? `/${country.toLowerCase()}` : ''}/${(pathTranslations[lang] ?? pathTranslations.es).business.replace(':identifier', slug)}`;
    };

    const Tile: React.FC<{ icon: string; titulo: string; valor: number; destino: Seccion; alerta?: boolean; children: React.ReactNode }> = ({ icon, titulo, valor, destino, alerta, children }) => (
        <button type="button" onClick={() => setSeccion(destino)} aria-label={`${titulo}: ${valor}`} className={`text-left rounded-xl border dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-sm p-4 hover:border-brand-green/60 hover:shadow-md transition-[border-color,box-shadow] ${FOCUS}`}>
            <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-gray-600 dark:text-gray-300"><i className={`fa-solid ${icon} mr-1.5 text-gray-400`} aria-hidden="true"></i>{titulo}</span>
                <span className={`text-2xl font-extrabold tabular-nums ${alerta ? 'text-red-600 dark:text-red-300' : 'text-gray-900 dark:text-gray-100'}`}>{valor}</span>
            </span>
            <span className="mt-1.5 flex flex-col text-xs text-gray-500 dark:text-gray-400 leading-5">{children}</span>
        </button>
    );
    const TabBtn: React.FC<{ id: Seccion; label: string; n: number }> = ({ id, label, n }) => (
        <button
            type="button"
            role="tab"
            aria-selected={seccion === id}
            onClick={() => setSeccion(id)}
            className={`px-3 sm:px-4 py-2 text-sm sm:text-base font-semibold border-b-2 whitespace-nowrap ${FOCUS} ${seccion === id ? 'border-brand-green text-brand-green' : 'border-transparent text-gray-500 hover:text-brand-dark dark:text-gray-400 dark:hover:text-gray-200'}`}
        >
            {label} <span className="ml-1 text-xs font-bold rounded-full bg-gray-100 dark:bg-zinc-700 px-2 py-0.5">{n}</span>
        </button>
    );
    const c = data.counts;
    return (
        <>
            <Meta title={`${nombre} - ${tk('udTitle')} - Admin`} description="" />
            <div className="mb-4">{volver}</div>

            {/* Cabecera: quién es y qué se puede hacer con él */}
            <section className={`${CARD} p-4 sm:p-6`} aria-labelledby="ud-nombre">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center text-2xl font-bold overflow-hidden flex-shrink-0">
                        {a.avatar_url ? <img src={a.avatar_url} alt="" width={64} height={64} className="w-full h-full object-cover" /> : <span>{nombre.charAt(0).toUpperCase()}</span>}
                    </div>
                    <div className="min-w-0 flex-grow">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 id="ud-nombre" className="text-2xl sm:text-3xl font-extrabold text-gray-800 dark:text-gray-100 break-words">{nombre}</h1>
                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${ROLE_BADGE[a.role] || ROLE_BADGE.authenticated}`}>{t(`roles.${a.role}`)}</span>
                            {enPrueba && <span className="text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"><i className="fa-solid fa-gift mr-1" aria-hidden="true"></i>{tk('udTrialUntil', { date: fecha(a.trial_full_access_until) })}</span>}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                            {a.username && <span className="text-gray-500 dark:text-gray-400">@{a.username}</span>}
                            {a.email ? (
                                <>
                                    <a href={`mailto:${a.email}`} className="text-brand-green font-semibold hover:underline break-all">{a.email}</a>
                                    <button type="button" onClick={() => copiarCorreo(a.email!)} className={`text-xs font-semibold text-gray-600 dark:text-gray-300 border dark:border-zinc-600 rounded px-2 py-0.5 hover:bg-gray-50 dark:hover:bg-zinc-700 ${FOCUS}`}>
                                        <i className={`fa-solid ${copiado ? 'fa-check' : 'fa-copy'} mr-1`} aria-hidden="true"></i>{copiado ? tk('udCopied') : tk('udCopyEmail')}
                                    </button>
                                </>
                            ) : <span className="text-gray-500">{t('common.notAvailable')}</span>}
                        </div>
                        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-gray-600 dark:text-gray-300">
                            <li><i className="fa-regular fa-calendar mr-1.5 text-gray-400" aria-hidden="true"></i>{tk('udRegistered')} <b className="font-semibold text-gray-800 dark:text-gray-100">{fecha(a.created_at)}</b></li>
                            <li><i className="fa-regular fa-clock mr-1.5 text-gray-400" aria-hidden="true"></i>{tk('udLastAccess')} <b className="font-semibold text-gray-800 dark:text-gray-100">{a.last_sign_in_at ? fecha(a.last_sign_in_at) : tk('udNever')}</b></li>
                            <li><i className="fa-solid fa-right-to-bracket mr-1.5 text-gray-400" aria-hidden="true"></i>{proveedor}</li>
                            <li className={a.email_confirmed ? '' : 'text-amber-700 dark:text-amber-300'}><i className={`fa-solid ${a.email_confirmed ? 'fa-circle-check text-emerald-500' : 'fa-circle-exclamation'} mr-1.5`} aria-hidden="true"></i>{tk(a.email_confirmed ? 'udEmailOk' : 'udEmailPending')}</li>
                        </ul>
                    </div>
                    <div className="flex flex-wrap sm:flex-col gap-2 sm:items-stretch sm:min-w-[11rem]">
                        <button type="button" onClick={() => setRolAbierto(true)} className={`text-center px-3 py-2 text-sm font-semibold text-white bg-brand-green rounded-lg hover:bg-opacity-90 ${FOCUS}`}>
                            <i className="fa-solid fa-user-gear mr-1.5" aria-hidden="true"></i>{tk('udChangeRole')}
                        </button>
                        <Link to="/admin/enterprise" className={`text-center px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 border dark:border-zinc-600 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700 ${FOCUS}`}>
                            <i className="fa-solid fa-building mr-1.5" aria-hidden="true"></i>{tk('udEnterprise')}
                        </Link>
                        {a.stripe_customer_id && (
                            <a href={STRIPE_CLIENTE(a.stripe_customer_id)} target="_blank" rel="noopener noreferrer" className={`text-center px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 border dark:border-zinc-600 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700 ${FOCUS}`}>
                                <i className="fa-brands fa-stripe-s mr-1.5" aria-hidden="true"></i>{tk('udStripe')}
                                <span className="sr-only"> {tk('udNewTab')}</span>
                            </a>
                        )}
                    </div>
                </div>

                {/* Plan y uso, en una sola línea */}
                <p className="mt-4 pt-3 border-t dark:border-zinc-700 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-600 dark:text-gray-300">
                    <span>{tk('udPlan')}: <b className="font-semibold text-gray-800 dark:text-gray-100">{a.plan || 'free'}{a.billing_cycle ? ` · ${a.billing_cycle === 'annual' ? tk('udAnnual') : tk('udMonthly')}` : ''}</b></span>
                    {a.plan_expires_at && <span>{tk('udPlanExpires')}: <b className="font-semibold text-gray-800 dark:text-gray-100">{fecha(a.plan_expires_at)}</b></span>}
                    <span>{tk('udAiCredits')}: <b className="font-semibold text-gray-800 dark:text-gray-100">{a.ai_credits_used ?? 0}{a.ai_credit_limit != null ? ` / ${a.ai_credit_limit}` : ''}</b></span>
                    <span>{tk('udBusinessLimit')}: <b className="font-semibold text-gray-800 dark:text-gray-100">{a.business_limit != null ? a.business_limit : tk('udDefault')}</b></span>
                </p>
            </section>

            {/* Resumen: cuatro tarjetas, cada una lleva a su pestaña */}
            <section aria-label={tk('udSummary')} className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <Tile icon="fa-star" titulo={tk('udTabReviews')} valor={c.reviews_total} destino="reviews">
                    <span>{c.reviews_approved} {tk('udApprovedPl').toLowerCase()}</span>
                    <span className={c.reviews_pending ? 'font-semibold text-amber-600 dark:text-amber-300' : ''}>{c.reviews_pending} {tk('udPendingPl').toLowerCase()}</span>
                    <span className={c.reviews_rejected ? 'font-semibold text-red-600 dark:text-red-300' : ''}>{c.reviews_rejected} {tk('udRejectedPl').toLowerCase()}</span>
                </Tile>
                <Tile icon="fa-thumbs-up" titulo={tk('udTabVotes')} valor={c.votes_given_helpful + c.votes_given_not_helpful} destino="votes" alerta={c.votes_given_not_helpful > c.votes_given_helpful}>
                    <span>{tk('udGiven')}: {c.votes_given_helpful} {tk('udHelpful').toLowerCase()} · {c.votes_given_not_helpful} {tk('udNotHelpful').toLowerCase()}</span>
                    <span>{tk('udReceived')}: {c.likes_received} {tk('udHelpful').toLowerCase()} · {c.dislikes_received} {tk('udNotHelpful').toLowerCase()}</span>
                </Tile>
                <Tile icon="fa-building" titulo={tk('udTabBusinesses')} valor={c.businesses} destino="businesses">
                    <span>{c.businesses ? tk('udBusinessesHint') : tk('udNoBusinesses')}</span>
                </Tile>
                <Tile icon="fa-headset" titulo={tk('udTabActivity')} valor={c.tickets + c.bugs + c.claims + c.appeals} destino="activity">
                    <span>{c.tickets} {tk('udTickets').toLowerCase()} · {c.bugs} {tk('udBugs').toLowerCase()}</span>
                    <span>{c.claims} {tk('udClaims').toLowerCase()} · {c.appeals} {tk('udAppeals').toLowerCase()}</span>
                </Tile>
            </section>

            {/* Secciones */}
            <section className={`${CARD} mt-6 p-3 sm:p-6`}>
                <div className="border-b dark:border-zinc-700 mb-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <nav className="-mb-px flex space-x-1 sm:space-x-4" role="tablist" aria-label={tk('udTitle')}>
                        <TabBtn id="reviews" label={tk('udTabReviews')} n={c.reviews_total} />
                        <TabBtn id="votes" label={tk('udTabVotes')} n={c.votes_given_helpful + c.votes_given_not_helpful} />
                        <TabBtn id="businesses" label={tk('udTabBusinesses')} n={c.businesses} />
                        <TabBtn id="subs" label={tk('udTabSubs')} n={data.subscriptions.length} />
                        <TabBtn id="activity" label={tk('udTabActivity')} n={c.tickets + c.bugs + c.claims + c.appeals} />
                    </nav>
                </div>

                {seccion === 'reviews' && (
                    <div role="tabpanel">
                        <div className="flex flex-wrap items-center gap-2 mb-4">
                            {(['all', 'approved', 'pending', 'rejected'] as const).map(f => (
                                <button key={f} type="button" onClick={() => setFiltroResenas(f)} aria-pressed={filtroResenas === f}
                                    className={`px-3 py-1 text-sm font-semibold rounded-full border ${FOCUS} ${filtroResenas === f ? 'bg-brand-green text-white border-brand-green' : 'border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700'}`}>
                                    {tk(f === 'all' ? 'udFilterAll' : f === 'approved' ? 'udApprovedPl' : f === 'pending' ? 'udPendingPl' : 'udRejectedPl')}
                                </button>
                            ))}
                            {c.reviews_total > data.reviews.length && <span className="text-xs text-gray-500 dark:text-gray-400">{tk('udShowingLast', { count: data.reviews.length })}</span>}
                        </div>
                        {resenas.length === 0 ? (
                            <p className="text-center py-10 text-gray-500 dark:text-gray-400">{tk('udNoReviews')}</p>
                        ) : (
                            <ul className="space-y-3">
                                {resenas.map(r => {
                                    const url = rutaPublica(r.business_slug, r.business_country);
                                    return (
                                        <li key={r.id} className="rounded-lg border dark:border-zinc-700 p-3 sm:p-4">
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                                <Estrellas n={r.rating} />
                                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${REVIEW_BADGE[r.status] || ''}`}>{tk(r.status === 'approved' ? 'udApproved1' : r.status === 'pending' ? 'udPending1' : 'udRejected1')}</span>
                                                <span className="text-xs text-gray-500 dark:text-gray-400">{fechaHora(r.created_at)}</span>
                                                {r.source && r.source !== 'opynio' && <span className="text-xs text-gray-500 dark:text-gray-400">· {r.source}</span>}
                                                <span className="text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap" title={`${tk('udHelpful')} / ${tk('udNotHelpful')}`}>
                                                    <i className="fa-regular fa-thumbs-up mr-1" aria-hidden="true"></i>{r.helpful_votes}
                                                    <i className="fa-regular fa-thumbs-down ml-3 mr-1" aria-hidden="true"></i>{r.not_helpful_votes}
                                                    <span className="sr-only"> ({tk('udHelpful')} / {tk('udNotHelpful')})</span>
                                                </span>
                                            </div>
                                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                                {tk('udFor')}{' '}
                                                {url ? <Link to={url} className="font-semibold text-brand-green hover:underline">{r.business_name || r.business_id}</Link> : <span className="font-semibold">{r.business_name || r.business_id}</span>}
                                            </p>
                                            {r.title && <h3 className="mt-1 font-bold text-gray-900 dark:text-gray-100 break-words">{r.title}</h3>}
                                            {r.text && <p className="mt-1 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line break-words">{r.text}</p>}
                                            {r.status === 'rejected' && r.rejection_reason && <p className="mt-1 text-xs text-red-700 dark:text-red-300">{tk('udReason')}: {r.rejection_reason}</p>}
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {r.status !== 'approved' && (
                                                    <button type="button" disabled={trabajando === r.id} onClick={() => moderar(r.id, 'approved')} className={`px-3 py-1.5 text-xs font-bold rounded-md bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-300 disabled:opacity-50 ${FOCUS}`}>
                                                        <i className="fa-solid fa-check mr-1" aria-hidden="true"></i>{tk('udApprove')}
                                                    </button>
                                                )}
                                                {r.status !== 'rejected' && (
                                                    <button type="button" disabled={trabajando === r.id} onClick={() => moderar(r.id, 'rejected')} className={`px-3 py-1.5 text-xs font-bold rounded-md bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300 disabled:opacity-50 ${FOCUS}`}>
                                                        <i className="fa-solid fa-xmark mr-1" aria-hidden="true"></i>{tk('udReject')}
                                                    </button>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                )}

                {seccion === 'votes' && (
                    <div role="tabpanel">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{tk('udVotesHelp')}</p>
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">{tk('udVotesSummary', { helpful: c.votes_given_helpful, notHelpful: c.votes_given_not_helpful })}{c.votes_given_helpful + c.votes_given_not_helpful > data.votes.length ? ` · ${tk('udShowingLast', { count: data.votes.length })}` : ''}</p>
                        {data.votes.length === 0 ? (
                            <p className="text-center py-10 text-gray-500 dark:text-gray-400">{tk('udNoVotes')}</p>
                        ) : (
                            <ul className="space-y-2">
                                {data.votes.map(v => {
                                    const url = rutaPublica(v.business_slug, v.business_country);
                                    return (
                                        <li key={v.id} className="rounded-lg border dark:border-zinc-700 p-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                                            <span className={`inline-flex items-center gap-1 whitespace-nowrap text-xs font-bold px-2 py-1 rounded-full ${v.is_helpful ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200' : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200'}`}>
                                                <i className={`fa-regular ${v.is_helpful ? 'fa-thumbs-up' : 'fa-thumbs-down'}`} aria-hidden="true"></i>{tk(v.is_helpful ? 'udHelpful' : 'udNotHelpful')}
                                            </span>
                                            <span className="min-w-0 flex-grow">
                                                <span className="text-gray-500 dark:text-gray-400">{tk('udVotedOn')} </span>
                                                <span className="font-semibold text-gray-900 dark:text-gray-100 break-words">{v.review_title ? `«${v.review_title}»` : `#${v.review_id}`}</span>
                                                {v.review_rating ? <span className="ml-2"><Estrellas n={v.review_rating} /></span> : null}
                                                {v.business_name && <span className="text-gray-500 dark:text-gray-400"> · {tk('udFor').toLowerCase()} {url ? <Link to={url} className="font-semibold text-brand-green hover:underline">{v.business_name}</Link> : v.business_name}</span>}
                                            </span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{fechaHora(v.created_at)}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                )}

                {seccion === 'businesses' && (
                    <div role="tabpanel">
                        {data.businesses.length === 0 ? (
                            <p className="text-center py-10 text-gray-500 dark:text-gray-400">{tk('udNoBusinesses')}</p>
                        ) : (
                            <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                {data.businesses.map(b => {
                                    const url = rutaPublica(b.slug, b.country);
                                    return (
                                        <li key={b.id} className="rounded-lg border dark:border-zinc-700 p-3 sm:p-4">
                                            <div className="flex items-start gap-3">
                                                <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-zinc-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                    {b.logo_url ? <img src={b.logo_url} alt="" width={48} height={48} loading="lazy" className="w-full h-full object-contain" /> : <i className="fa-solid fa-building text-gray-400" aria-hidden="true"></i>}
                                                </div>
                                                <div className="min-w-0 flex-grow">
                                                    <h3 className="font-bold text-gray-900 dark:text-gray-100 break-words">{b.name}</h3>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">{[b.country, b.category].filter(Boolean).join(' · ')}{b.is_featured ? ` · ${tk('udFeatured')}` : ''}</p>
                                                </div>
                                            </div>
                                            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                                                <div><dt className="text-xs text-gray-500 dark:text-gray-400">{tk('udRating')}</dt><dd className="font-bold">{b.avg_rating != null ? Number(b.avg_rating).toFixed(1) : '—'}</dd></div>
                                                <div><dt className="text-xs text-gray-500 dark:text-gray-400">{tk('udReviewsRecv')}</dt><dd className="font-bold">{b.reviews_approved}{b.reviews_pending ? <span className="text-amber-600 text-xs"> (+{b.reviews_pending})</span> : null}</dd></div>
                                                <div><dt className="text-xs text-gray-500 dark:text-gray-400">{tk('udInvitations')}</dt><dd className="font-bold">{b.invitations_sent}</dd></div>
                                            </dl>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <Link to={rutaPanelDueno(b)} className={`px-3 py-1.5 text-xs font-bold rounded-md text-white bg-brand-green hover:bg-opacity-90 ${FOCUS}`}>
                                                    <i className="fa-solid fa-eye mr-1" aria-hidden="true"></i>{tk('udViewAsOwner')}
                                                </Link>
                                                <Link to={`/admin/empresa/editar/${b.id}`} state={adminBackState(`/admin/usuarios/${a.id}`, 'admin.backToUser')} className={`px-3 py-1.5 text-xs font-bold rounded-md border dark:border-zinc-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 ${FOCUS}`}>
                                                    <i className="fa-solid fa-pen mr-1" aria-hidden="true"></i>{tk('udEditBusiness')}
                                                </Link>
                                                {url && (
                                                    <Link to={url} className={`px-3 py-1.5 text-xs font-bold rounded-md border dark:border-zinc-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 ${FOCUS}`}>
                                                        <i className="fa-solid fa-globe mr-1" aria-hidden="true"></i>{tk('udPublicPage')}
                                                    </Link>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                )}

                {seccion === 'subs' && (
                    <div role="tabpanel">
                        {data.subscriptions.length === 0 ? (
                            <p className="text-center py-10 text-gray-500 dark:text-gray-400">{tk('udNoSubs')}</p>
                        ) : (
                            <ul className="space-y-3">
                                {data.subscriptions.map(s => (
                                    <li key={s.id} className="rounded-lg border dark:border-zinc-700 p-3 sm:p-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${SUB_BADGE[s.status] || SUB_BADGE.canceled}`}>{tk(`udSub_${s.status}`) === `adminDashboard.udSub_${s.status}` ? s.status : tk(`udSub_${s.status}`)}</span>
                                        {s.cancel_at_period_end && <span className="text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">{tk('udCancelsAtEnd')}</span>}
                                        <span className="text-sm text-gray-600 dark:text-gray-300">{tk('udCreatedOn', { date: fecha(s.created) })}</span>
                                        <span className="text-sm text-gray-600 dark:text-gray-300">{tk('udPeriodEnd', { date: fecha(s.current_period_end) })}</span>
                                        <a href={STRIPE_SUSCRIPCION(s.id)} target="_blank" rel="noopener noreferrer" className={`ml-auto text-sm font-semibold text-brand-green hover:underline ${FOCUS}`}>
                                            {tk('udStripeSub')} <i className="fa-solid fa-arrow-up-right-from-square text-xs" aria-hidden="true"></i><span className="sr-only"> {tk('udNewTab')}</span>
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                {seccion === 'activity' && (
                    <div role="tabpanel" className="space-y-6">
                        {c.tickets + c.bugs + c.claims + c.appeals === 0 && <p className="text-center py-10 text-gray-500 dark:text-gray-400">{tk('udNoActivity')}</p>}
                        {data.tickets.length > 0 && (
                            <div>
                                <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-2">{tk('udTickets')} <Link to="/admin/soporte" className="ml-2 text-sm font-semibold text-brand-green hover:underline">{tk('udOpenSupport')}</Link></h3>
                                <ul className="space-y-2">{data.tickets.map(x => <li key={x.id} className="rounded-lg border dark:border-zinc-700 p-3 text-sm flex flex-wrap gap-x-4 gap-y-1"><span className="font-semibold text-gray-900 dark:text-gray-100">#{x.id} · {x.subject}</span><span className="text-gray-500">{x.status}</span><span className="text-gray-500">{fecha(x.created_at)}</span></li>)}</ul>
                            </div>
                        )}
                        {data.bugs.length > 0 && (
                            <div>
                                <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-2">{tk('udBugs')} <Link to="/admin/bugs" className="ml-2 text-sm font-semibold text-brand-green hover:underline">{tk('udOpenBugs')}</Link></h3>
                                <ul className="space-y-2">{data.bugs.map(x => <li key={String(x.id)} className="rounded-lg border dark:border-zinc-700 p-3 text-sm flex flex-wrap gap-x-4 gap-y-1"><span className="font-semibold text-gray-900 dark:text-gray-100">#{x.id} · {x.title || x.description}</span><span className="text-gray-500">{x.status}</span><span className="text-gray-500">{fecha(x.created_at)}</span></li>)}</ul>
                            </div>
                        )}
                        {data.claims.length > 0 && (
                            <div>
                                <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-2">{tk('udClaims')} <Link to="/admin/reclamaciones" className="ml-2 text-sm font-semibold text-brand-green hover:underline">{tk('udOpenClaims')}</Link></h3>
                                <ul className="space-y-2">{data.claims.map(x => <li key={x.id} className="rounded-lg border dark:border-zinc-700 p-3 text-sm flex flex-wrap gap-x-4 gap-y-1"><span className="font-semibold text-gray-900 dark:text-gray-100">#{x.id} · {x.business_name || x.business_id}</span><span className="text-gray-500">{x.status}</span><span className="text-gray-500">{fecha(x.created_at)}</span></li>)}</ul>
                            </div>
                        )}
                        {data.appeals.length > 0 && (
                            <div>
                                <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-2">{tk('udAppeals')} <Link to="/admin/apelaciones-resenas" className="ml-2 text-sm font-semibold text-brand-green hover:underline">{tk('udOpenAppeals')}</Link></h3>
                                <ul className="space-y-2">{data.appeals.map(x => <li key={x.id} className="rounded-lg border dark:border-zinc-700 p-3 text-sm flex flex-wrap gap-x-4 gap-y-1"><span className="font-semibold text-gray-900 dark:text-gray-100">#{x.id} · {x.review_title || `#${x.review_id}`}</span><span className="text-gray-500">{x.status}</span><span className="text-gray-500">{fecha(x.created_at)}</span></li>)}</ul>
                            </div>
                        )}
                    </div>
                )}
            </section>

            {rolAbierto && (
                <AdminRoleChangeModal
                    user={{ id: a.id, name: nombre, role: a.role }}
                    onClose={() => setRolAbierto(false)}
                    onChanged={() => { setRolAbierto(false); cargar(); }}
                />
            )}
        </>
    );
};

export default AdminUserDetailPage;
