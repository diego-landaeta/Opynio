import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { upgradeUserToBusinessOwner, supabase, getUserProfile, getBusinessesForOwner } from '../../services/supabaseService';
import { CATEGORIES, COUNTRIES } from '../../constants';
import { useNotification } from '../../contexts/NotificationContext';
import { useCountry } from '../../contexts/CountryContext';
import Meta from '../Meta';
import Modal from '../Modal';
import L from 'leaflet';
import type { Plan } from '../../types';
import { useI18n, pathTranslations, useTranslation, getLanguageForCountryCode } from '../../contexts/i18nContext';

const AssignBusinessPage: React.FC = () => {
    const [searchParams] = ReactRouterDOM.useSearchParams();
    const navigate = ReactRouterDOM.useNavigate();
    const { user, businesses, profile, setProfile, setBusinesses } = useAuth();
    const { showNotification } = useNotification();
    const { language } = useI18n();
    const { country } = useCountry();
    const t = useTranslation();

    // Use country directly - don't infer from language
    const countryPrefix = country ? `/${country.toLowerCase()}` : '';
    const pathLang = country ? getLanguageForCountryCode(country) : language;
    const paths = pathTranslations[pathLang] || pathTranslations.es;

    const [plan, setPlan] = useState<string | null>(null);
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [formData, setFormData] = useState({ name: '', logo_url: '', google_maps_url: '', category: '', description: '', country: 'ES' });
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [addressSearch, setAddressSearch] = useState('');
    const [isSearchingAddress, setIsSearchingAddress] = useState(false);

    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<L.Map | null>(null);
    const markerRef = useRef<L.Marker | null>(null);

    // Flag que evita que el guard "free + ya tiene negocio" se redispare cuando
    // `businesses` se actualiza tras una creación exitosa (race condition).
    const hasJustCreatedRef = useRef(false);

    useEffect(() => {
        const planParam = searchParams.get('plan');
        if (planParam) {
            setPlan(planParam);
        }
        // billingCycle viene de PricingPage por query string. Default mensual.
        const cycleParam = searchParams.get('billingCycle');
        if (cycleParam === 'annual' || cycleParam === 'monthly') {
            setBillingCycle(cycleParam);
        }
    }, [searchParams]);

    useEffect(() => {
        // No redirigir si acabamos de crear el negocio en esta misma sesión:
        // `businesses.length` pasa de 0 a 1 y el effect se redispara antes de que
        // navegamos a /mis-negocios → falsa alarma "ya tienes 1 negocio gratis".
        if (hasJustCreatedRef.current) return;
        if (isSubmitting) return;

        const isFreePlanUser = profile?.plan === 'free';
        const urlPlan = searchParams.get('plan');

        // Redirect if a free user with a business tries to get another free business
        if (urlPlan === 'free' && isFreePlanUser && businesses.length > 0) {
            showNotification(t('assignBusiness.freePlanLimitError'), 'error');
            navigate('/planes', { replace: true });
        }
    }, [profile, businesses, searchParams, showNotification, navigate, isSubmitting, t]);
    
    useEffect(() => {
        if (mapContainerRef.current && !mapRef.current) {
            mapRef.current = L.map(mapContainerRef.current, { center: [40.416775, -3.703790], zoom: 5 });
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

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

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
                showNotification(t('assignBusiness.addressNotFound'), 'error');
            }
        } catch (error) {
            showNotification(t('assignBusiness.addressSearchError'), 'error');
        } finally {
            setIsSearchingAddress(false);
        }
    };
    
    const handleCreateBusiness = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !plan) return;

        setIsSubmitting(true);
        try {
            // For free and enterprise plans we create the business immediately — no payment.
            if (plan === 'free' || plan === 'enterprise') {
                await upgradeUserToBusinessOwner({
                    businessName: formData.name,
                    category: formData.category,
                    plan: plan,
                    country: formData.country,
                    description: formData.description,
                    logo_url: formData.logo_url,
                    google_maps_url: formData.google_maps_url,
                    latitude: location?.lat,
                    longitude: location?.lng,
                });

                // Marca antes de actualizar el contexto para que el useEffect de guard
                // ignore el cambio de `businesses` que viene a continuación.
                hasJustCreatedRef.current = true;
                showNotification(t('assignBusiness.businessCreatedSuccess'), 'success');
                if (user) {
                    const [updatedProfile, newBusinesses] = await Promise.all([
                        getUserProfile(user),
                        getBusinessesForOwner(user.id),
                    ]);
                    if (updatedProfile) setProfile(updatedProfile);
                    if (newBusinesses) setBusinesses(newBusinesses);
                }
                const myBusinessesPath = `${countryPrefix}/${paths.myBusinesses}`;
                navigate(myBusinessesPath, { replace: true });
                return;
            }

            // For paid plans we DO NOT create the business yet. The data travels with
            // the Stripe checkout session metadata; the webhook creates the business
            // only when payment is confirmed. If the user cancels checkout, no business
            // is ever persisted.
            showNotification(t('assignBusiness.businessCreatedRedirecting'), 'info');
            const { data, error: sessionError } = await supabase.functions.invoke('create-checkout-session', {
                body: {
                    plan,
                    billingCycle,
                    businessData: {
                        name: formData.name,
                        category: formData.category,
                        country: formData.country,
                        description: formData.description || undefined,
                        logo_url: formData.logo_url || undefined,
                        google_maps_url: formData.google_maps_url || undefined,
                        latitude: location?.lat ?? undefined,
                        longitude: location?.lng ?? undefined,
                    },
                },
            });
            if (sessionError) throw sessionError;

            if (data?.url) {
                window.location.href = data.url;
            } else {
                throw new Error(t('assignBusiness.noPaymentUrlError'));
            }
        } catch (error: any) {
            showNotification(error.message || t('assignBusiness.errorCreatingBusiness'), 'error');
            setIsSubmitting(false);
        }
    };
    
    return (
        <>
            <Meta title={t('assignBusiness.metaTitle')} description={t('assignBusiness.metaDescription')} />
            <div className="max-w-3xl mx-auto bg-white dark:bg-zinc-800 p-8 rounded-xl shadow-lg mt-8">
                <h1 className="text-3xl font-bold mb-2 text-brand-dark dark:text-gray-100">{t('assignBusiness.title')}</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-8">
                    {t('assignBusiness.subtitle')} <strong className="capitalize font-semibold">{plan || '...'}</strong>.
                </p>
                <form onSubmit={handleCreateBusiness} className="space-y-6">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('assignBusiness.businessNameRequired')}</label>
                        <input id="name" name="name" type="text" value={formData.name} onChange={handleInputChange} required className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg bg-transparent text-gray-900 dark:text-gray-100"/>
                    </div>
                    <div>
                        <label htmlFor="country" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('assignBusiness.countryRequired')}</label>
                        <select id="country" name="country" value={formData.country} onChange={handleInputChange} required className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-200">
                             {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('assignBusiness.categoryRequired')}</label>
                        <select id="category" name="category" value={formData.category} onChange={handleInputChange} required className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-200">
                            <option value="" disabled>{t('assignBusiness.selectCategory')}</option>
                            {Object.entries(CATEGORIES).map(([main, subs]) => (
                                <optgroup key={main} label={t(`categories.${main}`)}>{subs.map(s => <option key={s} value={`${main}:${s}`}>{t(`subcategories.${s}`)}</option>)}</optgroup>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('assignBusiness.descriptionBrief')}</label>
                        <textarea id="description" name="description" value={formData.description} onChange={handleInputChange} rows={3} className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg bg-transparent text-gray-900 dark:text-gray-100"/>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="logo_url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('assignBusiness.logoUrl')}</label>
                            <input id="logo_url" name="logo_url" type="url" value={formData.logo_url} onChange={handleInputChange} placeholder={t('assignBusiness.logoUrlPlaceholder')} className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg bg-transparent text-gray-900 dark:text-gray-100"/>
                        </div>
                        <div>
                            <label htmlFor="google_maps_url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('assignBusiness.googleMapsUrl')}</label>
                            <input id="google_maps_url" name="google_maps_url" type="url" value={formData.google_maps_url} onChange={handleInputChange} placeholder={t('assignBusiness.googleMapsUrlPlaceholder')} className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg bg-transparent text-gray-900 dark:text-gray-100"/>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">{t('assignBusiness.locationOptional')}</h3>
                        <form onSubmit={handleAddressSearch} className="flex items-center gap-2 mb-4">
                            <input type="text" value={addressSearch} onChange={(e) => setAddressSearch(e.target.value)} placeholder={t('assignBusiness.addressPlaceholder')} className="flex-grow p-3 border border-gray-300 dark:border-zinc-600 rounded-lg bg-transparent text-gray-900 dark:text-gray-100"/>
                            <button type="submit" disabled={isSearchingAddress} className="bg-brand-dark text-white font-semibold px-4 py-3 rounded-lg w-16 h-[48px] flex items-center justify-center">
                                {isSearchingAddress ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <i className="fa-solid fa-search"></i>}
                            </button>
                        </form>
                        <div ref={mapContainerRef} className="w-full h-64 bg-gray-200 dark:bg-zinc-700 rounded-lg z-0"></div>
                    </div>

                    <div className="pt-4 flex items-center justify-end gap-4 border-t dark:border-zinc-700">
                        <ReactRouterDOM.Link to={`${countryPrefix}/${paths.myBusinesses}`} className="text-sm font-semibold text-gray-600 dark:text-gray-300 hover:underline">{t('assignBusiness.cancel')}</ReactRouterDOM.Link>
                        <button type="submit" disabled={isSubmitting} className="bg-brand-green text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-400 flex items-center justify-center gap-2">
                            {isSubmitting && <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                            <span>{isSubmitting ? t('assignBusiness.processing') : (plan === 'free' || plan === 'enterprise' ? t('assignBusiness.createBusiness') : t('assignBusiness.continueToPayment'))}</span>
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
};

export default AssignBusinessPage;
