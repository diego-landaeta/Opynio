
import React, { useState, useEffect, useCallback } from 'react';
import { adminGetFeaturedCompanies, adminSetFeaturedCompanies, getBusinessIdAndNameList } from '../../../services/supabaseService';
import type { SimpleBusiness } from '../../../types';
import { useNotification } from '../../../contexts/NotificationContext';
import Spinner from '../../Spinner';
import Meta from '../../Meta';
import Modal from '../../Modal';
import { useTranslation } from '../../../contexts/i18nContext';
import StarRating from '../../StarRating';

const AdminFeaturedBusinessesPage: React.FC = () => {
    const { showNotification } = useNotification();
    const t = useTranslation();
    const [featuredBusinesses, setFeaturedBusinesses] = useState<SimpleBusiness[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<{ id: string; name: string }[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const fetchFeatured = useCallback(async () => {
        setLoading(true);
        try {
            const data = await adminGetFeaturedCompanies();
            setFeaturedBusinesses(data);
        } catch (error: any) {
            showNotification(error.message || 'Error al cargar empresas destacadas.', 'error');
        } finally {
            setLoading(false);
        }
    }, [showNotification]);

    useEffect(() => {
        fetchFeatured();
    }, [fetchFeatured]);

    // Debounced search for adding new businesses
    useEffect(() => {
        if (!isSearchModalOpen) return;
        const handler = setTimeout(async () => {
            setIsSearching(true);
            try {
                const results = await getBusinessIdAndNameList(searchTerm);
                // Filter out already featured businesses
                const currentIds = new Set(featuredBusinesses.map(b => b.id));
                setSearchResults(results.filter(r => !currentIds.has(r.id)));
            } catch (error) {
                console.error("Error searching businesses:", error);
            } finally {
                setIsSearching(false);
            }
        }, 300);
        return () => clearTimeout(handler);
    }, [searchTerm, isSearchModalOpen, featuredBusinesses]);

    const handleRemoveFeatured = async (businessId: string) => {
        if (!window.confirm(t('adminFeatured.confirmRemove'))) return;
        const newList = featuredBusinesses.filter(b => b.id !== businessId);
        setFeaturedBusinesses(newList);
        await saveChanges(newList);
    };

    const handleAddFeatured = async (business: { id: string; name: string }) => {
        if (featuredBusinesses.length >= 10) {
            showNotification(t('adminFeatured.maxReached', { max: 10 }), 'error');
            return;
        }
        // Optimistically add with minimal data, real data will load on refresh or we could fetch it
        // For now, standard ID/name is enough to add to the list visually before save.
        // A full fetch might be better to show consistent data immediately.
        const newList = [...featuredBusinesses, { id: business.id, name: business.name } as SimpleBusiness];
        setFeaturedBusinesses(newList);
        await saveChanges(newList);
        setIsSearchModalOpen(false);
        setSearchTerm('');
    };

    const saveChanges = async (list: SimpleBusiness[]) => {
        setIsSaving(true);
        try {
            await adminSetFeaturedCompanies(list.map(b => b.id));
            showNotification('Lista de destacados actualizada.', 'success');
            await fetchFeatured(); // Wait for refresh to get full data
        } catch (error: any) {
            console.error('Error saving featured:', error);
            showNotification(t('adminFeatured.errorSaving') + ': ' + (error.message || 'Error desconocido'), 'error');
            await fetchFeatured(); // Refresh to restore actual state from DB
        } finally {
            setIsSaving(false);
        }
    };
    
    // Simple drag and drop reordering
    const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
        e.dataTransfer.setData('text/plain', index.toString());
    };

    const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>) => {
        e.preventDefault();
    };

    const handleDrop = async (e: React.DragEvent<HTMLTableRowElement>, targetIndex: number) => {
        e.preventDefault();
        const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (sourceIndex === targetIndex) return;

        const newList = [...featuredBusinesses];
        const [removed] = newList.splice(sourceIndex, 1);
        newList.splice(targetIndex, 0, removed);

        setFeaturedBusinesses(newList);
        await saveChanges(newList);
    };

    return (
        <>
            <Meta title={`${t('adminFeatured.title')} - Admin`} description={t('adminFeatured.subtitle')} />
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-extrabold text-gray-800 dark:text-gray-100">{t('adminFeatured.title')}</h1>
                    <button
                        onClick={() => setIsSearchModalOpen(true)}
                        className="bg-brand-green text-white font-bold py-2.5 px-5 rounded-lg hover:bg-opacity-90 transition-colors shadow-sm flex items-center gap-2"
                        disabled={featuredBusinesses.length >= 10 || isSaving}
                    >
                        <i className="fa-solid fa-plus-circle"></i>
                        <span>{t('adminFeatured.addFeatured')}</span>
                    </button>
                </div>

                <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl shadow-md border dark:border-zinc-700">
                    <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">{t('adminFeatured.currentFeatured')}</h2>
                    
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
                                        <th scope="col" className="px-6 py-3">{t('adminFeatured.rating')}</th>
                                        <th scope="col" className="px-6 py-3">{t('adminFeatured.reviews')}</th>
                                        <th scope="col" className="px-6 py-3 text-right">{t('adminFeatured.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {featuredBusinesses.map((business, index) => (
                                        <tr 
                                            key={business.id} 
                                            className="bg-white dark:bg-zinc-800 border-b dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700/50 cursor-move"
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, index)}
                                            onDragOver={handleDragOver}
                                            onDrop={(e) => handleDrop(e, index)}
                                        >
                                            <td className="px-6 py-4 text-center font-bold text-gray-400">
                                                <i className="fa-solid fa-grip-vertical mr-2"></i>
                                                {index + 1}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100 flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-md bg-gray-100 dark:bg-zinc-700 flex-shrink-0 overflow-hidden border dark:border-zinc-600 flex items-center justify-center">
                                                    {business.logo_url ? (
                                                        <img src={business.logo_url} alt={business.name} width={40} height={40} loading="lazy" decoding="async" className="w-full h-full object-contain p-0.5" />
                                                    ) : (
                                                        <i className="fa-solid fa-store text-gray-400"></i>
                                                    )}
                                                </div>
                                                <span className="truncate max-w-xs" title={business.name}>{business.name}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <StarRating rating={business.avg_rating || 0} size="small" />
                                                    <span>{(business.avg_rating || 0).toFixed(1)}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">{business.review_count || 0}</td>
                                            <td className="px-6 py-4 text-right">
                                                <button 
                                                    onClick={() => handleRemoveFeatured(business.id)} 
                                                    className="text-red-500 hover:text-red-700 font-medium flex items-center gap-1 ml-auto disabled:opacity-50"
                                                    disabled={isSaving}
                                                >
                                                    <i className="fa-solid fa-trash-can"></i>
                                                    <span>{t('adminFeatured.remove')}</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <p className="text-xs text-gray-500 mt-2 text-center italic">
                                <i className="fa-solid fa-info-circle mr-1"></i>
                                {t('adminFeatured.dragToReorder')}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {isSearchModalOpen && (
                <Modal title={t('adminFeatured.addFeatured')} onClose={() => setIsSearchModalOpen(false)}>
                    <div className="py-4 space-y-4">
                        <div className="relative">
                            <input
                                type="search"
                                placeholder={t('adminFeatured.searchPlaceholder')}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg bg-transparent focus:ring-2 focus:ring-brand-green"
                                autoFocus
                            />
                            {isSearching && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <Spinner />
                                </div>
                            )}
                        </div>
                        <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-zinc-700 rounded-lg">
                            {searchResults.length === 0 && searchTerm.length > 2 && !isSearching ? (
                                <p className="text-center p-4 text-gray-500">No se encontraron empresas.</p>
                            ) : (
                                <ul className="divide-y divide-gray-100 dark:divide-zinc-700">
                                    {searchResults.map(biz => (
                                        <li 
                                            key={biz.id} 
                                            className="p-3 hover:bg-gray-50 dark:hover:bg-zinc-700/50 cursor-pointer flex justify-between items-center"
                                            onClick={() => handleAddFeatured(biz)}
                                        >
                                            <span className="font-medium text-gray-800 dark:text-gray-200">{biz.name}</span>
                                            <i className="fa-solid fa-plus text-brand-green"></i>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </Modal>
            )}
        </>
    );
};

export default AdminFeaturedBusinessesPage;
