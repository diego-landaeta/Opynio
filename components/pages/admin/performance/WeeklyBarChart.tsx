import React, { useMemo, useState } from 'react';

export interface WeeklyPoint {
    /** Lunes de la semana, YYYY-MM-DD. */
    weekStart: string;
    value: number;
}

interface Props {
    points: WeeklyPoint[];
    /** Clases Tailwind de relleno para las barras (claro/oscuro). */
    barClass: string;
    locale: string;
    /** Texto accesible del grafico completo. */
    ariaLabel: string;
    /** Etiqueta de cada barra: «Semana del 5 oct.: 12». */
    describePoint: (weekLabel: string, value: number) => string;
    /** Texto cuando todas las semanas valen 0. */
    emptyText: string;
}

// Eje Y con topes «redondos» (1, 2, 5, 10, 20, 50...) para que las lineas de
// guia tengan numeros legibles aunque el maximo sea 17 o 49.654.
const niceMax = (max: number): number => {
    if (max <= 4) return 4;
    const exp = Math.pow(10, Math.floor(Math.log10(max)));
    const f = max / exp;
    const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
    return nice * exp;
};

const W = 320;
const H = 150;
const PAD_L = 34;
const PAD_R = 6;
const PAD_T = 10;
const PAD_B = 22;

/**
 * Barras por semana en SVG propio (el proyecto no trae libreria de graficos).
 * Funciona con 12 semanas o con 52: el ancho de barra se calcula. La ultima
 * barra es la semana en curso y va con menos opacidad (esta incompleta).
 * Cada barra se puede enfocar con teclado y tiene su tooltip; ademas hay una
 * tabla oculta con los mismos datos para lectores de pantalla.
 */
const WeeklyBarChart: React.FC<Props> = ({ points, barClass, locale, ariaLabel, describePoint, emptyText }) => {
    const [active, setActive] = useState<number | null>(null);
    const fmtNum = useMemo(() => new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }), [locale]);
    const fmtFull = useMemo(() => new Intl.NumberFormat(locale), [locale]);
    const fmtWeek = useMemo(() => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }), [locale]);
    const weekLabel = (iso: string) => fmtWeek.format(new Date(`${iso}T00:00:00Z`));

    const max = Math.max(0, ...points.map(p => p.value));
    const top = niceMax(max);
    const plotW = W - PAD_L - PAD_R;
    const plotH = H - PAD_T - PAD_B;
    const step = points.length > 0 ? plotW / points.length : plotW;
    const barW = Math.max(2, step * 0.62);
    const ticks = [0, top / 2, top];
    const labelEvery = points.length > 16 ? Math.ceil(points.length / 6) : points.length > 8 ? 2 : 1;
    const isEmpty = max === 0;

    const act = active !== null ? points[active] : null;
    const actX = active !== null ? PAD_L + step * active + step / 2 : 0;

    return (
        <div className="relative">
            <svg
                viewBox={`0 0 ${W} ${H}`}
                className="w-full h-auto select-none"
                role="img"
                aria-label={ariaLabel}
                onMouseLeave={() => setActive(null)}
            >
                {ticks.map((tk, i) => {
                    const y = PAD_T + plotH - (tk / top) * plotH;
                    return (
                        <g key={i}>
                            <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y} className="stroke-gray-200 dark:stroke-zinc-700" strokeWidth={1} strokeDasharray={i === 0 ? undefined : '3 3'} />
                            <text x={PAD_L - 5} y={y + 3} textAnchor="end" className="fill-gray-500 dark:fill-gray-400" fontSize={9}>{fmtNum.format(tk)}</text>
                        </g>
                    );
                })}
                {points.map((p, i) => {
                    const h = top > 0 ? (p.value / top) * plotH : 0;
                    const x = PAD_L + step * i + (step - barW) / 2;
                    const y = PAD_T + plotH - h;
                    const last = i === points.length - 1;
                    return (
                        <g key={p.weekStart}>
                            {/* Zona de toque amplia (la barra sola mide ~15 px). */}
                            <rect
                                x={PAD_L + step * i} y={PAD_T} width={step} height={plotH + PAD_B - 4}
                                fill="transparent"
                                tabIndex={0}
                                role="img"
                                aria-label={describePoint(weekLabel(p.weekStart), p.value)}
                                onMouseEnter={() => setActive(i)}
                                onFocus={() => setActive(i)}
                                onBlur={() => setActive(null)}
                                onClick={() => setActive(a => (a === i ? null : i))}
                                className="outline-none focus-visible:stroke-brand-green"
                                strokeWidth={2}
                            />
                            {p.value > 0 && (
                                <rect x={x} y={y} width={barW} height={Math.max(h, 1.5)} rx={2} className={`${barClass} pointer-events-none`} opacity={last ? 0.55 : active === i ? 1 : 0.9} />
                            )}
                            {p.value === 0 && (
                                <rect x={x} y={PAD_T + plotH - 1.5} width={barW} height={1.5} rx={0.75} className="fill-gray-300 dark:fill-zinc-600 pointer-events-none" />
                            )}
                            {i % labelEvery === 0 && (
                                <text x={PAD_L + step * i + step / 2} y={H - 7} textAnchor="middle" className="fill-gray-500 dark:fill-gray-400 pointer-events-none" fontSize={8.5}>
                                    {weekLabel(p.weekStart)}
                                </text>
                            )}
                        </g>
                    );
                })}
            </svg>

            {act && (
                <div
                    className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full px-2 py-1 rounded-md bg-gray-900 dark:bg-zinc-100 text-white dark:text-gray-900 text-xs font-medium whitespace-nowrap shadow-lg"
                    style={{
                        left: `${Math.min(Math.max((actX / W) * 100, 14), 86)}%`,
                        top: `${((PAD_T + plotH - (act.value / top) * plotH) / H) * 100}%`,
                    }}
                    role="status"
                >
                    <span className="opacity-70">{weekLabel(act.weekStart)}</span>{' '}
                    <span className="font-bold tabular-nums">{fmtFull.format(act.value)}</span>
                </div>
            )}

            {isEmpty && (
                <p className="absolute inset-x-0 top-[38%] text-center text-sm text-gray-500 dark:text-gray-400 pointer-events-none px-6">{emptyText}</p>
            )}

            <table className="sr-only">
                <tbody>
                    {points.map(p => (
                        <tr key={p.weekStart}><th scope="row">{weekLabel(p.weekStart)}</th><td>{fmtFull.format(p.value)}</td></tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default WeeklyBarChart;
