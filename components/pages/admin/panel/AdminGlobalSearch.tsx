import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../../../contexts/i18nContext';
import { supabase, getAdminUsersPaginated } from '../../../../services/supabaseService';

/**
 * Buscador global del admin: usuarios (nombre, usuario o correo) y empresas (nombre o slug) desde cualquier apartado.
 * Combobox accesible: flechas para moverse, Enter para abrir, Escape para cerrar; «/» enfoca el campo desde cualquier
 * parte de la página. Un usuario abre su ficha; una empresa, su edición de admin.
 */

interface Resultado {
    clave: string;
    tipo: 'user' | 'business';
    titulo: string;
    detalle: string;
    destino: string;
}

const MIN = 2;
const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green';

const limpiar = (q: string): string => q.replace(/[%_,()*\\]/g, ' ').replace(/\s+/g, ' ').trim();

const AdminGlobalSearch: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
    const t = useTranslation();
    const tk = (k: string) => t(`adminDashboard.${k}`);
    const navigate = useNavigate();
    const id = useId();
    const listaId = `${id}-lista`;
    const [q, setQ] = useState('');
    const [abierto, setAbierto] = useState(false);
    const [cargando, setCargando] = useState(false);
    const [resultados, setResultados] = useState<Resultado[]>([]);
    const [activo, setActivo] = useState(0);
    const reqId = useRef(0);
    const caja = useRef<HTMLDivElement>(null);
    const campo = useRef<HTMLInputElement>(null);

    // «/» enfoca el buscador salvo que ya se esté escribiendo en un campo.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
            const el = document.activeElement as HTMLElement | null;
            if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
            e.preventDefault();
            campo.current?.focus();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    // Cerrar al pinchar fuera.
    useEffect(() => {
        const onDown = (e: MouseEvent) => { if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false); };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, []);

    const buscar = useCallback(async (texto: string) => {
        const mine = ++reqId.current;
        setCargando(true);
        try {
            const limpio = limpiar(texto);
            const [usuarios, empresas] = await Promise.all([
                getAdminUsersPaginated(1, 5, { searchTerm: texto }).then(r => r.data).catch(() => [] as any[]),
                limpio.length >= MIN
                    ? Promise.resolve(supabase.from('businesses').select('id, name, slug, country').or(`name.ilike.%${limpio}%,slug.ilike.%${limpio.toLowerCase().replace(/ /g, '_')}%`).order('name').limit(5))
                        .then(r => (r.error ? [] : (r.data || [])) as any[])
                        .catch(() => [] as any[])
                    : Promise.resolve([] as any[]),
            ]);
            if (mine !== reqId.current) return;
            const lista: Resultado[] = [
                ...usuarios.map((u: any): Resultado => ({ clave: `u-${u.id}`, tipo: 'user', titulo: u.name || u.username || u.email || '—', detalle: [u.email, u.role ? t(`roles.${u.role}`) : ''].filter(Boolean).join(' · '), destino: `/admin/usuarios/${u.id}` })),
                ...empresas.map((b: any): Resultado => ({ clave: `b-${b.id}`, tipo: 'business', titulo: b.name, detalle: [b.country, b.slug].filter(Boolean).join(' · '), destino: `/admin/empresa/editar/${b.id}` })),
            ];
            setResultados(lista);
            setActivo(0);
        } finally {
            if (mine === reqId.current) setCargando(false);
        }
    }, [t]);

    // Búsqueda con retraso para no lanzar una consulta por tecla.
    useEffect(() => {
        const texto = q.trim();
        if (texto.length < MIN) { reqId.current++; setResultados([]); setCargando(false); return; }
        const h = window.setTimeout(() => { buscar(texto); }, 250);
        return () => window.clearTimeout(h);
    }, [q, buscar]);

    const abrir = (r: Resultado) => {
        setAbierto(false);
        setQ('');
        setResultados([]);
        onNavigate?.();
        navigate(r.destino);
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape') { setAbierto(false); (e.target as HTMLInputElement).blur(); return; }
        if (!resultados.length) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); setAbierto(true); setActivo(i => (i + 1) % resultados.length); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo(i => (i - 1 + resultados.length) % resultados.length); }
        else if (e.key === 'Enter') { e.preventDefault(); abrir(resultados[activo]); }
    };

    const texto = q.trim();
    const mostrar = abierto && texto.length > 0;
    const usuarios = resultados.filter(r => r.tipo === 'user');
    const empresas = resultados.filter(r => r.tipo === 'business');
    const opcionId = (i: number) => `${id}-op-${i}`;

    const Grupo: React.FC<{ titulo: string; icono: string; items: Resultado[] }> = ({ titulo, icono, items }) => items.length === 0 ? null : (
        <li role="presentation">
            <p className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">{titulo}</p>
            <ul role="group" aria-label={titulo}>
                {items.map(r => {
                    const i = resultados.indexOf(r);
                    const sel = i === activo;
                    return (
                        <li key={r.clave} id={opcionId(i)} role="option" aria-selected={sel}
                            onMouseDown={e => { e.preventDefault(); abrir(r); }}
                            onMouseEnter={() => setActivo(i)}
                            className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer ${sel ? 'bg-emerald-50 dark:bg-brand-green/10' : ''}`}>
                            <i className={`fa-solid ${icono} w-4 text-center text-gray-400 flex-shrink-0`} aria-hidden="true"></i>
                            <span className="min-w-0">
                                <span className="block text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{r.titulo}</span>
                                {r.detalle && <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">{r.detalle}</span>}
                            </span>
                        </li>
                    );
                })}
            </ul>
        </li>
    );

    return (
        <div ref={caja} className="relative mb-3">
            <label htmlFor={`${id}-campo`} className="sr-only">{tk('ovSearchLabel')}</label>
            <div className="relative">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none" aria-hidden="true"></i>
                <input
                    ref={campo}
                    id={`${id}-campo`}
                    type="search"
                    role="combobox"
                    aria-expanded={mostrar}
                    aria-controls={listaId}
                    aria-autocomplete="list"
                    aria-activedescendant={mostrar && resultados.length ? opcionId(activo) : undefined}
                    autoComplete="off"
                    value={q}
                    onChange={e => { setQ(e.target.value); setAbierto(true); }}
                    onFocus={() => setAbierto(true)}
                    onKeyDown={onKeyDown}
                    placeholder={tk('ovSearchPlaceholder')}
                    className={`w-full pl-9 pr-9 py-2 text-sm rounded-lg border border-gray-300 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-900/40 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 ${FOCUS}`}
                />
                {!q && <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden lg:inline text-[11px] font-semibold text-gray-400 border border-gray-300 dark:border-zinc-600 rounded px-1.5 py-0.5" aria-hidden="true">/</kbd>}
            </div>
            {mostrar && (
                <ul id={listaId} role="listbox" aria-label={tk('ovSearchLabel')} className="absolute z-40 left-0 right-0 mt-1.5 max-h-80 overflow-y-auto rounded-xl border dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-lg py-1">
                    {texto.length < MIN ? (
                        <li role="presentation" className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">{tk('ovSearchHint')}</li>
                    ) : cargando && resultados.length === 0 ? (
                        <li role="presentation" className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400"><i className="fa-solid fa-spinner fa-spin mr-2" aria-hidden="true"></i>{tk('ovSearchLoading')}</li>
                    ) : resultados.length === 0 ? (
                        <li role="presentation" className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">{tk('ovSearchEmpty')}</li>
                    ) : (
                        <>
                            <Grupo titulo={tk('ovSearchUsers')} icono="fa-user" items={usuarios} />
                            <Grupo titulo={tk('ovSearchBusinesses')} icono="fa-building" items={empresas} />
                        </>
                    )}
                </ul>
            )}
        </div>
    );
};

export default AdminGlobalSearch;
