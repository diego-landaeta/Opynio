import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
// FIX: Changed react-router-dom imports to a namespace import to resolve module resolution issues.
// FIX: Changed react-router-dom namespace import to named imports to resolve module resolution issues.
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import NotFoundPage from './NotFoundPage';
import type { Review, Business, AiInsight, BusinessHours, Sede } from '../../types';
import { getBusinessInsights } from '../../services/geminiService';
import { getBusinessById, getBusinessByName, getBusinessBySlug, getRedirectByOldSlug, supabase, getReviewRatingDistribution, getReviewSourceCounts, updateBusinessProfile } from '../../services/supabaseService';
import { getReviewsOptimized } from '../../services/optimizedQueries';
import ReviewCard from '../ReviewCard';
import StarRating from '../StarRating';
import Spinner from '../Spinner';
import L from 'leaflet';
import Meta from '../Meta';
import Schema from '../Schema';
import { useAuth } from '../../contexts/AuthContext';
import RatingDistribution from '../RatingDistribution';
import Modal from '../Modal';
import LazyRender from '../LazyRender';
import { useNotification } from '../../contexts/NotificationContext';
import { useI18n, pathTranslations, useTranslation, useAutoTranslations, getLanguageForCountryCode, translations } from '../../contexts/i18nContext';
import { useCountry } from '../../contexts/CountryContext';
import { COUNTRIES, SEDE_COUNTRIES } from '../../constants';
import { getSubcategoryKey } from '../../utils/categoryMappings';

const PAGE_SIZE = 20; // Reduced from 50 for better performance

const PlaceholderMessage: React.FC<{ icon: string; title: string; message: string; }> = React.memo(({ icon, title, message }) => (
    <div className="w-full bg-gray-50 dark:bg-zinc-800/50 rounded-lg flex items-center justify-center border border-gray-200 dark:border-zinc-700 p-6 sm:p-8 min-h-[140px] sm:min-h-[160px]">
        <div className="text-center text-gray-500 dark:text-gray-400">
            <div className="text-3xl sm:text-4xl text-gray-300 dark:text-gray-600 mb-2 sm:mb-3">
                <i className={`fa-solid ${icon}`}></i>
            </div>
            <p className="font-semibold text-sm sm:text-base text-gray-700 dark:text-gray-300">{title}</p>
            <p className="text-xs sm:text-sm mt-1">{message}</p>
        </div>
    </div>
));

const FilterChip: React.FC<{ label: string; isActive: boolean; onClick: () => void }> = React.memo(({ label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`px-2 sm:px-2.5 md:px-3 py-1 text-[10px] sm:text-xs font-semibold rounded-full transition-colors whitespace-nowrap ${isActive ? 'bg-brand-green text-white' : 'bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-600'}`}
    >
        {label}
    </button>
));


const BusinessPage: React.FC = () => {
    const { identifier, countryCode } = useParams<{ identifier: string; countryCode: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { user, profile } = useAuth();
    const { showNotification } = useNotification();
    const { language } = useI18n();
    const { country } = useCountry();
    const t = useTranslation();

    const [business, setBusiness] = useState<Business | null>(null);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [insights, setInsights] = useState<AiInsight | null>(null);
    const [isLoadingBusiness, setIsLoadingBusiness] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isLoadingInsights, setIsLoadingInsights] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [ratingDistribution, setRatingDistribution] = useState<Record<number, number>>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    
    // States for review source filtering
    const [sourceFilter, setSourceFilter] = useState<'all' | 'opynio' | 'google' | 'trustindex'>('all');
    // FIX: Updated the sourceCounts state to include 'trustindex' to correctly handle and display review counts from the new source.
    const [sourceCounts, setSourceCounts] = useState<{ opynio: number, google: number, trustindex: number } | null>(null);
    const [ratingFilter, setRatingFilter] = useState<'all' | '5' | '4+' | '3-'>('all');

    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<L.Map | null>(null);
    const markersLayerRef = useRef<L.LayerGroup | null>(null);
    const [mapError, setMapError] = useState(false);
    
    const { content: translatedContent, isTranslating } = useAutoTranslations({
        description: business?.description,
    });

    const { totalReviews, averageRating } = useMemo(() => {
        if (!ratingDistribution) {
            return { totalReviews: 0, averageRating: 0 };
        }
        const total = Object.values(ratingDistribution).reduce((sum: number, count) => sum + (count as number), 0);
        if (total === 0) {
            return { totalReviews: 0, averageRating: 0 };
        }

        const sum = Object.entries(ratingDistribution).reduce((acc, [rating, count]) => {
            return acc + (parseInt(rating, 10) * (count as number));
        }, 0);

        const avg = sum / total;

        return { totalReviews: total, averageRating: avg };
    }, [ratingDistribution]);

    // Función de traducción que usa el idioma del PAÍS de la empresa (no el del usuario)
    // Esto asegura que los metadatos estén en el idioma correcto del país
    const tMeta = useCallback((key: string, params?: Record<string, any>) => {
        if (!business?.country) return t(key, params);
        const countryLang = getLanguageForCountryCode(business.country);
        const langTranslations = translations[countryLang] || translations.es;
        const keys = key.split('.');
        let value: any = langTranslations;
        for (const k of keys) {
            value = value?.[k];
            if (value === undefined) return t(key, params);
        }
        if (typeof value !== 'string') return t(key, params);
        if (!params) return value;
        return Object.entries(params).reduce((str, [k, v]) => str.replace(`{${k}}`, String(v)), value);
    }, [business?.country, t]);

    // Obtener el idioma para el atributo lang del HTML según el país de la empresa
    const pageLang = useMemo(() => {
        if (!business?.country) return 'es';
        return getLanguageForCountryCode(business.country);
    }, [business?.country]);

    // Traducir categoría usando el idioma del país (para metadatos)
    const translatedCategory = useMemo(() => {
        const categoryString = business?.category;
        if (!categoryString || !categoryString.includes(':')) {
            return categoryString || tMeta('common.unspecified');
        }
        const [mainKey, subKey] = categoryString.split(':');
        const main = tMeta(`categories.${mainKey.trim()}`);

        // Use mapping to get the correct subcategory translation key
        // Check if already in snake_case or Spanish format
        const trimmedSubKey = subKey.trim();
        const subCategoryKey = trimmedSubKey.includes('_') ? trimmedSubKey : getSubcategoryKey(trimmedSubKey);
        const sub = subCategoryKey ? tMeta(`subcategories.${subCategoryKey}`) : trimmedSubKey;

        // Fallback if translation not found
        if (main.startsWith('categories.') || (subCategoryKey && sub.startsWith('subcategories.'))) {
            return categoryString.replace(':', ' - ').replace(/_/g, ' ');
        }

        return `${main} - ${sub}`;
    }, [business?.category, tMeta]);

    const activeCountryCode = useMemo(() => {
        return countryCode?.toUpperCase();
    }, [countryCode]);

    // Calcular todos los países válidos para esta empresa
    const validCountryCodes = useMemo(() => {
        if (!business) return new Set<string>();
        const mainCountry = business.country?.toUpperCase();
        const sedeCountries = ((business.sedes as unknown as Sede[]) || [])
            .map(s => s.country_code?.toUpperCase())
            .filter(Boolean) as string[];
        return new Set([mainCountry, ...sedeCountries].filter(Boolean));
    }, [business]);

    // SEO: Detectar si el país de la URL es incorrecto para esta empresa
    // LÓGICA PERMISIVA: Solo aplicar noindex si la empresa TIENE país definido
    // y el país de la URL no coincide. Si no tiene país, permitir indexar (más seguro).
    const isWrongCountry = useMemo(() => {
        if (!business || !activeCountryCode) return false;

        // CRÍTICO: Si la empresa NO tiene país definido, NO bloquear indexación
        // Esto evita bloquear empresas que están en proceso de configuración
        if (!business.country) return false;

        // Solo marcar como incorrecto si:
        // 1. La empresa TIENE país/países definidos
        // 2. Y el país de la URL NO está en la lista de países válidos
        const isWrong = validCountryCodes.size > 0 && !validCountryCodes.has(activeCountryCode);

        // DEBUG: Log para detectar problemas de indexación (solo en desarrollo)
        if (import.meta.env.DEV) {
            console.log('[SEO Debug]', {
                businessName: business.name,
                businessCountry: business.country,
                activeCountryCode,
                validCountries: Array.from(validCountryCodes),
                isWrongCountry: isWrong
            });
        }

        return isWrong;
    }, [business, activeCountryCode, validCountryCodes]);

    const allSedes = useMemo(() => {
        if (!business) return [];
        const mainSede = { country_code: business.country || 'ES', website_url: business.website_url, logo_url: business.logo_url };
        const otherSedes = (business.sedes as unknown as Sede[]) || [];
        const uniqueSedes = [
            mainSede,
            ...otherSedes.filter(s => s.country_code !== mainSede.country_code)
        ];
        return uniqueSedes.map(s => {
            // Try to find in COUNTRIES first (Opynio operating countries)
            let countryInfo = COUNTRIES.find(c => c.code === s.country_code);
            // If not found, try SEDE_COUNTRIES (all possible business locations)
            if (!countryInfo) {
                countryInfo = SEDE_COUNTRIES.find(c => c.code === s.country_code);
            }
            return { ...s, ...countryInfo };
        }).filter(sede => sede.country_code && sede.flag); // Filter only valid countries with flag
    }, [business]);

    const currentSedeData = useMemo(() => {
        if (!business) return null;
        return allSedes.find(s => s.country_code === activeCountryCode);
    }, [business, allSedes, activeCountryCode]);

    // Sede-specific data with fallback to main location
    const logoToDisplay = currentSedeData?.logo_url || business?.logo_url;
    const websiteToDisplay = currentSedeData?.website_url || business?.website_url;
    const contactPhoneToDisplay = currentSedeData?.contact_phone || business?.contact_phone;
    const contactEmailToDisplay = currentSedeData?.contact_email || business?.contact_email;
    const googleMapsUrlToDisplay = currentSedeData?.google_maps_url || business?.google_maps_url;
    const horariosToDisplay = currentSedeData?.horarios || business?.horarios;
    const socialLinksToDisplay = currentSedeData?.social_links || business?.social_links;
    const latitudeToDisplay = currentSedeData?.latitude ?? business?.latitude;
    const longitudeToDisplay = currentSedeData?.longitude ?? business?.longitude;

    // Check if current sede has location data
    const hasSedeLocation = useMemo(() => latitudeToDisplay != null && longitudeToDisplay != null, [latitudeToDisplay, longitudeToDisplay]);


    const handleWriteReviewClick = () => {
        if (!business) return;

        // Use country directly - don't infer from language
        const countryPrefix = country ? `/${country.toLowerCase()}` : '';
        const pathLang = country ? getLanguageForCountryCode(country) : language;
        const paths = pathTranslations[pathLang] || pathTranslations.es;

        if (user) {
            navigate(`${countryPrefix}/${paths.writeReview}`, { state: { businessId: business.id } });
        } else {
            const postLoginAction = {
                action: 'write_review',
                businessId: business.id,
            };
            localStorage.setItem('postLoginAction', JSON.stringify(postLoginAction));
            navigate(`${countryPrefix}/${paths.login}`, { state: { from: location } });
        }
    };

    const { isOpen, schedule } = useMemo(() => {
        if (!horariosToDisplay || Object.keys(horariosToDisplay).length === 0) {
            return { isOpen: false, schedule: null };
        }

        const now = new Date();
        const days = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
        const todayKey = days[now.getDay()] as keyof BusinessHours;
        const todayHours = (horariosToDisplay as BusinessHours)[todayKey];

        let isOpenNow = false;
        if (todayHours && todayHours !== 'cerrado' && typeof todayHours !== 'string') {
            const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            if (currentTime >= todayHours.open && currentTime < todayHours.close) {
                isOpenNow = true;
            }
        }

        const orderedDays = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

        return {
            isOpen: isOpenNow,
            schedule: orderedDays.map(day => ({
                day: t(`businessPage.day_${day}` as any),
                hours: (horariosToDisplay as BusinessHours)[day as keyof BusinessHours]
            }))
        };
    }, [horariosToDisplay, t]);

    const socialLinks = useMemo(() => {
        if (socialLinksToDisplay && typeof socialLinksToDisplay === 'object' && socialLinksToDisplay !== null) {
            const links = socialLinksToDisplay as { [key: string]: string | undefined };
            return {
                twitter: links.twitter,
                instagram: links.instagram
            };
        }
        return { twitter: null, instagram: null };
    }, [socialLinksToDisplay]);

    const currentYear = new Date().getFullYear();

    const metaTitle = useMemo(() => {
        if (!business) return 'Opynio - Reseñas Auténticas de Confianza';
        const nameToDisplay = business.name;
        if (totalReviews > 0) {
            return tMeta('meta.businessTitle', { businessName: nameToDisplay, rating: averageRating.toFixed(1), reviewCount: totalReviews, category: translatedCategory, year: currentYear });
        }
        return tMeta('meta.businessTitleNoReviews', { businessName: nameToDisplay, category: translatedCategory, year: currentYear });
    }, [business, tMeta, totalReviews, averageRating, translatedCategory, currentYear]);

    const metaDescription = useMemo(() => {
        if (!business) return "Opynio: opiniones reales que te ayudan a elegir con confianza.";
        if (business.meta_description_override && business.meta_description_override.trim() !== '') return business.meta_description_override;
        const nameToDisplay = business.name;
        if (totalReviews > 0) {
            return tMeta('meta.businessDesc', { reviewCount: totalReviews, businessName: nameToDisplay, rating: averageRating.toFixed(1) });
        }
        return tMeta('meta.businessDescNoReviews', { businessName: nameToDisplay, category: translatedCategory });
    }, [business, tMeta, totalReviews, averageRating, translatedCategory]);

    const schemaData = useMemo(() => {
        if (!business) return null;
        const reviewsForSchema = reviews.filter(r => r.review_text && r.review_text.trim() !== '').slice(0, 10);
        // URL canónica para Schema - usar slug si existe
        const slug = (business as any).slug || encodeURIComponent(business.name.replace(/ /g, '_'));
        const prefix = (activeCountryCode || business.country || 'es').toLowerCase();
        const targetLang = getLanguageForCountryCode(activeCountryCode || business.country);
        const paths = pathTranslations[targetLang] || pathTranslations.es;
        const cleanUrl = `https://web.opynio.com/${prefix}/${paths.business.replace(':identifier', slug)}`;
        const data: { [key: string]: any } = { "@context": "https://schema.org", "@type": hasSedeLocation ? "LocalBusiness" : "Organization", "name": business.name, "url": cleanUrl };
        if (logoToDisplay) data.image = logoToDisplay;
        if (business.description) data.description = business.description;
        if (contactPhoneToDisplay) data.telephone = contactPhoneToDisplay;
        if (contactEmailToDisplay) data.email = contactEmailToDisplay;
        if (hasSedeLocation) { data.geo = { "@type": "GeoCoordinates", "latitude": latitudeToDisplay, "longitude": longitudeToDisplay }; }
        if (hasSedeLocation && googleMapsUrlToDisplay) data.address = { "@type": "PostalAddress" };
        if (totalReviews > 0) {
            data.aggregateRating = {
                "@type": "AggregateRating",
                "ratingValue": parseFloat(averageRating.toFixed(1)),
                "reviewCount": totalReviews,
                "bestRating": 5,
                "worstRating": 1
            };
        }
        if (reviewsForSchema.length > 0) {
            data.review = reviewsForSchema.map(review => ({
                "@type": "Review",
                "author": { "@type": "Person", "name": review.profiles?.name || review.original_author_name || 'Anónimo' },
                "datePublished": new Date(review.created_at).toISOString().split('T')[0],
                "reviewBody": review.review_text,
                "reviewRating": { "@type": "Rating", "ratingValue": review.rating, "bestRating": 5, "worstRating": 1 }
            }));
        }
        return data;
    }, [business, reviews, hasSedeLocation, totalReviews, averageRating, logoToDisplay, contactPhoneToDisplay, contactEmailToDisplay, latitudeToDisplay, longitudeToDisplay, googleMapsUrlToDisplay, activeCountryCode]);

    // Schema Product - Google muestra estrellas para Product (no para LocalBusiness)
    // Según directrices de Google: https://developers.google.com/search/docs/appearance/structured-data/product
    const productSchemaData = useMemo(() => {
        if (!business || totalReviews === 0) return null;

        const reviewsForSchema = reviews.filter(r => r.review_text && r.review_text.trim() !== '').slice(0, 10);
        const slug = (business as any).slug || encodeURIComponent(business.name.replace(/ /g, '_'));
        const prefix = (activeCountryCode || business.country || 'es').toLowerCase();
        const targetLang = getLanguageForCountryCode(activeCountryCode || business.country);
        const paths = pathTranslations[targetLang] || pathTranslations.es;
        const cleanUrl = `https://web.opynio.com/${prefix}/${paths.business.replace(':identifier', slug)}`;

        // Fecha de validez del precio (3 meses en el futuro)
        const priceValidUntil = new Date();
        priceValidUntil.setMonth(priceValidUntil.getMonth() + 3);

        const productData: { [key: string]: any } = {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": business.name,
            "description": business.description || `Reseñas y opiniones verificadas de ${business.name}. Lee experiencias reales de clientes en Opynio.`,
            "url": cleanUrl,
            "brand": {
                "@type": "Brand",
                "name": business.name
            },
            "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": parseFloat(averageRating.toFixed(1)),
                "reviewCount": totalReviews,
                "bestRating": 5,
                "worstRating": 1
            },
            // Offers es requerido por Google para mostrar rich snippets con estrellas
            "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "EUR",
                "availability": "https://schema.org/InStock",
                "url": cleanUrl,
                "priceValidUntil": priceValidUntil.toISOString().split('T')[0],
                "seller": {
                    "@type": "Organization",
                    "name": business.name
                }
            }
        };

        // Imagen (requerida para rich snippets completos)
        if (logoToDisplay) {
            productData.image = logoToDisplay;
        } else {
            // Imagen por defecto de Opynio si no hay logo
            productData.image = "https://opynio.com/wp-content/uploads/2025/09/Logo-opynio.png";
        }

        // Añadir reseñas individuales (mejora el rich snippet)
        if (reviewsForSchema.length > 0) {
            productData.review = reviewsForSchema.map(review => ({
                "@type": "Review",
                "author": { "@type": "Person", "name": review.profiles?.name || review.original_author_name || 'Anónimo' },
                "datePublished": new Date(review.created_at).toISOString().split('T')[0],
                "reviewBody": review.review_text,
                "reviewRating": { "@type": "Rating", "ratingValue": review.rating, "bestRating": 5, "worstRating": 1 }
            }));
        }

        // Categoría del producto/servicio
        if (business.category) {
            productData.category = business.category.replace(':', ' > ').replace(/_/g, ' ');
        }

        return productData;
    }, [business, reviews, totalReviews, averageRating, logoToDisplay, activeCountryCode]);

    const displayCategory = useMemo(() => {
        const categoryString = business?.category;
        if (!categoryString || !categoryString.includes(':')) {
            return categoryString || t('common.unspecified');
        }
        const [mainKey, subKey] = categoryString.split(':');
        const main = t(`categories.${mainKey.trim()}`);

        // Use mapping to get the correct subcategory translation key
        // Check if already in snake_case or Spanish format
        const trimmedSubKey = subKey.trim();
        const subCategoryKey = trimmedSubKey.includes('_') ? trimmedSubKey : getSubcategoryKey(trimmedSubKey);
        const sub = subCategoryKey ? t(`subcategories.${subCategoryKey}`) : trimmedSubKey;

        // Fallback if translation not found
        if (main.startsWith('categories.') || (subCategoryKey && sub.startsWith('subcategories.'))) {
            return categoryString.replace(':', ': ').replace(/_/g, ' ');
        }

        return (
            <>
                <span className="font-medium">{main}</span>
                <i className="fa-solid fa-chevron-right text-xs mx-1.5 text-gray-400"></i>
                <span>{sub}</span>
            </>
        );
    }, [business?.category, t]);

    // Generar URL canónica usando el slug de la empresa
    // IMPORTANTE: Si el país de la URL es incorrecto, el canonical SIEMPRE apunta al país principal
    // Esto le dice a Google cuál es la URL correcta para indexar
    const canonicalUrl = useMemo(() => {
        if (!business) return undefined;
        const slug = (business as any).slug || encodeURIComponent(business.name.replace(/ /g, '_'));
        // Si es país incorrecto, usar país principal; si no, usar el de la URL
        const correctCountry = isWrongCountry ? business.country : (activeCountryCode || business.country);
        const prefix = (correctCountry || 'es').toLowerCase();
        const targetLanguage = getLanguageForCountryCode(correctCountry);
        const paths = pathTranslations[targetLanguage] || pathTranslations.es;
        const businessPathSegment = paths.business.replace(':identifier', slug);
        return `https://web.opynio.com/${prefix}/${businessPathSegment}`;
    }, [business, activeCountryCode, isWrongCountry]);

    const iconStyle = `
        .map-marker-icon { background: transparent; border: none; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); transition: all 0.2s ease-in-out; }
        .map-marker-icon:hover i { transform: scale(1.1); }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
    `;
    const currentBusinessIcon = L.divIcon({ html: `<i class="fa-solid fa-location-dot text-brand-blue text-5xl"></i>`, className: 'map-marker-icon', iconSize: [36, 50], iconAnchor: [18, 50], popupAnchor: [0, -50] });

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        try {
            // Initialize map if needed
            if (hasSedeLocation && mapContainerRef.current && !mapRef.current) {
                mapRef.current = L.map(mapContainerRef.current);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(mapRef.current);
                markersLayerRef.current = L.layerGroup().addTo(mapRef.current);
            }

            const map = mapRef.current;
            if (!map || !business) {
                return () => { if (timeoutId) clearTimeout(timeoutId); };
            }

            if (hasSedeLocation) {
                const latLng: L.LatLngTuple = [latitudeToDisplay!, longitudeToDisplay!];
                map.setView(latLng, 14);
                markersLayerRef.current?.clearLayers();

                const marker = L.marker(latLng, { icon: currentBusinessIcon, zIndexOffset: 1000 })
                    .addTo(markersLayerRef.current!);
                marker.bindPopup(`<b>${business.name}</b>`).openPopup();

                timeoutId = setTimeout(() => {
                    if (mapRef.current) mapRef.current.invalidateSize();
                }, 100);
            }
        } catch (err) {
            console.error('Error initializing map:', err);
            setMapError(true);
        }

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [business, hasSedeLocation, latitudeToDisplay, longitudeToDisplay, currentBusinessIcon]);

    // Final cleanup when component unmounts
    useEffect(() => {
        return () => {
            if (markersLayerRef.current) {
                markersLayerRef.current.clearLayers();
                markersLayerRef.current = null;
            }
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);

    // Ref to track if a fetch is in progress to prevent race conditions
    const fetchInProgressRef = useRef(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    const fetchReviews = useCallback(async (businessId: string, currentPage: number, source: string, rating: typeof ratingFilter, isLoadMore: boolean) => {
        // Cancel any ongoing fetch
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        if (fetchInProgressRef.current && !isLoadMore) return; // Prevent duplicate initial fetches
        fetchInProgressRef.current = true;

        if (isLoadMore) setIsLoadingMore(true); else { setReviews([]); setIsLoadingMore(true); }
        try {
            const reviewsData = await getReviewsOptimized(businessId, currentPage, 20, source, rating);
            // Check if component is still mounted and request wasn't aborted
            if (!abortControllerRef.current?.signal.aborted) {
                setReviews(prev => isLoadMore ? [...prev, ...reviewsData] : reviewsData);
                setHasMore(reviewsData.length === 20);
            }
        } catch(e) {
            // Ignore abort errors
            if (e instanceof Error && e.name === 'AbortError') return;
            console.error("Error fetching reviews for business:", e instanceof Error ? e.message : String(e), e);
            // Don't set error state here - just show empty reviews
            if (!abortControllerRef.current?.signal.aborted) {
                setReviews([]);
                setHasMore(false);
            }
        }
        finally {
            fetchInProgressRef.current = false;
            setIsLoadingMore(false);
        }
    }, []);

    const fetchBusinessData = useCallback(async () => {
        if (!identifier) {
            setError(t('businessPage.noBusinessId'));
            setIsLoadingBusiness(false);
            return;
        }
        setIsLoadingBusiness(true);
        setError(null);
        setBusiness(null);

        // Track if we're redirecting to avoid setting loading false
        let isRedirecting = false;

        try {
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
            const decodedIdentifier = decodeURIComponent(identifier);
            let businessData = null;

            if (isUuid) {
                // Search by UUID
                businessData = await getBusinessById(identifier);
            } else {
                // 1. First try to find by slug (new clean URLs)
                businessData = await getBusinessBySlug(decodedIdentifier.toLowerCase());

                // 2. If not found, check for redirects
                if (!businessData) {
                    const redirect = await getRedirectByOldSlug(decodedIdentifier);
                    if (redirect) {
                        // Redirect 301 to the new URL
                        const pathLang = countryCode ? getLanguageForCountryCode(countryCode) : 'es';
                        const paths = pathTranslations[pathLang] || pathTranslations.es;
                        const newPath = `/${countryCode || 'es'}/${paths.business.replace(':identifier', redirect.new_slug)}`;
                        isRedirecting = true;
                        navigate(newPath, { replace: true });
                        return;
                    }
                }

                // 3. Fallback: search by name (for legacy URLs)
                if (!businessData) {
                    businessData = await getBusinessByName(decodedIdentifier.replace(/_/g, ' ').trim());
                }
            }

            if (!businessData) {
                setError(t('businessPage.businessNotFound'));
                setIsLoadingBusiness(false);
                return;
            }

            // --- SLUG CANONICALIZATION ---
            // If business has a slug and the URL identifier doesn't match exactly,
            // redirect to the clean URL with the correct slug
            const businessSlug = (businessData as any).slug;
            if (businessSlug && !isUuid) {
                // Check if URL identifier doesn't match the canonical slug
                // (e.g., URL is "Tarot_IA" but slug is "tarot_ia")
                if (decodedIdentifier !== businessSlug) {
                    const pathLang = countryCode ? getLanguageForCountryCode(countryCode) : 'es';
                    const paths = pathTranslations[pathLang] || pathTranslations.es;
                    const canonicalPath = `/${countryCode || businessData.country?.toLowerCase() || 'es'}/${paths.business.replace(':identifier', businessSlug)}`;

                    if (location.pathname !== canonicalPath) {
                        // Keep loading state while redirecting to avoid flash of 404
                        isRedirecting = true;
                        navigate(canonicalPath, { replace: true });
                        return;
                    }
                }
            }
            // --- END SLUG CANONICALIZATION ---

            // --- REDIRECTION LOGIC ---
            // Only redirect if there's a country code in the URL
            if (countryCode) {
                const mainCountry = businessData.country?.toUpperCase();
                const sedeCountries = (businessData.sedes as Sede[] || [])
                    .map(s => s.country_code?.toUpperCase())
                    .filter(Boolean) as string[];
                const allValidCountries = new Set([mainCountry, ...sedeCountries].filter(Boolean));
                const currentCountryFromUrl = countryCode.toUpperCase();

                // If the country in the URL is NOT a valid location for this business, redirect to the main one.
                if (allValidCountries.size > 0 && !allValidCountries.has(currentCountryFromUrl)) {
                    const canonicalCountryPrefix = (businessData.country || 'es').toLowerCase();
                    const pathLang = getLanguageForCountryCode(businessData.country);
                    const paths = pathTranslations[pathLang] || pathTranslations.es;
                    // Use slug if available, otherwise fallback to name
                    const canonicalIdentifier = (businessData as any).slug || encodeURIComponent(businessData.name.replace(/ /g, '_'));
                    const canonicalPath = `/${canonicalCountryPrefix}/${paths.business.replace(':identifier', canonicalIdentifier)}`;

                    // Only redirect if we're not already on the canonical path
                    if (location.pathname !== canonicalPath) {
                        isRedirecting = true;
                        navigate(canonicalPath, { replace: true });
                        return;
                    }
                }
            }
            // --- END REDIRECTION LOGIC ---

            const [distribution, counts] = await Promise.all([
                getReviewRatingDistribution(businessData.id),
                getReviewSourceCounts(businessData.id)
            ]);
            setBusiness(businessData);
            setRatingDistribution(distribution);
            setSourceCounts(counts);

        } catch (e) {
            console.error("Error fetching business data:", e instanceof Error ? e.message : String(e));
            setError(t('businessPage.errorLoadingBusiness'));
        } finally {
            // Only set loading false if we're not redirecting
            // This prevents the flash of 404 during redirect
            if (!isRedirecting) {
                setIsLoadingBusiness(false);
            }
        }
    }, [identifier, navigate, t, location.pathname, location.search, location.hash, countryCode]);


    useEffect(() => { fetchBusinessData(); }, [fetchBusinessData]);

    // Reset to page 1 and fetch when filters change
    useEffect(() => {
        if (business) {
            setPage(1);
            fetchReviews(business.id, 1, sourceFilter, ratingFilter, false);
        }
    }, [business, sourceFilter, ratingFilter, fetchReviews]);

    // Load more reviews when page changes (but not when filters change)
    const prevFiltersRef = useRef({ sourceFilter, ratingFilter });
    useEffect(() => {
        const filtersChanged = prevFiltersRef.current.sourceFilter !== sourceFilter ||
                               prevFiltersRef.current.ratingFilter !== ratingFilter;
        prevFiltersRef.current = { sourceFilter, ratingFilter };

        if (business && page > 1 && !filtersChanged) {
            fetchReviews(business.id, page, sourceFilter, ratingFilter, true);
        }
    }, [page, business, sourceFilter, ratingFilter, fetchReviews]);
    
    useEffect(() => {
        const generateInsights = async () => {
            if (!business) return;
    
            setIsLoadingInsights(true);
            setInsights(null); // Clear previous insights
            try {
                // Fetch the first few reviews needed for the summary, independent of the main reviews state.
                const { data: reviewsForSummary, error: reviewsError } = await supabase
                    .from('reviews')
                    .select('review_text')
                    .eq('business_id', business.id)
                    .eq('status', 'approved')
                    .lte('created_at', new Date().toISOString())
                    .not('review_text', 'is', null)
                    .neq('review_text', '')
                    .limit(30);
    
                if (reviewsError) throw reviewsError;
    
                const reviewTexts = (reviewsForSummary || []).map(r => r.review_text);
    
                if (reviewTexts.length > 3) {
                    const newInsights = await getBusinessInsights(business.description || '', reviewTexts);
                    setInsights(newInsights);
                }
            } catch(e) {
                console.error("Failed to get AI insights", e);
                // Silently fail, don't show an error to the user. The section will just be empty.
            } finally {
                setIsLoadingInsights(false);
            }
        };
        
        // Only generate insights if the plan allows it (not free plan)
        if (business && business.plan !== 'free') {
            generateInsights();
        } else {
            setIsLoadingInsights(false); // Make sure loading stops for free plans
        }
        
    }, [business?.id, language]);

    // FIX: Add missing return statement
    if (isLoadingBusiness) {
        return <div className="flex justify-center items-center h-96"><Spinner /></div>;
    }

    // SEO: Renderizar NotFoundPage directamente en vez de Navigate
    // Esto asegura que el meta noindex se aplique correctamente para Google
    if (error || !business) {
        return <NotFoundPage />;
    }

    return (
        <>
            {/* SEO: noindex si el país de la URL no es válido para esta empresa */}
            {/* El canonical siempre apunta al país correcto */}
            <Meta title={metaTitle} description={metaDescription} lang={pageLang} canonical={canonicalUrl} noindex={isWrongCountry} />
            {schemaData && <Schema data={schemaData} id="schema-localbusiness" />}
            {productSchemaData && <Schema data={productSchemaData} id="schema-product" />}
            <style>{iconStyle}</style>

            <div className="space-y-4 sm:space-y-6">
                <header className="bg-white dark:bg-zinc-800 p-3 sm:p-4 md:p-6 rounded-xl shadow-lg border dark:border-zinc-700">
                    <div className="flex flex-col gap-3 sm:gap-4">
                        {/* Logo and Title Row */}
                        <div className="flex items-start gap-3 sm:gap-4">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-lg bg-gray-100 dark:bg-zinc-700 flex-shrink-0 flex items-center justify-center overflow-hidden border dark:border-zinc-600">
                                {logoToDisplay ? <img src={logoToDisplay} alt={`${business.name} logo`} width={96} height={96} loading="lazy" decoding="async" className="w-full h-full object-contain p-1" /> : <i className="fa-solid fa-store text-2xl sm:text-3xl md:text-4xl text-gray-400"></i>}
                            </div>
                            <div className="flex-grow min-w-0">
                                <div className="flex flex-col gap-1.5 sm:gap-2">
                                    <h1 className="text-lg sm:text-2xl md:text-3xl font-extrabold text-gray-800 dark:text-gray-100 break-words">
                                        {business?.name}
                                    </h1>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-1 mt-1.5 sm:mt-2">
                                    <div className="flex items-center gap-1 sm:gap-1.5"><StarRating rating={averageRating} /><span className="font-bold text-xs sm:text-sm md:text-base text-gray-700 dark:text-gray-200">{averageRating.toFixed(1)}</span></div>
                                    <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{totalReviews} {t('common.reviews')}</span>
                                </div>
                            </div>
                        </div>
                        {/* Buttons Row */}
                        <div className="flex flex-col xs:flex-row gap-2 sm:gap-3">
                            <button onClick={handleWriteReviewClick} className="w-full xs:flex-1 text-xs sm:text-sm md:text-base bg-brand-green text-white font-bold py-2 sm:py-2.5 px-3 sm:px-4 md:px-5 rounded-lg hover:bg-opacity-90 transition-colors shadow-sm whitespace-nowrap">{t('businessPage.writeReview')}</button>
                            {websiteToDisplay && <a href={websiteToDisplay} target="_blank" rel="noopener noreferrer" className="w-full xs:flex-1 text-center text-xs sm:text-sm md:text-base bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-200 font-semibold py-2 sm:py-2.5 px-3 sm:px-4 md:px-5 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600 whitespace-nowrap">{t('businessPage.visitWebsite')}</a>}
                        </div>
                    </div>
                     <div className="mt-3 sm:mt-4 md:mt-6 pt-3 sm:pt-4 md:pt-6 border-t dark:border-zinc-700 flex flex-col md:flex-row justify-between items-start gap-3 sm:gap-4">
                        {allSedes.length > 1 && (
                            <div className="w-full md:w-auto">
                                <h3 className="text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-100 mb-3">{t('businessPage.locations')}</h3>
                                <div className="flex flex-wrap items-start gap-2 sm:gap-3">
                                    {allSedes.map(s => {
                                        const isActive = s.country_code === activeCountryCode;
                                        const isMainSede = s.country_code === business.country;
                                        // Usar el slug de la empresa si existe, sino fallback al nombre
                                        const identifierSlug = (business as any).slug || encodeURIComponent(business.name.replace(/ /g, '_'));
                                        const prefix = (s.country_code || 'es').toLowerCase();
                                        const targetLanguage = getLanguageForCountryCode(s.country_code);
                                        const paths = pathTranslations[targetLanguage] || pathTranslations.es;
                                        const businessPathSegment = paths.business.replace(':identifier', identifierSlug);
                                        const linkPath = `/${prefix}/${businessPathSegment}`;

                                        return (
                                            <Link
                                                key={s.country_code}
                                                to={linkPath}
                                                className={`group flex items-center gap-2 px-3 py-2 rounded-lg border-2 shadow-sm transition-all duration-200 hover:shadow-md ${
                                                    isActive
                                                        ? 'border-brand-green bg-brand-green/5 dark:bg-brand-green/10'
                                                        : 'border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-zinc-600'
                                                }`}
                                            >
                                                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full overflow-hidden shadow-sm flex-shrink-0">
                                                    <img src={s.flag} alt={s.name} width={28} height={28} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                                                            {s.name}
                                                        </span>
                                                        {isMainSede && (
                                                            <span className="text-[10px] sm:text-xs px-1.5 py-0.5 bg-brand-green/20 text-brand-green dark:bg-brand-green/30 dark:text-brand-green-light rounded font-bold uppercase">
                                                                {t('businessPage.mainLocation')}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {s.description && (
                                                        <span className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 truncate max-w-[200px]">
                                                            {s.description}
                                                        </span>
                                                    )}
                                                </div>
                                            </Link>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                        <div className="w-full md:w-auto md:ml-auto">
                            {(business.offers_international_services) ? (
                                <div title={t('businessPage.offersServicesWorldwideTitle')} className="inline-flex items-center gap-1.5 text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 px-2.5 sm:px-3 py-1.5 rounded-lg">
                                    <i className="fa-solid fa-globe text-xs"></i>
                                    <span className="truncate">{t('businessPage.offersServicesWorldwideText')}</span>
                                </div>
                            ) : (
                                <div title={t('businessPage.limitedServicesToLocationsTitle')} className="inline-flex items-center gap-1.5 text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-zinc-700 dark:text-gray-300 px-2.5 sm:px-3 py-1.5 rounded-lg">
                                    <i className="fa-solid fa-map-marker-alt text-xs"></i>
                                    <span className="truncate">{t('businessPage.limitedServicesToLocationsText')}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 items-start">
                    <main className="lg:col-span-2 space-y-3 sm:space-y-4 md:space-y-6">
                        {isLoadingInsights ? <div className="bg-white dark:bg-zinc-800 p-4 sm:p-5 md:p-6 rounded-xl shadow-sm border dark:border-zinc-700 flex justify-center"><Spinner/></div> : insights && (
                            <div className="bg-white dark:bg-zinc-800 p-4 sm:p-5 md:p-6 rounded-xl shadow-sm border dark:border-zinc-700">
                                <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-gray-800 dark:text-gray-100">{t('businessPage.aiSummary')}</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                                    <div><h3 className="font-semibold text-sm sm:text-base text-green-700 dark:text-green-400 mb-2">{t('businessPage.strongPoints')}</h3><ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-gray-600 dark:text-gray-300">{insights.good_points.map((p,i)=><li key={i}>{p}</li>)}</ul></div>
                                    <div><h3 className="font-semibold text-sm sm:text-base text-yellow-700 dark:text-yellow-400 mb-2">{t('businessPage.improvementPoints')}</h3><ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-gray-600 dark:text-gray-300">{insights.improvement_points.map((p,i)=><li key={i}>{p}</li>)}</ul></div>
                                </div>
                            </div>
                        )}

                        <div className="bg-white dark:bg-zinc-800 p-3 sm:p-4 md:p-6 rounded-xl shadow-sm border dark:border-zinc-700">
                            <h2 className="text-base sm:text-lg md:text-xl font-bold mb-3 sm:mb-4 text-gray-800 dark:text-gray-100">{t('businessPage.allReviewsFor', { businessName: business.name })}</h2>
                            <div className="flex flex-col gap-3 mb-4 pb-3 sm:pb-4 border-b dark:border-zinc-700">
                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">{t('businessPage.source')}:</span>
                                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                        {sourceCounts && [ 'all', 'opynio', 'google', 'trustindex' ].map(s => {
                                            const count = s === 'all' ? (sourceCounts.opynio + sourceCounts.google + sourceCounts.trustindex) : sourceCounts[s as keyof typeof sourceCounts];
                                            if (count > 0) return <FilterChip key={s} label={`${t(`businessPage.${s}`)} (${count})`} isActive={sourceFilter === s} onClick={() => setSourceFilter(s as any)} />;
                                            return null;
                                        })}
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">{t('businessPage.rating')}:</span>
                                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                        {['all', '5', '4+', '3-'].map(r => <FilterChip key={r} label={t(`businessPage.${r.replace('+','StarsOrMore').replace('-','StarsOrLess')+'Stars'}` as any, { stars: r })} isActive={ratingFilter === r} onClick={() => setRatingFilter(r as any)} />)}
                                    </div>
                                </div>
                            </div>

                            {isLoadingMore && reviews.length === 0 ? <div className="flex justify-center py-6 sm:py-8"><Spinner /></div> : reviews.length > 0 ? (
                                <div className="space-y-4 sm:space-y-6 hide-scrollbar">
                                    {reviews.map(review => <LazyRender key={review.id} placeholderHeight="250px"><ReviewCard review={review} /></LazyRender>)}
                                    {hasMore && <div className="text-center pt-3 sm:pt-4"><button onClick={() => setPage(p => p+1)} disabled={isLoadingMore} className="bg-brand-dark text-white font-semibold px-4 sm:px-5 md:px-6 py-2 sm:py-2.5 md:py-3 text-sm sm:text-base rounded-md hover:bg-opacity-90">{isLoadingMore ? t('common.loading') : t('businessPage.loadMore')}</button></div>}
                                </div>
                            ) : (
                                <PlaceholderMessage icon="fa-comment-slash" title={t('businessPage.noReviewsMatchingFilter')} message={t('businessPage.noReviewsMatchingFilterSubtitle')} />
                            )}
                        </div>
                    </main>

                    <aside className="lg:col-span-1 space-y-3 sm:space-y-4 self-start lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto hide-scrollbar">
                        <RatingDistribution distribution={ratingDistribution} totalReviews={totalReviews} />
                        <div className="bg-white dark:bg-zinc-800 p-3 sm:p-4 md:p-5 rounded-xl shadow-sm border dark:border-zinc-700 space-y-2.5 sm:space-y-3 overflow-hidden">
                            <h3 className="font-bold text-xs sm:text-sm md:text-base text-gray-800 dark:text-gray-100">{t('businessPage.aboutBusiness', { businessName: business.name })}</h3>
                            {isTranslating && business?.description ? (
                                <div className="space-y-2 animate-pulse">
                                    <div className="h-3 sm:h-4 bg-gray-200 dark:bg-zinc-700 rounded w-full"></div>
                                    <div className="h-3 sm:h-4 bg-gray-200 dark:bg-zinc-700 rounded w-5/6"></div>
                                    <div className="h-3 sm:h-4 bg-gray-200 dark:bg-zinc-700 rounded w-3/4"></div>
                                </div>
                            ) : (
                                translatedContent.description && <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">{translatedContent.description}</p>
                            )}
                            <div className="text-[11px] sm:text-xs md:text-sm space-y-2 pt-2 border-t dark:border-zinc-700">
                                <div className="flex items-start gap-2"><i className="fa-solid fa-tags w-3 text-center text-gray-400 pt-0.5 flex-shrink-0"></i><div className="min-w-0"><strong className="text-gray-700 dark:text-gray-300">{t('businessPage.category')}:</strong><br/><span className="break-words">{displayCategory}</span></div></div>
                                {hasSedeLocation && <div className="flex items-start gap-2"><i className="fa-solid fa-map-marker-alt w-3 text-center text-gray-400 pt-0.5 flex-shrink-0"></i><div className="min-w-0"><strong className="text-gray-700 dark:text-gray-300">{t('businessPage.googleMaps')}:</strong><br/><a href={googleMapsUrlToDisplay || '#'} target="_blank" rel="noopener noreferrer" className="text-brand-green hover:underline break-all">{t('businessPage.viewOnGoogleMaps')}</a></div></div>}
                                {contactEmailToDisplay && <div className="flex items-start gap-2"><i className="fa-solid fa-envelope w-3 text-center text-gray-400 pt-0.5 flex-shrink-0"></i><div className="min-w-0"><strong className="text-gray-700 dark:text-gray-300">{t('businessPage.contactEmail')}:</strong><br/><a href={`mailto:${contactEmailToDisplay}`} className="text-brand-green hover:underline break-all">{contactEmailToDisplay}</a></div></div>}
                                {contactPhoneToDisplay && <div className="flex items-start gap-2"><i className="fa-solid fa-phone w-3 text-center text-gray-400 pt-0.5 flex-shrink-0"></i><div className="min-w-0"><strong className="text-gray-700 dark:text-gray-300">{t('businessPage.phone')}:</strong><br/><button onClick={() => { navigator.clipboard.writeText(contactPhoneToDisplay!); showNotification(t('businessPage.phoneCopied'), 'success'); }} className="text-brand-green hover:underline break-words text-left">{contactPhoneToDisplay}</button></div></div>}
                                {schedule && <div className="flex items-start gap-2"><i className="fa-solid fa-clock w-3 text-center text-gray-400 pt-0.5 flex-shrink-0"></i><div className="min-w-0"><strong className="text-gray-700 dark:text-gray-300">{t('businessPage.schedule')}:</strong><br/><span className={isOpen ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{isOpen ? t('businessPage.openNow') : t('businessPage.closedNow')}</span> <button onClick={() => setIsScheduleModalOpen(true)} className="text-brand-green hover:underline text-[10px] sm:text-xs ml-1">({t('businessPage.viewSchedule')})</button></div></div>}
                            </div>
                        </div>

                        {/* Claim Business Section - Only show if business is unclaimed */}
                        {business && !business.owner_id && (
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-3 sm:p-4 rounded-xl shadow-sm border-2 border-blue-200 dark:border-blue-700">
                                <div className="flex items-start gap-2 mb-2">
                                    <i className="fa-solid fa-store text-blue-600 dark:text-blue-400 text-base sm:text-lg mt-0.5"></i>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-xs sm:text-sm text-blue-900 dark:text-blue-100">{t('businessPage.areYouTheOwner')}</h3>
                                        <p className="text-[10px] sm:text-xs text-blue-700 dark:text-blue-300 mt-1">{t('businessPage.unclaimedBusinessSubtitle')}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        const currentUrl = window.location.href;
                                        navigate(`/${country?.toLowerCase() || 'es'}/${pathTranslations[language]?.support || 'soporte'}`, {
                                            state: { initialTab: 'claim', claimUrl: currentUrl }
                                        });
                                    }}
                                    className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold text-xs sm:text-sm py-2 px-3 rounded-lg transition-colors shadow-sm"
                                >
                                    <i className="fa-solid fa-hand-holding-heart mr-1.5"></i>
                                    {t('supportPage.claimBusiness')}
                                </button>
                            </div>
                        )}

                        {hasSedeLocation && !mapError && <div ref={mapContainerRef} className="w-full h-40 sm:h-48 md:h-56 lg:h-64 bg-gray-200 dark:bg-zinc-700 rounded-lg shadow-md border dark:border-zinc-700 z-0"></div>}
                        {hasSedeLocation && mapError && (
                            <div className="w-full h-40 sm:h-48 md:h-56 lg:h-64 bg-gray-100 dark:bg-zinc-800 rounded-lg shadow-md border dark:border-zinc-700 flex items-center justify-center">
                                <div className="text-center text-gray-500 dark:text-gray-400">
                                    <i className="fa-solid fa-map-location-dot text-3xl mb-2 text-gray-400 dark:text-gray-500"></i>
                                    <p className="text-sm font-medium">{t('businessPage.mapError') || 'No se pudo cargar el mapa'}</p>
                                </div>
                            </div>
                        )}
                        {/* FIX: Corrected typo from `social` to `socialLinks.instagram` and completed the JSX. */}
                        {(socialLinks.twitter || socialLinks.instagram) &&
                            <div className="bg-white dark:bg-zinc-800 p-3 sm:p-4 md:p-5 rounded-xl shadow-sm border dark:border-zinc-700">
                                <h3 className="font-bold text-xs sm:text-sm md:text-base mb-2">{t('businessPage.socialMedia')}</h3>
                                <div className="flex gap-3 text-lg sm:text-xl">
                                    {socialLinks.twitter && <a href={`https://twitter.com/${socialLinks.twitter}`} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-blue-500"><i className="fab fa-twitter"></i></a>}
                                    {socialLinks.instagram && <a href={`https://instagram.com/${socialLinks.instagram}`} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-pink-500"><i className="fab fa-instagram"></i></a>}
                                </div>
                            </div>
                        }
                    </aside>
                </div>
            </div>

            {isScheduleModalOpen && schedule && (
                <Modal title={t('businessPage.scheduleModalTitle')} onClose={() => setIsScheduleModalOpen(false)}>
                    <div className="py-3 sm:py-4">
                        <ul className="space-y-1.5 sm:space-y-2">
                            {schedule.map(({ day, hours }) => (
                                <li key={day} className="flex justify-between items-center text-xs sm:text-sm p-2 rounded-md even:bg-gray-50 dark:even:bg-zinc-700/50">
                                    <span className="font-semibold text-gray-800 dark:text-gray-200">{day}</span>
                                    {!hours || typeof hours === 'string' ? (
                                        <span className="font-bold text-red-500">{t('businessPage.closed')}</span>
                                    ) : (
                                        <span className="font-mono text-gray-600 dark:text-gray-300">{hours.open} - {hours.close}</span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                </Modal>
            )}
        </>
    );
};

// FIX: Added default export for the component to be lazy-loaded correctly.
export default BusinessPage;