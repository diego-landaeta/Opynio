import React, { useState } from 'react';
import Modal from './Modal';
import type { Review } from '../types';
import { createSupportTicket } from '../services/supabaseService';
import { useTranslation } from '../contexts/i18nContext';
import { useNotification } from '../contexts/NotificationContext';
import { useUserErrorNotifier } from '../utils/userFacingError';

// El autor no edita ni borra su resena: pide su eliminacion con un motivo.
// Se abre una solicitud de soporte de tipo 'review_deletion' que revisa el
// admin; el usuario sigue la respuesta en «Mis solicitudes de soporte».
const MIN_REASON = 15;
const SUBJECT_MAX = 150;

// «(#id)» al final del asunto: el admin localiza la resena y el perfil sabe
// que ya hay una solicitud abierta para ella (ver reviewIdFromDeletionSubject).
export const deletionSubject = (prefix: string, review: Review): string => {
    const tail = ` (#${review.id})`;
    const head = `${prefix}: `;
    const room = SUBJECT_MAX - head.length - tail.length;
    const title = (review.title || '').trim();
    const cut = title.length > room ? `${title.slice(0, Math.max(0, room - 1))}…` : title;
    return `${head}${cut}${tail}`;
};

export const reviewIdFromDeletionSubject = (subject: string): string | null => {
    const m = /\(#([^)\s]+)\)\s*$/.exec(subject || '');
    return m ? m[1] : null;
};

const RequestReviewDeletionModal: React.FC<{
    review: Review;
    onClose: () => void;
    onSent: (reviewId: string) => void;
}> = ({ review, onClose, onSent }) => {
    const t = useTranslation();
    const { showNotification } = useNotification();
    const { notifyError } = useUserErrorNotifier();
    const [reason, setReason] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (sending) return;
        if (reason.trim().length < MIN_REASON) {
            setError(t('common.requestDeletionMinLength', { min: MIN_REASON }));
            return;
        }
        setError(null);
        setSending(true);
        try {
            const business = review.businesses?.name ? `${review.businesses.name} · ` : '';
            await createSupportTicket({
                type: 'review_deletion',
                subject: deletionSubject(t('common.requestDeletionSubject'), review),
                body: `${reason.trim()}\n\n— ${business}«${review.title || ''}» · #${review.id}`,
                // Sin business_id: la solicitud solo admite empresas propias y la
                // resena se identifica por el «(#id)» del asunto.
            });
            showNotification(t('common.requestDeletionSent'), 'success');
            onSent(String(review.id));
            onClose();
        } catch (err) {
            await notifyError(err, { flow: 'support' });
            setSending(false);
        }
    };

    return (
        <Modal title={t('common.requestDeletionTitle')} onClose={onClose}>
            <form onSubmit={submit} className="mt-4 space-y-4 text-left" noValidate>
                <p className="text-sm text-gray-600 dark:text-gray-300">{t('common.requestDeletionIntro')}</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 break-words">«{review.title}»</p>
                <div>
                    <label htmlFor="deletion-reason" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.requestDeletionReason')}</label>
                    <textarea
                        id="deletion-reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        maxLength={2000}
                        rows={4}
                        placeholder={t('common.requestDeletionPlaceholder')}
                        aria-invalid={!!error}
                        aria-describedby={error ? 'deletion-reason-error' : undefined}
                        className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-green focus:border-transparent"
                    />
                    {error && <p id="deletion-reason-error" className="text-sm text-red-600 dark:text-red-400 mt-1" role="alert">{error}</p>}
                </div>
                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700">
                        {t('common.cancel')}
                    </button>
                    <button type="submit" disabled={sending} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 inline-flex items-center gap-2">
                        {sending && <i className="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>}
                        {t('common.requestDeletionSend')}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default RequestReviewDeletionModal;
