import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { adminCreateBusiness, importSerpApiGoogleReviews, checkGoogleMapsUrlIsTaken } from '../../../services/supabaseService';
import { googleReviewsImporter } from '../../../services/serpApiService';
import type { Business, BusinessHours, Json } from '../../../types';
import { useNotification } from '../../../contexts/NotificationContext';
import { CATEGORIES, COUNTRIES } from '../../../constants';
import Meta from '../../Meta';
import L from 'leaflet';
import { useAuth } from '../../../contexts/AuthContext';
import { useTranslation } from '../../../contexts/i18nContext';

const orderedDays: (keyof BusinessHours)[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
type CreationMode = 'none' | 'manual' | 'google';

const DaySchedule: React.FC<{ day: keyof BusinessHours; value: { open: string; close: string } | 'cerrado'; onChange: (day: keyof BusinessHours, value: { open: string; close: string } | 'cerrado') => void; }> = ({ day, value, onChange }) => {
    const isClosed = value === 'cerrado';
    const t = useTranslation();
    const handleOpenToggle = () => onChange(day, isClosed ? { open: '09:00', close: '17:00' } : 'cerrado');
    const handleTimeChange = (part: 'open' | 'close', time: string) => {
        if (typeof value === 'object') onChange(day, { ...value, [part]: time });
    };
    return (
        <div className="grid grid-cols-[1fr,2fr] items-center gap-4 py-3">
            <label className="font-medium text-gray-700 dark:text-gray-300 capitalize flex items-center gap-3 cursor-pointer select-none">
                 <input type="checkbox" checked={!isClosed} onChange={handleOpenToggle} className="h-4 w-4 rounded border-gray-300 dark:border-zinc-500 text-brand-green focus:ring-2 focus:ring-offset-2 focus:ring-brand-green" />
                <span>{t(`businessPage.day_${day}`)}</span>
            </label>
            <div className={`grid grid-cols-2 items-center gap-2 transition-opacity ${isClosed ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                <div className="relative"><input type="time" value={isClosed ? '' : value.open} onChange={(e) => handleTimeChange('open', e.target.value)} disabled={isClosed} className="w-full p-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-white dark:bg-zinc-700 text-sm" aria-label={`Hora de apertura para ${day}`} /><i className="fa-regular fa-clock absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i></div>
                <div className="relative"><input type="time" value={isClosed ? '' : value.close} onChange={(e) => handleTimeChange('close', e.target.value)} disabled={isClosed} className="w-full p-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-white dark:bg-zinc-700 text-sm" aria-label={`Hora de cierre para ${day}`} /><i className="fa-regular fa-clock absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i></div>
            </div>
        </div>
    );
};

const AdminCreateBusinessPage: React.FC = () => {
    const navigate = ReactRouterDOM.useNavigate();
    const { showNotification } = useNotification();
    const { profile } = useAuth();
    const t = useTranslation();

    const [creationMode, setCreationMode] = useState<CreationMode>('none');

    // Manual form states
    const [activeTab, setActiveTab] = useState<'info' | 'import'>('info');
    const [createdBusiness, setCreatedBusiness] = useState<Business | null>(null);
    const [formData, setFormData] = useState({ name: '', website_url: '', twitter: '', instagram: '', logo_url: '', google_maps_url: '', category: '', description: '', contact_email: '', contact_phone: '', country: 'ES' });
    const [horarios, setHorarios] = useState<BusinessHours>({});
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [addressSearch, setAddressSearch] = useState('');
    const [isSearchingAddress, setIsSearchingAddress] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Google import states
    const [googleMapsUrl, setGoogleMapsUrl] = useState('');
    const [googleImportCountry, setGoogleImportCountry] = useState('ES');
    const [isProcessingGoogle, setIsProcessingGoogle] = useState(false);
    const [googleProcessStatus, setGoogleProcessStatus] = useState<string[]>([]);
    const [googleProcessError, setGoogleProcessError] = useState<string | null>(null);
    const [googleProcessSuccess, setGoogleProcessSuccess] = useState<{ business: Business; importedCount: number } | null>(null);
    
    // Manual import states (for manual flow)
    const [isImporting, setIsImporting] = useState(false);
    const [importStatus, setImportStatus] = useState<string[]>([]);
    const [importResult, setImportResult] = useState<{ importedCount: number } | null>(null);
    const [importError, setImportError] = useState<string | null>(null);
    
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<L.Map | null>(null);
    const markerRef = useRef<L.Marker | null>(null);
    
    useEffect(() => {
        if (creationMode === 'manual' && mapContainerRef.current && !mapRef.current) {
            mapRef.current = L.map(mapContainerRef.current, { center: [40.416775, -3.703790], zoom: 6 });
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(mapRef.current);
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
    }, [location, creationMode]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setFormData(prev => ({ ...prev, [e.target.id]: e.target.value }));
    const handleHorariosChange = useCallback((day: keyof BusinessHours, value: any) => setHorarios(prev => ({ ...prev, [day]: value })), []);
    const handleAddressSearch = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (!addressSearch.trim()) return;
        setIsSearchingAddress(true);
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressSearch)}`);
            const data = await response.json();
            if (data && data.length > 0) setLocation({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
            else showNotification(t('adminBulkEdit.addressNotFound'), 'error');
        } catch (error) { showNotification(t('adminBulkEdit.addressSearchError'), 'error'); }
        finally { setIsSearchingAddress(false); }
    };

    const handleCreateBusiness = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const { twitter, instagram, ...restFormData } = formData;
            const social_links = { twitter: twitter.trim(), instagram: instagram.trim() };
            
            const businessData = {
                ...restFormData,
                social_links: (social_links.twitter || social_links.instagram) ? social_links : null,
                horarios: Object.keys(horarios).length > 0 ? (horarios as unknown as Json) : null,
                latitude: location?.lat,
                longitude: location?.lng,
            };

            const newBusiness = await adminCreateBusiness(businessData);
            setCreatedBusiness(newBusiness as Business);
            showNotification(t('businessCreatedSuccess'), 'success');
            setActiveTab('import');
        } catch (err: any) {
            setError(err.message || 'Error al crear la empresa.');
        } finally {
            setLoading(false);
        }
    };

    const handleManualImport = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.google_maps_url.trim() || !createdBusiness) return;
        setIsImporting(true); setImportStatus([]); setImportResult(null); setImportError(null);
        const handleProgressUpdate = (message: string) => setImportStatus(prev => [...prev, message]);
        try {
            const serpApiData = await googleReviewsImporter.importAllReviews(formData.google_maps_url, handleProgressUpdate);
            if(serpApiData.reviews.length === 0) { showNotification(t('adminCreateBusiness.noReviewsToImport'), 'info'); setImportResult({ importedCount: 0 }); return; }
            const ownerId = profile?.id;
            if (!ownerId) throw new Error(t('adminCreateBusiness.adminIdError'));
            const importedCount = await importSerpApiGoogleReviews(createdBusiness.id, formData.google_maps_url);
            setImportResult({ importedCount });
            showNotification(`${importedCount} nuevas reseñas importadas.`, 'success');
        } catch (err: any) { setImportError(err.message); showNotification(err.message as string, 'error'); } 
        finally { setIsImporting(false); }
    };
    
    const handleGoogleImportAndCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessingGoogle(true); setGoogleProcessStatus([]); setGoogleProcessError(null); setGoogleProcessSuccess(null);
        const updateStatus = (message: string) => setGoogleProcessStatus(prev => [...prev, message]);

        try {
            updateStatus(t('adminCreateBusiness.verifyingUrl'));
            const isTaken = await checkGoogleMapsUrlIsTaken(googleMapsUrl.trim());
            if (isTaken) throw new Error(t('adminCreateBusiness.urlTaken', { businessName: 'desconocido' }));

            updateStatus(t('adminCreateBusiness.extractingData'));
            const serpApiData = await googleReviewsImporter.importAllReviews(googleMapsUrl, updateStatus);
            
            updateStatus(t('adminCreateBusiness.creatingProfile'));
            const business_info = serpApiData.business_info;
            if (!business_info) throw new Error(t('adminCreateBusiness.noBusinessInfo'));
            
            let businessLocation: { lat: number, lng: number } | null = null;
            if (business_info.address) {
                updateStatus(t('adminCreateBusiness.geocoding', { address: business_info.address }));
                try {
                    const geoResponse = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(business_info.address)}`);
                    const geoData = await geoResponse.json();
                    if (geoData && geoData.length > 0) {
                        businessLocation = { lat: parseFloat(geoData[0].lat), lng: parseFloat(geoData[0].lon) };
                        updateStatus(t('adminCreateBusiness.locationFound'));
                    }
                } catch (geoError) { updateStatus(t('adminCreateBusiness.geocodingFailed')); }
            }

            const businessData = { name: business_info.title, category: business_info.type, logo_url: business_info.thumbnail, google_maps_url: googleMapsUrl, description: business_info.address, latitude: businessLocation?.lat, longitude: businessLocation?.lng, country: googleImportCountry };
            const newBusiness = await adminCreateBusiness(businessData);
            updateStatus(t('adminCreateBusiness.businessCreatedSuccess', { name: newBusiness.name }));

            if (serpApiData.reviews.length > 0) {
                updateStatus(t('adminCreateBusiness.importingReviews', { count: serpApiData.reviews.length }));
                if (!profile) throw new Error(t('adminCreateBusiness.adminIdError'));
                const importedCount = await importSerpApiGoogleReviews(newBusiness.id, googleMapsUrl);
                updateStatus(t('adminCreateBusiness.processComplete', { count: importedCount }));
                setGoogleProcessSuccess({ business: newBusiness as Business, importedCount });
            } else {
                updateStatus(t('adminCreateBusiness.noReviewsToImport'));
                setGoogleProcessSuccess({ business: newBusiness as Business, importedCount: 0 });
            }
        } catch (err: any) {
            setGoogleProcessError(err.message);
            updateStatus(`Error: ${err.message}`);
        } finally {
            setIsProcessingGoogle(false);
        }
    };
    
    const renderChoiceScreen = () => (
        <div className="text-center p-8 animate-fade-in-up">
            <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100">{t('adminCreateBusiness.howToCreate')}</h2>
            <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                <button onClick={() => setCreationMode('manual')} className="p-6 border-2 border-gray-200 dark:border-zinc-700 rounded-lg hover:border-brand-green dark:hover:border-brand-green hover:bg-green-50 dark:hover:bg-green-900/20 transition-all text-left">
                    <i className="fa-solid fa-pencil-ruler text-3xl text-brand-green mb-3"></i>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">{t('adminCreateBusiness.createManually')}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('adminCreateBusiness.createManuallyDesc')}</p>
                </button>
                <button onClick={() => setCreationMode('google')} className="p-6 border-2 border-gray-200 dark:border-zinc-700 rounded-lg hover:border-brand-green dark:hover:border-brand-green hover:bg-green-50 dark:hover:bg-green-900/20 transition-all text-left">
                    <i className="fa-brands fa-google text-3xl text-blue-600 mb-3"></i>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">{t('adminCreateBusiness.importFromGoogle')}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('adminCreateBusiness.importFromGoogleDesc')}</p>
                </button>
            </div>
        </div>
    );

    const renderManualFlow = () => (
        <>
            <div className="border-b border-gray-200 dark:border-zinc-700 mb-6">
                <nav className="-mb-px flex space-x-6">
                    <button onClick={() => setActiveTab('info')} className={`py-3 px-1 border-b-2 font-semibold text-sm ${activeTab === 'info' ? 'border-brand-green text-brand-green' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>{t('adminCreateBusiness.tabInfo')}</button>
                    <button onClick={() => setActiveTab('import')} disabled={!createdBusiness} className={`py-3 px-1 border-b-2 font-semibold text-sm ${activeTab === 'import' ? 'border-brand-green text-brand-green' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'} disabled:opacity-50 disabled:cursor-not-allowed`}>{t('adminCreateBusiness.tabImport')}</button>
                </nav>
            </div>
            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">{error}</div>}
            {activeTab === 'info' && (
                <form onSubmit={handleCreateBusiness} className="space-y-8 animate-fade-in-up">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('adminCreateBusiness.businessNameRequired')}</label>
                        <input id="name" type="text" value={formData.name} onChange={handleInputChange} required className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg bg-transparent"/>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div>
                            <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('adminCreateBusiness.categoryRequired')}</label>
                            <select id="category" value={formData.category} onChange={handleInputChange} required className="w-full p-3 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 rounded-lg">
                                <option value="" disabled>{t('adminCreateBusiness.selectCategory')}</option>
                                {Object.entries(CATEGORIES).map(([main, subs]) => (
                                    <optgroup key={main} label={t(`categories.${main}`)}>{subs.map(s => <option key={s} value={`${main}:${s}`}>{t(`subcategories.${s}`)}</option>)}</optgroup>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="country" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('adminCreateBusiness.countryRequired')}</label>
                            <select id="country" value={formData.country} onChange={handleInputChange} required className="w-full p-3 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 rounded-lg">
                                {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                            </select>
                        </div>
                     </div>
                    <div><label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('adminCreateBusiness.description')}</label><textarea id="description" value={formData.description} onChange={handleInputChange} rows={4} className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg bg-transparent"/></div>
                    <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('adminCreateBusiness.logoUrl')}</label><input id="logo_url" type="url" value={formData.logo_url} onChange={handleInputChange} placeholder={t('adminCreateBusiness.logoPlaceholder')} className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg bg-transparent"/></div>
                    <div><h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">{t('adminCreateBusiness.location')}</h3><div className="flex items-center gap-2 mb-4"><input type="text" value={addressSearch} onChange={(e) => setAddressSearch(e.target.value)} placeholder={t('adminCreateBusiness.addressPlaceholder')} className="flex-grow p-3 border border-gray-300 dark:border-zinc-600 rounded-lg bg-transparent"/><button type="button" onClick={handleAddressSearch} disabled={isSearchingAddress} className="bg-brand-dark text-white font-semibold px-4 py-3 rounded-lg w-16 h-[48px] flex items-center justify-center">{isSearchingAddress ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <i className="fa-solid fa-search"></i>}</button></div><div ref={mapContainerRef} className="w-full h-80 bg-gray-200 dark:bg-zinc-700 rounded-lg z-0"></div></div>
                    <div><label className="block text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">{t('adminCreateBusiness.schedule')}</label><div className="p-4 border dark:border-zinc-700 rounded-xl shadow-sm">{orderedDays.map(day=><DaySchedule key={day} day={day} value={horarios[day] ?? 'cerrado'} onChange={handleHorariosChange} />)}</div></div>
                    <div className="pt-4 flex items-center justify-end gap-4 border-t dark:border-zinc-700">
                        <ReactRouterDOM.Link to="/admin/panel" className="text-sm font-semibold text-gray-600 dark:text-gray-300 hover:underline">{t('common.cancel')}</ReactRouterDOM.Link>
                        <button type="submit" disabled={loading || !formData.name || !formData.category} className="bg-brand-green text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-400 flex items-center justify-center gap-2">
                            {loading && <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                            <span>{loading ? t('adminCreateBusiness.creating') : t('adminCreateBusiness.saveAndContinue')}</span>
                        </button>
                    </div>
                </form>
            )}
            {activeTab === 'import' && (
                <div className="animate-fade-in-up">
                    <form onSubmit={handleManualImport} className="space-y-4">
                        <div><label htmlFor="google_maps_url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('adminCreateBusiness.googleUrl')}</label><input id="google_maps_url" type="url" value={formData.google_maps_url} onChange={handleInputChange} placeholder={t('adminCreateBusiness.googleUrlPlaceholder')} className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg bg-transparent" disabled={isImporting} /></div>
                        <button type="submit" disabled={isImporting || !formData.google_maps_url} className="w-full bg-blue-600 text-white font-bold py-3 px-6 rounded-lg disabled:bg-gray-400 flex items-center justify-center gap-2"> {isImporting && <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>} <span>{isImporting ? t('adminCreateBusiness.importing') : t('adminCreateBusiness.importReviewsAndLogo')}</span> </button>
                    </form>
                    {importStatus.length > 0 && <div className="mt-6 p-4 bg-gray-50 dark:bg-zinc-700 border dark:border-zinc-600 rounded-lg"><h3 className="font-semibold mb-2">{t('adminCreateBusiness.progress')}</h3><ul className="text-sm space-y-1.5">{importStatus.map((s,i)=><li key={i} className="flex items-start gap-2">{s}</li>)}</ul></div>}
                    <div className="mt-8 border-t dark:border-zinc-700 pt-6 text-center"><ReactRouterDOM.Link to="/admin/panel" className="text-sm font-semibold text-gray-600 dark:text-gray-300 hover:underline"><i className="fa-solid fa-arrow-left mr-2"></i>{t('adminCreateBusiness.finishAndBack')}</ReactRouterDOM.Link></div>
                </div>
            )}
        </>
    );

    const renderGoogleFlow = () => (
        <div className="animate-fade-in-up">
            <button onClick={() => setCreationMode('none')} className="text-sm font-semibold text-gray-600 dark:text-gray-300 hover:underline mb-4"><i className="fa-solid fa-arrow-left mr-2"></i>{t('adminCreateBusiness.backToChoice')}</button>
            {!googleProcessSuccess ? (
                <form onSubmit={handleGoogleImportAndCreate} className="space-y-4">
                    <div>
                        <label htmlFor="googleMapsUrl-import" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('adminCreateBusiness.googleUrl')}</label>
                        <input id="googleMapsUrl-import" type="url" value={googleMapsUrl} onChange={(e) => setGoogleMapsUrl(e.target.value)} placeholder={t('adminCreateBusiness.googleUrlPlaceholder')} required className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg bg-transparent" disabled={isProcessingGoogle}/>
                    </div>
                    <div>
                        <label htmlFor="country-import" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('adminCreateBusiness.country')}</label>
                        <select id="country-import" value={googleImportCountry} onChange={(e) => setGoogleImportCountry(e.target.value)} required className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800" disabled={isProcessingGoogle}>
                            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                        </select>
                    </div>
                    <button type="submit" disabled={isProcessingGoogle} className="w-full bg-blue-600 text-white font-bold py-3 px-6 rounded-lg disabled:bg-gray-400 flex items-center justify-center gap-2">
                        {isProcessingGoogle && <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                        <span>{isProcessingGoogle ? t('adminCreateBusiness.processing') : t('adminCreateBusiness.createAndImport')}</span>
                    </button>
                </form>
            ) : (
                <div className="text-center">
                    <i className="fa-solid fa-check-circle text-5xl text-green-500 mb-4"></i>
                    <h3 className="text-xl font-bold">{t('adminCreateBusiness.successTitle')}</h3>
                    <p className="text-gray-600 mt-2">{t('adminCreateBusiness.successBody', { businessName: googleProcessSuccess.business.name, importedCount: googleProcessSuccess.importedCount })}</p>
                    <div className="mt-6 flex justify-center gap-4">
                        <button onClick={() => { setCreationMode('none'); setGoogleProcessSuccess(null); setGoogleMapsUrl(''); }} className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg">{t('adminCreateBusiness.createAnother')}</button>
                        <ReactRouterDOM.Link to="/admin/panel" className="px-4 py-2 text-sm font-semibold text-white bg-brand-green rounded-lg">{t('adminCreateBusiness.backToPanel')}</ReactRouterDOM.Link>
                    </div>
                </div>
            )}

            {(googleProcessStatus.length > 0) && (
                <div className="mt-6 p-4 bg-gray-50 dark:bg-zinc-700 border dark:border-zinc-600 rounded-lg">
                    <h4 className="font-semibold mb-2">{t('adminCreateBusiness.progress')}</h4>
                    <ul className="text-sm space-y-1.5 max-h-48 overflow-y-auto">
                        {googleProcessStatus.map((status, index) => (
                            <li key={index} className="flex items-start gap-2">
                                <i className={`fa-solid ${ status.toLowerCase().includes('error') ? 'fa-circle-xmark text-red-500' : 'fa-spinner fa-spin text-blue-500'} mt-1`}></i>
                                <span>{status}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );

    return (
        <>
            <Meta title={`${t('adminCreateBusiness.title')} - Admin`} description={t('adminCreateBusiness.title')} />
            <div className="max-w-4xl mx-auto bg-white dark:bg-zinc-800 p-8 rounded-xl shadow-lg">
                <h1 className="text-3xl font-extrabold text-gray-800 dark:text-gray-100 mb-6">{t('adminCreateBusiness.title')}</h1>

                {creationMode === 'none' && renderChoiceScreen()}
                {creationMode === 'manual' && renderManualFlow()}
                {creationMode === 'google' && renderGoogleFlow()}
                
            </div>
        </>
    );
};

export default AdminCreateBusinessPage;