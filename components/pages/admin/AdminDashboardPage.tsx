
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAdminDashboardStats, deleteBusinessesWithoutReviews } from '../../../services/supabaseService';
import { useNotification } from '../../../contexts/NotificationContext';
import { useConfirm } from '../../../contexts/ConfirmContext';
import Spinner from '../../Spinner';
import Meta from '../../Meta';
import { useTranslation, useI18n, pathTranslations } from '../../../contexts/i18nContext';

const StatCard: React.FC<{ title: string; value: number; icon: string; color: string; bgColor: string }> = ({ title, value, icon, color, bgColor }) => (
    <div className={`${bgColor} p-4 sm:p-5 rounded-xl border border-white/10 relative overflow-hidden`}>
        <div className="relative z-10">
            <p className="text-white/80 text-sm font-medium mb-1">{title}</p>
            <p className="text-3xl sm:text-4xl font-bold text-white">{value?.toLocaleString() ?? 0}</p>
        </div>
        <div className={`absolute -right-2 -bottom-2 text-white/20 text-6xl sm:text-7xl`}>
            <i className={`fa-solid ${icon}`}></i>
        </div>
    </div>
);

const ToolCard: React.FC<{ title: string; icon: string; link: string; description: string; color: string; comingSoon?: boolean }> = ({ title, icon, link, description, color, comingSoon }) => {
    const inner = (
        <>
            <div className={`p-3 rounded-xl ${color} text-white flex-shrink-0 ${comingSoon ? 'opacity-60' : ''}`}>
                <i className={`fa-solid ${icon} text-lg`}></i>
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={`font-bold text-gray-800 dark:text-gray-100 ${comingSoon ? '' : 'group-hover:text-brand-green'} transition-colors`}>{title}</h3>
                    {comingSoon && (
                        <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700">
                            Próximamente
                        </span>
                    )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{description}</p>
            </div>
            {!comingSoon && <i className="fa-solid fa-chevron-right text-gray-300 dark:text-zinc-600 group-hover:text-brand-green transition-colors ml-auto self-center"></i>}
        </>
    );
    const baseCls = 'group flex items-start gap-4 bg-white dark:bg-zinc-800 p-4 rounded-xl border dark:border-zinc-700 transition-all';
    if (comingSoon) {
        return (
            <div className={`${baseCls} opacity-75 cursor-not-allowed`} aria-disabled="true" title="En desarrollo">
                {inner}
            </div>
        );
    }
    return (
        <Link to={link} className={`${baseCls} hover:border-brand-green dark:hover:border-brand-green hover:shadow-md`}>
            {inner}
        </Link>
    );
};

const SectionTitle: React.FC<{ icon: string; title: string; color: string }> = ({ icon, title, color }) => (
    <div className="flex items-center gap-3 mb-4">
        <div className={`w-1 h-6 rounded-full ${color}`}></div>
        <i className={`fa-solid ${icon} ${color.replace('bg-', 'text-')} text-lg`}></i>
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">{title}</h2>
    </div>
);

const AdminDashboardPage: React.FC = () => {
    const [stats, setStats] = useState({ users: 0, businesses: 0, reviews: 0 });
    const [loading, setLoading] = useState(true);
    const [isDeletingEmpty, setIsDeletingEmpty] = useState(false);
    const { showNotification } = useNotification();
    const { confirm } = useConfirm();
    const t = useTranslation();
    const { language } = useI18n();
    const langPrefix = `/${language}`;

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const data = await getAdminDashboardStats();
                setStats(data);
            } catch (error) {
                console.error("Error fetching admin stats:", error);
                showNotification(t('adminDashboard.errorLoadingDashboardData'), 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, [showNotification, t]);

    const handleDeleteEmptyBusinesses = async () => {
        const ok = await confirm({
            title: t('adminDashboard.deleteEmpty') || 'Eliminar negocios vacíos',
            message: t('adminDashboard.confirmDeleteEmpty'),
            confirmText: t('common.delete') || 'Eliminar',
            cancelText: t('common.cancel') || 'Cancelar',
            danger: true,
        });
        if (!ok) return;
        setIsDeletingEmpty(true);
        try {
            const deletedCount = await deleteBusinessesWithoutReviews();
            showNotification(t('adminDashboard.deleteEmptySuccess', { count: deletedCount }), 'success');
            // Refresh stats
            const data = await getAdminDashboardStats();
            setStats(data);
        } catch (error) {
            console.error("Error deleting empty businesses:", error);
            showNotification(t('adminDashboard.errorDeletingEmpty'), 'error');
        } finally {
            setIsDeletingEmpty(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center h-64"><Spinner /></div>;
    }

    return (
        <>
            <Meta title={`${t('adminDashboard.title')} - Opynio`} description={t('adminDashboard.subtitle')} />
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-800 dark:text-gray-100">{t('adminDashboard.title')}</h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">Gestiona la plataforma Opynio</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                         <button
                            onClick={handleDeleteEmptyBusinesses}
                            disabled={isDeletingEmpty}
                            className="bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400 font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 text-sm"
                            title={t('adminDashboard.deleteEmptyTooltip')}
                        >
                            {isDeletingEmpty ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <i className="fa-solid fa-trash-can"></i>}
                            <span>{t('adminDashboard.deleteEmpty')}</span>
                        </button>
                        <Link to={`/${pathTranslations.es.adminCreateBusiness}`} className="bg-brand-green text-white font-semibold py-2 px-4 rounded-lg hover:bg-opacity-90 transition-colors shadow-sm flex items-center justify-center gap-2 text-sm">
                            <i className="fa-solid fa-plus"></i>
                            <span>{t('adminDashboard.createBusiness')}</span>
                        </Link>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <StatCard title={t('adminDashboard.totalUsers')} value={stats.users} icon="fa-users" color="text-blue-500" bgColor="bg-gradient-to-br from-blue-500 to-blue-600" />
                    <StatCard title={t('adminDashboard.totalBusinesses')} value={stats.businesses} icon="fa-store" color="text-emerald-500" bgColor="bg-gradient-to-br from-emerald-500 to-emerald-600" />
                    <StatCard title={t('adminDashboard.totalReviews')} value={stats.reviews} icon="fa-star" color="text-amber-500" bgColor="bg-gradient-to-br from-amber-500 to-amber-600" />
                </div>

                {/* Tools Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
                    {/* Moderación */}
                    <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-2xl p-5 border dark:border-zinc-700">
                        <SectionTitle icon="fa-shield-halved" title="Moderación" color="bg-orange-500" />
                        <div className="space-y-3">
                            <ToolCard title={t('adminDashboard.moderateReviews')} icon="fa-comments" link={`/${pathTranslations.es.adminReviewModeration}`} description="Aprueba o rechaza nuevas reseñas." color="bg-orange-500" />
                            <ToolCard title={t('adminDashboard.reviewAppeals')} icon="fa-flag" link={`/${pathTranslations.es.adminReviewAppeals}`} description="Revisa apelaciones de reseñas rechazadas." color="bg-orange-400" />
                            <ToolCard title={t('adminDashboard.bugs')} icon="fa-bug" link={`/${pathTranslations.es.adminBugs}`} description="Gestiona informes de errores de usuarios." color="bg-red-500" />
                            <ToolCard title="Soporte" icon="fa-headset" link="#" description="Atiende tickets, dudas y solicitudes de los clientes." color="bg-pink-500" comingSoon />
                        </div>
                    </div>

                    {/* Usuarios y Empresas */}
                    <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-2xl p-5 border dark:border-zinc-700">
                        <SectionTitle icon="fa-users" title="Usuarios y Empresas" color="bg-blue-500" />
                        <div className="space-y-3">
                            <ToolCard title={t('adminDashboard.users')} icon="fa-users-cog" link={`/${pathTranslations.es.adminUsers}`} description="Gestiona usuarios, roles y permisos." color="bg-blue-500" />
                            <ToolCard title={t('adminDashboard.businessClaims')} icon="fa-user-shield" link={`/${pathTranslations.es.adminClaims}`} description="Revisa solicitudes de reclamación de empresas." color="bg-indigo-500" />
                            <ToolCard title={t('adminDashboard.enterprisePlan')} icon="fa-building" link={`/${pathTranslations.es.adminEnterprise}`} description="Gestiona clientes del plan Enterprise." color="bg-purple-500" />
                        </div>
                    </div>

                    {/* Gestión de Contenido */}
                    <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-2xl p-5 border dark:border-zinc-700">
                        <SectionTitle icon="fa-database" title="Gestión de Contenido" color="bg-emerald-500" />
                        <div className="space-y-3">
                            <ToolCard title={t('adminDashboard.scraping')} icon="fa-robot" link={`/${pathTranslations.es.adminScraping}`} description="Importa empresas masivamente desde Google Maps." color="bg-emerald-500" />
                            <ToolCard title={t('adminDashboard.bulkEdit')} icon="fa-pen-to-square" link={`/${pathTranslations.es.adminBulkEdit}`} description="Edita múltiples empresas rápidamente." color="bg-teal-500" />
                            <ToolCard title={t('adminDashboard.featuredBusinesses')} icon="fa-star" link={`/${pathTranslations.es.adminFeatured}`} description={t('adminDashboard.featuredBusinessesDesc')} color="bg-yellow-500" />
                            <ToolCard title={t('adminDashboard.urlManager')} icon="fa-link" link={`/${pathTranslations.es.adminUrls}`} description={t('adminDashboard.urlManagerDesc')} color="bg-cyan-500" />
                        </div>
                    </div>

                    {/* Acceso Rápido */}
                    <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-2xl p-5 border dark:border-zinc-700">
                        <SectionTitle icon="fa-bolt" title="Acciones Rápidas" color="bg-brand-green" />
                        <div className="grid grid-cols-2 gap-3">
                            <Link to={`/${pathTranslations.es.adminCreateBusiness}`} className="flex flex-col items-center justify-center gap-2 bg-white dark:bg-zinc-800 p-4 rounded-xl border dark:border-zinc-700 hover:border-brand-green dark:hover:border-brand-green transition-all hover:shadow-md text-center">
                                <div className="w-12 h-12 rounded-full bg-brand-green/10 flex items-center justify-center">
                                    <i className="fa-solid fa-plus text-brand-green text-xl"></i>
                                </div>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Nueva Empresa</span>
                            </Link>
                            <Link to={`/${pathTranslations.es.adminReviewModeration}`} className="flex flex-col items-center justify-center gap-2 bg-white dark:bg-zinc-800 p-4 rounded-xl border dark:border-zinc-700 hover:border-brand-green dark:hover:border-brand-green transition-all hover:shadow-md text-center">
                                <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                                    <i className="fa-solid fa-check-double text-orange-500 text-xl"></i>
                                </div>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Moderar</span>
                            </Link>
                            <Link to={`/${pathTranslations.es.adminUsers}`} className="flex flex-col items-center justify-center gap-2 bg-white dark:bg-zinc-800 p-4 rounded-xl border dark:border-zinc-700 hover:border-brand-green dark:hover:border-brand-green transition-all hover:shadow-md text-center">
                                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                                    <i className="fa-solid fa-user-gear text-blue-500 text-xl"></i>
                                </div>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Usuarios</span>
                            </Link>
                            <Link to={`/${pathTranslations.es.adminClaims}`} className="flex flex-col items-center justify-center gap-2 bg-white dark:bg-zinc-800 p-4 rounded-xl border dark:border-zinc-700 hover:border-brand-green dark:hover:border-brand-green transition-all hover:shadow-md text-center">
                                <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center">
                                    <i className="fa-solid fa-clipboard-check text-indigo-500 text-xl"></i>
                                </div>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Reclamaciones</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default AdminDashboardPage;
