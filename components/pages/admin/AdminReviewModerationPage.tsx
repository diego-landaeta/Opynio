import React, { useState, useEffect, useCallback } from 'react';
import { getAdminReviews, adminUpdateReviewStatus } from '../../../services/supabaseService';
import { useNotification } from '../../../contexts/NotificationContext';
import type { Review } from '../../../types';
import Meta from '../../Meta';
import Spinner from '../../Spinner';
import ReviewCard from '../../ReviewCard';
import Modal from '../../Modal';
import { useTranslation } from '../../../contexts/i18nContext';

const PAGE_SIZE = 10;
type ActiveTab = 'pending' | 'approved' | 'rejected';

const AdminReviewModerationPage: React.FC = () => {
    const { showNotification } = useNotification();
    const t = useTranslation();
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<ActiveTab>('pending');
    
    const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false);
    const [selectedReview, setSelectedReview] = useState<Review | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    const fetchReviews = useCallback(async (status: ActiveTab, page: number) => {
        setLoading(true);
        try {
            const data = await getAdminReviews({ status }, page, PAGE_SIZE);
            setReviews(data);
            setHasMore(data.length === PAGE_SIZE);
        } catch (error: any) {
            showNotification(error.message || `Error al cargar reseñas ${status}.`, 'error');
        } finally {
            setLoading(false);
        }
    }, [showNotification]);

    useEffect(() => {
        fetchReviews(activeTab, currentPage);
    }, [activeTab, currentPage, fetchReviews]);
    
    const handleTabChange = (tab: ActiveTab) => {
        setActiveTab(tab);
        setCurrentPage(1); // Reset page when tab changes
    };

    const handleUpdateStatus = async (reviewId: number, newStatus: 'approved' | 'rejected', reason: string | null = null) => {
        setIsSubmitting(true);
        try {
            await adminUpdateReviewStatus(reviewId, newStatus, reason);
            showNotification(`Reseña ${newStatus === 'approved' ? 'aprobada' : 'rechazada'}.`, 'success');
            // Optimistic update: remove from list instead of refetching
            setReviews(prev => prev.filter(r => r.id !== reviewId));
        } catch (error: any) {
            showNotification(error.message || 'Error al actualizar el estado.', 'error');
            // On error, refetch to get consistent state
            fetchReviews(activeTab, currentPage);
        } finally {
            setIsSubmitting(false);
            if (newStatus === 'rejected') {
                setIsRejectionModalOpen(false);
                setSelectedReview(null);
                setRejectionReason('');
            }
        }
    };
    
    const handleOpenRejectionModal = (review: Review) => {
        setSelectedReview(review);
        setIsRejectionModalOpen(true);
    };

    const handleRejectionSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedReview) {
            handleUpdateStatus(selectedReview.id, 'rejected', rejectionReason.trim());
        }
    };

    const TabButton: React.FC<{ tab: ActiveTab; label: string }> = ({ tab, label }) => (
        <button
            onClick={() => handleTabChange(tab)}
            className={`px-3 sm:px-4 py-2 text-sm sm:text-base font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab
                ? 'border-brand-green text-brand-green'
                : 'border-transparent text-gray-500 hover:text-brand-dark dark:text-gray-400 dark:hover:text-gray-200'
            }`}
        >
            {label}
        </button>
    );

    return (
        <>
            <Meta title={`${t('adminReviewModeration.title')} - Admin`} description="Aprueba o rechaza nuevas reseñas enviadas por los usuarios." />
            <div className="space-y-6">
                <h1 className="text-3xl font-extrabold text-gray-800 dark:text-gray-100">{t('adminReviewModeration.title')}</h1>
                
                <div className="bg-white dark:bg-zinc-800 p-3 sm:p-6 rounded-xl shadow-md border dark:border-zinc-700">
                    <div className="border-b dark:border-zinc-700 mb-4 sm:mb-6 overflow-x-auto">
                        <nav className="-mb-px flex space-x-2 sm:space-x-6">
                            <TabButton tab="pending" label={t('adminReviewModeration.pending')} />
                            <TabButton tab="approved" label={t('adminReviewModeration.approved')} />
                            <TabButton tab="rejected" label={t('adminReviewModeration.rejected')} />
                        </nav>
                    </div>

                    {loading ? (
                        <div className="flex justify-center items-center h-64"><Spinner /></div>
                    ) : reviews.length === 0 ? (
                        <div className="text-center py-16 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-900/50 rounded-lg">
                            <p className="font-semibold text-lg">{t('adminReviewModeration.noReviews')}</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {reviews.map(review => (
                                <div key={review.id} className="relative group">
                                    <ReviewCard review={review} showBusinessName={true} />
                                    <div className="absolute top-2 right-2 sm:top-4 sm:right-4 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm p-1.5 sm:p-2 rounded-lg shadow-lg opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center gap-1.5 sm:gap-2">
                                        {activeTab !== 'approved' && (
                                            <button
                                                onClick={() => handleUpdateStatus(review.id, 'approved')}
                                                className="bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-300 dark:hover:bg-green-900/80 font-bold py-1.5 px-2 sm:py-2 sm:px-3 rounded-md text-xs sm:text-sm"
                                                title={t('adminReviewModeration.approveAction')}
                                                disabled={isSubmitting}
                                            >
                                                <i className="fa-solid fa-check"></i>
                                            </button>
                                        )}
                                        {activeTab !== 'rejected' && (
                                            <button
                                                onClick={() => handleOpenRejectionModal(review)}
                                                className="bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300 dark:hover:bg-red-900/80 font-bold py-1.5 px-2 sm:py-2 sm:px-3 rounded-md text-xs sm:text-sm"
                                                title={t('adminReviewModeration.rejectAction')}
                                                disabled={isSubmitting}
                                            >
                                                <i className="fa-solid fa-times"></i>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {(!loading && reviews.length > 0) && (
                        <div className="flex justify-between items-center mt-4 sm:mt-6 pt-4 border-t dark:border-zinc-700">
                            <button
                                onClick={() => setCurrentPage(p => p - 1)}
                                disabled={currentPage === 1 || isSubmitting}
                                className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-600 disabled:opacity-50"
                            >
                                {t('common.previous')}
                            </button>
                            <span className="text-xs sm:text-sm font-medium dark:text-gray-400">
                                {t('common.page', { current: currentPage, total: '...' })}
                            </span>
                            <button
                                onClick={() => setCurrentPage(p => p + 1)}
                                disabled={!hasMore || isSubmitting}
                                className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-600 disabled:opacity-50"
                            >
                                {t('common.next')}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {isRejectionModalOpen && selectedReview && (
                <Modal title={t('adminReviewModeration.rejectModalTitle')} onClose={() => setIsRejectionModalOpen(false)}>
                    <form onSubmit={handleRejectionSubmit} className="py-4 space-y-4">
                        <p className="text-sm text-gray-600 dark:text-gray-300" dangerouslySetInnerHTML={{ __html: t('adminReviewModeration.rejectModalSubtitle', { userName: selectedReview.profiles?.name || 'Anónimo', businessName: selectedReview.businesses.name }) }} />
                        <div>
                            <label htmlFor="rejectionReason" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('adminReviewModeration.rejectionReasonLabel')}</label>
                            <textarea
                                id="rejectionReason"
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                rows={3}
                                placeholder={t('adminReviewModeration.rejectionReasonPlaceholder')}
                                className="w-full p-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-transparent"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('adminReviewModeration.rejectionReasonNote')}</p>
                        </div>
                        <div className="flex justify-end gap-3 pt-4 border-t dark:border-zinc-700">
                            <button type="button" onClick={() => setIsRejectionModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-zinc-700 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600">{t('common.cancel')}</button>
                            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:bg-gray-400">
                                {isSubmitting ? t('adminReviewModeration.rejecting') : t('adminReviewModeration.confirmRejection')}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </>
    );
};

export default AdminReviewModerationPage;