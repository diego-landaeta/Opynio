import React, { useCallback, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from '../../../contexts/i18nContext';
import { useConfirm } from '../../../contexts/ConfirmContext';

export const ADMIN_PANEL_PATH = '/admin/panel';

/**
 * Estado de navegacion para que una subpantalla sepa a que listado volver.
 * Ej.: la edicion masiva abre la ficha de edicion con
 *   navigate(ruta, { state: adminBackState('/admin/empresas/editar-masivo', 'admin.backToBulkEdit') })
 */
export interface AdminBackState {
    backTo?: string;
    backLabelKey?: string;
}

export const adminBackState = (backTo: string, backLabelKey: string): AdminBackState => ({ backTo, backLabelKey });

// Solo se acepta volver a otra pantalla de admin: el state lo puede fijar
// cualquiera que enlace aqui y no debe servir para sacar al admin fuera.
const esRutaAdmin = (ruta: unknown): ruta is string =>
    typeof ruta === 'string' && ruta.startsWith('/admin/') && !ruta.startsWith('//');

/** Destino y texto del «volver» de la pantalla actual. */
export const useAdminBackTarget = (fallbackTo = ADMIN_PANEL_PATH, fallbackLabelKey = 'admin.backToPanel') => {
    const location = useLocation();
    const state = (location.state || null) as AdminBackState | null;
    if (state && esRutaAdmin(state.backTo)) {
        const labelKey = state.backLabelKey && state.backLabelKey.startsWith('admin.') ? state.backLabelKey : 'admin.backToPanel';
        return { to: state.backTo, labelKey };
    }
    return { to: fallbackTo, labelKey: fallbackLabelKey };
};

/**
 * Enlace «← Volver al panel de administración» con el mismo aspecto y en la
 * misma posicion (arriba a la izquierda, antes del titulo) en todas las
 * subpantallas de admin. Si la pantalla se abrio desde un listado que paso
 * `adminBackState`, vuelve a ese listado.
 */
const AdminBackLink: React.FC<{ to?: string; labelKey?: string }> = ({ to, labelKey }) => {
    const t = useTranslation();
    const destino = useAdminBackTarget(to, labelKey);
    return (
        <div className="mb-4">
            <Link
                to={destino.to}
                className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:text-brand-green dark:hover:text-brand-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green rounded transition-colors"
            >
                <i className="fa-solid fa-arrow-left" aria-hidden="true"></i>
                <span>{t(destino.labelKey)}</span>
            </Link>
        </div>
    );
};

/**
 * Aviso de cambios sin guardar para formularios de admin.
 *  - Cerrar o recargar la pestaña, o salir a otra web: aviso nativo (beforeunload).
 *  - Pinchar cualquier enlace interno de la app (volver, cabecera, menu): el
 *    confirm de la app; si se acepta, se navega.
 *  - Navegaciones por codigo (botones Cancelar, «Editar»...): usar
 *    `confirmLeave()` antes de `navigate()`.
 * El boton «atras» del navegador no se puede interceptar con BrowserRouter.
 */
export const useUnsavedChangesGuard = (dirty: boolean) => {
    const t = useTranslation();
    const { confirm } = useConfirm();
    const navigate = useNavigate();
    const dirtyRef = useRef(dirty);
    dirtyRef.current = dirty;

    const confirmLeave = useCallback(async (): Promise<boolean> => {
        if (!dirtyRef.current) return true;
        const ok = await confirm({
            title: t('admin.unsavedTitle'),
            message: t('admin.unsavedMessage'),
            confirmText: t('admin.unsavedLeave'),
            cancelText: t('admin.unsavedStay'),
            danger: true,
        });
        if (ok) dirtyRef.current = false;
        return ok;
    }, [confirm, t]);

    useEffect(() => {
        if (!dirty) return;

        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = '';
        };

        // En fase de captura sobre document: se ejecuta antes que el onClick de
        // los <Link> de React Router (que escuchan en la raiz de React).
        const onClick = (e: MouseEvent) => {
            if (!dirtyRef.current || e.defaultPrevented || e.button !== 0) return;
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // abre en otra pestaña
            const enlace = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
            if (!enlace || (enlace.target && enlace.target !== '_self') || enlace.hasAttribute('download')) return;
            const url = new URL(enlace.href, window.location.href);
            if (url.origin !== window.location.origin) return; // fuera de la app: lo cubre beforeunload
            if (url.pathname === window.location.pathname && url.search === window.location.search) return;
            e.preventDefault();
            e.stopPropagation();
            confirmLeave().then(ok => {
                if (ok) navigate(url.pathname + url.search + url.hash);
            });
        };

        window.addEventListener('beforeunload', onBeforeUnload);
        document.addEventListener('click', onClick, true);
        return () => {
            window.removeEventListener('beforeunload', onBeforeUnload);
            document.removeEventListener('click', onClick, true);
        };
    }, [dirty, confirmLeave, navigate]);

    return { confirmLeave };
};

export default AdminBackLink;
