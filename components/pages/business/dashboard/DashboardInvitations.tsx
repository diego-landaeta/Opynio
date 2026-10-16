import React, { useState, useEffect, useCallback } from 'react';
import { useBusinessDashboard } from '../../../../contexts/BusinessDashboardContext';
import { useNotification } from '../../../../contexts/NotificationContext';
import { supabase, getBusinessProducts } from '../../../../services/supabaseService';
import { useUserErrorNotifier } from '../../../../utils/userFacingError';
import Spinner from '../../../Spinner';
import { useTranslation, useI18n, toBcp47 } from '../../../../contexts/i18nContext';
import { usePluralT } from '../../../../utils/plural';
import SectionLock from './SectionLock';
import { useAuth } from '../../../../contexts/AuthContext';
import { getSectionAccess } from '../../../../utils/planFeatures';

type InvitationRow = {
    id: string;
    email: string;
    status: 'sent' | 'failed' | 'opened' | 'reviewed';
    error: string | null;
    created_at: string;
    product_id: string | null;
    message: string | null;
};

const STATUS_STYLE: Record<InvitationRow['status'], string> = {
    sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
    opened: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    reviewed: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
};

const DashboardInvitations: React.FC = () => {
    const { business } = useBusinessDashboard();
    const { profile } = useAuth();
    // Sin plan no hay historial que pedir (la RLS no lo dejaria y saldria un error en consola).
    const desbloqueada = !!profile && !getSectionAccess(profile, 'invitations').locked;
    const { showNotification } = useNotification();
    const { notifyError } = useUserErrorNotifier();
    const t = useTranslation();
    const tn = usePluralT();
    const { language } = useI18n();
    const [emails, setEmails] = useState('');
    const [customMessage, setCustomMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    // Pedir reseña de un curso concreto: sin esto, el cliente recibe una
    // invitación genérica y luego no se sabe de qué producto hablaba.
    const [products, setProducts] = useState<any[]>([]);
    const [productId, setProductId] = useState('');
    // Historial real: una fila por destinatario, con su estado.
    const [history, setHistory] = useState<InvitationRow[]>([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [historyError, setHistoryError] = useState(false);
    const [resendingId, setResendingId] = useState<string | null>(null);

    const loadHistory = useCallback(async () => {
        if (!business?.id) return;
        if (!desbloqueada) { setHistoryLoading(false); return; }
        const { data, error } = await supabase
            .from('review_invitations')
            .select('id, email, status, error, created_at, product_id, message')
            .eq('business_id', business.id)
            .order('created_at', { ascending: false })
            .limit(50);
        if (error) {
            console.error('No se pudo cargar el historial de invitaciones:', error);
            setHistoryError(true);
        } else {
            setHistoryError(false);
            setHistory((data || []) as InvitationRow[]);
        }
        setHistoryLoading(false);
    }, [business?.id, desbloqueada]);

    useEffect(() => { loadHistory(); }, [loadHistory]);

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
            const { data, error } = await supabase.functions.invoke('send-invitation-email', {
                body: {
                    businessId: business.id,
                    emails: emailList,
                    message: customMessage,
                    productId: productId || null,
                }
            });
            if (error) throw error;
            if (!data) throw new Error('send-invitation-email: respuesta vacia');
            // La funcion dice cuantas salieron de verdad y cuales no.
            const sent = Number(data?.sent ?? 0);
            const failed = Number(data?.failed ?? 0);
            const failedEmails: string[] = (data?.results || []).filter((r: any) => !r.ok).map((r: any) => r.email);
            if (failed === 0) {
                showNotification(tn('businessDashboard.invitationsSentToast', sent), 'success');
                setEmails('');
                setCustomMessage('');
            } else if (sent === 0) {
                showNotification(t('businessDashboard.invitationsAllFailedToast'), 'error');
                setEmails(failedEmails.join('\n'));
            } else {
                showNotification(t('businessDashboard.invitationsResultToast', { sent, failed }), 'info');
                // Solo quedan en el campo las que fallaron, para reintentar.
                setEmails(failedEmails.join('\n'));
            }
            if (data?.historySaved === false) {
                showNotification(t('businessDashboard.invitationsHistoryNotSaved'), 'info');
            }
            loadHistory();
        } catch (error) {
            // Traducido: plan insuficiente → Planes; limite de 24 h; emails no
            // validos; fallo del servicio → Soporte. Antes salia el texto de la
            // funcion en espanol para todos los idiomas.
            await notifyError(error, { flow: 'invitations' });
        } finally {
            setIsSending(false);
        }
    };
    
    const handleResend = async (row: InvitationRow) => {
        setResendingId(row.id);
        try {
            const { data, error } = await supabase.functions.invoke('send-invitation-email', {
                body: {
                    businessId: business.id,
                    emails: [row.email],
                    message: row.message || '',
                    productId: row.product_id || null,
                    // La funcion retira esta fila fallida si el reenvio sale bien.
                    resendOf: row.id,
                }
            });
            if (error) throw error;
            if (!data) throw new Error('send-invitation-email: respuesta vacia');
            if (Number(data?.sent ?? 0) > 0) {
                showNotification(t('businessDashboard.invitationResendOk', { email: row.email }), 'success');
            } else {
                showNotification(t('businessDashboard.invitationResendFailed', { email: row.email }), 'error');
            }
            loadHistory();
        } catch (error) {
            await notifyError(error, { flow: 'invitations' });
        } finally {
            setResendingId(null);
        }
    };

    const dateFormat = new Intl.DateTimeFormat(toBcp47(language), { dateStyle: 'medium', timeStyle: 'short' });

    return (
        <div className="space-y-5 sm:space-y-6 md:space-y-8">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-gray-800 dark:text-gray-100">{t('businessDashboard.sendInvitationsTitle')}</h1>

            <SectionLock section="invitations" title={t('businessDashboard.invitationsLockFeatureName')} subtitleKey="businessDashboard.invitationsLockSubtitle">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 lg:gap-8">
                    <div className="bg-white dark:bg-zinc-800 p-4 sm:p-5 md:p-6 rounded-lg sm:rounded-xl shadow-sm border dark:border-zinc-700">
                        <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-gray-800 dark:text-gray-100">{t('businessDashboard.sendNewInvitationsTitle')}</h2>
                        <form onSubmit={handleSubmit} noValidate className="space-y-3 sm:space-y-4">
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
                        {historyLoading ? (
                            <div className="flex justify-center py-12"><Spinner /></div>
                        ) : historyError ? (
                            <p className="text-center py-10 text-sm text-red-600 dark:text-red-400">{t('businessDashboard.invitationsHistoryLoadError')}</p>
                        ) : history.length === 0 ? (
                            <div className="text-center py-12 sm:py-16 text-sm sm:text-base text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-900/50 rounded-lg">
                                <i className="fa-solid fa-history text-3xl sm:text-4xl mb-3 sm:mb-4 text-gray-400" aria-hidden="true"></i>
                                <p className="font-semibold">{t('businessDashboard.invitationsHistoryEmpty')}</p>
                                <p className="text-xs sm:text-sm mt-1">{t('businessDashboard.invitationsHistorySubtitle')}</p>
                            </div>
                        ) : (
                            <ul className="divide-y dark:divide-zinc-700 max-h-[32rem] overflow-y-auto">
                                {history.map(row => {
                                    const producto = row.product_id ? products.find(p => p.id === row.product_id) : null;
                                    return (
                                        <li key={row.id} className="py-3 flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 break-all">{row.email}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    {dateFormat.format(new Date(row.created_at))}{producto ? ' · ' + producto.name : ''}
                                                </p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                                                <span
                                                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_STYLE[row.status] || STATUS_STYLE.sent}`}
                                                    title={row.status === 'failed' && row.error ? row.error : undefined}
                                                >
                                                    {t(`businessDashboard.invitationStatus_${row.status}`)}
                                                </span>
                                                {row.status === 'failed' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleResend(row)}
                                                        disabled={resendingId === row.id}
                                                        className="text-xs font-semibold text-brand-green hover:underline disabled:opacity-50"
                                                    >
                                                        {resendingId === row.id ? t('common.sending') : t('businessDashboard.invitationResend')}
                                                    </button>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            </SectionLock>
        </div>
    );
};

export default DashboardInvitations;