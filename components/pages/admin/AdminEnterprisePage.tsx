import React, { useState, useEffect, useCallback } from 'react';
import Meta from '../../Meta';
import { useNotification } from '../../../contexts/NotificationContext';
import { getEnterpriseUsers, supabase, searchAssignableUsers } from '../../../services/supabaseService';
import { Profile, Json } from '../../../types';
import Spinner from '../../Spinner';
import { useTranslation } from '../../../contexts/i18nContext';

// Definición de las funcionalidades que se pueden gestionar
const features = [
    { id: 'resumen', label: 'Resumen', icon: 'fa-chart-pie' },
    { id: 'reseñas', label: 'Reseñas', icon: 'fa-comments' },
    { id: 'analiticas', label: 'Analíticas', icon: 'fa-magnifying-glass-chart' },
    { id: 'invitaciones', label: 'Invitaciones', icon: 'fa-paper-plane' },
    { id: 'widgets', label: 'Widgets', icon: 'fa-puzzle-piece' },
    { id: 'perfil_de_empresa', label: 'Perfil de Empresa', icon: 'fa-store' },
    { id: 'manual_de_usuario', label: 'Manual de Usuario', icon: 'fa-book-open' },
];

const initialPermissions = features.reduce((acc, feature) => {
    acc[feature.id] = true;
    return acc;
}, {} as Record<string, boolean>);


const AdminEnterprisePage: React.FC = () => {
    const { showNotification } = useNotification();
    const t = useTranslation();
    
    const [enterpriseUsers, setEnterpriseUsers] = useState<Profile[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // State for managing selected user's data
    const [featurePermissions, setFeaturePermissions] = useState<Record<string, boolean>>(initialPermissions);
    const [editingLimits, setEditingLimits] = useState({ ai_credit_limit: 0, business_limit: 0 });

    // Add User State
    const [addUserSearchTerm, setAddUserSearchTerm] = useState('');
    const [addUserSearchResults, setAddUserSearchResults] = useState<(Profile & { email?: string })[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [userToAdd, setUserToAdd] = useState<(Profile & { email?: string }) | null>(null);
    const [newUserLimits, setNewUserLimits] = useState({ ai_credit_limit: 100000, business_limit: 100 });

    const fetchUsers = useCallback(async () => {
        setLoadingUsers(true);
        try {
            const users = await getEnterpriseUsers();
            setEnterpriseUsers(users);
        } catch (error) {
            showNotification(t('adminEnterprisePage.errorLoadingUsers'), 'error');
        } finally {
            setLoadingUsers(false);
        }
    }, [showNotification, t]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);
    
    useEffect(() => {
        if (selectedUser) {
            const userPermissions = (selectedUser.feature_permissions as Record<string, boolean>) || {};
            setFeaturePermissions({ ...initialPermissions, ...userPermissions });
            setEditingLimits({
                ai_credit_limit: selectedUser.ai_credit_limit || 0,
                business_limit: selectedUser.business_limit || 0,
            });
        } else {
            setFeaturePermissions(initialPermissions);
        }
    }, [selectedUser]);

    useEffect(() => {
        const handler = setTimeout(async () => {
            if (addUserSearchTerm.trim().length < 2) {
                setAddUserSearchResults([]);
                return;
            }
            setIsSearching(true);
            try {
                const results = await searchAssignableUsers(addUserSearchTerm);
                const currentEnterpriseIds = new Set(enterpriseUsers.map(u => u.id));
                setAddUserSearchResults(results.filter(u => !currentEnterpriseIds.has(u.id)));
            } catch (error) {
                showNotification(t('adminEnterprisePage.errorSearchingUsers'), 'error');
            } finally {
                setIsSearching(false);
            }
        }, 300);
        return () => clearTimeout(handler);
    }, [addUserSearchTerm, enterpriseUsers, showNotification, t]);
    
    const handleSelectUser = (user: Profile) => {
        setSelectedUser(prev => prev?.id === user.id ? null : user);
    };

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userToAdd) return;
        setIsSubmitting(true);
        try {
            const { data: addedUser, error: updateError } = await supabase.from('profiles').update({ 
                plan: 'enterprise', 
                billing_cycle: null, 
                plan_expires_at: null,
                ai_credit_limit: newUserLimits.ai_credit_limit,
                business_limit: newUserLimits.business_limit,
                feature_permissions: initialPermissions as unknown as Json
            }).eq('id', userToAdd.id).select().single();

            if (updateError) throw updateError;
            if (!addedUser) throw new Error("La actualización no devolvió un perfil. Revisa las políticas RLS.");

            showNotification(t('adminEnterprisePage.userAddedSuccess', { userName: addedUser.name }), 'success');
            setEnterpriseUsers(prev => [...prev, addedUser].sort((a, b) => a.name.localeCompare(b.name)));
            setUserToAdd(null);
            setAddUserSearchTerm('');
            setAddUserSearchResults([]);
        } catch (error: any) {
            showNotification(error.message || t('adminEnterprisePage.errorAddingUser'), 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRemoveUser = async (userToRemove: Profile) => {
        if (!window.confirm(t('adminEnterprisePage.removeUserConfirm', { userName: userToRemove.name }))) return;
        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('profiles').update({ plan: 'free', ai_credit_limit: null, business_limit: null, feature_permissions: null }).eq('id', userToRemove.id);
            if (error) throw error;
            showNotification(t('adminEnterprisePage.userRemovedSuccess', { userName: userToRemove.name }), 'success');
            setEnterpriseUsers(prev => prev.filter(u => u.id !== userToRemove.id));
            if (selectedUser?.id === userToRemove.id) setSelectedUser(null);
        } catch (error: any) {
            showNotification(error.message || t('adminEnterprisePage.errorRemovingUser'), 'error');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleSaveLimits = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser) return;
        setIsSubmitting(true);
        try {
            const { data: updatedUser, error } = await supabase.from('profiles').update({
                ai_credit_limit: editingLimits.ai_credit_limit,
                business_limit: editingLimits.business_limit,
            }).eq('id', selectedUser.id).select().single();
            if (error) throw error;
            if (!updatedUser) throw new Error("Update did not return profile.");
            showNotification(t('adminEnterprisePage.userSettingsSaved'), 'success');
            setEnterpriseUsers(prev => prev.map(u => u.id === selectedUser.id ? updatedUser : u));
            setSelectedUser(updatedUser);
        } catch (error: any) {
            showNotification(error.message || t('adminEnterprisePage.errorSavingSettings'), 'error');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleSavePermissions = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser) return;
        setIsSubmitting(true);
        try {
            const { data: updatedUser, error } = await supabase.from('profiles').update({ feature_permissions: featurePermissions as unknown as Json }).eq('id', selectedUser.id).select().single();
            if (error) throw error;
            if (!updatedUser) throw new Error("Update did not return profile.");
            showNotification(t('adminEnterprisePage.permissionsUpdatedSuccess'), 'success');
            setEnterpriseUsers(prev => prev.map(u => u.id === selectedUser.id ? updatedUser : u));
            setSelectedUser(updatedUser);
        } catch (error: any) {
            showNotification(error.message || t('adminEnterprisePage.errorSavingPermissions'), 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <Meta title={`${t('adminDashboard.enterprisePlan')} - Admin - Opynio`} description={t('adminEnterprisePage.generalAdvantagesSubtitle')} />
            <div className="space-y-8 max-w-4xl mx-auto">
                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-extrabold text-gray-800 dark:text-gray-100">{t('adminEnterprisePage.title')}</h1>
                    <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">{t('adminEnterprisePage.generalAdvantagesSubtitle')}</p>
                </div>
                
                {/* Add User Card */}
                <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl shadow-md border dark:border-zinc-700">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">{t('adminEnterprisePage.addUserToPlan')}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Busca un usuario existente para añadirlo al plan. Se le asignarán límites y permisos por defecto que podrás personalizar después.</p>
                    <form onSubmit={handleAddUser}>
                        <div className="relative mb-4">
                            <input type="search" value={addUserSearchTerm} onChange={(e) => { setAddUserSearchTerm(e.target.value); setUserToAdd(null); }} placeholder={t('adminEnterprisePage.searchUser')} className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg bg-transparent" />
                            {isSearching && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5"><Spinner /></div>}
                            {addUserSearchResults.length > 0 && (
                                <ul className="absolute z-20 w-full mt-1 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                    {addUserSearchResults.map(user => (
                                        <li key={user.id} onClick={() => { setUserToAdd(user); setAddUserSearchResults([]); setAddUserSearchTerm(user.name); }} className="px-4 py-3 hover:bg-gray-100 dark:hover:bg-zinc-700 cursor-pointer">
                                            <p className="font-semibold">{user.name} <span className="font-normal text-gray-500">(@{user.username})</span></p><p className="text-xs text-gray-500">{user.email}</p>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        {userToAdd && (
                            <div className="p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800/50 rounded-lg space-y-3 animate-fade-in-up">
                                <h3 className="font-semibold text-green-800 dark:text-green-200" dangerouslySetInnerHTML={{ __html: t('adminEnterprisePage.confirmAddUser', { userName: userToAdd.name }) }} />
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label htmlFor="ai_credit_limit" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('adminEnterprisePage.aiTokenAmount')}</label><input id="ai_credit_limit" type="number" value={newUserLimits.ai_credit_limit} onChange={(e) => setNewUserLimits(p => ({ ...p, ai_credit_limit: parseInt(e.target.value) || 0 }))} className="w-full p-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-transparent" /></div>
                                    <div><label htmlFor="business_limit" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('adminEnterprisePage.businessAmount')}</label><input id="business_limit" type="number" value={newUserLimits.business_limit} onChange={(e) => setNewUserLimits(p => ({ ...p, business_limit: parseInt(e.target.value) || 0 }))} className="w-full p-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-transparent" /></div>
                                </div>
                                <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => { setUserToAdd(null); setAddUserSearchTerm(''); }} className="px-3 py-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300 rounded-lg bg-gray-200 dark:bg-zinc-600 hover:bg-gray-300 dark:hover:bg-zinc-500">{t('common.cancel')}</button><button type="submit" disabled={isSubmitting} className="px-4 py-1.5 text-sm font-semibold text-white bg-brand-green rounded-lg">{isSubmitting ? t('common.processing') : t('adminEnterprisePage.confirmAndAdd')}</button></div>
                            </div>
                        )}
                    </form>
                </div>
                
                {/* Manage Users Card */}
                <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl shadow-md border dark:border-zinc-700">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">{t('adminEnterprisePage.enterpriseUsersList')} ({enterpriseUsers.length})</h2>
                    {loadingUsers ? <div className="flex justify-center py-8"><Spinner /></div> : (
                        <div className="space-y-3">
                            {enterpriseUsers.length === 0 ? <p className="text-center text-gray-500 py-4">{t('adminEnterprisePage.noEnterpriseUsers')}</p> : (
                                enterpriseUsers.map(user => (
                                    <div key={user.id} className="border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                                        <div onClick={() => handleSelectUser(user)} className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-700/50">
                                            <div className="flex items-center gap-4"><div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-zinc-600 flex-shrink-0 overflow-hidden flex items-center justify-center font-bold text-gray-600 dark:text-gray-200">
                                                {user.avatar_url ? <img src={user.avatar_url} alt={user.name} width={40} height={40} loading="lazy" decoding="async" className="w-full h-full object-cover" /> : <span>{user.name.charAt(0).toUpperCase()}</span>}
                                            </div><div><p className="font-semibold text-gray-900 dark:text-gray-100">{user.name}</p><p className="text-xs text-gray-500 dark:text-gray-400">@{user.username}</p></div></div>
                                            <div className="flex items-center gap-4 text-sm"><div className="hidden sm:block"><span className="font-semibold">Tokens:</span> {user.ai_credit_limit?.toLocaleString() || 'N/A'} | <span className="font-semibold">Empresas:</span> {user.business_limit || 'N/A'}</div><i className={`fa-solid fa-chevron-down transition-transform ${selectedUser?.id === user.id ? 'rotate-180' : ''}`}></i></div>
                                        </div>
                                        
                                        {selectedUser?.id === user.id && (
                                            <div className="p-4 bg-gray-50 dark:bg-zinc-700/50 border-t border-gray-200 dark:border-zinc-700 space-y-6 animate-fade-in-up">
                                                <form onSubmit={handleSavePermissions}><h3 className="font-bold mb-3">{t('Permisos de Funcionalidades')}</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-3">{features.map(f=><label key={f.id} className="flex items-center justify-between p-2 bg-white dark:bg-zinc-700 rounded-md border dark:border-zinc-600"><div className="flex items-center gap-2"><i className={`fa-solid ${f.icon} w-5 text-center text-gray-400`}></i><span>{f.label}</span></div><input type="checkbox" checked={featurePermissions[f.id]??true} onChange={()=>setFeaturePermissions(p=>({...p,[f.id]:!p[f.id]}))} className="h-4 w-4 rounded border-gray-300 dark:border-zinc-600 text-brand-green focus:ring-brand-green"/></label>)}</div><div className="text-right mt-3"><button type="submit" disabled={isSubmitting} className="px-4 py-1.5 text-xs font-semibold text-white bg-brand-green rounded-lg">{isSubmitting?t('common.saving'):t('common.save')}</button></div></form>
                                                <form onSubmit={handleSaveLimits}><h3 className="font-bold mb-3">Límites de Uso</h3><div className="grid grid-cols-2 gap-4"><div className="space-y-1"><label className="text-xs font-medium">{t('adminEnterprisePage.aiTokenAmount')}</label><input type="number" value={editingLimits.ai_credit_limit} onChange={e=>setEditingLimits(p=>({...p, ai_credit_limit:parseInt(e.target.value)||0}))} className="w-full p-2 border border-gray-300 dark:border-zinc-600 rounded bg-transparent"/></div><div className="space-y-1"><label className="text-xs font-medium">{t('adminEnterprisePage.businessAmount')}</label><input type="number" value={editingLimits.business_limit} onChange={e=>setEditingLimits(p=>({...p, business_limit:parseInt(e.target.value)||0}))} className="w-full p-2 border border-gray-300 dark:border-zinc-600 rounded bg-transparent"/></div></div><div className="text-right mt-3"><button type="submit" disabled={isSubmitting} className="px-4 py-1.5 text-xs font-semibold text-white bg-brand-green rounded-lg">{isSubmitting?t('common.saving'):t('common.save')}</button></div></form>
                                                <div className="pt-4 border-t border-dashed dark:border-zinc-600"><h3 className="font-bold text-red-600 dark:text-red-400">Zona de Peligro</h3><div className="flex justify-between items-center mt-2"><p className="text-sm text-gray-600 dark:text-gray-300">Quitar a este usuario del plan Enterprise.</p><button onClick={() => handleRemoveUser(user)} disabled={isSubmitting} className="px-3 py-1 text-xs font-semibold text-white bg-red-600 rounded-lg">{t('adminEnterprisePage.removeUser')}</button></div></div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
             <style>{`
                @keyframes fade-in-up { 0% { opacity: 0; transform: translateY(-10px); } 100% { opacity: 1; transform: translateY(0); } }
                .animate-fade-in-up { animation: fade-in-up 0.3s ease-out forwards; }
            `}</style>
        </>
    );
};

export default AdminEnterprisePage;