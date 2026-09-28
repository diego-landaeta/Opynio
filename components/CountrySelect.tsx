import React, { useEffect, useId, useRef, useState } from 'react';
import { COUNTRIES } from '../constants';
import { useCountryName } from '../utils/countryName';

// Selector de pais con bandera. Un <select> nativo no puede mostrar imagenes y
// las banderas emoji no se ven en Windows (salen «ES», «US»...), asi que es una
// lista propia con las banderas de FlagCDN, como en el alta de empresa.
// Accesible como un listbox: flechas, Inicio/Fin, Enter, Escape y buscar
// tecleando la primera letra.

const Flag: React.FC<{ code: string }> = ({ code }) => {
    const lower = code.toLowerCase();
    return (
        <img
            src={`https://flagcdn.com/w40/${lower}.png`}
            srcSet={`https://flagcdn.com/w80/${lower}.png 2x`}
            alt=""
            width={22}
            height={16}
            loading="lazy"
            className="inline-block flex-shrink-0 rounded-sm shadow-sm object-cover"
            style={{ width: 22, height: 16 }}
        />
    );
};

interface CountrySelectProps {
    id?: string;
    value: string;
    onChange: (code: string) => void;
    placeholder?: string;
    className?: string;
    ariaDescribedBy?: string;
}

const CountrySelect: React.FC<CountrySelectProps> = ({ id, value, onChange, placeholder, className = '', ariaDescribedBy }) => {
    const countryName = useCountryName();
    const autoId = useId();
    const buttonId = id || `${autoId}-country`;
    const listId = `${buttonId}-list`;
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    const opciones = COUNTRIES.map(c => ({ code: c.code, name: countryName(c.code, c.name) }));
    const actual = opciones.find(o => o.code === value);

    const abrir = () => {
        const i = opciones.findIndex(o => o.code === value);
        setActive(i >= 0 ? i : 0);
        setOpen(true);
    };
    const elegir = (code: string) => {
        onChange(code);
        setOpen(false);
        buttonRef.current?.focus();
    };

    // Cierra al pulsar fuera.
    useEffect(() => {
        if (!open) return;
        const fuera = (e: PointerEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('pointerdown', fuera);
        return () => document.removeEventListener('pointerdown', fuera);
    }, [open]);

    // La opcion activa siempre a la vista.
    useEffect(() => {
        if (!open) return;
        listRef.current?.focus();
        listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
    }, [open, active]);

    const onListKey = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, opciones.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
        else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
        else if (e.key === 'End') { e.preventDefault(); setActive(opciones.length - 1); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elegir(opciones[active].code); }
        // Escape solo cierra la lista, no el panel o la ventana que la contiene.
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); setOpen(false); buttonRef.current?.focus(); }
        else if (e.key === 'Tab') setOpen(false);
        else if (e.key.length === 1) {
            const letra = e.key.toLowerCase();
            const plano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
            const desde = (active + 1) % opciones.length;
            const orden = [...opciones.slice(desde), ...opciones.slice(0, desde)];
            const hit = orden.find(o => plano(o.name).startsWith(letra));
            if (hit) setActive(opciones.indexOf(hit));
        }
    };

    return (
        <div ref={wrapperRef} className="relative">
            <button
                ref={buttonRef}
                id={buttonId}
                type="button"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={listId}
                aria-describedby={ariaDescribedBy}
                onClick={() => (open ? setOpen(false) : abrir())}
                onKeyDown={(e) => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); abrir(); } }}
                className={`${className} flex items-center gap-2 text-left`}
            >
                {actual ? <Flag code={actual.code} /> : null}
                <span className={`flex-1 truncate ${actual ? '' : 'text-gray-400'}`}>{actual ? actual.name : placeholder}</span>
                <i className={`fa-solid fa-chevron-down text-xs text-gray-500 dark:text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true"></i>
            </button>
            {open && (
                <ul
                    ref={listRef}
                    id={listId}
                    role="listbox"
                    tabIndex={-1}
                    aria-labelledby={buttonId}
                    aria-activedescendant={`${listId}-${active}`}
                    onKeyDown={onListKey}
                    className="absolute left-0 right-0 top-full mt-1 z-[70] max-h-64 overflow-y-auto rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-xl py-1 focus:outline-none"
                >
                    {opciones.map((o, i) => (
                        <li
                            key={o.code}
                            id={`${listId}-${i}`}
                            data-index={i}
                            role="option"
                            aria-selected={o.code === value}
                            onClick={() => elegir(o.code)}
                            onMouseEnter={() => setActive(i)}
                            className={`flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer ${
                                i === active ? 'bg-gray-100 dark:bg-zinc-700' : ''
                            } ${o.code === value ? 'font-semibold text-brand-green' : 'text-gray-800 dark:text-gray-100'}`}
                        >
                            <Flag code={o.code} />
                            <span className="flex-1 truncate">{o.name}</span>
                            {o.code === value && <i className="fa-solid fa-check text-xs" aria-hidden="true"></i>}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default CountrySelect;
