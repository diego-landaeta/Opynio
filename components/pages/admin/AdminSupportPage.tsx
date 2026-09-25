import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useNotification } from '../../../contexts/NotificationContext';
import { useTranslation, pathTranslations } from '../../../contexts/i18nContext';
import Spinner from '../../Spinner';
import Meta from '../../Meta';
import AdminBackLink from './AdminBackLink';
import {
    adminListSupportTickets,
    adminSupportTicketCounts,
    getSupportTicketMessages,
    replyToSupportTicket,
    setSupportTicketStatus,
    SUPPORT_TICKET_TYPES,
    SUPPORT_TICKET_STATUSES,
    SUPPORT_BODY_MAX,
    type AdminSupportTicketRow,
    type SupportTicketMessage,
    type SupportTicketStatus,
} from '../../../services/supabaseService';
import { TicketStatusBadge, TicketThread } from '../../support/supportUi';

// Bandeja de soporte del admin (/admin/soporte, privada y noindex como todo
// /admin). El panel va siempre en espanol; los nombres de tipo y estado salen
// de las mismas claves que ve el usuario.

type Filtro = 'active' | SupportTicketStatus | 'all';
const PAGE = 25;

const AdminSupportPage: React.FC = () => {
    const { user } = useAuth();
    const { showNotification } = useNotification();
    const t = useTranslation();

    const [filtro, setFiltro] = useState<Filtro>('active');
    const [tipo, setTipo] = useState<string>('all');
    const [busqueda, setBusqueda] = useState('');
    const [busquedaAplicada, setBusquedaAplicada] = useState('');
    const [page, setPage] = useState(0);
    const [rows, setRows] = useState<AdminSupportTicketRow[]>([]);
    const [total, setTotal] = useState(0);
    const [counts, setCounts] = useState<Record<SupportTicketStatus, number>>({ open: 0, in_progress: 0, waiting_user: 0, resolved: 0, closed: 0 });
    const [loading, setLoading] = useState(true);

    const [selected, setSelected] = useState<AdminSupportTicketRow | null>(null);
    const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
    const [loadingThread, setLoadingThread] = useState(false);
    const [reply, setReply] = useState('');
    const [statusAfter, setStatusAfter] = useState<SupportTicketStatus>('waiting_user');
    const [busy, setBusy] = useState(false);

    const statusLabel = (s: SupportTicketStatus) => t(`supportPage.ticketStatus_${s}`);
    const typeLabel = (s: string) => t(`supportPage.ticketType_${s}`);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [list, c] = await Promise.all([
                adminListSupportTickets({ status: filtro, type: tipo, search: busquedaAplicada, limit: PAGE, offset: page * PAGE }),
                adminSupportTicketCounts(),
            ]);
            setRows(list.rows);
            setTotal(list.total);
            setCounts(c);
            // Refresca la fila abierta (estado, n.º de mensajes) si sigue en la lista.
            setSelected(prev => (prev ? list.rows.find(r => r.id === prev.id) || prev : prev));
        } catch (error: any) {
            showNotification(error?.message || 'No se pudieron cargar las solicitudes.', 'error');
        } finally {
            setLoading(false);
        }
    }, [filtro, tipo, busquedaAplicada, page, showNotification]);

    useEffect(() => { load(); }, [load]);

    const loadThread = useCallback(async (id: number) => {
        setLoadingThread(true);
        try {
            setMessages(await getSupportTicketMessages(id));
        } catch (error: any) {
            showNotification(error?.message || 'No se pudo cargar la conversación.', 'error');
        } finally {
            setLoadingThread(false);
        }
    }, [showNotification]);

    const abrir = (row: AdminSupportTicketRow) => {
        setSelected(row);
        setReply('');
        setStatusAfter('waiting_user');
        setMessages([]);
        loadThread(row.id);
    };

    const handleReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selected || !user || !reply.trim()) return;
        setBusy(true);
        try {
            await replyToSupportTicket(selected.id, user.id, reply);
            // El trigger ya la deja en «waiting_user»; solo se cambia si se eligio otro.
            if (statusAfter !== 'waiting_user') await setSupportTicketStatus(selected.id, statusAfter);
            setReply('');
            showNotification('Respuesta enviada. El usuario recibe el aviso en la web.', 'success');
            await Promise.all([loadThread(selected.id), load()]);
        } catch (error: any) {
            showNotification(error?.message || 'No se pudo enviar la respuesta.', 'error');
        } finally {
            setBusy(false);
        }
    };

    const cambiarEstado = async (status: SupportTicketStatus) => {
        if (!selected) return;
        setBusy(true);
        try {
            await setSupportTicketStatus(selected.id, status);
            setSelected({ ...selected, status });
            showNotification(`Solicitud #${selected.id}: ${statusLabel(status)}.`, 'success');
            await load();
        } catch (error: any) {
            showNotification(error?.message || 'No se pudo cambiar el estado.', 'error');
        } finally {
            setBusy(false);
        }
    };

    const activas = counts.open + counts.in_progress + counts.waiting_user;
    const todas = activas + counts.resolved + counts.closed;
    const FILTROS: { id: Filtro; label: string; n: number }[] = [
        { id: 'active', label: 'Activas', n: activas },
        { id: 'open', label: statusLabel('open'), n: counts.open },
        { id: 'in_progress', label: statusLabel('in_progress'), n: counts.in_progress },
        { id: 'waiting_user', label: 'Esperando al usuario', n: counts.waiting_user },
        { id: 'resolved', label: statusLabel('resolved'), n: counts.resolved },
        { id: 'closed', label: statusLabel('closed'), n: counts.closed },
        { id: 'all', label: t('common.all'), n: todas },
    ];
    const paginas = Math.max(1, Math.ceil(total / PAGE));
    const fecha = (iso: string) => new Date(iso).toLocaleString('es');

    return (
        <>
            <Meta title="Soporte - Admin" description="Solicitudes de soporte de los usuarios." noindex={true} />
            <AdminBackLink />
            <div className="space-y-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="text-3xl font-extrabold text-gray-800 dark:text-gray-100">Soporte</h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">
                            {counts.open > 0
                                ? <><strong className="text-gray-800 dark:text-gray-100">{counts.open}</strong> {counts.open === 1 ? 'solicitud abierta espera respuesta' : 'solicitudes abiertas esperan respuesta'}.</>
                                : 'No hay solicitudes abiertas esperando respuesta.'}
                        </p>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-800 p-3 sm:p-6 rounded-xl shadow-md border dark:border-zinc-700 space-y-4">
                    <div className="border-b dark:border-zinc-700 overflow-x-auto">
                        <nav className="-mb-px flex gap-2 sm:gap-5" aria-label="Filtrar por estado">
                            {FILTROS.map(f => (
                                <button
                                    key={f.id}
                                    type="button"
                                    onClick={() => { setFiltro(f.id); setPage(0); }}
                                    aria-pressed={filtro === f.id}
                                    className={`px-2 py-2 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                                        filtro === f.id
                                            ? 'border-brand-green text-brand-green'
                                            : 'border-transparent text-gray-500 hover:text-brand-dark dark:text-gray-400 dark:hover:text-gray-200'
                                    }`}
                                >
                                    {f.label} <span className="ml-1 text-xs font-normal opacity-80">({f.n})</span>
                                </button>
                            ))}
                        </nav>
                    </div>

                    <form
                        className="flex flex-col sm:flex-row gap-2"
                        onSubmit={e => { e.preventDefault(); setPage(0); setBusquedaAplicada(busqueda); }}
                    >
                        <label htmlFor="support-type" className="sr-only">Tipo</label>
                        <select
                            id="support-type"
                            value={tipo}
                            onChange={e => { setTipo(e.target.value); setPage(0); }}
                            className="p-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 text-sm text-gray-900 dark:text-gray-100"
                        >
                            <option value="all">Todos los tipos</option>
                            {SUPPORT_TICKET_TYPES.map(ty => <option key={ty} value={ty}>{typeLabel(ty)}</option>)}
                        </select>
                        <label htmlFor="support-search" className="sr-only">Buscar</label>
                        <input
                            id="support-search"
                            type="search"
                            value={busqueda}
                            onChange={e => setBusqueda(e.target.value)}
                            placeholder="Buscar por asunto, n.º, nombre o email"
                            className="flex-1 p-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 text-sm text-gray-900 dark:text-gray-100"
                        />
                        <button type="submit" className="px-4 py-2 rounded-lg bg-brand-green text-white text-sm font-semibold">
                            <i className="fa-solid fa-magnifying-glass mr-1.5" aria-hidden="true"></i>Buscar
                        </button>
                    </form>

                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                        {/* Bandeja */}
                        <div className="lg:col-span-2 space-y-2">
                            {loading ? (
                                <div className="flex justify-center py-10"><Spinner /></div>
                            ) : rows.length === 0 ? (
                                <p className="text-center py-10 text-gray-500 dark:text-gray-400">No hay solicitudes con estos filtros.</p>
                            ) : (
                                <ul className="space-y-2">
                                    {rows.map(r => (
                                        <li key={r.id}>
                                            <button
                                                type="button"
                                                onClick={() => abrir(r)}
                                                aria-current={selected?.id === r.id ? 'true' : undefined}
                                                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                                                    selected?.id === r.id
                                                        ? 'border-brand-green bg-green-50 dark:bg-green-900/20'
                                                        : 'border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700/50'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className={`min-w-0 truncate text-sm text-gray-900 dark:text-gray-100 ${r.status === 'open' ? 'font-bold' : 'font-medium'}`}>{r.subject}</p>
                                                    <TicketStatusBadge status={r.status} label={statusLabel(r.status)} />
                                                </div>
                                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">
                                                    #{r.id} · {typeLabel(r.type)} · {r.user_name || r.user_email || 'Usuario'}
                                                </p>
                                                <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                                                    {fecha(r.last_message_at)} · {r.message_count} {r.message_count === 1 ? 'mensaje' : 'mensajes'}
                                                    {r.last_is_staff === false && r.status !== 'closed' && <span className="ml-1 font-semibold text-orange-600 dark:text-orange-400">· último del usuario</span>}
                                                </p>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {paginas > 1 && (
                                <div className="flex items-center justify-between pt-2 text-sm">
                                    <button type="button" disabled={page === 0 || loading} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded border dark:border-zinc-600 disabled:opacity-40">
                                        <i className="fa-solid fa-chevron-left" aria-hidden="true"></i> Anterior
                                    </button>
                                    <span className="text-gray-500 dark:text-gray-400">{page + 1} / {paginas}</span>
                                    <button type="button" disabled={page + 1 >= paginas || loading} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded border dark:border-zinc-600 disabled:opacity-40">
                                        Siguiente <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Hilo */}
                        <div className="lg:col-span-3">
                            {!selected ? (
                                <div className="h-full min-h-[12rem] flex items-center justify-center rounded-lg border border-dashed border-gray-300 dark:border-zinc-600 text-gray-500 dark:text-gray-400 text-sm p-6 text-center">
                                    Elige una solicitud para ver la conversación.
                                </div>
                            ) : (
                                <div className="rounded-lg border border-gray-200 dark:border-zinc-700 p-4 space-y-4">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 break-words">{selected.subject}</h2>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">#{selected.id} · {typeLabel(selected.type)} · abierta el {fecha(selected.created_at)}</p>
                                        </div>
                                        <TicketStatusBadge status={selected.status} label={statusLabel(selected.status)} />
                                    </div>

                                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm p-3 rounded-lg bg-gray-50 dark:bg-zinc-900/50">
                                        <div><dt className="inline text-gray-500 dark:text-gray-400">Usuario: </dt><dd className="inline text-gray-900 dark:text-gray-100">{selected.user_name || '—'}{selected.user_username ? ` (@${selected.user_username})` : ''}</dd></div>
                                        <div><dt className="inline text-gray-500 dark:text-gray-400">Email: </dt><dd className="inline text-gray-900 dark:text-gray-100 break-all">{selected.user_email || '—'}</dd></div>
                                        <div className="sm:col-span-2"><dt className="inline text-gray-500 dark:text-gray-400">ID: </dt><dd className="inline font-mono text-xs text-gray-700 dark:text-gray-300 break-all">{selected.user_id}</dd></div>
                                        {selected.business_name && (
                                            <div className="sm:col-span-2"><dt className="inline text-gray-500 dark:text-gray-400">Empresa: </dt><dd className="inline text-gray-900 dark:text-gray-100">{selected.business_name}</dd></div>
                                        )}
                                    </dl>

                                    {selected.type === 'account_deletion' && (
                                        <p className="text-sm p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-100">
                                            <i className="fa-solid fa-user-xmark mr-2" aria-hidden="true"></i>
                                            Solicitud de <strong>eliminación de cuenta</strong>: se procesa a mano (
                                            <Link to={`/${pathTranslations.es.adminUsers}`} className="underline font-semibold">Usuarios</Link>
                                            ). Responde aquí para confirmarlo antes de borrar la cuenta: al borrarla, la solicitud desaparece con ella.
                                        </p>
                                    )}

                                    <div className="max-h-[28rem] overflow-y-auto pr-1">
                                        {loadingThread && messages.length === 0 ? (
                                            <div className="flex justify-center py-6"><Spinner /></div>
                                        ) : (
                                            <TicketThread
                                                messages={messages}
                                                ownerLabel={selected.user_name || selected.user_email || 'Usuario'}
                                                staffLabel="Soporte Opynio"
                                                viewerIsStaff={true}
                                                locale="es"
                                            />
                                        )}
                                    </div>

                                    <form onSubmit={handleReply} className="space-y-2 border-t dark:border-zinc-700 pt-4">
                                        <label htmlFor="admin-reply" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Responder</label>
                                        <textarea
                                            id="admin-reply"
                                            value={reply}
                                            onChange={e => setReply(e.target.value)}
                                            rows={4}
                                            maxLength={SUPPORT_BODY_MAX}
                                            placeholder="Escribe la respuesta. El usuario la verá en su perfil y recibirá un aviso en la web."
                                            className="w-full p-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 text-sm text-gray-900 dark:text-gray-100"
                                        />
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <label className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
                                                Estado tras responder
                                                <select
                                                    value={statusAfter}
                                                    onChange={e => setStatusAfter(e.target.value as SupportTicketStatus)}
                                                    className="p-1.5 border border-gray-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-900 text-sm"
                                                >
                                                    <option value="waiting_user">Esperando al usuario</option>
                                                    <option value="in_progress">{statusLabel('in_progress')}</option>
                                                    <option value="resolved">{statusLabel('resolved')}</option>
                                                    <option value="closed">{statusLabel('closed')}</option>
                                                </select>
                                            </label>
                                            <button type="submit" disabled={busy || !reply.trim()} className="px-5 py-2 rounded-lg bg-brand-green text-white font-semibold text-sm disabled:opacity-50">
                                                {busy ? 'Enviando…' : 'Enviar respuesta'}
                                            </button>
                                        </div>
                                    </form>

                                    <div className="flex flex-wrap items-center gap-2 border-t dark:border-zinc-700 pt-3">
                                        <span className="text-sm text-gray-600 dark:text-gray-300 mr-1">Cambiar estado:</span>
                                        {SUPPORT_TICKET_STATUSES.filter(s => s !== selected.status).map(s => (
                                            <button
                                                key={s}
                                                type="button"
                                                disabled={busy}
                                                onClick={() => cambiarEstado(s)}
                                                className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-600 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:border-brand-green hover:text-brand-green disabled:opacity-50"
                                            >
                                                {s === 'waiting_user' ? 'Esperando al usuario' : statusLabel(s)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default AdminSupportPage;
