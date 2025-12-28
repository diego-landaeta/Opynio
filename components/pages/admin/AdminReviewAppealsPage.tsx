import React, { useState, useEffect, useCallback } from 'react';
import { getAdminReviewAppeals, resolveReviewAppeal } from '../../../services/supabaseService';
import type { ReviewAppeal } from '../../../types';
import { useNotification } from '../../../contexts/NotificationContext';
import Spinner from '../../Spinner';
import Meta from '../../Meta';
import Modal from '../../Modal';
import ReviewCard from '../../ReviewCard';
import { useTranslation } from '../../../contexts/i18nContext';

type ActiveTab = 'pending' | 'approved' | 'rejected' | 'all';

const AdminReviewAppealsPage: React.FC = () => {
    const { showNotification } = useNotification();
    const t = useTranslation();
    const [appeals, setAppeals] = useState<ReviewAppeal[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<ActiveTab>('pending');
    
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);
    const [selectedAppeal, setSelectedAppeal] = useState<ReviewAppeal | null>(null);
    const [adminNotes, setAdminNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchAppeals = useCallback(async (status: ActiveTab) => {
        setLoading(true);
        try {
            const data = await getAdminReviewAppeals({ status: status === 'all' ? 'all' : status });
            setAppeals(data);
        } catch (error: any) {
            showNotification(error.message || `Error al cargar las apelaciones.`, 'error');
        } finally {
            setLoading(false);
        }
    }, [showNotification]);

    useEffect(() => {
        fetchAppeals(activeTab);
    }, [activeTab, fetchAppeals]);
    
    const handleResolveAppeal = async (newStatus: 'approved' | 'rejected') => {
        if (!selectedAppeal) return;
        setIsSubmitting(true);
        try {
            await resolveReviewAppeal(selectedAppeal.id, newStatus, adminNotes);
            showNotification(`Apelación #${selectedAppeal.id} ha sido ${newStatus === 'approved' ? 'aprobada' : 'rechazada'}.`, 'success');
            setAppeals(prev => prev.filter(a => a.id !== selectedAppeal.id));
            setIsActionModalOpen(false);
        } catch (error: any) {
            showNotification(error.message || 'Error al resolver la apelación.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleOpenModal = (appeal: ReviewAppeal) => {
        setSelectedAppeal(appeal);
        setAdminNotes(appeal.admin_notes || '');
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
    
    const StatusBadge: React.FC<{ status: ReviewAppeal['status'] }> = ({ status }) => {
        const styles = {
            pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
            approved: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
            rejected: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
        };
        return <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${styles[status]}`}>{t(`adminReviewAppeals.${status}`)}</span>;
    };

    return (
        <>
            <Meta title={`${t('adminReviewAppeals.title')} - Admin`} description="Revisa y gestiona las apelaciones de reseñas rechazadas." />
            <div className="space-y-6">
                <h1 className="text-3xl font-extrabold text-gray-800 dark:text-gray-100">{t('adminReviewAppeals.title')}</h1>
                
                <div className="bg-white dark:bg-zinc-800 p-3 sm:p-6 rounded-xl shadow-md border dark:border-zinc-700">
                    <div className="border-b dark:border-zinc-700 mb-4 sm:mb-6 overflow-x-auto">
                        <nav className="-mb-px flex space-x-2 sm:space-x-6">
                            <TabButton tab="pending" label={t('adminReviewAppeals.pending')} />
                            <TabButton tab="approved" label={t('adminReviewAppeals.approved')} />
                            <TabButton tab="rejected" label={t('adminReviewAppeals.rejected')} />
                            <TabButton tab="all" label={t('common.all')} />
                        </nav>
                    </div>

                    {/* Desktop table view */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-600 dark:text-gray-400">
                            <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-zinc-700">
                                <tr>
                                    <th scope="col" className="px-6 py-3">{t('adminReviewAppeals.headerTicketId')}</th>
                                    <th scope="col" className="px-6 py-3">{t('adminReviewAppeals.headerUser')}</th>
                                    <th scope="col" className="px-6 py-3">{t('adminReviewAppeals.headerReviewTitle')}</th>
                                    <th scope="col" className="px-6 py-3">{t('adminReviewAppeals.headerDate')}</th>
                                    <th scope="col" className="px-6 py-3">{t('adminReviewAppeals.headerStatus')}</th>
                                    <th scope="col" className="px-6 py-3 text-right">{t('common.actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={6} className="text-center py-10"><Spinner /></td></tr>
                                ) : appeals.length === 0 ? (
                                    <tr><td colSpan={6} className="text-center py-10">{t('adminReviewAppeals.noAppeals')}</td></tr>
                                ) : (
                                    appeals.map(appeal => (
                                        <tr key={appeal.id} className="bg-white dark:bg-zinc-800 border-b dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700/50">
                                            <td className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100">#{appeal.id}</td>
                                            <td className="px-6 py-4">{appeal.profiles?.name || 'Usuario no encontrado'}</td>
                                            <td className="px-6 py-4 truncate max-w-sm" title={appeal.reviews?.title}>{appeal.reviews?.title || 'Reseña no disponible'}</td>
                                            <td className="px-6 py-4">{new Date(appeal.created_at).toLocaleDateString()}</td>
                                            <td className="px-6 py-4"><StatusBadge status={appeal.status} /></td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => handleOpenModal(appeal)} className="font-medium text-brand-green hover:underline">{t('adminReviewAppeals.reviewAction')}</button>
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
                        ) : appeals.length === 0 ? (
                            <div className="text-center py-10 text-gray-600 dark:text-gray-400">{t('adminReviewAppeals.noAppeals')}</div>
                        ) : (
                            appeals.map(appeal => (
                                <div key={appeal.id} className="bg-gray-50 dark:bg-zinc-700/50 p-3 rounded-lg border dark:border-zinc-600">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-bold text-gray-900 dark:text-gray-100">#{appeal.id}</span>
                                        <StatusBadge status={appeal.status} />
                                    </div>
                                    <div className="space-y-1.5 text-sm">
                                        <p><span className="text-gray-600 dark:text-gray-400">{t('adminReviewAppeals.headerUser')}:</span> <span className="text-gray-900 dark:text-gray-100">{appeal.profiles?.name || 'Usuario no encontrado'}</span></p>
                                        <p className="text-gray-900 dark:text-gray-100 font-medium line-clamp-2">{appeal.reviews?.title || 'Reseña no disponible'}</p>
                                        <p><span className="text-gray-600 dark:text-gray-400">{t('adminReviewAppeals.headerDate')}:</span> <span className="text-gray-900 dark:text-gray-100">{new Date(appeal.created_at).toLocaleDateString()}</span></p>
                                    </div>
                                    <button
                                        onClick={() => handleOpenModal(appeal)}
                                        className="w-full mt-3 py-2 px-3 bg-brand-green text-white rounded-lg hover:bg-opacity-90 transition-colors text-sm font-medium"
                                    >
                                        {t('adminReviewAppeals.reviewAction')}
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {isActionModalOpen && selectedAppeal && (
                <Modal title={t('adminReviewAppeals.reviewModalTitle', { id: selectedAppeal.id })} onClose={() => setIsActionModalOpen(false)}>
                    <div className="py-4 space-y-4 text-left">
                        <div className="text-sm space-y-3">
                            <p><strong>{t('adminReviewAppeals.modalUser')}</strong> {selectedAppeal.profiles?.name} (@{selectedAppeal.profiles?.username})</p>
                             <div className="p-3 bg-gray-50 dark:bg-zinc-700/50 rounded-lg border dark:border-zinc-600">
                                <h4 className="font-semibold mb-1">{t('adminReviewAppeals.modalReason')}</h4>
                                <p className="whitespace-pre-wrap">{selectedAppeal.reason}</p>
                            </div>
                            <div className="p-3 bg-gray-50 dark:bg-zinc-700/50 rounded-lg border dark:border-zinc-600">
                                <h4 className="font-semibold mb-2">{t('adminReviewAppeals.modalOriginalReview')}</h4>
                                {selectedAppeal.reviews ? <ReviewCard review={selectedAppeal.reviews} /> : <p>Detalles de la reseña no disponibles.</p>}
                            </div>
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
                            <button onClick={() => handleResolveAppeal('rejected')} disabled={isSubmitting} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:bg-gray-400">{t('adminReviewAppeals.rejectAction')}</button>
                            <button onClick={() => handleResolveAppeal('approved')} disabled={isSubmitting} className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-gray-400">{isSubmitting ? t('common.processing') : t('adminReviewAppeals.approveAction')}</button>
                        </div>
                    </div>
                </Modal>
            )}
        </>
    );
};

export default AdminReviewAppealsPage;
