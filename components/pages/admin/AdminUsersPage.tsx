import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getAdminUsersPaginated, updateUserRole, getBusinessesForOwner } from '../../../services/supabaseService';
import type { Profile, UserRole } from '../../../types';
import { useNotification } from '../../../contexts/NotificationContext';
import { useConfirm } from '../../../contexts/ConfirmContext';
import { useAuth } from '../../../contexts/AuthContext';
import Spinner from '../../Spinner';
import Meta from '../../Meta';
import Modal from '../../Modal';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from '../../../contexts/i18nContext';
import AdminBackLink from './AdminBackLink';

const USERS_PER_PAGE = 15;

const AdminUsersPage: React.FC = () => {
    const { showNotification } = useNotification();
    const { confirm } = useConfirm();
    const { user: currentUser } = useAuth();
    const t = useTranslation();
    const [users, setUsers] = useState<(Profile & { email?: string })[]>([]);
    const [totalUserCount, setTotalUserCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    
    // Filters
    const [searchParams, setSearchParams] = useSearchParams();
    const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchParams.get('q') || '');
    const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');

    // Modal state
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
    const [newRole, setNewRole] = useState<UserRole>('authenticated');
    const [businessName, setBusinessName] = useState('');
    const [modalLoading, setModalLoading] = useState(false);
    const [modalError, setModalError] = useState<string | null>(null);
    // Empresas del usuario del modal (null = comprobando). Decide si hace falta
    // pedir nombre de empresa al pasarlo a business_owner.
    const [ownedBusinessCount, setOwnedBusinessCount] = useState<number | null>(null);

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

    // Usuario cuyo recuento de empresas se espera: si se cierra el modal y se
    // abre el de otro antes de que llegue, la respuesta vieja no lo pisa.
    const ownedCountFor = useRef<string | null>(null);

    const handleOpenRoleModal = (user: Profile) => {
        setSelectedUser(user);
        setNewRole(user.role);
        setBusinessName('');
        setModalError(null);
        setOwnedBusinessCount(null);
        setIsRoleModalOpen(true);
        ownedCountFor.current = user.id;
        getBusinessesForOwner(user.id)
            .then(list => { if (ownedCountFor.current === user.id) setOwnedBusinessCount(list.length); })
            // Si no se puede comprobar se pide el nombre; updateUserRole vuelve a
            // mirar y no duplica si ya tiene empresa.
            .catch(() => { if (ownedCountFor.current === user.id) setOwnedBusinessCount(0); });
    };

    // El modal abre con el rol actual: solo hay algo que guardar si cambia.
    const roleChanged = !!selectedUser && newRole !== selectedUser.role;
    // Pasa a business_owner sin empresa: hay que crearle una (con nombre).
    const needsBusinessName = roleChanged && newRole === 'business_owner' && ownedBusinessCount === 0;
    const demotesAdmin = !!selectedUser && selectedUser.role === 'admin' && newRole !== 'admin';
    const demotesSelf = demotesAdmin && !!currentUser && selectedUser?.id === currentUser.id;

    const handleRoleChangeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser || !roleChanged || demotesSelf) return;
        if (newRole === 'business_owner' && ownedBusinessCount === null) return; // aun comprobando

        if (needsBusinessName && !businessName.trim()) {
            setModalError(t('adminUsersPage.businessNameRequired'));
            return;
        }

        if (demotesAdmin) {
            const ok = await confirm({
                title: t('adminUsersPage.confirmDemoteTitle'),
                message: t('adminUsersPage.confirmDemoteMessage', { name: selectedUser.name || (selectedUser as any).email || '' }),
                confirmText: t('adminUsersPage.confirmDemoteButton'),
                cancelText: t('common.cancel'),
                danger: true,
            });
            if (!ok) return;
        }

        setModalLoading(true);
        setModalError(null);

        try {
            await updateUserRole(selectedUser.id, newRole, needsBusinessName ? businessName.trim() : undefined);
            showNotification(t('adminUsersPage.roleUpdated'), 'success');
            setIsRoleModalOpen(false);
            setSelectedUser(null);
            fetchUsers(); // Refresh the user list
        } catch (err: any) {
            setModalError(err.message || t('adminUsersPage.errorUpdatingRole'));
        } finally {
            setModalLoading(false);
        }
    };

    const RoleBadge: React.FC<{ role: UserRole }> = ({ role }) => {
        const styles = {
            authenticated: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
            business_owner: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
            admin: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
        };
        const roleName = t(`roles.${role}`) || role.replace('_', ' ');
        return <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${styles[role]}`}>{roleName}</span>;
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
                                    <th scope="col" className="px-4 md:px-6 py-3">{t('common.user')}</th>
                                    <th scope="col" className="px-4 md:px-6 py-3">{t('common.email')}</th>
                                    <th scope="col" className="px-4 md:px-6 py-3">{t('common.role')}</th>
                                    <th scope="col" className="px-4 md:px-6 py-3">{t('common.registeredOn')}</th>
                                    <th scope="col" className="px-4 md:px-6 py-3 text-right">{t('common.actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={5} className="text-center py-10"><Spinner /></td></tr>
                                ) : loadError ? (
                                    <tr><td colSpan={5} className="text-center py-10 text-red-600 dark:text-red-400" role="alert">{loadError}</td></tr>
                                ) : users.length === 0 ? (
                                    <tr><td colSpan={5} className="text-center py-10">{t('adminUsersPage.noUsers')}</td></tr>
                                ) : (
                                    users.map(user => (
                                        <tr key={user.id} className="bg-white dark:bg-zinc-800 border-b dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700/50">
                                            <td className="px-4 md:px-6 py-4 font-medium text-gray-900 dark:text-gray-100 flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center font-bold overflow-hidden flex-shrink-0">
                                                    {user.avatar_url ? (
                                                        <img src={user.avatar_url} alt="Avatar" width={40} height={40} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span>{user.name?.charAt(0).toUpperCase()}</span>
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-bold truncate">{user.name}</div>
                                                    {user.username && <div className="text-xs text-gray-500 truncate">@{user.username}</div>}
                                                </div>
                                            </td>
                                            <td className="px-4 md:px-6 py-4 max-w-[200px] truncate">{(user as any).email || t('common.notAvailable')}</td>
                                            <td className="px-4 md:px-6 py-4"><RoleBadge role={user.role} /></td>
                                            <td className="px-4 md:px-6 py-4">{user.created_at ? new Date(user.created_at).toLocaleDateString('es-ES') : '—'}</td>
                                            <td className="px-4 md:px-6 py-4 text-right">
                                                <button onClick={() => handleOpenRoleModal(user)} className="font-medium text-brand-green hover:underline text-sm">{t('common.changeRole')}</button>
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
                                    <button
                                        onClick={() => handleOpenRoleModal(user)}
                                        className="w-full mt-3 py-2 px-3 bg-brand-green text-white rounded-lg hover:bg-opacity-90 transition-colors text-sm font-medium"
                                    >
                                        {t('common.changeRole')}
                                    </button>
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
            
            {isRoleModalOpen && selectedUser && (
                <Modal title={`${t('common.changeRoleFor')} ${selectedUser.name}`} onClose={() => setIsRoleModalOpen(false)}>
                    <form onSubmit={handleRoleChangeSubmit} className="py-4 space-y-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {t('adminUsersPage.currentRole', { role: t(`roles.${selectedUser.role}`) })}
                        </p>
                        <div>
                            <label htmlFor="role-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.newRole')}</label>
                            <select id="role-select" value={newRole} onChange={(e) => { setNewRole(e.target.value as UserRole); setModalError(null); }} className="w-full p-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800">
                                <option value="authenticated">{t('roles.authenticated')}</option>
                                <option value="business_owner">{t('roles.business_owner')}</option>
                                <option value="admin">{t('roles.admin')}</option>
                            </select>
                        </div>
                        {roleChanged && newRole === 'business_owner' && ownedBusinessCount === null && (
                            <p className="text-xs text-gray-500 dark:text-gray-400" role="status">{t('adminUsersPage.checkingBusinesses')}</p>
                        )}
                        {roleChanged && newRole === 'business_owner' && !!ownedBusinessCount && (
                            <p className="text-xs text-gray-600 dark:text-gray-400" role="status">{t('adminUsersPage.alreadyOwnsBusiness')}</p>
                        )}
                        {needsBusinessName && (
                            <div>
                                <label htmlFor="business-name-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('adminUsersPage.businessNameToAssign')}</label>
                                <input
                                    id="business-name-input"
                                    type="text"
                                    value={businessName}
                                    onChange={(e) => setBusinessName(e.target.value)}
                                    placeholder={t('adminUsersPage.exactBusinessName')}
                                    required
                                    className="w-full p-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-transparent"
                                />
                                <p className="text-xs text-gray-500 mt-1">{t('adminUsersPage.businessWillBeCreated')}</p>
                            </div>
                        )}
                        {demotesSelf && (
                            <div className="flex items-start gap-2 p-3 rounded-lg border border-red-300 bg-red-50 text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300 text-sm font-medium" role="alert">
                                <i className="fa-solid fa-triangle-exclamation mt-0.5" aria-hidden="true"></i>
                                <span>{t('adminUsersPage.cannotDemoteSelf')}</span>
                            </div>
                        )}
                        {!roleChanged && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">{t('adminUsersPage.noRoleChange')}</p>
                        )}
                        {modalError && <p className="text-red-600 text-sm font-medium text-center" role="alert">{modalError}</p>}
                        <div className="flex justify-end gap-3 pt-4 border-t dark:border-zinc-700">
                            <button type="button" onClick={() => setIsRoleModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-zinc-700 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600">{t('common.cancel')}</button>
                            <button
                                type="submit"
                                disabled={modalLoading || !roleChanged || demotesSelf || (newRole === 'business_owner' && ownedBusinessCount === null)}
                                className="px-4 py-2 text-sm font-semibold text-white bg-brand-green rounded-lg hover:bg-opacity-90 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                {modalLoading ? t('common.saving') : t('common.save')}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </>
    );
};

export default AdminUsersPage;