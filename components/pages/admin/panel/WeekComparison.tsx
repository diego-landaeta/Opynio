import React from 'react';
import { useI18n, useTranslation, getLocaleFromLanguage } from '../../../../contexts/i18nContext';
import type { AdminOverview } from '../../../../services/supabaseService';
import { useNumberFormats } from './overviewUtils';

type Week = AdminOverview['week'];

const tone = (delta: number) =>
    delta > 0 ? 'text-emerald-700 dark:text-emerald-400' : delta < 0 ? 'text-red-700 dark:text-red-400' : 'text-gray-600 dark:text-gray-400';

/**
 * Dos barras finas por fila (esta semana en verde, la anterior en gris) a la
 * MISMA escala dentro de la fila. No se comparan filas entre si (usuarios con
 * resenas no tienen unidad comun) y la nota media va sin barra, solo con
 * numeros. El cambio lleva siempre su signo escrito.
 */
const WeekComparison: React.FC<{ week: Week; totals: AdminOverview['totals'] }> = ({ week, totals }) => {
    const t = useTranslation();
    const { language } = useI18n();
    const f = useNumberFormats(getLocaleFromLanguage(language));
    const tk = (k: string, p?: Record<string, string | number>) => t(`adminDashboard.${k}`, p);

    const counts: { key: string; label: string; cur: number; prev: number }[] = [
        { key: 'reviews', label: tk('ovRowReviews'), cur: week.reviews.current, prev: week.reviews.previous },
        { key: 'users', label: tk('ovRowUsers'), cur: week.users.current, prev: week.users.previous },
        { key: 'businesses', label: tk('ovRowBusinesses'), cur: week.businesses.current, prev: week.businesses.previous },
    ];
    const { current: ratingNow, previous: ratingBefore } = week.avgRating;
    const noData = tk('ovNoDataYet');

    return (
        <div>
            <ul>
                {counts.map(row => {
                    const empty = row.cur === 0 && row.prev === 0;
                    const max = Math.max(row.cur, row.prev, 1);
                    const delta = row.cur - row.prev;
                    return (
                        <li key={row.key} className="grid grid-cols-[1fr_auto] sm:grid-cols-[11rem_1fr_9.5rem] items-center gap-x-4 gap-y-1.5 py-3 border-t first:border-t-0 border-gray-200 dark:border-zinc-700">
                            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{row.label}</span>
                            {empty ? (
                                <span className="col-span-2 order-last sm:order-none text-sm text-gray-600 dark:text-gray-400">{noData}</span>
                            ) : (
                                <>
                                    <div className="col-span-2 sm:col-span-1 order-last sm:order-none grid gap-1" aria-hidden="true">
                                        <div className="h-2 rounded-full bg-gray-200 dark:bg-zinc-700 overflow-hidden">
                                            <div className="h-full rounded-full bg-brand-green" style={{ width: `${(row.cur / max) * 100}%` }} />
                                        </div>
                                        <div className="h-2 rounded-full bg-gray-200 dark:bg-zinc-700 overflow-hidden">
                                            <div className="h-full rounded-full bg-gray-400 dark:bg-zinc-500" style={{ width: `${(row.prev / max) * 100}%` }} />
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-base font-bold text-gray-900 dark:text-white tabular-nums">{f.n(row.cur)}</p>
                                        <p className={`text-xs tabular-nums ${tone(delta)}`}>
                                            {delta === 0
                                                ? tk('ovChangeNone', { previous: f.n(row.prev) })
                                                : tk('ovChange', { change: f.signed(delta), previous: f.n(row.prev) })}
                                        </p>
                                    </div>
                                </>
                            )}
                        </li>
                    );
                })}
                <li className="grid grid-cols-[1fr_auto] sm:grid-cols-[11rem_1fr_9.5rem] items-center gap-x-4 py-3 border-t border-gray-200 dark:border-zinc-700">
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{tk('ovRowRating')}</span>
                    {ratingNow === null && ratingBefore === null ? (
                        <span className="col-span-2 order-last sm:order-none text-sm text-gray-600 dark:text-gray-400">{noData}</span>
                    ) : (
                        <>
                            <span className="hidden sm:block" aria-hidden="true"></span>
                            <div className="text-right">
                                <p className="text-base font-bold text-gray-900 dark:text-white tabular-nums">
                                    {ratingNow === null ? '—' : f.dec2(ratingNow)}
                                    {ratingNow !== null && <i className="fa-solid fa-star text-yellow-400 text-sm ml-1" aria-hidden="true"></i>}
                                </p>
                                {ratingNow !== null && ratingBefore !== null && (() => {
                                    const delta = Math.round((ratingNow - ratingBefore) * 100) / 100;
                                    return (
                                        <p className={`text-xs tabular-nums ${tone(delta)}`}>
                                            {delta === 0
                                                ? tk('ovChangeNone', { previous: f.dec2(ratingBefore) })
                                                : tk('ovChange', { change: f.signed2(delta), previous: f.dec2(ratingBefore) })}
                                        </p>
                                    );
                                })()}
                            </div>
                        </>
                    )}
                </li>
            </ul>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                {tk('ovTotals', {
                    reviews: f.n(totals.reviewsPublished),
                    businesses: f.n(totals.businesses),
                    withOwner: f.n(totals.businessesWithOwner),
                    withoutReviews: f.n(totals.businessesWithoutReviews),
                    users: f.n(totals.users),
                })}
            </p>
        </div>
    );
};

export default WeekComparison;
