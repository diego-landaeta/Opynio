import React, { useState, useEffect, useCallback } from 'react';
import { getAdminUsersPaginated, adminUsersStats, type AdminUserStats } from '../../../services/supabaseService';
import type { Profile, UserRole } from '../../../types';
import { useNotification } from '../../../contexts/NotificationContext';
import Spinner from '../../Spinner';
import Meta from '../../Meta';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from '../../../contexts/i18nContext';
import AdminBackLink from './AdminBackLink';

const USERS_PER_PAGE = 15;

const AdminUsersPage: React.FC = () => {
    const { showNotification } = useNotification();
    const t = useTranslation();
    const [users, setUsers] = useState<(Profile & { email?: string })[]>([]);
    const [totalUserCount, setTotalUserCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    // Reseñas, empresas y último acceso de los usuarios de la página (vacío si la RPC no está aplicada: el listado sigue igual).
    const [stats, setStats] = useState<Record<string, AdminUserStats>>({});
    const [currentPage, setCurrentPage] = useState(1);
    
    // Filters
    const [searchParams, setSearchParams] = useSearchParams();
    const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchParams.get('q') || '');
    const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');

    // Debounce search term and update URL
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
            if (searchTerm) {
                setSearchParams({ q: searchTerm }, { replace: true });
            } else {
                setSearchParams({}, { replace: true });
            }
        }, 500);
        return () => clearTimeout(handler);
    }, [searchTerm, setSearchParams]);

    // Reset page on filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm, roleFilter]);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const { data, count } = await getAdminUsersPaginated(currentPage, USERS_PER_PAGE, {
                searchTerm: debouncedSearchTerm,
                role: roleFilter,
            });
            setUsers(data as any);
            setTotalUserCount(count);
            setStats({});
            adminUsersStats((data as any[]).map(u => u.id)).then(setStats).catch(() => setStats({}));
        } catch (error: any) {
            // Sin la RPC admin_list_users no hay forma de buscar ni de ver emails:
            // se dice en la tabla en vez de enseñar una lista sin filtrar.
            const falta = error?.code === 'PGRST202' || error?.code === '42883' || /admin_list_users/.test(error?.message || '');
            const mensaje = falta ? t('adminUsersPage.rpcMissing') : (error?.message || t('adminUsersPage.errorLoading'));
            setUsers([]);
            setTotalUserCount(0);
            setLoadError(mensaje);
            showNotification(mensaje, 'error');
        } finally {
            setLoading(false);
        }
    }, [currentPage, debouncedSearchTerm, roleFilter, showNotification, t]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const totalPages = Math.ceil(totalUserCount / USERS_PER_PAGE);

    const RoleBadge: React.FC<{ role: UserRole }> = ({ role }) => {
        const styles = {
            authenticated: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
            business_owner: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
            admin: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
        };
        const roleName = t(`roles.${role}`) || role.replace('_', ' ');
        return <span className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${styles[role]}`}>{roleName}</span>;
    };
    
    return (
        <>
            <Meta title="Gestión de Usuarios - Admin" description="Gestiona todos los usuarios de la plataforma Opynio." />
            <AdminBackLink />
            <div className="space-y-6">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-800 dark:text-gray-100">{t('adminDashboard.users')}</h1>

                <div className="bg-white dark:bg-zinc-800 p-3 sm:p-4 md:p-6 rounded-xl shadow-md border dark:border-zinc-700">
                    <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-4 mb-4">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
                            <input
                                type="search"
                                placeholder={t('adminDashboard.searchByNameEmailUser')}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full sm:w-64 p-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm bg-transparent"
                            />
                            <select
                                value={roleFilter}
                                onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
                                className="p-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-800 w-full sm:w-auto"
                            >
                                <option value="all">{t('adminUsersPage.allRoles')}</option>
                                <option value="authenticated">{t('roles.authenticated')}</option>
                                <option value="business_owner">{t('roles.business_owner')}</option>
                                <option value="admin">{t('roles.admin')}</option>
                            </select>
                        </div>
                        {!loading && !loadError && (
                            <p className="text-sm text-gray-500 dark:text-gray-400" aria-live="polite">
                                {t(totalUserCount === 1 ? 'adminUsersPage.totalOne' : 'adminUsersPage.totalMany', { count: totalUserCount })}
                            </p>
                        )}
                    </div>

                    {/* Desktop table view */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-600 dark:text-gray-400">
                            <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-zinc-700">
                                <tr>
                                    <th scope="col" className="px-3 lg:px-4 py-3">{t('common.user')}</th>
                                    <th scope="col" className="px-3 py-3 whitespace-nowrap">{t('adminDashboard.udTabActivity')}</th>
                                    <th scope="col" className="px-3 py-3 whitespace-nowrap">{t('common.registeredOn')}</th>
                                    <th scope="col" className="px-3 lg:px-4 py-3 text-right">{t('common.actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={4} className="text-center py-10"><Spinner /></td></tr>
                                ) : loadError ? (
                                    <tr><td colSpan={4} className="text-center py-10 text-red-600 dark:text-red-400" role="alert">{loadError}</td></tr>
                                ) : users.length === 0 ? (
                                    <tr><td colSpan={4} className="text-center py-10">{t('adminUsersPage.noUsers')}</td></tr>
                                ) : (
                                    users.map(user => (
                                        <tr key={user.id} className="bg-white dark:bg-zinc-800 border-b dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700/50">
                                            <td className="px-3 lg:px-4 py-3 font-medium text-gray-900 dark:text-gray-100 max-w-[260px]">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center font-bold overflow-hidden flex-shrink-0">
                                                        {user.avatar_url ? (
                                                            <img src={user.avatar_url} alt="" width={40} height={40} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span>{user.name?.charAt(0).toUpperCase()}</span>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <Link to={`/admin/usuarios/${user.id}`} className="font-bold truncate block hover:text-brand-green hover:underline">{user.name}</Link>
                                                        <div className="text-xs font-normal text-gray-500 dark:text-gray-400 truncate" title={(user as any).email || ''}>{(user as any).email || t('common.notAvailable')}</div>
                                                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                                                            <RoleBadge role={user.role} />
                                                            {user.username && <span className="text-xs font-normal text-gray-400 dark:text-gray-500 truncate">@{user.username}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 whitespace-nowrap text-xs leading-5">
                                                <div className="flex justify-between gap-4"><span className="text-gray-500 dark:text-gray-400">{t('adminDashboard.udColReviews')}</span><b className="tabular-nums text-gray-800 dark:text-gray-100">{stats[user.id] ? stats[user.id].reviews_count : '·'}</b></div>
                                                <div className="flex justify-between gap-4"><span className="text-gray-500 dark:text-gray-400">{t('adminDashboard.udColVotes')}</span><b className="tabular-nums text-gray-800 dark:text-gray-100">{stats[user.id] ? stats[user.id].votes_count : '·'}</b></div>
                                                <div className="flex justify-between gap-4"><span className="text-gray-500 dark:text-gray-400">{t('adminDashboard.udColBusinesses')}</span><b className="tabular-nums text-gray-800 dark:text-gray-100">{stats[user.id] ? stats[user.id].businesses_count : '·'}</b></div>
                                            </td>
                                            <td className="px-3 py-3 whitespace-nowrap">
                                                <div>{user.created_at ? new Date(user.created_at).toLocaleDateString('es-ES') : '—'}</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400" title={t('adminDashboard.udColLastAccess')}>
                                                    {stats[user.id] ? (stats[user.id].last_sign_in_at ? t('adminDashboard.udSeen', { date: new Date(stats[user.id].last_sign_in_at!).toLocaleDateString('es-ES') }) : t('adminDashboard.udNever')) : ''}
                                                </div>
                                            </td>
                                            <td className="px-3 lg:px-4 py-3 text-right whitespace-nowrap">
                                                <Link to={`/admin/usuarios/${user.id}`} className="block font-medium text-brand-green hover:underline text-sm">{t('adminDashboard.udViewProfile')}</Link>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile card view */}
                    <div className="md:hidden space-y-3">
                        {loading ? (
                            <div className="text-center py-10"><Spinner /></div>
                        ) : loadError ? (
                            <div className="text-center py-10 text-red-600 dark:text-red-400" role="alert">{loadError}</div>
                        ) : users.length === 0 ? (
                            <div className="text-center py-10 text-gray-600 dark:text-gray-400">{t('adminUsersPage.noUsers')}</div>
                        ) : (
                            users.map(user => (
                                <div key={user.id} className="bg-gray-50 dark:bg-zinc-700/50 p-3 rounded-lg border dark:border-zinc-600">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center font-bold overflow-hidden flex-shrink-0">
                                            {user.avatar_url ? (
                                                <img src={user.avatar_url} alt="Avatar" width={40} height={40} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-sm">{user.name?.charAt(0).toUpperCase()}</span>
                                            )}
                                        </div>
                                        <div className="flex-grow min-w-0">
                                            <div className="font-bold text-gray-900 dark:text-gray-100 truncate">{user.name}</div>
                                            {user.username && <div className="text-xs text-gray-500 dark:text-gray-400 truncate">@{user.username}</div>}
                                        </div>
                                        <RoleBadge role={user.role} />
                                    </div>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-600 dark:text-gray-400">{t('common.email')}:</span>
                                            <span className="text-gray-900 dark:text-gray-100 truncate ml-2">{(user as any).email || t('common.notAvailable')}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600 dark:text-gray-400">{t('common.registeredOn')}:</span>
                                            <span className="text-gray-900 dark:text-gray-100">{user.created_at ? new Date(user.created_at).toLocaleDateString('es-ES') : '—'}</span>
                                        </div>
                                    </div>
                                    {stats[user.id] && (
                                        <div className="flex justify-between text-sm mt-2">
                                            <span className="text-gray-600 dark:text-gray-400">{t('adminDashboard.udColReviews')}: <b className="text-gray-900 dark:text-gray-100">{stats[user.id].reviews_count}</b></span>
                                            <span className="text-gray-600 dark:text-gray-400">{t('adminDashboard.udColBusinesses')}: <b className="text-gray-900 dark:text-gray-100">{stats[user.id].businesses_count}</b></span>
                                        </div>
                                    )}
                                    <Link to={`/admin/usuarios/${user.id}`} className="block w-full mt-3 text-center py-2 px-3 bg-brand-green text-white rounded-lg hover:bg-opacity-90 transition-colors text-sm font-medium">
                                        {t('adminDashboard.udViewProfile')}
                                    </Link>
                                </div>
                            ))
                        )}
                    </div>

                     {totalPages > 1 && (
                        <nav className="flex justify-between items-center pt-4 border-t dark:border-zinc-700 mt-4">
                            <button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1 || loading} className="px-3 py-1 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-600 disabled:opacity-50">{t('common.previous')}</button>
                            <span>{t('common.page', { current: currentPage, total: totalPages })}</span>
                            <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages || loading} className="px-3 py-1 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-600 disabled:opacity-50">{t('common.next')}</button>
                        </nav>
                    )}
                </div>
            </div>
            
        </>
    );
};

export default AdminUsersPage;