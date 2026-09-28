import React, { useCallback, useEffect, useState } from 'react';
import { adminListContactMessages, adminSetContactMessageStatus, ContactMessage } from '../../../services/supabaseService';
import { useTranslation } from '../../../contexts/i18nContext';
import Spinner from '../../Spinner';

// Mensajes del formulario de contacto de «Sobre nosotros» (no son solicitudes
// de soporte: no hay conversacion; se responde por email). Panel del admin,
// textos fijos en espanol como el resto del admin salvo los tipos.
type Filtro = 'new' | 'read' | 'archived' | 'all';
const FILTROS: { id: Filtro; label: string }[] = [
    { id: 'new', label: 'Nuevos' },
    { id: 'read', label: 'Leídos' },
    { id: 'archived', label: 'Archivados' },
    { id: 'all', label: 'Todos' },
];

const AdminContactMessages: React.FC = () => {
    const t = useTranslation();
    const [filtro, setFiltro] = useState<Filtro>('new');
    const [mensajes, setMensajes] = useState<ContactMessage[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError(null);
        try {
            setMensajes(await adminListContactMessages(filtro));
        } catch (err) {
            console.error('No se pudieron cargar los mensajes de contacto:', err);
            setError('No se pudieron cargar los mensajes. ¿Está aplicada la migración 20260929120000?');
        } finally {
            setCargando(false);
        }
    }, [filtro]);

    useEffect(() => { cargar(); }, [cargar]);

    const cambiarEstado = async (m: ContactMessage, status: ContactMessage['status']) => {
        await adminSetContactMessageStatus(m.id, status);
        setMensajes(prev => filtro === 'all' ? prev.map(x => (x.id === m.id ? { ...x, status } : x)) : prev.filter(x => x.id !== m.id));
    };

    return (
        <div>
            <div className="flex flex-wrap gap-2 mb-4" role="tablist">
                {FILTROS.map(f => (
                    <button
                        key={f.id}
                        type="button"
                        role="tab"
                        aria-selected={filtro === f.id}
                        onClick={() => setFiltro(f.id)}
                        className={`px-3 py-1.5 rounded-full text-sm font-semibold ${filtro === f.id ? 'bg-brand-green text-white' : 'bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-200'}`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>
            {cargando ? (
                <div className="flex justify-center py-10"><Spinner /></div>
            ) : error ? (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            ) : mensajes.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">No hay mensajes en esta vista.</p>
            ) : (
                <ul className="space-y-3">
                    {mensajes.map(m => (
                        <li key={m.id} className="p-4 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                <div className="text-sm">
                                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200 mr-2">{t(`aboutPage.kind_${m.kind}`)}</span>
                                    <strong className="text-gray-900 dark:text-gray-100">{m.name}</strong>
                                    <span className="text-gray-500 dark:text-gray-400"> · </span>
                                    <a href={`mailto:${m.email}`} className="text-brand-green hover:underline">{m.email}</a>
                                </div>
                                <time className="text-xs text-gray-500 dark:text-gray-400">{new Date(m.created_at).toLocaleString('es-ES')}</time>
                            </div>
                            <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">{m.message}</p>
                            <div className="flex gap-2 mt-3">
                                {m.status !== 'read' && <button type="button" onClick={() => cambiarEstado(m, 'read')} className="text-xs font-semibold px-3 py-1 rounded-md border border-gray-300 dark:border-zinc-600 hover:bg-gray-50 dark:hover:bg-zinc-700">Marcar leído</button>}
                                {m.status !== 'archived' && <button type="button" onClick={() => cambiarEstado(m, 'archived')} className="text-xs font-semibold px-3 py-1 rounded-md border border-gray-300 dark:border-zinc-600 hover:bg-gray-50 dark:hover:bg-zinc-700">Archivar</button>}
                                {m.status !== 'new' && <button type="button" onClick={() => cambiarEstado(m, 'new')} className="text-xs font-semibold px-3 py-1 rounded-md border border-gray-300 dark:border-zinc-600 hover:bg-gray-50 dark:hover:bg-zinc-700">Marcar como nuevo</button>}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default AdminContactMessages;
