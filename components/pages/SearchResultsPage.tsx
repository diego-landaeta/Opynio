





import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import BusinessLogo from '../BusinessLogo';
import { getPublicReviews } from '../../services/supabaseService';
import { searchBusinessesOptimized } from '../../services/optimizedQueries';
import type { BusinessSearchResult, Review } from '../../types';
import Spinner from '../Spinner';
import ReviewCard from '../ReviewCard';
import Meta from '../Meta';
import LazyRender from '../LazyRender';
import { useTranslation, useI18n, pathTranslations, useAutoTranslation, type Language, getLanguageForCountryCode } from '../../contexts/i18nContext';
import { generateBusinessPath } from '../../utils/linkUtils';
import { useOwnBusiness } from '../../utils/businessOwnership';
import OwnBusinessBadge from '../OwnBusinessBadge';
import { Link } from 'react-router-dom';
import { usePluralT } from '../../utils/plural';


const BusinessResultCard: React.FC<{ business: BusinessSearchResult }> = React.memo(({ business }) => {
    const t = useTranslation();
    const [imageError, setImageError] = useState(false);

    const businessPath = generateBusinessPath(business);
    // Negocio propio: se marca y se ofrece ir al panel además de ver el perfil.
    // Sale de las empresas que AuthContext ya tiene cargadas, sin consultas.
    const ownBusiness = useOwnBusiness(business);

    const logo = (
        <BusinessLogo
            logoUrl={business.logo_url}
            businessName={business.name}
            tone={business.logo_tone}
            className="w-10 h-10 sm:w-12 sm:h-12"
            rounded="rounded-md"
            bordered={false}
            iconSize="text-xl sm:text-2xl"
            width={48}
            height={48}
        />
    );

    if (ownBusiness) {
        return (
            <div className="bg-white dark:bg-zinc-800 p-3 sm:p-4 rounded-lg shadow-sm border border-brand-green/60 dark:border-brand-green/50" data-own-business="true">
                <div className="flex items-center gap-3 sm:gap-4">
                    {logo}
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <h3 className="font-bold text-sm sm:text-base text-gray-800 dark:text-gray-200 break-words">{business.name}</h3>
                            {/* «Tu negocio · Gestionar»: la etiqueta y el acceso al panel en uno. */}
                            <OwnBusinessBadge business={business} manage />
                        </div>
                        <Link to={businessPath} className="mt-1 inline-block text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-300 hover:text-brand-green hover:underline">
                            {t('businessesPage.viewBusinessProfileLink')}
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <Link to={businessPath} className="block bg-white dark:bg-zinc-800 p-3 sm:p-4 rounded-lg shadow-sm border dark:border-zinc-700 hover:border-brand-green hover:shadow-md transition-all">
            <div className="flex items-center gap-3 sm:gap-4">
                {logo}
                <div>
                    <h3 className="font-bold text-sm sm:text-base text-gray-800 dark:text-gray-200">{business.name}</h3>
                    <p className="text-xs sm:text-sm text-brand-green font-semibold">{t('businessesPage.viewBusinessProfileLink')}</p>
                </div>
            </div>
        </Link>
    );
});

const SearchResultsPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const query = searchParams.get('q') || '';
    const t = useTranslation();
    const tn = usePluralT();

    const [businesses, setBusinesses] = useState<BusinessSearchResult[]>([]);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [reviewTotal, setReviewTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!query) {
            setLoading(false);
            setBusinesses([]);
            setReviews([]);
            return;
        }

        const performSearch = async () => {
            setLoading(true);
            setError(null);
            try {
                const [businessData, reviewData] = await Promise.all([
                    searchBusinessesOptimized(query),
                    getPublicReviews({ searchTerm: query }, 1, 10) // reuse getPublicReviews
                ]);
                setBusinesses(businessData);
                // Devuelve { reviews, totalCount }: el titulo decia siempre "10
                // resenas encontradas" (el tamano de pagina), no el total.
                const r: any = reviewData;
                const lista = Array.isArray(r) ? r : (r?.reviews || []);
                setReviews(lista);
                setReviewTotal(Array.isArray(r) ? lista.length : (r?.totalCount ?? lista.length));
            } catch (err: any) {
                console.error("Search failed:", err);
                setError(t('errorSearching'));
            } finally {
                setLoading(false);
            }
        };

        performSearch();
    }, [query, t]);

    return (
        <>
            {/* noindex: Las páginas de resultados de búsqueda no deben indexarse
                ya que generan miles de URLs dinámicas con contenido duplicado */}
            <Meta
                title={t('meta.searchTitle', { query })}
                description={t('meta.searchDesc', { query })}
                noindex={true}
            />
            <div className="max-w-4xl mx-auto px-4 sm:px-0">
                <h1 className="text-2xl sm:text-3xl font-bold mb-2 dark:text-gray-100">{t('searchResults')}</h1>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-6 sm:mb-8">{t('showingResultsFor', { query })}</p>

                {loading ? (
                    <div className="flex justify-center items-center h-64"><Spinner /></div>
                ) : error ? (
                    <div className="text-center text-red-500 bg-red-50 p-4 sm:p-6 rounded-lg text-sm sm:text-base">{error}</div>
                ) : (
                    <div className="space-y-8 sm:space-y-10 md:space-y-12">
                        <section>
                            <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 dark:text-gray-100">{tn('businessesPage.businessesFound', businesses.length)}</h2>
                            {businesses.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                                    {businesses.map(biz => <BusinessResultCard key={biz.id} business={biz} />)}
                                </div>
                            ) : (
                                <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-800 p-4 sm:p-6 rounded-lg border-2 border-dashed dark:border-zinc-700">{t('noBusinessesFound')}</p>
                            )}
                        </section>
                        <section>
                            <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 dark:text-gray-100">{tn('common.reviewsFound', reviewTotal)}</h2>
                            {reviews.length > 0 ? (
                                <div className="space-y-4 sm:space-y-6">
                                    {reviews.map(rev => (
                                        <LazyRender key={rev.id} placeholderHeight="250px">
                                            <ReviewCard review={rev} showBusinessName={true} />
                                        </LazyRender>
                                    ))}
                                </div>
                            ) : (
                                 <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-800 p-4 sm:p-6 rounded-lg border-2 border-dashed dark:border-zinc-700">{t('noReviewsFound')}</p>
                            )}
                        </section>
                    </div>
                )}
            </div>
        </>
    );
};

export default SearchResultsPage;