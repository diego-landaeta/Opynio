import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Business, Sede } from '../../types';
import { getBusinessesForDirectoryPaginated, getTotalBusinessCount } from '../../services/supabaseService';
import Spinner from '../Spinner';
import StarRating from '../StarRating';
import { CATEGORIES, COUNTRIES } from '../../constants';
import Meta from '../Meta';
import { useNotification } from '../../contexts/NotificationContext';
import { useI18n, useTranslation, pathTranslations, getLanguageForCountryCode } from '../../contexts/i18nContext';
import { getDistanceFromLatLonInKm } from '../../utils/geolocation';
import { useCountry } from '../../contexts/CountryContext';
import { generateBusinessPath } from '../../utils/linkUtils';
import { getSubcategoryKey } from '../../utils/categoryMappings';

type SortOrder = 'relevance' | 'alphabetical' | 'rating' | 'reviews';

const BUSINESSES_PER_PAGE = 10;

const BusinessCard: React.FC<{ business: Business }> = ({ business }) => {
    const t = useTranslation();
    const { language } = useI18n();
    const businessPath = generateBusinessPath(business);
    const [imageError, setImageError] = useState(false);

    // Function to translate category
    const getCategoryTranslation = (categoryString: string | null): string => {
        if (!categoryString || categoryString.trim() === '') return t('common.noCategory');

        // Handle "Sin Categoría" / "Sin categoria" special case
        if (categoryString.toLowerCase().includes('sin categor')) {
            return t('common.noCategory');
        }

        // Extract main category and subcategory if format is "Category: Subcategory"
        let mainCategory = categoryString;
        let subCategory = '';

        if (categoryString.includes(':')) {
            [mainCategory, subCategory] = categoryString.split(':');
            mainCategory = mainCategory.trim();
            subCategory = subCategory.trim();
        }

        // Translate main category using i18n
        const translatedMain = t(`categories.${mainCategory}`);
        const mainCategoryTranslated = translatedMain.startsWith('categories.') ? mainCategory : translatedMain;

        // If there's a subcategory, translate it too
        if (subCategory) {
            // Use mapping to get the correct translation key
            // Check if already in snake_case or Spanish format
            const subCategoryKey = subCategory.includes('_') ? subCategory : getSubcategoryKey(subCategory);

            if (subCategoryKey) {
                const translatedSub = t(`subcategories.${subCategoryKey}`);
                const subCategoryTranslated = translatedSub.startsWith('subcategories.') ? subCategory : translatedSub;
                // Return only the subcategory for business cards
                return subCategoryTranslated;
            }

            // Fallback if no mapping found - return only subcategory
            return subCategory;
        }

        return mainCategoryTranslated;
    };

    // Function to translate country name
    const getCountryTranslation = (countryCode: string | null | undefined): string => {
        if (!countryCode) return '';
        const code = countryCode.toUpperCase();
        const translated = t(`countries.${code}`);

        // If translation not found, fallback to COUNTRIES constant
        if (translated.startsWith('countries.')) {
            return COUNTRIES.find(c => c.code === code)?.name || countryCode;
        }

        return translated;
    };

    // Get city from sedes array (city doesn't exist as a direct column)
    const getBusinessCity = (): string => {
        const sedes = business.sedes as Sede[] | undefined;
        if (sedes && Array.isArray(sedes) && sedes.length > 0) {
            return sedes[0]?.city || '';
        }
        return '';
    };

    const businessCity = getBusinessCity();

    return (
        <Link to={businessPath} className="group flex flex-col h-full bg-white dark:bg-zinc-800 rounded-2xl shadow-md border border-gray-200 dark:border-zinc-700 hover:border-brand-green dark:hover:border-brand-green hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
            <div className="p-4 sm:p-5 md:p-6 flex-1">
                <div className="flex items-start gap-4 sm:gap-5">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-xl bg-gray-100 dark:bg-zinc-700 flex-shrink-0 flex items-center justify-center overflow-hidden border border-gray-200 dark:border-zinc-600">
                        {business.logo_url && !imageError ? (
                            <img
                                src={business.logo_url}
                                alt={`${business.name} logo`}
                                className="w-full h-full object-contain p-1.5"
                                onError={() => setImageError(true)}
                            />
                        ) : (
                            <div className="text-gray-400 dark:text-gray-500">
                                <i className="fa-solid fa-store text-3xl sm:text-4xl md:text-5xl"></i>
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                            <h3 className="font-bold text-base sm:text-lg md:text-xl text-gray-900 dark:text-gray-100 group-hover:text-brand-green transition-colors line-clamp-2" title={business.name}>
                                {business.name}
                            </h3>
                            {business.offers_international_services && (
                                <span className="flex-shrink-0 text-xs sm:text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full font-medium">
                                    <i className="fa-solid fa-globe text-xs mr-1"></i>
                                    <span className="hidden sm:inline">{t('businessesPage.international')}</span>
                                </span>
                            )}
                        </div>
                        <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1.5 truncate">
                            {getCategoryTranslation(business.category)}
                        </p>
                        {(businessCity || business.country) && (
                            <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1 truncate">
                                <i className="fa-solid fa-location-dot text-xs mr-1.5"></i>
                                {[
                                    businessCity,
                                    business.country ? getCountryTranslation(business.country) : null
                                ].filter(Boolean).join(', ')}
                            </p>
                        )}
                        {business.description && (
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-2 sm:mt-3 line-clamp-2 leading-relaxed">
                                {business.description}
                            </p>
                        )}
                    </div>
                </div>
            </div>
            <div className="border-t border-gray-100 dark:border-zinc-700 px-4 sm:px-5 md:px-6 py-3 sm:py-4">
                <div className="flex items-center justify-between gap-4 text-sm sm:text-base">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <StarRating rating={business.avg_rating || 0} size="medium" />
                        <span className="font-bold text-lg sm:text-xl text-gray-800 dark:text-gray-200">{(business.avg_rating || 0).toFixed(1)}</span>
                    </div>
                    <span className="text-sm sm:text-base text-gray-500 dark:text-gray-400">{business.review_count || 0} {t('common.reviews')}</span>
                </div>
            </div>
        </Link>
    );
};

const BusinessesPage: React.FC = () => {
    const t = useTranslation();
    const { showNotification } = useNotification();
    const { country } = useCountry();
    const navigate = useNavigate();

    // Business data state
    const [businesses, setBusinesses] = useState<Business[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);

    // Filters
    const [isFiltersVisible, setIsFiltersVisible] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    // Rating filter: null = all, or {min, max} for range (e.g., {min: 3, max: 4} for 3-4 stars)
    const [ratingFilter, setRatingFilter] = useState<{min: number; max: number} | null>(null);
    const [serviceTypeFilter, setServiceTypeFilter] = useState<'all' | 'local' | 'international'>('all');
    const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
    const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
    const countryDropdownRef = useRef<HTMLDivElement>(null);

    // Location filter state
    const [radiusKm, setRadiusKm] = useState<number>(10);
    const [filterCenter, setFilterCenter] = useState<{ lat: number; lng: number } | null>(null);
    const [geolocating, setGeolocating] = useState(false);

    // Sorting
    const [sortOrder, setSortOrder] = useState<SortOrder>('relevance');

    const countryInfo = useMemo(() => COUNTRIES.find(c => c.code === country), [country]);
    const brandName = countryInfo ? `Opynio ${countryInfo.name}` : 'Opynio';
    const metaTitle = `${t('businessesPage.businessesDirectoryTitle')} - ${brandName}`;
    const metaDescription = t('businessesPage.businessesDirectorySubtitle').replace('Opynio', brandName);
    const businessesTitle = t('businessesPage.businessesDirectoryTitle').replace('Opynio', brandName);

    // Debounce search term
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Fetch businesses with pagination
    const fetchBusinesses = useCallback(async (pageNum: number, append: boolean = false) => {
        setLoading(true);

        try {
            const filters = {
                searchTerm: debouncedSearchTerm || undefined,
                category: selectedCategory || undefined,
                countries: selectedCountries.length > 0 ? selectedCountries : undefined,
                serviceType: serviceTypeFilter,
                sortOrder: sortOrder,
            };

            const result = await getBusinessesForDirectoryPaginated(pageNum, BUSINESSES_PER_PAGE, filters);

            // Apply client-side filters that can't be done in DB (location, rating)
            let filteredBusinesses = result.businesses;

            if (ratingFilter) {
                filteredBusinesses = filteredBusinesses.filter(b => {
                    const rating = b.avg_rating || 0;
                    return rating >= ratingFilter.min && rating <= ratingFilter.max;
                });
            }

            if (filterCenter) {
                filteredBusinesses = filteredBusinesses.filter(b => {
                    if (!b.latitude || !b.longitude) return false;
                    const distance = getDistanceFromLatLonInKm(filterCenter.lat, filterCenter.lng, b.latitude, b.longitude);
                    return distance <= radiusKm;
                });
            }

            setBusinesses(filteredBusinesses);
            // Use filtered count when client-side filters are applied, otherwise use DB count
            const hasClientSideFilters = ratingFilter !== null || filterCenter;
            setTotalCount(hasClientSideFilters ? filteredBusinesses.length : result.totalCount);
        } catch (error: any) {
            showNotification(error.message || t('businessesPage.errorLoading') || 'Error loading businesses', 'error');
        } finally {
            setLoading(false);
        }
    }, [debouncedSearchTerm, selectedCategory, selectedCountries, serviceTypeFilter, sortOrder, ratingFilter, filterCenter, radiusKm, showNotification, t]);

    // Fetch initial total count (only when no client-side filters are active)
    // When ratingFilter or filterCenter are active, the count is set by fetchBusinesses
    useEffect(() => {
        // Skip if client-side filters are active - fetchBusinesses will set the count
        if (ratingFilter !== null || filterCenter) return;

        const fetchTotalCount = async () => {
            try {
                const count = await getTotalBusinessCount({
                    searchTerm: debouncedSearchTerm || undefined,
                    category: selectedCategory || undefined,
                    countries: selectedCountries.length > 0 ? selectedCountries : undefined,
                    serviceType: serviceTypeFilter,
                });
                setTotalCount(count);
            } catch (error) {
                console.error('Error fetching total count:', error);
            }
        };
        fetchTotalCount();
    }, [debouncedSearchTerm, selectedCategory, selectedCountries, serviceTypeFilter, ratingFilter, filterCenter]);

    // Fetch businesses when filters change
    useEffect(() => {
        setPage(1);
        fetchBusinesses(1, false);
    }, [debouncedSearchTerm, selectedCategory, selectedCountries, serviceTypeFilter, sortOrder, ratingFilter, filterCenter, radiusKm]);

    // Close country dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target as Node)) {
                setIsCountryDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Calculate total pages
    const totalPages = Math.max(1, Math.ceil(totalCount / BUSINESSES_PER_PAGE));

    // Navigate to a specific page
    const goToPage = (newPage: number) => {
        if (newPage < 1 || newPage > totalPages || loading) return;
        setPage(newPage);
        fetchBusinesses(newPage, false);
        // Scroll to top of main content
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Pagination controls component (reusable for top and bottom)
    const PaginationControls = () => {
        if (totalCount === 0) return null;

        const startItem = (page - 1) * BUSINESSES_PER_PAGE + 1;
        const endItem = Math.min(page * BUSINESSES_PER_PAGE, totalCount);

        return (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border dark:border-zinc-700">
                {/* Page info */}
                <div className="text-sm sm:text-base text-gray-600 dark:text-gray-400 text-center sm:text-left">
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{startItem}-{endItem}</span>
                    <span> {t('businessesPage.of')} </span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{totalCount}</span>
                    <span> {t('common.businesses')}</span>
                </div>

                {/* Navigation buttons */}
                <div className="flex items-center gap-2 sm:gap-3">
                    <button
                        onClick={() => goToPage(page - 1)}
                        disabled={page === 1 || loading}
                        className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg font-semibold text-sm sm:text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 hover:border-brand-green hover:text-brand-green dark:hover:border-brand-green"
                    >
                        <i className="fa-solid fa-chevron-left text-xs"></i>
                        <span className="hidden sm:inline">{t('businessesPage.previous')}</span>
                    </button>

                    {/* Page indicator */}
                    <div className="flex items-center gap-1 px-3 sm:px-4 py-2 sm:py-2.5 bg-brand-green/10 rounded-lg">
                        <span className="font-bold text-brand-green text-sm sm:text-base">{page}</span>
                        <span className="text-gray-500 dark:text-gray-400 text-sm">/</span>
                        <span className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">{totalPages}</span>
                    </div>

                    <button
                        onClick={() => goToPage(page + 1)}
                        disabled={page === totalPages || loading}
                        className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg font-semibold text-sm sm:text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-brand-green text-white hover:bg-opacity-90 shadow-md"
                    >
                        <span className="hidden sm:inline">{t('businessesPage.next')}</span>
                        <i className="fa-solid fa-chevron-right text-xs"></i>
                    </button>
                </div>
            </div>
        );
    };

    const handleClearFilters = () => {
        setSearchTerm('');
        setSelectedCategory(null);
        setRatingFilter(null);
        setServiceTypeFilter('all');
        setFilterCenter(null);
        setSelectedCountries([]);
        setSortOrder('relevance');
    };

    const handleUseMyLocation = () => {
        if (!navigator.geolocation) {
            showNotification(t("explorePage.geolocationNotSupported"), "error");
            return;
        }
        setGeolocating(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setFilterCenter({ lat: position.coords.latitude, lng: position.coords.longitude });
                setGeolocating(false);
            },
            () => {
                showNotification(t("explorePage.couldNotGetLocation"), "error");
                setGeolocating(false);
            },
            { timeout: 5000, enableHighAccuracy: true }
        );
    };

    const handleCountrySelectionChange = (countryCode: string) => {
        setSelectedCountries(prev =>
            prev.includes(countryCode)
                ? prev.filter(c => c !== countryCode)
                : [...prev, countryCode]
        );
    };

    return (
        <>
            <Meta title={metaTitle} description={metaDescription} />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
                <aside className="lg:col-span-3">
                    <div className="sticky top-24 bg-white dark:bg-zinc-800 p-4 sm:p-5 md:p-6 rounded-xl shadow-md border dark:border-zinc-700 space-y-4 sm:space-y-5 md:space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-base sm:text-lg font-bold">{t('common.filters')}</h2>
                            <button onClick={() => setIsFiltersVisible(!isFiltersVisible)} className="lg:hidden text-brand-green text-xs sm:text-sm font-semibold">
                                {isFiltersVisible ? t('businessesPage.hideFilters') : t('businessesPage.showFilters')}
                            </button>
                        </div>
                        <div className={`${isFiltersVisible ? 'block' : 'hidden'} lg:block space-y-4 sm:space-y-5 md:space-y-6`}>
                            <div>
                                <label htmlFor="search" className="block text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1 sm:mb-2">{t('businessesPage.searchByName')}</label>
                                <input id="search" type="text" placeholder={t('businessesPage.searchByName')}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-md p-2 text-xs sm:text-sm" />
                            </div>

                            <div ref={countryDropdownRef} className="relative">
                                <label className="block text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1 sm:mb-2">{t('adminDashboard.country')}</label>
                                <button
                                    type="button"
                                    onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
                                    className="w-full bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-md p-2 text-left h-[38px] flex justify-between items-center"
                                >
                                    <span className="text-sm truncate">
                                        {selectedCountries.length === 0 ? t('common.all') : t('businessesPage.countriesSelected', { count: selectedCountries.length })}
                                    </span>
                                    <i className={`fa-solid fa-chevron-down transition-transform text-gray-400 ${isCountryDropdownOpen ? 'rotate-180' : ''}`}></i>
                                </button>
                                {isCountryDropdownOpen && (
                                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-md shadow-lg p-2 space-y-1 max-h-60 overflow-y-auto">
                                        {COUNTRIES.map(c => (
                                            <label key={c.code} className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-700 cursor-pointer text-gray-800 dark:text-white">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedCountries.includes(c.code)}
                                                    onChange={() => handleCountrySelectionChange(c.code)}
                                                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-zinc-900 text-brand-green focus:ring-brand-green"
                                                />
                                                <img src={c.flag} alt={c.name} width={20} height={20} loading="lazy" decoding="async" className="w-5 h-5 rounded-full" />
                                                <span className="capitalize text-sm">{c.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>


                            <div>
                                <label htmlFor="category" className="block text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1 sm:mb-2">{t('common.category')}</label>
                                <select id="category" value={selectedCategory || ''} onChange={e => setSelectedCategory(e.target.value || null)} className="w-full bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-md p-2 text-xs sm:text-sm">
                                    <option value="">{t('common.allCategories')}</option>
                                    {Object.keys(CATEGORIES).map(cat => <option key={cat} value={cat}>{t(`categories.${cat}`)}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1 sm:mb-2">{t('explorePage.ratingRange') || 'Valoración'}</label>
                                <div className="grid grid-cols-3 gap-1.5 mb-1.5">
                                    <button
                                        onClick={() => setRatingFilter(null)}
                                        className={`p-2 rounded-lg text-xs font-semibold transition-all ${ratingFilter === null ? 'bg-brand-green text-white shadow-md' : 'bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-600'}`}
                                    >
                                        {t('common.all')}
                                    </button>
                                    <button
                                        onClick={() => setRatingFilter({min: 5, max: 5})}
                                        className={`p-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 ${ratingFilter?.min === 5 && ratingFilter?.max === 5 ? 'bg-yellow-500 text-white shadow-md' : 'bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-600'}`}
                                    >
                                        5 <i className="fa-solid fa-star text-[10px]"></i>
                                    </button>
                                    <button
                                        onClick={() => setRatingFilter({min: 4, max: 4.9})}
                                        className={`p-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 ${ratingFilter?.min === 4 && ratingFilter?.max === 4.9 ? 'bg-yellow-500 text-white shadow-md' : 'bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-600'}`}
                                    >
                                        4 <i className="fa-solid fa-star text-[10px]"></i>
                                    </button>
                                </div>
                                <div className="grid grid-cols-3 gap-1.5">
                                    <button
                                        onClick={() => setRatingFilter({min: 3, max: 3.9})}
                                        className={`p-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 ${ratingFilter?.min === 3 && ratingFilter?.max === 3.9 ? 'bg-yellow-500 text-white shadow-md' : 'bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-600'}`}
                                    >
                                        3 <i className="fa-solid fa-star text-[10px]"></i>
                                    </button>
                                    <button
                                        onClick={() => setRatingFilter({min: 1, max: 2.9})}
                                        className={`p-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 ${ratingFilter?.min === 1 && ratingFilter?.max === 2.9 ? 'bg-orange-500 text-white shadow-md' : 'bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-600'}`}
                                    >
                                        1-2 <i className="fa-solid fa-star text-[10px]"></i>
                                    </button>
                                    <button
                                        onClick={() => setRatingFilter({min: 1, max: 3.9})}
                                        className={`p-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 ${ratingFilter?.min === 1 && ratingFilter?.max === 3.9 ? 'bg-orange-500 text-white shadow-md' : 'bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-600'}`}
                                    >
                                        1-3 <i className="fa-solid fa-star text-[10px]"></i>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1 sm:mb-2">{t('businessesPage.locationFilter')}</label>
                                <button onClick={handleUseMyLocation} disabled={geolocating} className="w-full flex items-center justify-center gap-2 bg-brand-green/10 text-brand-green font-semibold py-2 px-3 rounded-lg hover:bg-brand-green/20 transition-colors disabled:opacity-50 text-xs sm:text-sm">
                                    {geolocating ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div> : <i className="fa-solid fa-location-crosshairs"></i>}
                                    <span>{t('businessesPage.nearMeGPS')}</span>
                                </button>
                                {filterCenter && (
                                    <div className="mt-3 space-y-2 text-xs">
                                        <div className="flex items-center justify-between"><span>{t('businessesPage.searchRadius')}:</span> <span className="font-bold">{radiusKm} km</span></div>
                                        <input type="range" min="1" max="100" value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} className="w-full accent-brand-green" />
                                        <button onClick={() => setFilterCenter(null)} className="text-red-500 hover:underline font-semibold">{t('businessesPage.clearLocation')}</button>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1 sm:mb-2">{t('common.serviceType')}</label>
                                <div className="flex rounded-md border dark:border-zinc-600">
                                    <button onClick={() => setServiceTypeFilter('all')} className={`flex-1 p-1.5 text-[10px] sm:text-xs rounded-l-md ${serviceTypeFilter === 'all' ? 'bg-brand-green text-white' : 'hover:bg-gray-100 dark:hover:bg-zinc-700'}`}>{t('common.all')}</button>
                                    <button onClick={() => setServiceTypeFilter('local')} className={`flex-1 p-1.5 text-[10px] sm:text-xs border-l border-r dark:border-zinc-600 ${serviceTypeFilter === 'local' ? 'bg-brand-green text-white' : 'hover:bg-gray-100 dark:hover:bg-zinc-700'}`}>{t('businessesPage.local')}</button>
                                    <button onClick={() => setServiceTypeFilter('international')} className={`flex-1 p-1.5 text-[10px] sm:text-xs rounded-r-md ${serviceTypeFilter === 'international' ? 'bg-brand-green text-white' : 'hover:bg-gray-100 dark:hover:bg-zinc-700'}`}>{t('businessesPage.international')}</button>
                                </div>
                            </div>

                            <div>
                                <label htmlFor="sort-order" className="block text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1 sm:mb-2">{t('businessesPage.sortBy')}</label>
                                <select id="sort-order" value={sortOrder} onChange={e => setSortOrder(e.target.value as SortOrder)} className="w-full bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-md p-2 text-xs sm:text-sm">
                                    <option value="relevance">{t('businessesPage.sortRelevance')}</option>
                                    <option value="alphabetical">{t('businessesPage.sortAlphabetical')}</option>
                                    <option value="rating">{t('businessesPage.sortRating')}</option>
                                    <option value="reviews">{t('businessesPage.sortReviews')}</option>
                                </select>
                            </div>

                            <button onClick={handleClearFilters} className="w-full text-xs sm:text-sm text-gray-600 dark:text-gray-300 hover:text-brand-green font-semibold pt-3 sm:pt-4 border-t dark:border-zinc-700">
                                {t('businessesPage.clearAllFilters')}
                            </button>
                        </div>
                    </div>
                </aside>

                <main className="lg:col-span-9">
                    <div className="mb-6 sm:mb-8">
                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-gray-100">{businessesTitle}</h1>
                        <p className="text-sm sm:text-base md:text-lg text-gray-500 dark:text-gray-400 mt-1 sm:mt-2">
                            {t('businessesPage.businessesFound', { count: totalCount })}
                        </p>
                    </div>

                    {/* Progress indicator - shows pagination progress */}
                    {!loading && totalCount > 0 && (
                        <div className="mb-6 sm:mb-8 p-4 sm:p-5 rounded-xl bg-gradient-to-r from-brand-green/5 to-blue-50 dark:from-brand-green/10 dark:to-blue-900/20 border border-brand-green/20 dark:border-brand-green/30">
                            <div className="flex items-center justify-between mb-2 sm:mb-3">
                                <span className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300">
                                    <i className="fa-solid fa-building mr-2 text-brand-green"></i>
                                    {t('businessesPage.showingBusinesses', {
                                        showing: Math.min(page * BUSINESSES_PER_PAGE, totalCount),
                                        total: totalCount
                                    })}
                                </span>
                                <span className="text-xs sm:text-sm font-bold text-brand-green">
                                    {t('businessesPage.pageOf', { page, totalPages })}
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-2.5 sm:h-3">
                                <div
                                    className="bg-brand-green h-2.5 sm:h-3 rounded-full transition-all duration-500 ease-out"
                                    style={{ width: `${(page / totalPages) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                    )}

                    {/* Filter badges - show active filters */}
                    {(selectedCountries.length > 0 || selectedCategory || ratingFilter !== null || serviceTypeFilter !== 'all' || filterCenter) && (
                        <div className="mb-4 sm:mb-6 flex flex-wrap items-center gap-2">
                            <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{t('businessesPage.activeFilters')}:</span>
                            {selectedCountries.map(code => {
                                const countryData = COUNTRIES.find(c => c.code === code);
                                return countryData && (
                                    <span key={code} className="inline-flex items-center gap-1 text-xs sm:text-sm px-2 py-1 rounded-full bg-brand-green/10 text-brand-green">
                                        <img src={countryData.flag} alt={countryData.name} className="w-4 h-3 rounded-sm" />
                                        {countryData.name}
                                        <button onClick={() => handleCountrySelectionChange(code)} className="ml-1 hover:text-red-500">
                                            <i className="fa-solid fa-times text-xs"></i>
                                        </button>
                                    </span>
                                );
                            })}
                            {selectedCategory && (
                                <span className="inline-flex items-center gap-1 text-xs sm:text-sm px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                                    {t(`categories.${selectedCategory}`)}
                                    <button onClick={() => setSelectedCategory(null)} className="ml-1 hover:text-red-500">
                                        <i className="fa-solid fa-times text-xs"></i>
                                    </button>
                                </span>
                            )}
                            {ratingFilter && (
                                <span className="inline-flex items-center gap-1 text-xs sm:text-sm px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400">
                                    {ratingFilter.min === ratingFilter.max ? ratingFilter.min : `${ratingFilter.min}-${Math.floor(ratingFilter.max)}`} <i className="fa-solid fa-star text-xs"></i>
                                    <button onClick={() => setRatingFilter(null)} className="ml-1 hover:text-red-500">
                                        <i className="fa-solid fa-times text-xs"></i>
                                    </button>
                                </span>
                            )}
                            {serviceTypeFilter !== 'all' && (
                                <span className="inline-flex items-center gap-1 text-xs sm:text-sm px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                    {serviceTypeFilter === 'local' ? t('businessesPage.local') : t('businessesPage.international')}
                                    <button onClick={() => setServiceTypeFilter('all')} className="ml-1 hover:text-red-500">
                                        <i className="fa-solid fa-times text-xs"></i>
                                    </button>
                                </span>
                            )}
                            {filterCenter && (
                                <span className="inline-flex items-center gap-1 text-xs sm:text-sm px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                                    <i className="fa-solid fa-location-dot text-xs"></i> {radiusKm}km
                                    <button onClick={() => setFilterCenter(null)} className="ml-1 hover:text-red-500">
                                        <i className="fa-solid fa-times text-xs"></i>
                                    </button>
                                </span>
                            )}
                        </div>
                    )}

                    {loading ? (
                        <div className="flex justify-center items-center h-96"><Spinner /></div>
                    ) : businesses.length > 0 ? (
                        <div className="space-y-5 sm:space-y-6">
                            {/* Pagination controls - TOP */}
                            <PaginationControls />

                            {/* Grid with larger cards - 2 columns on desktop, 1 on mobile */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 md:gap-8">
                                {businesses.map(biz => (
                                    <BusinessCard key={biz.id} business={biz} />
                                ))}
                            </div>

                            {/* Pagination controls - BOTTOM */}
                            <PaginationControls />
                        </div>
                    ) : (
                        <div className="text-center py-12 sm:py-16 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-800/50 rounded-lg px-4">
                            <i className="fa-solid fa-store-slash text-4xl sm:text-5xl md:text-6xl mb-3 sm:mb-4 text-gray-400 dark:text-gray-600"></i>
                            <p className="font-semibold text-base sm:text-lg">{t('businessesPage.noBusinessesFound')}</p>
                            <p className="text-xs sm:text-sm mt-1">{t('businessesPage.tryChangingSearchOrFilters')}</p>
                        </div>
                    )}
                </main>
            </div>
        </>
    );
};

export default BusinessesPage;
