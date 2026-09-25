
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    adminGetFeaturedCompanies,
    adminSetFeaturedCompanies,
    adminSearchBusinessesToFeature,
    getReviewStatsForBusinesses,
} from '../../../services/supabaseService';
import { useNotification } from '../../../contexts/NotificationContext';
import { useConfirm } from '../../../contexts/ConfirmContext';
import Spinner from '../../Spinner';
import Meta from '../../Meta';
import Modal from '../../Modal';
import { useTranslation } from '../../../contexts/i18nContext';
import StarRating from '../../StarRating';
import { COUNTRIES } from '../../../constants';
import AdminBackLink from './AdminBackLink';

// La portada de cada pais pide getFeaturedBusinessesWithStats(pais, 10): mas de
// 10 destacadas de un mismo pais no se verian. El tope es por pais, no global:
// con un tope global de 10 el boton «Añadir» se quedaba desactivado (sin
// explicarlo) en cuanto habia 10 destacadas entre todos los paises.
const MAX_PER_COUNTRY = 10;
const SEARCH_PAGE_SIZE = 10;

interface FeaturedRow {
    id: string;
    name: string;
    country: string | null;
    logo_url?: string | null;
}

interface SearchResult {
    id: string;
    name: string;
    country: string | null;
    logo_url: string | null;
}

type Stats = Map<string, { avg_rating: number; review_count: number }>;

const CountryTag: React.FC<{ code: string | null }> = ({ code }) => {
    if (!code) return <span className="text-gray-400">—</span>;
    const info = COUNTRIES.find(c => c.code === code);
    return (
        <span className="inline-flex items-center gap-1.5" title={info?.name || code}>
            {info && <img src={info.flag} alt="" width={20} height={14} loading="lazy" decoding="async" className="w-5 h-3.5 object-cover rounded-sm" />}
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{code}</span>
        </span>
    );
};

const AdminFeaturedBusinessesPage: React.FC = () => {
    const { showNotification } = useNotification();
    const { confirm } = useConfirm();
    const t = useTranslation();
    const [featuredBusinesses, setFeaturedBusinesses] = useState<FeaturedRow[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Modal «Añadir destacada»
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedTerm, setDebouncedTerm] = useState('');
    const [searchPage, setSearchPage] = useState(1);
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searchCount, setSearchCount] = useState(0);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [addingId, setAddingId] = useState<string | null>(null);

    // silent: recarga tras guardar sin cambiar la tabla por el spinner (la tabla
    // sigue a la vista, bloqueada, hasta que llega el orden real de la BD).
    const fetchFeatured = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const data = await adminGetFeaturedCompanies() as FeaturedRow[];
            setFeaturedBusinesses(data);
            // Valoracion y numero de resenas reales, de la misma fuente que la home.
            try {
                setStats(await getReviewStatsForBusinesses(data.map(b => b.id)));
            } catch (statsError) {
                console.error('Error loading featured stats:', statsError);
                setStats(null);
                showNotification(t('adminFeatured.errorLoadingStats'), 'error');
            }
        } catch (error: any) {
            showNotification(error?.message || t('adminFeatured.errorLoading'), 'error');
        } finally {
            setLoading(false);
        }
    }, [showNotification, t]);

    useEffect(() => {
        fetchFeatured();
    }, [fetchFeatured]);

    const featuredPerCountry = useMemo(() => {
        const counts = new Map<string, number>();
        for (const b of featuredBusinesses) {
            const key = b.country || '';
            counts.set(key, (counts.get(key) || 0) + 1);
        }
        return counts;
    }, [featuredBusinesses]);

    const isCountryFull = (country: string | null) => (featuredPerCountry.get(country || '') || 0) >= MAX_PER_COUNTRY;

    // Debounce del buscador; cada termino nuevo vuelve a la pagina 1.
    useEffect(() => {
        if (!isSearchModalOpen) return;
        const handler = setTimeout(() => {
            setDebouncedTerm(searchTerm);
            setSearchPage(1);
        }, 300);
        return () => clearTimeout(handler);
    }, [searchTerm, isSearchModalOpen]);

    useEffect(() => {
        if (!isSearchModalOpen) return;
        let cancelado = false;
        setIsSearching(true);
        setSearchError(null);
        adminSearchBusinessesToFeature(debouncedTerm, searchPage, SEARCH_PAGE_SIZE)
            .then(({ data, count }) => {
                if (cancelado) return;
                setSearchResults(data);
                setSearchCount(count);
            })
            .catch((error: any) => {
                if (cancelado) return;
                console.error('Error searching businesses:', error);
                setSearchResults([]);
                setSearchCount(0);
                setSearchError(error?.message || t('adminFeatured.errorSearching'));
            })
            .finally(() => { if (!cancelado) setIsSearching(false); });
        return () => { cancelado = true; };
    }, [debouncedTerm, searchPage, isSearchModalOpen, t]);

    const openSearchModal = () => {
        setSearchTerm('');
        setDebouncedTerm('');
        setSearchPage(1);
        setSearchResults([]);
        setSearchCount(0);
        setSearchError(null);
        setIsSearchModalOpen(true);
    };

    // Guardados en serie. Antes dos arrastres seguidos lanzaban dos guardados a
    // la vez y sus escrituras (marcar con su orden y desmarcar el resto) se
    // mezclaban: orden cruzado, una recien anadida desmarcada. Ahora, mientras
    // hay uno en marcha no se puede arrastrar, quitar ni anadir; cada guardado
    // espera al anterior; y en el servidor es una sola transaccion con candado
    // (admin_save_featured_businesses), que tambien ordena dos pestanas a la vez.
    const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
    const pendingSaves = useRef(0);
    const isBusy = () => pendingSaves.current > 0;

    const saveChanges = (list: FeaturedRow[]): Promise<boolean> => {
        pendingSaves.current += 1;
        setIsSaving(true);
        const run = async () => {
            try {
                await adminSetFeaturedCompanies(list.map(b => b.id));
                showNotification(t('adminFeatured.listUpdated'), 'success');
                return true;
            } catch (error: any) {
                console.error('Error saving featured:', error);
                showNotification(`${t('adminFeatured.errorSaving')} ${error?.message || ''}`.trim(), 'error');
                return false;
            } finally {
                await fetchFeatured(true); // estado real de la BD, haya ido bien o mal
                pendingSaves.current -= 1;
                if (pendingSaves.current === 0) setIsSaving(false);
            }
        };
        const result = saveQueue.current.then(run, run);
        saveQueue.current = result.catch(() => undefined);
        return result;
    };

    const handleRemoveFeatured = async (businessId: string) => {
        if (isBusy()) return;
        const ok = await confirm({
            title: t('adminFeatured.removeTitle'),
            message: t('adminFeatured.confirmRemove'),
            confirmText: t('adminFeatured.remove'),
            cancelText: t('common.cancel'),
            danger: true,
        });
        if (!ok || isBusy()) return;
        const newList = featuredBusinesses.filter(b => b.id !== businessId);
        setFeaturedBusinesses(newList);
        await saveChanges(newList);
    };

    const handleAddFeatured = async (business: SearchResult) => {
        if (isBusy()) return;
        if (isCountryFull(business.country)) {
            const pais = COUNTRIES.find(c => c.code === business.country)?.name || business.country || '';
            showNotification(t('adminFeatured.maxPerCountry', { max: MAX_PER_COUNTRY, country: pais }), 'error');
            return;
        }
        setAddingId(business.id);
        // Al final de la lista: adminSetFeaturedCompanies guarda featured_order
        // segun la posicion.
        const newList = [...featuredBusinesses, { id: business.id, name: business.name, country: business.country, logo_url: business.logo_url }];
        const ok = await saveChanges(newList);
        setAddingId(null);
        if (ok) setIsSearchModalOpen(false);
    };

    // Reordenar arrastrando (no mientras se guarda: la fila en pantalla aun no
    // es la de la BD y el orden nuevo pisaria al que se esta guardando)
    const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
        if (isBusy()) {
            e.preventDefault();
            return;
        }
        e.dataTransfer.setData('text/plain', index.toString());
    };

    const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>) => {
        e.preventDefault();
    };

    const handleDrop = async (e: React.DragEvent<HTMLTableRowElement>, targetIndex: number) => {
        e.preventDefault();
        if (isBusy()) return;
        const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (Number.isNaN(sourceIndex) || sourceIndex === targetIndex) return;

        const newList = [...featuredBusinesses];
        const [removed] = newList.splice(sourceIndex, 1);
        newList.splice(targetIndex, 0, removed);

        setFeaturedBusinesses(newList);
        await saveChanges(newList);
    };

    const totalSearchPages = Math.max(1, Math.ceil(searchCount / SEARCH_PAGE_SIZE));

    return (
        <>
            <Meta title={`${t('adminFeatured.title')} - Admin`} description={t('adminFeatured.subtitle')} />
            <AdminBackLink />
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold text-gray-800 dark:text-gray-100">{t('adminFeatured.title')}</h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">{t('adminFeatured.subtitle')}</p>
                    </div>
                    <button
                        type="button"
                        onClick={openSearchModal}
                        className="bg-brand-green text-white font-bold py-2.5 px-5 rounded-lg hover:bg-opacity-90 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        disabled={loading || isSaving}
                    >
                        <i className="fa-solid fa-plus-circle" aria-hidden="true"></i>
                        <span>{t('adminFeatured.addFeatured')}</span>
                    </button>
                </div>

                <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl shadow-md border dark:border-zinc-700">
                    <div className="flex items-center justify-between gap-3 mb-1">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{t('adminFeatured.currentFeatured')}</h2>
                        <span className="text-sm text-gray-500 dark:text-gray-400 inline-flex items-center gap-2" aria-live="polite">
                            {isSaving && (
                                <>
                                    <span className="w-4 h-4 border-2 border-brand-green border-t-transparent rounded-full animate-spin" aria-hidden="true"></span>
                                    {t('common.saving')}
                                </>
                            )}
                        </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('adminFeatured.perCountryNote', { max: MAX_PER_COUNTRY })}</p>

                    {loading ? (
                        <div className="flex justify-center py-10"><Spinner /></div>
                    ) : featuredBusinesses.length === 0 ? (
                        <p className="text-center py-10 text-gray-500 dark:text-gray-400">{t('adminFeatured.noFeatured')}</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-600 dark:text-gray-400">
                                <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-zinc-700">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 w-16 text-center">#</th>
                                        <th scope="col" className="px-6 py-3">{t('adminFeatured.business')}</th>
                                        <th scope="col" className="px-6 py-3">{t('adminFeatured.country')}</th>
                                        <th scope="col" className="px-6 py-3">{t('adminFeatured.rating')}</th>
                                        <th scope="col" className="px-6 py-3">{t('adminFeatured.reviews')}</th>
                                        <th scope="col" className="px-6 py-3 text-right">{t('adminFeatured.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {featuredBusinesses.map((business, index) => {
                                        const s = stats?.get(business.id);
                                        return (
                                            <tr
                                                key={business.id}
                                                className={`bg-white dark:bg-zinc-800 border-b dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700/50 ${isSaving ? 'cursor-wait opacity-60' : 'cursor-move'}`}
                                                draggable={!isSaving}
                                                aria-busy={isSaving || undefined}
                                                onDragStart={(e) => handleDragStart(e, index)}
                                                onDragOver={handleDragOver}
                                                onDrop={(e) => handleDrop(e, index)}
                                            >
                                                <td className="px-6 py-4 text-center font-bold text-gray-400 whitespace-nowrap">
                                                    <i className="fa-solid fa-grip-vertical mr-2" aria-hidden="true"></i>
                                                    {index + 1}
                                                </td>
                                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-md bg-gray-100 dark:bg-zinc-700 flex-shrink-0 overflow-hidden border dark:border-zinc-600 flex items-center justify-center">
                                                            {business.logo_url ? (
                                                                <img src={business.logo_url} alt="" width={40} height={40} loading="lazy" decoding="async" className="w-full h-full object-contain p-0.5" />
                                                            ) : (
                                                                <i className="fa-solid fa-store text-gray-400" aria-hidden="true"></i>
                                                            )}
                                                        </div>
                                                        <span className="truncate max-w-xs" title={business.name}>{business.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4"><CountryTag code={business.country} /></td>
                                                <td className="px-6 py-4">
                                                    {s ? (
                                                        s.review_count > 0 ? (
                                                            <div className="flex items-center gap-2">
                                                                <StarRating rating={s.avg_rating} size="small" />
                                                                <span>{s.avg_rating.toFixed(1)}</span>
                                                            </div>
                                                        ) : <span className="text-gray-400">—</span>
                                                    ) : <span className="text-gray-400">—</span>}
                                                </td>
                                                <td className="px-6 py-4">{s ? s.review_count.toLocaleString('es-ES') : '—'}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveFeatured(business.id)}
                                                        className="text-red-500 hover:text-red-700 font-medium inline-flex items-center gap-1 disabled:opacity-50"
                                                        disabled={isSaving}
                                                    >
                                                        <i className="fa-solid fa-trash-can" aria-hidden="true"></i>
                                                        <span>{t('adminFeatured.remove')}</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            <p className="text-xs text-gray-500 mt-2 text-center italic">
                                <i className="fa-solid fa-info-circle mr-1" aria-hidden="true"></i>
                                {t('adminFeatured.dragToReorder')}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {isSearchModalOpen && (
                <Modal title={t('adminFeatured.addFeatured')} onClose={() => { if (!addingId) setIsSearchModalOpen(false); }}>
                    <div className="py-4 space-y-3">
                        <div className="relative">
                            <label htmlFor="featured-search" className="sr-only">{t('adminFeatured.searchPlaceholder')}</label>
                            <input
                                id="featured-search"
                                type="search"
                                placeholder={t('adminFeatured.searchPlaceholder')}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full p-3 pr-10 border border-gray-300 dark:border-zinc-600 rounded-lg bg-transparent focus:ring-2 focus:ring-brand-green"
                                autoFocus
                            />
                            {isSearching && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 border-2 border-brand-green border-t-transparent rounded-full animate-spin" aria-hidden="true"></div>
                            )}
                        </div>
                        <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                            <span>{t('adminFeatured.searchHint')}</span>
                            {!isSearching && !searchError && <span aria-live="polite">{searchCount === 1 ? t('adminFeatured.resultsCountOne') : t('adminFeatured.resultsCount', { count: searchCount.toLocaleString('es-ES') })}</span>}
                        </div>
                        <div className="max-h-72 overflow-y-auto border border-gray-200 dark:border-zinc-700 rounded-lg">
                            {searchError ? (
                                <p className="text-center p-4 text-red-600 dark:text-red-400" role="alert">{searchError}</p>
                            ) : !isSearching && searchResults.length === 0 ? (
                                <p className="text-center p-4 text-gray-500">{t('adminFeatured.noResults')}</p>
                            ) : (
                                <ul className={`divide-y divide-gray-100 dark:divide-zinc-700 ${isSearching ? 'opacity-60' : ''}`}>
                                    {searchResults.map(biz => {
                                        const lleno = isCountryFull(biz.country);
                                        const anadiendo = addingId === biz.id;
                                        return (
                                            <li key={biz.id}>
                                                <button
                                                    type="button"
                                                    onClick={() => handleAddFeatured(biz)}
                                                    disabled={lleno || !!addingId}
                                                    className="w-full p-3 text-left flex justify-between items-center gap-3 hover:bg-gray-50 dark:hover:bg-zinc-700/50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                                >
                                                    <span className="min-w-0">
                                                        <span className={`block font-medium truncate ${lleno ? 'text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-200'}`}>{biz.name}</span>
                                                        <span className="flex items-center gap-2 mt-0.5">
                                                            <CountryTag code={biz.country} />
                                                            {lleno && <span className="text-xs text-amber-700 dark:text-amber-400">{t('adminFeatured.countryFull', { max: MAX_PER_COUNTRY })}</span>}
                                                        </span>
                                                    </span>
                                                    {anadiendo ? (
                                                        <span className="text-xs text-gray-500 flex-shrink-0">{t('adminFeatured.adding')}</span>
                                                    ) : !lleno && (
                                                        <span className="text-brand-green text-sm font-semibold flex-shrink-0 inline-flex items-center gap-1">
                                                            <i className="fa-solid fa-plus" aria-hidden="true"></i>{t('adminFeatured.add')}
                                                        </span>
                                                    )}
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                        {searchCount > SEARCH_PAGE_SIZE && (
                            <nav className="flex justify-between items-center pt-1">
                                <button type="button" onClick={() => setSearchPage(p => Math.max(1, p - 1))} disabled={searchPage === 1 || isSearching} className="px-3 py-1 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-600 disabled:opacity-50">{t('common.previous')}</button>
                                <span className="text-sm">{t('common.page', { current: searchPage, total: totalSearchPages })}</span>
                                <button type="button" onClick={() => setSearchPage(p => Math.min(totalSearchPages, p + 1))} disabled={searchPage >= totalSearchPages || isSearching} className="px-3 py-1 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-600 disabled:opacity-50">{t('common.next')}</button>
                            </nav>
                        )}
                    </div>
                </Modal>
            )}
        </>
    );
};

export default AdminFeaturedBusinessesPage;
