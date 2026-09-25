import React, { useEffect, useRef, useState } from 'react';
import type { Review } from '../types';
import Modal from './Modal';
import StarRating from './StarRating';
import { updateOwnReview, getOwnReview } from '../services/supabaseService';
import { useTranslation } from '../contexts/i18nContext';
import { useNotification } from '../contexts/NotificationContext';

interface EditOwnReviewModalProps {
    review: Review;
    onClose: () => void;
    /** Recibe la resena ya guardada (con el estado que devuelve la BD). */
    onSaved: (updated: Review) => void;
    /**
     * La resena ya no se puede editar (un admin la rechazo o la borro mientras
     * tanto): la pagina recarga su lista con el estado real.
     */
    onStale?: () => void;
}

/** Estado leido de la BD: 'gone' = ya no existe (o ya no es del usuario). */
type LiveStatus = 'pending' | 'approved' | 'rejected' | 'gone';

const EDITABLE: ReadonlyArray<LiveStatus> = ['pending', 'approved'];

const toLiveStatus = (row: { status?: string | null } | null): LiveStatus => {
    if (!row) return 'gone';
    return row.status === 'approved' || row.status === 'rejected' ? row.status : 'pending';
};

/**
 * El autor edita su resena desde su perfil: valoracion, titulo y texto. El
 * negocio no se cambia (seria otra resena) y el producto tampoco.
 *
 * Moderacion: si la resena estaba aprobada, al guardar vuelve a revision (lo
 * decide la BD, no este componente). Se avisa ANTES de guardar con un aviso
 * fijo y con el texto del boton; una pendiente sigue pendiente.
 *
 * El aviso sale del estado RELEIDO al abrir (getOwnReview), no del de la
 * lista: la lista del perfil puede ser de hace rato y entretanto un admin
 * pudo aprobarla (el aviso diria «sigue pendiente» y volveria a revision),
 * rechazarla o borrarla. Si al guardar la BD no toca ninguna fila
 * (REVIEW_NOT_UPDATED), se vuelve a leer y se explica que su estado cambio.
 */
const EditOwnReviewModal: React.FC<EditOwnReviewModalProps> = ({ review, onClose, onSaved, onStale }) => {
    const t = useTranslation();
    const { showNotification } = useNotification();
    const [rating, setRating] = useState<number>(review.rating || 0);
    const [title, setTitle] = useState<string>(review.title || '');
    const [text, setText] = useState<string>(review.review_text || '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [liveStatus, setLiveStatus] = useState<LiveStatus>(() => toLiveStatus(review));
    // onStale solo una vez por apertura, aunque se relea varias veces.
    const staleNotifiedRef = useRef(false);

    const isLocked = !EDITABLE.includes(liveStatus);
    const wasApproved = liveStatus === 'approved';
    const hasChanges =
        rating !== review.rating ||
        title.trim() !== (review.title || '').trim() ||
        text.trim() !== (review.review_text || '').trim();

    // Aplica el estado recien leido. Devuelve true si ya no se puede editar.
    const applyFreshStatus = (row: Record<string, any> | null): boolean => {
        const fresh = toLiveStatus(row);
        setLiveStatus(fresh);
        const locked = !EDITABLE.includes(fresh);
        if (locked && !staleNotifiedRef.current) {
            staleNotifiedRef.current = true;
            onStale?.();
        }
        return locked;
    };

    useEffect(() => {
        if (!review.user_id) return;
        let cancelled = false;
        getOwnReview(String(review.id), review.user_id)
            .then(row => {
                if (!cancelled) applyFreshStatus(row);
            })
            .catch(err => {
                // Sin red: se queda el estado de la lista; al guardar lo decide la BD.
                console.warn('No se pudo releer la reseña antes de editarla:', err);
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [review.id, review.user_id]);

    const close = () => {
        if (!saving) onClose();
    };

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !saving) onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [saving, onClose]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (saving || !hasChanges || isLocked) return;
        if (rating < 1 || !title.trim()) {
            setError(t('common.editReviewMissingFields'));
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const row = await updateOwnReview(review, {
                rating,
                title: title.trim(),
                review_text: text.trim(),
            });
            // La fila de la BD no trae lo que la tarjeta pinta de otras tablas.
            onSaved({
                ...review,
                ...row,
                businesses: review.businesses,
                profiles: review.profiles,
                review_responses: review.review_responses,
            } as Review);
            showNotification(t('common.reviewUpdated'), 'success');
            onClose();
        } catch (err) {
            console.error('Failed to update review:', err);
            if (err instanceof Error && err.message === 'REVIEW_NOT_UPDATED' && review.user_id) {
                // 0 filas: se relee para explicar el motivo con el estado real.
                // Si ya no es editable, el aviso rojo de arriba lo explica.
                let locked = false;
                try {
                    locked = applyFreshStatus(await getOwnReview(String(review.id), review.user_id));
                } catch (readError) {
                    console.warn('No se pudo releer la reseña tras el fallo:', readError);
                }
                // 0 filas = algo cambio fuera: la lista del perfil se recarga
                // aunque la relectura no lo explique (o no se pudiera hacer).
                if (!staleNotifiedRef.current) {
                    staleNotifiedRef.current = true;
                    onStale?.();
                }
                setError(locked ? null : t('common.reviewUpdateError'));
            } else {
                setError(t('common.reviewUpdateError'));
            }
            setSaving(false);
        }
    };

    const inputClass =
        'w-full p-2.5 text-sm sm:text-base border border-gray-300 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed';

    return (
        <Modal title={t('common.editReviewTitle')} onClose={close}>
            <form onSubmit={handleSubmit} className="mt-3 sm:mt-4 space-y-4" data-testid="edit-own-review-form">
                {review.businesses?.name && (
                    <p className="text-center text-sm text-gray-500 dark:text-gray-400 break-words">
                        <i className="fa-solid fa-store mr-1.5" aria-hidden="true"></i>
                        {review.businesses.name}
                    </p>
                )}

                {isLocked ? (
                    <div
                        role="alert"
                        data-testid="edit-review-locked-notice"
                        className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800/50 text-red-800 dark:text-red-300 text-xs sm:text-sm"
                    >
                        <i className="fa-solid fa-lock mt-0.5" aria-hidden="true"></i>
                        <span>{t('common.reviewNoLongerEditable')}</span>
                    </div>
                ) : wasApproved ? (
                    <div
                        role="note"
                        data-testid="edit-review-moderation-notice"
                        className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800/50 text-yellow-800 dark:text-yellow-300 text-xs sm:text-sm"
                    >
                        <i className="fa-solid fa-rotate mt-0.5" aria-hidden="true"></i>
                        <span>{t('common.editReviewApprovedNotice')}</span>
                    </div>
                ) : (
                    <div
                        role="note"
                        data-testid="edit-review-pending-notice"
                        className="flex items-start gap-2 p-3 rounded-lg bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-300 text-xs sm:text-sm"
                    >
                        <i className="fa-solid fa-clock mt-0.5" aria-hidden="true"></i>
                        <span>{t('common.editReviewPendingNotice')}</span>
                    </div>
                )}

                {/* disabled en el fieldset desactiva tambien las estrellas (son
                    botones). onRating no se quita: StarRating cambia de hooks
                    segun lo reciba o no. */}
                <fieldset disabled={isLocked} className="space-y-4 min-w-0">
                    <fieldset>
                        <legend className="block text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1.5">
                            {t('common.editReviewRatingLabel')}
                        </legend>
                        <StarRating rating={rating} onRating={setRating} size="large" />
                    </fieldset>

                    <div>
                        <label htmlFor="edit-review-title" className="block text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1.5">
                            {t('common.title')}
                        </label>
                        <input
                            id="edit-review-title"
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                            className={inputClass}
                        />
                    </div>

                    <div>
                        <label htmlFor="edit-review-text" className="block text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1.5">
                            {t('common.editReviewTextLabel')}
                        </label>
                        <textarea
                            id="edit-review-text"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            rows={6}
                            className={`${inputClass} resize-y`}
                        ></textarea>
                    </div>
                </fieldset>

                {error && (
                    <p role="alert" data-testid="edit-review-error" className="text-sm text-red-600 dark:text-red-400">
                        {error}
                    </p>
                )}

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-1">
                    <button
                        type="button"
                        onClick={close}
                        disabled={saving}
                        className="px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-zinc-700 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLocked ? t('common.close') : t('common.cancel')}
                    </button>
                    {!isLocked && (
                        <button
                            type="submit"
                            disabled={saving || !hasChanges}
                            data-testid="edit-review-save"
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-brand-green rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving && <i className="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>}
                            <span>
                                {saving
                                    ? t('common.saving')
                                    : wasApproved
                                        ? t('common.editReviewSaveAndResubmit')
                                        : t('common.save')}
                            </span>
                        </button>
                    )}
                </div>
            </form>
        </Modal>
    );
};

export default EditOwnReviewModal;
