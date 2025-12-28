import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useBusinessDashboard } from '../../../contexts/BusinessDashboardContext';
import { updateBusinessProfile } from '../../../services/supabaseService';
import * as ReactRouterDOM from 'react-router-dom';
import Spinner from '../../Spinner';
import type { BusinessHours, Json, Business, Plan, Sede } from '../../../types';
import { useNotification } from '../../../contexts/NotificationContext';
import { CATEGORIES, COUNTRIES, SEDE_COUNTRIES } from '../../../constants';
import Meta from '../../Meta';
import L from 'leaflet';
import { useTranslation } from '../../../contexts/i18nContext';

const orderedDays: (keyof BusinessHours)[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

const PLAN_HIERARCHY: Record<Plan, number> = {
    free: 0,
    starter: 1,
    growth: 2,
    pro: 3,
    enterprise: 4,
};

const FeatureLock: React.FC<{ requiredPlan: Plan, featureName: string, children: React.ReactNode }> = ({ requiredPlan, featureName, children }) => {
    const { profile } = useAuth();
    const t = useTranslation();

    if (!profile) {
        return null;
    }

    const currentPlanLevel = PLAN_HIERARCHY[profile.plan];
    const requiredPlanLevel = PLAN_HIERARCHY[requiredPlan];

    if (currentPlanLevel >= requiredPlanLevel) {
        return <>{children}</>;
    }

    return (
        <div className="text-center p-6 sm:p-8 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border-2 border-dashed dark:border-zinc-700">
            <div className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-300 rounded-full w-14 h-14 sm:w-16 sm:h-16 inline-flex items-center justify-center shadow-sm border-4 border-white dark:border-zinc-800 mb-3 sm:mb-4">
                <i className="fa-solid fa-lock text-2xl sm:text-3xl"></i>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100">{featureName}</h2>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-2 max-w-md mx-auto">
                {t('businessDashboard.widgetsLockSubtitle')}
            </p>
            <ReactRouterDOM.Link
                to="/planes"
                className="mt-4 sm:mt-6 inline-block bg-brand-green text-white font-bold px-6 sm:px-8 py-2.5 sm:py-3 rounded-md hover:bg-opacity-90 transition-all shadow-lg shadow-brand-green/30 text-base sm:text-lg"
            >
                {t('businessDashboard.upgradePlanButton')}
            </ReactRouterDOM.Link>
        </div>
    );
};


// Helper component for managing a single day's schedule
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
        <div className="grid grid-cols-1 sm:grid-cols-[1fr,2fr] items-start sm:items-center gap-2 sm:gap-4 py-2 sm:py-3">
            <label className="font-medium text-sm sm:text-base text-gray-700 dark:text-gray-300 capitalize flex items-center gap-2 sm:gap-3 cursor-pointer select-none">
                 <input
                    type="checkbox"
                    checked={!isClosed}
                    onChange={handleOpenToggle}
                    className="h-4 w-4 rounded border-gray-300 dark:border-zinc-600 text-brand-green focus:ring-2 focus:ring-offset-2 focus:ring-brand-green dark:focus:ring-offset-zinc-900 flex-shrink-0"
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
                        className="w-full p-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-white dark:bg-zinc-700 text-xs sm:text-sm dark:text-gray-200"
                        aria-label={`Hora de apertura para ${day}`}
                    />
                     <i className="fa-regular fa-clock absolute right-2 top-1/2 -translate-y-1/2 text-xs sm:text-sm text-gray-400 pointer-events-none"></i>
                </div>
                 <div className="relative">
                    <input
                        type="time"
                        value={isClosed ? '' : value.close}
                        onChange={(e) => handleTimeChange('close', e.target.value)}
                        disabled={isClosed}
                        className="w-full p-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-white dark:bg-zinc-700 text-xs sm:text-sm dark:text-gray-200"
                        aria-label={`Hora de cierre para ${day}`}
                    />
                    <i className="fa-regular fa-clock absolute right-2 top-1/2 -translate-y-1/2 text-xs sm:text-sm text-gray-400 pointer-events-none"></i>
                </div>
            </div>
        </div>
    )
};

// Componente para editar una sede completa con todos sus datos
const SedeEditor: React.FC<{
    sede: Sede;
    index: number;
    isPrimary: boolean;
    onUpdate: (index: number, updatedSede: Sede) => void;
    onRemove: (index: number) => void;
}> = ({ sede, index, isPrimary, onUpdate, onRemove }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [sedeHorarios, setSedeHorarios] = useState<BusinessHours>(
        (typeof sede.horarios === 'object' && sede.horarios !== null && !Array.isArray(sede.horarios))
            ? (sede.horarios as BusinessHours)
            : {}
    );
    const t = useTranslation();

    const countryInfo = SEDE_COUNTRIES.find(c => c.code === sede.country_code);

    const handleFieldChange = (field: keyof Sede, value: any) => {
        onUpdate(index, { ...sede, [field]: value });
    };

    const handleHorariosChange = (day: keyof BusinessHours, value: { open: string; close: string } | 'cerrado') => {
        const updated = { ...sedeHorarios, [day]: value };
        setSedeHorarios(updated);
        onUpdate(index, { ...sede, horarios: updated as unknown as Json });
    };

    return (
        <div className="border border-gray-300 dark:border-zinc-700 rounded-lg overflow-hidden">
            {/* Header */}
            <div
                className={`flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition-colors ${isPrimary ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-white dark:bg-zinc-800'}`}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    {countryInfo && (
                        <img src={countryInfo.flag} alt={countryInfo.name} width={32} height={32} loading="lazy" decoding="async" className="w-8 h-8 rounded-full shadow-sm" />
                    )}
                    <div>
                        <h4 className="font-bold text-gray-900 dark:text-white">
                            {sede.name || countryInfo?.name || sede.country_code}
                        </h4>
                        {isPrimary && (
                            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                                {t('editBusiness.primaryLocation')}
                            </span>
                        )}
                        {sede.city && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">{sede.city}</p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {!isPrimary && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemove(index);
                            }}
                            className="text-red-500 hover:text-red-700 text-sm font-semibold px-3 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                            {t('editBusiness.removeLocation2')}
                        </button>
                    )}
                    <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-gray-400`}></i>
                </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="p-4 space-y-4 bg-gray-50 dark:bg-zinc-800/50 border-t dark:border-zinc-700">
                    {/* Nombre de la Sede */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('editBusiness.locationName')}
                        </label>
                        <input
                            type="text"
                            value={sede.name || ''}
                            onChange={(e) => handleFieldChange('name', e.target.value)}
                            placeholder={`${t('editBusiness.locationNamePlaceholder')} (${countryInfo?.name})`}
                            className="w-full p-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 dark:text-gray-200"
                        />
                    </div>

                    {/* Descripción */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('common.description')}
                        </label>
                        <textarea
                            value={sede.description || ''}
                            onChange={(e) => handleFieldChange('description', e.target.value)}
                            rows={3}
                            placeholder={t('editBusiness.sedeDescriptionPlaceholder')}
                            className="w-full p-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 dark:text-gray-200"
                        />
                    </div>

                    {/* Dirección y Ciudad */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('editBusiness.address')}
                            </label>
                            <input
                                type="text"
                                value={sede.address || ''}
                                onChange={(e) => handleFieldChange('address', e.target.value)}
                                placeholder={t('editBusiness.addressPlaceholder')}
                                className="w-full p-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 dark:text-gray-200"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('common.city')}
                            </label>
                            <input
                                type="text"
                                value={sede.city || ''}
                                onChange={(e) => handleFieldChange('city', e.target.value)}
                                placeholder={t('common.placeholders.city')}
                                className="w-full p-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 dark:text-gray-200"
                            />
                        </div>
                    </div>

                    {/* Estado y Código Postal */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('editBusiness.state')}
                            </label>
                            <input
                                type="text"
                                value={sede.state || ''}
                                onChange={(e) => handleFieldChange('state', e.target.value)}
                                placeholder={t('editBusiness.statePlaceholder')}
                                className="w-full p-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 dark:text-gray-200"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('editBusiness.zipCode')}
                            </label>
                            <input
                                type="text"
                                value={sede.zip_code || ''}
                                onChange={(e) => handleFieldChange('zip_code', e.target.value)}
                                placeholder={t('editBusiness.zipCodePlaceholder')}
                                className="w-full p-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 dark:text-gray-200"
                            />
                        </div>
                    </div>

                    {/* Teléfono y Email de Contacto */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('editBusiness.publicContactPhone')}
                            </label>
                            <input
                                type="tel"
                                value={sede.contact_phone || ''}
                                onChange={(e) => handleFieldChange('contact_phone', e.target.value)}
                                placeholder={t('editBusiness.publicContactPhonePlaceholder')}
                                className="w-full p-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 dark:text-gray-200"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('editBusiness.publicContactEmail')}
                            </label>
                            <input
                                type="email"
                                value={sede.contact_email || ''}
                                onChange={(e) => handleFieldChange('contact_email', e.target.value)}
                                placeholder={t('editBusiness.publicContactEmailPlaceholder')}
                                className="w-full p-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 dark:text-gray-200"
                            />
                        </div>
                    </div>

                    {/* URLs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('common.website')}
                            </label>
                            <input
                                type="url"
                                value={sede.website_url || ''}
                                onChange={(e) => handleFieldChange('website_url', e.target.value)}
                                placeholder={t('common.placeholders.websiteForBranch')}
                                className="w-full p-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 dark:text-gray-200"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('editBusiness.googleMapsUrl')}
                            </label>
                            <input
                                type="url"
                                value={sede.google_maps_url || ''}
                                onChange={(e) => handleFieldChange('google_maps_url', e.target.value)}
                                placeholder={t('editBusiness.googleMapsUrlPlaceholder')}
                                className="w-full p-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 dark:text-gray-200"
                            />
                        </div>
                    </div>

                    {/* Logo URL */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('editBusiness.logoUrl')}
                        </label>
                        <input
                            type="url"
                            value={sede.logo_url || ''}
                            onChange={(e) => handleFieldChange('logo_url', e.target.value)}
                            placeholder={t('common.placeholders.logoForBranch')}
                            className="w-full p-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 dark:text-gray-200"
                        />
                    </div>

                    {/* Horarios */}
                    <div>
                        <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            {t('editBusiness.businessHours')}
                        </h5>
                        <div className="space-y-2 bg-white dark:bg-zinc-800 p-3 rounded-lg border border-gray-200 dark:border-zinc-700">
                            {orderedDays.map(day => (
                                <DaySchedule
                                    key={day}
                                    day={day}
                                    value={sedeHorarios[day] || 'cerrado'}
                                    onChange={handleHorariosChange}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const EditBusinessPage: React.FC = () => {
    const { loading: authLoading, setBusinesses } = useAuth();
    const { business } = useBusinessDashboard();
    const navigate = ReactRouterDOM.useNavigate();
    const { showNotification } = useNotification();
    const t = useTranslation();

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
                setLocation({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
            } else {
                showNotification(t('editBusiness.addressNotFound'), 'error');
            }
        } catch (error) {
            console.error("Address search failed:", error);
            showNotification(t('editBusiness.addressSearchError'), 'error');
        } finally {
            setIsSearchingAddress(false);
        }
    };

    const clearLocation = () => {
        setLocation(null);
    }

    const handleAddSede = () => {
        if (!newSede.country_code) {
            showNotification(t('editBusiness.selectCountryError'), 'error');
            return;
        }
        const countryInfo = SEDE_COUNTRIES.find(c => c.code === newSede.country_code);
        const newSedeData: Sede = {
            country_code: newSede.country_code,
            name: countryInfo?.name || newSede.country_code,
            description: null,
            address: undefined,
            city: undefined,
            state: undefined,
            zip_code: undefined,
            latitude: undefined,
            longitude: undefined,
            contact_phone: null,
            contact_email: null,
            website_url: newSede.website_url || null,
            google_maps_url: null,
            logo_url: newSede.logo_url || null,
            horarios: null,
            social_links: null,
            flag: countryInfo?.flag,
        };
        setSedes([...sedes, newSedeData]);
        setNewSede({ country_code: '', website_url: '', logo_url: '' });
    };

    const handleUpdateSede = (index: number, updatedSede: Sede) => {
        const newSedes = [...sedes];
        newSedes[index] = updatedSede;
        setSedes(newSedes);
    };

    const handleRemoveSede = (index: number) => {
        setSedes(sedes.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!business) return;
        
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
            
            // Remove the primary sede from the 'sedes' array before saving
            const otherSedes = sedes.filter(s => s.country_code !== business.country);

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

            const updatedBusiness = await updateBusinessProfile(business.id, updates);

            if (updatedBusiness) {
                setBusinesses(prev => prev.map(b => b.id === updatedBusiness.id ? { ...b, ...updatedBusiness } : b));
            }
            
            showNotification(t('editBusiness.changesSaved'), 'success');
            initialDataLoaded.current = false; // Allow reloading new data if user navigates back

        } catch (err: any) {
            setError(err.message || t('editBusiness.errorUpdating'));
        } finally {
            setLoading(false);
        }
    };
    
    const primarySede: Sede | null = useMemo(() => (business ? {
        country_code: business.country || 'ES',
    } : null), [business?.country]);

    const combinedSedes = useMemo(() => {
        if (!business || !primarySede) return [];
        // Ensure primary sede is always first and not duplicated from the sedes array
        const otherSedes = (sedes || []).filter(s => s.country_code !== primarySede.country_code);
        return [primarySede, ...otherSedes];
    }, [primarySede, sedes, business]);

    const availableSedeCountries = useMemo(() => {
        if (!business) return SEDE_COUNTRIES;
        const existingCountryCodes = new Set(combinedSedes.map(s => s.country_code));
        return SEDE_COUNTRIES.filter(c => !c.disabled && !existingCountryCodes.has(c.code));
    }, [combinedSedes, business]);


    if (authLoading || !business) {
        return <div className="flex justify-center items-center h-64"><Spinner /></div>;
    }

    return (
        <>
            <Meta
                title={`${t('editBusiness.title')} - Opynio`}
                description={t('editBusiness.subtitle')}
                noindex={true}
            />
            <FeatureLock requiredPlan="starter" featureName={t('businessDashboard.dashboardProfile')}>
                <div className="max-w-3xl mx-auto bg-white dark:bg-zinc-800 p-8 rounded-xl shadow-lg">
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1.5 sm:mb-2 text-gray-900 dark:text-gray-100">{t('editBusiness.title')}</h1>
                    <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-6 sm:mb-8">{t('editBusiness.subtitle')}</p>

                    {error && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg mb-5 sm:mb-6 text-sm sm:text-base" role="alert">
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
                        <div>
                            <label htmlFor="name" className="block text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1.5 sm:mb-2">{t('editBusiness.businessName')}</label>
                            <input id="name" type="text" value={formData.name} onChange={handleInputChange} required className="w-full p-2.5 sm:p-3 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-gray-50 dark:bg-zinc-700 dark:text-gray-200 text-sm sm:text-base"/>
                        </div>

                        <div>
                            <label className="block text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1.5 sm:mb-2">{t('editBusiness.logo')}</label>
                            <div className="flex flex-col xs:flex-row items-start xs:items-center gap-3 sm:gap-4">
                                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-gray-100 dark:bg-zinc-700 flex-shrink-0 overflow-hidden">
                                    {formData.logo_url ? (
                                        <img src={formData.logo_url} alt="Vista previa del logo" width={80} height={80} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-zinc-500">
                                            <i className="fa-solid fa-store text-2xl sm:text-3xl"></i>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-grow w-full xs:w-auto min-w-0">
                                    <label htmlFor="logo_url" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('editBusiness.logoUrl')}</label>
                                    <input
                                        id="logo_url"
                                        type="url"
                                        value={formData.logo_url}
                                        onChange={handleInputChange}
                                        placeholder={t('editBusiness.logoUrlPlaceholder')}
                                        className="w-full p-2.5 sm:p-3 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-gray-50 dark:bg-zinc-700 dark:text-gray-200 text-sm sm:text-base"
                                    />
                                </div>
                            </div>
                        </div>
                        
                        <div>
                            <label htmlFor="description" className="block text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">{t('editBusiness.description')}</label>
                            <textarea 
                                id="description" 
                                value={formData.description} 
                                onChange={handleInputChange} 
                                rows={4} 
                                placeholder={t('editBusiness.descriptionPlaceholder')}
                                className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-gray-50 dark:bg-zinc-700 dark:text-gray-200"
                            />
                        </div>

                        <div>
                            <label htmlFor="website_url" className="block text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">{t('editBusiness.website')}</label>
                            <input id="website_url" type="url" value={formData.website_url} onChange={handleInputChange} placeholder={t('editBusiness.websitePlaceholder')} className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-gray-50 dark:bg-zinc-700 dark:text-gray-200"/>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                            <div>
                                <label htmlFor="category" className="block text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">{t('editBusiness.category')}</label>
                                <select
                                    id="category"
                                    name="category"
                                    value={formData.category}
                                    onChange={handleInputChange}
                                    required
                                    className="w-full p-3 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent dark:text-gray-200"
                                >
                                    <option value="" disabled>{t('editBusiness.selectCategory')}</option>
                                    {Object.entries(CATEGORIES).map(([mainCategory, subCategories]) => (
                                        <optgroup key={mainCategory} label={t(`categories.${mainCategory}`)}>
                                            {subCategories.map(subCategory => {
                                                const fullCategory = `${mainCategory}:${subCategory}`;
                                                return <option key={fullCategory} value={fullCategory}>{t(`subcategories.${subCategory}`)}</option>;
                                            })}
                                        </optgroup>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="country" className="block text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">{t('editBusiness.country')}</label>
                                <select
                                    id="country"
                                    name="country"
                                    value={formData.country}
                                    onChange={handleInputChange}
                                    required
                                    className="w-full p-3 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent dark:text-gray-200"
                                >
                                    {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">
                                {t('editBusiness.internationalLocations')}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                {t('editBusiness.sedesDescription')}
                            </p>

                            {/* Lista de Sedes con Editor Completo */}
                            <div className="space-y-4 mb-6">
                                {sedes.length === 0 ? (
                                    <div className="text-center py-8 bg-gray-50 dark:bg-zinc-900 rounded-lg border border-dashed border-gray-300 dark:border-zinc-700">
                                        <i className="fa-solid fa-location-dot text-4xl text-gray-300 dark:text-gray-600 mb-2"></i>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            {t('editBusiness.noInternationalLocations')}
                                        </p>
                                    </div>
                                ) : (
                                    sedes.map((sede, index) => (
                                        <SedeEditor
                                            key={`sede-${index}-${sede.country_code}`}
                                            sede={sede}
                                            index={index}
                                            isPrimary={sede.country_code === business?.country}
                                            onUpdate={handleUpdateSede}
                                            onRemove={handleRemoveSede}
                                        />
                                    ))
                                )}
                            </div>

                            {/* Añadir Nueva Sede */}
                            <div className="p-4 bg-gray-50 dark:bg-zinc-900 rounded-lg border border-gray-300 dark:border-zinc-700">
                                <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">
                                    <i className="fa-solid fa-plus-circle mr-2 text-brand-green"></i>
                                    {t('editBusiness.addNewLocation')}
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                                    <select
                                        value={newSede.country_code}
                                        onChange={(e) => setNewSede(p => ({ ...p, country_code: e.target.value }))}
                                        className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 dark:text-gray-200"
                                    >
                                        <option value="" disabled>{t('editBusiness.selectCountry')}</option>
                                        {availableSedeCountries.map(c => (
                                            <option key={c.code} value={c.code}>
                                                {c.name}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={handleAddSede}
                                        className="bg-brand-green hover:bg-green-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors shadow-sm"
                                    >
                                        <i className="fa-solid fa-plus mr-2"></i>
                                        {t('editBusiness.addLocation')}
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                    {t('editBusiness.sedesHelpText')}
                                </p>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">{t('editBusiness.internationalServices')}</h3>
                            <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-zinc-700/50 rounded-lg cursor-pointer">
                                <div>
                                    <p className="font-semibold text-gray-800 dark:text-gray-200">{t('editBusiness.offerServicesInternationally')}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('editBusiness.internationalServicesDescription')}</p>
                                </div>
                                <div className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={offersInternational} onChange={() => setOffersInternational(p => !p)} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-brand-green"></div>
                                </div>
                            </label>
                        </div>
                        
                        <div>
                            <label htmlFor="google_maps_url" className="block text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">{t('editBusiness.googleMapsUrl')}</label>
                            <input id="google_maps_url" type="url" value={formData.google_maps_url} onChange={handleInputChange} placeholder={t('editBusiness.googleMapsUrlPlaceholder')} className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-gray-50 dark:bg-zinc-700 dark:text-gray-200"/>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">{t('editBusiness.location')}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('editBusiness.locationSubtitle')}</p>
                            
                            <div className="flex items-center gap-2 mb-4">
                                <input 
                                    type="text"
                                    value={addressSearch}
                                    onChange={(e) => setAddressSearch(e.target.value)}
                                    placeholder={t('editBusiness.addressPlaceholder')}
                                    className="flex-grow p-3 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-gray-50 dark:bg-zinc-700 dark:text-gray-200"
                                />
                                <button
                                    type="button"
                                    onClick={handleAddressSearch}
                                    disabled={isSearchingAddress}
                                    className="bg-brand-dark text-white font-semibold px-4 py-3 rounded-lg w-16 h-[48px] flex items-center justify-center"
                                >
                                    {isSearchingAddress ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <i className="fa-solid fa-search"></i>}
                                </button>
                            </div>

                            <div ref={mapContainerRef} className="w-full h-80 bg-gray-200 dark:bg-zinc-700 rounded-lg z-0 mb-4"></div>
                            
                            {location && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                                    <div className="sm:col-span-1">
                                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">{t('editBusiness.latitude')}</label>
                                        <input type="text" readOnly value={location.lat.toFixed(6)} className="w-full p-2 border bg-gray-100 dark:bg-zinc-700 border-gray-300 dark:border-zinc-600 rounded-lg text-sm" />
                                    </div>
                                    <div className="sm:col-span-1">
                                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">{t('editBusiness.longitude')}</label>
                                        <input type="text" readOnly value={location.lng.toFixed(6)} className="w-full p-2 border bg-gray-100 dark:bg-zinc-700 border-gray-300 dark:border-zinc-600 rounded-lg text-sm" />
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
                                <label htmlFor="contact_email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('editBusiness.publicContactEmail')}</label>
                                <input id="contact_email" type="email" value={formData.contact_email} onChange={handleInputChange} placeholder={t('editBusiness.publicContactEmailPlaceholder')} className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-gray-50 dark:bg-zinc-700 dark:text-gray-200"/>
                            </div>
                            <div>
                                <label htmlFor="contact_phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('editBusiness.publicContactPhone')}</label>
                                <input id="contact_phone" type="tel" value={formData.contact_phone} onChange={handleInputChange} placeholder={t('editBusiness.publicContactPhonePlaceholder')} className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-gray-50 dark:bg-zinc-700 dark:text-gray-200"/>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="twitter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('editBusiness.twitter')}</label>
                                <input id="twitter" type="text" value={formData.twitter} onChange={handleInputChange} placeholder={t('editBusiness.twitterPlaceholder')} className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-gray-50 dark:bg-zinc-700 dark:text-gray-200"/>
                            </div>
                            <div>
                                <label htmlFor="instagram" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('editBusiness.instagram')}</label>
                                <input id="instagram" type="text" value={formData.instagram} onChange={handleInputChange} placeholder={t('editBusiness.instagramPlaceholder')} className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-gray-50 dark:bg-zinc-700 dark:text-gray-200"/>
                            </div>
                        </div>
                        
                        <div>
                            <label className="block text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">{t('editBusiness.openingHours')}</label>
                            <div className="p-4 border dark:border-zinc-700 rounded-xl bg-gray-50 dark:bg-zinc-900 shadow-sm">
                                <div className="grid grid-cols-[1fr,2fr] items-center gap-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase px-1 pb-2 border-b dark:border-zinc-700 mb-2">
                                    <span>{t('editBusiness.day')}</span>
                                    <div className="grid grid-cols-2 gap-2">
                                        <span className="text-center">{t('editBusiness.opens')}</span>
                                        <span className="text-center">{t('editBusiness.closes')}</span>
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
                            <button type="button" onClick={() => navigate(`/empresa/panel/${encodeURIComponent(business.name.replace(/ /g, '_'))}`)} className="text-sm font-semibold text-gray-600 dark:text-gray-300 hover:underline">
                                {t('common.cancel')}
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-brand-green text-white font-bold py-2 px-6 rounded-lg hover:bg-opacity-90 transition-colors shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading && <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                                <span>{loading ? t('common.saving') : t('common.save')}</span>
                            </button>
                        </div>
                    </form>
                </div>
            </FeatureLock>
        </>
    );
};

export default EditBusinessPage;