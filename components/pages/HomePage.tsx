import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Review, Business, Sede, Json } from '../../types';
import { getFeaturedBusinessesWithStats, getBusinessIdAndNameList, adminSetFeaturedCompanies, adminGetFeaturedCompanies } from '../../services/supabaseService';
import { getLatestBusinessesOptimized, getFeaturedReviewsOptimized } from '../../services/optimizedQueries';
import Spinner from '../Spinner';
import ReviewCard from '../ReviewCard';
import Meta from '../Meta';
import { updates as allUpdates } from './WhatsNewPage';
import { useTranslation, useI18n, pathTranslations, type Language, getLanguageForCountryCode, getLocaleFromLanguage } from '../../contexts/i18nContext';
import { HOMEPAGE_CATEGORIES, HOMEPAGE_TO_CATEGORY_MAP, COUNTRIES, LANGUAGES } from '../../constants';
import { useCountry } from '../../contexts/CountryContext';
import { generateBusinessPath } from '../../utils/linkUtils';
import { extractSubcategory, getSubcategoryKey } from '../../utils/categoryMappings';
import { useAuth } from '../../contexts/AuthContext';
import { markInternalNavigation } from '../LanguagePopup';


// Fixed bottom banner that doesn't cause CLS (position: fixed doesn't affect layout)
const LanguageSelectionBanner: React.FC<{ isOpen: boolean, onClose: () => void }> = ({ isOpen, onClose }) => {
    const { setLanguage } = useI18n();
    const t = useTranslation();

    const handleSelectLanguage = (lang: Language) => {
        setLanguage(lang);
        onClose();
    };

    if (!isOpen) return null;

    // Position fixed doesn't cause CLS because it's taken out of document flow
    return (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-700 shadow-lg safe-area-bottom">
            <div className="container mx-auto px-4 py-3">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <i className="fa-solid fa-globe text-brand-green"></i>
                        <span className="font-medium">{t('homepage.selectLanguageTitle')}</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                        {LANGUAGES.slice(0, 5).map(lang => (
                            <button
                                key={lang.code}
                                onClick={() => handleSelectLanguage(lang.code as Language)}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors border border-gray-200 dark:border-zinc-700 text-xs font-medium"
                            >
                                <img src={lang.flag} alt={lang.name} width={16} height={16} className="w-4 h-4 rounded-full object-cover" />
                                <span className="text-gray-700 dark:text-gray-300">{lang.code.toUpperCase()}</span>
                            </button>
                        ))}
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors text-gray-500"
                            aria-label="Cerrar"
                        >
                            <i className="fa-solid fa-times text-sm"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};


// Helper function to safely parse the 'sedes' field which might be a JSON string or an array-like object.
const getSedeList = (sedes: Sede[] | Json | null | undefined): Sede[] => {
    if (!sedes) return [];
    if (Array.isArray(sedes)) return sedes as unknown as Sede[];
    if (typeof sedes === 'string') {
        try {
            const parsed = JSON.parse(sedes);
            return Array.isArray(parsed) ? parsed as unknown as Sede[] : [];
        } catch (e) {
            console.error("Failed to parse sedes JSON string:", sedes);
            return [];
        }
    }
    if (typeof sedes === 'object' && sedes !== null) {
        const values = Object.values(sedes);
        if (values.every(v => typeof v === 'object' && v !== null && 'country_code' in v)) {
            return values as unknown as Sede[];
        }
    }
    return [];
};

// Carousel component for businesses - horizontal scroll showing 2 cards at a time
const BusinessCarousel: React.FC<{ companies: Business[], loading: boolean }> = React.memo(({ companies, loading }) => {
    const t = useTranslation();
    const [currentPage, setCurrentPage] = useState(0);

    // Cards per page: 2 on desktop/tablet, 1 on mobile
    const getCardsPerPage = () => {
        if (typeof window === 'undefined') return 2;
        if (window.innerWidth < 640) return 1;
        return 2;
    };

    const [cardsPerPage, setCardsPerPage] = useState(2);

    useEffect(() => {
        const updateCardsPerPage = () => setCardsPerPage(getCardsPerPage());
        updateCardsPerPage();
        window.addEventListener('resize', updateCardsPerPage);
        return () => window.removeEventListener('resize', updateCardsPerPage);
    }, []);

    const totalPages = Math.ceil(companies.length / cardsPerPage);

    const handlePrev = () => {
        setCurrentPage(prev => Math.max(0, prev - 1));
    };

    const handleNext = () => {
        setCurrentPage(prev => Math.min(totalPages - 1, prev + 1));
    };

    // Get current visible companies
    const visibleCompanies = companies.slice(
        currentPage * cardsPerPage,
        currentPage * cardsPerPage + cardsPerPage
    );

    // Show skeleton while loading
    if (loading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {[...Array(2)].map((_, i) => (
                    <div key={i} className="bg-white dark:bg-zinc-800 p-5 sm:p-6 rounded-xl border border-gray-200 dark:border-zinc-700 animate-pulse">
                        <div className="flex items-start gap-4 mb-4">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-200 dark:bg-zinc-700 rounded-xl flex-shrink-0"></div>
                            <div className="flex-1">
                                <div className="h-5 bg-gray-200 dark:bg-zinc-700 rounded w-3/4 mb-2"></div>
                                <div className="h-4 bg-gray-200 dark:bg-zinc-700 rounded w-1/2 mb-2"></div>
                                <div className="flex gap-1">
                                    {[...Array(5)].map((_, j) => (
                                        <div key={j} className="w-4 h-4 bg-gray-200 dark:bg-zinc-700 rounded"></div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2 mb-4">
                            <div className="h-4 bg-gray-200 dark:bg-zinc-700 rounded w-2/3"></div>
                            <div className="h-4 bg-gray-200 dark:bg-zinc-700 rounded w-1/2"></div>
                        </div>
                        <div className="h-11 bg-gray-200 dark:bg-zinc-700 rounded-lg w-full"></div>
                    </div>
                ))}
            </div>
        );
    }

    // Show message when no companies
    if (!companies || companies.length === 0) {
        return (
            <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-8 text-center">
                <div className="w-16 h-16 bg-brand-green/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fa-solid fa-building text-brand-green text-2xl"></i>
                </div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">{t('homepage.noFeaturedCompanies')}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">{t('homepage.noFeaturedCompaniesDesc')}</p>
            </div>
        );
    }

    return (
        <div className="relative">
            {/* Navigation Arrows */}
            {totalPages > 1 && (
                <>
                    <button
                        onClick={handlePrev}
                        disabled={currentPage === 0}
                        className={`absolute -left-2 sm:-left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white dark:bg-zinc-800 shadow-lg border border-gray-200 dark:border-zinc-700 flex items-center justify-center transition-all ${
                            currentPage === 0 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-zinc-700 hover:scale-105'
                        }`}
                        aria-label="Previous"
                    >
                        <i className="fa-solid fa-chevron-left text-gray-600 dark:text-gray-300 text-sm"></i>
                    </button>
                    <button
                        onClick={handleNext}
                        disabled={currentPage >= totalPages - 1}
                        className={`absolute -right-2 sm:-right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white dark:bg-zinc-800 shadow-lg border border-gray-200 dark:border-zinc-700 flex items-center justify-center transition-all ${
                            currentPage >= totalPages - 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-zinc-700 hover:scale-105'
                        }`}
                        aria-label="Next"
                    >
                        <i className="fa-solid fa-chevron-right text-gray-600 dark:text-gray-300 text-sm"></i>
                    </button>
                </>
            )}

            {/* Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mx-4 sm:mx-6">
                {visibleCompanies.map((company) => {
                    const businessPath = generateBusinessPath(company);
                    const avgRating = company.avg_rating || 0;
                    const reviewCount = company.review_count || 0;
                    const countryInfo = COUNTRIES.find(c => c.code === company.country);
                    const subcategory = extractSubcategory(company.category);
                    const categoryKey = getSubcategoryKey(subcategory || '');
                    const categoryDisplay = categoryKey ? t(`subcategories.${categoryKey}`) : (subcategory || t('common.noCategory'));

                    // Get website from sedes if available
                    const sedeList = getSedeList(company.sedes);
                    const website = sedeList.length > 0 ? sedeList[0]?.website : null;

                    return (
                        <Link
                            key={company.id}
                            to={businessPath}
                            className="bg-white dark:bg-zinc-800 p-5 sm:p-6 rounded-xl border border-gray-200 dark:border-zinc-700 hover:border-brand-green dark:hover:border-brand-green hover:shadow-lg transition-all group flex flex-col"
                        >
                            {/* Header with Logo and Info */}
                            <div className="flex items-start gap-4 mb-4">
                                {/* Logo */}
                                <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 bg-gray-100 dark:bg-zinc-700 rounded-xl flex items-center justify-center overflow-hidden">
                                    {company.logo_url ? (
                                        <img
                                            src={company.logo_url}
                                            alt=""
                                            className="w-full h-full object-contain p-2"
                                        />
                                    ) : (
                                        <i className="fa-solid fa-building text-gray-400 dark:text-gray-500 text-2xl sm:text-3xl"></i>
                                    )}
                                </div>

                                {/* Company Info */}
                                <div className="flex-1 min-w-0">
                                    {/* Name */}
                                    <h3 className="font-bold text-base sm:text-lg text-gray-800 dark:text-gray-100 group-hover:text-brand-green transition-colors line-clamp-2 mb-1.5">
                                        {company.name}
                                    </h3>

                                    {/* Stars and Rating */}
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <div className="flex items-center gap-0.5">
                                            {[1, 2, 3, 4, 5].map(star => (
                                                <i
                                                    key={star}
                                                    className={`fa-${star <= Math.round(avgRating) ? 'solid' : 'regular'} fa-star text-yellow-400 text-sm`}
                                                ></i>
                                            ))}
                                        </div>
                                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                            {avgRating > 0 ? avgRating.toFixed(1) : '-'}
                                        </span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                            ({reviewCount})
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Details */}
                            <div className="space-y-2 mb-4 flex-1">
                                {/* Category */}
                                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                    <i className="fa-solid fa-tag text-gray-400 w-4 text-center"></i>
                                    <span className="line-clamp-1">{categoryDisplay}</span>
                                </div>

                                {/* Country */}
                                {countryInfo && (
                                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                        <img
                                            src={countryInfo.flag}
                                            alt={countryInfo.name}
                                            className="w-4 h-3 object-cover rounded-sm"
                                        />
                                        <span>{countryInfo.name}</span>
                                    </div>
                                )}

                                {/* Website */}
                                {website && (
                                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                        <i className="fa-solid fa-globe text-gray-400 w-4 text-center"></i>
                                        <span className="line-clamp-1 truncate">{website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
                                    </div>
                                )}
                            </div>

                            {/* CTA Button */}
                            <div className="bg-brand-green/10 text-brand-green font-semibold py-2.5 px-4 rounded-lg group-hover:bg-brand-green group-hover:text-white transition-all flex items-center justify-center gap-2 text-sm">
                                <span>{t('homepage.viewProfile')}</span>
                                <i className="fa-solid fa-arrow-right group-hover:translate-x-1 transition-transform text-xs"></i>
                            </div>
                        </Link>
                    );
                })}
            </div>

            {/* Dots Indicator */}
            {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-5">
                    {Array.from({ length: totalPages }).map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => setCurrentPage(idx)}
                            className={`h-2 rounded-full transition-all ${
                                idx === currentPage
                                    ? 'bg-brand-green w-6'
                                    : 'bg-gray-300 dark:bg-zinc-600 hover:bg-gray-400 dark:hover:bg-zinc-500 w-2'
                            }`}
                            aria-label={`Go to page ${idx + 1}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
});


const HomePage: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();
    const [latestBusinesses, setLatestBusinesses] = useState<Business[]>([]);
    const [featuredReviews, setFeaturedReviews] = useState<Review[]>([]);
    const [loadingBusinesses, setLoadingBusinesses] = useState(true);
    const [loadingReviews, setLoadingReviews] = useState(true);
    const [featuredCompanies, setFeaturedCompanies] = useState<Business[]>([]);
    const [loadingFeatured, setLoadingFeatured] = useState(true);

    const t = useTranslation();
    const { language } = useI18n();
    const { country } = useCountry();
    const { profile } = useAuth();

    // Track if data has been loaded to avoid refetch on HMR but allow initial fetch
    const [dataLoaded, setDataLoaded] = useState(false);
    const [showMore, setShowMore] = useState(false);
    const [isLangModalOpen, setIsLangModalOpen] = useState(false);

    // Admin state for managing featured companies
    const [isFeaturedModalOpen, setIsFeaturedModalOpen] = useState(false);
    const [modalSearchTerm, setModalSearchTerm] = useState('');
    const [modalBusinessResults, setModalBusinessResults] = useState<{id: string, name: string, country: string}[]>([]);
    const [selectedFeaturedIds, setSelectedFeaturedIds] = useState<Set<string>>(new Set());
    const [savingFeatured, setSavingFeatured] = useState(false);

    const isAdmin = profile?.role === 'admin';

    useEffect(() => {
        // Show language prompt banner only on the "original" site (country is null)
        // and only once per session. Using position:fixed so no CLS impact.
        if (country === null && !sessionStorage.getItem('langPromptShown')) {
            setIsLangModalOpen(true);
            sessionStorage.setItem('langPromptShown', 'true');
        }
    }, [country]);

    const countryInfo = useMemo(() => COUNTRIES.find(c => c.code === country), [country]);
    const brandName = countryInfo ? `Opynio ${countryInfo.name}` : 'Opynio';
    const metaTitle = `${brandName} - ${t('homepage.metaTitle').replace('Opynio - ', '')}`;
    const heroTitle = t('homepage.heroTitle').replace('Opynio', brandName);
    const metaDescription = `${brandName}: ${t('homepage.heroSubtitle').toLowerCase()}`;

    const latestUpdate = allUpdates[0];
    const featuresToShow = latestUpdate.features.slice(0, 3);

    // Use country directly - don't infer from language
    const countryPrefix = country ? `/${country.toLowerCase()}` : '';
    const pathLang = country ? getLanguageForCountryCode(country) : language;
    const paths = pathTranslations[pathLang] || pathTranslations.es;


    useEffect(() => {
        // Skip if data was already loaded for this session
        // This prevents refetching on HMR while still allowing country changes
        let isMounted = true;

        const fetchData = async () => {
            console.log('🔄 HomePage: Starting data fetch for country:', country);
            setLoadingBusinesses(true);
            setLoadingReviews(true);
            setLoadingFeatured(true);

            const countryFilter = country || undefined;

            try {
                // Fetch all data in parallel for faster loading
                const [businessesResult, reviewsResult, featuredResult] = await Promise.allSettled([
                    // Latest businesses
                    (async () => {
                        let businesses = await getLatestBusinessesOptimized(5, countryFilter);
                        if (businesses.length === 0 && countryFilter) {
                            businesses = await getLatestBusinessesOptimized(5, undefined);
                        }
                        return businesses;
                    })(),
                    // Featured reviews
                    (async () => {
                        let reviews = await getFeaturedReviewsOptimized(countryFilter, 10);
                        if (reviews.length === 0 && countryFilter) {
                            reviews = await getFeaturedReviewsOptimized(undefined, 10);
                        }
                        return reviews;
                    })(),
                    // Featured businesses
                    (async () => {
                        let featured = await getFeaturedBusinessesWithStats(countryFilter, 10);
                        if (featured.length === 0 && countryFilter) {
                            featured = await getFeaturedBusinessesWithStats(undefined, 10);
                        }
                        return featured;
                    })()
                ]);

                console.log('📦 HomePage: Fetch completed, processing results...');

                // Process results
                if (isMounted) {
                    // Latest businesses
                    if (businessesResult.status === 'fulfilled') {
                        console.log('✅ Latest businesses:', businessesResult.value.length);
                        setLatestBusinesses(businessesResult.value);
                    } else {
                        console.error("❌ Failed to fetch latest businesses:", businessesResult.reason);
                        setLatestBusinesses([]);
                    }
                    setLoadingBusinesses(false);

                    // Featured reviews
                    if (reviewsResult.status === 'fulfilled') {
                        console.log('✅ Featured reviews:', reviewsResult.value.length);
                        setFeaturedReviews(reviewsResult.value.slice(0, 3));
                    } else {
                        console.error("❌ Failed to fetch featured reviews:", reviewsResult.reason);
                        setFeaturedReviews([]);
                    }
                    setLoadingReviews(false);

                    // Featured businesses
                    if (featuredResult.status === 'fulfilled') {
                        console.log('✅ Featured businesses:', featuredResult.value.length);
                        setFeaturedCompanies(featuredResult.value as Business[]);
                    } else {
                        console.error("❌ Failed to fetch featured businesses:", featuredResult.reason);
                        setFeaturedCompanies([]);
                    }
                    setLoadingFeatured(false);
                    setDataLoaded(true);
                }
            } catch (error) {
                console.error('❌ HomePage: Error during fetch:', error);
                if (isMounted) {
                    setLoadingBusinesses(false);
                    setLoadingReviews(false);
                    setLoadingFeatured(false);
                }
            }
        };

        fetchData();

        return () => {
            isMounted = false;
        };
    }, [country]);

    const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (searchTerm.trim()) {
            navigate(`${countryPrefix}/${paths.search}?q=${encodeURIComponent(searchTerm.trim())}`);
        }
    };

    const formatDate = useCallback((dateString: string) => {
        return new Date(dateString).toLocaleDateString(getLocaleFromLanguage(language), {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }, [language]);

    // Admin: Open modal and load current featured companies
    const handleOpenFeaturedModal = useCallback(async () => {
        setIsFeaturedModalOpen(true);
        try {
            const currentFeatured = await adminGetFeaturedCompanies();
            setSelectedFeaturedIds(new Set(currentFeatured.map((b: any) => b.id)));
        } catch (error) {
            console.error('Error loading featured companies:', error);
        }
    }, []);

    // Admin: Search businesses for the modal
    const handleModalSearch = useCallback(async (term: string) => {
        setModalSearchTerm(term);
        if (term.trim().length < 2) {
            setModalBusinessResults([]);
            return;
        }
        try {
            const results = await getBusinessIdAndNameList(term);
            setModalBusinessResults(results);
        } catch (error) {
            console.error('Error searching businesses:', error);
        }
    }, []);

    // Admin: Toggle business selection
    const handleToggleFeatured = useCallback((businessId: string) => {
        setSelectedFeaturedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(businessId)) {
                newSet.delete(businessId);
            } else {
                newSet.add(businessId);
            }
            return newSet;
        });
    }, []);

    // Admin: Save featured companies
    const handleSaveFeatured = useCallback(async () => {
        setSavingFeatured(true);
        try {
            await adminSetFeaturedCompanies(Array.from(selectedFeaturedIds));
            setIsFeaturedModalOpen(false);
            // Refresh featured companies
            const featured = await getFeaturedBusinessesWithStats(country || undefined, 10);
            setFeaturedCompanies(featured as Business[]);
        } catch (error) {
            console.error('Error saving featured companies:', error);
        } finally {
            setSavingFeatured(false);
        }
    }, [selectedFeaturedIds, country]);

    return (
        <>
            <Meta 
                title={metaTitle}
                description={metaDescription}
            />
            <LanguageSelectionBanner isOpen={isLangModalOpen} onClose={() => setIsLangModalOpen(false)} />
            <div className="space-y-10 sm:space-y-12 md:space-y-16 lg:space-y-20">
                <section className="text-center py-8 sm:py-10 md:py-12 bg-gradient-to-b from-white to-gray-50 dark:from-zinc-900 dark:to-zinc-800 -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6">
                    <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-brand-dark dark:text-gray-100 leading-tight md:leading-snug px-2" dangerouslySetInnerHTML={{ __html: heroTitle }} />
                    <p className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-400 mt-3 sm:mt-4 mb-4 sm:mb-5 md:mb-6 max-w-2xl mx-auto px-4">
                        {t('homepage.heroSubtitle')}
                    </p>
                    <form onSubmit={handleSearchSubmit} className="max-w-xl mx-auto flex items-center shadow-md rounded-lg bg-white dark:bg-zinc-800 border dark:border-zinc-700 overflow-hidden">
                        <input
                            type="search"
                            placeholder={t('homepage.searchPlaceholder')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full text-sm sm:text-base p-2.5 sm:p-3 border-r border-gray-200 dark:border-zinc-600 focus:ring-2 focus:ring-brand-green focus:outline-none pl-3 sm:pl-4 bg-transparent text-gray-900 dark:text-gray-100"
                            aria-label={t('homepage.searchPlaceholder')}
                        />
                        <button type="submit" className="bg-brand-green text-white p-2.5 sm:p-3 hover:bg-opacity-90 text-lg sm:text-xl h-full px-4 sm:px-5 transition-colors flex-shrink-0" aria-label="Buscar">
                            <i className="fas fa-search"></i>
                        </button>
                    </form>
                    <p className="mt-3 sm:mt-4 text-xs sm:text-sm text-gray-700 dark:text-gray-300 px-4">
                        {t('homepage.haveYouBought')}{' '}
                        <Link to={`${countryPrefix}/${paths.writeReview}`} className="text-brand-green font-semibold hover:underline">
                            {t('homepage.writeAReviewLink')}
                        </Link>
                    </p>
                </section>

                <section>
                    <div className="flex justify-between items-center mb-4 sm:mb-5 md:mb-6">
                        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100">{t('homepage.exploreCategoriesTitle').replace('Opynio', brandName)}</h2>
                        <Link to={`${countryPrefix}/${paths.explore}`} className="text-sm sm:text-base text-brand-green font-semibold hover:underline whitespace-nowrap">
                            {t('homepage.seeMore')}
                        </Link>
                    </div>
                     <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                        {HOMEPAGE_CATEGORIES.map(({ key, icon }) => (
                            <Link
                                key={key}
                                to={`${countryPrefix}/${paths.explore}?category=${encodeURIComponent(HOMEPAGE_TO_CATEGORY_MAP[key] || '')}`}
                                className="bg-white dark:bg-zinc-800/50 p-3 sm:p-4 rounded-lg sm:rounded-xl flex flex-col items-center justify-center text-center space-y-2 sm:space-y-3 hover:bg-gray-50 dark:hover:bg-zinc-700/60 transition-colors border border-gray-200 dark:border-zinc-800 min-h-[100px] sm:min-h-[110px]"
                            >
                                <i className={`fa-solid ${icon} text-2xl sm:text-3xl text-brand-green`}></i>
                                <span className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-200 leading-tight">{t(`homepage.${key}`)}</span>
                            </Link>
                        ))}
                    </div>
                </section>

                <section className="bg-gray-100 dark:bg-brand-dark text-gray-800 dark:text-white p-5 sm:p-6 md:p-8 lg:p-12 rounded-xl sm:rounded-2xl relative overflow-hidden">
                    <div
                        className="absolute inset-0 bg-contain bg-center opacity-5 dark:opacity-10"
                        style={{ backgroundImage: `url('https://upload.wikimedia.org/wikipedia/commons/8/80/World_map_-_low_resolution.svg')`, backgroundRepeat: 'no-repeat' }}
                    ></div>
                    <div className="relative z-10 text-center">
                        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 dark:text-white px-2">{t('homepage.globalPlatformTitle').replace('Opynio', brandName)}</h2>
                        <h3 className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-300 mt-2 mb-4 px-2">{t('homepage.globalPlatformSubtitle')}</h3>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-6 sm:mb-8 px-2">{t('common.countrySectionHint')}</p>
                        <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-x-3 sm:gap-x-4 md:gap-x-6 gap-y-5 sm:gap-y-6 md:gap-y-8 max-w-6xl mx-auto">
                            {COUNTRIES.slice(0, showMore ? COUNTRIES.length : 10).map(c => {
                                const countryName = t(`countries.${c.code}`) || c.name;
                                return (
                                    <button
                                        key={c.code}
                                        onClick={() => {
                                            markInternalNavigation();
                                            navigate(`/${c.code.toLowerCase()}`);
                                        }}
                                        className="flex flex-col items-center gap-1.5 sm:gap-2 group transition-transform hover:scale-110 w-full max-w-[70px] sm:max-w-[80px] mx-auto"
                                        aria-label={t('common.switchToCountry', { country: countryName })}
                                    >
                                        <img src={c.flag} alt={countryName} width={56} height={56} loading="lazy" decoding="async" className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full object-cover shadow-md group-hover:shadow-[0_0_15px_rgba(0,0,0,0.2)] dark:group-hover:shadow-[0_0_15px_rgba(255,255,255,0.4)] transition-all border-2 border-gray-300 dark:border-gray-600 group-hover:border-brand-green dark:group-hover:border-white" />
                                        <span className="font-semibold text-gray-600 dark:text-gray-300 group-hover:text-brand-green dark:group-hover:text-white transition-colors text-[10px] sm:text-xs md:text-sm text-center leading-tight line-clamp-2">{countryName}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {COUNTRIES.length > 10 && (
                            <div className="text-center mt-6 sm:mt-8 md:mt-10">
                                <button
                                    onClick={() => setShowMore(prev => !prev)}
                                    className="bg-brand-green/10 hover:bg-brand-green/20 dark:bg-white/10 dark:hover:bg-white/20 text-brand-green dark:text-white font-semibold px-4 sm:px-5 md:px-6 py-2 sm:py-2.5 md:py-3 rounded-lg transition-colors text-sm sm:text-base"
                                    aria-expanded={showMore}
                                >
                                    {showMore ? t('common.showLess') : t('common.showMore')}
                                    <i className={`fa-solid ${showMore ? 'fa-chevron-up' : 'fa-chevron-down'} ml-2`}></i>
                                </button>
                            </div>
                        )}
                    </div>
                </section>

                <section className="bg-gray-100 dark:bg-brand-dark text-gray-800 dark:text-white rounded-lg sm:rounded-xl p-5 sm:p-6 md:p-8 space-y-5 sm:space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 text-center">
                        <div><p className="text-2xl sm:text-3xl md:text-4xl font-bold text-brand-green dark:text-white">{t('homepage.stat1Title')}</p><p className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm mt-1 sm:mt-2">{t('homepage.stat1Desc')}</p></div>
                        <div><p className="text-2xl sm:text-3xl md:text-4xl font-bold text-brand-green dark:text-white">{t('homepage.stat2Title')}</p><p className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm mt-1 sm:mt-2">{t('homepage.stat2Desc')}</p></div>
                        <div><p className="text-2xl sm:text-3xl md:text-4xl font-bold text-brand-green dark:text-white">{t('homepage.stat3Title')}</p><p className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm mt-1 sm:mt-2">{t('homepage.stat3Desc')}</p></div>
                    </div>
                    <div className="border-t border-gray-300 dark:border-gray-600 pt-5 sm:pt-6 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                        <div className="text-2xl sm:text-3xl text-gray-500 dark:text-gray-300"><i className="fab fa-google"></i></div>
                        <div className="text-center sm:text-left"><p className="font-bold text-sm sm:text-base text-gray-800 dark:text-white">{t('homepage.googleIntegrationTitle')}</p><p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">{t('homepage.googleIntegrationSubtitle')}</p></div>
                    </div>
                </section>

                <section className="bg-green-50/50 dark:bg-green-900/20 p-5 sm:p-6 md:p-8 rounded-lg sm:rounded-xl border border-green-100 dark:border-green-800/30">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 items-center">
                        <div className="text-center md:text-left"><div className="bg-white dark:bg-zinc-800 text-brand-green rounded-full w-16 h-16 sm:w-20 sm:h-20 inline-flex items-center justify-center shadow-sm border border-gray-100 dark:border-zinc-700 mb-3 sm:mb-4"><i className="fa-solid fa-shield-halved text-3xl sm:text-4xl md:text-5xl"></i></div><h2 className="text-xl sm:text-2xl md:text-3xl font-bold dark:text-gray-100 px-2">{t('homepage.trustTitle').replace('Opynio', brandName)}</h2><p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-2 px-2">{t('homepage.trustSubtitle')}</p></div>
                        <div><ul className="space-y-3 sm:space-y-4"><li className="flex items-start gap-3 sm:gap-4"><div className="bg-white dark:bg-zinc-800 text-brand-green rounded-full w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center shadow-sm border border-gray-100 dark:border-zinc-700 mt-0.5 sm:mt-1"><i className="fa-solid fa-user-check text-base sm:text-lg"></i></div><div><h3 className="font-semibold text-sm sm:text-base text-gray-800 dark:text-gray-200">{t('homepage.trustFeature1Title')}</h3><p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{t('homepage.trustFeature1Desc')}</p></div></li><li className="flex items-start gap-3 sm:gap-4"><div className="bg-white dark:bg-zinc-800 text-brand-green rounded-full w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center shadow-sm border border-gray-100 dark:border-zinc-700 mt-0.5 sm:mt-1"><i className="fa-solid fa-robot text-base sm:text-lg"></i></div><div><h3 className="font-semibold text-sm sm:text-base text-gray-800 dark:text-gray-200">{t('homepage.trustFeature2Title')}</h3><p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{t('homepage.trustFeature2Desc')}</p></div></li><li className="flex items-start gap-3 sm:gap-4"><div className="bg-white dark:bg-zinc-800 text-brand-green rounded-full w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center shadow-sm border border-gray-100 dark:border-zinc-700 mt-0.5 sm:mt-1"><i className="fa-solid fa-gavel text-base sm:text-lg"></i></div><div><h3 className="font-semibold text-sm sm:text-base text-gray-800 dark:text-gray-200">{t('homepage.trustFeature3Title')}</h3><p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{t('homepage.trustFeature3Desc')}</p></div></li></ul></div>
                    </div>
                </section>

                <section className="bg-white dark:bg-zinc-800 p-5 sm:p-6 md:p-8 rounded-lg sm:rounded-xl shadow-sm border border-gray-100 dark:border-zinc-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 items-center">
                        <div className="order-2 md:order-1"><p className="font-bold text-sm sm:text-base text-brand-green mb-2">{t('homepage.forBusinessesSection')}</p><h2 className="text-xl sm:text-2xl md:text-3xl font-bold dark:text-gray-100">{t('homepage.forBusinessesTitle').replace('Opynio', brandName)}</h2><p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-3 sm:mt-4 mb-4 sm:mb-6">{t('homepage.forBusinessesSubtitle')}</p><ul className="space-y-2 sm:space-y-3 dark:text-gray-300 text-sm sm:text-base"><li className="flex items-start gap-2 sm:gap-3"><i className="fa-solid fa-check-circle text-brand-green mt-0.5 sm:mt-1 flex-shrink-0"></i><span dangerouslySetInnerHTML={{__html: t('homepage.forBusinessesFeature1')}} /></li><li className="flex items-start gap-2 sm:gap-3"><i className="fa-solid fa-check-circle text-brand-green mt-0.5 sm:mt-1 flex-shrink-0"></i><span dangerouslySetInnerHTML={{__html: t('homepage.forBusinessesFeature2')}} /></li><li className="flex items-start gap-2 sm:gap-3"><i className="fa-solid fa-check-circle text-brand-green mt-0.5 sm:mt-1 flex-shrink-0"></i><span dangerouslySetInnerHTML={{__html: t('homepage.forBusinessesFeature3')}} /></li></ul><Link to={`${countryPrefix}/${paths.register}?type=business`} className="mt-6 sm:mt-8 inline-block bg-brand-green text-white font-semibold px-5 sm:px-6 py-2.5 sm:py-3 rounded-md hover:bg-opacity-90 transition-all shadow-sm text-sm sm:text-base">{t('homepage.registerBusinessFree')}</Link></div>
                        <div className="order-1 md:order-2 aspect-[3/2] md:aspect-auto md:h-80 overflow-hidden rounded-lg bg-gray-100 dark:bg-zinc-700"><img src="https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=1932&auto=format&fit=crop" alt="Team working in an office" width={1932} height={1288} loading="lazy" decoding="async" className="w-full h-full object-cover" /></div>
                    </div>
                </section>

                <section className="bg-gray-50 dark:bg-zinc-800/50 p-8 rounded-xl border border-gray-200 dark:border-zinc-700/50">
                    <div className="text-center max-w-2xl mx-auto"><span className="text-sm font-bold text-gray-500 dark:text-gray-400">{t(latestUpdate.dateKey)}</span><h2 className="text-3xl font-bold text-brand-dark dark:text-gray-100 mt-1">{t(latestUpdate.titleKey)}</h2><p className="text-gray-600 dark:text-gray-400 mt-2">{t('homepage.whatsNewSubtitle')}</p></div>
                    <div className={`grid grid-cols-1 gap-8 max-w-6xl mx-auto mt-12 ${featuresToShow.length === 1 ? 'max-w-lg' : featuresToShow.length === 2 ? 'sm:grid-cols-2 max-w-4xl' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>{featuresToShow.map((feature) => (<div key={feature.titleKey} className="bg-white dark:bg-zinc-800 p-6 rounded-lg shadow-sm border dark:border-zinc-700 text-left transition-transform hover:-translate-y-1"><div className={`${feature.color} text-3xl mb-3`}><i className={feature.icon}></i></div><h3 className="text-lg font-bold mb-2 dark:text-gray-200">{t(feature.titleKey)}</h3><p className="text-gray-600 dark:text-gray-400 text-sm">{t(feature.descriptionKey)}</p></div>))}<div className="text-center mt-12"><Link to={`${countryPrefix}/${paths.whatsNew}`} className="inline-block bg-brand-dark dark:bg-gray-200 text-white dark:text-brand-dark font-semibold px-6 py-3 rounded-md hover:bg-gray-800 dark:hover:bg-white transition-all shadow-sm">{t('homepage.discoverAllWhatsNew')}</Link></div></div>
                </section>
                
                <section className="relative bg-gray-100 dark:bg-zinc-900 text-gray-800 dark:text-white p-8 md:p-12 rounded-2xl overflow-hidden border border-gray-200 dark:border-zinc-700 shadow-lg shadow-brand-green/10">
                    <div className="absolute inset-0 w-full h-full" style={{ backgroundImage: `radial-gradient(circle at top right, rgba(0, 182, 122, 0.15) 0%, transparent 50%), radial-gradient(circle at bottom left, rgba(30, 64, 175, 0.15) 0%, transparent 50%)`}}></div>
                    <div className="relative z-10 grid md:grid-cols-2 gap-8 md:gap-12 items-center"><div className="space-y-4"><h2 className="text-3xl font-bold text-gray-800 dark:text-white">{t('homepage.pricingTitle').replace('Opynio', brandName)}</h2><p className="text-gray-600 dark:text-gray-300">{t('homepage.pricingSubtitle')}</p><ul className="space-y-3 pt-2 text-gray-600 dark:text-gray-300"><li className="flex items-start gap-3"><i className="fa-solid fa-check-circle text-brand-green mt-1"></i><span dangerouslySetInnerHTML={{__html: t('homepage.pricingFeature1')}} /></li><li className="flex items-start gap-3"><i className="fa-solid fa-check-circle text-brand-green mt-1"></i><span dangerouslySetInnerHTML={{__html: t('homepage.pricingFeature2')}} /></li><li className="flex items-start gap-3"><i className="fa-solid fa-check-circle text-brand-green mt-1"></i><span dangerouslySetInnerHTML={{__html: t('homepage.pricingFeature3')}} /></li></ul></div><div className="bg-white/80 dark:bg-zinc-800/50 p-8 rounded-lg border border-gray-200 dark:border-zinc-700 text-center"><h2 className="text-3xl font-bold mb-3 text-gray-800 dark:text-white">{t('homepage.pricingBoxTitle')}</h2><p className="text-gray-600 dark:text-gray-300 mb-6 max-w-xl mx-auto">{t('homepage.pricingBoxSubtitle')}</p><Link to={`${countryPrefix}/${paths.pricing}`} className="inline-block bg-brand-green text-white font-bold px-8 py-3 rounded-md hover:bg-opacity-90 transition-all shadow-lg shadow-brand-green/30 text-lg">{t('homepage.viewPlansAndPricing')}</Link></div></div>
                </section>

                <section>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 mb-6 sm:mb-8 px-2">
                        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-center dark:text-gray-100">{t('homepage.someBusinessesTitle').replace('Opynio', brandName)}</h2>
                        {isAdmin && (
                            <button
                                onClick={handleOpenFeaturedModal}
                                className="text-xs bg-brand-green/10 text-brand-green px-3 py-1.5 rounded-full hover:bg-brand-green/20 transition-colors flex items-center gap-1.5"
                            >
                                <i className="fa-solid fa-cog"></i>
                                <span>{t('homepage.manageFeatured')}</span>
                            </button>
                        )}
                    </div>
                    <BusinessCarousel companies={featuredCompanies} loading={loadingFeatured} />
                    {/* "Ver más empresas" button */}
                    <div className="text-center mt-6 sm:mt-8">
                        <Link
                            to={`${countryPrefix}/${paths.businesses}`}
                            className="inline-flex items-center gap-2 bg-brand-green text-white font-semibold px-6 py-3 rounded-lg hover:bg-brand-green/90 transition-all shadow-md hover:shadow-lg"
                        >
                            <span>{t('homepage.viewMoreBusinesses')}</span>
                            <i className="fa-solid fa-arrow-right"></i>
                        </Link>
                    </div>
                </section>

                <section>
                    <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-center mb-6 sm:mb-7 md:mb-8 dark:text-gray-100 px-2">{t('homepage.latestBusinessesTitle').replace('Opynio', brandName)}</h2>
                    <div className="min-h-[280px] sm:min-h-[320px]">
                    {loadingBusinesses ? <div className="flex justify-center items-center h-[280px] sm:h-[320px]"><Spinner /></div> : latestBusinesses.length > 0 ? <div className="max-w-2xl mx-auto bg-white dark:bg-zinc-800 p-4 sm:p-5 md:p-6 rounded-lg sm:rounded-xl shadow-sm border border-gray-100 dark:border-zinc-700"><ul className="divide-y divide-gray-200 dark:divide-zinc-700">{latestBusinesses.map(biz => {
                        const businessPath = generateBusinessPath(biz);
                        return (
                        <li key={biz.id} className="py-3 sm:py-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                            <div className="min-w-0 flex-1">
                                <Link to={businessPath} className="font-semibold text-base sm:text-lg text-brand-dark dark:text-gray-200 hover:text-brand-green dark:hover:text-brand-green hover:underline line-clamp-2">{biz.name}</Link>
                                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">{t('homepage.addedOn')} {formatDate(biz.created_at)}</p>
                            </div>
                            <Link to={businessPath} className="text-brand-green font-semibold hover:text-green-700 dark:hover:text-green-400 text-xs sm:text-sm flex items-center gap-2 self-end sm:self-center whitespace-nowrap flex-shrink-0">
                                <span>{t('homepage.viewBusiness')}</span>
                                <i className="fa-solid fa-arrow-right"></i>
                            </Link>
                        </li>
                    );})}</ul></div> : <p className="text-center text-sm sm:text-base text-gray-500 dark:text-gray-400">{t('homepage.noNewBusinesses')}</p>}
                    </div>
                </section>

                <section>
                    <div className="text-center max-w-2xl mx-auto px-2"><h2 className="text-xl sm:text-2xl md:text-3xl font-bold dark:text-gray-100">{t('homepage.howItWorksTitle').replace('Opynio', brandName)}</h2><p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-2">{t('homepage.howItWorksSubtitle')}</p></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 sm:gap-6 md:gap-8 max-w-5xl mx-auto mt-8 sm:mt-10 md:mt-12"><div className="bg-white dark:bg-zinc-800 p-5 sm:p-6 md:p-8 rounded-lg sm:rounded-xl shadow-md border dark:border-zinc-700 text-center hover:shadow-xl hover:-translate-y-1 sm:hover:-translate-y-2 transition-all duration-300"><div className="bg-green-100 dark:bg-green-900/50 text-brand-green rounded-full w-16 h-16 sm:w-18 sm:h-18 md:w-20 md:h-20 flex items-center justify-center mb-3 sm:mb-4 mx-auto"><i className="fas fa-search text-2xl sm:text-3xl"></i></div><h3 className="text-base sm:text-lg md:text-xl font-bold mb-2 dark:text-gray-200">{t('homepage.howItWorksStep1Title')}</h3><p className="text-xs sm:text-sm md:text-base text-gray-600 dark:text-gray-400">{t('homepage.howItWorksStep1Desc')}</p></div><div className="bg-white dark:bg-zinc-800 p-5 sm:p-6 md:p-8 rounded-lg sm:rounded-xl shadow-md border dark:border-zinc-700 text-center hover:shadow-xl hover:-translate-y-1 sm:hover:-translate-y-2 transition-all duration-300"><div className="bg-green-100 dark:bg-green-900/50 text-brand-green rounded-full w-16 h-16 sm:w-18 sm:h-18 md:w-20 md:h-20 flex items-center justify-center mb-3 sm:mb-4 mx-auto"><i className="fas fa-comments text-2xl sm:text-3xl"></i></div><h3 className="text-base sm:text-lg md:text-xl font-bold mb-2 dark:text-gray-200">{t('homepage.howItWorksStep2Title')}</h3><p className="text-xs sm:text-sm md:text-base text-gray-600 dark:text-gray-400">{t('homepage.howItWorksStep2Desc')}</p></div><div className="bg-white dark:bg-zinc-800 p-5 sm:p-6 md:p-8 rounded-lg sm:rounded-xl shadow-md border dark:border-zinc-700 text-center hover:shadow-xl hover:-translate-y-1 sm:hover:-translate-y-2 transition-all duration-300 sm:col-span-2 md:col-span-1"><div className="bg-green-100 dark:bg-green-900/50 text-brand-green rounded-full w-16 h-16 sm:w-18 sm:h-18 md:w-20 md:h-20 flex items-center justify-center mb-3 sm:mb-4 mx-auto"><i className="fas fa-pencil-alt text-2xl sm:text-3xl"></i></div><h3 className="text-base sm:text-lg md:text-xl font-bold mb-2 dark:text-gray-200">{t('homepage.howItWorksStep3Title')}</h3><p className="text-xs sm:text-sm md:text-base text-gray-600 dark:text-gray-400">{t('homepage.howItWorksStep3Desc')}</p></div></div>
                </section>

                <section className="mb-8 sm:mb-10 md:mb-12">
                    <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-center mb-6 sm:mb-7 md:mb-8 dark:text-gray-100 px-2">{t('homepage.latestReviewsTitle').replace('Opynio', brandName)}</h2>
                    <div className="min-h-[400px] sm:min-h-[500px]">
                    {loadingReviews ? <div className="flex justify-center items-center h-[400px] sm:h-[500px]"><Spinner /></div> : featuredReviews.length > 0 ? <div className="space-y-4 sm:space-y-5 md:space-y-6 max-w-4xl mx-auto">{featuredReviews.map(review => <ReviewCard key={review.id} review={review} showBusinessName={true} />)}</div> : <p className="text-center text-sm sm:text-base text-gray-500 dark:text-gray-400">{t('homepage.noFeaturedReviews')}</p>}
                    </div>
                </section>
            </div>

            {/* Admin Modal for Managing Featured Companies */}
            {isFeaturedModalOpen && isAdmin && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden">
                        <div className="p-4 border-b border-gray-200 dark:border-zinc-700 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">{t('homepage.manageFeaturedTitle')}</h3>
                            <button
                                onClick={() => setIsFeaturedModalOpen(false)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                            >
                                <i className="fa-solid fa-times text-gray-500"></i>
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Search Input */}
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder={t('homepage.searchBusinesses')}
                                    value={modalSearchTerm}
                                    onChange={(e) => handleModalSearch(e.target.value)}
                                    className="w-full px-4 py-2.5 pl-10 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-brand-green focus:border-transparent"
                                />
                                <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                            </div>

                            {/* Selected Count */}
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                {t('homepage.selectedCount', { count: selectedFeaturedIds.size })}
                            </p>

                            {/* Search Results */}
                            <div className="max-h-[300px] overflow-y-auto space-y-2">
                                {modalBusinessResults.length > 0 ? (
                                    modalBusinessResults.map(biz => {
                                        const isSelected = selectedFeaturedIds.has(biz.id);
                                        const countryInfo = COUNTRIES.find(c => c.code === biz.country);
                                        return (
                                            <button
                                                key={biz.id}
                                                onClick={() => handleToggleFeatured(biz.id)}
                                                className={`w-full p-3 rounded-lg text-left flex items-center gap-3 transition-colors ${
                                                    isSelected
                                                        ? 'bg-brand-green/10 border-2 border-brand-green'
                                                        : 'bg-gray-50 dark:bg-zinc-700 border-2 border-transparent hover:border-gray-300 dark:hover:border-zinc-500'
                                                }`}
                                            >
                                                <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                                                    isSelected ? 'bg-brand-green text-white' : 'bg-gray-200 dark:bg-zinc-600'
                                                }`}>
                                                    {isSelected && <i className="fa-solid fa-check text-xs"></i>}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-gray-800 dark:text-gray-100 truncate">{biz.name}</p>
                                                    {countryInfo && (
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                                            <img src={countryInfo.flag} alt="" className="w-3 h-2 object-cover" />
                                                            {countryInfo.name}
                                                        </p>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })
                                ) : modalSearchTerm.length >= 2 ? (
                                    <p className="text-center text-gray-500 dark:text-gray-400 py-4">{t('homepage.noResultsFound')}</p>
                                ) : (
                                    <p className="text-center text-gray-500 dark:text-gray-400 py-4">{t('homepage.typeToSearch')}</p>
                                )}
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-200 dark:border-zinc-700 flex justify-end gap-3">
                            <button
                                onClick={() => setIsFeaturedModalOpen(false)}
                                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={handleSaveFeatured}
                                disabled={savingFeatured}
                                className="px-4 py-2 bg-brand-green text-white font-semibold rounded-lg hover:bg-brand-green/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {savingFeatured && <Spinner />}
                                {t('common.save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default HomePage;