import React, { useState, useEffect } from 'react';
import { useBusinessDashboard } from '../../../../contexts/BusinessDashboardContext';
import { useNotification } from '../../../../contexts/NotificationContext';
import { supabase, getBusinessProducts } from '../../../../services/supabaseService';
import { useUserErrorNotifier } from '../../../../utils/userFacingError';
import Spinner from '../../../Spinner';
import { useTranslation } from '../../../../contexts/i18nContext';
import { usePluralT } from '../../../../utils/plural';
import SectionLock from './SectionLock';

const DashboardInvitations: React.FC = () => {
    const { business } = useBusinessDashboard();
    const { showNotification } = useNotification();
    const { notifyError } = useUserErrorNotifier();
    const t = useTranslation();
    const tn = usePluralT();
    const [emails, setEmails] = useState('');
    const [customMessage, setCustomMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    // Pedir reseña de un curso concreto: sin esto, el cliente recibe una
    // invitación genérica y luego no se sabe de qué producto hablaba.
    const [products, setProducts] = useState<any[]>([]);
    const [productId, setProductId] = useState('');

    useEffect(() => {
        if (!business?.id) return;
        let cancelado = false;
        getBusinessProducts(business.id)
            .then(list => { if (!cancelado) setProducts(list.filter((p: any) => p.is_active)); })
            .catch(() => { /* sin productos o sin tablas: invitación normal */ });
        return () => { cancelado = true; };
    }, [business?.id]);

    if (!business) {
        return <div className="flex justify-center items-center h-48 sm:h-64"><Spinner /></div>;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // El texto de ayuda promete "coma, espacio o nueva línea"; el espacio
        // no separaba y "a@x.com b@y.com" viajaba como un solo email.
        const emailList = emails.split(/[\s,;]+/).map(e => e.trim()).filter(e => e);
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
                    message: customMessage,
                    // El nombre del producto viaja al webhook para que el correo
                    // pueda decir de qué curso se pide la reseña.
                    productName: products.find(p => p.id === productId)?.name || null,
                    productId: productId || null,
                }
            });
            if (error) throw error;
            showNotification(tn('businessDashboard.invitationsSentToast', emailList.length), 'success');
            setEmails('');
            setCustomMessage('');
        } catch (error) {
            // Traducido: plan insuficiente → Planes; limite de 24 h; emails no
            // validos; fallo del servicio → Soporte. Antes salia el texto de la
            // funcion en espanol para todos los idiomas.
            await notifyError(error, { flow: 'invitations' });
        } finally {
            setIsSending(false);
        }
    };
    
    return (
        <div className="space-y-5 sm:space-y-6 md:space-y-8">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-gray-800 dark:text-gray-100">{t('businessDashboard.sendInvitationsTitle')}</h1>

            <SectionLock section="invitations" title={t('businessDashboard.invitationsLockFeatureName')} subtitleKey="businessDashboard.invitationsLockSubtitle">
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
                            {products.length > 0 && (
                                <div>
                                    <label htmlFor="invitation-product" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        {t('businessDashboard.invitationProductLabel')}
                                    </label>
                                    <select
                                        id="invitation-product"
                                        value={productId}
                                        onChange={e => setProductId(e.target.value)}
                                        className="w-full p-2 sm:p-2.5 border border-gray-300 dark:border-zinc-600 rounded-lg bg-transparent text-sm sm:text-base text-gray-800 dark:text-gray-100"
                                    >
                                        <option value="">{t('businessDashboard.invitationProductNone')}</option>
                                        {products.map(product => (
                                            <option key={product.id} value={product.id}>{product.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
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
            </SectionLock>
        </div>
    );
};

export default DashboardInvitations;