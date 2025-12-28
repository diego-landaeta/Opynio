import React, { useState } from 'react';
import { useBusinessDashboard } from '../../../../contexts/BusinessDashboardContext';
import { useAuth } from '../../../../contexts/AuthContext';
import { Plan } from '../../../../types';
import * as ReactRouterDOM from 'react-router-dom';
import { useNotification } from '../../../../contexts/NotificationContext';
import { supabase } from '../../../../services/supabaseService';
import Spinner from '../../../Spinner';
import { useTranslation } from '../../../../contexts/i18nContext';

const PLAN_HIERARCHY: Record<Plan, number> = {
    free: 0,
    starter: 1,
    growth: 2,
    pro: 3,
    enterprise: 4,
};

const FeatureLock: React.FC<{ requiredPlan: Plan, featureName: string, children: React.ReactNode }> = ({ requiredPlan, featureName, children }) => {
    const { profile } = useAuth();
    const t = useTranslation();

    if (!profile) {
        return null;
    }

    const currentPlanLevel = PLAN_HIERARCHY[profile.plan];
    const requiredPlanLevel = PLAN_HIERARCHY[requiredPlan];

    if (currentPlanLevel >= requiredPlanLevel) {
        return <>{children}</>;
    }

    return (
        <div className="text-center p-6 sm:p-8 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border-2 border-dashed dark:border-zinc-700">
            <div className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-300 rounded-full w-14 h-14 sm:w-16 sm:h-16 inline-flex items-center justify-center shadow-sm border-4 border-white dark:border-zinc-800 mb-3 sm:mb-4">
                <i className="fa-solid fa-lock text-2xl sm:text-3xl"></i>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100">{featureName}</h2>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-2 max-w-md mx-auto">
                {t('businessDashboard.invitationsLockSubtitle')}
            </p>
            <ReactRouterDOM.Link
                to="/planes"
                className="mt-4 sm:mt-6 inline-block bg-brand-green text-white font-bold px-6 sm:px-8 py-2.5 sm:py-3 rounded-md hover:bg-opacity-90 transition-all shadow-lg shadow-brand-green/30 text-base sm:text-lg"
            >
                {t('businessDashboard.upgradePlanButton')}
            </ReactRouterDOM.Link>
        </div>
    );
};

const DashboardInvitations: React.FC = () => {
    const { business } = useBusinessDashboard();
    const { showNotification } = useNotification();
    const t = useTranslation();
    const [emails, setEmails] = useState('');
    const [customMessage, setCustomMessage] = useState('');
    const [isSending, setIsSending] = useState(false);

    if (!business) {
        return <div className="flex justify-center items-center h-48 sm:h-64"><Spinner /></div>;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const emailList = emails.split(/[\n,;]+/).map(e => e.trim()).filter(e => e);
        if(emailList.length === 0) {
            showNotification(t('businessDashboard.pleaseEnterOneEmail'), 'error');
            return;
        }

        setIsSending(true);
        try {
            const { error } = await supabase.functions.invoke('send-invitation-email', {
                body: {
                    businessName: business.name,
                    businessId: business.id,
                    emails: emailList,
                    message: customMessage
                }
            });
            if (error) throw error;
            showNotification(`Invitaciones enviadas a ${emailList.length} destinatarios.`, 'success');
            setEmails('');
            setCustomMessage('');
        } catch (error: any) {
            showNotification(error.details || error.message || 'Error al enviar las invitaciones.', 'error');
        } finally {
            setIsSending(false);
        }
    };
    
    return (
        <div className="space-y-5 sm:space-y-6 md:space-y-8">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-gray-800 dark:text-gray-100">{t('businessDashboard.sendInvitationsTitle')}</h1>

            <FeatureLock requiredPlan="starter" featureName={t('businessDashboard.invitationsLockFeatureName')}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 lg:gap-8">
                    <div className="bg-white dark:bg-zinc-800 p-4 sm:p-5 md:p-6 rounded-lg sm:rounded-xl shadow-sm border dark:border-zinc-700">
                        <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-gray-800 dark:text-gray-100">{t('businessDashboard.sendNewInvitationsTitle')}</h2>
                        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                            <div>
                                <label htmlFor="emails" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('businessDashboard.customerEmailsLabel')}</label>
                                <textarea
                                    id="emails"
                                    rows={5}
                                    value={emails}
                                    onChange={e => setEmails(e.target.value)}
                                    placeholder={t('businessDashboard.customerEmailsPlaceholder')}
                                    className="w-full p-2 sm:p-2.5 border border-gray-300 dark:border-zinc-600 rounded-lg bg-transparent text-sm sm:text-base"
                                    required
                                />
                            </div>
                             <div>
                                <label htmlFor="customMessage" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('businessDashboard.customMessageLabel')}</label>
                                <textarea
                                    id="customMessage"
                                    rows={3}
                                    value={customMessage}
                                    onChange={e => setCustomMessage(e.target.value)}
                                    placeholder={t('businessDashboard.customMessagePlaceholder')}
                                    className="w-full p-2 sm:p-2.5 border border-gray-300 dark:border-zinc-600 rounded-lg bg-transparent text-sm sm:text-base"
                                />
                            </div>
                             <button type="submit" disabled={isSending} className="w-full bg-brand-green text-white font-bold py-2.5 sm:py-3 px-5 sm:px-6 rounded-lg hover:bg-opacity-90 transition-colors shadow-sm disabled:bg-gray-400 flex items-center justify-center gap-2 text-sm sm:text-base">
                                {isSending && <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                                <span>{isSending ? t('common.sending') : t('businessDashboard.sendInvitationsButton')}</span>
                            </button>
                        </form>
                    </div>
                    <div className="bg-white dark:bg-zinc-800 p-4 sm:p-5 md:p-6 rounded-lg sm:rounded-xl shadow-sm border dark:border-zinc-700">
                        <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-gray-800 dark:text-gray-100">{t('businessDashboard.invitationsHistoryTitle')}</h2>
                        <div className="text-center py-12 sm:py-16 text-sm sm:text-base text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-900/50 rounded-lg">
                            <i className="fa-solid fa-history text-3xl sm:text-4xl mb-3 sm:mb-4 text-gray-400"></i>
                            <p className="font-semibold">{t('common.comingSoon')}</p>
                            <p className="text-xs sm:text-sm mt-1">{t('businessDashboard.invitationsHistorySubtitle')}</p>
                        </div>
                    </div>
                </div>
            </FeatureLock>
        </div>
    );
};

export default DashboardInvitations;