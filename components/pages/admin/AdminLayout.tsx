import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import {
    getAdminDashboardOverview,
    adminSupportTicketCounts,
    adminContactNewCount,
} from '../../../services/supabaseService';
import AdminPanelSidebar, { type SidebarQueues } from './panel/AdminPanelSidebar';
import { isLate } from './panel/overviewUtils';

/**
 * Capa comun de TODAS las pantallas de /admin: el lateral (con sus contadores) se queda al navegar
 * entre apartados y el apartado actual sale resaltado. Antes el lateral vivia solo dentro de la
 * portada (/admin/panel) y cualquier otro apartado se abria sin menu.
 *
 * Los contadores los publica la portada cuando carga su resumen (asi no se pide dos veces); si se
 * entra directamente a otro apartado, la capa los pide una sola vez.
 */
const SIN_DATOS: SidebarQueues = {
    moderation: { count: null },
    claims: { count: null },
    appeals: { count: null },
    bugs: { count: null },
    support: { count: null },
};

interface AdminQueuesContextValue {
    /** La portada publica aqui los contadores que ya ha calculado. */
    publishQueues: (queues: SidebarQueues) => void;
}

const AdminQueuesContext = createContext<AdminQueuesContextValue>({ publishQueues: () => {} });

/** Para la portada: avisa a la capa de los contadores que ya tiene. */
export const useAdminQueuesPublisher = (): AdminQueuesContextValue['publishQueues'] =>
    useContext(AdminQueuesContext).publishQueues;

const normalizar = (ruta: string): string => ruta.replace(/\/+$/, '') || '/';

const AdminLayout: React.FC = () => {
    const { pathname } = useLocation();
    const [queues, setQueues] = useState<SidebarQueues>(SIN_DATOS);
    // true cuando ya hay contadores (publicados por la portada o pedidos por la capa).
    const cargados = useRef(false);
    const enPortada = normalizar(pathname) === '/admin/panel';

    const publishQueues = useCallback((q: SidebarQueues) => {
        cargados.current = true;
        setQueues(q);
    }, []);

    useEffect(() => {
        // La portada publica los suyos; en cualquier otro apartado se piden una sola vez.
        if (enPortada || cargados.current) return;
        cargados.current = true;
        let cancelado = false;
        (async () => {
            const [ov, sup, con] = await Promise.allSettled([
                getAdminDashboardOverview(),
                adminSupportTicketCounts(),
                adminContactNewCount(),
            ]);
            if (cancelado) return;
            const data = ov.status === 'fulfilled' ? ov.value : null;
            const now = data ? new Date(data.generatedAt).getTime() || Date.now() : Date.now();
            const support = sup.status === 'fulfilled' ? sup.value.open : null;
            const contactNew = con.status === 'fulfilled' ? con.value : null;
            setQueues({
                moderation: { count: data?.reviews.pending, late: isLate(data?.reviews.oldest, now) },
                claims: { count: data?.claims.open, late: isLate(data?.claims.oldest, now) },
                appeals: { count: data?.appeals.open, late: isLate(data?.appeals.oldest, now) },
                bugs: { count: data?.bugs.open, late: isLate(data?.bugs.oldest, now) },
                support: { count: support === null && contactNew === null ? null : (support ?? 0) + (contactNew ?? 0) },
            });
        })();
        return () => { cancelado = true; };
    }, [enPortada]);

    const ctx = useMemo(() => ({ publishQueues }), [publishQueues]);

    return (
        <AdminQueuesContext.Provider value={ctx}>
            <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 lg:gap-8 -mt-6 sm:-mt-8">
                <AdminPanelSidebar queues={queues} pathname={pathname} />
                <div className="flex-grow min-w-0">
                    <Outlet />
                </div>
            </div>
        </AdminQueuesContext.Provider>
    );
};

export default AdminLayout;
