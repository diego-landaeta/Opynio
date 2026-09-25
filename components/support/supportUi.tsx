import React from 'react';
import type { SupportTicketMessage, SupportTicketStatus } from '../../services/supabaseService';

// Piezas comunes de las solicitudes de soporte: las usan «Mis solicitudes» del
// perfil y la bandeja del admin (/admin/soporte).

const STATUS_STYLES: Record<SupportTicketStatus, string> = {
    open: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
    in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    waiting_user: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
    resolved: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    closed: 'bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-gray-300',
};

export const TicketStatusBadge: React.FC<{ status: SupportTicketStatus; label: string }> = ({ status, label }) => (
    <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${STATUS_STYLES[status] || STATUS_STYLES.closed}`}>
        {label}
    </span>
);

/**
 * Hilo de mensajes. `ownerLabel` es el nombre de quien abrio la solicitud y
 * `staffLabel` el del equipo. Los mensajes del lado de quien mira van a la
 * derecha (el usuario en su perfil; el equipo en el admin).
 */
export const TicketThread: React.FC<{
    messages: SupportTicketMessage[];
    ownerLabel: string;
    staffLabel: string;
    viewerIsStaff: boolean;
    locale: string;
}> = ({ messages, ownerLabel, staffLabel, viewerIsStaff, locale }) => (
    <ol className="space-y-3" aria-live="polite">
        {messages.map(m => {
            const mine = m.is_staff === viewerIsStaff;
            return (
                <li key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-xl px-4 py-3 border ${
                        m.is_staff
                            ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800/60'
                            : 'bg-gray-50 border-gray-200 dark:bg-zinc-900/60 dark:border-zinc-700'
                    }`}>
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
                            {m.is_staff && <i className="fa-solid fa-headset text-brand-green" aria-hidden="true"></i>}
                            {m.is_staff ? staffLabel : ownerLabel}
                            <span className="font-normal text-gray-500 dark:text-gray-400">· {new Date(m.created_at).toLocaleString(locale)}</span>
                        </p>
                        <p className="mt-1 text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap break-words">{m.body}</p>
                    </div>
                </li>
            );
        })}
    </ol>
);
