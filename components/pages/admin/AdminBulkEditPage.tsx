import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getAdminBusinessesPaginated, adminBulkUpdateBusinesses } from '../../../services/supabaseService';
import { useNotification } from '../../../contexts/NotificationContext';
import type { Business, BusinessHours, Database } from '../../../types';
import { CATEGORIES, COUNTRIES } from '../../../constants';
import Meta from '../../Meta';
import Spinner from '../../Spinner';
import L from 'leaflet';
import Modal from '../../Modal';
import { useTranslation } from '../../../contexts/i18nContext';

const PAGE_SIZE = 15;

const LocationEditorModal: React.FC<{
    business: Business;
    onClose: () => void;
    onSave: (businessId: string, newLocation: { lat: number; lng: number } | null) => void;
}> = ({ business, onClose, onSave }) => {
    const { showNotification } = useNotification();
    const t = useTranslation();
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [addressSearch, setAddressSearch] = useState('');
    const [isSearchingAddress, setIsSearchingAddress] = useState(false);

    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<L.Map | null>(null);
    const markerRef = useRef<L.Marker | null>(null);

    useEffect(() => {
        if (business.latitude && business.longitude) {
            setLocation({ lat: business.latitude, lng: business.longitude });
        } else {
            setLocation(null);
        }
    }, [business]);

    useEffect(() => {
        if (mapContainerRef.current && !mapRef.current) {
            mapRef.current = L.map(mapContainerRef.current).setView([40.416775, -3.703790], 5);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapRef.current);
            setTimeout(() => mapRef.current?.invalidateSize(), 100);
        }
        const map = mapRef.current;
        if (!map) return;

        if (location) {
            if (!markerRef.current) {
                markerRef.current = L.marker([location.lat, location.lng], { draggable: true }).addTo(map);
                markerRef.current.on('dragend', () => {
                    const newPos = markerRef.current!.getLatLng();
                    setLocation({ lat: newPos.lat, lng: newPos.lng });
                });
            } else {
                markerRef.current.setLatLng([location.lat, location.lng]);
            }
            map.setView([location.lat, location.lng], 15);
        } else if (markerRef.current) {
            markerRef.current.remove();
            markerRef.current = null;
        }
    }, [location]);

    const handleAddressSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!addressSearch.trim()) return;
        setIsSearchingAddress(true);
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressSearch)}`);
            const data = await response.json();
            if (data && data.length > 0) {
                setLocation({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
            } else {
                showNotification(t('adminBulkEdit.addressNotFound'), 'error');
            }
        } catch (error) {
            showNotification(t('adminBulkEdit.addressSearchError'), 'error');
        } finally {
            setIsSearchingAddress(false);
        }
    };

    const handleSaveClick = () => {
        onSave(business.id, location);
    };

    return (
        <Modal title={`${t('adminBulkEdit.locationOf')} ${business.name}`} onClose={onClose}>
            <div className="py-4 space-y-4">
                <p className="text-sm text-gray-500 dark:text-gray-400 -mt-2">{t('adminBulkEdit.locationModalSubtitle')}</p>
                <form onSubmit={handleAddressSearch} className="flex items-center gap-2">
                    <input
                        type="text"
                        value={addressSearch}
                        onChange={(e) => setAddressSearch(e.target.value)}
                        placeholder={t('adminBulkEdit.searchAddress')}
                        className="flex-grow p-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-transparent"
                    />
                    <button type="submit" disabled={isSearchingAddress} className="bg-brand-dark text-white font-semibold px-4 py-2 rounded-lg w-14 h-11 flex items-center justify-center">
                        {isSearchingAddress ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <i className="fa-solid fa-search"></i>}
                    </button>
                </form>
                <div ref={mapContainerRef} className="w-full h-64 bg-gray-200 dark:bg-zinc-700 rounded-lg z-0"></div>
                <div className="flex justify-end gap-3 pt-4 border-t dark:border-zinc-700">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-zinc-700 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600">
                        {t('common.cancel')}
                    </button>
                    <button onClick={handleSaveClick} className="px-4 py-2 text-sm font-semibold text-white bg-brand-green rounded-lg hover:bg-opacity-90">
                        {t('adminBulkEdit.saveLocation')}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

const orderedDays: (keyof BusinessHours)[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

const DaySchedule: React.FC<{ day: keyof BusinessHours; value: { open: string; close: string } | 'cerrado'; onChange: (day: keyof BusinessHours, value: { open: string; close: string } | 'cerrado') => void; }> = ({ day, value, onChange }) => {
    const isClosed = value === 'cerrado';
    const t = useTranslation();

    const handleOpenToggle = () => {
        onChange(day, isClosed ? { open: '09:00', close: '17:00' } : 'cerrado');
    };

    const handleTimeChange = (part: 'open' | 'close', time: string) => {
        if (typeof value === 'object') {
            onChange(day, { ...value, [part]: time });
        }
    };
    
    return (
        <div className="grid grid-cols-[1fr,2fr] items-center gap-4 py-3">
            <label className="font-medium text-gray-700 dark:text-gray-300 capitalize flex items-center gap-3 cursor-pointer select-none">
                 <input 
                    type="checkbox"
                    checked={!isClosed}
                    onChange={handleOpenToggle}
                    className="h-4 w-4 rounded border-gray-300 dark:border-zinc-500 text-brand-green focus:ring-2 focus:ring-offset-2 focus:ring-brand-green"
                />
                <span>{t(`businessPage.day_${day}`)}</span>
            </label>
            
            <div className={`grid grid-cols-2 items-center gap-2 transition-opacity ${isClosed ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                <div className="relative">
                    <input 
                        type="time"
                        value={isClosed ? '' : value.open}
                        onChange={(e) => handleTimeChange('open', e.target.value)}
                        disabled={isClosed}
                        className="w-full p-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-200 text-sm"
                        aria-label={`Hora de apertura para ${day}`}
                    />
                     <i className="fa-regular fa-clock absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
                </div>
                 <div className="relative">
                    <input 
                        type="time"
                        value={isClosed ? '' : value.close}
                        onChange={(e) => handleTimeChange('close', e.target.value)}
                        disabled={isClosed}
                        className="w-full p-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-200 text-sm"
                        aria-label={`Hora de cierre para ${day}`}
                    />
                    <i className="fa-regular fa-clock absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
                </div>
            </div>
        </div>
    )
};

const ScheduleEditorModal: React.FC<{
    business: Business;
    onClose: () => void;
    onSave: (businessId: string, newSchedule: BusinessHours) => void;
}> = ({ business, onClose, onSave }) => {
    const t = useTranslation();
    const [horarios, setHorarios] = useState<BusinessHours>(business.horarios || {});

    const handleHorariosChange = useCallback((day: keyof BusinessHours, value: { open: string; close: string } | 'cerrado') => {
        setHorarios(prev => ({ ...prev, [day]: value }));
    }, []);

    const handleSaveClick = () => {
        onSave(business.id, horarios);
    };
    
    return (
        <Modal title={`${t('adminBulkEdit.scheduleFor')} ${business.name}`} onClose={onClose}>
            <div className="py-4 space-y-4">
                 <div className="p-4 border dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 shadow-sm max-h-[60vh] overflow-y-auto">
                    <div className="grid grid-cols-[1fr,2fr] items-center gap-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase px-1 pb-2 border-b dark:border-zinc-700 mb-2">
                        <span>{t('adminBulkEdit.day')}</span>
                        <div className="grid grid-cols-2 gap-2">
                            <span className="text-center">{t('adminBulkEdit.opens')}</span>
                            <span className="text-center">{t('adminBulkEdit.closes')}</span>
                        </div>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-zinc-700">
                        {orderedDays.map(day => (
                            <DaySchedule key={day} day={day} value={horarios[day] || 'cerrado'} onChange={handleHorariosChange} />
                        ))}
                    </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t dark:border-zinc-700">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-zinc-700 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600">
                        {t('common.cancel')}
                    </button>
                    <button onClick={handleSaveClick} className="px-4 py-2 text-sm font-semibold text-white bg-brand-green rounded-lg hover:bg-opacity-90">
                        {t('adminBulkEdit.saveSchedule')}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

const AdminBulkEditPage: React.FC = () => {
    const { showNotification } = useNotification();
    const t = useTranslation();
    const [businesses, setBusinesses] = useState<Business[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalBusinessCount, setTotalBusinessCount] = useState(0);
    const [editedBusinesses, setEditedBusinesses] = useState<Record<string, Partial<Business>>>({});
    const [isSaving, setIsSaving] = useState(false);
    
    const [openBusinessIds, setOpenBusinessIds] = useState<Set<string>>(new Set());
    const [editingLocationFor, setEditingLocationFor] = useState<Business | null>(null);
    const [editingScheduleFor, setEditingScheduleFor] = useState<Business | null>(null);

    useEffect(() => {
        const handler = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm]);

    useEffect(() => {
        const fetchPaginatedBusinesses = async () => {
            setLoading(true);
            try {
                const { data, count } = await getAdminBusinessesPaginated(currentPage, PAGE_SIZE, { name: debouncedSearchTerm });
                setBusinesses(data);
                setTotalBusinessCount(count);
            } catch (error: any) {
                showNotification(error.message || t('errorLoadingBusinesses'), 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchPaginatedBusinesses();
    }, [currentPage, debouncedSearchTerm, showNotification, t]);

    const totalPages = Math.ceil(totalBusinessCount / PAGE_SIZE);

    const markAsEdited = useCallback((id: string, field: keyof Business, value: any) => {
        setEditedBusinesses(prev => ({
            ...prev,
            [id]: { ...prev[id], [field]: value }
        }));
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>, id: string) => {
        const { name, value } = e.target;
        markAsEdited(id, name as keyof Business, value);
    };
    
    const handleSaveLocation = (businessId: string, newLocation: { lat: number; lng: number } | null) => {
        markAsEdited(businessId, 'latitude', newLocation?.lat ?? null);
        markAsEdited(businessId, 'longitude', newLocation?.lng ?? null);
        setEditingLocationFor(null);
        showNotification(t('adminBulkEdit.locationSavedLocally'), 'success');
    };

    const handleSaveSchedule = (businessId: string, newSchedule: BusinessHours) => {
        markAsEdited(businessId, 'horarios', newSchedule as any);
        setEditingScheduleFor(null);
        showNotification(t('adminBulkEdit.scheduleSavedLocally'), 'success');
    };

    const handleSaveChanges = async () => {
        const updates = Object.entries(editedBusinesses).map(([id, payload]) => ({ id, payload }));
        if (updates.length === 0) {
            showNotification(t('adminBulkEdit.noChangesToSave'), 'info');
            return;
        }
        setIsSaving(true);
        try {
            await adminBulkUpdateBusinesses(updates as any);
            showNotification(t('adminBulkEdit.changesSavedSuccess'), 'success');
            const changedIds = new Set(Object.keys(editedBusinesses));
            setBusinesses(prev => prev.map(biz => changedIds.has(biz.id) ? { ...biz, ...editedBusinesses[biz.id] } : biz));
            setEditedBusinesses({});
        } catch (error: any) {
            showNotification(error.message || t('adminBulkEdit.errorSavingChanges'), 'error');
        } finally {
            setIsSaving(false);
        }
    };
    
    const hasChanges = Object.keys(editedBusinesses).length > 0;

    const toggleEditDrawer = (id: string) => {
        setOpenBusinessIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    return (
        <>
            <Meta title={t('adminBulkEdit.title') + " - Admin"} description={t('adminBulkEdit.subtitle')} />
            <div className="space-y-6">
                <div className="sticky top-[73px] bg-gray-50 dark:bg-zinc-900 z-20 py-4 -mx-4 px-4 border-b border-gray-200 dark:border-zinc-800">
                    <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h1 className="text-2xl font-extrabold text-gray-800 dark:text-gray-100">{t('adminBulkEdit.title')}</h1>
                            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">{t('adminBulkEdit.subtitle')}</p>
                        </div>
                         <button
                            onClick={handleSaveChanges}
                            disabled={!hasChanges || isSaving}
                            className={`bg-brand-green text-white font-bold py-2 px-6 rounded-lg shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors ${hasChanges ? 'animate-pulse' : ''}`}
                        >
                            {isSaving && <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                            <span>{isSaving ? t('common.saving') : `${t('adminBulkEdit.saveChanges')} (${Object.keys(editedBusinesses).length})`}</span>
                        </button>
                    </div>
                </div>
                
                <input
                    type="search"
                    placeholder={t('adminBulkEdit.searchPlaceholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full max-w-sm p-2 border border-gray-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-200 rounded-lg focus:ring-2 focus:ring-brand-green"
                />

                {loading ? (
                    <div className="flex justify-center items-center h-96"><Spinner /></div>
                ) : (
                    <div className="space-y-3">
                        {businesses.map(biz => {
                            const isEdited = !!editedBusinesses[biz.id];
                            const isOpen = openBusinessIds.has(biz.id);
                            const currentData = { ...biz, ...editedBusinesses[biz.id] };

                            return (
                                <div key={biz.id} className={`bg-white dark:bg-zinc-800 rounded-lg shadow-sm border dark:border-zinc-700 transition-all ${isEdited ? 'border-yellow-400 dark:border-yellow-600' : ''}`}>
                                    <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => toggleEditDrawer(biz.id)}>
                                        <div className="font-semibold text-gray-800 dark:text-gray-100">{currentData.name}</div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-sm text-gray-500">{currentData.country}</span>
                                            <button className="text-gray-400 hover:text-brand-green">
                                                <i className={`fa-solid fa-chevron-down transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
                                            </button>
                                        </div>
                                    </div>
                                    {isOpen && (
                                        <div className="p-4 border-t border-gray-100 dark:border-zinc-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {/* Col 1 */}
                                            <div className="space-y-4">
                                                <div><label className="text-xs font-semibold">{t('adminBulkEdit.header_name')}</label><input type="text" name="name" value={currentData.name || ''} onChange={(e) => handleInputChange(e, biz.id)} className={`w-full p-2 border rounded bg-transparent ${editedBusinesses[biz.id]?.name !== undefined ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'border-gray-200 dark:border-zinc-600'}`}/></div>
                                                <div><label className="text-xs font-semibold">{t('adminBulkEdit.header_country')}</label><select name="country" value={currentData.country || ''} onChange={(e) => handleInputChange(e, biz.id)} className={`w-full p-2 border rounded bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-200 ${editedBusinesses[biz.id]?.country !== undefined ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'border-gray-200 dark:border-zinc-600'}`}><option value="">{t('adminBulkEdit.selectCountry')}</option>{COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</select></div>
                                                <div><label className="text-xs font-semibold">{t('adminBulkEdit.header_category')}</label><select name="category" value={currentData.category || ''} onChange={(e) => handleInputChange(e, biz.id)} className={`w-full p-2 border rounded bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-200 ${editedBusinesses[biz.id]?.category !== undefined ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'border-gray-200 dark:border-zinc-600'}`}><option value="">{t('adminBulkEdit.select')}</option>{Object.entries(CATEGORIES).map(([main, subs]) => (<optgroup key={main} label={t(`categories.${main}`)}>{subs.map(s => <option key={s} value={`${main}:${s}`}>{t(`subcategories.${s}`)}</option>)}</optgroup>))}</select></div>
                                            </div>
                                            {/* Col 2 */}
                                            <div className="space-y-4">
                                                <div><label className="text-xs font-semibold">{t('adminBulkEdit.header_website')}</label><input type="url" name="website_url" value={currentData.website_url || ''} onChange={(e) => handleInputChange(e, biz.id)} className={`w-full p-2 border rounded bg-transparent ${editedBusinesses[biz.id]?.website_url !== undefined ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'border-gray-200 dark:border-zinc-600'}`}/></div>
                                                <div><label className="text-xs font-semibold">{t('adminBulkEdit.header_logoUrl')}</label><input type="url" name="logo_url" value={currentData.logo_url || ''} onChange={(e) => handleInputChange(e, biz.id)} className={`w-full p-2 border rounded bg-transparent ${editedBusinesses[biz.id]?.logo_url !== undefined ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'border-gray-200 dark:border-zinc-600'}`}/></div>
                                                <div><label className="text-xs font-semibold">{t('adminBulkEdit.header_googleMapsUrl')}</label><input type="url" name="google_maps_url" value={currentData.google_maps_url || ''} onChange={(e) => handleInputChange(e, biz.id)} className={`w-full p-2 border rounded bg-transparent ${editedBusinesses[biz.id]?.google_maps_url !== undefined ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'border-gray-200 dark:border-zinc-600'}`}/></div>
                                            </div>
                                            {/* Col 3 */}
                                            <div className="space-y-4">
                                                <div><label className="text-xs font-semibold">{t('adminBulkEdit.header_contactEmail')}</label><input type="email" name="contact_email" value={currentData.contact_email || ''} onChange={(e) => handleInputChange(e, biz.id)} className={`w-full p-2 border rounded bg-transparent ${editedBusinesses[biz.id]?.contact_email !== undefined ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'border-gray-200 dark:border-zinc-600'}`}/></div>
                                                <div><label className="text-xs font-semibold">{t('adminBulkEdit.header_phone')}</label><input type="tel" name="contact_phone" value={currentData.contact_phone || ''} onChange={(e) => handleInputChange(e, biz.id)} className={`w-full p-2 border rounded bg-transparent ${editedBusinesses[biz.id]?.contact_phone !== undefined ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'border-gray-200 dark:border-zinc-600'}`}/></div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <button type="button" onClick={() => setEditingLocationFor(currentData)} className="p-2 border border-gray-200 dark:border-zinc-600 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-zinc-700">
                                                        <i className="fa-solid fa-map-location-dot mr-2"></i> {t('adminBulkEdit.header_location')}
                                                    </button>
                                                    <button type="button" onClick={() => setEditingScheduleFor(currentData)} className="p-2 border border-gray-200 dark:border-zinc-600 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-zinc-700">
                                                        <i className="fa-solid fa-clock mr-2"></i> {t('adminBulkEdit.header_schedule')}
                                                    </button>
                                                </div>
                                            </div>
                                            {/* Description Row */}
                                            <div className="md:col-span-2 lg:col-span-3">
                                                <label className="text-xs font-semibold">{t('adminBulkEdit.header_description')}</label>
                                                <textarea name="description" value={currentData.description || ''} onChange={(e) => handleInputChange(e, biz.id)} rows={2} className={`w-full p-2 border rounded bg-transparent ${editedBusinesses[biz.id]?.description !== undefined ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'border-gray-200 dark:border-zinc-600'}`}/>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
                
                 {totalPages > 1 && (
                    <nav className="flex justify-between items-center pt-4">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1 || loading} className="px-3 py-1 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-600 disabled:opacity-50">{t('common.previous')}</button>
                        <span>{t('common.page', { current: currentPage, total: totalPages })}</span>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || loading} className="px-3 py-1 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-600 disabled:opacity-50">{t('common.next')}</button>
                    </nav>
                )}
            </div>

            {editingLocationFor && (
                <LocationEditorModal 
                    business={editingLocationFor} 
                    onClose={() => setEditingLocationFor(null)}
                    onSave={handleSaveLocation}
                />
            )}
            {editingScheduleFor && (
                <ScheduleEditorModal 
                    business={editingScheduleFor} 
                    onClose={() => setEditingScheduleFor(null)}
                    onSave={handleSaveSchedule}
                />
            )}
        </>
    );
};

export default AdminBulkEditPage;