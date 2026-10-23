import React from 'react';
import { Link } from 'react-router-dom';
import StarRating from '../../../StarRating';
import BusinessLogo from '../../../BusinessLogo';
import { useI18n, useTranslation, getLocaleFromLanguage } from '../../../../contexts/i18nContext';
import type { OverviewBusinessRef, OverviewReview } from '../../../../services/supabaseService';
import RichText from './RichText';
import { categoryLabel, isLate, relativeAge } from './overviewUtils';

const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-800';

/** Tarjeta blanca de una cola: titulo, enlace «Ver las N» y contenido. */
export const QueueCard: React.FC<{
    id: string;
    title: string;
    seeAll?: { to: string; text: string; ariaLabel: string };
    children: React.ReactNode;
    className?: string;
}> = ({ id, title, seeAll, children, className = '' }) => (
    <section aria-labelledby={id} className={`bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border dark:border-zinc-700 p-4 sm:p-6 min-w-0 ${className}`}>
        <div className="flex items-start justify-between gap-3">
            <h2 id={id} className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100 min-w-0 break-words py-2.5">{title}</h2>
            {seeAll && (
                <Link
                    to={seeAll.to}
                    aria-label={seeAll.ariaLabel}
                    className={`flex-shrink-0 inline-flex items-center min-h-[44px] text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:underline rounded ${FOCUS}`}
                >
                    {seeAll.text}
                    <i className="fa-solid fa-arrow-right text-xs ml-1.5" aria-hidden="true"></i>
                </Link>
            )}
        </div>
        {children}
    </section>
);

/** Cola vacia: dice «Nada pendiente» y por que, en vez de dejar un hueco. */
export const EmptyQueue: React.FC<{ hint: string }> = ({ hint }) => {
    const t = useTranslation();
    return (
        <div className="flex items-start gap-3 py-4" role="status">
            <i className="fa-regular fa-circle-check text-xl text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" aria-hidden="true"></i>
            <div className="min-w-0">
                <p className="font-bold text-gray-800 dark:text-gray-100">{t('adminDashboard.ovNothingPending')}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{hint}</p>
            </div>
        </div>
    );
};

/**
 * Antiguedad en texto. Si lleva mas de 3 dias, ademas del rojo va en negrita,
 * con un reloj delante y con una frase solo para lectores de pantalla: el color
 * nunca es lo unico que lo dice.
 */
export const Age: React.FC<{ since: string | null; now: number; className?: string }> = ({ since, now, className = '' }) => {
    const { language } = useI18n();
    const t = useTranslation();
    const text = relativeAge(since, getLocaleFromLanguage(language), now);
    if (!text) return null;
    const late = isLate(since, now);
    return late ? (
        <span className={`inline-flex items-center gap-1 whitespace-nowrap font-bold text-red-700 dark:text-red-400 ${className}`}>
            <i className="fa-regular fa-clock text-[11px]" aria-hidden="true"></i>
            <time dateTime={since as string}>{text}</time>
            <span className="sr-only">. {t('adminDashboard.ovLateSr')}</span>
        </span>
    ) : (
        <time dateTime={since as string} className={`whitespace-nowrap text-gray-600 dark:text-gray-400 ${className}`}>{text}</time>
    );
};

/** Boton verde claro de accion. Siempre es un enlace a la pantalla donde se resuelve. */
export const ActionLink: React.FC<{ to: string; label: string; ariaLabel?: string }> = ({ to, label, ariaLabel }) => (
    <Link
        to={to}
        aria-label={ariaLabel}
        className={`inline-flex items-center justify-center min-h-[44px] px-4 rounded-lg text-sm font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-brand-green/10 dark:text-emerald-400 dark:hover:bg-brand-green/20 transition-colors whitespace-nowrap ${FOCUS}`}
    >
        {label}
    </Link>
);

/** Fila de una cola breve: ficha a la izquierda, antiguedad y accion a la derecha. */
export const QueueRow: React.FC<{
    business?: OverviewBusinessRef | null;
    fallbackIcon?: string;
    title: React.ReactNode;
    sub?: React.ReactNode;
    since: string | null;
    now: number;
    action: React.ReactNode;
}> = ({ business, fallbackIcon = 'fa-store', title, sub, since, now, action }) => (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 border-t first:border-t-0 border-gray-200 dark:border-zinc-700">
        <BusinessLogo
            logoUrl={business?.logoUrl}
            businessName={business?.name || ''}
            tone={business?.logoTone}
            className="w-10 h-10"
            iconSize="text-base"
            fallbackIcon={fallbackIcon}
            rounded="rounded-lg"
            defaultChip="bg-gray-100 dark:bg-zinc-700 border-gray-200 dark:border-zinc-600"
            width={40}
            height={40}
        />
        <div className="min-w-0 flex-1 basis-40">
            <p className="font-bold text-sm text-gray-900 dark:text-gray-100 line-clamp-2 break-words">{title}</p>
            {sub && <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 break-words">{sub}</p>}
        </div>
        <div className="ml-auto flex flex-col items-end gap-1 text-xs flex-shrink-0">
            <Age since={since} now={now} />
            {action}
        </div>
    </li>
);

/** Resena por moderar. Solo «Revisar»: aprobar o rechazar se hace en la pantalla de moderacion, con la resena entera delante. */
export const ReviewItem: React.FC<{ review: OverviewReview; now: number; reviewTo: string }> = ({ review, now, reviewTo }) => {
    const t = useTranslation();
    const category = categoryLabel(review.category, t);
    const author = review.author || t('common.anonymous');
    const business = review.business.name || t('adminClaims.businessDeleted');
    return (
        <li className="border border-gray-200 dark:border-zinc-700 rounded-xl p-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <StarRating rating={review.rating} size="small" />
                    <span className="sr-only">{t('common.ratingOutOfFive', { rating: String(review.rating) })}</span>
                </div>
                <Age since={review.since} now={now} className="text-xs" />
            </div>
            {review.title && <h3 className="mt-2 font-bold text-base text-gray-900 dark:text-gray-100 break-words line-clamp-2">{review.title}</h3>}
            {(category || review.images > 0) && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {category && (
                        <span className="inline-flex items-center gap-1.5 bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-300 text-xs font-semibold px-2 py-1 rounded max-w-full">
                            <i className="fa-solid fa-tag text-[10px] text-gray-500 dark:text-gray-400 flex-shrink-0" aria-hidden="true"></i>
                            <span className="truncate first-letter:uppercase">{category}</span>
                        </span>
                    )}
                    {review.images > 0 && (
                        <span className="inline-flex items-center gap-1.5 bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-300 text-xs font-semibold px-2 py-1 rounded">
                            <i className="fa-solid fa-image text-[10px] text-gray-500 dark:text-gray-400" aria-hidden="true"></i>
                            <span>{t('adminDashboard.ovFilterImage')}</span>
                        </span>
                    )}
                </div>
            )}
            {review.excerpt && <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 leading-relaxed line-clamp-3 break-words">{review.excerpt}</p>}
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-zinc-700 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-2.5 min-w-0 flex-1 text-sm text-gray-600 dark:text-gray-400">
                    <span className="w-8 h-8 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center font-bold text-sm text-gray-700 dark:text-gray-200 flex-shrink-0" aria-hidden="true">
                        {author.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 line-clamp-2 break-words">
                        <RichText text={t('adminDashboard.ovReviewBy', { author, business })} boldClassName="font-bold text-gray-900 dark:text-gray-100" />
                    </span>
                </div>
                <ActionLink to={reviewTo} label={t('adminDashboard.ovReview')} ariaLabel={`${t('adminDashboard.ovReview')}: ${review.title || business}`} />
            </div>
        </li>
    );
};

/** Esqueleto con las medidas de la pantalla real: al llegar los datos, nada se mueve de sitio. */
export const PanelSkeleton: React.FC = () => (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-5 animate-pulse motion-reduce:animate-none">
        <div className="space-y-3">
            <div className="h-5 w-full max-w-3xl rounded bg-gray-200 dark:bg-zinc-700" />
            <div className="h-5 w-2/3 max-w-xl rounded bg-gray-200 dark:bg-zinc-700" />
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border dark:border-zinc-700 p-4 sm:p-6 space-y-4">
            <div className="h-7 w-48 rounded bg-gray-200 dark:bg-zinc-700" />
            <div className="h-5 w-full max-w-lg rounded bg-gray-200 dark:bg-zinc-700" />
            <div className="flex gap-2">{[0, 1, 2, 3].map(i => <div key={i} className="h-9 w-24 rounded-full bg-gray-200 dark:bg-zinc-700" />)}</div>
            {[0, 1].map(i => <div key={i} className="h-44 rounded-xl bg-gray-100 dark:bg-zinc-900/50" />)}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {[0, 1, 2, 3].map(i => (
                <div key={i} className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border dark:border-zinc-700 p-4 sm:p-6 space-y-3">
                    <div className="h-7 w-40 rounded bg-gray-200 dark:bg-zinc-700" />
                    {[0, 1].map(j => <div key={j} className="h-14 rounded-lg bg-gray-100 dark:bg-zinc-900/50" />)}
                </div>
            ))}
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border dark:border-zinc-700 p-4 sm:p-6 space-y-3">
            <div className="h-7 w-64 rounded bg-gray-200 dark:bg-zinc-700" />
            {[0, 1, 2, 3].map(i => <div key={i} className="h-12 rounded-lg bg-gray-100 dark:bg-zinc-900/50" />)}
        </div>
    </div>
);
