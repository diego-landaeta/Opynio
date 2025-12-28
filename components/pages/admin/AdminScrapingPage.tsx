import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Meta from '../../Meta';
import { useNotification } from '../../../contexts/NotificationContext';
import { getScrapingQueue, startScrapingSearch, deleteScrapingQueueItems, updateScrapingQueueItem, supabase, instantFullScrape, type InstantFullScrapeResult, getScrapingSession, type ScrapingSession } from '../../../services/supabaseService';
import type { ScrapingQueueItem } from '../../../types';
import Spinner from '../../Spinner';
import { CATEGORIES, COUNTRIES } from '../../../constants';
import Modal from '../../Modal';
import { useTranslation } from '../../../contexts/i18nContext';

const ITEMS_PER_PAGE = 25;

const AdminScrapingPage: React.FC = () => {
    const { showNotification } = useNotification();
    const t = useTranslation();
    const [queue, setQueue] = useState<ScrapingQueueItem[]>([]);
    const [loadingQueue, setLoadingQueue] = useState(true);
    const [searchUrl, setSearchUrl] = useState('');
    const [country, setCountry] = useState('ES');
    const [isSearching, setIsSearching] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Estado para importación instantánea
    const [isInstantScraping, setIsInstantScraping] = useState(false);
    const [instantScrapeProgress, setInstantScrapeProgress] = useState<InstantFullScrapeResult | null>(null);
    const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
    const [maxBusinesses, setMaxBusinesses] = useState(5);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [currentSession, setCurrentSession] = useState<ScrapingSession | null>(null);
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Country Dropdown State
    const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
    const countryDropdownRef = useRef<HTMLDivElement>(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    
    // State for filters
    const [statusFilter, setStatusFilter] = useState<ScrapingQueueItem['status'] | 'all'>('all');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');

    // State for edit modal
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<ScrapingQueueItem | null>(null);
    const [editFormData, setEditFormData] = useState({ category: '', logo_url: '' });
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    // State for results modal
    const [resultModalState, setResultModalState] = useState<{
        isOpen: boolean;
        saved: ScrapingQueueItem[];
        duplicates: ScrapingQueueItem[];
    }>({ isOpen: false, saved: [], duplicates: [] });


    const fetchQueue = useCallback(async () => {
        setLoadingQueue(true);
        try {
            const data = await getScrapingQueue();
            setQueue(data);
        } catch (error: any) {
            showNotification(error.message || t('adminScrapingPage.errorLoadingQueue'), 'error');
        } finally {
            setLoadingQueue(false);
        }
    }, [showNotification, t]);

    useEffect(() => {
        fetchQueue();
    }, [fetchQueue]);

    // Effect to close country dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target as Node)) {
                setIsCountryDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);
    
    // Reset page on filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [statusFilter, categoryFilter]);
    
    const handleSearchSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const urls = searchUrl.split('\n').map((url: string) => url.trim()).filter((url: string) => url.length > 0);
        if (urls.length === 0) {
            showNotification(t('adminScrapingPage.pleaseEnterUrl'), 'error');
            return;
        }
        setIsSearching(true);
        try {
            const result = await startScrapingSearch(urls, country);
            showNotification(t('adminScrapingPage.addedToQueue', { count: result.added_to_queue }), 'success');
            setSearchUrl('');
            fetchQueue(); // Refresh queue
        } catch (error: any) {
            showNotification(error.message || t('adminScrapingPage.errorStartingSearch'), 'error');
        } finally {
            setIsSearching(false);
        }
    };

    // Función para hacer polling de la sesión de scraping
    const pollScrapingSession = useCallback(async (sessionId: string) => {
        try {
            const session = await getScrapingSession(sessionId);
            if (!session) return;

            setCurrentSession(session);
            setInstantScrapeProgress({
                total_businesses_found: session.total_businesses_found,
                total_businesses_created: session.total_businesses_created,
                total_businesses_skipped: session.total_businesses_skipped,
                total_reviews_imported: session.total_reviews_imported,
                businesses: [], // No necesitamos la lista completa durante el polling
                errors: session.errors || []
            });

            // Si la sesión terminó (completada o fallida), detener polling
            if (session.status === 'completed' || session.status === 'failed') {
                if (pollingIntervalRef.current) {
                    clearInterval(pollingIntervalRef.current);
                    pollingIntervalRef.current = null;
                }
                setIsInstantScraping(false);

                if (session.status === 'completed') {
                    showNotification(
                        `✅ Importación completa: ${session.total_businesses_created} empresas creadas, ${session.total_reviews_imported} reseñas importadas`,
                        'success'
                    );
                } else {
                    showNotification(
                        `❌ Error en importación: ${session.errors[0] || 'Error desconocido'}`,
                        'error'
                    );
                }

                setSearchUrl('');
                fetchQueue();
            }
        } catch (error) {
            console.error('Error polling session:', error);
        }
    }, [showNotification]);

    // Limpiar polling al desmontar
    useEffect(() => {
        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
        };
    }, []);

    const handleInstantFullScrape = async () => {
        const urls = searchUrl.split('\n').map((url: string) => url.trim()).filter((url: string) => url.length > 0);
        if (urls.length === 0) {
            showNotification('Por favor ingresa al menos una URL de búsqueda', 'error');
            return;
        }

        const confirmed = window.confirm(
            `¿Deseas importar TODAS las empresas y reseñas de forma inmediata?\n\n` +
            `Esto procesará hasta ${maxBusinesses} empresas con TODAS sus reseñas.\n` +
            `El proceso puede tardar varios minutos dependiendo de la cantidad.\n` +
            `Verás el progreso en tiempo real.\n\n` +
            `¿Continuar?`
        );

        if (!confirmed) return;

        setIsInstantScraping(true);
        setIsProgressModalOpen(true);
        setInstantScrapeProgress({
            total_businesses_found: 0,
            total_businesses_created: 0,
            total_businesses_skipped: 0,
            total_reviews_imported: 0,
            businesses: [],
            errors: []
        });

        try {
            console.log('🚀 Iniciando scraping completo...');
            const result = await instantFullScrape(urls, country, maxBusinesses);

            console.log('✅ Scraping completado:', result);

            // Guardar session_id y comenzar polling
            if (result.session_id) {
                setCurrentSessionId(result.session_id);

                // Iniciar polling cada 2 segundos
                pollingIntervalRef.current = setInterval(() => {
                    pollScrapingSession(result.session_id!);
                }, 2000);

                // Hacer primera consulta inmediatamente
                pollScrapingSession(result.session_id);
            } else {
                // Si no hay session_id, usar el resultado directo (compatibilidad con versión anterior)
                setInstantScrapeProgress(result);
                setIsInstantScraping(false);

                showNotification(
                    `✅ Importación completa: ${result.total_businesses_created} empresas creadas, ${result.total_reviews_imported} reseñas importadas`,
                    'success'
                );

                setSearchUrl('');
                fetchQueue();
            }
        } catch (error: any) {
            console.error('❌ Error en scraping:', error);
            showNotification(error.message || 'Error durante la importación instantánea', 'error');
            setIsProgressModalOpen(false);
            setIsInstantScraping(false);
        }
    };
    
    const handleSaveItems = async (idsToProcess: number[]) => {
        if (idsToProcess.length === 0) {
            showNotification(t('adminScrapingPage.noPendingItemsSelected'), 'info');
            return;
        }
        setIsSaving(true);
        const itemsToSave = queue.filter((item: ScrapingQueueItem) => idsToProcess.includes(item.id) && item.status === 'pending');
        if (itemsToSave.length === 0) {
            showNotification(t('adminScrapingPage.selectedItemsNotValid'), 'info');
            setIsSaving(false);
            return;
        }

        const BATCH_SIZE = 50;
        const totalBatches = Math.ceil(itemsToSave.length / BATCH_SIZE);
        const allSavedItems: ScrapingQueueItem[] = [];
        const allDuplicateItems: ScrapingQueueItem[] = [];
        let errorOccurred = false;

        try {
            for (let i = 0; i < itemsToSave.length; i += BATCH_SIZE) {
                const batch = itemsToSave.slice(i, i + BATCH_SIZE);
                showNotification(t('adminScrapingPage.processingBatch', { current: Math.floor(i / BATCH_SIZE) + 1, total: totalBatches }), 'info');

                // FIX: Cast item to any to bypass 'never' type issue from broken Supabase types.
                const namesToCheck = batch.map((item: any) => (item as any).business_name).filter((name: any): name is string => !!name);
                const urlsToCheck = batch.map((item: any) => (item as any).google_maps_url).filter((url: any): url is string => !!url);
                
                const orConditions: string[] = [];
                if (namesToCheck.length > 0) orConditions.push(`name.in.("${namesToCheck.map((n: string) => n.replace(/"/g, '""')).join('","')}")`);
                if (urlsToCheck.length > 0) orConditions.push(`google_maps_url.in.("${urlsToCheck.join('","')}")`);

                if (orConditions.length === 0) continue; // Skip empty batches

                const { data: existingBusinesses, error: checkError } = await supabase.from('businesses').select('name, google_maps_url').or(orConditions.join(','));
                if (checkError) throw checkError;

                const existingNames = new Set((existingBusinesses as any[])?.map((b: any) => b.name) || []);
                const existingUrls = new Set((existingBusinesses as any[])?.map((b: any) => b.google_maps_url).filter((url: any): url is string => !!url) || []);

                const itemsToInsertInBatch: ScrapingQueueItem[] = [];
                const duplicateItemsInBatch: ScrapingQueueItem[] = [];

                for (const item of batch) {
                    if ((item.business_name && existingNames.has(item.business_name)) || (item.google_maps_url && existingUrls.has(item.google_maps_url))) {
                        duplicateItemsInBatch.push(item);
                    } else {
                        itemsToInsertInBatch.push(item);
                    }
                }
                
                if (itemsToInsertInBatch.length > 0) {
                    const businessesToInsert = itemsToInsertInBatch.map(item => ({ name: item.business_name || 'Nombre Desconocido', google_maps_url: item.google_maps_url, logo_url: item.logo_url, category: item.category, country: item.country }));
                    const { error: insertError } = await supabase.from('businesses').insert(businessesToInsert as any);
                    if (insertError) throw insertError;
                    // @ts-ignore - Supabase type inference issue
                    await supabase.from('scraping_queue').update({ status: 'completed', processed_at: new Date().toISOString() }).in('id', itemsToInsertInBatch.map(item => item.id));
                    allSavedItems.push(...itemsToInsertInBatch);
                }

                if (duplicateItemsInBatch.length > 0) {
                    // @ts-ignore - Supabase type inference issue
                    await supabase.from('scraping_queue').update({ status: 'completed', error_message: 'Duplicate business skipped', processed_at: new Date().toISOString() }).in('id', duplicateItemsInBatch.map(item => item.id));
                    allDuplicateItems.push(...duplicateItemsInBatch);
                }
            }
        } catch (error: any) {
            errorOccurred = true;
            showNotification(error.message || t('adminScrapingPage.errorDuringBatchSave'), 'error');
        } finally {
            setIsSaving(false);
            if (!errorOccurred) {
                setResultModalState({ isOpen: true, saved: allSavedItems, duplicates: allDuplicateItems });
            }
            setSelectedIds(new Set());
            fetchQueue();
        }
    };
    
    const handleSaveSelected = () => handleSaveItems([...selectedIds]);

    const handleSaveAllPending = () => {
        const allPendingIds = queue.filter((item: ScrapingQueueItem) => item.status === 'pending').map((item: ScrapingQueueItem) => item.id);
        handleSaveItems(allPendingIds);
    };

    const handleSelect = (id: number) => {
        setSelectedIds((prev: Set<number>) => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const handleSelectAllOnPage = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            const allVisiblePendingIds = new Set(paginatedQueue.filter((item: ScrapingQueueItem) => item.status === 'pending').map((item: ScrapingQueueItem) => item.id));
            setSelectedIds(allVisiblePendingIds);
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) return;
        
        if (!window.confirm(t('adminScrapingPage.confirmDelete', { count: selectedIds.size }))) {
            return;
        }
        
        setIsDeleting(true);
        const idsToDelete = [...selectedIds];
        const BATCH_SIZE = 50;

        try {
            for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
                const batch = idsToDelete.slice(i, i + BATCH_SIZE);
                await deleteScrapingQueueItems(batch);
            }
            showNotification(t('adminScrapingPage.itemsDeleted', { count: idsToDelete.length }), 'success');
            setSelectedIds(new Set());
            fetchQueue();
        } catch (error: any) {
            showNotification(error.message || t('adminScrapingPage.errorDeletingItems'), 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleOpenEditModal = (item: ScrapingQueueItem) => {
        setEditingItem(item);
        setEditFormData({
            category: item.category || '',
            logo_url: item.logo_url || ''
        });
        setIsEditModalOpen(true);
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingItem) return;

        setIsSavingEdit(true);
        try {
            const updatedItem = await updateScrapingQueueItem(editingItem.id, {
                category: editFormData.category || null,
                logo_url: editFormData.logo_url || null,
            });
            setQueue((prev: ScrapingQueueItem[]) => prev.map((item: ScrapingQueueItem) => item.id === updatedItem.id ? { ...item, ...updatedItem } : item));
            showNotification(t('adminScrapingPage.itemUpdated'), 'success');
            setIsEditModalOpen(false);
        } catch (error: any) {
            showNotification(error.message || t('adminScrapingPage.errorSavingItem'), 'error');
        } finally {
            setIsSavingEdit(false);
        }
    };

    const filteredQueue = useMemo(() => {
        return queue.filter((item: ScrapingQueueItem) => {
            const statusMatch = statusFilter === 'all' || item.status === statusFilter;
            const mainCategoryKey = Object.keys(CATEGORIES).find(key => item.category?.startsWith(t(`categories.${key}`)));
            const categoryMatch = categoryFilter === 'all' || (mainCategoryKey && t(`categories.${mainCategoryKey}`) === categoryFilter);
            return statusMatch && categoryMatch;
        });
    }, [queue, statusFilter, categoryFilter, t]);
    
    const totalPages = Math.ceil(filteredQueue.length / ITEMS_PER_PAGE);
    const paginatedQueue = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredQueue.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredQueue, currentPage]);
    
    const pendingCount = useMemo(() => queue.filter((item: ScrapingQueueItem) => item.status === 'pending').length, [queue]);
    const scheduledCount = useMemo(() => queue.filter((item: ScrapingQueueItem) => item.status === 'approved' && item.scheduled_for && new Date(item.scheduled_for) > new Date()).length, [queue]);
    const selectedPendingCount = useMemo(() => [...selectedIds].filter((id: number) => queue.find((i: ScrapingQueueItem) => i.id === id)?.status === 'pending').length, [selectedIds, queue]);

    const isAllOnPageSelected = useMemo(() => {
        const visiblePending = paginatedQueue.filter((i: ScrapingQueueItem) => i.status === 'pending');
        if (visiblePending.length === 0) return false;
        return visiblePending.every((i: ScrapingQueueItem) => selectedIds.has(i.id));
    }, [selectedIds, paginatedQueue]);
    
    const selectedCountry = useMemo(() => COUNTRIES.find(c => c.code === country) || COUNTRIES[0], [country]);

    const StatusBadge: React.FC<{ status: ScrapingQueueItem['status'] }> = ({ status }) => {
        const styles = {
            pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
            approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
            processing: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300 animate-pulse',
            completed: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
            failed: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
        };
        const icons = {
            pending: 'fa-solid fa-clock',
            approved: 'fa-solid fa-calendar-check',
            processing: 'fa-solid fa-spinner fa-spin',
            completed: 'fa-solid fa-check-circle',
            failed: 'fa-solid fa-triangle-exclamation',
        }
        return (
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full capitalize ${styles[status]}`}>
                <i className={icons[status]}></i>
                {t(`adminScrapingPage.status_${status}`)}
            </span>
        );
    };

    return (
        <>
            <Meta title={t('adminScrapingPage.title') + " - Admin - Opynio"} description={t('adminScrapingPage.title')} />
            <div className="space-y-10">
                <h1 className="text-3xl font-extrabold text-gray-800 dark:text-gray-100">{t('adminScrapingPage.title')}</h1>

                <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl shadow-md border dark:border-zinc-700">
                    <h2 className="text-xl font-bold mb-2 text-gray-800 dark:text-gray-100">{t('adminScrapingPage.addBusinessesToQueue')}</h2>
                    <form onSubmit={handleSearchSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-2">
                                <label htmlFor="searchUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {t('adminScrapingPage.addBusinessesSubtitle')}
                                </label>
                                <textarea
                                    id="searchUrl"
                                    rows={5}
                                    value={searchUrl}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSearchUrl(e.target.value)}
                                    placeholder={t('adminScrapingPage.urlPlaceholder')}
                                    className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green font-mono text-sm bg-transparent dark:text-gray-200"
                                    disabled={isSearching}
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="country-selector" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('registerPage.businessCountry')}</label>
                                <div id="country-selector" className="relative" ref={countryDropdownRef}>
                                    <button
                                        type="button"
                                        onClick={() => setIsCountryDropdownOpen((prev: boolean) => !prev)}
                                        className="w-full flex items-center justify-between p-3 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-left focus:ring-2 focus:ring-brand-green focus:outline-none"
                                        aria-haspopup="listbox"
                                        aria-expanded={isCountryDropdownOpen}
                                    >
                                        <div className="flex items-center gap-3">
                                            <img src={selectedCountry.flag} alt={selectedCountry.name} width={24} height={16} loading="lazy" decoding="async" className="w-6 h-auto rounded-sm object-cover" />
                                            <span className="font-medium text-gray-900 dark:text-gray-200">{selectedCountry.name}</span>
                                        </div>
                                        <i className={`fa-solid fa-chevron-down text-gray-400 transition-transform ${isCountryDropdownOpen ? 'rotate-180' : ''}`}></i>
                                    </button>
                                    {isCountryDropdownOpen && (
                                        <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                            {COUNTRIES.map(c => (
                                                <li
                                                    key={c.code}
                                                    onClick={() => {
                                                        setCountry(c.code);
                                                        setIsCountryDropdownOpen(false);
                                                    }}
                                                    className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-zinc-700 cursor-pointer flex items-center gap-3"
                                                >
                                                    <img src={c.flag} alt={c.name} width={24} height={16} loading="lazy" decoding="async" className="w-6 h-auto rounded-sm object-cover" />
                                                    <span className="text-gray-900 dark:text-gray-200">{c.name}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label htmlFor="max-businesses" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Cantidad de empresas a extraer
                                </label>
                                <select
                                    id="max-businesses"
                                    value={maxBusinesses}
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMaxBusinesses(Number(e.target.value))}
                                    className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-200"
                                    disabled={isSearching || isInstantScraping}
                                >
                                    <option value={5}>5 empresas</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                type="submit"
                                disabled={isSearching || isSaving || isInstantScraping}
                                className="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:bg-gray-400 flex items-center justify-center gap-2"
                            >
                                {isSearching ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <i className="fa-solid fa-search"></i>}
                                <span>{isSearching ? t('common.searching') : 'Agregar a Cola'}</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleInstantFullScrape}
                                disabled={isSearching || isSaving || isInstantScraping}
                                className="bg-brand-green text-white font-bold py-3 px-6 rounded-lg hover:bg-opacity-90 transition-colors shadow-sm disabled:bg-gray-400 flex items-center justify-center gap-2"
                            >
                                {isInstantScraping ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <i className="fa-solid fa-bolt"></i>}
                                <span>{isInstantScraping ? 'Importando...' : 'Importar Todo Ahora'}</span>
                            </button>
                        </div>
                    </form>
                </div>

                <div className="bg-white dark:bg-zinc-800 p-3 sm:p-6 rounded-xl shadow-md border dark:border-zinc-700">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                        <div>
                            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">{t('adminScrapingPage.processingQueue')}</h2>
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{pendingCount} {t('adminScrapingPage.pending')}, {scheduledCount} {t('adminScrapingPage.scheduled')}.</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                             <button onClick={handleSaveSelected} disabled={isSaving || selectedPendingCount === 0} className="bg-green-600 text-white font-bold py-2 px-3 sm:px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm flex-1 md:flex-none justify-center"><i className="fa-solid fa-save"></i><span className="hidden xs:inline">{t('adminScrapingPage.saveSelected')}</span> ({selectedPendingCount})</button>
                             <button onClick={handleSaveAllPending} disabled={isSaving || pendingCount === 0} className="bg-green-800 text-white font-bold py-2 px-3 sm:px-4 rounded-lg hover:bg-green-900 disabled:bg-gray-400 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm flex-1 md:flex-none justify-center"><i className="fa-solid fa-save"></i><span className="hidden xs:inline">{t('adminScrapingPage.saveAllPending')}</span> ({pendingCount})</button>
                            <button onClick={handleDeleteSelected} disabled={isDeleting || selectedIds.size === 0} className="bg-red-600 text-white font-bold py-2 px-3 sm:px-4 rounded-lg hover:bg-red-700 disabled:bg-gray-400 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm flex-1 md:flex-none justify-center"><i className="fa-solid fa-trash-can"></i><span className="hidden xs:inline">{t('common.delete')}</span> ({selectedIds.size})</button>
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-gray-50 dark:bg-zinc-900/50 rounded-lg border dark:border-zinc-700">
                        <div>
                            <label htmlFor="status-filter" className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">{t('adminScrapingPage.filterByStatus')}:</label>
                            <select id="status-filter" value={statusFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value as any)} className="p-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green bg-white dark:bg-zinc-800 text-sm">
                                <option value="all">{t('common.all')}</option>
                                <option value="pending">{t('adminScrapingPage.status_pending')}</option>
                                <option value="completed">{t('adminScrapingPage.status_completed')}</option>
                                <option value="failed">{t('adminScrapingPage.status_failed')}</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="category-filter" className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">{t('adminScrapingPage.filterByCategory')}:</label>
                            <select id="category-filter" value={categoryFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCategoryFilter(e.target.value)} className="p-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green bg-white dark:bg-zinc-800 text-sm">
                                <option value="all">{t('common.allCategories')}</option>
                                {Object.keys(CATEGORIES).map(mainCat => (<option key={mainCat} value={t(`categories.${mainCat}`)}>{t(`categories.${mainCat}`)}</option>))}
                            </select>
                        </div>
                    </div>

                    {/* Desktop table view */}
                    <div className="hidden lg:block overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-600 dark:text-gray-400">
                            <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-zinc-700">
                                <tr>
                                    <th scope="col" className="p-4"><input type="checkbox" checked={isAllOnPageSelected} onChange={handleSelectAllOnPage} disabled={loadingQueue || paginatedQueue.filter((i: ScrapingQueueItem) => i.status === 'pending').length === 0} className="w-4 h-4 text-brand-green bg-gray-100 border-gray-300 rounded focus:ring-brand-green" aria-label={t('adminScrapingPage.selectAllOnPage')}/></th>
                                    <th scope="col" className="px-6 py-3">{t('adminScrapingPage.businessName')}</th>
                                    <th scope="col" className="px-6 py-3">{t('adminScrapingPage.country')}</th>
                                    <th scope="col" className="px-6 py-3">{t('adminScrapingPage.googleMapsUrl')}</th>
                                    <th scope="col" className="px-6 py-3">{t('adminScrapingPage.category')}</th>
                                    <th scope="col" className="px-6 py-3">{t('adminScrapingPage.logo')}</th>
                                    <th scope="col" className="px-6 py-3">{t('adminScrapingPage.status')}</th>
                                    <th scope="col" className="px-6 py-3">{t('adminScrapingPage.addedOn')}</th>
                                    <th scope="col" className="px-6 py-3 text-right">{t('common.actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingQueue ? (
                                    <tr><td colSpan={9} className="text-center py-10"><Spinner /></td></tr>
                                ) : paginatedQueue.length === 0 ? (
                                    <tr><td colSpan={9} className="text-center py-10 text-gray-500 dark:text-gray-400">{t('adminScrapingPage.noItemsMatchingFilters')}</td></tr>
                                ) : (
                                    paginatedQueue.map((item: ScrapingQueueItem) => (
                                        <tr key={item.id} className={`border-b dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700/50 ${selectedIds.has(item.id) ? 'bg-green-50 dark:bg-green-900/20' : 'bg-white dark:bg-zinc-800'}`}>
                                            <td className="p-4">
                                                <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => handleSelect(item.id)} className="w-4 h-4 text-brand-green bg-gray-100 border-gray-300 rounded focus:ring-brand-green"/>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100 max-w-xs truncate" title={item.business_name || ''}>{item.business_name}</td>
                                            <td className="px-4 py-4">
                                                {(() => {
                                                    if (!item.country) return <span className="text-gray-400 dark:text-zinc-500 text-xs">-</span>;
                                                    const countryInfo = COUNTRIES.find(c => c.code === item.country);
                                                    if (countryInfo) {
                                                        return (
                                                            <div className="flex items-center gap-2" title={countryInfo.name}>
                                                                <img src={countryInfo.flag} alt={countryInfo.name} width={20} height={12} loading="lazy" decoding="async" className="w-5 h-3 object-contain" />
                                                                <span className="font-medium text-xs text-gray-700 dark:text-gray-300">{countryInfo.code}</span>
                                                            </div>
                                                        );
                                                    }
                                                    return <span className="text-gray-400 dark:text-zinc-500 text-xs">{item.country}</span>;
                                                })()}
                                            </td>
                                            <td className="px-6 py-4">
                                                {item.google_maps_url ? (
                                                    <a href={item.google_maps_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline text-xs" title={item.google_maps_url}>
                                                        {t('adminScrapingPage.viewOnMaps')} <i className="fa-solid fa-external-link-alt ml-1"></i>
                                                    </a>
                                                ) : (
                                                    <span className="text-gray-400 dark:text-zinc-500 text-xs">N/A</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-xs">{item.category || <span className="text-gray-400 dark:text-zinc-500">N/A</span>}</td>
                                            <td className="px-6 py-4">{item.logo_url ? <img src={item.logo_url} alt={item.business_name || 'logo'} width={40} height={40} loading="lazy" decoding="async" className="w-10 h-10 object-contain rounded-md border dark:border-zinc-700" /> : <span className="text-gray-400 dark:text-zinc-500 text-xs">N/A</span>}</td>
                                            <td className="px-6 py-4"><StatusBadge status={item.status} /></td>
                                            <td className="px-6 py-4">{new Date(item.created_at).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-right"><button onClick={() => handleOpenEditModal(item)} className="font-medium text-brand-green hover:underline">{t('common.edit')}</button></td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile card view */}
                    <div className="lg:hidden space-y-3">
                        {loadingQueue ? (
                            <div className="text-center py-10"><Spinner /></div>
                        ) : paginatedQueue.length === 0 ? (
                            <div className="text-center py-10 text-gray-500 dark:text-gray-400">{t('adminScrapingPage.noItemsMatchingFilters')}</div>
                        ) : (
                            paginatedQueue.map((item: ScrapingQueueItem) => (
                                <div key={item.id} className={`p-3 rounded-lg border ${selectedIds.has(item.id) ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' : 'bg-gray-50 dark:bg-zinc-700/50 border-gray-200 dark:border-zinc-600'}`}>
                                    <div className="flex items-start gap-3">
                                        <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => handleSelect(item.id)} className="w-4 h-4 mt-1 text-brand-green bg-gray-100 border-gray-300 rounded focus:ring-brand-green"/>
                                        <div className="flex-grow min-w-0">
                                            <div className="flex items-center justify-between gap-2 mb-2">
                                                <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{item.business_name}</h3>
                                                <StatusBadge status={item.status} />
                                            </div>
                                            <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                                                {item.category && <p><span className="font-medium">{t('adminScrapingPage.category')}:</span> {item.category}</p>}
                                                <p><span className="font-medium">{t('adminScrapingPage.addedOn')}:</span> {new Date(item.created_at).toLocaleDateString()}</p>
                                                {item.google_maps_url && (
                                                    <a href={item.google_maps_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1">
                                                        {t('adminScrapingPage.viewOnMaps')} <i className="fa-solid fa-external-link-alt"></i>
                                                    </a>
                                                )}
                                            </div>
                                            <button onClick={() => handleOpenEditModal(item)} className="mt-2 w-full py-1.5 text-sm font-medium text-brand-green border border-brand-green rounded-lg hover:bg-brand-green hover:text-white transition-colors">
                                                {t('common.edit')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                     {totalPages > 1 && (
                        <nav className="flex justify-between items-center pt-4 border-t dark:border-zinc-700 mt-4">
                            <button onClick={() => setCurrentPage((p: number) => Math.max(1, p - 1))} disabled={currentPage === 1 || loadingQueue} className="px-3 py-1 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-600 disabled:opacity-50">{t('common.previous')}</button>
                            <span>{t('common.page', { current: currentPage, total: totalPages })}</span>
                            <button onClick={() => setCurrentPage((p: number) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || loadingQueue} className="px-3 py-1 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-600 disabled:opacity-50">{t('common.next')}</button>
                        </nav>
                    )}
                </div>
            </div>
            {isEditModalOpen && editingItem && (
                <Modal title={`${t('common.edit')}: ${editingItem.business_name}`} onClose={() => setIsEditModalOpen(false)}>
                    <form onSubmit={handleEditSubmit} className="space-y-4 pt-4">
                        <div>
                            <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('adminScrapingPage.category')}</label>
                            <select id="category" value={editFormData.category} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditFormData((prev: any) => ({ ...prev, category: e.target.value }))} className="w-full p-2 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 rounded-lg focus:ring-2 focus:ring-brand-green">
                                <option value="">{t('adminScrapingPage.noCategory')}</option>
                                {Object.entries(CATEGORIES).map(([mainCategory, subCategories]) => (
                                    <optgroup key={mainCategory} label={t(`categories.${mainCategory}`)}>
                                        {subCategories.map(subCategory => {
                                            const fullCategory = `${t(`categories.${mainCategory}`)}: ${t(`subcategories.${subCategory}`)}`;
                                            return <option key={fullCategory} value={fullCategory}>{t(`subcategories.${subCategory}`)}</option>;
                                        })}
                                    </optgroup>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="logo_url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('adminScrapingPage.logoUrl')}</label>
                            <input id="logo_url" type="url" value={editFormData.logo_url} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditFormData((prev: any) => ({ ...prev, logo_url: e.target.value }))} placeholder={t('common.placeholders.logoUrl')} className="w-full p-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-transparent" />
                        </div>
                        <div className="flex justify-end gap-3 pt-4 border-t dark:border-zinc-700">
                            <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-zinc-700 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600">{t('common.cancel')}</button>
                            <button type="submit" disabled={isSavingEdit} className="px-4 py-2 text-sm font-semibold text-white bg-brand-green rounded-lg hover:bg-opacity-90 disabled:bg-gray-400">{isSavingEdit ? t('common.saving') : t('common.save')}</button>
                        </div>
                    </form>
                </Modal>
            )}
            {resultModalState.isOpen && (
                <Modal title={t('adminScrapingPage.saveResult')} onClose={() => setResultModalState({ isOpen: false, saved: [], duplicates: [] })}>
                    <div className="py-4 space-y-4">
                        {resultModalState.saved.length > 0 && (
                            <div>
                                <h3 className="font-semibold text-green-700 dark:text-green-300 flex items-center gap-2">
                                    <i className="fa-solid fa-check-circle"></i>
                                    {t('adminScrapingPage.businessesSavedSuccess', { count: resultModalState.saved.length })}
                                </h3>
                                <ul className="text-sm list-disc list-inside mt-2 max-h-40 overflow-y-auto bg-gray-50 dark:bg-zinc-900/50 p-3 rounded-lg border dark:border-zinc-700">
                                    {resultModalState.saved.map((item: ScrapingQueueItem) => <li key={item.id} className="truncate">{item.business_name}</li>)}
                                </ul>
                            </div>
                        )}
                        {resultModalState.duplicates.length > 0 && (
                            <div>
                                <h3 className="font-semibold text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
                                    <i className="fa-solid fa-triangle-exclamation"></i>
                                    {t('adminScrapingPage.businessesSkippedDuplicate', { count: resultModalState.duplicates.length })}
                                </h3>
                                <ul className="text-sm list-disc list-inside mt-2 max-h-40 overflow-y-auto bg-gray-50 dark:bg-zinc-900/50 p-3 rounded-lg border dark:border-zinc-700">
                                    {resultModalState.duplicates.map((item: ScrapingQueueItem) => <li key={item.id} className="truncate">{item.business_name}</li>)}
                                </ul>
                            </div>
                        )}
                         {resultModalState.saved.length === 0 && resultModalState.duplicates.length === 0 && (
                            <p className="text-center text-gray-600 dark:text-gray-400">{t('adminScrapingPage.noChangesMade')}</p>
                         )}
                         <div className="flex justify-end pt-4 border-t dark:border-zinc-700">
                            <button
                                type="button"
                                onClick={() => setResultModalState({ isOpen: false, saved: [], duplicates: [] })}
                                className="px-4 py-2 text-sm font-semibold text-white bg-brand-green rounded-lg hover:bg-opacity-90"
                            >
                                {t('common.close')}
                            </button>
                         </div>
                    </div>
                </Modal>
            )}
            {isProgressModalOpen && (
                <Modal
                    title="Importación Instantánea en Progreso"
                    onClose={() => !isInstantScraping && setIsProgressModalOpen(false)}
                >
                    <div className="py-4 space-y-4">
                        {isInstantScraping ? (
                            <div className="space-y-4">
                                <div className="text-center">
                                    <div className="w-16 h-16 border-4 border-brand-green border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                    <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">Procesando empresas...</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                                        Extrayendo empresas y reseñas de Google Maps.<br/>
                                        Este proceso puede tardar varios minutos.
                                    </p>
                                </div>

                                {/* Mostrar empresa actual */}
                                {currentSession && currentSession.current_business_name && (
                                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                                        <p className="text-sm text-purple-800 dark:text-purple-300 flex items-center gap-2">
                                            <i className="fa-solid fa-gear fa-spin"></i>
                                            <span><strong>Procesando ahora:</strong> {currentSession.current_business_name}</span>
                                        </p>
                                        <p className="text-xs text-purple-600 dark:text-purple-400 mt-1 ml-6">
                                            Empresa {currentSession.current_business_index} de {currentSession.total_businesses_found}
                                        </p>

                                        {/* Mostrar progreso de reseñas EN TIEMPO REAL */}
                                        {currentSession.current_review_page > 0 && (
                                            <div className="mt-2 ml-6 pt-2 border-t border-purple-200 dark:border-purple-700">
                                                <p className="text-xs text-purple-700 dark:text-purple-300 flex items-center gap-2">
                                                    <i className="fa-solid fa-star fa-beat text-yellow-500"></i>
                                                    <span><strong>Extrayendo reseñas:</strong> Página {currentSession.current_review_page} • {currentSession.current_reviews_scraped} reseñas acumuladas</span>
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Mostrar progreso actual si hay datos */}
                                {instantScrapeProgress && (instantScrapeProgress.total_businesses_created > 0 || instantScrapeProgress.total_businesses_found > 0) && (
                                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                                        <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2">
                                            <i className="fa-solid fa-chart-line"></i>
                                            Progreso Actual
                                        </h3>
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            {instantScrapeProgress.total_businesses_found > 0 && (
                                                <div>
                                                    <p className="text-gray-600 dark:text-gray-400">Empresas encontradas:</p>
                                                    <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{instantScrapeProgress.total_businesses_found}</p>
                                                </div>
                                            )}
                                            {instantScrapeProgress.total_businesses_created > 0 && (
                                                <div>
                                                    <p className="text-gray-600 dark:text-gray-400">Empresas procesadas:</p>
                                                    <p className="text-xl font-bold text-green-600 dark:text-green-400">{instantScrapeProgress.total_businesses_created}</p>
                                                </div>
                                            )}
                                            {instantScrapeProgress.total_reviews_imported > 0 && (
                                                <div>
                                                    <p className="text-gray-600 dark:text-gray-400">Reseñas importadas:</p>
                                                    <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{instantScrapeProgress.total_reviews_imported}</p>
                                                </div>
                                            )}
                                            {instantScrapeProgress.total_businesses_skipped > 0 && (
                                                <div>
                                                    <p className="text-gray-600 dark:text-gray-400">Duplicadas omitidas:</p>
                                                    <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{instantScrapeProgress.total_businesses_skipped}</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Mostrar últimas empresas procesadas */}
                                        {instantScrapeProgress.businesses && instantScrapeProgress.businesses.length > 0 && (
                                            <div className="mt-4 pt-4 border-t dark:border-blue-700">
                                                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">Últimas empresas procesadas:</p>
                                                <div className="space-y-1 max-h-32 overflow-y-auto">
                                                    {instantScrapeProgress.businesses.slice(-5).reverse().map((biz: any, idx: number) => (
                                                        <div key={idx} className="flex items-center gap-2 text-xs">
                                                            <i className="fa-solid fa-check-circle text-green-500"></i>
                                                            <span className="font-medium text-gray-900 dark:text-gray-100">{biz.name}</span>
                                                            <span className="text-gray-500 dark:text-gray-400">({biz.reviews_count} reseñas)</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-lg p-4 text-sm">
                                    <p className="flex items-start gap-3 text-red-800 dark:text-red-300 font-semibold mb-2">
                                        <i className="fa-solid fa-triangle-exclamation text-xl mt-0.5"></i>
                                        <span>⚠️ ADVERTENCIA IMPORTANTE</span>
                                    </p>
                                    <ul className="list-disc list-inside space-y-1 text-red-700 dark:text-red-400 ml-7">
                                        <li><strong>NO cierres esta pestaña del navegador</strong> - el proceso se detendrá y perderás el progreso</li>
                                        <li><strong>NO recargues la página</strong> - perderás todos los datos ya procesados</li>
                                        <li>El proceso puede tardar <strong>varios minutos</strong> dependiendo de la cantidad de empresas</li>
                                        <li>Cada empresa requiere múltiples llamadas a APIs externas (SerpAPI, Gemini)</li>
                                        <li>Los datos se guardan <strong>inmediatamente</strong> después de procesar cada empresa</li>
                                    </ul>
                                    <p className="mt-3 text-xs text-red-600 dark:text-red-500 italic">
                                        💰 Nota: Este proceso consume créditos de APIs externas (SerpAPI, Gemini). Asegúrate de tener suficientes créditos disponibles.
                                    </p>
                                </div>
                            </div>
                        ) : instantScrapeProgress ? (
                            <div className="space-y-4">
                                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                                    <h3 className="font-bold text-green-800 dark:text-green-300 text-lg mb-2">
                                        <i className="fa-solid fa-circle-check mr-2"></i>
                                        Importación Completada
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <p className="text-gray-600 dark:text-gray-400">Empresas encontradas:</p>
                                            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{instantScrapeProgress.total_businesses_found}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-600 dark:text-gray-400">Empresas creadas:</p>
                                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{instantScrapeProgress.total_businesses_created}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-600 dark:text-gray-400">Empresas omitidas (duplicadas):</p>
                                            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{instantScrapeProgress.total_businesses_skipped}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-600 dark:text-gray-400">Reseñas importadas:</p>
                                            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{instantScrapeProgress.total_reviews_imported}</p>
                                        </div>
                                    </div>
                                </div>

                                {instantScrapeProgress.businesses && instantScrapeProgress.businesses.length > 0 && (
                                    <div>
                                        <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
                                            Empresas Importadas ({instantScrapeProgress.businesses.length}):
                                        </h4>
                                        <div className="max-h-60 overflow-y-auto bg-gray-50 dark:bg-zinc-900/50 p-3 rounded-lg border dark:border-zinc-700">
                                            <ul className="space-y-2 text-sm">
                                                {instantScrapeProgress.businesses.map((biz: any, idx: number) => (
                                                    <li key={idx} className="flex items-start gap-2">
                                                        <i className="fa-solid fa-building text-brand-green mt-0.5"></i>
                                                        <div className="flex-1">
                                                            <p className="font-medium text-gray-900 dark:text-gray-100">{biz.name}</p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                {biz.reviews_count} reseñas · {biz.category}
                                                            </p>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                )}

                                {instantScrapeProgress.errors.length > 0 && (
                                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                                        <h4 className="font-semibold text-red-800 dark:text-red-300 mb-2">
                                            <i className="fa-solid fa-triangle-exclamation mr-2"></i>
                                            Errores ({instantScrapeProgress.errors.length}):
                                        </h4>
                                        <ul className="text-xs text-red-700 dark:text-red-400 list-disc list-inside max-h-40 overflow-y-auto">
                                            {instantScrapeProgress.errors.map((err: string, idx: number) => (
                                                <li key={idx}>{err}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <div className="flex justify-end pt-4 border-t dark:border-zinc-700">
                                    <button
                                        type="button"
                                        onClick={() => setIsProgressModalOpen(false)}
                                        className="px-4 py-2 text-sm font-semibold text-white bg-brand-green rounded-lg hover:bg-opacity-90"
                                    >
                                        Cerrar
                                    </button>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </Modal>
            )}
        </>
    );
};

export default AdminScrapingPage;