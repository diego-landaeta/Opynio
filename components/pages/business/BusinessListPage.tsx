import React, { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import type { Business, Plan } from '../../../types';
import Spinner from '../../Spinner';
import { Link } from 'react-router-dom';
import Meta from '../../Meta';
import { useI18n, useTranslation, pathTranslations, getLanguageForCountryCode } from '../../../contexts/i18nContext';
import { supabase } from '../../../services/supabaseService';
import { useNotification } from '../../../contexts/NotificationContext';
import { useCountry } from '../../../contexts/CountryContext';
import Modal from '../../Modal';

const DeleteConfirmModal: React.FC<{
    businessName: string;
    onConfirm: () => void;
    onCancel: () => void;
    isDeleting: boolean;
}> = ({ businessName, onConfirm, onCancel, isDeleting }) => {
    const t = useTranslation();

    return (
        <Modal onClose={onCancel} title={t('myBusinesses.deleteBusiness')}>
            <div className="space-y-4 mt-4">
                <p className="text-gray-700 dark:text-gray-300">
                    {t('myBusinesses.confirmDelete', { businessName })}
                </p>
                <div className="flex justify-end gap-3 pt-4">
                    <button
                        onClick={onCancel}
                        disabled={isDeleting}
                        className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-zinc-700 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600 transition-colors disabled:opacity-50"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isDeleting}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {isDeleting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                        <span>{isDeleting ? t('myBusinesses.deleting') : t('myBusinesses.delete')}</span>
                    </button>
                </div>
            </div>
        </Modal>
    );
};

const BusinessCard: React.FC<{ business: Business; onDelete: (businessId: string) => void }> = ({ business, onDelete }) => {
    const t = useTranslation();
    const { showNotification } = useNotification();
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [imageError, setImageError] = useState(false);
    const dashboardPath = pathTranslations.es.businessDashboard.replace(':businessName', encodeURIComponent(business.name.replace(/ /g, '_')));

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const { error, count } = await supabase
                .from('businesses')
                .delete({ count: 'exact' })
                .eq('id', business.id);

            if (error) throw error;

            // Verify the deletion actually happened
            if (count === 0) {
                throw new Error(t('myBusinesses.deletePermissionError') || 'No tienes permisos para eliminar esta empresa');
            }

            showNotification(t('myBusinesses.deleteSuccess'), 'success');
            setShowDeleteModal(false);
            onDelete(business.id);
        } catch (error: any) {
            showNotification(error.message || t('myBusinesses.deleteError'), 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <>
            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-md border dark:border-zinc-700 p-5 flex flex-col transition-all hover:shadow-lg hover:-translate-y-1">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-zinc-700 flex-shrink-0 flex items-center justify-center overflow-hidden border dark:border-zinc-600">
                        {business.logo_url && !imageError ? (
                            <img src={business.logo_url} alt={`${business.name} logo`} width={64} height={64} loading="lazy" decoding="async" className="w-full h-full object-contain p-1" onError={() => setImageError(true)} />
                        ) : (
                            <div className="text-gray-400 dark:text-gray-500">
                                <i className="fa-solid fa-store text-3xl"></i>
                            </div>
                        )}
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">{business.name}</h3>
                    </div>
                    <button
                        onClick={() => setShowDeleteModal(true)}
                        disabled={isDeleting}
                        className="text-red-500 hover:text-red-700 dark:hover:text-red-400 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                        title={t('myBusinesses.deleteBusiness')}
                    >
                        <i className="fa-solid fa-trash-can"></i>
                    </button>
                </div>
                <div className="mt-auto pt-4 border-t dark:border-zinc-700">
                    <Link to={`/${dashboardPath}`} className="text-brand-green font-semibold hover:text-green-700 dark:hover:text-green-400 flex items-center gap-2">
                        <span>{t('myBusinesses.manage')}</span>
                        <i className="fa-solid fa-arrow-right"></i>
                    </Link>
                </div>
            </div>

            {showDeleteModal && (
                <DeleteConfirmModal
                    businessName={business.name}
                    onConfirm={handleDelete}
                    onCancel={() => setShowDeleteModal(false)}
                    isDeleting={isDeleting}
                />
            )}
        </>
    );
};

const PLAN_FEATURES: Record<Plan, { key: string; icon: string; comingSoon?: boolean }[]> = {
    free: [],
    starter: [
        { key: 'pricingPage.starterFeature2', icon: 'fa-solid fa-paper-plane' },
        { key: 'pricingPage.starterFeature3', icon: 'fa-solid fa-puzzle-piece' },
        { key: 'pricingPage.starterFeature4', icon: 'fa-solid fa-robot' },
        { key: 'pricingPage.starterFeature5', icon: 'fa-solid fa-filter' },
        { key: 'pricingPage.starterFeature6', icon: 'fa-solid fa-file-csv', comingSoon: true },
        { key: 'pricingPage.starterFeature7', icon: 'fa-solid fa-plug-circle-bolt', comingSoon: true },
    ],
    growth: [
        { key: 'pricingPage.growthFeature1', icon: 'fa-solid fa-star' },
        { key: 'pricingPage.growthFeature3', icon: 'fa-solid fa-puzzle-piece' },
        { key: 'pricingPage.growthFeature4', icon: 'fa-solid fa-store' },
        { key: 'pricingPage.growthFeature5', icon: 'fa-solid fa-box-archive' },
        { key: 'pricingPage.growthFeature6', icon: 'fa-solid fa-qrcode' },
        { key: 'pricingPage.growthFeature7', icon: 'fa-solid fa-magnifying-glass-chart' },
        { key: 'pricingPage.growthFeature8', icon: 'fa-solid fa-robot' },
        { key: 'pricingPage.growthFeature9', icon: 'fa-solid fa-code', comingSoon: true },
        { key: 'pricingPage.growthFeature10', icon: 'fa-solid fa-chart-line', comingSoon: true },
    ],
    pro: [
        { key: 'pricingPage.proFeature1', icon: 'fa-solid fa-star' },
        { key: 'pricingPage.proFeature3', icon: 'fa-brands fa-whatsapp' },
        { key: 'pricingPage.proFeature4', icon: 'fa-solid fa-tags' },
        { key: 'pricingPage.proFeature5', icon: 'fa-solid fa-filter-circle-dollar' },
        { key: 'pricingPage.proFeature6', icon: 'fa-solid fa-bell' },
        { key: 'pricingPage.proFeature7', icon: 'fa-solid fa-table-cells-large', comingSoon: true },
        { key: 'pricingPage.proFeature8', icon: 'fa-solid fa-code-compare', comingSoon: true },
        { key: 'pricingPage.proFeature9', icon: 'fa-solid fa-headset', comingSoon: true },
    ],
    enterprise: [],
};


const BusinessListPage: React.FC = () => {
    const { businesses, loading, profile, setBusinesses } = useAuth();
    const t = useTranslation();
    const { language } = useI18n();
    const { country } = useCountry();

    if (loading) {
        return <div className="flex justify-center items-center h-64"><Spinner /></div>;
    }

    const PLAN_LIMITS: Record<Plan, number> = {
        free: 1,
        starter: 1,
        growth: 3,
        pro: 10,
        enterprise: Infinity,
    };

    const currentPlan = profile?.plan || 'free';
    // For enterprise users, use their custom business_limit if set, otherwise use Infinity
    // For admins, always use Infinity
    const limit = profile?.role === 'admin'
        ? Infinity
        : (currentPlan === 'enterprise' && profile?.business_limit)
            ? profile.business_limit
            : PLAN_LIMITS[currentPlan];
    const canCreateBusiness = businesses.length < limit;

    const featuresForCurrentPlan = PLAN_FEATURES[currentPlan] || [];

    // Use country directly - don't infer from language
    const countryPrefix = country ? `/${country.toLowerCase()}` : '';
    const pathLang = country ? getLanguageForCountryCode(country) : language;
    const paths = pathTranslations[pathLang] || pathTranslations.es;

    const handleDeleteBusiness = (businessId: string) => {
        setBusinesses(businesses.filter(b => b.id !== businessId));
    };

    return (
        <>
            <Meta title={`${t('myBusinesses.myBusinessesTitle', { count: businesses.length, limit: limit === Infinity ? '∞' : limit })} - Opynio`} description={t('myBusinesses.metaDescription')} noindex={true} />
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold text-gray-800 dark:text-gray-100">{t('myBusinesses.myBusinessesTitle', { count: businesses.length, limit: limit === Infinity ? '∞' : limit })}</h1>
                    </div>
                    {canCreateBusiness ? (
                        <Link to={`${countryPrefix}/${paths.assignBusiness}?plan=${currentPlan}`} className="bg-brand-green text-white font-bold py-2.5 px-5 rounded-lg hover:bg-opacity-90 transition-colors shadow-sm flex items-center gap-2">
                            <i className="fa-solid fa-plus-circle"></i>
                            <span>{t('myBusinesses.addBusiness')}</span>
                        </Link>
                    ) : (
                        <Link to={`${countryPrefix}/${paths.pricing}`} className="bg-brand-blue text-white font-bold py-2.5 px-5 rounded-lg hover:bg-opacity-90 transition-colors shadow-sm flex items-center gap-2">
                            <i className="fa-solid fa-rocket"></i>
                            <span>{t('myBusinesses.upgradePlan')}</span>
                        </Link>
                    )}
                </div>

                {profile && (
                    <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl shadow-md border dark:border-zinc-700">
                        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{t('myBusinesses.yourCurrentPlan')}</h2>
                                <div className="flex items-center gap-3 mt-2">
                                    <span className="font-bold text-lg text-brand-green capitalize">{profile.plan}</span>
                                    {profile.billing_cycle && <span className="text-sm text-gray-500 dark:text-gray-400 capitalize">({profile.billing_cycle === 'monthly' ? t('myBusinesses.billingCycleMonthly') : t('myBusinesses.billingCycleAnnual')})</span>}
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {profile.plan_expires_at 
                                        ? t('myBusinesses.planRenewsOn', { date: new Date(profile.plan_expires_at).toLocaleDateString(language, { year: 'numeric', month: 'long', day: 'numeric' }) })
                                        : (profile.plan === 'free' ? t('myBusinesses.freePlanActive') : t('myBusinesses.supportForRenewal'))
                                    }
                                </p>
                            </div>
                            <div className="flex items-center gap-3 mt-2 md:mt-0 self-start md:self-center flex-wrap">
                                 <Link to={`${countryPrefix}/${paths.support}`} className="text-sm font-semibold text-gray-600 dark:text-gray-300 hover:underline px-4 py-2 rounded-md flex items-center gap-2">
                                    <i className="fa-solid fa-life-ring"></i> {t('myBusinesses.helpAndSupport')}
                                </Link>
                                <button onClick={() => alert('Próximamente disponible')} className="text-sm font-semibold text-white bg-gray-700 hover:bg-gray-800 dark:bg-zinc-700 dark:hover:bg-zinc-600 px-4 py-2 rounded-md transition-colors flex items-center gap-2">
                                    <i className="fa-solid fa-credit-card"></i> {t('myBusinesses.manageBilling')}
                                </button>
                            </div>
                        </div>

                         {featuresForCurrentPlan.length > 0 && (
                            <>
                                <hr className="my-6 dark:border-zinc-700"/>
                                <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-4">{t('myBusinesses.featuresIncludedInYourPlan')}</h3>
                                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                                {featuresForCurrentPlan.map(feature => (
                                    <li key={feature.key} className="flex items-start gap-3">
                                        <i className={`${feature.icon} text-brand-green mt-1 w-5 text-center`}></i>
                                        <span className="flex-1 text-gray-700 dark:text-gray-300">
                                            {t(feature.key)}
                                            {feature.comingSoon && <span className="text-xs text-yellow-600 dark:text-yellow-400 font-semibold ml-2">({t('common.comingSoon')})</span>}
                                        </span>
                                    </li>
                                ))}
                                </ul>
                            </>
                        )}
                    </div>
                )}


                {businesses.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {businesses.map(biz => (
                            <BusinessCard key={biz.id} business={biz} onDelete={handleDeleteBusiness} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-800/50 rounded-lg border-2 border-dashed border-gray-200 dark:border-zinc-700">
                        <i className="fa-solid fa-store-slash text-6xl mb-4 text-gray-300 dark:text-gray-600"></i>
                        <h2 className="font-semibold text-lg text-gray-600 dark:text-gray-300">{t('myBusinesses.noBusinesses')}</h2>
                        <p className="text-sm mt-2 max-w-sm mx-auto">{t('myBusinesses.noBusinessesSubtitle')}</p>
                    </div>
                )}
            </div>
        </>
    );
};

export default BusinessListPage;