import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { getBusinessById, updateBusinessProfile } from '../../../services/supabaseService';
import Spinner from '../../Spinner';
import type { Business, BusinessHours, Json, Sede } from '../../../types';
import { useNotification } from '../../../contexts/NotificationContext';
import { CATEGORIES, COUNTRIES, SEDE_COUNTRIES } from '../../../constants';
import Meta from '../../Meta';
import { useTranslation } from '../../../contexts/i18nContext';
import L from 'leaflet';

const orderedDays: (keyof BusinessHours)[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

// Helper component for managing a single day's schedule
const DaySchedule: React.FC<{ day: keyof BusinessHours; value: { open: string; close: string } | 'cerrado'; onChange: (day: keyof BusinessHours, value: { open: string; close: string } | 'cerrado') => void; }> = ({ day, value, onChange }) => {
    const isClosed = value === 'cerrado';

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
                <span>{day}</span>
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


const AdminEditBusinessPage: React.FC = () => {
    const { businessId } = ReactRouterDOM.useParams<{ businessId: string }>();
    const navigate = ReactRouterDOM.useNavigate();
    const { showNotification } = useNotification();
    const t = useTranslation();

    const [business, setBusiness] = useState<Business | null>(null);
    const [initialLoading, setInitialLoading] = useState(true);

    const [formData, setFormData] = useState({
        name: '',
        website_url: '',
        twitter: '',
        instagram: '',
        logo_url: '',
        google_maps_url: '',
        category: '',
        description: '',
        contact_email: '',
        contact_phone: '',
        country: 'ES',
    });
    const [horarios, setHorarios] = useState<BusinessHours>({});
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [addressSearch, setAddressSearch] = useState('');
    const [isSearchingAddress, setIsSearchingAddress] = useState(false);
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [sedes, setSedes] = useState<Sede[]>([]);
    const [offersInternational, setOffersInternational] = useState(false);
    const [newSede, setNewSede] = useState<{ country_code: string; website_url: string; logo_url: string }>({ country_code: '', website_url: '', logo_url: '' });
    
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<L.Map | null>(null);
    const markerRef = useRef<L.Marker | null>(null);
    const initialDataLoaded = useRef(false);

    useEffect(() => {
        if (!businessId) {
            setError("ID de empresa no encontrado.");
            setInitialLoading(false);
            return;
        }

        const fetchBusiness = async () => {
            setInitialLoading(true);
            try {
                const data = await getBusinessById(businessId);
                if (data) {
                    setBusiness(data);
                } else {
                    setError("No se encontró la empresa.");
                }
            } catch (e) {
                setError("Error al cargar la empresa.");
            } finally {
                setInitialLoading(false);
            }
        };

        fetchBusiness();
    }, [businessId]);
    
    useEffect(() => {
        if (business && !initialDataLoaded.current) {
            setFormData({
                name: business.name || '',
                website_url: business.website_url || '',
                twitter: (business.social_links as any)?.twitter || '',
                instagram: (business.social_links as any)?.instagram || '',
                logo_url: business.logo_url || '',
                google_maps_url: business.google_maps_url || '',
                category: business.category || '',
                description: business.description || '',
                contact_email: business.contact_email || '',
                contact_phone: business.contact_phone || '',
                country: business.country || 'ES',
            });
            setHorarios(business.horarios || {});
            if (business.latitude && business.longitude) {
                setLocation({ lat: business.latitude, lng: business.longitude });
            }
            setSedes((business.sedes as Sede[]) || []);
            setOffersInternational(business.offers_international_services || false);
            initialDataLoaded.current = true;
        }
    }, [business]);
    
    useEffect(() => {
        // Initialize map
        if (mapContainerRef.current && !mapRef.current) {
            mapRef.current = L.map(mapContainerRef.current, {
                center: [40.416775, -3.703790], // Default center on Spain
                zoom: 6,
            });
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(mapRef.current);

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
        } else {
            if (markerRef.current) {
                markerRef.current.remove();
                markerRef.current = null;
            }
        }
    }, [location]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleHorariosChange = useCallback((day: keyof BusinessHours, value: { open: string; close: string } | 'cerrado') => {
        setHorarios(prev => ({ ...prev, [day]: value }));
    }, []);
    
     const handleAddressSearch = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (!addressSearch.trim()) return;
        setIsSearchingAddress(true);
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressSearch)}`);
            const data = await response.json();
            if (data && data.length > 0) {
                const { lat, lon } = data[0];
                setLocation({ lat: parseFloat(lat), lng: parseFloat(lon) });
            } else {
                showNotification('No se encontraron resultados para la dirección.', 'error');
            }
        } catch (error) {
            console.error("Address search failed:", error);
            showNotification('Error al buscar la dirección.', 'error');
        } finally {
            setIsSearchingAddress(false);
        }
    };

    const clearLocation = () => {
        setLocation(null);
    };

    const handleAddSede = () => {
        if (!newSede.country_code) {
            showNotification('Por favor, selecciona un país.', 'error');
            return;
        }
        setSedes([...sedes, { country_code: newSede.country_code, website_url: newSede.website_url || null, logo_url: newSede.logo_url || null }]);
        setNewSede({ country_code: '', website_url: '', logo_url: '' });
    };

    const handleRemoveSede = (countryCode: string) => {
        setSedes(sedes.filter(s => s.country_code !== countryCode));
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!businessId) return;
        
        setLoading(true);
        setError(null);

        try {
            const social_links = {
                twitter: formData.twitter.trim(),
                instagram: formData.instagram.trim(),
            };
            
            const cleanedHorarios: BusinessHours = {};
            for (const day of orderedDays) {
                const schedule = horarios[day];
                if (schedule === 'cerrado') {
                    cleanedHorarios[day] = 'cerrado';
                } 
                else if (typeof schedule === 'object' && schedule.open && schedule.close) {
                    cleanedHorarios[day] = schedule;
                }
            }

            const otherSedes = sedes.filter(s => s.country_code !== business?.country);

            const updates = {
                name: formData.name,
                website_url: formData.website_url,
                social_links: (social_links.twitter || social_links.instagram) ? social_links : null,
                horarios: Object.keys(cleanedHorarios).length > 0 ? (cleanedHorarios as unknown as Json) : null,
                logo_url: formData.logo_url,
                google_maps_url: formData.google_maps_url,
                category: formData.category,
                description: formData.description,
                contact_email: formData.contact_email,
                contact_phone: formData.contact_phone,
                latitude: location ? location.lat : null,
                longitude: location ? location.lng : null,
                country: formData.country,
                sedes: otherSedes.length > 0 ? otherSedes as unknown as Json : null,
                offers_international_services: offersInternational,
            };

            await updateBusinessProfile(businessId, updates);
            
            showNotification('Cambios guardados por el administrador', 'success');
            initialDataLoaded.current = false;

            setTimeout(() => {
                navigate('/admin/panel');
            }, 1500);

        } catch (err: any) {
            setError(err.message || 'Error al actualizar el perfil del negocio.');
        } finally {
            setLoading(false);
        }
    };
    
    const primarySede: Sede | null = useMemo(() => (business ? {
        country_code: business.country || 'ES',
    } : null), [business?.country]);

    const combinedSedes = useMemo(() => {
        if (!business || !primarySede) return [];
        const otherSedes = (sedes || []).filter(s => s.country_code !== primarySede.country_code);
        return [primarySede, ...otherSedes];
    }, [primarySede, sedes, business]);

    const availableSedeCountries = useMemo(() => {
        if (!business) return SEDE_COUNTRIES;
        const existingCountryCodes = new Set(combinedSedes.map(s => s.country_code));
        return SEDE_COUNTRIES.filter(c => !c.disabled && !existingCountryCodes.has(c.code));
    }, [combinedSedes, business]);


    if (initialLoading) {
        return <div className="flex justify-center items-center h-64"><Spinner /></div>;
    }

    return (
        <>
            <Meta
                title={`Editar ${business?.name || 'Empresa'} (Admin) - Opynio`}
                description="Edición de perfil de negocio como administrador."
            />
            <div className="max-w-3xl mx-auto bg-white dark:bg-zinc-800 p-8 rounded-xl shadow-lg">
                <h1 className="text-3xl font-bold mb-2 dark:text-gray-100">Editar Empresa (Admin)</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-8">Estás editando la información para: <strong className="text-brand-dark dark:text-gray-200">{business?.name}</strong></p>

                {error && (
                    <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg mb-6" role="alert">
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-8">
                    <div>
                        <label htmlFor="name" className="block text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Nombre del Negocio</label>
                        <input id="name" type="text" value={formData.name} onChange={handleInputChange} required className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-transparent text-gray-900 dark:text-gray-100"/>
                    </div>

                    <div>
                        <label className="block text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Logo</label>
                        <div className="flex items-center gap-4">
                            <div className="w-20 h-20 rounded-lg bg-gray-100 dark:bg-zinc-700 flex-shrink-0 overflow-hidden">
                                 {formData.logo_url ? (
                                    <img src={formData.logo_url} alt="Vista previa del logo" width={80} height={80} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                        <i className="fa-solid fa-store text-3xl"></i>
                                    </div>
                                )}
                            </div>
                            <div className="flex-grow">
                                 <label htmlFor="logo_url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('editBusiness.logoUrl')}</label>
                                 <input
                                    id="logo_url"
                                    type="url"
                                    value={formData.logo_url}
                                    onChange={handleInputChange}
                                    placeholder={t('common.placeholders.logoUrl')}
                                    className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-transparent text-gray-900 dark:text-gray-100"
                                />
                            </div>
                        </div>
                    </div>
                    
                    <div>
                        <label htmlFor="description" className="block text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">{t('editBusiness.description')}</label>
                        <textarea
                            id="description"
                            value={formData.description}
                            onChange={handleInputChange}
                            rows={4}
                            placeholder={t('common.placeholders.describeYourBusiness')}
                            className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-transparent text-gray-900 dark:text-gray-100"
                        />
                    </div>

                    <div>
                        <label htmlFor="website_url" className="block text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Página Web</label>
                        <input id="website_url" type="url" value={formData.website_url} onChange={handleInputChange} placeholder={t('common.placeholders.websiteUrl')} className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-transparent text-gray-900 dark:text-gray-100"/>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="category" className="block text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Categoría</label>
                            <select
                                id="category"
                                value={formData.category}
                                onChange={handleInputChange}
                                required
                                className="w-full p-3 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-200 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent"
                            >
                                <option value="" disabled>{t('editBusiness.selectCategory')}</option>
                                {Object.entries(CATEGORIES).map(([mainCategory, subCategories]) => (
                                    <optgroup key={mainCategory} label={t(`categories.${mainCategory}`)}>
                                        {subCategories.map(subCategory => {
                                            const fullCategory = `${mainCategory}: ${subCategory}`;
                                            return (
                                                <option key={fullCategory} value={fullCategory}>
                                                    {t(`subcategories.${subCategory}`)}
                                                </option>
                                            );
                                        })}
                                    </optgroup>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="country" className="block text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">{t('editBusiness.country')}</label>
                             <select
                                id="country"
                                value={formData.country}
                                onChange={handleInputChange}
                                required
                                className="w-full p-3 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-200 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent"
                            >
                                {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">Sedes / Ubicaciones Internacionales</h3>
                        <div className="space-y-3 p-4 border dark:border-zinc-700 rounded-xl bg-gray-50 dark:bg-zinc-900 shadow-sm">
                            {combinedSedes.length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">No se han añadido sedes internacionales.</p> : combinedSedes.map(sede => {
                                const isPrimary = sede.country_code === primarySede?.country_code;
                                const countryInfo = COUNTRIES.find(c => c.code === sede.country_code);
                                return (
                                    <div key={sede.country_code} className={`flex items-center justify-between p-3 rounded-lg border dark:border-zinc-700 ${isPrimary ? 'bg-gray-100 dark:bg-zinc-800' : 'bg-white dark:bg-zinc-800'}`}>
                                        <div className="flex items-center gap-3">
                                            <img src={countryInfo?.flag} alt={countryInfo?.name} width={24} height={24} loading="lazy" decoding="async" className="w-6 h-6 rounded-full" />
                                            <span className={`font-semibold ${isPrimary ? 'text-gray-500 dark:text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}>{countryInfo?.name}</span>
                                            {isPrimary && <span className="text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-zinc-700 px-2 py-0.5 rounded-full">SEDE PRINCIPAL</span>}
                                        </div>
                                        {!isPrimary && (
                                            <button type="button" onClick={() => handleRemoveSede(sede.country_code)} className="text-red-500 hover:text-red-700 text-sm font-semibold">Eliminar</button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-4 p-4 border-t dark:border-zinc-700">
                            <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Añadir nueva sede</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                                <select value={newSede.country_code} onChange={(e) => setNewSede(p => ({ ...p, country_code: e.target.value }))} className="w-full p-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-200">
                                    <option value="" disabled>Selecciona un país</option>
                                    {availableSedeCountries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                                </select>
                                <button type="button" onClick={handleAddSede} className="bg-brand-dark text-white font-semibold py-2 px-4 rounded-lg">Añadir Sede</button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                                <input type="url" value={newSede.website_url} onChange={e => setNewSede(p => ({ ...p, website_url: e.target.value }))} placeholder={t('common.placeholders.websiteForBranch')} className="w-full p-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-transparent text-gray-900 dark:text-gray-100" />
                                <input type="url" value={newSede.logo_url} onChange={e => setNewSede(p => ({ ...p, logo_url: e.target.value }))} placeholder={t('common.placeholders.logoForBranch')} className="w-full p-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-transparent text-gray-900 dark:text-gray-100" />
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Servicios Internacionales</h3>
                        <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-zinc-700/50 rounded-lg cursor-pointer">
                            <div>
                                <p className="font-semibold text-gray-800 dark:text-gray-200">Ofrecer servicios internacionalmente</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Activa esto si el negocio puede atender a clientes en todo el mundo, no solo en sus sedes físicas.</p>
                            </div>
                            <div className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={offersInternational} onChange={() => setOffersInternational(p => !p)} className="sr-only peer" />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-brand-green"></div>
                            </div>
                        </label>
                    </div>
                    
                    <div>
                        <label htmlFor="google_maps_url" className="block text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">{t('editBusiness.googleMapsUrl')}</label>
                        <input id="google_maps_url" type="url" value={formData.google_maps_url} onChange={handleInputChange} placeholder={t('common.placeholders.googleMapsUrl')} className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-transparent text-gray-900 dark:text-gray-100"/>
                    </div>

                     <div>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">{t('editBusiness.location')}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('editBusiness.locationSubtitle')}</p>
                        
                        <div className="flex items-center gap-2 mb-4">
                            <input
                                type="text"
                                value={addressSearch}
                                onChange={(e) => setAddressSearch(e.target.value)}
                                placeholder={t('common.placeholders.address')}
                                className="flex-grow p-3 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-transparent text-gray-900 dark:text-gray-100"
                            />
                            <button
                                type="button"
                                onClick={handleAddressSearch}
                                disabled={isSearchingAddress}
                                className="bg-brand-dark text-white font-semibold px-4 py-3 rounded-lg hover:bg-gray-700 disabled:bg-gray-400 flex items-center justify-center w-16"
                                style={{ height: '48px' }}
                            >
                                {isSearchingAddress ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <i className="fa-solid fa-search"></i>}
                            </button>
                        </div>

                        <div ref={mapContainerRef} className="w-full h-80 bg-gray-200 dark:bg-zinc-700 rounded-lg z-0 mb-4"></div>
                        
                        {location && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                                <div className="sm:col-span-1">
                                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Latitud</label>
                                    <input type="text" readOnly value={location.lat.toFixed(6)} className="w-full p-2 border bg-gray-100 dark:bg-zinc-700 border-gray-300 dark:border-zinc-600 rounded-lg text-sm text-gray-900 dark:text-gray-200" />
                                </div>
                                <div className="sm:col-span-1">
                                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Longitud</label>
                                    <input type="text" readOnly value={location.lng.toFixed(6)} className="w-full p-2 border bg-gray-100 dark:bg-zinc-700 border-gray-300 dark:border-zinc-600 rounded-lg text-sm text-gray-900 dark:text-gray-200" />
                                </div>
                                <div className="sm:col-span-1 self-end">
                                    <button type="button" onClick={clearLocation} className="w-full text-sm text-red-600 hover:text-red-800 font-semibold py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/50 transition-colors">
                                        {t('editBusiness.removeLocation')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="contact_email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email de Contacto Público</label>
                            <input id="contact_email" type="email" value={formData.contact_email} onChange={handleInputChange} placeholder={t('common.placeholders.contactEmail')} className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-transparent text-gray-900 dark:text-gray-100"/>
                        </div>
                        <div>
                            <label htmlFor="contact_phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teléfono de Contacto Público</label>
                            <input id="contact_phone" type="tel" value={formData.contact_phone} onChange={handleInputChange} placeholder={t('common.placeholders.phone')} className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-transparent text-gray-900 dark:text-gray-100"/>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="twitter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Twitter (usuario)</label>
                            <input id="twitter" type="text" value={formData.twitter} onChange={handleInputChange} placeholder={t('common.placeholders.socialMedia')} className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-transparent text-gray-900 dark:text-gray-100"/>
                        </div>
                        <div>
                            <label htmlFor="instagram" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Instagram (usuario)</label>
                            <input id="instagram" type="text" value={formData.instagram} onChange={handleInputChange} placeholder={t('common.placeholders.socialMedia')} className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-transparent text-gray-900 dark:text-gray-100"/>
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Horario de Apertura</label>
                        <div className="p-4 border dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 shadow-sm">
                            <div className="grid grid-cols-[1fr,2fr] items-center gap-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase px-1 pb-2 border-b dark:border-zinc-700 mb-2">
                                <span>Día</span>
                                <div className="grid grid-cols-2 gap-2">
                                    <span className="text-center">Abre</span>
                                    <span className="text-center">Cierra</span>
                                </div>
                            </div>
                            <div className="divide-y divide-gray-100 dark:divide-zinc-700">
                                {orderedDays.map(day => (
                                    <DaySchedule key={day} day={day} value={horarios[day] || 'cerrado'} onChange={handleHorariosChange} />
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex items-center justify-end gap-4 border-t dark:border-zinc-700">
                         <button type="button" onClick={() => navigate('/admin/panel')} className="text-sm font-semibold text-gray-600 dark:text-gray-300 hover:underline">
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-brand-green text-white font-bold py-2 px-6 rounded-lg hover:bg-opacity-90 transition-colors shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading && <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                            <span>{loading ? 'Guardando...' : 'Guardar Cambios'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
};

export default AdminEditBusinessPage;