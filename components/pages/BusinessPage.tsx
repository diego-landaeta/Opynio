import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
// FIX: Changed react-router-dom imports to a namespace import to resolve module resolution issues.
// FIX: Changed react-router-dom namespace import to named imports to resolve module resolution issues.
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import NotFoundPage from './NotFoundPage';
import type { Review, Business, AiInsight, BusinessHours, Sede } from '../../types';
import { getBusinessInsights, AI_ENABLED } from '../../services/geminiService';
import { getBusinessById, getBusinessByName, getBusinessBySlug, getRedirectByOldSlug, supabase, getReviewRatingDistribution, getReviewSourceCounts, getProductReviewStats, updateBusinessProfile, userHasReviewedBusiness } from '../../services/supabaseService';
import { getReviewsOptimized, searchReviewsOptimized } from '../../services/optimizedQueries';
import { getPublicBusinessProducts } from '../../services/supabaseService';
import ReviewCard from '../ReviewCard';
import StarRating from '../StarRating';
import Spinner from '../Spinner';
import BusinessLogo from '../BusinessLogo';
import L from 'leaflet';
import Meta from '../Meta';
import Schema from '../Schema';
import { useAuth } from '../../contexts/AuthContext';
import RatingDistribution from '../RatingDistribution';
import Modal from '../Modal';
import LazyRender from '../LazyRender';
import { useNotification } from '../../contexts/NotificationContext';
import { useI18n, pathTranslations, useTranslation, useAutoTranslations, getLanguageForCountryCode, useLocaleDictionary, localizedPath, type Language } from '../../contexts/i18nContext';
import { useCountry } from '../../contexts/CountryContext';
import { COUNTRIES, SEDE_COUNTRIES } from '../../constants';
import { getSubcategoryKey } from '../../utils/categoryMappings';
import { trackMetaEvent } from '../../utils/metaPixel';
import { getReviewAuthorName } from '../../utils/reviewDisplay';
import { useCountryName } from '../../utils/countryName';
import { useOwnBusiness, getBusinessDashboardPath } from '../../utils/businessOwnership';
import OwnBusinessBadge from '../OwnBusinessBadge';

const PAGE_SIZE = 20; // Reduced from 50 for better performance
// Si la carga de la ficha no termina en este tiempo se muestra un error con
// "Reintentar" en vez de dejar el spinner para siempre.
const FICHA_TIMEOUT_MS = 15000;
// Normaliza una ruta para compararla: sin barra final y decodificada.
const normalizarRuta = (p: string) => {
    const sinBarra = p.replace(/\/+$/, '');
    try { return decodeURIComponent(sinBarra); } catch { return sinBarra; }
};
// Reproduce el LanguagePathValidator de master (App.tsx): con un pais del
// selector (COUNTRIES) y una ruta que existe en el idioma de OTRO pais
// (/gb/empresa/x, /de/empresa/x) master respondia 404. Solo esas URLs se
// canonicalizan del todo; las que master pintaba o redirigia siguen igual.
// `segmento` va tal cual viene en location.pathname, como lo comparaba master.
const baseDeRuta = (p: string) => p.split('/')[0].split(':')[0];
const dabaError404EnMaster = (prefijo: string | undefined, segmento: string): boolean => {
    if (!prefijo || !COUNTRIES.some(c => c.code.toLowerCase() === prefijo.toLowerCase())) return false;
    const rutasDelPais = Object.values(pathTranslations[getLanguageForCountryCode(prefijo)] || {}) as string[];
    if (rutasDelPais.some(p => baseDeRuta(p) === segmento)) return false;
    return (Object.values(pathTranslations) as Record<string, string>[])
        .some(rutas => Object.values(rutas).some(p => baseDeRuta(p) === segmento));
};

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


// Selector de producto de la ficha publica. Es un desplegable propio y no un
// <select>: el nativo no admite imagen ni estrellas dentro de sus opciones, que
// es justo lo que distingue un curso de otro de un vistazo.
const ProductChooser: React.FC<{
    products: any[];
    value: string;
    onChange: (id: string) => void;
    title: string;
    hint: string;
    allLabel: string;
    reviewsWord: (n: number) => string;
    searchPlaceholder: string;
    noResults: string;
}> = ({ products, value, onChange, title, hint, allLabel, reviewsWord, searchPlaceholder, noResults }) => {
    const [abierto, setAbierto] = useState(false);
    // Buscador dentro del desplegable: hay empresas con mas de mil cursos y
    // recorrer la lista entera a mano no es viable.
    const [busqueda, setBusqueda] = useState('');
    const conBuscador = products.length > 10;
    const visibles = React.useMemo(() => {
        const normalizar = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const palabras = normalizar(busqueda.trim()).split(/\s+/).filter(Boolean);
        if (palabras.length === 0) return products;
        return products.filter(p => {
            const nombre = normalizar(p.name || '');
            return palabras.every(w => nombre.includes(w));
        });
    }, [products, busqueda]);
    const cajaRef = useRef<HTMLDivElement>(null);
    const botonRef = useRef<HTMLButtonElement>(null);
    const seleccionado = products.find(p => p.id === value) || null;

    useEffect(() => {
        if (!abierto) return;
        const fuera = (e: MouseEvent) => {
            if (cajaRef.current && !cajaRef.current.contains(e.target as Node)) setAbierto(false);
        };
        const tecla = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { setAbierto(false); botonRef.current?.focus(); }
        };
        document.addEventListener('mousedown', fuera);
        document.addEventListener('keydown', tecla);
        return () => {
            document.removeEventListener('mousedown', fuera);
            document.removeEventListener('keydown', tecla);
        };
    }, [abierto]);

    const elegir = (id: string) => {
        onChange(id);
        setAbierto(false);
        setBusqueda('');
        botonRef.current?.focus();
    };

    const Miniatura: React.FC<{ producto: any | null }> = ({ producto }) => (
        <BusinessLogo
            logoUrl={producto?.image_url}
            businessName={producto?.name || ''}
            className="w-9 h-9 flex-shrink-0"
            iconSize="text-xs"
            fallbackIcon="fa-box-open"
            rounded="rounded-md"
            fit="cover"
            padding=""
        />
    );

    return (
        <div ref={cajaRef} className="relative">
            <h3 className="font-bold text-xs sm:text-sm md:text-base text-gray-800 dark:text-gray-100">{title}</h3>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{hint}</p>

            <button
                ref={botonRef}
                type="button"
                onClick={() => setAbierto(o => !o)}
                aria-expanded={abierto}
                aria-haspopup="true"
                className={`mt-2 w-full min-h-[52px] flex items-center gap-2.5 px-2.5 py-2 rounded-lg border text-left transition-colors focus:outline-none focus:ring-2 focus:ring-brand-green ${
                    seleccionado
                        ? 'border-brand-green bg-brand-green/10'
                        : 'border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900'
                }`}
            >
                {seleccionado ? <Miniatura producto={seleccionado} /> : (
                    <span className="w-9 h-9 flex-shrink-0 rounded-md bg-gray-100 dark:bg-zinc-700 flex items-center justify-center">
                        <i className="fa-solid fa-list text-gray-400 text-xs" aria-hidden="true"></i>
                    </span>
                )}
                <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                        {seleccionado ? seleccionado.name : allLabel}
                    </span>
                    {seleccionado && (seleccionado.review_count ?? 0) > 0 && (
                        <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                            <i className="fa-solid fa-star text-yellow-400" aria-hidden="true"></i>
                            {(seleccionado.avg_rating ?? 0).toFixed(1)}
                            <span>· {seleccionado.review_count} {reviewsWord(seleccionado.review_count ?? 0)}</span>
                        </span>
                    )}
                </span>
                <i className={`fa-solid fa-chevron-down text-xs text-gray-400 flex-shrink-0 transition-transform ${abierto ? 'rotate-180' : ''}`} aria-hidden="true"></i>
            </button>

            {abierto && (
                <div className="absolute z-30 left-0 right-0 mt-1 max-h-80 overflow-y-auto rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-xl">
                    {conBuscador && (
                        <div className="sticky top-0 z-10 p-2 bg-white dark:bg-zinc-800 border-b dark:border-zinc-700">
                            <input
                                type="search"
                                autoFocus
                                value={busqueda}
                                onChange={e => setBusqueda(e.target.value)}
                                placeholder={searchPlaceholder}
                                aria-label={searchPlaceholder}
                                className="w-full px-2.5 py-2 text-sm rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-green"
                            />
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={() => elegir('all')}
                        className={`w-full min-h-[44px] flex items-center gap-2.5 px-2.5 py-2 text-left hover:bg-gray-50 dark:hover:bg-zinc-700 focus:outline-none focus:bg-gray-50 dark:focus:bg-zinc-700 ${
                            !seleccionado ? 'bg-brand-green/10' : ''
                        }`}
                    >
                        <span className="w-9 h-9 flex-shrink-0 rounded-md bg-gray-100 dark:bg-zinc-700 flex items-center justify-center">
                            <i className="fa-solid fa-list text-gray-400 text-xs" aria-hidden="true"></i>
                        </span>
                        <span className="min-w-0 flex-1 text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{allLabel}</span>
                        {!seleccionado && <i className="fa-solid fa-check text-brand-green text-xs flex-shrink-0" aria-hidden="true"></i>}
                    </button>

                    {visibles.length === 0 && (
                        <p className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400" role="status">{noResults}</p>
                    )}
                    <ul className="border-t dark:border-zinc-700">
                        {visibles.map(producto => {
                            const n = producto.review_count ?? 0;
                            const activo = producto.id === value;
                            return (
                                <li key={producto.id}>
                                    <button
                                        type="button"
                                        onClick={() => elegir(producto.id)}
                                        className={`w-full min-h-[52px] flex items-center gap-2.5 px-2.5 py-2 text-left hover:bg-gray-50 dark:hover:bg-zinc-700 focus:outline-none focus:bg-gray-50 dark:focus:bg-zinc-700 ${
                                            activo ? 'bg-brand-green/10' : ''
                                        }`}
                                    >
                                        <Miniatura producto={producto} />
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm font-semibold text-gray-800 dark:text-gray-100 leading-snug break-words">{producto.name}</span>
                                            {n > 0 ? (
                                                <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                                                    <StarRating rating={producto.avg_rating ?? 0} size="small" />
                                                    {(producto.avg_rating ?? 0).toFixed(1)}
                                                    <span>· {n} {reviewsWord(n)}</span>
                                                </span>
                                            ) : (
                                                <span className="block text-xs text-gray-400 dark:text-gray-500 italic">—</span>
                                            )}
                                        </span>
                                        {activo && <i className="fa-solid fa-check text-brand-green text-xs flex-shrink-0" aria-hidden="true"></i>}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
};

const BusinessPage: React.FC = () => {
    const { identifier, countryCode } = useParams<{ identifier: string; countryCode: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { user, profile } = useAuth();
    const { showNotification } = useNotification();
    const { language } = useI18n();
    const { country } = useCountry();
    const countryNameOf = useCountryName();
    const t = useTranslation();

    const [business, setBusiness] = useState<Business | null>(null);
    // Si quien mira es el dueño: sin "escribir reseña" ni "reclamar", con
    // acceso al panel. Sale de AuthContext (sin consultas extra).
    const ownBusiness = useOwnBusiness(business);
    const [reviews, setReviews] = useState<Review[]>([]);
    // Productos de la empresa con nota propia. 'all' = la ficha entera.
    const [products, setProducts] = useState<any[]>([]);
    const [productFilter, setProductFilter] = useState<string>('all');
    const reviewsSectionRef = useRef<HTMLDivElement>(null);
    // El producto elegido, si lo hay: lo usa el titulo de la lista.
    const selectedProduct = products.find(p => p.id === productFilter) || null;
    // Los productos NO tienen URL propia (decision SEO): sus reseñas se ven
    // solo con este filtro, que es estado de la pagina y nunca toca la URL
    // (ni ruta, ni ?producto=, ni #hash).
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
    const [sourceCounts, setSourceCounts] = useState<{ opynio: number, google: number, trustindex: number, total: number } | null>(null);
    const [ratingFilter, setRatingFilter] = useState<'all' | '5' | '4+' | '3-'>('all');
    // Review search within this business (by title, text or author)
    const [searchInput, setSearchInput] = useState('');
    const [activeSearch, setActiveSearch] = useState('');

    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<L.Map | null>(null);
    const markersLayerRef = useRef<L.LayerGroup | null>(null);
    const [mapError, setMapError] = useState(false);
    
    // country: si la descripcion es demasiado corta para detectar su idioma, el
    // del pais de la empresa decide (evita pedir es->es a Google).
    const { content: translatedContent, isTranslating } = useAutoTranslations({
        description: business?.description,
    }, { country: business?.country ?? null });

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

    // Cifras del producto elegido (distribucion por estrellas y chips de
    // fuente). Son un SUBCONJUNTO: la cabecera, el SEO y el total de la empresa
    // siguen saliendo de ratingDistribution/sourceCounts, que cuentan todas sus
    // resenas. Una llamada por producto y se guarda para el resto de la visita:
    // volver a un producto ya visto no repite la consulta.
    type ProductStats = Awaited<ReturnType<typeof getProductReviewStats>>;
    const productStatsCacheRef = useRef(new Map<string, ProductStats>());
    const [productStats, setProductStats] = useState<{ key: string; data: ProductStats | null; failed: boolean } | null>(null);
    const productStatsKey = business?.id && productFilter !== 'all' ? `${business.id}:${productFilter}` : null;
    useEffect(() => {
        if (!productStatsKey || !business?.id) return;
        const cached = productStatsCacheRef.current.get(productStatsKey);
        if (cached) {
            setProductStats({ key: productStatsKey, data: cached, failed: false });
            return;
        }
        let cancelled = false;
        setProductStats({ key: productStatsKey, data: null, failed: false });
        getProductReviewStats(business.id, productFilter)
            .then(data => {
                productStatsCacheRef.current.set(productStatsKey, data);
                if (!cancelled) setProductStats({ key: productStatsKey, data, failed: false });
            })
            .catch(err => {
                console.error('No se pudieron cargar las cifras del producto:', err);
                if (!cancelled) setProductStats({ key: productStatsKey, data: null, failed: true });
            });
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productStatsKey]);
    // Solo vale si es la del producto que se esta viendo ahora mismo.
    const currentProductStats = selectedProduct && productStats?.key === productStatsKey ? productStats : null;
    const productDistributionTotal = currentProductStats?.data
        ? Object.values(currentProductStats.data.distribution).reduce((a, b) => a + b, 0)
        : 0;
    const productDistributionAverage = currentProductStats?.data && productDistributionTotal > 0
        ? Object.entries(currentProductStats.data.distribution).reduce((acc, [star, n]) => acc + Number(star) * n, 0) / productDistributionTotal
        : 0;
    // Chips de fuente: con producto, sus cifras; mientras llegan, sin cifra.
    const chipSourceCounts = selectedProduct ? (currentProductStats?.data?.sourceCounts ?? null) : sourceCounts;

    // Función de traducción que usa el idioma del PAÍS de la empresa (no el del usuario)
    // Esto asegura que los metadatos estén en el idioma correcto del país
    // Los textos de cada idioma se descargan bajo demanda: mientras llega el del
    // pais (solo pasa si difiere del de la UI), tMeta cae a t().
    const metaLang: Language = business?.country ? getLanguageForCountryCode(business.country) : 'es';
    const metaDictionary = useLocaleDictionary(metaLang);
    const tMeta = useCallback((key: string, params?: Record<string, any>) => {
        if (!business?.country || !metaDictionary) return t(key, params);
        const langTranslations = metaDictionary;
        const keys = key.split('.');
        let value: any = langTranslations;
        for (const k of keys) {
            value = value?.[k];
            if (value === undefined) return t(key, params);
        }
        if (typeof value !== 'string') return t(key, params);
        if (!params) return value;
        return Object.entries(params).reduce((str, [k, v]) => str.replace(`{${k}}`, String(v)), value);
    }, [business?.country, metaDictionary, t]);

    // Idioma del pais de la empresa (rutas de la ficha). <html lang> ya no sale
    // de aqui: lo pone I18nProvider con el idioma de la UI.
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
    // El tono medido corresponde a business.logo_url. Si acaba mostrandose el logo
    // propio de una sede se esta pintando otra imagen, sin medir, y no se le aplica.
    // Se compara la URL final en vez de mirar si hay sede: allSedes incluye una sede
    // sintetica para la ubicacion principal que ya lleva el logo de la empresa.
    const logoToneToDisplay = logoToDisplay && logoToDisplay === business?.logo_url
        ? business?.logo_tone
        : null;
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


    const handleWriteReviewClick = async () => {
        if (!business) return;

        // Use country directly - don't infer from language
        const countryPrefix = country ? `/${country.toLowerCase()}` : '';
        const pathLang = country ? getLanguageForCountryCode(country) : language;
        const paths = pathTranslations[pathLang] || pathTranslations.es;

        if (user) {
            try {
                const already = await userHasReviewedBusiness(user.id, business.id);
                if (already) {
                    showNotification(t('alreadyReviewedThisBusiness'), 'info');
                    return;
                }
            } catch {
                // Si falla la verificación, dejamos pasar; el constraint de BD lo capturará al insertar.
            }
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
                "author": { "@type": "Person", "name": getReviewAuthorName(review, 'Anónimo') },
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
                "author": { "@type": "Person", "name": getReviewAuthorName(review, 'Anónimo') },
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
        if (!categoryString) return t('common.unspecified');
        if (!categoryString.includes(':')) {
            // Sin subcategoria tambien hay que traducir: devolver la cadena tal
            // cual dejaba la clave española a la vista en los otros 30 idiomas.
            const translated = t(`categories.${categoryString.trim()}`);
            return translated.startsWith('categories.')
                ? categoryString.replace(/_/g, ' ').trim()
                : translated;
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

    const fetchReviews = useCallback(async (businessId: string, currentPage: number, source: string, rating: typeof ratingFilter, isLoadMore: boolean, product: string) => {
        // Cancela la peticion anterior y se queda con la suya. Comparar contra
        // este controlador local (y no contra el ref, que ya apunta a otro) es
        // lo que evita pintar una respuesta obsoleta.
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;
        const esLaUltima = () => abortControllerRef.current === controller;

        fetchInProgressRef.current = true;

        if (isLoadMore) setIsLoadingMore(true); else { setReviews([]); setIsLoadingMore(true); }
        try {
            const reviewsData = await getReviewsOptimized(businessId, currentPage, 20, source, rating, product && product !== 'all' ? product : null);
            // Si mientras tanto ha salido otra peticion, esta ya no manda.
            if (esLaUltima()) {
                setReviews(prev => isLoadMore ? [...prev, ...reviewsData] : reviewsData);
                setHasMore(reviewsData.length === 20);
            }
        } catch(e) {
            // Ignore abort errors
            if (e instanceof Error && e.name === 'AbortError') return;
            console.error("Error fetching reviews for business:", e instanceof Error ? e.message : String(e), e);
            // Don't set error state here - just show empty reviews
            if (esLaUltima()) {
                setReviews([]);
                setHasMore(false);
            }
        }
        finally {
            if (esLaUltima()) {
                fetchInProgressRef.current = false;
                setIsLoadingMore(false);
            }
        }
    }, []);

    const fetchSearch = useCallback(async (businessId: string, term: string, source: string, rating: typeof ratingFilter, product: string) => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;
        const esLaUltima = () => abortControllerRef.current === controller;

        fetchInProgressRef.current = true;
        setReviews([]);
        setHasMore(false);
        setIsLoadingMore(true);
        try {
            const reviewsData = await searchReviewsOptimized(businessId, term, source, rating, product && product !== 'all' ? product : null);
            if (esLaUltima()) {
                setReviews(reviewsData);
                setHasMore(false);
            }
        } catch (e) {
            if (e instanceof Error && e.name === 'AbortError') return;
            console.error("Error searching reviews:", e instanceof Error ? e.message : String(e), e);
            if (esLaUltima()) {
                setReviews([]);
                setHasMore(false);
            }
        } finally {
            if (esLaUltima()) {
                fetchInProgressRef.current = false;
                setIsLoadingMore(false);
            }
        }
    }, []);

    // Guardas de la carga de la ficha (hallazgo #3: spinner infinito sin error).
    // - cargaIdRef: solo la ultima carga pinta o redirige; la respuesta tardia de
    //   una carga anterior (otra URL, reintento) se descarta.
    // - cadenaRedireccionesRef: rutas desde las que ya se redirigio en esta
    //   carga. Como mucho 2 saltos (slug antiguo -> slug nuevo -> URL canonica) y
    //   nunca de vuelta a una ruta de la cadena; si no, la ficha se pinta donde esta.
    // - loadFailed: la carga fallo o supero FICHA_TIMEOUT_MS; se ofrece Reintentar.
    const cargaIdRef = useRef(0);
    const cadenaRedireccionesRef = useRef<string[]>([]);
    const [loadFailed, setLoadFailed] = useState(false);
    const [reintentos, setReintentos] = useState(0);

    // `t` no es dependencia a proposito: cambiar de idioma no debe recargar la
    // ficha (antes la vaciaba y relanzaba la carga en mitad de la redireccion).
    // Los errores se guardan como clave y se traducen al pintar.
    const fetchBusinessData = useCallback(async () => {
        const miCarga = ++cargaIdRef.current;
        const vigente = () => cargaIdRef.current === miCarga;
        if (!identifier) {
            setError('businessPage.noBusinessId');
            setIsLoadingBusiness(false);
            return;
        }
        setIsLoadingBusiness(true);
        setError(null);
        setLoadFailed(false);
        setBusiness(null);

        // Track if we're redirecting to avoid setting loading false
        let isRedirecting = false;
        // Redirige salvo que forme un bucle o encadene demasiados saltos.
        // Devuelve false si se bloquea: la ficha se pinta en la URL actual.
        const redirigir = (destino: string): boolean => {
            const cadena = cadenaRedireccionesRef.current;
            const actual = normalizarRuta(location.pathname);
            const destinoRuta = normalizarRuta(destino.split(/[?#]/)[0]);
            if (cadena.length >= 2 || cadena.includes(destinoRuta) || destinoRuta === actual) {
                console.warn('[BusinessPage] Redireccion bloqueada para evitar un bucle:', [...cadena, actual, destinoRuta].join(' -> '));
                return false;
            }
            cadenaRedireccionesRef.current = [...cadena, actual];
            isRedirecting = true;
            // El estado viaja con la redireccion: lleva el producto a preseleccionar.
            navigate(destino, { replace: true, state: location.state });
            return true;
        };
        // Tiempo maximo: si vence, esta carga deja de valer y se muestra el error.
        const temporizador = setTimeout(() => {
            if (!vigente()) return;
            cargaIdRef.current++;
            cadenaRedireccionesRef.current = [];
            setLoadFailed(true);
            setIsLoadingBusiness(false);
        }, FICHA_TIMEOUT_MS);

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
                    if (!vigente()) return;
                    if (redirect) {
                        // Redirect 301 to the new URL
                        const pathLang = countryCode ? getLanguageForCountryCode(countryCode) : 'es';
                        const paths = pathTranslations[pathLang] || pathTranslations.es;
                        const newPath = `/${countryCode || 'es'}/${paths.business.replace(':identifier', redirect.new_slug)}`;
                        if (redirigir(newPath)) return;
                    }
                }

                // 3. Fallback: search by name (for legacy URLs)
                if (!businessData) {
                    businessData = await getBusinessByName(decodedIdentifier.replace(/_/g, ' ').trim());
                }
            }

            // Una carga anterior (otra URL, reintento, tiempo agotado) ni pinta ni redirige.
            if (!vigente()) return;

            if (!businessData) {
                setError('businessPage.businessNotFound');
                return;
            }

            // --- URL CANONICA ---
            // Regla: ninguna URL que en master pintaba la ficha cambia. Se
            // redirige EXACTAMENTE cuando master redirigia; si no, la ficha se
            // pinta en su sitio con su <link rel=canonical> (canonicalUrl), como
            // /empresa/<slug>, /es/empresa/<uuid>, /ES/empresa/x o
            // /es/empresa/nombre_en_minusculas de una empresa sin slug.
            const mainCountry = businessData.country?.toUpperCase();
            const sedeCountries = (businessData.sedes as Sede[] || [])
                .map(s => s.country_code?.toUpperCase())
                .filter(Boolean) as string[];
            const allValidCountries = new Set([mainCountry, ...sedeCountries].filter(Boolean));
            const businessSlug = (businessData as any).slug as string | null | undefined;
            const segmentoFicha = location.pathname.split('/').filter(Boolean)[1] ?? '';

            if (dabaError404EnMaster(countryCode, segmentoFicha)) {
                // URL que master respondia con 404 (/gb/empresa/x): directa a la
                // URL canonica. Se conserva el pais de la URL si es sede de la
                // empresa; si no, el pais principal.
                const urlCountryOk = !!countryCode && allValidCountries.has(countryCode.toUpperCase());
                const targetCountry = urlCountryOk ? countryCode!.toLowerCase() : (businessData.country || 'es').toLowerCase();
                const paths = pathTranslations[getLanguageForCountryCode(targetCountry)] || pathTranslations.es;
                const canonicalIdentifier = businessSlug || encodeURIComponent(businessData.name.replace(/ /g, '_'));
                const canonicalPath = `/${targetCountry}/${paths.business.replace(':identifier', canonicalIdentifier)}`;
                if (normalizarRuta(location.pathname) !== normalizarRuta(canonicalPath)
                    && redirigir(`${canonicalPath}${location.search}${location.hash}`)) {
                    return;
                }
            } else {
                // 1) Slug (master): la empresa tiene slug y la URL trae otro
                //    identificador que no es un UUID -> misma URL con el slug.
                //    Sin prefijo, master usaba el pais de la empresa con la ruta
                //    en espanol (/de/empresa/x), que acababa en 404: ahi se usa la
                //    ruta del idioma de ese pais.
                if (businessSlug && !isUuid && decodedIdentifier !== businessSlug) {
                    const prefijo = countryCode || businessData.country?.toLowerCase() || 'es';
                    let paths = pathTranslations[countryCode ? getLanguageForCountryCode(countryCode) : 'es'] || pathTranslations.es;
                    if (dabaError404EnMaster(prefijo, baseDeRuta(paths.business))) {
                        paths = pathTranslations[getLanguageForCountryCode(prefijo)] || pathTranslations.es;
                    }
                    const destino = `/${prefijo}/${paths.business.replace(':identifier', businessSlug)}`;
                    if (normalizarRuta(location.pathname) !== normalizarRuta(destino) && redirigir(destino)) {
                        return;
                    }
                }
                // 2) Pais (master): solo con prefijo de pais y si ese pais no es
                //    sede de la empresa -> su pais principal.
                if (countryCode && allValidCountries.size > 0 && !allValidCountries.has(countryCode.toUpperCase())) {
                    const canonicalCountryPrefix = (businessData.country || 'es').toLowerCase();
                    const paths = pathTranslations[getLanguageForCountryCode(businessData.country)] || pathTranslations.es;
                    const canonicalIdentifier = businessSlug || encodeURIComponent(businessData.name.replace(/ /g, '_'));
                    const destino = `/${canonicalCountryPrefix}/${paths.business.replace(':identifier', canonicalIdentifier)}`;
                    if (normalizarRuta(location.pathname) !== normalizarRuta(destino) && redirigir(destino)) {
                        return;
                    }
                }
            }
            // --- FIN URL CANONICA ---

            const [distribution, counts] = await Promise.all([
                getReviewRatingDistribution(businessData.id),
                getReviewSourceCounts(businessData.id)
            ]);
            if (!vigente()) return;
            setBusiness(businessData);
            setRatingDistribution(distribution);
            setSourceCounts(counts);

        } catch (e) {
            console.error("Error fetching business data:", e instanceof Error ? e.message : String(e));
            // Un fallo de red no es un 404: se ofrece reintentar.
            if (vigente()) setLoadFailed(true);
        } finally {
            // Si se redirige, la carga sigue en la URL nueva: se mantiene el spinner
            // (evita el flash de 404) y el temporizador, que cubre el caso de que
            // esa carga nueva no llegue a arrancar.
            if (!isRedirecting) clearTimeout(temporizador);
            if (!isRedirecting && vigente()) {
                cadenaRedireccionesRef.current = [];
                setIsLoadingBusiness(false);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [identifier, navigate, location.pathname, location.search, location.hash, countryCode]);


    useEffect(() => {
        fetchBusinessData();
        // Al cambiar de URL o desmontar, la carga en curso deja de valer.
        return () => { cargaIdRef.current++; };
    }, [fetchBusinessData, reintentos]);

    // Debounce the search input into the active search term
    useEffect(() => {
        const trimmed = searchInput.trim();
        if (trimmed === activeSearch) return;
        const timeoutId = setTimeout(() => setActiveSearch(trimmed), 350);
        return () => clearTimeout(timeoutId);
    }, [searchInput, activeSearch]);

    // Reset to page 1 and fetch when filters or the active search change.
    // In search mode we run the search query; otherwise the normal paginated list.
    useEffect(() => {
        if (business) {
            setPage(1);
            if (activeSearch) {
                fetchSearch(business.id, activeSearch, sourceFilter, ratingFilter, productFilter);
            } else {
                fetchReviews(business.id, 1, sourceFilter, ratingFilter, false, productFilter);
            }
        }
    }, [business, sourceFilter, ratingFilter, productFilter, activeSearch, fetchReviews, fetchSearch]);

    // Load more reviews when page changes (but not when filters change, and never in search mode)
    const prevFiltersRef = useRef({ sourceFilter, ratingFilter, productFilter });
    useEffect(() => {
        const filtersChanged = prevFiltersRef.current.sourceFilter !== sourceFilter ||
                               prevFiltersRef.current.ratingFilter !== ratingFilter ||
                               prevFiltersRef.current.productFilter !== productFilter;
        prevFiltersRef.current = { sourceFilter, ratingFilter, productFilter };

        if (business && page > 1 && !filtersChanged && !activeSearch) {
            fetchReviews(business.id, page, sourceFilter, ratingFilter, true, productFilter);
        }
    }, [page, business, sourceFilter, ratingFilter, productFilter, activeSearch, fetchReviews]);

    // Productos activos de la empresa. Si falla, la ficha se comporta como
    // siempre: sin sección de productos y sin filtro.
    useEffect(() => {
        // Otra empresa (la pagina no se desmonta al ir de una ficha a otra):
        // el producto elegido en la anterior aqui no existe y dejaria la lista vacia.
        setProductFilter('all');
        setProducts([]);
        if (!business?.id) return;
        let cancelled = false;
        getPublicBusinessProducts(business.id)
            .then(list => { if (!cancelled) setProducts(list.filter(p => p.is_active)); })
            .catch(err => console.error('No se pudieron cargar los productos de la ficha:', err));
        return () => { cancelled = true; };
    }, [business?.id]);

    // Llegada con un producto preseleccionado («ver reseñas de este producto»
    // desde el panel u otra pantalla de la app). Viaja en el ESTADO de la
    // navegacion (navigate(url, { state: { productId } })), nunca en la URL.
    // Se aplica una vez por entrada del historial y solo si el producto existe
    // y esta activo en esta empresa.
    const productoPreseleccionadoRef = useRef<string | null>(null);
    useEffect(() => {
        const pedido = (location.state as { productId?: unknown } | null)?.productId;
        if (typeof pedido !== 'string' || productoPreseleccionadoRef.current === location.key) return;
        if (!products.some(p => p.id === pedido)) return;
        productoPreseleccionadoRef.current = location.key;
        setProductFilter(pedido);
    }, [location.key, location.state, products]);
    
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
        if (business && business.plan !== 'free' && AI_ENABLED) {
            generateInsights();
        } else {
            setIsLoadingInsights(false); // Make sure loading stops for free plans
        }
        
    }, [business?.id, language]);

    // Meta Pixel ViewContent (fires once per business view)
    useEffect(() => {
        if (!business?.id) return;
        void trackMetaEvent('ViewContent', {
            userData: { email: user?.email, external_id: user?.id },
            customData: {
                content_ids: [business.id],
                content_name: business.name,
                content_type: 'business',
            },
        });
    }, [business?.id, business?.name, user?.email, user?.id]);

    // La carga fallo o tardo demasiado: nunca spinner infinito. noindex para
    // que un buscador no guarde este estado como si fuera la ficha.
    if (loadFailed) {
        return (
            <>
                <Meta title={t('businessPage.fichaLoadErrorTitle')} description={t('businessPage.fichaLoadErrorMessage')} noindex />
                <div role="alert" className="max-w-md mx-auto my-12 sm:my-16 text-center bg-white dark:bg-zinc-800 p-6 sm:p-8 rounded-xl shadow-lg border border-gray-200 dark:border-zinc-700">
                    <div className="text-3xl sm:text-4xl text-gray-300 dark:text-gray-600 mb-3">
                        <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
                    </div>
                    <h1 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100">{t('businessPage.fichaLoadErrorTitle')}</h1>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{t('businessPage.fichaLoadErrorMessage')}</p>
                    <button
                        type="button"
                        data-testid="ficha-reintentar"
                        onClick={() => { cadenaRedireccionesRef.current = []; setReintentos(n => n + 1); }}
                        className="mt-5 min-h-[44px] bg-brand-green text-white font-bold py-2.5 px-6 rounded-lg hover:bg-opacity-90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-800"
                    >
                        {t('businessPage.fichaLoadErrorRetry')}
                    </button>
                </div>
            </>
        );
    }

    // FIX: Add missing return statement
    if (isLoadingBusiness) {
        return <div className="flex justify-center items-center h-96" role="status" aria-busy="true"><Spinner /></div>;
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
            <Meta title={metaTitle} description={metaDescription} canonical={canonicalUrl} noindex={isWrongCountry} />
            {schemaData && <Schema data={schemaData} id="schema-localbusiness" />}
            {productSchemaData && <Schema data={productSchemaData} id="schema-product" />}
            <style>{iconStyle}</style>

            <div className="space-y-4 sm:space-y-6">
                <header className="bg-white dark:bg-zinc-800 p-3 sm:p-4 md:p-6 rounded-xl shadow-lg border dark:border-zinc-700">
                    <div className="flex flex-col gap-3 sm:gap-4">
                        {/* Logo and Title Row */}
                        <div className="flex items-start gap-3 sm:gap-4">
                            <BusinessLogo
                                logoUrl={logoToDisplay}
                                businessName={business.name}
                                tone={logoToneToDisplay}
                                className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24"
                                iconSize="text-2xl sm:text-3xl md:text-4xl"
                                width={96}
                                height={96}
                            />
                            <div className="flex-grow min-w-0">
                                <div className="flex flex-col gap-1.5 sm:gap-2">
                                    <h1 className="text-lg sm:text-2xl md:text-3xl font-extrabold text-gray-800 dark:text-gray-100 break-words">
                                        {business?.name}
                                    </h1>
                                    {/* Sin enlace: el botón «Gestionar» de debajo ya lleva al panel. */}
                                    <OwnBusinessBadge business={business} size="md" className="self-start" />
                                </div>
                                <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-1 mt-1.5 sm:mt-2">
                                    <div className="flex items-center gap-1 sm:gap-1.5"><StarRating rating={averageRating} /><span className="font-bold text-xs sm:text-sm md:text-base text-gray-700 dark:text-gray-200">{averageRating.toFixed(1)}</span></div>
                                    <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{totalReviews} {totalReviews === 1 ? t('common.review') : t('common.reviews')}</span>
                                </div>
                                {/* Ficha de otro país que el de búsqueda del usuario: se indica
                                    con discreción. Ni el idioma ni el selector de país cambian. */}
                                {(() => {
                                    const fichaCountry = (activeCountryCode || business.country || '').toUpperCase();
                                    if (!country || !fichaCountry || fichaCountry === country) return null;
                                    const info = COUNTRIES.find(c => c.code === fichaCountry) || SEDE_COUNTRIES.find(c => c.code === fichaCountry);
                                    return (
                                        <span data-testid="foreign-business-badge" className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-blue-800 dark:text-blue-200 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">
                                            {info?.flag && <img src={info.flag} alt="" width={16} height={12} className="w-4 h-3 rounded-sm object-cover" />}
                                            {t('common.businessFromCountry', { country: countryNameOf(fichaCountry, info?.name || fichaCountry) })}
                                        </span>
                                    );
                                })()}
                            </div>
                        </div>
                        {/* Buttons Row */}
                        <div className="flex flex-col xs:flex-row gap-2 sm:gap-3">
                            {ownBusiness ? (
                                <Link to={getBusinessDashboardPath(ownBusiness, undefined, language)} data-own-business="true" className="w-full xs:flex-1 text-center text-xs sm:text-sm md:text-base bg-brand-green text-white font-bold py-2 sm:py-2.5 px-3 sm:px-4 md:px-5 rounded-lg hover:bg-opacity-90 transition-colors shadow-sm whitespace-nowrap"><i className="fa-solid fa-gauge mr-1.5" aria-hidden="true"></i>{t('businessPage.manageBusiness')}</Link>
                            ) : (
                                <button onClick={handleWriteReviewClick} className="w-full xs:flex-1 text-xs sm:text-sm md:text-base bg-brand-green text-white font-bold py-2 sm:py-2.5 px-3 sm:px-4 md:px-5 rounded-lg hover:bg-opacity-90 transition-colors shadow-sm whitespace-nowrap">{t('businessPage.writeReview')}</button>
                            )}
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
                    <section className="lg:col-span-2 space-y-3 sm:space-y-4 md:space-y-6">
                        {isLoadingInsights ? <div className="bg-white dark:bg-zinc-800 p-4 sm:p-5 md:p-6 rounded-xl shadow-sm border dark:border-zinc-700 flex justify-center"><Spinner/></div> : insights && (
                            <div className="bg-white dark:bg-zinc-800 p-4 sm:p-5 md:p-6 rounded-xl shadow-sm border dark:border-zinc-700">
                                <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-gray-800 dark:text-gray-100">{t('businessPage.aiSummary')}</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                                    <div><h3 className="font-semibold text-sm sm:text-base text-green-700 dark:text-green-400 mb-2">{t('businessPage.strongPoints')}</h3><ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-gray-600 dark:text-gray-300">{insights.good_points.map((p,i)=><li key={i}>{p}</li>)}</ul></div>
                                    <div><h3 className="font-semibold text-sm sm:text-base text-yellow-700 dark:text-yellow-400 mb-2">{t('businessPage.improvementPoints')}</h3><ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-gray-600 dark:text-gray-300">{insights.improvement_points.map((p,i)=><li key={i}>{p}</li>)}</ul></div>
                                </div>
                            </div>
                        )}


                        <div ref={reviewsSectionRef} className="bg-white dark:bg-zinc-800 p-3 sm:p-4 md:p-6 rounded-xl shadow-sm border dark:border-zinc-700 scroll-mt-4">
                            <h2 className="text-base sm:text-lg md:text-xl font-bold mb-3 sm:mb-4 text-gray-800 dark:text-gray-100">
                                {selectedProduct
                                    ? t('businessPage.reviewsOfProduct', { name: selectedProduct.name })
                                    : t('businessPage.allReviewsFor', { businessName: business.name })}
                            </h2>
                            <div className="flex flex-col gap-3 mb-4 pb-3 sm:pb-4 border-b dark:border-zinc-700">
                                <div className="relative">
                                    <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs sm:text-sm pointer-events-none"></i>
                                    <input
                                        type="text"
                                        value={searchInput}
                                        onChange={(e) => setSearchInput(e.target.value)}
                                        placeholder={t('businessPage.searchReviewsPlaceholder')}
                                        aria-label={t('businessPage.searchReviewsPlaceholder')}
                                        className="w-full pl-9 pr-9 py-2 sm:py-2.5 text-xs sm:text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-green/50 focus:border-brand-green"
                                    />
                                    {searchInput && (
                                        <button
                                            onClick={() => setSearchInput('')}
                                            aria-label={t('businessPage.clearSearch')}
                                            title={t('businessPage.clearSearch')}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
                                        >
                                            <i className="fa-solid fa-xmark text-sm"></i>
                                        </button>
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">{t('businessPage.source')}:</span>
                                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                        {sourceCounts && [ 'all', 'opynio', 'google', 'trustindex' ].map(s => {
                                            const key = s === 'all' ? 'total' : s as keyof typeof sourceCounts;
                                            // Con un producto elegido, las cifras son las de ese
                                            // producto. Mientras llegan (o si fallan) el chip sale
                                            // sin cifra, con la visibilidad de la empresa, en vez de
                                            // una cifra que no es la de lo que se esta viendo.
                                            const scoped = chipSourceCounts;
                                            const count = (scoped ?? sourceCounts)[key];
                                            // El chip activo no desaparece aunque el producto no
                                            // tenga resenas de esa fuente: si no, el filtro seguiria
                                            // aplicado sin ningun chip que lo muestre ni lo quite.
                                            // «Todas» se queda con producto elegido aunque sea (0).
                                            if (count > 0 || (sourceFilter === s && s !== 'all') || (s === 'all' && !!selectedProduct)) {
                                                const label = selectedProduct && !scoped ? t(`businessPage.${s}`) : `${t(`businessPage.${s}`)} (${count})`;
                                                return <FilterChip key={s} label={label} isActive={sourceFilter === s} onClick={() => setSourceFilter(s as any)} />;
                                            }
                                            return null;
                                        })}
                                    </div>
                                </div>
                                {/* Barra de estado del filtro. Antes habia aqui un
                                    desplegable de productos: un segundo mando para lo
                                    mismo que las tarjetas de arriba, sin decir cual
                                    estaba activo. */}
                                {selectedProduct && (
                                    <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg bg-brand-green/10 border border-brand-green/30">
                                        <i className="fa-solid fa-filter text-brand-green text-xs flex-shrink-0" aria-hidden="true"></i>
                                        <span className="min-w-0 text-xs sm:text-sm text-gray-800 dark:text-gray-100">
                                            {t('businessPage.reviewsOfProduct', { name: selectedProduct.name })}
                                        </span>
                                        {/* Contador del producto: la cifra de la ficha entera no vale aqui. */}
                                        <span data-testid="product-filter-count" className="text-xs font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">
                                            {(selectedProduct.review_count ?? 0)} {(selectedProduct.review_count ?? 0) === 1 ? t('common.review') : t('common.reviews')}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setProductFilter('all')}
                                            className="ml-auto min-h-[36px] inline-flex items-center gap-1.5 px-2.5 rounded-full text-xs font-semibold bg-white/70 dark:bg-zinc-800 text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand-green transition-colors"
                                        >
                                            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
                                            {t('businessPage.allProducts')}
                                        </button>
                                    </div>
                                )}
                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">{t('businessPage.rating')}:</span>
                                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                        {['all', '5', '4+', '3-'].map(r => <FilterChip key={r} label={t(`businessPage.${r.replace('+','StarsOrMore').replace('-','StarsOrLess')+'Stars'}` as any, { stars: r })} isActive={ratingFilter === r} onClick={() => setRatingFilter(r as any)} />)}
                                    </div>
                                </div>
                            </div>

                            {activeSearch && !isLoadingMore && (
                                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-3">
                                    {t('businessPage.searchResultsCount', { count: reviews.length, term: activeSearch })}
                                </p>
                            )}

                            {isLoadingMore && reviews.length === 0 ? <div className="flex justify-center py-6 sm:py-8"><Spinner /></div> : reviews.length > 0 ? (
                                <div className="space-y-4 sm:space-y-6 hide-scrollbar">
                                    {reviews.map(review => <LazyRender key={review.id} placeholderHeight="250px"><ReviewCard review={review} /></LazyRender>)}
                                    {hasMore && <div className="text-center pt-3 sm:pt-4"><button onClick={() => setPage(p => p+1)} disabled={isLoadingMore} className="bg-brand-dark text-white font-semibold px-4 sm:px-5 md:px-6 py-2 sm:py-2.5 md:py-3 text-sm sm:text-base rounded-md hover:bg-opacity-90">{isLoadingMore ? t('common.loading') : t('businessPage.loadMore')}</button></div>}
                                </div>
                            ) : activeSearch ? (
                                <PlaceholderMessage icon="fa-magnifying-glass" title={t('businessPage.noSearchResults', { term: activeSearch })} message={t('businessPage.noSearchResultsSubtitle')} />
                            ) : (
                                <PlaceholderMessage icon="fa-comment-slash" title={t('businessPage.noReviewsMatchingFilter')} message={t('businessPage.noReviewsMatchingFilterSubtitle')} />
                            )}
                        </div>
                    </section>

                    <aside className="lg:col-span-1 space-y-3 sm:space-y-4 self-start lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto hide-scrollbar">
                        {products.length > 0 && (
                            <div className="bg-white dark:bg-zinc-800 p-3 sm:p-4 md:p-5 rounded-xl shadow-sm border dark:border-zinc-700">
                                {/* allLabel: sin producto elegido el boton decia "Todos",
                                    que no dice de que. Ahora nombra lo que se esta viendo. */}
                                <ProductChooser
                                    products={products}
                                    value={productFilter}
                                    title={t('businessPage.productsTitle')}
                                    hint={t('businessPage.productsFilterHint')}
                                    allLabel={t('businessPage.allReviewsFor', { businessName: business.name })}
                                    reviewsWord={(n) => (n === 1 ? t('common.review') : t('common.reviews'))}
                                    searchPlaceholder={t('writeReviewPage.productSearchPlaceholder')}
                                    noResults={t('writeReviewPage.productSearchNoResults')}
                                    onChange={(id) => {
                                        setProductFilter(id);
                                        if (id !== 'all') {
                                            reviewsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                        }
                                    }}
                                />
                            </div>
                        )}

                        <div>
                            {/* Con un producto elegido, la distribucion es la de sus
                                resenas (subconjunto). Con «Todas», la de la empresa. */}
                            {selectedProduct ? (
                                <RatingDistribution
                                    distribution={currentProductStats?.data?.distribution ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }}
                                    totalReviews={productDistributionTotal}
                                    isLoading={!currentProductStats || (!currentProductStats.data && !currentProductStats.failed)}
                                    errorMessage={currentProductStats?.failed ? t('businessPage.productStatsError') : null}
                                    emptyMessage={t('businessPage.productNoReviewsYet')}
                                    subtitle={
                                        <>
                                            <p className="flex items-start gap-1.5 min-w-0">
                                                <i className="fa-solid fa-tag text-brand-green mt-0.5 flex-shrink-0" aria-hidden="true"></i>
                                                <span className="min-w-0 break-words">{t('businessPage.ratingDistributionOnlyProduct', { name: selectedProduct.name })}</span>
                                            </p>
                                            {currentProductStats?.data && productDistributionTotal > 0 && (
                                                <div data-testid="rating-distribution-summary" className="mt-1 flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                                                    <StarRating rating={productDistributionAverage} size="small" />
                                                    <span className="font-semibold text-gray-700 dark:text-gray-200">{productDistributionAverage.toFixed(1)}</span>
                                                    <span aria-hidden="true">·</span>
                                                    <span>{productDistributionTotal} {productDistributionTotal === 1 ? t('common.review') : t('common.reviews')}</span>
                                                </div>
                                            )}
                                        </>
                                    }
                                />
                            ) : (
                                <RatingDistribution distribution={ratingDistribution} totalReviews={totalReviews} />
                            )}
                        </div>
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

                        {/* Es tu negocio: en lugar de "reclamar", acceso al panel. */}
                        {business && ownBusiness && (
                            <div className="bg-green-50 dark:bg-green-900/20 p-3 sm:p-4 rounded-xl shadow-sm border-2 border-green-200 dark:border-green-800" data-own-business="true">
                                <div className="flex items-start gap-2 mb-2">
                                    <i className="fa-solid fa-store text-brand-green text-base sm:text-lg mt-0.5" aria-hidden="true"></i>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-xs sm:text-sm text-gray-900 dark:text-gray-100">{t('businessPage.ownBusinessTitle')}</h3>
                                        <p className="text-[10px] sm:text-xs text-gray-700 dark:text-gray-300 mt-1">{t('businessPage.ownBusinessSubtitle')}</p>
                                    </div>
                                </div>
                                <Link
                                    to={getBusinessDashboardPath(ownBusiness, undefined, language)}
                                    className="block w-full text-center bg-brand-green hover:bg-opacity-90 text-white font-semibold text-xs sm:text-sm py-2 px-3 rounded-lg transition-colors shadow-sm"
                                >
                                    <i className="fa-solid fa-gauge mr-1.5" aria-hidden="true"></i>
                                    {t('businessPage.manageBusiness')}
                                </Link>
                            </div>
                        )}

                        {/* Claim Business Section - Only show if business is unclaimed */}
                        {business && !business.owner_id && !ownBusiness && (
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
                                        navigate(localizedPath('support', language, country || 'es'), {
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