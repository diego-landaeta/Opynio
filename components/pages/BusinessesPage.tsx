import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { Business, Sede } from '../../types';
import { getBusinessesForDirectoryPaginated } from '../../services/supabaseService';
import Spinner from '../Spinner';
import BusinessLogo from '../BusinessLogo';
import OwnBusinessBadge from '../OwnBusinessBadge';
import StarRating from '../StarRating';
import { CATEGORIES, COUNTRIES } from '../../constants';
import Meta from '../Meta';
import { useNotification } from '../../contexts/NotificationContext';
import { useI18n, useTranslation, useAutoTranslation, pathTranslations, getLanguageForCountryCode } from '../../contexts/i18nContext';
import { getDistanceFromLatLonInKm } from '../../utils/geolocation';
import { useContentCountry } from '../../contexts/CountryContext';
import ForeignCountryNotice from '../ForeignCountryNotice';
import { generateBusinessPath } from '../../utils/linkUtils';
import { getSubcategoryKey } from '../../utils/categoryMappings';
import { usePluralT } from '../../utils/plural';
import { useCountryName } from '../../utils/countryName';
import { useUserErrorNotifier } from '../../utils/userFacingError';
import { countriesSharingLanguage } from '../../utils/languageAffinity';

type SortOrder = 'relevance' | 'alphabetical' | 'rating' | 'reviews';

const BUSINESSES_PER_PAGE = 10;

const BusinessCard: React.FC<{ business: Business; homeCountry?: string | null }> = ({ business, homeCountry }) => {
    const t = useTranslation();
    const { language } = useI18n();
    const countryNameOf = useCountryName();
    const businessPath = generateBusinessPath(business);
    const [imageError, setImageError] = useState(false);
    const { text: translatedDescription, isTranslating: isTranslatingDesc } = useAutoTranslation(business.description);

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
    // Clave del locale, si no Intl.DisplayNames, si no el nombre de COUNTRIES.
    const getCountryTranslation = (countryCode: string | null | undefined): string => {
        if (!countryCode) return '';
        const code = countryCode.toUpperCase();
        return countryNameOf(code, COUNTRIES.find(c => c.code === code)?.name || countryCode);
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
    // Empresa de otro país en el directorio de este (p. ej. una internacional
    // de Portugal en /es/empresas): bandera + «Empresa de Portugal».
    const isForeign = !!homeCountry && !!business.country && business.country.toUpperCase() !== homeCountry;
    const foreignInfo = isForeign ? COUNTRIES.find(c => c.code === business.country!.toUpperCase()) : null;

    return (
        <Link to={businessPath} className="group flex flex-col h-full bg-white dark:bg-zinc-800 rounded-2xl shadow-md border border-gray-200 dark:border-zinc-700 hover:border-brand-green dark:hover:border-brand-green hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
            <div className="p-4 sm:p-5 md:p-6 flex-1">
                <div className="flex items-start gap-4 sm:gap-5">
                    <BusinessLogo
                        logoUrl={business.logo_url}
                        businessName={business.name}
                        tone={business.logo_tone}
                        className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24"
                        rounded="rounded-xl"
                        padding="p-1.5"
                        iconSize="text-3xl sm:text-4xl md:text-5xl"
                        width={96}
                        height={96}
                    />
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
                        {/* La tarjeta entera ya es un enlace: el badge va sin enlace. */}
                        <OwnBusinessBadge business={business} className="mt-1.5" />
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
                        {isForeign && (
                            <span className="inline-flex items-center gap-1.5 mt-1.5 text-xs font-medium text-blue-800 dark:text-blue-200 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
                                {foreignInfo && <img src={foreignInfo.flag} alt="" width={16} height={12} loading="lazy" decoding="async" className="w-4 h-3 rounded-sm object-cover" />}
                                {t('common.businessFromCountry', { country: getCountryTranslation(business.country) })}
                            </span>
                        )}
                        {business.description && (
                            <p className={`text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-2 sm:mt-3 line-clamp-2 leading-relaxed transition-opacity duration-300 ${isTranslatingDesc ? 'opacity-50' : ''}`}>
                                {translatedDescription}
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
                    <span className="text-sm sm:text-base text-gray-500 dark:text-gray-400">{business.review_count || 0} {(business.review_count || 0) === 1 ? t('common.review') : t('common.reviews')}</span>
                </div>
            </div>
        </Link>
    );
};

const BusinessesPage: React.FC = () => {
    const t = useTranslation();
    const tn = usePluralT();
    const { showNotification } = useNotification();
    const { notifyError } = useUserErrorNotifier();
    // País del directorio: el de la URL (/es/empresas) o el de búsqueda del
    // usuario. El filtro lateral no elige otro país: solo amplía a «todos los
    // países». Antes arrancaba en «Todas» mientras la cabecera decía España.
    const { contentCountry } = useContentCountry();
    const countryNameOf = useCountryName();

    // Business data state
    const [businesses, setBusinesses] = useState<Business[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);

    // Filters - IMPORTANTE: Los filtros se mantienen en estado local React
    // NO se sincronizan con la URL para evitar indexación de miles de combinaciones de filtros
    // Esto mejora SEO al prevenir URLs dinámicas duplicadas
    const [isFiltersVisible, setIsFiltersVisible] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    // Rating filter: null = all, or {min, max} for range (e.g., {min: 3, max: 4} for 3-4 stars)
    const [ratingFilter, setRatingFilter] = useState<{min: number; max: number} | null>(null);
    const [serviceTypeFilter, setServiceTypeFilter] = useState<'all' | 'local' | 'international'>('all');
    const [scopeAllCountries, setScopeAllCountries] = useState(false);
    const directoryCountry: string | undefined = scopeAllCountries ? undefined : (contentCountry || undefined);
    // Orden «Relevancia» por afinidad (solo ordena, no filtra): primero el país
    // de búsqueda del usuario, luego los países de su idioma de interfaz, luego
    // el resto. Con un país elegido ese país ya es el primer grupo; con «Todos
    // los países» hay que decirle al servidor cuál es el del usuario.
    const { language } = useI18n();
    const languageCountries = useMemo(() => countriesSharingLanguage(language), [language]);
    const homeCountry: string | undefined = scopeAllCountries ? (contentCountry || undefined) : undefined;

    // Location filter state
    const [radiusKm, setRadiusKm] = useState<number>(10);
    const [filterCenter, setFilterCenter] = useState<{ lat: number; lng: number } | null>(null);
    const [geolocating, setGeolocating] = useState(false);

    // Sorting
    const [sortOrder, setSortOrder] = useState<SortOrder>('relevance');

    // Debounced rating filter to avoid too many API calls while dragging slider
    const [debouncedRatingFilter, setDebouncedRatingFilter] = useState<{min: number; max: number} | null>(null);

    // Request counter to prevent stale updates from old requests
    const requestIdRef = useRef(0);

    const countryInfo = useMemo(() => COUNTRIES.find(c => c.code === directoryCountry), [directoryCountry]);
    const brandName = countryInfo ? `Opynio ${countryInfo.name}` : 'Opynio';
    const contentCountryName = contentCountry
        ? countryNameOf(contentCountry, COUNTRIES.find(c => c.code === contentCountry)?.name || contentCountry)
        : '';

    // Otra página de país: vuelve al ámbito de ese país.
    useEffect(() => { setScopeAllCountries(false); }, [contentCountry]);
    const metaTitle = `${t('businessesPage.businessesDirectoryTitle')} - ${brandName}`;
    const metaDescription = t('businessesPage.businessesDirectorySubtitle').replace('Opynio', brandName);
    const businessesTitle = t('businessesPage.businessesDirectoryTitle').replace('Opynio', brandName);

    // Detectar si hay filtros activos para SEO (noindex)
    // Si hay filtros activos, no indexar para evitar miles de combinaciones de URLs
    const hasActiveFilters = useMemo(() => {
        return !!(
            debouncedSearchTerm ||
            selectedCategory ||
            scopeAllCountries ||
            (ratingFilter && (ratingFilter.min !== 1 || ratingFilter.max !== 5)) ||
            serviceTypeFilter !== 'all' ||
            filterCenter
        );
    }, [debouncedSearchTerm, selectedCategory, scopeAllCountries, ratingFilter, serviceTypeFilter, filterCenter]);

    // Debounce search term
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Debounce rating filter to avoid too many API calls while dragging slider
    // Using 500ms to give more time between requests
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedRatingFilter(ratingFilter);
        }, 500);
        return () => clearTimeout(timer);
    }, [ratingFilter]);

    // Fetch businesses with pagination
    const fetchBusinesses = useCallback(async (pageNum: number, append: boolean = false) => {
        // Increment request ID to track this request
        const currentRequestId = ++requestIdRef.current;

        setLoading(true);

        try {
            // Check if rating filter is active (not full range 1-5)
            const hasRatingFilter = debouncedRatingFilter && (debouncedRatingFilter.min !== 1 || debouncedRatingFilter.max !== 5);

            const filters = {
                searchTerm: debouncedSearchTerm || undefined,
                category: selectedCategory || undefined,
                country: directoryCountry,
                serviceType: serviceTypeFilter,
                sortOrder: sortOrder,
                homeCountry,
                languageCountries,
                // Pass rating filter to API (only if active)
                minRating: hasRatingFilter ? debouncedRatingFilter.min : undefined,
                maxRating: hasRatingFilter ? debouncedRatingFilter.max : undefined,
            };

            const result = await getBusinessesForDirectoryPaginated(pageNum, BUSINESSES_PER_PAGE, filters);

            // Check if a newer request was made - if so, discard this result
            if (currentRequestId !== requestIdRef.current) {
                console.log(`⏭️ Discarding stale request ${currentRequestId}, current is ${requestIdRef.current}`);
                return;
            }

            // Apply client-side filters that can't be done in DB (only location now)
            // Rating filter is now handled by the API
            let filteredBusinesses = result.businesses;

            if (filterCenter) {
                filteredBusinesses = filteredBusinesses.filter(b => {
                    if (!b.latitude || !b.longitude) return false;
                    const distance = getDistanceFromLatLonInKm(filterCenter.lat, filterCenter.lng, b.latitude, b.longitude);
                    return distance <= radiusKm;
                });
            }

            // Double-check before updating state
            if (currentRequestId !== requestIdRef.current) {
                return;
            }

            setBusinesses(filteredBusinesses);
            // Use filtered count when location filter is applied, otherwise use API count
            // Rating filter count is now handled by the API
            setTotalCount(filterCenter ? filteredBusinesses.length : result.totalCount);
        } catch (error: any) {
            // Don't show error if this is a stale request
            if (currentRequestId !== requestIdRef.current) {
                return;
            }
            // Traducido (sin red, servicio caido...); nunca el texto de PostgREST.
            await notifyError(error, { fallbackKey: 'businessesPage.errorLoading' });
        } finally {
            // Only set loading to false if this is still the current request
            if (currentRequestId === requestIdRef.current) {
                setLoading(false);
            }
        }
    }, [debouncedSearchTerm, selectedCategory, directoryCountry, serviceTypeFilter, sortOrder, homeCountry, languageCountries, debouncedRatingFilter, filterCenter, radiusKm, notifyError]);

    // El total llega con cada página (la misma consulta que el listado), así
    // que no hay un conteo aparte que pueda desfasarse de lo que se pagina.

    // Fetch businesses when filters change
    // Uses debouncedRatingFilter to avoid too many API calls while dragging slider
    useEffect(() => {
        setPage(1);
        fetchBusinesses(1, false);
    }, [debouncedSearchTerm, selectedCategory, directoryCountry, serviceTypeFilter, sortOrder, homeCountry, languageCountries, debouncedRatingFilter, filterCenter, radiusKm]);


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
                    <span> {totalCount === 1 ? t('common.business') : t('common.businesses')}</span>
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
        setScopeAllCountries(false);
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


    return (
        <>
            <Meta
                title={metaTitle}
                description={metaDescription}
                noindex={hasActiveFilters}
            />
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

                            <div>
                                <label htmlFor="directory-country" className="block text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1 sm:mb-2">{t('adminDashboard.country')}</label>
                                <select
                                    id="directory-country"
                                    value={directoryCountry ? 'country' : 'all'}
                                    onChange={e => setScopeAllCountries(e.target.value === 'all')}
                                    disabled={!contentCountry}
                                    aria-describedby="directory-country-hint"
                                    className="w-full bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-md p-2 text-xs sm:text-sm h-[38px] disabled:cursor-not-allowed"
                                >
                                    {contentCountry && <option value="country">{contentCountryName}</option>}
                                    <option value="all">{t('common.allCountries')}</option>
                                </select>
                                <p id="directory-country-hint" className="mt-1 text-[11px] leading-snug text-gray-500 dark:text-gray-400">
                                    {t('common.changeCountryInHeader')}
                                </p>
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
                                {/* Mostrar el rango seleccionado */}
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-1 text-sm font-bold text-yellow-500">
                                        <span>{ratingFilter?.min?.toFixed(1) || '1.0'}</span>
                                        <i className="fa-solid fa-star text-xs"></i>
                                    </div>
                                    <span className="text-gray-400 text-xs">—</span>
                                    <div className="flex items-center gap-1 text-sm font-bold text-yellow-500">
                                        <span>{ratingFilter?.max?.toFixed(1) || '5.0'}</span>
                                        <i className="fa-solid fa-star text-xs"></i>
                                    </div>
                                </div>
                                {/* Dual range slider */}
                                <div className="relative h-6 mb-2 mt-1">
                                    {/* Track background */}
                                    <div className="absolute top-1/2 -translate-y-1/2 w-full h-2 bg-gray-200 dark:bg-zinc-700 rounded-full"></div>
                                    {/* Active track */}
                                    <div
                                        className="absolute top-1/2 -translate-y-1/2 h-2 bg-yellow-500 rounded-full"
                                        style={{
                                            left: `${((ratingFilter?.min || 1) - 1) / 4 * 100}%`,
                                            right: `${(5 - (ratingFilter?.max || 5)) / 4 * 100}%`
                                        }}
                                    ></div>
                                    {/* Min slider */}
                                    <input
                                        type="range"
                                        min="1"
                                        max="5"
                                        step="0.1"
                                        value={ratingFilter?.min || 1}
                                        onChange={(e) => {
                                            const newMin = parseFloat(e.target.value);
                                            const currentMax = ratingFilter?.max || 5;
                                            if (newMin <= currentMax) {
                                                setRatingFilter({ min: newMin, max: currentMax });
                                            }
                                        }}
                                        className="absolute top-0 w-full h-6 appearance-none bg-transparent pointer-events-auto cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-yellow-500 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-transform [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:bg-yellow-500 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:cursor-pointer"
                                        style={{ zIndex: ratingFilter?.min === ratingFilter?.max ? 5 : 3 }}
                                    />
                                    {/* Max slider */}
                                    <input
                                        type="range"
                                        min="1"
                                        max="5"
                                        step="0.1"
                                        value={ratingFilter?.max || 5}
                                        onChange={(e) => {
                                            const newMax = parseFloat(e.target.value);
                                            const currentMin = ratingFilter?.min || 1;
                                            if (newMax >= currentMin) {
                                                setRatingFilter({ min: currentMin, max: newMax });
                                            }
                                        }}
                                        className="absolute top-0 w-full h-6 appearance-none bg-transparent pointer-events-auto cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-yellow-500 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-transform [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:bg-yellow-500 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:cursor-pointer"
                                        style={{ zIndex: 4 }}
                                    />
                                </div>
                                {/* Scale labels */}
                                <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 px-1">
                                    <span>1</span>
                                    <span>2</span>
                                    <span>3</span>
                                    <span>4</span>
                                    <span>5</span>
                                </div>
                                {/* Reset button */}
                                {ratingFilter && (ratingFilter.min !== 1 || ratingFilter.max !== 5) && (
                                    <button
                                        onClick={() => setRatingFilter(null)}
                                        className="mt-2 text-xs text-red-500 hover:text-red-600 hover:underline font-semibold flex items-center gap-1"
                                    >
                                        <i className="fa-solid fa-rotate-left text-[10px]"></i> Restablecer
                                    </button>
                                )}
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
                                <span id="service-scope-label" className="block text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1 sm:mb-2">{t('businessesPage.serviceScope')}</span>
                                <div role="group" aria-labelledby="service-scope-label" aria-describedby="service-scope-help" className="flex rounded-md border dark:border-zinc-600">
                                    <button type="button" aria-pressed={serviceTypeFilter === 'all'} onClick={() => setServiceTypeFilter('all')} className={`flex-1 p-1.5 text-[10px] sm:text-xs rounded-l-md ${serviceTypeFilter === 'all' ? 'bg-brand-green text-white' : 'hover:bg-gray-100 dark:hover:bg-zinc-700'}`}>{t('common.all')}</button>
                                    <button type="button" aria-pressed={serviceTypeFilter === 'local'} onClick={() => setServiceTypeFilter('local')} className={`flex-1 p-1.5 text-[10px] sm:text-xs border-l border-r dark:border-zinc-600 ${serviceTypeFilter === 'local' ? 'bg-brand-green text-white' : 'hover:bg-gray-100 dark:hover:bg-zinc-700'}`}>{t('businessesPage.local')}</button>
                                    <button type="button" aria-pressed={serviceTypeFilter === 'international'} onClick={() => setServiceTypeFilter('international')} className={`flex-1 p-1.5 text-[10px] sm:text-xs rounded-r-md ${serviceTypeFilter === 'international' ? 'bg-brand-green text-white' : 'hover:bg-gray-100 dark:hover:bg-zinc-700'}`}>{t('businessesPage.international')}</button>
                                </div>
                                <p id="service-scope-help" className="mt-1 text-[11px] leading-snug text-gray-500 dark:text-gray-400">
                                    {t('businessesPage.serviceScopeHelp')}
                                </p>
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
                    <ForeignCountryNotice className="mb-4" />
                    <div className="mb-6 sm:mb-8">
                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-gray-100">{businessesTitle}</h1>
                        <p className="text-sm sm:text-base md:text-lg text-gray-500 dark:text-gray-400 mt-1 sm:mt-2">
                            {tn('businessesPage.businessesFound', totalCount)}
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
                    {(scopeAllCountries || selectedCategory || (ratingFilter && (ratingFilter.min !== 1 || ratingFilter.max !== 5)) || serviceTypeFilter !== 'all' || filterCenter) && (
                        <div className="mb-4 sm:mb-6 flex flex-wrap items-center gap-2">
                            <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{t('businessesPage.activeFilters')}:</span>
                            {scopeAllCountries && (
                                <span className="inline-flex items-center gap-1 text-xs sm:text-sm px-2 py-1 rounded-full bg-brand-green/10 text-brand-green">
                                    <i className="fa-solid fa-earth-europe text-xs" aria-hidden="true"></i>
                                    {t('common.allCountries')}
                                    <button type="button" onClick={() => setScopeAllCountries(false)} className="ml-1 hover:text-red-500" aria-label={t('common.clear')}>
                                        <i className="fa-solid fa-times text-xs" aria-hidden="true"></i>
                                    </button>
                                </span>
                            )}
                            {selectedCategory && (
                                <span className="inline-flex items-center gap-1 text-xs sm:text-sm px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                                    {t(`categories.${selectedCategory}`)}
                                    <button onClick={() => setSelectedCategory(null)} className="ml-1 hover:text-red-500">
                                        <i className="fa-solid fa-times text-xs"></i>
                                    </button>
                                </span>
                            )}
                            {ratingFilter && (ratingFilter.min !== 1 || ratingFilter.max !== 5) && (
                                <span className="inline-flex items-center gap-1 text-xs sm:text-sm px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400">
                                    {/* Mostrar rango con decimales */}
                                    {ratingFilter.min.toFixed(1)}-{ratingFilter.max.toFixed(1)} <i className="fa-solid fa-star text-xs"></i>
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
                                    <BusinessCard key={biz.id} business={biz} homeCountry={directoryCountry || null} />
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
