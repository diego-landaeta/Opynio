import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { useTranslation, useI18n, localizedPathOrRoot } from '../../contexts/i18nContext';
import { useCountry } from '../../contexts/CountryContext';
import { useUserErrorNotifier } from '../../utils/userFacingError';
import Spinner from '../Spinner';
import {
    getMySupportTickets,
    getSupportTicketMessages,
    replyToSupportTicket,
    setSupportTicketStatus,
    getMySupportRequests,
    SUPPORT_BODY_MAX,
    type SupportTicket,
    type SupportTicketMessage,
    type SupportRequestSummary,
} from '../../services/supabaseService';
import { TicketStatusBadge, TicketThread } from './supportUi';

// Estados de los formularios antiguos que tienen texto propio.
const REQ_STATUS_KEYS = ['pending', 'in_progress', 'approved', 'rejected', 'resolved', 'closed'];

/**
 * «Mis solicitudes de soporte» dentro del perfil propio (sin URL nueva: el
 * ancla #soporte la usan la campana y el aviso de «solicitud enviada»).
 * Lista de solicitudes; al abrir una, el hilo y la caja de respuesta. Debajo,
 * en modo lectura, el estado de sus reportes de error, reclamaciones de
 * empresa y apelaciones de resena.
 */
const MySupportTickets: React.FC = () => {
    const { user, profile, notifications } = useAuth();
    const { showNotification } = useNotification();
    const { notifyError } = useUserErrorNotifier();
    const t = useTranslation();
    const { language } = useI18n();
    const { country } = useCountry();
    const location = ReactRouterDOM.useLocation();
    const sectionRef = useRef<HTMLElement>(null);

    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [requests, setRequests] = useState<SupportRequestSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [openId, setOpenId] = useState<number | null>(null);
    const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
    const [loadingThread, setLoadingThread] = useState(false);
    const [reply, setReply] = useState('');
    const [busy, setBusy] = useState(false);

    const loadList = useCallback(async (quiet = false) => {
        if (!user) return;
        if (!quiet) setLoading(true);
        try {
            const [mine, others] = await Promise.all([
                getMySupportTickets(user.id),
                getMySupportRequests(user.id).catch(() => [] as SupportRequestSummary[]),
            ]);
            setTickets(mine);
            setRequests(others);
        } catch (error) {
            console.error('Error loading support tickets:', error);
        } finally {
            if (!quiet) setLoading(false);
        }
    }, [user]);

    const loadThread = useCallback(async (id: number) => {
        setLoadingThread(true);
        try {
            setMessages(await getSupportTicketMessages(id));
        } catch (error) {
            await notifyError(error, { flow: 'support' });
        } finally {
            setLoadingThread(false);
        }
    }, [notifyError]);

    useEffect(() => { loadList(); }, [loadList]);

    useEffect(() => {
        if (openId !== null) loadThread(openId);
    }, [openId, loadThread]);

    // Llega una respuesta de soporte (campana en tiempo real): se recarga la
    // lista y, si esa solicitud esta abierta, el hilo.
    const lastSupportNotif = notifications.find(n => n.type === 'support_reply')?.id;
    const firstRun = useRef(true);
    useEffect(() => {
        if (firstRun.current) { firstRun.current = false; return; }
        if (!lastSupportNotif) return;
        loadList(true);
        if (openId !== null) loadThread(openId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lastSupportNotif]);

    // #soporte: desde la campana o tras enviar una solicitud.
    useEffect(() => {
        if (location.hash === '#soporte' && !loading) {
            sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [location.hash, location.key, loading]);

    if (!user) return null;

    const current = tickets.find(tk => tk.id === openId) || null;
    const ownerLabel = profile?.name || profile?.username || user.email || '';
    const supportPath = localizedPathOrRoot('support', language, country);
    const fecha = (iso: string) => new Date(iso).toLocaleDateString(language);

    const handleReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!current || !reply.trim()) return;
        setBusy(true);
        try {
            await replyToSupportTicket(current.id, user.id, reply);
            setReply('');
            await Promise.all([loadThread(current.id), loadList(true)]);
        } catch (error) {
            await notifyError(error, { flow: 'support' });
        } finally {
            setBusy(false);
        }
    };

    const handleStatus = async (status: 'closed' | 'open') => {
        if (!current) return;
        setBusy(true);
        try {
            await setSupportTicketStatus(current.id, status);
            showNotification(t(status === 'closed' ? 'supportPage.ticketClosedOk' : 'supportPage.ticketReopenedOk'), 'success');
            await loadList(true);
        } catch (error) {
            await notifyError(error, { flow: 'support' });
        } finally {
            setBusy(false);
        }
    };

    const reqStatusLabel = (status: string) => {
        const s = status === 'open' ? 'pending' : status;
        return REQ_STATUS_KEYS.includes(s) ? t(`supportPage.reqStatus_${s}`) : status;
    };

    return (
        <section id="soporte" ref={sectionRef} className="bg-white dark:bg-zinc-800 p-6 sm:p-8 rounded-xl shadow-lg scroll-mt-24">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h2 className="text-2xl font-bold dark:text-gray-100">{t('supportPage.myRequestsTitle')}</h2>
                <ReactRouterDOM.Link
                    to={supportPath}
                    className="self-start sm:self-auto inline-flex items-center gap-2 bg-brand-green text-white font-semibold text-sm py-2 px-4 rounded-lg hover:bg-opacity-90 transition-colors"
                >
                    <i className="fa-solid fa-plus" aria-hidden="true"></i>
                    <span>{t('supportPage.myRequestsNew')}</span>
                </ReactRouterDOM.Link>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-24"><Spinner /></div>
            ) : current ? (
                <div className="space-y-4">
                    <button
                        type="button"
                        onClick={() => { setOpenId(null); setMessages([]); setReply(''); }}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:text-brand-green"
                    >
                        <i className="fa-solid fa-arrow-left" aria-hidden="true"></i>
                        {t('supportPage.ticketBack')}
                    </button>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 break-words">{current.subject}</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                #{current.id} · {t(`supportPage.ticketType_${current.type}`)} · {fecha(current.created_at)}
                            </p>
                        </div>
                        <TicketStatusBadge status={current.status} label={t(`supportPage.ticketStatus_${current.status}`)} />
                    </div>

                    {loadingThread && messages.length === 0 ? (
                        <div className="flex justify-center py-6"><Spinner /></div>
                    ) : (
                        <TicketThread
                            messages={messages}
                            ownerLabel={ownerLabel}
                            staffLabel={t('supportPage.ticketStaffAuthor')}
                            viewerIsStaff={false}
                            locale={language}
                        />
                    )}

                    {current.status === 'closed' ? (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-700">
                            <p className="text-sm text-gray-600 dark:text-gray-300 flex-1">{t('supportPage.ticketClosedNotice')}</p>
                            <button type="button" disabled={busy} onClick={() => handleStatus('open')} className="text-sm font-semibold text-brand-green hover:underline disabled:opacity-50">
                                {t('supportPage.ticketReopen')}
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleReply} className="space-y-2">
                            <label htmlFor="ticket-reply" className="sr-only">{t('supportPage.ticketReplyPlaceholder')}</label>
                            <textarea
                                id="ticket-reply"
                                value={reply}
                                onChange={e => setReply(e.target.value)}
                                rows={3}
                                maxLength={SUPPORT_BODY_MAX}
                                placeholder={t('supportPage.ticketReplyPlaceholder')}
                                className="w-full p-2 border border-gray-300 dark:border-zinc-700 rounded-md bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-gray-200"
                            />
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <button type="button" disabled={busy} onClick={() => handleStatus('closed')} className="text-sm font-semibold text-gray-600 dark:text-gray-300 hover:text-red-600 disabled:opacity-50">
                                    <i className="fa-solid fa-lock mr-1.5" aria-hidden="true"></i>{t('supportPage.ticketClose')}
                                </button>
                                <button type="submit" disabled={busy || !reply.trim()} className="bg-brand-green text-white font-bold py-2 px-5 rounded-lg disabled:opacity-50">
                                    {busy ? t('common.sending') : t('supportPage.ticketReplySend')}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            ) : tickets.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-900/50 rounded-lg">
                    <p className="font-semibold">{t('supportPage.myRequestsEmpty')}</p>
                </div>
            ) : (
                <ul className="divide-y divide-gray-200 dark:divide-zinc-700 border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                    {tickets.map(tk => (
                        <li key={tk.id}>
                            <button
                                type="button"
                                onClick={() => setOpenId(tk.id)}
                                className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition-colors"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className={`truncate text-gray-800 dark:text-gray-100 ${tk.status === 'waiting_user' ? 'font-bold' : 'font-medium'}`}>{tk.subject}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                        #{tk.id} · {t(`supportPage.ticketType_${tk.type}`)} · {fecha(tk.last_message_at)}
                                    </p>
                                </div>
                                <TicketStatusBadge status={tk.status} label={t(`supportPage.ticketStatus_${tk.status}`)} />
                                <i className="fa-solid fa-chevron-right text-gray-300 dark:text-zinc-600" aria-hidden="true"></i>
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {!loading && !current && requests.length > 0 && (
                <div className="mt-8">
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3">{t('supportPage.otherRequestsTitle')}</h3>
                    <ul className="space-y-2">
                        {requests.map(r => (
                            <li key={`${r.kind}-${r.id}`} className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-700">
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{t(`supportPage.reqKind_${r.kind}`)}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                        {fecha(r.created_at)}{r.label ? ` · ${r.label}` : ''}
                                    </p>
                                </div>
                                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 text-gray-700 dark:text-gray-200 whitespace-nowrap">
                                    {reqStatusLabel(r.status)}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
};

export default MySupportTickets;
