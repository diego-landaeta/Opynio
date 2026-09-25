import React from 'react';
import { useTranslation } from '../contexts/i18nContext';

interface RatingDistributionProps {
    distribution: Record<number, number>;
    totalReviews: number;
    // Con un producto elegido en la ficha: linea bajo el titulo que dice de que
    // es la distribucion. Sin ella, la tarjeta es la de la empresa, como siempre.
    subtitle?: React.ReactNode;
    // Solo en modo producto: cifras aun cargando / no se pudieron cargar /
    // texto cuando el producto no tiene resenas.
    isLoading?: boolean;
    errorMessage?: string | null;
    emptyMessage?: string;
}

const RatingDistribution: React.FC<RatingDistributionProps> = ({ distribution, totalReviews, subtitle, isLoading = false, errorMessage = null, emptyMessage }) => {
    const t = useTranslation();
    const isScoped = subtitle != null;
    // La tarjeta de la empresa sin resenas se queda como estaba. La de un
    // producto se pinta siempre: si no, al elegir uno sin resenas no quedaria
    // claro de que habla el aviso.
    if (!isScoped && totalReviews === 0) {
        return <p className="text-sm text-gray-500 dark:text-gray-400">{t('businessPage.notEnoughDataForSummary')}</p>;
    }

    return (
        <div
            data-testid="rating-distribution"
            data-scope={isScoped ? 'product' : 'business'}
            aria-busy={isLoading || undefined}
            className="bg-white dark:bg-zinc-800 p-3 sm:p-4 md:p-5 rounded-xl shadow-sm border dark:border-zinc-700"
        >
            <h3 className={`font-bold text-xs sm:text-sm md:text-base text-gray-800 dark:text-gray-100 ${isScoped ? 'mb-1' : 'mb-2.5 sm:mb-3'}`}>{t('businessPage.ratingDistribution')}</h3>
            {isScoped && (
                <div data-testid="rating-distribution-subtitle" className="mb-2.5 sm:mb-3 text-xs text-gray-600 dark:text-gray-300 min-w-0">
                    {subtitle}
                </div>
            )}
            {errorMessage ? (
                <p role="alert" className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{errorMessage}</p>
            ) : isScoped && !isLoading && totalReviews === 0 ? (
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{emptyMessage || t('businessPage.notEnoughDataForSummary')}</p>
            ) : (
                <div className={`space-y-1.5 ${isLoading ? 'animate-pulse' : ''}`}>
                    {[5, 4, 3, 2, 1].map(star => {
                        const count = isLoading ? 0 : (distribution[star] || 0);
                        const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                        return (
                            <div key={star} data-star={star} data-count={isLoading ? undefined : count} className="flex items-center gap-2 text-xs sm:text-sm">
                                <span className="font-medium text-gray-600 dark:text-gray-300 w-8 sm:w-10 text-center flex-shrink-0">
                                    {star} ★
                                </span>
                                <div className="flex-grow bg-gray-200 dark:bg-zinc-700 rounded-full h-1.5 sm:h-2 min-w-0">
                                    <div
                                        className="bg-brand-green h-1.5 sm:h-2 rounded-full"
                                        style={{ width: `${percentage}%` }}
                                        aria-valuenow={percentage}
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                        role="progressbar"
                                        aria-label={`${count} reviews with ${star} stars`}
                                    ></div>
                                </div>
                                <span className="font-medium text-gray-600 dark:text-gray-300 w-6 sm:w-8 text-right flex-shrink-0">{isLoading ? '–' : count}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default RatingDistribution;
