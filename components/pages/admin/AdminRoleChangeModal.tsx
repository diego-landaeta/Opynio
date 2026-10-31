import React, { useEffect, useState } from 'react';
import Modal from '../../Modal';
import { useTranslation } from '../../../contexts/i18nContext';
import { useConfirm } from '../../../contexts/ConfirmContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useNotification } from '../../../contexts/NotificationContext';
import { updateUserRole, getBusinessesForOwner } from '../../../services/supabaseService';
import type { UserRole } from '../../../types';

/**
 * Cambio de rol de un usuario. Solo se abre desde su ficha (/admin/usuarios/:id): antes estaba en el listado.
 * Mismas reglas de siempre: pasar a «propietario» sin empresa pide el nombre de la que se le crea, bajar a un admin
 * pide confirmación, y un admin no puede quitarse el rol a sí mismo.
 */
interface Props {
    user: { id: string; name: string; role: UserRole };
    onClose: () => void;
    /** Se llama tras guardar con el rol nuevo; la ficha vuelve a cargar sus datos. */
    onChanged: (rol: UserRole) => void;
}

const AdminRoleChangeModal: React.FC<Props> = ({ user, onClose, onChanged }) => {
    const t = useTranslation();
    const { confirm } = useConfirm();
    const { user: currentUser } = useAuth();
    const { showNotification } = useNotification();
    const [newRole, setNewRole] = useState<UserRole>(user.role);
    const [businessName, setBusinessName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Empresas del usuario (null = comprobando). Decide si hace falta pedir nombre de empresa al pasarlo a business_owner.
    const [ownedBusinessCount, setOwnedBusinessCount] = useState<number | null>(null);

    useEffect(() => {
        let vivo = true;
        getBusinessesForOwner(user.id)
            .then(list => { if (vivo) setOwnedBusinessCount(list.length); })
            // Si no se puede comprobar se pide el nombre; updateUserRole vuelve a mirar y no duplica si ya tiene empresa.
            .catch(() => { if (vivo) setOwnedBusinessCount(0); });
        return () => { vivo = false; };
    }, [user.id]);

    const roleChanged = newRole !== user.role;
    const needsBusinessName = roleChanged && newRole === 'business_owner' && ownedBusinessCount === 0;
    const demotesAdmin = user.role === 'admin' && newRole !== 'admin';
    const demotesSelf = demotesAdmin && !!currentUser && user.id === currentUser.id;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!roleChanged || demotesSelf) return;
        if (newRole === 'business_owner' && ownedBusinessCount === null) return; // aún comprobando
        if (needsBusinessName && !businessName.trim()) {
            setError(t('adminUsersPage.businessNameRequired'));
            return;
        }
        if (demotesAdmin) {
            const ok = await confirm({
                title: t('adminUsersPage.confirmDemoteTitle'),
                message: t('adminUsersPage.confirmDemoteMessage', { name: user.name }),
                confirmText: t('adminUsersPage.confirmDemoteButton'),
                cancelText: t('common.cancel'),
                danger: true,
            });
            if (!ok) return;
        }
        setLoading(true);
        setError(null);
        try {
            await updateUserRole(user.id, newRole, needsBusinessName ? businessName.trim() : undefined);
            showNotification(t('adminUsersPage.roleUpdated'), 'success');
            onChanged(newRole);
        } catch (err: any) {
            setError(err.message || t('adminUsersPage.errorUpdatingRole'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal title={`${t('common.changeRoleFor')} ${user.name}`} onClose={onClose}>
            <form onSubmit={handleSubmit} className="py-4 space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('adminUsersPage.currentRole', { role: t(`roles.${user.role}`) })}
                </p>
                <div>
                    <label htmlFor="role-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.newRole')}</label>
                    <select id="role-select" value={newRole} onChange={(e) => { setNewRole(e.target.value as UserRole); setError(null); }} className="w-full p-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800">
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
                {error && <p className="text-red-600 text-sm font-medium text-center" role="alert">{error}</p>}
                <div className="flex justify-end gap-3 pt-4 border-t dark:border-zinc-700">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-zinc-700 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600">{t('common.cancel')}</button>
                    <button
                        type="submit"
                        disabled={loading || !roleChanged || demotesSelf || (newRole === 'business_owner' && ownedBusinessCount === null)}
                        className="px-4 py-2 text-sm font-semibold text-white bg-brand-green rounded-lg hover:bg-opacity-90 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {loading ? t('common.saving') : t('common.save')}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default AdminRoleChangeModal;
