import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ReviewCard from '../ReviewCard';
import type { Review, BusinessListItem, SimpleBusiness, Json, Sede } from '../../types';
import { CATEGORIES, COUNTRIES } from '../../constants';
import { getPublicReviews, getBusinessesWithLocations, getBusinessCountByFilters, getBusinessesWithReviewsPaginated, searchBusinessList, getTotalReviewCount } from '../../services/supabaseService';
import { generateSearchQueryFromPrompt } from '../../services/geminiService';
import Spinner from '../Spinner';
import L from 'leaflet';
import { getDistanceFromLatLonInKm } from '../../utils/geolocation';
import Meta from '../Meta';
import LazyRender from '../LazyRender';
import StarRating from '../StarRating';
import { useTranslation, useI18n, pathTranslations, type Language, getLanguageForCountryCode } from '../../contexts/i18nContext';
import { useNotification } from '../../contexts/NotificationContext';
import { useCountry } from '../../contexts/CountryContext';
import { generateBusinessPath } from '../../utils/linkUtils';
import { getSubcategoryKey, getCategorySpanishName } from '../../utils/categoryMappings';

// Define a smaller type for business location data
type BusinessLocation = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  sedes: Json | null;
  offers_international_services?: boolean;
  country: string | null;
  category?: string | null;
  logo_url?: string | null;
};

const PAGE_SIZE = 10;

// Component to handle business logo with fallback on error
const BusinessLogo: React.FC<{ logoUrl: string | null | undefined; businessName: string; className?: string; iconSize?: string }> = ({ logoUrl, businessName, className = "w-10 h-10 sm:w-12 sm:h-12", iconSize = "text-xl sm:text-2xl" }) => {
    const [imageError, setImageError] = useState(false);
    return (
        <div className={`${className} rounded-lg bg-gray-100 dark:bg-zinc-800 flex-shrink-0 overflow-hidden shadow-sm border border-gray-200 dark:border-zinc-700 flex items-center justify-center`}>
            {logoUrl && !imageError ? (
                <img src={logoUrl} alt={`${businessName} logo`} width={48} height={48} loading="lazy" decoding="async" className="w-full h-full object-contain p-1" onError={() => setImageError(true)} />
            ) : (
                <div className="text-gray-400 dark:text-gray-500"><i className={`fa-solid fa-store ${iconSize}`}></i></div>
            )}
        </div>
    );
};

type SortOrder = 'newest' | 'oldest' | 'most_helpful' | 'least_helpful';
type ActiveTab = 'manual' | 'ai' | 'map';

// Custom Map Marker Icons using FontAwesome
const iconStyle = `
  .map-marker-icon {
    background: transparent;
    border: none;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
  }
  .map-marker-icon i {
    transition: all 0.2s ease-in-out;
  }
  .map-marker-selected i {
    transform: scale(1.2);
  }
`;

const defaultIcon = L.divIcon({
    html: `<i class="fa-solid fa-location-dot text-brand-green text-4xl"></i>`,
    className: 'map-marker-icon',
    iconSize: [30, 42],
    iconAnchor: [15, 42],
    popupAnchor: [0, -42]
});

const selectedIcon = L.divIcon({
    html: `<i class="fa-solid fa-location-dot text-brand-green text-4xl"></i>`,
    className: 'map-marker-icon map-marker-selected',
    iconSize: [30, 42],
    iconAnchor: [15, 42],
    popupAnchor: [0, -42]
});

// User location marker icon (blue)
const userLocationIcon = L.divIcon({
    html: `<i class="fa-solid fa-circle-dot text-blue-500 text-3xl"></i>`,
    className: 'map-marker-icon user-location-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
});

// Helper function for geolocation with retries
const getLocationWithRetry = (
    onSuccess: (position: GeolocationPosition) => void,
    onError: () => void,
    maxRetries: number = 2
): void => {
    let attempts = 0;

    const tryGetLocation = () => {
        navigator.geolocation.getCurrentPosition(
            onSuccess,
            (error) => {
                attempts++;
                console.warn(`Geolocation attempt ${attempts} failed:`, error.message);

                if (attempts < maxRetries && error.code !== error.PERMISSION_DENIED) {
                    // Retry with lower accuracy on subsequent attempts
                    setTimeout(() => {
                        navigator.geolocation.getCurrentPosition(
                            onSuccess,
                            () => {
                                if (attempts + 1 >= maxRetries) {
                                    onError();
                                } else {
                                    attempts++;
                                    tryGetLocation();
                                }
                            },
                            { timeout: 8000, enableHighAccuracy: false, maximumAge: 60000 }
                        );
                    }, 500);
                } else {
                    onError();
                }
            },
            { timeout: 5000, enableHighAccuracy: true, maximumAge: 0 }
        );
    };

    tryGetLocation();
};

type DateFilterValue = 'all' | '30d' | '6m' | '12m' | 'custom';
interface DateFilterState {
  type: DateFilterValue;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
}

// Modal para pedir permiso de ubicación
const LocationPermissionModal: React.FC<{
    isOpen: boolean;
    onAllow: () => void;
    onDeny: () => void;
}> = ({ isOpen, onAllow, onDeny }) => {
    const t = useTranslation();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={onDeny}>
            <div
                className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-fade-in"
                onClick={e => e.stopPropagation()}
            >
                <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand-green/10 flex items-center justify-center">
                        <i className="fa-solid fa-location-crosshairs text-3xl text-brand-green"></i>
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">
                        {t('locationPermission.title')}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        {t('locationPermission.message')}
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={onDeny}
                            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
                        >
                            {t('locationPermission.deny')}
                        </button>
                        <button
                            onClick={onAllow}
                            className="flex-1 px-4 py-2.5 rounded-lg bg-brand-green text-white font-semibold hover:bg-green-600 transition-colors"
                        >
                            {t('locationPermission.allow')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Modal para mostrar cuando la ubicación no está disponible
const LocationNotAvailableModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
}> = ({ isOpen, onClose }) => {
    const t = useTranslation();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-fade-in"
                onClick={e => e.stopPropagation()}
            >
                <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                        <i className="fa-solid fa-location-dot-slash text-3xl text-yellow-600 dark:text-yellow-400"></i>
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">
                        {t('locationPermission.notAvailableTitle')}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        {t('locationPermission.notAvailableMessage')}
                    </p>
                    <button
                        onClick={onClose}
                        className="w-full px-4 py-2.5 rounded-lg bg-brand-green text-white font-semibold hover:bg-green-600 transition-colors"
                    >
                        {t('locationPermission.understood')}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Modal para confirmar cambio de filtro que deseleccionaría la empresa
const FilterChangeConfirmModal: React.FC<{
    isOpen: boolean;
    businessName: string;
    onConfirm: () => void;
    onCancel: () => void;
}> = ({ isOpen, businessName, onConfirm, onCancel }) => {
    const t = useTranslation();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={onCancel}>
            <div
                className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-fade-in"
                onClick={e => e.stopPropagation()}
            >
                <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                        <i className="fa-solid fa-triangle-exclamation text-3xl text-amber-600 dark:text-amber-400"></i>
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">
                        {t('explorePage.filterChangeWarningTitle') || '¿Cambiar filtro?'}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-2">
                        {t('explorePage.filterChangeWarningMessage') || 'Al cambiar este filtro se deseleccionará la empresa actual:'}
                    </p>
                    <p className="font-semibold text-brand-green mb-6">
                        "{businessName}"
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={onCancel}
                            className="flex-1 px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-200 dark:hover:bg-zinc-600 transition-colors"
                        >
                            {t('common.cancel') || 'Cancelar'}
                        </button>
                        <button
                            onClick={onConfirm}
                            className="flex-1 px-4 py-2.5 rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-colors"
                        >
                            {t('explorePage.changeFilter') || 'Cambiar filtro'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ExplorePage: React.FC = () => {
    const t = useTranslation();
    const { language } = useI18n();
    const { showNotification } = useNotification();
    const { country } = useCountry();
    const countryPrefix = country ? `/${country.toLowerCase()}` : '';
    const pathLang = country ? getLanguageForCountryCode(country) : language;
    const paths = pathTranslations[pathLang] || pathTranslations.es;

    // Helper function to translate category from "Parent: Subcategory" format
    const getCategoryTranslation = (categoryString: string | null): string => {
        if (!categoryString || categoryString.trim() === '') return t('common.noCategory');

        // Handle "Sin Categoría" / "Sin categoria" special case
        if (categoryString.toLowerCase().includes('sin categor')) {
            return t('common.noCategory');
        }

        // Extract main category if format is "Category: Subcategory"
        let mainCategory = categoryString;

        if (categoryString.includes(':')) {
            [mainCategory] = categoryString.split(':');
            mainCategory = mainCategory.trim();
        }

        // Convert English category name to Spanish if needed
        const categoryKey = getCategorySpanishName(mainCategory);

        // Translate main category using i18n
        const translatedMain = t(`categories.${categoryKey}`);
        return translatedMain.startsWith('categories.') ? mainCategory : translatedMain;
    };

    // Main state - individual reviews feed
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [totalReviewCount, setTotalReviewCount] = useState(0); // Real total count of reviews
    const [businessCountInCategory, setBusinessCountInCategory] = useState(0); // Number of businesses in selected category
    const [activeTab, setActiveTab] = useState<ActiveTab>('manual');

    // Filters for manual tab
    const [isFiltersVisible, setIsFiltersVisible] = useState(true);
    const [searchTerm, setSearchTerm] = useState(''); // Search business name
    const [reviewTextSearch, setReviewTextSearch] = useState(''); // NEW: Search review content

    // Business autocomplete state
    const [businessSuggestions, setBusinessSuggestions] = useState<Array<{id: string; name: string; category: string | null; country: string | null}>>([]);
    const [selectedBusinessFilter, setSelectedBusinessFilter] = useState<{id: string; name: string; category: string | null; country: string | null} | null>(null);
    const [showBusinessSuggestions, setShowBusinessSuggestions] = useState(false);

    // Modal for confirming filter change that would deselect business
    const [showFilterChangeModal, setShowFilterChangeModal] = useState(false);
    const [pendingFilterChange, setPendingFilterChange] = useState<{type: 'category' | 'country'; value: string | null} | null>(null);
    const [isLoadingBusinessSuggestions, setIsLoadingBusinessSuggestions] = useState(false);
    const businessSearchInputRef = useRef<HTMLInputElement>(null);
    const businessSuggestionsRef = useRef<HTMLDivElement>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedCountry, setSelectedCountry] = useState<string | null>(country || null);
    // Rating filter: null = all, or {min, max} for range (e.g., {min: 3, max: 4} for 3-4 stars)
    const [ratingFilter, setRatingFilter] = useState<{min: number; max: number} | null>(null);
    const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
    const [manualSearchError, setManualSearchError] = useState<string | null>(null);
    const [dateFilter, setDateFilter] = useState<DateFilterState>({ type: 'all' });
    const [verifiedFilter, setVerifiedFilter] = useState<'all' | 'verified' | 'unverified'>('all');
    const [formatFilter, setFormatFilter] = useState<string[]>([]);
    const [isFormatDropdownOpen, setIsFormatDropdownOpen] = useState(false);
    const formatDropdownRef = useRef<HTMLDivElement>(null);

    // Legacy state for grouped view (keeping for map/AI compatibility)
    const [businessGroups, setBusinessGroups] = useState<Array<{ business: SimpleBusiness; reviews: Review[] }>>([]);
    const loadedBusinessIdsRef = useRef<string[]>([]);
    const [loadingFromOtherCountries, setLoadingFromOtherCountries] = useState(false);
    
    // AI Tab State
    const AI_SEARCH_MAINTENANCE = true; // TODO: Cambiar a false para reactivar
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiSearchResults, setAiSearchResults] = useState<Review[]>([]);
    const [isAiSearching, setIsAiSearching] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);

    // Map state
    const [businesses, setBusinesses] = useState<BusinessLocation[]>([]);
    const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<L.Map | null>(null);
    const markersLayerRef = useRef<L.LayerGroup | null>(null);
    const markersRef = useRef<Map<string, L.Marker>>(new Map());
    const radiusCircleRef = useRef<L.Circle | null>(null);
    const userMarkerRef = useRef<L.Marker | null>(null);

    // AbortController refs for preventing race conditions
    const abortControllerRef = useRef<AbortController | null>(null);
    const fetchInProgressRef = useRef(false);

    // Refs to store current fetch functions (avoid recreating useEffect on function changes)
    const fetchReviewsRef = useRef<((page: number, append: boolean) => Promise<void>) | null>(null);
    const fetchBusinessesRef = useRef<((page: number, append: boolean, options?: any) => Promise<void>) | null>(null);
    // Flag to track if initial country sync has completed
    const initialCountrySyncRef = useRef(false);

    // Radius filter state
    const [radiusKm, setRadiusKm] = useState<number>(10);
    const [filterCenter, setFilterCenter] = useState<L.LatLng | null>(null);
    const [geolocating, setGeolocating] = useState(false);

    // Location permission modals state
    const [showLocationPermissionModal, setShowLocationPermissionModal] = useState(false);
    const [showLocationNotAvailableModal, setShowLocationNotAvailableModal] = useState(false);

    // Business count state for banner
    const [businessCount, setBusinessCount] = useState<{
        totalGlobal: number;
        totalInCountry: number;
        totalInCategory: number;
        matchingAll: number;
    }>({ totalGlobal: 0, totalInCountry: 0, totalInCategory: 0, matchingAll: 0 });

    const location = useLocation();

    const countryInfo = useMemo(() => COUNTRIES.find(c => c.code === country), [country]);
    const brandName = countryInfo ? `Opynio ${countryInfo.name}` : 'Opynio';
    const metaTitle = `${t('meta.exploreTitle')} - ${brandName}`;
    const metaDescription = t('meta.exploreDesc').replace('Opynio', brandName);
    const exploreTitle = t('explorePage.exploreTitle').replace('Opynio', brandName);
    const exploreSubtitle = t('explorePage.exploreSubtitle').replace('Opynio', brandName);

    // Detectar si hay filtros activos para evitar indexación de URLs con parámetros
    // Esto previene que Google indexe miles de variaciones de la misma página
    const hasActiveFilters = useMemo(() => {
        // ratingFilter solo cuenta como activo si no es el rango completo (1-5)
        const hasRatingFilter = ratingFilter && (ratingFilter.min !== 1 || ratingFilter.max !== 5);
        return !!(
            searchTerm ||
            reviewTextSearch ||
            selectedCategory ||
            hasRatingFilter ||
            selectedBusinessFilter ||
            dateFilter.type !== 'all' ||
            verifiedFilter !== 'all' ||
            formatFilter.length > 0 ||
            filterCenter // Filtro de ubicación en mapa
        );
    }, [searchTerm, reviewTextSearch, selectedCategory, ratingFilter, selectedBusinessFilter, dateFilter, verifiedFilter, formatFilter, filterCenter]);

    const selectedBusinessForDisplay = useMemo(() => {
        if (!selectedBusinessId) return null;
        return businesses.find(b => b.id === selectedBusinessId);
    }, [selectedBusinessId, businesses]);

    // Effect to handle clicks outside the format dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (formatDropdownRef.current && !formatDropdownRef.current.contains(event.target as Node)) {
                setIsFormatDropdownOpen(false);
            }
            // Also close business suggestions dropdown
            if (businessSuggestionsRef.current && !businessSuggestionsRef.current.contains(event.target as Node) &&
                businessSearchInputRef.current && !businessSearchInputRef.current.contains(event.target as Node)) {
                setShowBusinessSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Effect to search businesses for autocomplete suggestions
    useEffect(() => {
        // If a business is already selected, don't search
        if (selectedBusinessFilter) {
            setBusinessSuggestions([]);
            setShowBusinessSuggestions(false);
            return;
        }

        // Only search if there's a search term with at least 2 characters
        if (searchTerm.trim().length < 2) {
            setBusinessSuggestions([]);
            setShowBusinessSuggestions(false);
            return;
        }

        const searchTimeout = setTimeout(async () => {
            try {
                setIsLoadingBusinessSuggestions(true);
                const results = await searchBusinessList(searchTerm.trim());
                setBusinessSuggestions(results);
                setShowBusinessSuggestions(results.length > 0);
            } catch (error) {
                console.error('Error searching businesses:', error);
                setBusinessSuggestions([]);
            } finally {
                setIsLoadingBusinessSuggestions(false);
            }
        }, 300);

        return () => clearTimeout(searchTimeout);
    }, [searchTerm, selectedBusinessFilter]);

    // Effect to read search term and category from URL on initial load and handle scrolling from hash
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const query = params.get('q');
        if (query) {
            setSearchTerm(query);
        }

        // Read category parameter from URL (used when clicking category buttons on homepage)
        const categoryParam = params.get('category');
        if (categoryParam && Object.keys(CATEGORIES).includes(categoryParam)) {
            setSelectedCategory(categoryParam);
        }

        let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

        if (location.hash) {
            // Use timeout to ensure the element is rendered before trying to scroll
            scrollTimeout = setTimeout(() => {
                const id = location.hash.substring(1); // Remove #
                const element = document.getElementById(id);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth' });
                }
            }, 100);
        }

        return () => {
            if (scrollTimeout) {
                clearTimeout(scrollTimeout);
            }
        };
    }, [location.search, location.hash]);

    // Effect to sync selectedCountry when context country changes
    // Only sync if it's the initial mount or if user navigates to a different country page
    // We use a ref to prevent unnecessary re-syncs that would trigger re-fetches
    useEffect(() => {
        if (country) {
            // Only update if it's different from current to avoid triggering fetch effect
            setSelectedCountry(prev => {
                if (prev !== country) {
                    // Mark that we've done initial sync
                    initialCountrySyncRef.current = true;
                    return country;
                }
                return prev;
            });
        }
    }, [country]);

    // Effect to fetch total business count for banner
    useEffect(() => {
        const fetchBusinessCount = async () => {
            try {
                const counts = await getBusinessCountByFilters({
                    searchTerm: searchTerm || undefined,
                    category: selectedCategory || undefined,
                    country: selectedCountry || undefined,
                });
                setBusinessCount(counts);
            } catch (error) {
                console.error('Error fetching business count:', error);
                setBusinessCount({ totalGlobal: 0, totalInCountry: 0, totalInCategory: 0, matchingAll: 0 });
            }
        };
        fetchBusinessCount();
    }, [searchTerm, selectedCategory, selectedCountry]);

    const businessIdsInRadius = useMemo(() => {
        if (!filterCenter) return null; // null indicates filter is off

        return businesses
            .filter(b => {
                if (!b.latitude || !b.longitude) return false;
                const distance = getDistanceFromLatLonInKm(filterCenter.lat, filterCenter.lng, b.latitude, b.longitude);
                return distance <= radiusKm;
            })
            .map(b => b.id);
    }, [businesses, filterCenter, radiusKm]);

    // Nearby businesses with distance, sorted by proximity
    // Works with either filterCenter (user location) or selected business location
    const nearbyBusinesses = useMemo(() => {
        // Determine the center point: user location OR selected business location
        let centerLat: number | null = null;
        let centerLng: number | null = null;

        if (filterCenter) {
            centerLat = filterCenter.lat;
            centerLng = filterCenter.lng;
        } else if (selectedBusinessId) {
            const selectedBiz = businesses.find(b => b.id === selectedBusinessId);
            if (selectedBiz?.latitude && selectedBiz?.longitude) {
                centerLat = selectedBiz.latitude;
                centerLng = selectedBiz.longitude;
            }
        }

        if (centerLat === null || centerLng === null) return [];

        return businesses
            .filter(b => b.latitude && b.longitude)
            .map(b => ({
                ...b,
                distance: getDistanceFromLatLonInKm(centerLat!, centerLng!, b.latitude!, b.longitude!)
            }))
            .filter(b => b.distance <= radiusKm)
            .sort((a, b) => a.distance - b.distance);
    }, [businesses, filterCenter, radiusKm, selectedBusinessId]);
    
    const fetchBusinesses = useCallback(async (
        currentPage: number,
        shouldAppend: boolean,
        options?: { skipCountryFilter?: boolean; excludeBusinessIds?: string[] }
    ) => {
        // Cancel any ongoing fetch
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        if (fetchInProgressRef.current && !shouldAppend) return;
        fetchInProgressRef.current = true;

        if (currentPage === 1 && !options?.skipCountryFilter) setLoading(true);
        else setLoadingMore(true);
        setManualSearchError(null);

        try {
            const filters: {
                searchTerm?: string;
                category?: string;
                country?: string;
                businessIds?: string[];
                rating?: { min?: number; max?: number };
                dateFilter?: { type: string; startDate?: string; endDate?: string };
                verifiedFilter?: 'all' | 'verified' | 'unverified';
                formatFilter?: string[];
                sortOrder?: string;
            } = {
                searchTerm: searchTerm.trim() || undefined,
                category: selectedCategory || undefined,
                country: options?.skipCountryFilter ? undefined : (selectedCountry || undefined),
                businessIds: selectedBusinessId ? [selectedBusinessId] : (businessIdsInRadius ?? undefined),
                rating: ratingFilter ? { min: ratingFilter.min, max: ratingFilter.max } : undefined,
                dateFilter: dateFilter.type !== 'all' ? dateFilter : undefined,
                verifiedFilter: verifiedFilter !== 'all' ? verifiedFilter : undefined,
                formatFilter: formatFilter.length > 0 ? formatFilter : undefined,
                sortOrder: sortOrder !== 'newest' ? sortOrder : undefined,
            };

            // Determine which business IDs to exclude (use ref to avoid dependency issues)
            const excludeIds = shouldAppend ? [...loadedBusinessIdsRef.current] : [];
            if (options?.excludeBusinessIds && options.excludeBusinessIds.length > 0) {
                excludeIds.push(...options.excludeBusinessIds);
            }

            const result = await getBusinessesWithReviewsPaginated(filters, currentPage, PAGE_SIZE, excludeIds);

            // Check if not aborted before setState
            if (!abortControllerRef.current?.signal.aborted) {
                const newBusinessIds = result.businesses.map(b => b.business.id);

                if (shouldAppend) {
                    setBusinessGroups(prev => [...prev, ...result.businesses]);
                    loadedBusinessIdsRef.current = [...loadedBusinessIdsRef.current, ...newBusinessIds];
                } else {
                    setBusinessGroups(result.businesses);
                    loadedBusinessIdsRef.current = newBusinessIds;
                }

                setHasMore(result.hasMore);

                // Also update reviews for compatibility with existing code
                const allReviews = result.businesses.flatMap(b =>
                    b.reviews.map(r => ({ ...r, businesses: b.business }))
                );
                if (shouldAppend) {
                    setReviews(prev => [...prev, ...allReviews]);
                } else {
                    setReviews(allReviews);
                }
            }

        } catch (error) {
            // Ignore abort errors
            if (error instanceof Error && error.name === 'AbortError') return;

            if (!abortControllerRef.current?.signal.aborted) {
                console.error("Failed to fetch businesses:", error);
                setBusinessGroups([]);
                setReviews([]);
                loadedBusinessIdsRef.current = [];
                setHasMore(false);
                setManualSearchError(error instanceof Error ? error.message : t("explorePage.searchErrorBody"));
            }
        } finally {
            fetchInProgressRef.current = false;
            if (!abortControllerRef.current?.signal.aborted) {
                setLoading(false);
                setLoadingMore(false);
            }
        }
    }, [searchTerm, selectedCategory, selectedCountry, selectedBusinessId, businessIdsInRadius, ratingFilter, dateFilter, verifiedFilter, formatFilter, sortOrder, t]);
    
    const handleAiSearch = async (e: React.FormEvent) => {
        e.preventDefault();

        // Check if AI search is in maintenance mode
        if (AI_SEARCH_MAINTENANCE) {
            setAiError(t('explorePage.aiMaintenanceMessage'));
            return;
        }

        if (!aiPrompt.trim()) return;

        setIsAiSearching(true);
        setAiError(null);
        setAiSearchResults([]);

        try {
            const searchParams = await generateSearchQueryFromPrompt(aiPrompt);
            const result = await getPublicReviews({
                searchTerm: searchParams.searchTerm,
                category: searchParams.category,
                country: country || undefined,
            }, 1, 10);
            // Handle both formats: object { reviews, totalCount, hasMore } or array
            const reviewsData = (result && typeof result === 'object' && 'reviews' in result) ? result.reviews : (result as any[]);
            setAiSearchResults(reviewsData);

        } catch (err: any) {
            setAiError(err.message || t('aiError'));
        } finally {
            setIsAiSearching(false);
        }
    };


    // Fetch business locations for the map
    useEffect(() => {
        const fetchLocations = async () => {
            try {
                // Fetch all businesses regardless of country for map view
                const businessData = await getBusinessesWithLocations();
                setBusinesses(businessData as BusinessLocation[]);
            } catch (error: any) {
                console.error("Failed to fetch business locations:", error.message || error);
            }
        };
        fetchLocations();
    }, []);


    // Effect to center map on selected business
    useEffect(() => {
        if (selectedBusinessId && mapRef.current) {
            const business = businesses.find(b => b.id === selectedBusinessId);
            if (business?.latitude && business?.longitude) {
                mapRef.current.setView([business.latitude, business.longitude], 14);
            }
        }
    }, [selectedBusinessId, businesses]);

    // Initialize map and manage markers/circle
    useEffect(() => {
        let invalidateSizeTimeout: ReturnType<typeof setTimeout> | null = null;

        // Initialize map
        if (mapContainerRef.current && !mapRef.current) {
            mapRef.current = L.map(mapContainerRef.current).setView([40.416775, -3.703790], 6);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(mapRef.current);
            markersLayerRef.current = L.layerGroup().addTo(mapRef.current);

            // Add click handler for Option 3 (click on map to set location)
            mapRef.current.on('click', (e: L.LeafletMouseEvent) => {
                const clickedPos = e.latlng;
                setFilterCenter(clickedPos);
                setSelectedBusinessId(null); // Clear single business filter
                mapRef.current?.setView(clickedPos, 12);
                updateUserLocationMarker(clickedPos);
                showNotification(t('explorePage.locationSetFromMap'), 'success');
            });

            // Invalidate size after tab switch
            invalidateSizeTimeout = setTimeout(() => mapRef.current?.invalidateSize(), 100);
        }

        const map = mapRef.current;
        if (!map) {
            return () => {
                if (invalidateSizeTimeout) clearTimeout(invalidateSizeTimeout);
            };
        }

        // Manage circle overlay
        if (filterCenter) {
            if (radiusCircleRef.current) {
                radiusCircleRef.current.setLatLng(filterCenter).setRadius(radiusKm * 1000);
            } else {
                radiusCircleRef.current = L.circle(filterCenter, {
                    radius: radiusKm * 1000,
                    color: '#00b67a',
                    fillColor: '#00b67a',
                    fillOpacity: 0.1,
                }).addTo(map);
            }
        } else if (radiusCircleRef.current) {
            radiusCircleRef.current.remove();
            radiusCircleRef.current = null;
        }

        // Manage markers - CRITICAL: Clean up event listeners before clearing
        if (markersLayerRef.current) {
            // Remove event listeners from existing markers
            markersRef.current.forEach((marker) => {
                marker.off('click');
            });

            markersLayerRef.current.clearLayers();
            markersRef.current.clear(); // Clear the marker map

            // Always show ALL businesses on map, regardless of radius filter
            // The radius filter only affects the sidebar list, not the map markers
            businesses.forEach(business => {
                if (business.latitude && business.longitude) {
                    const marker = L.marker([business.latitude, business.longitude], { icon: defaultIcon })
                        .addTo(markersLayerRef.current!)
                        .bindPopup(`<b>${business.name}</b>`);

                    markersRef.current.set(business.id, marker);

                    marker.on('click', () => {
                        setSelectedBusinessId(business.id);
                    });
                }
            });
        }

        return () => {
            if (invalidateSizeTimeout) clearTimeout(invalidateSizeTimeout);
        };
    }, [businesses, filterCenter, radiusKm, activeTab]);
    
    // Effect to handle visual selection of markers
    useEffect(() => {
        markersRef.current.forEach((marker, businessId) => {
            if (businessId === selectedBusinessId) {
                marker.setIcon(selectedIcon);
                marker.setZIndexOffset(1000); // Bring to front
            } else {
                marker.setIcon(defaultIcon);
                marker.setZIndexOffset(0);
            }
        });
    }, [selectedBusinessId]);

    // Final cleanup when component unmounts
    useEffect(() => {
        return () => {
            if (userMarkerRef.current) {
                userMarkerRef.current.remove();
                userMarkerRef.current = null;
            }
            if (radiusCircleRef.current) {
                radiusCircleRef.current.remove();
                radiusCircleRef.current = null;
            }
            markersRef.current.forEach((marker) => {
                marker.off('click');
                marker.remove();
            });
            markersRef.current.clear();
            if (markersLayerRef.current) {
                markersLayerRef.current.clearLayers();
                markersLayerRef.current = null;
            }
            if (mapRef.current) {
                // Remove click event listener before destroying map
                mapRef.current.off('click');
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);

    // Auto-request geolocation when switching to map tab - show modal first
    const hasRequestedLocationRef = useRef(false);
    useEffect(() => {
        if (activeTab === 'map' && !hasRequestedLocationRef.current && !filterCenter && navigator.geolocation) {
            hasRequestedLocationRef.current = true;
            // Show permission modal instead of directly requesting
            setShowLocationPermissionModal(true);
        }
    }, [activeTab, filterCenter]);

    // Helper to add/update user location marker
    const updateUserLocationMarker = useCallback((pos: L.LatLng) => {
        if (!mapRef.current) return;

        if (userMarkerRef.current) {
            userMarkerRef.current.setLatLng(pos);
        } else {
            userMarkerRef.current = L.marker(pos, { icon: userLocationIcon })
                .addTo(mapRef.current)
                .bindPopup(t('explorePage.yourLocation'));
        }
    }, [t]);

    // Handler for when user allows location from modal
    const handleAllowLocation = useCallback(() => {
        setShowLocationPermissionModal(false);
        setGeolocating(true);

        getLocationWithRetry(
            (position) => {
                const pos = new L.LatLng(position.coords.latitude, position.coords.longitude);
                setFilterCenter(pos);
                mapRef.current?.setView(pos, 12);
                updateUserLocationMarker(pos);
                setGeolocating(false);
            },
            () => {
                setGeolocating(false);
                setShowLocationNotAvailableModal(true);
            }
        );
    }, [updateUserLocationMarker]);

    // Handler for when user denies location from modal - show info about manual location
    const handleDenyLocation = useCallback(() => {
        setShowLocationPermissionModal(false);
        // Show the not available modal so user knows how to enable manually
        setShowLocationNotAvailableModal(true);
    }, []);

    // State for prefetching next page of reviews
    const prefetchedReviewsRef = useRef<any[]>([]);
    const prefetchingRef = useRef<boolean>(false);

    // Fetch individual reviews for the reviews feed (MUST be defined before useEffect that uses it)
    const fetchReviews = useCallback(async (
        currentPage: number,
        shouldAppend: boolean
    ) => {
        // Cancel any ongoing fetch to prevent race conditions
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
        const currentAbortController = abortControllerRef.current;

        if (currentPage === 1) setLoading(true);
        else setLoadingMore(true);
        setManualSearchError(null);

        try {
            const isSpecificBusiness = !!selectedBusinessFilter;

            const result = await getPublicReviews({
                searchTerm: isSpecificBusiness ? undefined : (searchTerm.trim() || undefined),
                businessId: isSpecificBusiness ? selectedBusinessFilter.id : undefined,
                reviewTextSearch: reviewTextSearch.trim() || undefined,
                category: selectedCategory || undefined,
                country: selectedCountry || undefined,
                rating: ratingFilter ? { min: ratingFilter.min, max: ratingFilter.max } : undefined,
                sortBy: sortOrder,
                dateFilter: dateFilter.type !== 'all' ? dateFilter : undefined,
                verifiedFilter: verifiedFilter !== 'all' ? verifiedFilter : undefined,
                formatFilters: formatFilter.length > 0 ? formatFilter : undefined,
                variedFeed: !isSpecificBusiness, // Use varied feed for general explore (interleaved reviews from multiple businesses)
            }, currentPage, PAGE_SIZE);

            // Check if this request was aborted before updating state
            if (currentAbortController.signal.aborted) {
                return;
            }

            // Handle both formats: object { reviews, totalCount, hasMore, businessCount } or array
            const isObjectResult = result && typeof result === 'object' && 'reviews' in result;
            const reviewsData = isObjectResult ? result.reviews : (result as any[]);
            const newTotalCount = isObjectResult ? result.totalCount : reviewsData.length;
            const newHasMore = isObjectResult ? result.hasMore : reviewsData.length === PAGE_SIZE;
            const newBusinessCount = isObjectResult && 'businessCount' in result ? (result as any).businessCount : 0;

            // Double-check abort status before setState to prevent race conditions
            if (currentAbortController.signal.aborted) {
                return;
            }

            if (shouldAppend) {
                setReviews(prev => [...prev, ...reviewsData]);
            } else {
                setReviews(reviewsData);
                // Use the totalCount from the query result directly
                // getVariedReviews already returns the correct total count
                setTotalReviewCount(newTotalCount);
                setBusinessCountInCategory(newBusinessCount);
                console.log(`📊 fetchReviews: Set totalReviewCount to ${newTotalCount}, businessCount: ${newBusinessCount}, reviews loaded: ${reviewsData.length}`);
            }

            setHasMore(newHasMore);

            // Pre-fetch the next page in the background if there are more reviews
            if (newHasMore && !prefetchingRef.current && !currentAbortController.signal.aborted) {
                prefetchingRef.current = true;
                const nextPage = currentPage + 1;

                // Pre-fetch silently in background
                getPublicReviews({
                    searchTerm: isSpecificBusiness ? undefined : (searchTerm.trim() || undefined),
                    businessId: isSpecificBusiness ? selectedBusinessFilter.id : undefined,
                    reviewTextSearch: reviewTextSearch.trim() || undefined,
                    category: selectedCategory || undefined,
                    country: selectedCountry || undefined,
                    rating: ratingFilter ? { min: ratingFilter.min, max: ratingFilter.max } : undefined,
                    sortBy: sortOrder,
                    dateFilter: dateFilter.type !== 'all' ? dateFilter : undefined,
                    verifiedFilter: verifiedFilter !== 'all' ? verifiedFilter : undefined,
                    formatFilters: formatFilter.length > 0 ? formatFilter : undefined,
                    variedFeed: !isSpecificBusiness, // Use varied feed for general explore
                }, nextPage, PAGE_SIZE).then(prefetchResult => {
                    const isPrefetchObject = prefetchResult && typeof prefetchResult === 'object' && 'reviews' in prefetchResult;
                    const prefetchedData = isPrefetchObject ? prefetchResult.reviews : (prefetchResult as any[]);
                    prefetchedReviewsRef.current = prefetchedData;
                    prefetchingRef.current = false;
                }).catch(() => {
                    prefetchingRef.current = false;
                });
            }
        } catch (error) {
            // Ignore abort errors - they are expected when canceling previous requests
            if (error instanceof Error && error.name === 'AbortError') {
                return;
            }
            // Only update state if this request wasn't aborted
            if (!currentAbortController.signal.aborted) {
                console.error("Failed to fetch reviews:", error);
                setReviews([]);
                setHasMore(false);
                setManualSearchError(error instanceof Error ? error.message : t("explorePage.searchErrorBody"));
            }
        } finally {
            // Only update loading state if this request wasn't aborted
            if (!currentAbortController.signal.aborted) {
                setLoading(false);
                setLoadingMore(false);
            }
        }
    }, [searchTerm, reviewTextSearch, selectedCategory, selectedCountry, ratingFilter, sortOrder, dateFilter, verifiedFilter, formatFilter, selectedBusinessFilter, t]);

    // Keep refs updated with latest functions
    useEffect(() => {
        fetchReviewsRef.current = fetchReviews;
    }, [fetchReviews]);

    useEffect(() => {
        fetchBusinessesRef.current = fetchBusinesses;
    }, [fetchBusinesses]);

    // Main effect to fetch data when filters change
    // IMPORTANT: We use refs for functions to avoid re-triggering when selectedCountry
    // changes from context sync (which would recreate fetchReviews/fetchBusinesses)
    useEffect(() => {
        // Prevent fetching all reviews on map tab without a selection
        if (activeTab === 'map' && !selectedBusinessId) {
            setReviews([]);
            setBusinessGroups([]);
            setLoading(false);
            setHasMore(false);
            return;
        }

        // Wait for refs to be populated
        if (!fetchReviewsRef.current || !fetchBusinessesRef.current) {
            return;
        }

        // Debounced effect for initial fetch or when filters change
        const debounceFetch = setTimeout(() => {
            setPage(1);
            setHasMore(true);
            loadedBusinessIdsRef.current = [];
            prefetchedReviewsRef.current = []; // Clear prefetched reviews when filters change

            // Use fetchReviews for manual tab (individual reviews feed)
            // Use fetchBusinesses for map tab (grouped by business)
            if (activeTab === 'manual') {
                fetchReviewsRef.current?.(1, false);
            } else {
                fetchBusinessesRef.current?.(1, false);
            }
        }, 300);

        return () => {
            clearTimeout(debounceFetch);
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    // Dependencies: only trigger on actual filter changes, not function recreations
    // The refs ensure we always call the latest version of the functions
    }, [activeTab, selectedBusinessId, searchTerm, reviewTextSearch, selectedCategory,
        selectedCountry, ratingFilter, sortOrder, dateFilter, verifiedFilter,
        formatFilter, selectedBusinessFilter]);

    const handleLoadMore = (fromOtherCountries: boolean = false) => {
        if (loadingMore) return;

        const nextPage = page + 1;
        setPage(nextPage);

        // Use different loading strategy based on active tab
        if (activeTab === 'manual') {
            // SIMPLIFIED: Always fetch reviews directly to ensure pagination works
            // The prefetch optimization was causing issues with varied feed pagination
            console.log(`📄 handleLoadMore: Loading page ${nextPage}`);
            fetchReviews(nextPage, true);
        } else if (fromOtherCountries) {
            // Start from page 1 when loading from other countries, but append results
            setLoadingFromOtherCountries(true);
            fetchBusinesses(1, true, {
                skipCountryFilter: true,
                excludeBusinessIds: loadedBusinessIdsRef.current
            });
        } else {
            fetchBusinesses(nextPage, true);
        }
    }

    const handleClearFilters = () => {
        setLoadingFromOtherCountries(false);
        setSearchTerm('');
        setReviewTextSearch('');
        setSelectedCategory(null);
        setSelectedCountry(null);
        setRatingFilter(null);
        setSortOrder('newest');
        setSelectedBusinessId(null);
        setSelectedBusinessFilter(null); // Clear selected business filter
        setFilterCenter(null);
        setDateFilter({ type: 'all' });
        setVerifiedFilter('all');
        setFormatFilter([]);
        loadedBusinessIdsRef.current = [];
        prefetchedReviewsRef.current = []; // Clear prefetched reviews
        setBusinessGroups([]);
        setReviews([]);
        mapRef.current?.setView([40.416775, -3.703790], 6);
    };

    // Handler for category change with confirmation when business is selected
    const handleCategoryChange = (newCategory: string | null) => {
        // If there's a selected business and we're changing to a different category
        if (selectedBusinessFilter && newCategory !== selectedCategory) {
            // Check if the new category is incompatible with the selected business
            const businessParentCategory = selectedBusinessFilter.category?.includes(':')
                ? selectedBusinessFilter.category.split(':')[0].trim()
                : selectedBusinessFilter.category;

            const businessCategoryKey = Object.keys(CATEGORIES).find(key => {
                const catName = getCategorySpanishName(key);
                return catName === businessParentCategory || key === businessParentCategory;
            });

            // If new category doesn't match business category, show confirmation
            if (newCategory !== null && newCategory !== businessCategoryKey) {
                setPendingFilterChange({ type: 'category', value: newCategory });
                setShowFilterChangeModal(true);
                return;
            }
        }
        setSelectedCategory(newCategory);
    };

    // Handler for country change with confirmation when business is selected
    const handleCountryChange = (newCountry: string | null) => {
        // If there's a selected business and we're changing to a different country
        if (selectedBusinessFilter && newCountry !== selectedCountry) {
            // Check if the new country is incompatible with the selected business
            if (newCountry !== null && selectedBusinessFilter.country !== newCountry) {
                setPendingFilterChange({ type: 'country', value: newCountry });
                setShowFilterChangeModal(true);
                return;
            }
        }
        setSelectedCountry(newCountry);
    };

    // Confirm filter change - deselect business and apply filter
    const handleConfirmFilterChange = () => {
        if (pendingFilterChange) {
            // Clear business selection
            setSelectedBusinessFilter(null);
            setSearchTerm('');

            // Apply the pending filter change
            if (pendingFilterChange.type === 'category') {
                setSelectedCategory(pendingFilterChange.value);
            } else if (pendingFilterChange.type === 'country') {
                setSelectedCountry(pendingFilterChange.value);
            }
        }
        setShowFilterChangeModal(false);
        setPendingFilterChange(null);
    };

    // Cancel filter change - keep current selection
    const handleCancelFilterChange = () => {
        setShowFilterChangeModal(false);
        setPendingFilterChange(null);
    };

    const handleUseMyLocation = useCallback(() => {
        if (!navigator.geolocation) {
            showNotification(t("explorePage.geolocationNotSupported"), "error");
            return;
        }
        setGeolocating(true);
        setSelectedBusinessId(null); // Clear single business filter

        getLocationWithRetry(
            (position) => {
                const pos = new L.LatLng(position.coords.latitude, position.coords.longitude);
                setFilterCenter(pos);
                mapRef.current?.setView(pos, 12);
                updateUserLocationMarker(pos);
                setGeolocating(false);
            },
            () => {
                showNotification(t("explorePage.couldNotGetLocation"), "error");
                setGeolocating(false);
            }
        );
    }, [showNotification, t, updateUserLocationMarker]);

    const handleSearchLocation = useCallback(async (query: string) => {
        try {
            setGeolocating(true);
            setSelectedBusinessId(null); // Clear single business filter

            // Use Nominatim OSM API for geocoding
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
                {
                    headers: {
                        'User-Agent': 'Opynio',
                    },
                }
            );

            if (!response.ok) {
                throw new Error('Geocoding failed');
            }

            const data = await response.json();

            if (data && data.length > 0) {
                const result = data[0];
                const pos = new L.LatLng(parseFloat(result.lat), parseFloat(result.lon));
                setFilterCenter(pos);
                mapRef.current?.setView(pos, 12);
                updateUserLocationMarker(pos);
                showNotification(t('explorePage.locationSet', { place: result.display_name }), 'success');
            } else {
                showNotification(t('explorePage.locationNotFound'), 'error');
            }
        } catch (error) {
            console.error('Geocoding error:', error);
            showNotification(t('explorePage.geocodingError'), 'error');
        } finally {
            setGeolocating(false);
        }
    }, [showNotification, t, updateUserLocationMarker]);

    // Grouping logic with new sorting - now uses businessGroups directly when available
    const groupedReviews = useMemo(() => {
        // If we have pre-grouped business data, use it directly
        if (businessGroups && businessGroups.length > 0) {
            const countryCode = country;

            // Sort the grouped businesses based on the new criteria
            const sortedGroups = [...businessGroups].sort((a, b) => {
                const bizA = a.business;
                const bizB = b.business;

                const getScore = (biz: SimpleBusiness | null | undefined) => {
                    if (!biz) return 0;

                    if (countryCode) {
                        const isPrimaryLocal = biz.country === countryCode;
                        const sedesRaw = biz.sedes;
                        let sedes: Sede[] = [];

                        if (Array.isArray(sedesRaw)) {
                            sedes = sedesRaw as Sede[];
                        }

                        const hasSedeInCountry = sedes.length > 0 && sedes.some(s => s && s.country_code === countryCode);

                        if (isPrimaryLocal) return 3;
                        if (hasSedeInCountry) return 2;
                    }

                    return 1;
                };

                const scoreA = getScore(bizA);
                const scoreB = getScore(bizB);

                if (scoreA !== scoreB) {
                    return scoreB - scoreA;
                }

                // Secondary sort by distance if location filter is active
                if (filterCenter && bizA.latitude && bizA.longitude && bizB.latitude && bizB.longitude) {
                    const distA = getDistanceFromLatLonInKm(filterCenter.lat, filterCenter.lng, bizA.latitude, bizA.longitude);
                    const distB = getDistanceFromLatLonInKm(filterCenter.lat, filterCenter.lng, bizB.latitude, bizB.longitude);
                    if (distA !== distB) return distA - distB;
                }

                // Fallback sort by review count
                return ((bizB?.review_count || 0) - (bizA?.review_count || 0));
            });

            return sortedGroups;
        }

        // Fallback to original grouping logic for AI search results or legacy code
        if (!reviews) return [];
        const groups: Record<string, { business: SimpleBusiness; reviews: Review[] }> = {};
        reviews.forEach(review => {
            const businessId = review.business_id;
            if (!review.businesses) return; // Skip reviews without business data
            if (!groups[businessId]) {
                groups[businessId] = {
                    business: review.businesses,
                    reviews: [],
                };
            }
            groups[businessId].reviews.push(review);
        });

        return Object.values(groups);
    }, [businessGroups, reviews, country, filterCenter]);

    const groupedAiSearchResults = useMemo(() => {
        if (!aiSearchResults) return [];
        const groups: Record<string, { business: SimpleBusiness; reviews: Review[] }> = {};
        aiSearchResults.forEach(review => {
            const businessId = review.business_id;
            if (!review.businesses) return; // Skip reviews without business data
            if (!groups[businessId]) {
                groups[businessId] = {
                    business: review.businesses,
                    reviews: [],
                };
            }
            groups[businessId].reviews.push(review);
        });
        return Object.values(groups);
    }, [aiSearchResults]);


    const renderContent = () => {
        switch (activeTab) {
            case 'manual':
                return renderManualExploration();
            case 'ai':
                return renderAiExploration();
            case 'map':
                return renderMapExploration();
            default:
                return null;
        }
    };

    // State for expanded reviews in the explore page
    const [expandedReviewId, setExpandedReviewId] = useState<string | null>(null);

    // Calculate total pages for pagination
    const REVIEWS_PER_PAGE = 10;
    const totalReviewPages = Math.max(1, Math.ceil(reviews.length / REVIEWS_PER_PAGE) + (hasMore ? 1 : 0));

    // Go to specific page
    const goToReviewPage = (newPage: number) => {
        if (newPage < 1 || loading) return;
        setPage(newPage);
        if (newPage > Math.ceil(reviews.length / REVIEWS_PER_PAGE) && hasMore) {
            // Need to load more data
            fetchReviews(newPage, true);
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Pagination controls component for reviews - shows real total count
    const ReviewPaginationControls = () => {
        if (reviews.length === 0) return null;

        const totalPages = Math.max(1, Math.ceil(totalReviewCount / PAGE_SIZE));
        const currentShowing = Math.min(page * PAGE_SIZE, totalReviewCount);

        return (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border dark:border-zinc-700">
                {/* Page info - show real total count and business count */}
                <div className="text-sm sm:text-base text-gray-600 dark:text-gray-400 text-center sm:text-left">
                    <i className="fa-solid fa-layer-group mr-2 text-brand-green"></i>
                    <span>{t('explorePage.showingReviews') || 'Mostrando'}</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200 mx-1">{currentShowing}</span>
                    <span>{t('common.of') || 'de'}</span>
                    <span className="font-bold text-brand-green mx-1">{totalReviewCount}</span>
                    <span>{t('common.reviews') || 'reseñas'}</span>
                    {/* Show business count when available */}
                    {businessCountInCategory > 0 && (
                        <span className="ml-2 text-xs sm:text-sm">
                            <span className="text-gray-400 dark:text-gray-500">|</span>
                            <i className="fa-solid fa-building ml-2 mr-1 text-blue-500"></i>
                            <span className="font-semibold text-blue-600 dark:text-blue-400">{businessCountInCategory}</span>
                            <span className="ml-1">{businessCountInCategory === 1 ? t('common.business') || 'empresa' : t('common.businesses') || 'empresas'}</span>
                        </span>
                    )}
                    {/* Loading indicator when fetching more */}
                    {loadingMore && (
                        <span className="ml-2 inline-flex items-center">
                            <i className="fa-solid fa-circle-notch fa-spin text-brand-green"></i>
                        </span>
                    )}
                </div>

                {/* Navigation buttons */}
                <div className="flex items-center gap-2 sm:gap-3">
                    <button
                        onClick={() => goToReviewPage(page - 1)}
                        disabled={page === 1 || loading || loadingMore}
                        className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg font-semibold text-sm sm:text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 hover:border-brand-green hover:text-brand-green dark:hover:border-brand-green"
                    >
                        <i className="fa-solid fa-chevron-left text-xs"></i>
                        <span className="hidden sm:inline">{t('businessesPage.previous')}</span>
                    </button>

                    {/* Page indicator with loading spinner */}
                    <div className="flex items-center gap-1 px-3 sm:px-4 py-2 sm:py-2.5 bg-brand-green/10 rounded-lg">
                        {loadingMore ? (
                            <i className="fa-solid fa-circle-notch fa-spin text-brand-green text-sm sm:text-base"></i>
                        ) : (
                            <span className="font-bold text-brand-green text-sm sm:text-base">{page}</span>
                        )}
                    </div>

                    <button
                        onClick={() => {
                            if (hasMore) {
                                handleLoadMore();
                            }
                        }}
                        disabled={!hasMore || loading || loadingMore}
                        className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg font-semibold text-sm sm:text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-brand-green text-white hover:bg-opacity-90 shadow-md"
                    >
                        {loadingMore ? (
                            <i className="fa-solid fa-circle-notch fa-spin"></i>
                        ) : (
                            <>
                                <span className="hidden sm:inline">{t('businessesPage.next')}</span>
                                <i className="fa-solid fa-chevron-right text-xs"></i>
                            </>
                        )}
                    </button>
                </div>
            </div>
        );
    };

    const renderManualExploration = () => {
        // Simplified sidebar with only essential filters
        const sidebar = (
            <aside className="lg:col-span-3 bg-white dark:bg-zinc-900 p-4 sm:p-5 md:p-6 rounded-lg self-start space-y-4 sm:space-y-5 border dark:border-zinc-800">
                <div className="flex justify-between items-center">
                    <h2 className="font-bold text-base sm:text-lg text-gray-800 dark:text-white">
                        <i className="fa-solid fa-filter mr-2 text-brand-green"></i>
                        {t('common.filters')}
                    </h2>
                </div>

                <div className="space-y-4 sm:space-y-5">
                    {/* Business name search with autocomplete */}
                    <div className="relative">
                        <label htmlFor="name-filter" className="block text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1 sm:mb-2">
                            {t('explorePage.businessName')}
                        </label>

                        {/* Selected business chip */}
                        {selectedBusinessFilter ? (
                            <div className="flex items-center gap-2 p-2 bg-brand-green/10 border border-brand-green rounded-md">
                                <i className="fa-solid fa-store text-brand-green text-sm"></i>
                                <span className="flex-1 text-sm font-medium text-gray-800 dark:text-white truncate">
                                    {selectedBusinessFilter.name}
                                </span>
                                <button
                                    onClick={() => {
                                        setSelectedBusinessFilter(null);
                                        setSearchTerm('');
                                    }}
                                    className="p-1 hover:bg-brand-green/20 rounded transition-colors"
                                    title={t('common.clear')}
                                >
                                    <i className="fa-solid fa-xmark text-brand-green text-sm"></i>
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="relative">
                                    <input
                                        ref={businessSearchInputRef}
                                        id="name-filter"
                                        type="text"
                                        placeholder={t('homepage.searchPlaceholder')}
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        onFocus={() => {
                                            if (businessSuggestions.length > 0) {
                                                setShowBusinessSuggestions(true);
                                            }
                                        }}
                                        className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md p-2 pr-8 text-sm text-gray-800 dark:text-white placeholder-gray-500 focus:ring-1 focus:ring-brand-green focus:border-brand-green"
                                    />
                                    {isLoadingBusinessSuggestions && (
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                            <i className="fa-solid fa-spinner fa-spin text-gray-400 text-sm"></i>
                                        </div>
                                    )}
                                </div>

                                {/* Suggestions dropdown */}
                                {showBusinessSuggestions && businessSuggestions.length > 0 && (
                                    <div
                                        ref={businessSuggestionsRef}
                                        className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                                    >
                                        <div className="p-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-zinc-700">
                                            <i className="fa-solid fa-lightbulb mr-1 text-yellow-500"></i>
                                            {t('explorePage.selectBusinessForAllReviews')}
                                        </div>
                                        {businessSuggestions.map((business) => (
                                            <button
                                                key={business.id}
                                                onClick={() => {
                                                    // Store full business info including category
                                                    setSelectedBusinessFilter({
                                                        id: business.id,
                                                        name: business.name,
                                                        category: business.category,
                                                        country: business.country
                                                    });
                                                    setSearchTerm(business.name);
                                                    setShowBusinessSuggestions(false);

                                                    // Auto-select the parent category of the business
                                                    if (business.category) {
                                                        // Extract parent category (before ":" if exists)
                                                        const parentCategory = business.category.includes(':')
                                                            ? business.category.split(':')[0].trim()
                                                            : business.category;

                                                        // Find matching category key in CATEGORIES
                                                        const categoryKey = Object.keys(CATEGORIES).find(key => {
                                                            const catName = getCategorySpanishName(key);
                                                            return catName === parentCategory || key === parentCategory;
                                                        });

                                                        if (categoryKey) {
                                                            setSelectedCategory(categoryKey);
                                                        }
                                                    }

                                                    // Auto-select country if business has one
                                                    if (business.country) {
                                                        setSelectedCountry(business.country);
                                                    }
                                                }}
                                                className="w-full px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors flex items-center gap-3 border-b border-gray-50 dark:border-zinc-700/50 last:border-0"
                                            >
                                                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0">
                                                    <i className="fa-solid fa-store text-gray-400 text-xs"></i>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                                                        {business.name}
                                                    </p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                        {getCategoryTranslation(business.category)}
                                                        {business.country && ` • ${COUNTRIES.find(c => c.code === business.country)?.name || business.country}`}
                                                    </p>
                                                </div>
                                                <i className="fa-solid fa-chevron-right text-gray-300 dark:text-gray-600 text-xs"></i>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Country filter */}
                    <div>
                        <label htmlFor="country-filter" className="block text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1 sm:mb-2">
                            {t('adminDashboard.country')}
                            {selectedBusinessFilter && (
                                <span className="ml-2 text-xs text-amber-500">
                                    <i className="fa-solid fa-lock text-[10px] mr-1"></i>
                                    {t('explorePage.lockedByBusiness') || 'bloqueado'}
                                </span>
                            )}
                        </label>
                        <select
                            id="country-filter"
                            value={selectedCountry || 'all'}
                            onChange={e => handleCountryChange(e.target.value === 'all' ? null : e.target.value)}
                            className={`w-full bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md p-2 text-sm text-gray-800 dark:text-white focus:ring-1 focus:ring-brand-green focus:border-brand-green h-[38px] ${
                                selectedBusinessFilter ? 'opacity-75' : ''
                            }`}
                        >
                            <option value="all">{t('common.allCountries')}</option>
                            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                        </select>
                    </div>

                    {/* Category filter - chips/badges */}
                    <div>
                        <label className="block text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1 sm:mb-2">
                            {t('common.category')}
                            {selectedBusinessFilter && (
                                <span className="ml-2 text-xs text-amber-500">
                                    <i className="fa-solid fa-lock text-[10px] mr-1"></i>
                                    {t('explorePage.lockedByBusiness') || 'bloqueado'}
                                </span>
                            )}
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                            <button
                                onClick={() => handleCategoryChange(null)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    selectedCategory === null
                                        ? 'bg-brand-green text-white shadow-md'
                                        : 'bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-600'
                                } ${selectedBusinessFilter ? 'opacity-75' : ''}`}
                            >
                                {t('common.all')}
                            </button>
                            {Object.keys(CATEGORIES).map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => handleCategoryChange(selectedCategory === cat ? null : cat)}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                        selectedCategory === cat
                                            ? 'bg-brand-green text-white shadow-md'
                                            : 'bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-600'
                                    } ${selectedBusinessFilter ? 'opacity-75' : ''}`}
                                    title={t(`categories.${cat}`)}
                                >
                                    {t(`categories.${cat}`)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Sort order */}
                    <div>
                        <label htmlFor="sort-order" className="block text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1 sm:mb-2">
                            {t('explorePage.sortBy')}
                        </label>
                        <select
                            id="sort-order"
                            value={sortOrder}
                            onChange={e => setSortOrder(e.target.value as SortOrder)}
                            className="w-full bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md p-2 text-sm text-gray-800 dark:text-white focus:ring-1 focus:ring-brand-green focus:border-brand-green h-[38px]"
                        >
                            <option value="newest">{t('explorePage.newestFirst')}</option>
                            <option value="oldest">{t('explorePage.oldestFirst')}</option>
                            <option value="most_helpful">{t('explorePage.mostHelpfulFirst')}</option>
                        </select>
                    </div>

                    {/* Date filter */}
                    <div>
                        <label htmlFor="date-filter" className="block text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1 sm:mb-2">
                            {t('explorePage.date')}
                        </label>
                        <select
                            id="date-filter"
                            value={dateFilter.type}
                            onChange={e => setDateFilter({type: e.target.value as DateFilterValue, startDate: '', endDate: ''})}
                            className="w-full bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md p-2 text-sm text-gray-800 dark:text-white focus:ring-1 focus:ring-brand-green focus:border-brand-green h-[38px]"
                        >
                            <option value="all">{t('explorePage.anyDate')}</option>
                            <option value="30d">{t('explorePage.last30Days')}</option>
                            <option value="6m">{t('explorePage.last6Months')}</option>
                            <option value="12m">{t('explorePage.last12Months')}</option>
                        </select>
                    </div>

                    {/* Rating filter - dual range slider */}
                    <div>
                        <label className="block text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1 sm:mb-2">
                            {t('explorePage.ratingRange')}
                        </label>
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

                    {/* Clear filters */}
                    <div className="pt-3 border-t border-gray-200 dark:border-zinc-800">
                        <button
                            onClick={handleClearFilters}
                            className="w-full bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600 text-gray-700 dark:text-gray-300 font-semibold py-2 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
                        >
                            <i className="fa-solid fa-broom"></i> {t('explorePage.clearFilters')}
                        </button>
                    </div>
                </div>
            </aside>
        );

        // Get paginated reviews for current page
        const startIndex = (page - 1) * REVIEWS_PER_PAGE;
        const endIndex = startIndex + REVIEWS_PER_PAGE;
        const paginatedReviews = reviews.slice(startIndex, endIndex);

        return (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 mt-6 sm:mt-8">
                {sidebar}
                <main className="lg:col-span-9">
                    {manualSearchError ? (
                        <div className="text-center py-16 text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-lg border-2 border-dashed border-red-200 dark:border-red-800/50">
                            <i className="fa-solid fa-triangle-exclamation text-6xl mb-4 text-red-500"></i>
                            <p className="font-semibold text-lg text-red-700 dark:text-red-300">{t('explorePage.searchErrorTitle')}</p>
                            <p className="text-sm mt-2 max-w-sm mx-auto">{manualSearchError}</p>
                        </div>
                    ) : loading ? (
                        <div className="flex flex-col justify-center items-center h-64 space-y-4 text-gray-500 dark:text-gray-300">
                            <Spinner />
                            <p className="font-semibold">{t('explorePage.searchingReviews')}</p>
                        </div>
                    ) : reviews.length === 0 ? (
                        <div className="text-center py-16 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-800/50 rounded-lg border-2 border-dashed border-gray-200 dark:border-zinc-700">
                            <i className="fa-solid fa-comments text-6xl mb-4 text-gray-400 dark:text-gray-600"></i>
                            <p className="font-semibold text-lg text-gray-700 dark:text-gray-300">{t('explorePage.noReviewsFound')}</p>
                            <p className="text-sm mt-2 max-w-sm mx-auto">{t('explorePage.noReviewsFoundSubtitle')}</p>
                        </div>
                    ) : (
                        <div className="space-y-5 sm:space-y-6">
                            {/* Pagination controls - TOP */}
                            <ReviewPaginationControls />

                            {/* Reviews grid - 2 columns on desktop, 1 on mobile */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
                                {paginatedReviews.map(review => {
                                    const isExpanded = expandedReviewId === review.id;
                                    const businessPath = review.businesses ? generateBusinessPath(review.businesses) : '#';

                                    return (
                                        <div
                                            key={review.id}
                                            className={`bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden transition-all duration-300 ${isExpanded ? 'lg:col-span-2 shadow-xl border-brand-green' : 'hover:border-brand-green hover:shadow-lg'}`}
                                        >
                                            {/* Clickable card header - expands/collapses */}
                                            <div
                                                onClick={() => setExpandedReviewId(isExpanded ? null : review.id)}
                                                className="p-4 sm:p-5 cursor-pointer"
                                            >
                                                {/* Business info header */}
                                                {review.businesses && (
                                                    <div className="flex items-start gap-3 mb-3">
                                                        <BusinessLogo
                                                            logoUrl={review.businesses.logo_url}
                                                            businessName={review.businesses.name}
                                                            className="w-12 h-12 sm:w-14 sm:h-14"
                                                            iconSize="text-xl"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <h3 className="font-bold text-gray-800 dark:text-gray-100 text-base sm:text-lg truncate">
                                                                {review.businesses.name}
                                                            </h3>
                                                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                                                                {getCategoryTranslation(review.businesses.category)}
                                                            </p>
                                                            {/* Rating stars */}
                                                            <div className="flex items-center gap-1 mt-1">
                                                                {[1, 2, 3, 4, 5].map(star => (
                                                                    <i
                                                                        key={star}
                                                                        className={`fa-${star <= (review.rating || 0) ? 'solid' : 'regular'} fa-star text-yellow-400 text-sm`}
                                                                    ></i>
                                                                ))}
                                                                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">
                                                                    {review.rating?.toFixed(1) || '-'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="text-gray-400 dark:text-gray-500">
                                                            <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-sm transition-transform`}></i>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Review preview */}
                                                <div className="text-gray-700 dark:text-gray-300 text-sm sm:text-base">
                                                    {review.title && <p className="font-semibold mb-1">{review.title}</p>}
                                                    <p className={isExpanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}>{review.review_text}</p>
                                                </div>

                                                {/* Review meta */}
                                                <div className="flex items-center justify-between mt-3 text-xs text-gray-500 dark:text-gray-400">
                                                    <span>
                                                        <i className="fa-regular fa-user mr-1"></i>
                                                        {review.author_name || t('common.anonymous')}
                                                    </span>
                                                    <span>
                                                        <i className="fa-regular fa-calendar mr-1"></i>
                                                        {review.created_at ? new Date(review.created_at).toLocaleDateString(language) : ''}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Expanded content - button to go to business */}
                                            {isExpanded && review.businesses && (
                                                <div className="px-4 sm:px-5 pb-4 sm:pb-5 border-t border-gray-100 dark:border-zinc-800 pt-4">
                                                    <Link
                                                        to={businessPath}
                                                        className="flex items-center justify-center gap-2 w-full bg-brand-green text-white font-semibold py-3 px-4 rounded-lg hover:bg-green-600 transition-all shadow-md"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <i className="fa-solid fa-store"></i>
                                                        {t('explorePage.viewBusinessProfile')}
                                                        <i className="fa-solid fa-arrow-right ml-2"></i>
                                                    </Link>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Pagination controls - BOTTOM */}
                            <ReviewPaginationControls />
                        </div>
                    )}
                </main>
            </div>
        );
    };
    
    const renderAiExploration = () => (
        <div className="max-w-4xl mx-auto mt-6 sm:mt-8">
            {/* Maintenance Banner */}
            {AI_SEARCH_MAINTENANCE && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-700 rounded-lg p-4 sm:p-6 mb-6 sm:mb-8">
                    <div className="flex items-start gap-3 sm:gap-4">
                        <div className="flex-shrink-0">
                            <i className="fa-solid fa-wrench text-2xl sm:text-3xl text-yellow-600 dark:text-yellow-400"></i>
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-bold text-yellow-800 dark:text-yellow-300 mb-1 sm:mb-2">
                                {t('explorePage.aiMaintenanceTitle')}
                            </h3>
                            <p className="text-sm sm:text-base text-yellow-700 dark:text-yellow-400">
                                {t('explorePage.aiMaintenanceMessage')}
                            </p>
                        </div>
                    </div>
                </div>
            )}
            <form onSubmit={handleAiSearch} className="flex items-center gap-2 mb-6 sm:mb-8 p-2 border border-gray-300 dark:border-zinc-700 rounded-lg shadow-sm bg-white dark:bg-zinc-800">
                <input
                    type="search"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder={t('explorePage.aiSearchPlaceholder')}
                    disabled={AI_SEARCH_MAINTENANCE}
                    className={`w-full p-2.5 sm:p-3 border-none focus:ring-0 text-sm sm:text-base bg-transparent text-gray-800 dark:text-white ${AI_SEARCH_MAINTENANCE ? 'opacity-50 cursor-not-allowed' : ''}`}
                />
                <button type="submit" disabled={isAiSearching || AI_SEARCH_MAINTENANCE} className="bg-brand-green text-white font-semibold px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 rounded-md text-sm sm:text-base hover:bg-green-600 transition-all shadow-sm flex items-center gap-2 disabled:bg-gray-500 disabled:cursor-not-allowed">
                    <i className="fa-solid fa-wand-magic-sparkles"></i>
                    <span className="hidden sm:inline">{isAiSearching ? t('common.searching') : t('explorePage.aiSearchButton')}</span>
                </button>
            </form>

            {aiError && <p className="text-center text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/30 p-4 rounded-lg">{aiError}</p>}
            {isAiSearching ? (
                 <div className="flex flex-col justify-center items-center h-64 space-y-4 text-gray-500 dark:text-gray-300">
                    <Spinner />
                    <p className="font-semibold">{t('explorePage.aiAnalyzing')}</p>
                </div>
            ) : groupedAiSearchResults.length > 0 ? (
                renderResultsList(groupedAiSearchResults, false, () => {}, false, false)
            ) : (
                <div className="text-center py-16 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-800/50 rounded-lg border-2 border-dashed border-gray-200 dark:border-zinc-700">
                    <i className="fa-solid fa-robot text-6xl mb-4 text-gray-400 dark:text-gray-600"></i>
                    <p className="font-semibold text-lg text-gray-700 dark:text-gray-300">{t('explorePage.aiAsk')}</p>
                    <p className="text-sm mt-2 max-w-sm mx-auto">{t('explorePage.aiAskSubtitle')}</p>
                </div>
            )}
        </div>
    );

    const renderMapExploration = () => (
        <div className="space-y-4 mt-6 sm:mt-8">
            {/* Location controls panel */}
            <div className="bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    <i className="fa-solid fa-location-dot mr-2"></i>
                    {t('explorePage.setLocationTitle')}
                </h3>

                <div className="space-y-3">
                    {/* Option 2: Text Search Input */}
                    <div className="relative">
                        <input
                            type="text"
                            placeholder={t('explorePage.searchLocationPlaceholder')}
                            className="w-full px-3 pr-10 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg text-sm text-gray-800 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-brand-green focus:border-brand-green transition-all"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const query = e.currentTarget.value.trim();
                                    if (query) {
                                        handleSearchLocation(query);
                                        e.currentTarget.value = '';
                                    }
                                }
                            }}
                            disabled={geolocating}
                        />
                        <i className="fa-solid fa-search absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none"></i>
                    </div>

                    {/* Option 1: GPS Button */}
                    <button
                        onClick={handleUseMyLocation}
                        disabled={geolocating}
                        className="w-full flex items-center justify-center gap-2 bg-brand-green text-white font-semibold py-2.5 px-4 rounded-lg text-sm hover:bg-green-600 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
                    >
                        {geolocating ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <i className="fa-solid fa-location-crosshairs"></i>
                        )}
                        <span>{t('explorePage.nearMe')}</span>
                    </button>

                    {/* Option 3: Click on map instruction */}
                    <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
                        <i className="fa-solid fa-hand-pointer mr-1"></i>
                        {t('explorePage.clickMapToSetLocation')}
                    </p>

                    {/* Radius slider - shown when location is set OR a business is selected */}
                    {(filterCenter || selectedBusinessId) && (
                        <div className="pt-3 border-t border-gray-200 dark:border-zinc-700 space-y-3">
                            {/* Radius slider */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                        <i className="fa-solid fa-circle-dot mr-1 text-brand-green"></i>
                                        {t('explorePage.searchRadius')}
                                    </label>
                                    <span className="text-sm font-bold text-brand-green">{radiusKm} km</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="100"
                                    value={radiusKm}
                                    onChange={(e) => setRadiusKm(Number(e.target.value))}
                                    className="w-full h-2 bg-gray-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-brand-green"
                                />
                                <div className="flex justify-between text-xs text-gray-400 mt-1">
                                    <span>1 km</span>
                                    <span>50 km</span>
                                    <span>100 km</span>
                                </div>
                            </div>

                            {/* Status and clear button - only show clear when filterCenter is set */}
                            {filterCenter && (
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-600 dark:text-gray-400">
                                        <i className="fa-solid fa-circle-check text-green-600 mr-1"></i>
                                        {t('explorePage.locationActive')} ({radiusKm}km)
                                    </span>
                                    <button
                                        onClick={() => {
                                            setFilterCenter(null);
                                            setSelectedBusinessId(null);
                                            if (userMarkerRef.current) {
                                                userMarkerRef.current.remove();
                                                userMarkerRef.current = null;
                                            }
                                        }}
                                        className="text-xs text-red-600 dark:text-red-400 hover:underline"
                                    >
                                        <i className="fa-solid fa-xmark mr-1"></i>
                                        {t('explorePage.clearLocationFilter')}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Existing map grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 md:gap-8">
                <div className="lg:col-span-7 xl:col-span-8">
                    <div id="explore-map-large" ref={mapContainerRef} className="w-full h-[60vh] sm:h-[70vh] md:h-[75vh] bg-gray-200 dark:bg-zinc-800 rounded-lg shadow-md border border-gray-300 dark:border-zinc-700"></div>
                </div>
            <aside className="lg:col-span-5 xl:col-span-4 h-[60vh] sm:h-[70vh] md:h-[75vh] overflow-y-auto pr-2 space-y-3 sm:space-y-4">
                {selectedBusinessId ? (
                    <>
                        {selectedBusinessForDisplay && (() => {
                            const selectedDistance = filterCenter && selectedBusinessForDisplay.latitude && selectedBusinessForDisplay.longitude
                                ? getDistanceFromLatLonInKm(filterCenter.lat, filterCenter.lng, selectedBusinessForDisplay.latitude, selectedBusinessForDisplay.longitude)
                                : null;
                            // Use real review_count from business data (not just loaded reviews)
                            const businessData = groupedReviews.find(g => g.business?.id === selectedBusinessId)?.business;
                            const reviewCount = businessData?.review_count || 0;
                            return (
                            <div className="bg-white dark:bg-zinc-800 border-2 border-brand-green p-4 sm:p-5 rounded-xl shadow-lg">
                                <div className="flex gap-3 sm:gap-4 mb-4">
                                    <BusinessLogo logoUrl={selectedBusinessForDisplay.logo_url} businessName={selectedBusinessForDisplay.name} className="w-16 h-16 sm:w-20 sm:h-20" iconSize="text-3xl" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100 pr-2">{selectedBusinessForDisplay.name}</h3>
                                            <button onClick={() => { setSelectedBusinessId(null); }} className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 p-1">
                                                <i className="fa-solid fa-times"></i>
                                            </button>
                                        </div>
                                        {reviewCount > 0 && (
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1.5">
                                                <i className="fa-solid fa-comments mr-1.5 text-amber-500"></i>
                                                {reviewCount} {reviewCount === 1 ? t('common.review') : t('common.reviews')}
                                            </p>
                                        )}
                                        {selectedDistance !== null && (
                                            <p className="text-sm text-green-600 dark:text-green-400 font-medium mt-1">
                                                <i className="fa-solid fa-route mr-1.5"></i>
                                                {selectedDistance < 1
                                                    ? `${(selectedDistance * 1000).toFixed(0)}m`
                                                    : `${selectedDistance.toFixed(1)}km`}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <Link
                                    to={generateBusinessPath(selectedBusinessForDisplay)}
                                    className="w-full block text-center bg-brand-green text-white font-bold py-3 px-4 rounded-lg hover:bg-green-600 transition-all text-sm shadow-md"
                                >
                                    <i className="fa-solid fa-store mr-2"></i>
                                    {t('explorePage.viewBusinessProfile')}
                                </Link>
                            </div>
                            );
                        })()}
                        {renderResultsList(groupedReviews, loading, handleLoadMore, loadingMore, hasMore, businessCount, selectedCountry, selectedCategory, { hideBusinessInfo: true })}

                        {/* Otras empresas cercanas (basado en ubicación del usuario o empresa seleccionada) */}
                        {nearbyBusinesses.filter(b => b.id !== selectedBusinessId).length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-zinc-700">
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                                    <i className="fa-solid fa-building mr-2 text-brand-green"></i>
                                    {t('explorePage.otherNearbyBusinesses')}
                                </h4>
                                <div className="space-y-2">
                                    {nearbyBusinesses.filter(b => b.id !== selectedBusinessId).slice(0, 10).map(business => (
                                        <button
                                            key={business.id}
                                            onClick={() => setSelectedBusinessId(business.id)}
                                            className="w-full text-left bg-gray-50 dark:bg-zinc-700/50 border border-gray-200 dark:border-zinc-600 p-2 rounded-lg hover:border-brand-green dark:hover:border-brand-green transition-all"
                                        >
                                            <div className="flex items-center gap-2">
                                                <BusinessLogo logoUrl={business.logo_url} businessName={business.name} className="w-8 h-8" iconSize="text-sm" />
                                                <div className="flex-1 min-w-0">
                                                    <h5 className="font-medium text-gray-800 dark:text-gray-100 truncate text-xs">{business.name}</h5>
                                                    <p className="text-xs text-green-600 dark:text-green-400">
                                                        <i className="fa-solid fa-route mr-1"></i>
                                                        {business.distance < 1
                                                            ? `${(business.distance * 1000).toFixed(0)}m`
                                                            : `${business.distance.toFixed(1)}km`}
                                                    </p>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                ) : filterCenter && nearbyBusinesses.length > 0 ? (
                    <div className="space-y-3">
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                            <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                                <i className="fa-solid fa-location-dot mr-2"></i>
                                {nearbyBusinesses.length} {nearbyBusinesses.length === 1 ? t('explorePage.businessNearby') : t('explorePage.businessesNearby')} ({radiusKm}km)
                            </p>
                        </div>
                        {nearbyBusinesses.slice(0, 30).map(business => (
                            <button
                                key={business.id}
                                onClick={() => setSelectedBusinessId(business.id)}
                                className="w-full text-left bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 p-3 rounded-lg shadow-sm hover:border-brand-green dark:hover:border-brand-green hover:shadow-md transition-all"
                            >
                                <div className="flex items-center gap-3">
                                    <BusinessLogo logoUrl={business.logo_url} businessName={business.name} className="w-10 h-10" iconSize="text-lg" />
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-semibold text-gray-800 dark:text-gray-100 truncate text-sm">{business.name}</h4>
                                        <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                                            <i className="fa-solid fa-route mr-1"></i>
                                            {business.distance < 1
                                                ? `${(business.distance * 1000).toFixed(0)}m`
                                                : `${business.distance.toFixed(1)}km`}
                                        </p>
                                    </div>
                                    <i className="fa-solid fa-chevron-right text-gray-400 dark:text-gray-500"></i>
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-800/50 rounded-lg border-2 border-dashed border-gray-200 dark:border-zinc-700 p-4">
                        <i className="fa-solid fa-hand-pointer text-6xl mb-4 text-gray-400 dark:text-gray-600"></i>
                        <p className="font-semibold text-lg text-gray-700 dark:text-gray-300">{t('explorePage.selectBusinessOnMap')}</p>
                        <p className="text-sm mt-2 max-w-sm mx-auto">{t('explorePage.selectBusinessOnMapSubtitle')}</p>
                    </div>
                )}
            </aside>
            </div>
        </div>
    );

    const renderResultsList = (
        groupedResults: Array<{ business: SimpleBusiness; reviews: Review[] }>,
        isLoading: boolean,
        onLoadMore: (fromOtherCountries?: boolean) => void,
        isLoadingMore: boolean,
        hasMoreResults: boolean,
        counts?: { totalGlobal: number; totalInCountry: number; totalInCategory: number; matchingAll: number },
        countryFilter?: string | null,
        categoryFilter?: string | null,
        options: { hideBusinessInfo?: boolean } = {}
    ) => {
        const { hideBusinessInfo = false } = options;

        // Note: Shuffle is now done at the data level (groupedReviews useMemo), not here
        // This avoids using hooks inside render functions which violates React rules
        const shuffledResults = groupedResults;

        // Determine how many businesses from the target country are shown
        const displayedCount = shuffledResults.length;
        const targetCount = counts
            ? (countryFilter && categoryFilter
                ? counts.matchingAll
                : countryFilter
                    ? counts.totalInCountry
                    : counts.totalInCategory)
            : 0;

        // Check if all target businesses are shown
        const allTargetShown = counts && displayedCount >= targetCount && targetCount > 0;

        // Determine if we're showing businesses from other countries (fallback mode)
        const showingFallback = countryFilter && categoryFilter && counts && counts.matchingAll === 0;

        // Should we load from other countries?
        const shouldLoadFromOtherCountries = !!(allTargetShown && !showingFallback && countryFilter);

        const loadMoreButton = (hasMoreResults || shouldLoadFromOtherCountries) && shuffledResults.length > 0 && (
            <div className="pt-3 sm:pt-4 text-center space-y-2">
                {/* Si todas las empresas del país están mostradas pero hay más de otros países */}
                {shouldLoadFromOtherCountries && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        <i className="fa-solid fa-check-circle text-green-500 mr-1"></i>
                        {t('explorePage.allBusinessesFromCountryShown')}
                    </p>
                )}
                <button
                    onClick={() => onLoadMore(shouldLoadFromOtherCountries)}
                    disabled={isLoadingMore}
                    className="bg-brand-green text-white font-semibold px-4 sm:px-5 md:px-6 py-2.5 sm:py-3 rounded-md text-sm sm:text-base hover:bg-green-600 transition-all shadow-sm disabled:bg-gray-500"
                >
                    {isLoadingMore ? t('common.loading') : (
                        shouldLoadFromOtherCountries
                            ? t('explorePage.loadMoreFromOtherCountries')
                            : t('explorePage.loadMore')
                    )}
                </button>
            </div>
        );

        if (isLoading) {
             return <div className="flex flex-col justify-center items-center h-64 space-y-4 text-gray-500 dark:text-gray-300"><Spinner /><p className="font-semibold">{t('explorePage.searchingResults')}</p></div>;
        }

        if (shuffledResults.length === 0) {
            // Special message when location filter is active but no businesses in radius
            // Made more subtle so it doesn't overshadow the selected business card
            if (filterCenter && businessIdsInRadius && businessIdsInRadius.length === 0) {
                return (
                    <div className="bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-lg p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                            <i className="fa-solid fa-info-circle mr-1.5 text-gray-400"></i>
                            {t('explorePage.noBusinessesInRadiusMessage', { radius: radiusKm })}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setRadiusKm(prev => prev + 10)}
                                className="px-2.5 py-1 text-xs font-medium bg-brand-green hover:bg-green-600 text-white rounded transition-colors"
                            >
                                <i className="fa-solid fa-plus mr-1"></i>
                                {t('explorePage.increaseRadius', { newRadius: radiusKm + 10 })}
                            </button>
                            <button
                                onClick={() => setFilterCenter(null)}
                                className="px-2.5 py-1 text-xs font-medium bg-gray-200 hover:bg-gray-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-gray-700 dark:text-gray-300 rounded transition-colors"
                            >
                                <i className="fa-solid fa-times mr-1"></i>
                                {t('explorePage.clearLocationFilter')}
                            </button>
                        </div>
                    </div>
                );
            }

            // Default no results message
            return <div className="text-center py-16 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-800/50 rounded-lg border-2 border-dashed border-gray-200 dark:border-zinc-700"><i className="fa-solid fa-compass-drafting text-6xl mb-4 text-gray-400 dark:text-gray-600"></i><p className="font-semibold text-lg text-gray-700 dark:text-gray-300">{t('explorePage.noResultsFound')}</p><p className="text-sm mt-2 max-w-sm mx-auto">{t('explorePage.noResultsFoundSubtitle')}</p></div>;
        }

        if (hideBusinessInfo) {
            const allReviews = shuffledResults.flatMap(group => group.reviews);
            return <div className="space-y-4">{allReviews.map(review => <LazyRender key={review.id} placeholderHeight="250px"><ReviewCard review={review} /></LazyRender>)}{loadMoreButton}</div>;
        }

        return (
            <>
                {/* Layout de grid de 2 columnas con tarjetas grandes */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
                    {shuffledResults.map(group => {
                        if (!group.business) return null;

                        const businessPath = generateBusinessPath(group.business);
                        // Usar review_count real del negocio, con fallback a las reseñas cargadas
                        const totalReviewsCount = group.business?.review_count || group.reviews.length;
                        const avgRating = group.business?.avg_rating || group.business?.average_rating || 0;

                        // Get location info from sedes
                        const sedes = Array.isArray(group.business.sedes) ? group.business.sedes as Sede[] : [];
                        const firstSede = sedes.length > 0 ? sedes[0] : null;
                        const locationCity = firstSede?.city || '';
                        const locationState = firstSede?.state || '';
                        const locationCountry = group.business.country || '';
                        const locationDisplay = [locationCity, locationState].filter(Boolean).join(', ') ||
                            COUNTRIES.find(c => c.code === locationCountry)?.name || '';

                        // Phone from first sede
                        const phone = firstSede?.contact_phone || '';

                        // Check if has multiple sedes (international presence)
                        const hasMultipleSedes = sedes.length > 1;

                        return (
                            <Link
                                key={group.business.id}
                                to={businessPath}
                                className="bg-white dark:bg-zinc-900 p-4 sm:p-5 md:p-6 rounded-xl border border-gray-200 dark:border-zinc-800 hover:border-brand-green dark:hover:border-brand-green hover:shadow-lg transition-all group"
                            >
                                {/* Header con logo y nombre */}
                                <div className="flex items-start gap-4 mb-4">
                                    <BusinessLogo
                                        logoUrl={group.business.logo_url}
                                        businessName={group.business.name}
                                        className="w-16 h-16 sm:w-20 sm:h-20"
                                        iconSize="text-2xl sm:text-3xl"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100 group-hover:text-brand-green transition-colors line-clamp-2">
                                            {group.business.name}
                                        </h3>
                                        {/* Rating y reseñas */}
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="flex items-center text-yellow-400">
                                                {[1, 2, 3, 4, 5].map(star => (
                                                    <i
                                                        key={star}
                                                        className={`fa-${star <= Math.round(avgRating) ? 'solid' : 'regular'} fa-star text-sm`}
                                                    ></i>
                                                ))}
                                            </div>
                                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                {avgRating > 0 ? avgRating.toFixed(1) : '-'}
                                            </span>
                                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                                ({totalReviewsCount} {totalReviewsCount === 1 ? t('common.review') : t('common.reviews')})
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Información detallada */}
                                <div className="space-y-2 text-sm">
                                    {/* Ubicación */}
                                    {locationDisplay && (
                                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                            <i className="fa-solid fa-location-dot w-4 text-center text-gray-400"></i>
                                            <span className="truncate">{locationDisplay}</span>
                                            {hasMultipleSedes && (
                                                <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">
                                                    +{sedes.length - 1} {t('explorePage.locations')}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Teléfono */}
                                    {phone && (
                                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                            <i className="fa-solid fa-phone w-4 text-center text-gray-400"></i>
                                            <span>{phone}</span>
                                        </div>
                                    )}

                                    {/* Categoría */}
                                    {group.business.category && (
                                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                            <i className="fa-solid fa-tag w-4 text-center text-gray-400"></i>
                                            <span>{getCategoryTranslation(group.business.category)}</span>
                                        </div>
                                    )}

                                    {/* Indicador de múltiples sedes */}
                                    {hasMultipleSedes && (
                                        <div className="flex items-center gap-2 pt-1">
                                            <span className="inline-flex items-center gap-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded-full">
                                                <i className="fa-solid fa-globe"></i>
                                                {t('explorePage.multipleLocations')}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Footer - CTA */}
                                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between">
                                    <span className="text-sm text-gray-500 dark:text-gray-400">
                                        {t('explorePage.viewProfileAndAllReviews')}
                                    </span>
                                    <i className="fa-solid fa-arrow-right text-brand-green group-hover:translate-x-1 transition-transform"></i>
                                </div>
                            </Link>
                        );
                    })}
                </div>
                {loadMoreButton}
            </>
        );
    };

    return (
        <>
        <Meta title={metaTitle} description={metaDescription} noindex={hasActiveFilters} />
        <style>{`
            ${iconStyle}
            @keyframes fade-in-up { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }
            .animate-fade-in-up { animation: fade-in-up 0.3s ease-out forwards; }
        `}</style>
        <div>
            <div className="text-center mb-6 sm:mb-8 md:mb-10 -mt-2 sm:-mt-4">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-brand-dark dark:text-gray-100">{exploreTitle}</h1>
                <p className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-400 mt-1 sm:mt-2">{exploreSubtitle}</p>
            </div>
             <div className="flex items-center gap-1 sm:gap-2 mb-6 sm:mb-8 justify-center p-1 bg-gray-100 dark:bg-zinc-800 rounded-lg">
                <button onClick={() => setActiveTab('manual')} className={`px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 font-semibold rounded-md transition-colors text-xs sm:text-sm flex items-center gap-1 sm:gap-2 ${activeTab === 'manual' ? 'bg-white dark:bg-zinc-700 text-gray-800 dark:text-white shadow' : 'bg-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'}`}>
                    <i className="fa-solid fa-sliders"></i> <span className="hidden sm:inline">{t('explorePage.exploreManual')}</span>
                </button>
                <button onClick={() => setActiveTab('ai')} className={`px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 font-semibold rounded-md transition-colors text-xs sm:text-sm flex items-center gap-1 sm:gap-2 ${activeTab === 'ai' ? 'bg-white dark:bg-zinc-700 text-gray-800 dark:text-white shadow' : 'bg-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'}`}>
                    <i className="fa-solid fa-wand-magic-sparkles"></i> <span className="hidden sm:inline">{t('explorePage.exploreAI')}</span>
                </button>
                <button onClick={() => setActiveTab('map')} className={`px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 font-semibold rounded-md transition-colors text-xs sm:text-sm flex items-center gap-1 sm:gap-2 ${activeTab === 'map' ? 'bg-white dark:bg-zinc-700 text-gray-800 dark:text-white shadow' : 'bg-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'}`}>
                    <i className="fa-solid fa-map-location-dot"></i> <span className="hidden sm:inline">{t('explorePage.exploreMap')}</span>
                </button>
            </div>
            
            {renderContent()}

        </div>

        {/* Location permission modals */}
        <LocationPermissionModal
            isOpen={showLocationPermissionModal}
            onAllow={handleAllowLocation}
            onDeny={handleDenyLocation}
        />
        <LocationNotAvailableModal
            isOpen={showLocationNotAvailableModal}
            onClose={() => setShowLocationNotAvailableModal(false)}
        />

        {/* Filter change confirmation modal */}
        <FilterChangeConfirmModal
            isOpen={showFilterChangeModal}
            businessName={selectedBusinessFilter?.name || ''}
            onConfirm={handleConfirmFilterChange}
            onCancel={handleCancelFilterChange}
        />

        {/* Floating Write Review Button */}
        <Link
            to={`${countryPrefix}/${paths.writeReview}`}
            className="fixed bottom-24 right-6 w-14 h-14 bg-brand-green hover:bg-opacity-90 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center z-40 group"
            aria-label={t('header.writeReview')}
        >
            <i className="fa-solid fa-pencil text-xl group-hover:scale-110 transition-transform"></i>
        </Link>
        </>
    );
};

export default ExplorePage;
