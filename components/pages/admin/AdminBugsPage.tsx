import React, { useState, useEffect, useCallback } from 'react';
import { getAdminBugReports, updateBugReport } from '../../../services/supabaseService';
import type { BugReport } from '../../../types';
import { useNotification } from '../../../contexts/NotificationContext';
import Spinner from '../../Spinner';
import Meta from '../../Meta';
import Modal from '../../Modal';
import { useTranslation } from '../../../contexts/i18nContext';

type ActiveTab = 'open' | 'in_progress' | 'resolved' | 'all';

const AdminBugsPage: React.FC = () => {
    const { showNotification } = useNotification();
    const t = useTranslation();
    const [bugs, setBugs] = useState<BugReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<ActiveTab>('open');
    
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);
    const [selectedBug, setSelectedBug] = useState<BugReport | null>(null);
    const [adminNotes, setAdminNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchBugs = useCallback(async (status: ActiveTab) => {
        setLoading(true);
        try {
            const data = await getAdminBugReports(status === 'all' ? undefined : status);
            setBugs(data);
        } catch (error: any) {
            showNotification(error.message || t('adminBugsPage.errorLoadingBugs'), 'error');
        } finally {
            setLoading(false);
        }
    }, [showNotification, t]);

    useEffect(() => {
        fetchBugs(activeTab);
    }, [activeTab, fetchBugs]);
    
    const handleUpdateStatus = async (newStatus: 'in_progress' | 'resolved') => {
        if (!selectedBug) return;
        setIsSubmitting(true);
        try {
            await updateBugReport(selectedBug.id, {
                status: newStatus,
                admin_notes: adminNotes,
            });
            showNotification(t('adminBugsPage.bugUpdatedSuccess', { id: selectedBug.id, status: newStatus }), 'success');
            setBugs(prev => prev.filter(b => b.id !== selectedBug.id));
            setIsActionModalOpen(false);
        } catch (error: any) {
            showNotification(error.message || t('adminBugsPage.errorUpdatingBug'), 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteBug = async () => {
        if (!selectedBug) return;
        setIsSubmitting(true);
        try {
            await updateBugReport(selectedBug.id, { status: 'closed' });
            showNotification(t('adminBugsPage.bugDeleted', { id: selectedBug.id }), 'success');
            setBugs(prev => prev.filter(b => b.id !== selectedBug.id));
            setIsActionModalOpen(false);
        } catch (error: any) {
            showNotification(error.message || t('adminBugsPage.errorDeletingBug'), 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOpenModal = (bug: BugReport) => {
        setSelectedBug(bug);
        setAdminNotes(bug.admin_notes || '');
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
    
    const StatusBadge: React.FC<{ status: BugReport['status'] }> = ({ status }) => {
        const styles = {
            open: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
            in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
            resolved: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
            closed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300',
        };
        const statusKey = status;
        return <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${styles[status]}`}>{t(`adminBugsPage.${statusKey}`)}</span>;
    };

    return (
        <>
            <Meta title={t('adminBugsPage.title') + " - Admin"} description="Revisa y gestiona los reportes de bugs enviados por los usuarios." />
            <div className="space-y-6">
                <h1 className="text-3xl font-extrabold text-gray-800 dark:text-gray-100">{t('adminBugsPage.title')}</h1>
                
                <div className="bg-white dark:bg-zinc-800 p-3 sm:p-6 rounded-xl shadow-md border dark:border-zinc-700">
                    <div className="border-b dark:border-zinc-700 mb-4 sm:mb-6 overflow-x-auto">
                        <nav className="-mb-px flex space-x-2 sm:space-x-6">
                            <TabButton tab="open" label={t('adminBugsPage.open')} />
                            <TabButton tab="in_progress" label={t('adminBugsPage.in_progress')} />
                            <TabButton tab="resolved" label={t('adminBugsPage.resolved')} />
                            <TabButton tab="all" label={t('common.all')} />
                        </nav>
                    </div>

                    {/* Desktop table view */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-600 dark:text-gray-400">
                            <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-zinc-700">
                                <tr>
                                    <th scope="col" className="px-6 py-3">{t('adminBugsPage.ticketId')}</th>
                                    <th scope="col" className="px-6 py-3">{t('adminBugsPage.user')}</th>
                                    <th scope="col" className="px-6 py-3">{t('adminBugsPage.page')}</th>
                                    <th scope="col" className="px-6 py-3">{t('adminBugsPage.description')}</th>
                                    <th scope="col" className="px-6 py-3">{t('adminBugsPage.date')}</th>
                                    <th scope="col" className="px-6 py-3">{t('adminBugsPage.status')}</th>
                                    <th scope="col" className="px-6 py-3 text-right">{t('adminBugsPage.actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={7} className="text-center py-10"><Spinner /></td></tr>
                                ) : bugs.length === 0 ? (
                                    <tr><td colSpan={7} className="text-center py-10">{t('adminBugsPage.noReports')}</td></tr>
                                ) : (
                                    bugs.map(bug => (
                                        <tr key={bug.id} className="bg-white dark:bg-zinc-800 border-b dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700/50">
                                            <td className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100">#{bug.id}</td>
                                            <td className="px-6 py-4">{bug.profiles?.name || t('adminBugsPage.userNotFound')}</td>
                                            <td className="px-6 py-4"><a href={bug.page_url || '#'} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline truncate max-w-xs block">{bug.page_url || 'N/A'}</a></td>
                                            <td className="px-6 py-4 truncate max-w-sm" title={bug.description}>{bug.description}</td>
                                            <td className="px-6 py-4">{new Date(bug.created_at).toLocaleDateString()}</td>
                                            <td className="px-6 py-4"><StatusBadge status={bug.status} /></td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => handleOpenModal(bug)} className="font-medium text-brand-green hover:underline">{t('adminBugsPage.review')}</button>
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
                        ) : bugs.length === 0 ? (
                            <div className="text-center py-10 text-gray-600 dark:text-gray-400">{t('adminBugsPage.noReports')}</div>
                        ) : (
                            bugs.map(bug => (
                                <div key={bug.id} className="bg-gray-50 dark:bg-zinc-700/50 p-3 rounded-lg border dark:border-zinc-600">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-bold text-gray-900 dark:text-gray-100">#{bug.id}</span>
                                        <StatusBadge status={bug.status} />
                                    </div>
                                    <div className="space-y-1.5 text-sm">
                                        <p><span className="text-gray-600 dark:text-gray-400">{t('adminBugsPage.user')}:</span> <span className="text-gray-900 dark:text-gray-100">{bug.profiles?.name || t('adminBugsPage.userNotFound')}</span></p>
                                        <p className="text-gray-900 dark:text-gray-100 line-clamp-2">{bug.description}</p>
                                        <p><span className="text-gray-600 dark:text-gray-400">{t('adminBugsPage.date')}:</span> <span className="text-gray-900 dark:text-gray-100">{new Date(bug.created_at).toLocaleDateString()}</span></p>
                                        {bug.page_url && (
                                            <a href={bug.page_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-xs truncate block">
                                                {bug.page_url}
                                            </a>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleOpenModal(bug)}
                                        className="w-full mt-3 py-2 px-3 bg-brand-green text-white rounded-lg hover:bg-opacity-90 transition-colors text-sm font-medium"
                                    >
                                        {t('adminBugsPage.review')}
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {isActionModalOpen && selectedBug && (
                <Modal title={t('adminBugsPage.reviewBugReport', { id: selectedBug.id })} onClose={() => setIsActionModalOpen(false)}>
                    <div className="py-4 space-y-4 text-left">
                        <div className="text-sm space-y-3">
                            <p><strong>{t('adminBugsPage.user')}:</strong> {selectedBug.profiles?.name} (@{selectedBug.profiles?.username})</p>
                            <p><strong>{t('adminBugsPage.errorPageURL')}:</strong> <a href={selectedBug.page_url || '#'} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{selectedBug.page_url || t('adminBugsPage.notProvided')}</a></p>
                             <div className="p-3 bg-gray-50 dark:bg-zinc-700/50 rounded-lg border dark:border-zinc-600">
                                <h4 className="font-semibold mb-1">{t('adminBugsPage.bugDescription')}</h4>
                                <p className="whitespace-pre-wrap">{selectedBug.description}</p>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="adminNotes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('adminBugsPage.adminNotes')}</label>
                            <textarea
                                id="adminNotes"
                                value={adminNotes}
                                onChange={(e) => setAdminNotes(e.target.value)}
                                rows={3}
                                className="w-full p-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-transparent"
                            />
                        </div>
                        <div className="flex justify-between gap-3 pt-4 border-t dark:border-zinc-700">
                            <button onClick={() => handleDeleteBug()} disabled={isSubmitting} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:bg-gray-400">
                                {isSubmitting ? t('common.deleting') : t('common.delete')}
                            </button>
                            <div className="flex gap-3">
                                {selectedBug.status === 'open' && (
                                    <button onClick={() => handleUpdateStatus('in_progress')} disabled={isSubmitting} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400">{t('adminBugsPage.markInProgress')}</button>
                                )}
                                {selectedBug.status !== 'resolved' && (
                                    <button onClick={() => handleUpdateStatus('resolved')} disabled={isSubmitting} className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-gray-400">{isSubmitting ? t('adminBugsPage.processing') : t('adminBugsPage.markResolved')}</button>
                                )}
                            </div>
                        </div>
                    </div>
                </Modal>
            )} 
        </>
    );
};

export default AdminBugsPage;
