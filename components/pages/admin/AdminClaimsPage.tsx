import React, { useState, useEffect, useCallback } from 'react';
import { getAdminClaims, resolveClaim } from '../../../services/supabaseService';
import type { Claim } from '../../../types';
import { useNotification } from '../../../contexts/NotificationContext';
import Spinner from '../../Spinner';
import Meta from '../../Meta';
import Modal from '../../Modal';
import { useTranslation } from '../../../contexts/i18nContext';
import { COUNTRIES } from '../../../constants';

type ActiveTab = 'pending' | 'in_review' | 'approved' | 'rejected' | 'all';

const AdminClaimsPage: React.FC = () => {
    const { showNotification } = useNotification();
    const t = useTranslation();
    const [claims, setClaims] = useState<Claim[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<ActiveTab>('pending');
    
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);
    const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
    const [adminNotes, setAdminNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchClaims = useCallback(async (status: ActiveTab) => {
        setLoading(true);
        try {
            const data = await getAdminClaims({ status });
            setClaims(data);
        } catch (error: any) {
            showNotification(error.message || `Error al cargar reclamaciones.`, 'error');
        } finally {
            setLoading(false);
        }
    }, [showNotification]);

    useEffect(() => {
        fetchClaims(activeTab);
    }, [activeTab, fetchClaims]);
    
    const handleResolveClaim = async (newStatus: 'approved' | 'rejected') => {
        if (!selectedClaim) return;
        setIsSubmitting(true);
        try {
            await resolveClaim(selectedClaim.id, newStatus, adminNotes);
            showNotification(`Reclamación #${selectedClaim.id} ha sido ${newStatus === 'approved' ? 'aprobada' : 'rechazada'}.`, 'success');
            // Optimistic update: remove from the current list
            setClaims(prev => prev.filter(c => c.id !== selectedClaim.id));
            setIsActionModalOpen(false);
        } catch (error: any) {
            showNotification(error.message || 'Error al resolver la reclamación.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleOpenModal = (claim: Claim) => {
        setSelectedClaim(claim);
        setAdminNotes(claim.admin_notes || '');
        setIsActionModalOpen(true);
    };

    const TabButton: React.FC<{ tab: ActiveTab; label: string }> = ({ tab, label }) => (
        <button
            onClick={() => setActiveTab(tab)}
            className={`px-2 sm:px-4 py-2 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab
                ? 'border-brand-green text-brand-green'
                : 'border-transparent text-gray-500 hover:text-brand-dark dark:text-gray-400 dark:hover:text-gray-200'
            }`}
        >
            {label}
        </button>
    );
    
    const StatusBadge: React.FC<{ status: Claim['status'] }> = ({ status }) => {
        const styles = {
            pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
            in_review: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
            approved: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
            rejected: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
        };
        const statusText = t(`adminClaims.${status.replace('_', '')}`);
        return <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${styles[status]}`}>{statusText}</span>;
    };

    return (
        <>
            <Meta title={`${t('adminClaims.title')} - Admin`} description="Revisa y aprueba las reclamaciones de propiedad de empresas." />
            <div className="space-y-6">
                <h1 className="text-3xl font-extrabold text-gray-800 dark:text-gray-100">{t('adminClaims.title')}</h1>
                
                <div className="bg-white dark:bg-zinc-800 p-3 sm:p-6 rounded-xl shadow-md border dark:border-zinc-700">
                    <div className="border-b dark:border-zinc-700 mb-4 sm:mb-6 overflow-x-auto">
                        <nav className="-mb-px flex space-x-2 sm:space-x-6">
                            <TabButton tab="pending" label={t('adminClaims.pending')} />
                            <TabButton tab="in_review" label={t('adminClaims.in_review')} />
                            <TabButton tab="approved" label={t('adminClaims.approved')} />
                            <TabButton tab="rejected" label={t('adminClaims.rejected')} />
                            <TabButton tab="all" label={t('common.all')} />
                        </nav>
                    </div>

                    {/* Desktop table view */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-600 dark:text-gray-400">
                            <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-zinc-700">
                                <tr>
                                    <th scope="col" className="px-6 py-3">{t('adminClaims.headerTicketId')}</th>
                                    <th scope="col" className="px-6 py-3">{t('adminClaims.headerUser')}</th>
                                    <th scope="col" className="px-6 py-3">{t('adminClaims.headerBusiness')}</th>
                                    <th scope="col" className="px-6 py-3">{t('adminClaims.headerCountry')}</th>
                                    <th scope="col" className="px-6 py-3">{t('adminClaims.headerDate')}</th>
                                    <th scope="col" className="px-6 py-3">{t('adminClaims.headerStatus')}</th>
                                    <th scope="col" className="px-6 py-3 text-right">{t('common.actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={7} className="text-center py-10"><Spinner /></td></tr>
                                ) : claims.length === 0 ? (
                                    <tr><td colSpan={7} className="text-center py-10">{t('adminClaims.noClaims')}</td></tr>
                                ) : (
                                    claims.map(claim => (
                                        <tr key={claim.id} className="bg-white dark:bg-zinc-800 border-b dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700/50">
                                            <td className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100">#{claim.id}</td>
                                            <td className="px-6 py-4">{claim.profiles?.name || t('adminClaims.userNotFound')}</td>
                                            <td className="px-6 py-4">{claim.businesses?.name || t('adminClaims.businessDeleted')}</td>
                                            <td className="px-4 py-4">
                                                {(() => {
                                                    if (!claim.businesses?.country) return <span className="text-gray-400 dark:text-zinc-500 text-xs">-</span>;
                                                    const countryInfo = COUNTRIES.find(c => c.code === claim.businesses.country);
                                                    if (countryInfo) {
                                                        return (
                                                            <div className="flex items-center gap-2" title={countryInfo.name}>
                                                                <img src={countryInfo.flag} alt={countryInfo.name} width={20} height={12} loading="lazy" decoding="async" className="w-5 h-3 object-contain" />
                                                                <span className="font-medium text-xs text-gray-700 dark:text-gray-300">{countryInfo.code}</span>
                                                            </div>
                                                        );
                                                    }
                                                    return <span className="text-gray-400 dark:text-zinc-500 text-xs">{claim.businesses.country}</span>;
                                                })()}
                                            </td>
                                            <td className="px-6 py-4">{new Date(claim.created_at).toLocaleDateString()}</td>
                                            <td className="px-6 py-4"><StatusBadge status={claim.status} /></td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => handleOpenModal(claim)} className="font-medium text-brand-green hover:underline">{t('adminClaims.reviewAction')}</button>
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
                        ) : claims.length === 0 ? (
                            <div className="text-center py-10 text-gray-600 dark:text-gray-400">{t('adminClaims.noClaims')}</div>
                        ) : (
                            claims.map(claim => (
                                <div key={claim.id} className="bg-gray-50 dark:bg-zinc-700/50 p-3 rounded-lg border dark:border-zinc-600">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-bold text-gray-900 dark:text-gray-100">#{claim.id}</span>
                                        <StatusBadge status={claim.status} />
                                    </div>
                                    <div className="space-y-1.5 text-sm">
                                        <p><span className="text-gray-600 dark:text-gray-400">{t('adminClaims.headerUser')}:</span> <span className="text-gray-900 dark:text-gray-100">{claim.profiles?.name || t('adminClaims.userNotFound')}</span></p>
                                        <p><span className="text-gray-600 dark:text-gray-400">{t('adminClaims.headerBusiness')}:</span> <span className="text-gray-900 dark:text-gray-100 font-medium">{claim.businesses?.name || t('adminClaims.businessDeleted')}</span></p>
                                        <p><span className="text-gray-600 dark:text-gray-400">{t('adminClaims.headerDate')}:</span> <span className="text-gray-900 dark:text-gray-100">{new Date(claim.created_at).toLocaleDateString()}</span></p>
                                    </div>
                                    <button
                                        onClick={() => handleOpenModal(claim)}
                                        className="w-full mt-3 py-2 px-3 bg-brand-green text-white rounded-lg hover:bg-opacity-90 transition-colors text-sm font-medium"
                                    >
                                        {t('adminClaims.reviewAction')}
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {isActionModalOpen && selectedClaim && (
                <Modal title={t('adminClaims.reviewModalTitle', { id: selectedClaim.id })} onClose={() => setIsActionModalOpen(false)}>
                    <div className="py-4 space-y-4">
                        <div className="text-sm space-y-3">
                            <p><strong>{t('adminClaims.modalUser')}</strong> {selectedClaim.profiles?.name} (@{selectedClaim.profiles?.username})</p>
                            <p><strong>{t('adminClaims.modalBusiness')}</strong> {selectedClaim.businesses?.name}</p>
                            <p><strong>{t('adminClaims.modalOpynioUrl')}</strong> <a href={selectedClaim.opynio_url || '#'} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{selectedClaim.opynio_url}</a></p>
                        </div>
                        <div className="p-3 bg-gray-50 dark:bg-zinc-700/50 rounded-lg border dark:border-zinc-600 text-sm">
                            <h4 className="font-semibold mb-2">{t('adminClaims.modalVerificationInfo')}</h4>
                            <p><strong>{t('adminClaims.modalWebsite')}</strong> <a href={(selectedClaim.user_provided_info as any)?.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{(selectedClaim.user_provided_info as any)?.websiteUrl}</a></p>
                            <p><strong>{t('adminClaims.modalPhone')}</strong> {(selectedClaim.user_provided_info as any)?.phone}</p>
                            <p className="mt-2"><strong>{t('adminClaims.modalComments')}</strong><br/>{(selectedClaim.user_provided_info as any)?.comments || t('adminClaims.modalNoComments')}</p>
                        </div>
                        <div>
                            <label htmlFor="adminNotes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('adminDashboard.adminNotes')}</label>
                            <textarea
                                id="adminNotes"
                                value={adminNotes}
                                onChange={(e) => setAdminNotes(e.target.value)}
                                rows={3}
                                className="w-full p-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-transparent"
                            />
                        </div>
                        <div className="flex justify-end gap-3 pt-4 border-t dark:border-zinc-700">
                            <button onClick={() => handleResolveClaim('rejected')} disabled={isSubmitting} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:bg-gray-400">{t('adminClaims.rejectAction')}</button>
                            <button onClick={() => handleResolveClaim('approved')} disabled={isSubmitting} className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-gray-400">{isSubmitting ? t('common.processing') : t('adminClaims.approveAction')}</button>
                        </div>
                    </div>
                </Modal>
            )}
        </>
    );
};

export default AdminClaimsPage;