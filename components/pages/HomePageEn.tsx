











import React, { useState, useEffect, useMemo, useCallback } from 'react';
// FIX: Changed react-router-dom namespace import to named imports to resolve module resolution issues.
import { Link, useNavigate } from 'react-router-dom';
import type { Review, Business, HomepageBusiness } from '../../types';
import { getLatestBusinesses, getFeaturedReviews, getFeaturedCompanies, getBusinessIdAndNameList, adminSetFeaturedCompanies } from '../../services/supabaseService';
import Spinner from '../Spinner';
import ReviewCard from '../ReviewCard';
import StarRating from '../StarRating';
import Meta from '../Meta';
import { updates as allUpdates } from './WhatsNewPage';
import { useAuth } from '../../contexts/AuthContext';
// FIX: Corrected import from `useNotificationContext` to `useNotification` to match the actual export.
import { useNotification } from '../../contexts/NotificationContext';
import Modal from '../Modal';
import { useTranslation, useI18n, pathTranslations } from '../../contexts/i18nContext';
import { HOMEPAGE_CATEGORIES } from '../../constants';
import { extractSubcategory } from '../../utils/categoryMappings';

const FeaturedBusinessSlider: React.FC<{ companies: Business[], loading: boolean }> = ({ companies, loading }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const t = useTranslation();
    const { language } = useI18n();

    const goToPrevious = () => {
        const isFirstSlide = currentIndex === 0;
        const newIndex = isFirstSlide ? companies.length - 1 : currentIndex - 1;
        setCurrentIndex(newIndex);
    };

    const goToNext = useCallback(() => {
        if (companies.length > 1) {
            const isLastSlide = currentIndex === companies.length - 1;
            const newIndex = isLastSlide ? 0 : currentIndex + 1;
            setCurrentIndex(newIndex);
        }
    }, [currentIndex, companies]);

    const goToSlide = (slideIndex: number) => {
        setCurrentIndex(slideIndex);
    };

    useEffect(() => {
        if (companies.length > 1) {
            const sliderInterval = setInterval(goToNext, 7000); // Change slide every 7 seconds
            return () => clearInterval(sliderInterval);
        }
    }, [goToNext, companies.length]);

    if (loading) {
         return (
            <div className="h-[400px] w-full relative rounded-xl bg-gray-200 dark:bg-zinc-800 animate-pulse flex items-center justify-center">
                <Spinner />
            </div>
        );
    }

    if (!companies || companies.length === 0) {
        return null;
    }

    const currentCompany = companies[currentIndex];
    const bgImageUrl = "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2071&auto=format&fit=crop";

    return (
        <div className="h-[400px] w-full relative rounded-xl overflow-hidden shadow-lg bg-brand-dark">
            <div
                style={{ backgroundImage: `url(${bgImageUrl})` }}
                className="w-full h-full bg-center bg-cover"
            >
                <div className="absolute inset-0 bg-black/60 flex items-center">
                    <div className="container mx-auto px-4 md:px-12 text-white">
                        <p className="font-bold text-sm uppercase tracking-widest text-brand-green mb-2">{t('homepage.featuredBusinessBanner')}</p>
                        <h2 className="text-4xl md:text-5xl font-extrabold mb-3">{currentCompany.name}</h2>
                        <div className="flex items-center gap-3 mb-3">
                            <StarRating rating={currentCompany.avg_rating || 0} size="large" />
                            <span className="text-xl font-bold">{(currentCompany.avg_rating || 0).toFixed(1)} {t('homepage.stars')}</span>
                        </div>
                        <p className="text-lg text-gray-200 mb-6">{t('homepage.categoryLabel')} {extractSubcategory(currentCompany.category)}</p>
                        <Link
                            to={`/${language}/${pathTranslations[language].business.replace(':identifier', encodeURIComponent(currentCompany.name.replace(/ /g, '_')))}`}
                            className="inline-block bg-brand-green text-white font-bold px-8 py-3 rounded-md hover:bg-opacity-90 transition-all shadow-md text-lg"
                        >
                            {t('homepage.viewProfileAndReviews')}
                        </Link>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            {companies.length > 1 && (
                <>
                    <button onClick={goToPrevious} className="absolute top-1/2 left-4 -translate-y-1/2 bg-black/30 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-black/50 transition-colors z-10" aria-label="Anterior">
                        <i className="fa-solid fa-chevron-left text-xl"></i>
                    </button>
                    <button onClick={goToNext} className="absolute top-1/2 right-4 -translate-y-1/2 bg-black/30 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-black/50 transition-colors z-10" aria-label="Siguiente">
                        <i className="fa-solid fa-chevron-right text-xl"></i>
                    </button>
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                        {companies.map((_, slideIndex) => (
                            <button
                                key={slideIndex}
                                onClick={() => goToSlide(slideIndex)}
                                className={`w-3 h-3 rounded-full cursor-pointer transition-all ${currentIndex === slideIndex ? 'bg-white' : 'bg-white/50'}`}
                                aria-label={`Ir a la diapositiva ${slideIndex + 1}`}
                            ></button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};


const HomePageEn: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();
    const [latestBusinesses, setLatestBusinesses] = useState<HomepageBusiness[]>([]);
    const [featuredReviews, setFeaturedReviews] = useState<Review[]>([]);
    const [loadingBusinesses, setLoadingBusinesses] = useState(true);
    const [loadingReviews, setLoadingReviews] = useState(true);
    const [featuredCompanies, setFeaturedCompanies] = useState<Business[]>([]);
    const [loadingFeatured, setLoadingFeatured] = useState(true);
    
    const { profile } = useAuth();
    // FIX: Changed useNotificationContext to useNotification.
    const { showNotification } = useNotification();
    const [isFeaturedModalOpen, setIsFeaturedModalOpen] = useState(false);
    const [modalBusinessResults, setModalBusinessResults] = useState<{ id: string, name: string }[]>([]);
    const [isSearchingModalBusinesses, setIsSearchingModalBusinesses] = useState(false);
    const [selectedFeaturedIds, setSelectedFeaturedIds] = useState<Set<string>>(new Set());
    const [modalSearchTerm, setModalSearchTerm] = useState('');
    const [isSavingFeatured, setIsSavingFeatured] = useState(false);
    
    const t = useTranslation();
    const { language } = useI18n();

    const latestUpdate = allUpdates[0];
    const featuresToShow = latestUpdate.features.slice(0, 3); // Max 3 features on homepage


    useEffect(() => {
        const fetchData = async () => {
            setLoadingBusinesses(true);
            setLoadingReviews(true);
            setLoadingFeatured(true);
            try {
                const [businesses, reviews, featured] = await Promise.all([
                    getLatestBusinesses(5),
                    getFeaturedReviews(),
                    getFeaturedCompanies()
                ]);
                setLatestBusinesses(businesses);
                setFeaturedReviews(reviews.slice(0, 3)); // Show 3 featured reviews
                setFeaturedCompanies(featured);
            } catch (error) {
                console.error("Failed to fetch homepage data:", error);
            } finally {
                setLoadingBusinesses(false);
                setLoadingReviews(false);
                setLoadingFeatured(false);
            }
        };
        fetchData();
    }, []);
    
    // Effect for searching businesses in the modal
    useEffect(() => {
        if (!isFeaturedModalOpen) return;
    
        const handler = setTimeout(async () => {
            setIsSearchingModalBusinesses(true);
            try {
                const results = await getBusinessIdAndNameList(modalSearchTerm);
                setModalBusinessResults(results);
            } catch (error) {
                console.error("Failed to search businesses for modal:", error);
                showNotification(t('homepage.errorSearchingBusinesses'), 'error');
            } finally {
                setIsSearchingModalBusinesses(false);
            }
        }, 300); // 300ms debounce
    
        return () => clearTimeout(handler);
    }, [modalSearchTerm, isFeaturedModalOpen, showNotification, t]);

    const handleOpenFeaturedModal = async () => {
        setIsFeaturedModalOpen(true);
        setModalSearchTerm('');
        setSelectedFeaturedIds(new Set(featuredCompanies.map(c => c.id)));
        setIsSearchingModalBusinesses(true);
        try {
            const businesses = await getBusinessIdAndNameList();
            setModalBusinessResults(businesses);
        } catch (error) {
            console.error("Failed to fetch businesses for modal:", error);
            showNotification(t('homepage.errorLoadingBusinesses'), 'error');
        } finally {
            setIsSearchingModalBusinesses(false);
        }
    };
    
    const handleFeaturedSelectionChange = (businessId: string) => {
        setSelectedFeaturedIds(prev => {
            const newSet = new Set<string>(prev);
            if (newSet.has(businessId)) {
                newSet.delete(businessId);
            } else {
                if (newSet.size < 5) {
                    newSet.add(businessId);
                } else {
                    showNotification(t('homepage.maxFeaturedWarning'), 'info');
                }
            }
            return newSet;
        });
    };
    
    const handleSaveFeatured = async () => {
        setIsSavingFeatured(true);
        try {
            await adminSetFeaturedCompanies(Array.from(selectedFeaturedIds));
            showNotification(t('homepage.featuredCompaniesUpdated'), 'success');
            const newFeatured = await getFeaturedCompanies();
            setFeaturedCompanies(newFeatured);
            setIsFeaturedModalOpen(false);
        } catch (error) {
            console.error("Failed to save featured companies:", error);
            showNotification(t('homepage.errorSavingFeatured'), 'error');
        } finally {
            setIsSavingFeatured(false);
        }
    };

    const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (searchTerm.trim()) {
            navigate(`/${language}/${pathTranslations[language].search}?q=${encodeURIComponent(searchTerm.trim())}`);
        }
    };

    const formatDate = useCallback((dateString: string) => {
        return new Date(dateString).toLocaleDateString(language === 'en' ? 'en-US' : 'es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }, [language]);

    return (
        <>
            <Meta 
                title="Opynio England - Authentic & Trustworthy Reviews"
                description="Discover, read, and write reviews to make better decisions in England."
            />
            <div className="space-y-20 md:space-y-28 -mt-8">
                {/* Hero Section */}
                <section className="text-center pt-8">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-brand-dark dark:text-gray-100 leading-tight md:leading-snug">
                        Authentic reviews on Opynio England<br />to find trustworthy businesses
                    </h1>
                    <p className="text-lg text-gray-600 dark:text-gray-400 mt-4 mb-6 max-w-2xl mx-auto">
                        {t('homepage.heroSubtitle')}
                    </p>
                    <form onSubmit={handleSearchSubmit} className="max-w-xl mx-auto flex items-center shadow-md rounded-lg bg-white dark:bg-zinc-800 border dark:border-zinc-700">
                        <input
                            type="search"
                            placeholder={t('homepage.searchPlaceholder')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full text-base p-3 border-r border-gray-200 dark:border-zinc-600 rounded-l-lg focus:ring-2 focus:ring-brand-green focus:outline-none pl-4 bg-transparent"
                            aria-label={t('homepage.searchPlaceholder')}
                        />
                        <button type="submit" className="bg-brand-green text-white p-3 rounded-r-lg hover:bg-opacity-90 text-xl h-full px-5 transition-colors" aria-label="Buscar">
                            <i className="fas fa-search"></i>
                        </button>
                    </form>
                    <p className="mt-4 text-sm text-gray-700 dark:text-gray-300">
                        {t('homepage.haveYouBought')}{' '}
                        <Link to={`/${language}/${pathTranslations[language].writeReview}`} className="text-brand-green font-semibold hover:underline">
                            {t('homepage.writeAReviewLink')}
                        </Link>
                    </p>
                </section>
                
                {/* Categories Section */}
                <section>
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{t('homepage.exploreCategoriesTitle')}</h2>
                        <Link to={`/${language}/${pathTranslations[language].explore}`} className="text-brand-green font-semibold hover:underline">
                            {t('homepage.seeMore')}
                        </Link>
                    </div>
                     <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                        {HOMEPAGE_CATEGORIES.map(({ key, icon }) => (
                            <Link
                                key={key}
                                to={`/${language}/${pathTranslations[language].explore}`}
                                className="bg-white dark:bg-zinc-800/50 p-4 rounded-xl flex flex-col items-center justify-center text-center space-y-3 hover:bg-gray-50 dark:hover:bg-zinc-700/60 transition-colors border border-gray-200 dark:border-zinc-800"
                            >
                                <i className={`fa-solid ${icon} text-3xl text-brand-green`}></i>
                                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t(`homepage.${key}`)}</span>
                            </Link>
                        ))}
                    </div>
                </section>

                {/* Stats Section */}
                <section className="bg-brand-dark text-white rounded-xl p-8 space-y-6">
                    <div className="grid md:grid-cols-3 gap-8 text-center">
                        <div>
                            <p className="text-4xl font-bold">{t('homepage.stat1Title')}</p>
                            <p className="text-gray-300 text-sm">{t('homepage.stat1Desc')}</p>
                        </div>
                        <div>
                            <p className="text-4xl font-bold">{t('homepage.stat2Title')}</p>
                            <p className="text-gray-300 text-sm">{t('homepage.stat2Desc')}</p>
                        </div>
                        <div>
                            <p className="text-4xl font-bold">{t('homepage.stat3Title')}</p>
                            <p className="text-gray-300 text-sm">{t('homepage.stat3Desc')}</p>
                        </div>
                    </div>
                    <div className="border-t border-gray-600 dark:border-zinc-700 pt-6 flex items-center justify-center gap-4">
                        <div className="text-3xl text-gray-300"><i className="fab fa-google"></i></div>
                        <div>
                            <p className="font-bold">{t('homepage.googleIntegrationTitle')}</p>
                            <p className="text-sm text-gray-400">{t('homepage.googleIntegrationSubtitle')}</p>
                        </div>
                    </div>
                </section>
                
                {/* Trust & Transparency Section */}
                <section className="bg-green-50/50 dark:bg-green-900/20 p-8 rounded-xl border border-green-100 dark:border-green-800/30">
                    <div className="grid md:grid-cols-2 gap-8 items-center">
                        <div className="text-center md:text-left">
                            <div className="bg-white dark:bg-zinc-800 text-brand-green rounded-full w-20 h-20 inline-flex items-center justify-center shadow-sm border border-gray-100 dark:border-zinc-700 mb-4">
                                <i className="fa-solid fa-shield-halved text-5xl"></i>
                            </div>
                            <h2 className="text-3xl font-bold dark:text-gray-100">{t('homepage.trustTitle')}</h2>
                            <p className="text-gray-600 dark:text-gray-400 mt-2">{t('homepage.trustSubtitle')}</p>
                        </div>
                        <div>
                            <ul className="space-y-4">
                                <li className="flex items-start gap-4">
                                    <div className="bg-white dark:bg-zinc-800 text-brand-green rounded-full w-10 h-10 flex-shrink-0 flex items-center justify-center shadow-sm border border-gray-100 dark:border-zinc-700 mt-1">
                                        <i className="fa-solid fa-user-check text-lg"></i>
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-800 dark:text-gray-200">{t('homepage.trustFeature1Title')}</h3>
                                        <p className="text-gray-600 dark:text-gray-400 text-sm">{t('homepage.trustFeature1Desc')}</p>
                                    </div>
                                </li>
                                <li className="flex items-start gap-4">
                                    <div className="bg-white dark:bg-zinc-800 text-brand-green rounded-full w-10 h-10 flex-shrink-0 flex items-center justify-center shadow-sm border border-gray-100 dark:border-zinc-700 mt-1">
                                        <i className="fa-solid fa-robot text-lg"></i>
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-800 dark:text-gray-200">{t('homepage.trustFeature2Title')}</h3>
                                        <p className="text-gray-600 dark:text-gray-400 text-sm">{t('homepage.trustFeature2Desc')}</p>
                                    </div>
                                </li>
                                <li className="flex items-start gap-4">
                                    <div className="bg-white dark:bg-zinc-800 text-brand-green rounded-full w-10 h-10 flex-shrink-0 flex items-center justify-center shadow-sm border border-gray-100 dark:border-zinc-700 mt-1">
                                        <i className="fa-solid fa-gavel text-lg"></i>
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-800 dark:text-gray-200">{t('homepage.trustFeature3Title')}</h3>
                                        <p className="text-gray-600 dark:text-gray-400 text-sm">{t('homepage.trustFeature3Desc')}</p>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* For Businesses Section */}
                <section className="bg-white dark:bg-zinc-800 p-8 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-700">
                    <div className="grid md:grid-cols-2 gap-8 items-center">
                        <div>
                            <p className="font-bold text-brand-green mb-2">{t('homepage.forBusinessesSection')}</p>
                            <h2 className="text-3xl font-bold dark:text-gray-100">{t('homepage.forBusinessesTitle')}</h2>
                            <p className="text-gray-600 dark:text-gray-400 mt-4 mb-6">{t('homepage.forBusinessesSubtitle')}</p>
                            <ul className="space-y-3 dark:text-gray-300">
                                <li className="flex items-start gap-3"><i className="fa-solid fa-check-circle text-brand-green mt-1"></i><span dangerouslySetInnerHTML={{__html: t('homepage.forBusinessesFeature1')}} /></li>
                                <li className="flex items-start gap-3"><i className="fa-solid fa-check-circle text-brand-green mt-1"></i><span dangerouslySetInnerHTML={{__html: t('homepage.forBusinessesFeature2')}} /></li>
                                <li className="flex items-start gap-3"><i className="fa-solid fa-check-circle text-brand-green mt-1"></i><span dangerouslySetInnerHTML={{__html: t('homepage.forBusinessesFeature3')}} /></li>
                            </ul>
                            <Link to={`/${language}/registro?type=business`} className="mt-8 inline-block bg-brand-green text-white font-semibold px-6 py-3 rounded-md hover:bg-opacity-90 transition-all shadow-sm">
                                {t('homepage.registerBusinessFree')}
                            </Link>
                        </div>
                        <div>
                            <img src="https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=1932&auto=format&fit=crop" alt="Team working in an office" width={1932} height={1288} loading="lazy" decoding="async" className="rounded-lg object-cover w-full h-full max-h-80" />
                        </div>
                    </div>
                </section>
                
                {/* What's New Section */}
                <section className="bg-gray-50 dark:bg-zinc-800/50 p-8 rounded-xl border border-gray-200 dark:border-zinc-700/50">
                    <div className="text-center max-w-2xl mx-auto">
                        <span className="text-sm font-bold text-gray-500 dark:text-gray-400">{t(latestUpdate.dateKey)}</span>
                        <h2 className="text-3xl font-bold text-brand-dark dark:text-gray-100 mt-1">{t(latestUpdate.titleKey)}</h2>
                        <p className="text-gray-600 dark:text-gray-400 mt-2">{t('homepage.whatsNewSubtitle')}</p>
                    </div>
                    <div className={`grid grid-cols-1 gap-8 max-w-6xl mx-auto mt-12 ${featuresToShow.length === 1 ? 'max-w-lg' : featuresToShow.length === 2 ? 'sm:grid-cols-2 max-w-4xl' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
                        {featuresToShow.map((feature) => (
                            <div key={feature.titleKey} className="bg-white dark:bg-zinc-800 p-6 rounded-lg shadow-sm border dark:border-zinc-700 text-left transition-transform hover:-translate-y-1">
                                <div className={`${feature.color} text-3xl mb-3`}>
                                    <i className={feature.icon}></i>
                                </div>
                                <h3 className="text-lg font-bold mb-2 dark:text-gray-200">{t(feature.titleKey)}</h3>
                                <p className="text-gray-600 dark:text-gray-400 text-sm">{t(feature.descriptionKey)}</p>
                            </div>
                        ))}
                    </div>
                    <div className="text-center mt-12">
                        <Link to={`/${language}/${pathTranslations[language].whatsNew}`} className="inline-block bg-brand-dark dark:bg-gray-200 text-white dark:text-brand-dark font-semibold px-6 py-3 rounded-md hover:bg-gray-800 dark:hover:bg-white transition-all shadow-sm">
                            {t('homepage.discoverAllWhatsNew')}
                        </Link>
                    </div>
                </section>
                
                {/* Pricing Plans Section */}
                <section className="relative bg-zinc-900 text-white p-8 md:p-12 rounded-2xl overflow-hidden border border-zinc-700 shadow-lg shadow-brand-green/10">
                    <div 
                        className="absolute inset-0 w-full h-full" 
                        style={{ backgroundImage: `radial-gradient(circle at top right, rgba(0, 182, 122, 0.15) 0%, transparent 50%), radial-gradient(circle at bottom left, rgba(30, 64, 175, 0.15) 0%, transparent 50%)`}}
                    ></div>
                    <div className="relative z-10 grid md:grid-cols-2 gap-8 md:gap-12 items-center">
                        <div className="space-y-4">
                            <h2 className="text-3xl font-bold">{t('homepage.pricingTitle')}</h2>
                            <p className="text-gray-300">{t('homepage.pricingSubtitle')}</p>
                            <ul className="space-y-3 pt-2 text-gray-300">
                                <li className="flex items-start gap-3"><i className="fa-solid fa-check-circle text-brand-green mt-1"></i><span dangerouslySetInnerHTML={{__html: t('homepage.pricingFeature1')}} /></li>
                                <li className="flex items-start gap-3"><i className="fa-solid fa-check-circle text-brand-green mt-1"></i><span dangerouslySetInnerHTML={{__html: t('homepage.pricingFeature2')}} /></li>
                                <li className="flex items-start gap-3"><i className="fa-solid fa-check-circle text-brand-green mt-1"></i><span dangerouslySetInnerHTML={{__html: t('homepage.pricingFeature3')}} /></li>
                            </ul>
                        </div>
                        <div className="bg-zinc-800/50 p-8 rounded-lg border border-zinc-700 text-center">
                            <h2 className="text-3xl font-bold mb-3">{t('homepage.pricingBoxTitle')}</h2>
                            <p className="text-gray-300 mb-6 max-w-xl mx-auto">{t('homepage.pricingBoxSubtitle')}</p>
                            <Link 
                                to={`/${language}/${pathTranslations[language].pricing}`}
                                className="inline-block bg-brand-green text-white font-bold px-8 py-3 rounded-md hover:bg-opacity-90 transition-all shadow-lg shadow-brand-green/30 text-lg"
                            >
                                {t('homepage.viewPlansAndPricing')}
                            </Link>
                        </div>
                    </div>
                </section>

                {/* Featured Business Slider Section */}
                <section>
                    {profile?.role === 'admin' && (
                        <div className="flex justify-end mb-4">
                            <button
                                onClick={handleOpenFeaturedModal}
                                className="bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-300 font-semibold px-4 py-2 rounded-md hover:bg-gray-200 dark:hover:bg-zinc-600 transition-all text-sm flex items-center gap-2"
                            >
                                <i className="fa-solid fa-pencil"></i>
                                <span>{t('homepage.manageFeatured')}</span>
                            </button>
                        </div>
                    )}
                    <FeaturedBusinessSlider companies={featuredCompanies} loading={loadingFeatured} />
                </section>
                
                {/* Latest Businesses Section */}
                <section>
                    <h2 className="text-2xl font-bold text-center mb-8 dark:text-gray-100">{t('homepage.latestBusinessesTitle')}</h2>
                    {loadingBusinesses ? (
                        <div className="flex justify-center"><Spinner /></div>
                    ) : latestBusinesses.length > 0 ? (
                        <div className="max-w-2xl mx-auto bg-white dark:bg-zinc-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-700">
                            <ul className="divide-y divide-gray-200 dark:divide-zinc-700">
                                {latestBusinesses.map(biz => (
                                    <li key={biz.id} className="py-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                                        <div>
                                            <Link to={`/${language}/${pathTranslations[language].business.replace(':identifier', encodeURIComponent(biz.name.replace(/ /g, '_')))}`} className="font-semibold text-lg text-brand-dark dark:text-gray-200 hover:text-brand-green dark:hover:text-brand-green hover:underline">
                                                {biz.name}
                                            </Link>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                                {t('homepage.addedOn')} {formatDate(biz.created_at)}
                                            </p>
                                        </div>
                                        <Link to={`/${language}/${pathTranslations[language].business.replace(':identifier', encodeURIComponent(biz.name.replace(/ /g, '_')))}`} className="text-brand-green font-semibold hover:text-green-700 dark:hover:text-green-400 text-sm flex items-center gap-2 self-end sm:self-center">
                                            <span>{t('homepage.viewBusiness')}</span>
                                            <i className="fa-solid fa-arrow-right"></i>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : (
                        <p className="text-center text-gray-500 dark:text-gray-400">{t('homepage.noNewBusinesses')}</p>
                    )}
                </section>
                
                {/* How it works */}
                <section>
                    <div className="text-center max-w-2xl mx-auto">
                        <h2 className="text-3xl font-bold dark:text-gray-100">{t('homepage.howItWorksTitle')}</h2>
                        <p className="text-gray-600 dark:text-gray-400 mt-2">{t('homepage.howItWorksSubtitle')}</p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mt-12">
                        <div className="bg-white dark:bg-zinc-800 p-8 rounded-xl shadow-md border dark:border-zinc-700 text-center hover:shadow-xl hover:-translate-y-2 transition-all duration-300">
                            <div className="bg-green-100 dark:bg-green-900/50 text-brand-green rounded-full w-20 h-20 flex items-center justify-center mb-4 mx-auto"><i className="fas fa-search text-3xl"></i></div>
                            <h3 className="text-xl font-bold mb-2 dark:text-gray-200">{t('homepage.howItWorksStep1Title')}</h3>
                            <p className="text-gray-600 dark:text-gray-400">{t('homepage.howItWorksStep1Desc')}</p>
                        </div>
                         <div className="bg-white dark:bg-zinc-800 p-8 rounded-xl shadow-md border dark:border-zinc-700 text-center hover:shadow-xl hover:-translate-y-2 transition-all duration-300">
                            <div className="bg-green-100 dark:bg-green-900/50 text-brand-green rounded-full w-20 h-20 flex items-center justify-center mb-4 mx-auto"><i className="fas fa-comments text-3xl"></i></div>
                            <h3 className="text-xl font-bold mb-2 dark:text-gray-200">{t('homepage.howItWorksStep2Title')}</h3>
                            <p className="text-gray-600 dark:text-gray-400">{t('homepage.howItWorksStep2Desc')}</p>
                        </div>
                         <div className="bg-white dark:bg-zinc-800 p-8 rounded-xl shadow-md border dark:border-zinc-700 text-center hover:shadow-xl hover:-translate-y-2 transition-all duration-300">
                            <div className="bg-green-100 dark:bg-green-900/50 text-brand-green rounded-full w-20 h-20 flex items-center justify-center mb-4 mx-auto"><i className="fas fa-pencil-alt text-3xl"></i></div>
                            <h3 className="text-xl font-bold mb-2 dark:text-gray-200">{t('homepage.howItWorksStep3Title')}</h3>
                            <p className="text-gray-600 dark:text-gray-400">{t('homepage.howItWorksStep3Desc')}</p>
                        </div>
                    </div>
                </section>
                
                {/* Featured Reviews */}
                <section className="mb-12">
                    <h2 className="text-2xl font-bold text-center mb-8 dark:text-gray-100">{t('homepage.latestReviewsTitle')}</h2>
                    {loadingReviews ? (
                        <div className="flex justify-center"><Spinner /></div>
                    ) : featuredReviews.length > 0 ? (
                        <div className="space-y-6 max-w-4xl mx-auto">
                            {featuredReviews.map(review => (
                                <ReviewCard key={review.id} review={review} showBusinessName={true} />
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-gray-500 dark:text-gray-400">{t('homepage.noFeaturedReviews')}</p>
                    )}
                </section>
            </div>

            {isFeaturedModalOpen && (
                <Modal title={t('homepage.manageFeaturedModalTitle')} onClose={() => setIsFeaturedModalOpen(false)}>
                    <div className="py-4 space-y-4">
                        <input
                            type="search"
                            placeholder={t('homepage.searchForBusiness')}
                            value={modalSearchTerm}
                            onChange={(e) => setModalSearchTerm(e.target.value)}
                            className="w-full p-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green bg-transparent"
                        />
                        <p className="text-sm text-gray-500 dark:text-gray-400">{t('homepage.selectedLabel')} {selectedFeaturedIds.size} de 5</p>
                        <div className="max-h-80 overflow-y-auto space-y-2 border p-3 rounded-lg bg-gray-50 dark:bg-zinc-900 dark:border-zinc-700">
                            {isSearchingModalBusinesses ? <div className="flex justify-center py-4"><Spinner /></div> : modalBusinessResults.map(biz => (
                                <label key={biz.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-700 cursor-pointer bg-white dark:bg-zinc-800 border dark:border-zinc-700">
                                    <input
                                        type="checkbox"
                                        checked={selectedFeaturedIds.has(biz.id)}
                                        onChange={() => handleFeaturedSelectionChange(biz.id)}
                                        className="h-5 w-5 rounded border-gray-300 dark:border-zinc-600 text-brand-green focus:ring-brand-green bg-gray-100 dark:bg-zinc-900"
                                    />
                                    <span className="font-medium">{biz.name}</span>
                                </label>
                            ))}
                        </div>
                        <div className="flex justify-end gap-3 pt-4 border-t dark:border-zinc-700">
                            <button type="button" onClick={() => setIsFeaturedModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-zinc-700 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600">{t('common.cancel')}</button>
                            <button onClick={handleSaveFeatured} disabled={isSavingFeatured} className="px-4 py-2 text-sm font-semibold text-white bg-brand-green rounded-lg hover:bg-opacity-90 disabled:bg-gray-400">
                                {isSavingFeatured ? t('common.saving') : t('common.save')}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </>
    );
};

// FIX: Corrected the default export name to match the component's name.
export default HomePageEn;