import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Distintivo «Producto» de la vista previa, con el mismo tooltip que
// productPillHtml()/showProductTip() en public/widget.js: nombre del producto
// al pasar el raton, con foco de teclado o al tocarlo (sin navegar). El CSS
// vive en WIDGET_CSS. El tooltip va en un portal con position:fixed, asi que
// no lo recorta el overflow de la tarjeta de vista previa ni mueve el layout.
export const ProductPill: React.FC<{ label: string; name?: string }> = ({ label, name }) => {
    const pillRef = useRef<HTMLSpanElement>(null);
    const tipRef = useRef<HTMLDivElement>(null);
    const lastPointer = useRef<string>('mouse');
    const [open, setOpen] = useState(false);
    const [dark, setDark] = useState(false);

    const show = useCallback(() => {
        if (!name) return;
        setDark(!!pillRef.current?.closest('.opynio-theme-dark'));
        setOpen(true);
    }, [name]);
    const hide = useCallback(() => setOpen(false), []);

    // Posicion: encima de la pastilla y dentro del viewport; debajo si arriba
    // no cabe. Se mide en (0,0) para corregir si algun ancestro tiene transform.
    useLayoutEffect(() => {
        const tip = tipRef.current;
        const pill = pillRef.current;
        if (!open || !tip || !pill) return;
        const vw = document.documentElement.clientWidth || window.innerWidth;
        const vh = document.documentElement.clientHeight || window.innerHeight;
        const M = 8, GAP = 8;
        tip.style.maxWidth = `${Math.min(280, vw - 2 * M)}px`;
        tip.style.left = '0px';
        tip.style.top = '0px';
        const t = tip.getBoundingClientRect();
        const r = pill.getBoundingClientRect();
        let left = r.left + r.width / 2 - t.width / 2;
        left = Math.max(M, Math.min(left, vw - M - t.width));
        const above = r.top - GAP - t.height >= M;
        let top = above ? r.top - GAP - t.height : r.bottom + GAP;
        if (!above && top + t.height > vh - M) top = Math.max(M, vh - M - t.height);
        const arrow = Math.max(12, Math.min(t.width - 12, r.left + r.width / 2 - left));
        tip.setAttribute('data-placement', above ? 'top' : 'bottom');
        tip.style.setProperty('--opynio-tip-arrow', `${arrow}px`);
        tip.style.left = `${left - t.left}px`;
        tip.style.top = `${top - t.top}px`;
        tip.classList.add('opynio-tip-visible');
    }, [open, name]);

    // Tocar fuera, scroll o resize lo cierran (su posicion es fija).
    useEffect(() => {
        if (!open) return;
        const outside = (e: PointerEvent) => {
            if (pillRef.current && !e.composedPath().includes(pillRef.current)) hide();
        };
        document.addEventListener('pointerdown', outside, true);
        window.addEventListener('scroll', hide, { passive: true, capture: true });
        window.addEventListener('resize', hide, { passive: true });
        return () => {
            document.removeEventListener('pointerdown', outside, true);
            window.removeEventListener('scroll', hide, { capture: true });
            window.removeEventListener('resize', hide);
        };
    }, [open, hide]);

    const isFocusVisible = (el: Element) => {
        try { return el.matches(':focus-visible'); } catch { return true; }
    };

    return (
        <>
            <span
                ref={pillRef}
                className="opynio-product-pill"
                tabIndex={0}
                aria-label={name ? `${label}: ${name}` : label}
                // Respaldo nativo; se quita mientras se ve el tooltip propio.
                title={name && !open ? name : undefined}
                onPointerDown={(e) => { lastPointer.current = e.pointerType || 'mouse'; }}
                onPointerEnter={(e) => { if (e.pointerType === 'mouse') show(); }}
                onPointerLeave={(e) => {
                    if (e.pointerType === 'mouse' && !(pillRef.current && isFocusVisible(pillRef.current))) hide();
                }}
                onFocus={(e) => { if (isFocusVisible(e.currentTarget)) show(); }}
                onBlur={hide}
                onKeyDown={(e) => { if (e.key === 'Escape') hide(); }}
                onClickCapture={(e) => {
                    if (lastPointer.current === 'touch' || lastPointer.current === 'pen') {
                        e.preventDefault();
                        e.stopPropagation();
                        show();
                    }
                }}
            >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                    <circle cx="7" cy="7" r="1.6" />
                </svg>
                <span className="opynio-product-pill-text" aria-hidden="true">{label}</span>
            </span>
            {open && name && createPortal(
                <div className={`opynio-widget opynio-theme-${dark ? 'dark' : 'light'}`} style={{ width: 0, height: 0 }}>
                    <div ref={tipRef} className="opynio-product-tip" aria-hidden="true">{name}</div>
                </div>,
                document.body
            )}
        </>
    );
};
