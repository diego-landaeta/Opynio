import { useEffect, RefObject } from 'react';

// Trampa de foco para dialogos modales (`aria-modal="true"`): mientras estan
// abiertos, Tab y Shift+Tab dan la vuelta DENTRO del contenedor en vez de
// escaparse al contenido de detras. No toca Escape ni el clic fuera: cada
// dialogo ya gestiona su cierre.
//
//   - `active`: solo actua mientras es true (el menu movil esta siempre montado).
//   - `focusOnOpen`: al activarse, si el foco no esta ya dentro, lo pone en el
//     contenedor (que necesita tabIndex={-1}). Los dialogos que ya mueven el foco
//     por su cuenta no lo necesitan.
//   - `restoreFocus`: al desactivarse devuelve el foco a quien lo tenia antes.
const FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

const visibles = (root: HTMLElement): HTMLElement[] =>
    Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden'
    );

export function useFocusTrap(
    ref: RefObject<HTMLElement | null>,
    active: boolean,
    options: { focusOnOpen?: boolean; restoreFocus?: boolean } = {}
) {
    const { focusOnOpen = false, restoreFocus = false } = options;
    useEffect(() => {
        if (!active) return;
        const root = ref.current;
        if (!root) return;
        const previo = document.activeElement as HTMLElement | null;
        if (focusOnOpen && !root.contains(document.activeElement)) root.focus();

        const alPulsar = (e: KeyboardEvent) => {
            if (e.key !== 'Tab' || !ref.current) return;
            const cont = ref.current;
            const items = visibles(cont);
            if (items.length === 0) { e.preventDefault(); cont.focus(); return; }
            const primero = items[0];
            const ultimo = items[items.length - 1];
            const actual = document.activeElement as HTMLElement | null;
            if (!actual || !cont.contains(actual) || actual === cont) {
                // Foco fuera (o en el propio contenedor): se mete dentro.
                e.preventDefault();
                (e.shiftKey ? ultimo : primero).focus();
            } else if (e.shiftKey && actual === primero) {
                e.preventDefault();
                ultimo.focus();
            } else if (!e.shiftKey && actual === ultimo) {
                e.preventDefault();
                primero.focus();
            }
        };
        document.addEventListener('keydown', alPulsar);
        return () => {
            document.removeEventListener('keydown', alPulsar);
            if (restoreFocus && previo && document.contains(previo)) previo.focus();
        };
    }, [ref, active, focusOnOpen, restoreFocus]);
}
