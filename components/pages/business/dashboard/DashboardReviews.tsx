import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';
import { useBusinessDashboard } from '../../../../contexts/BusinessDashboardContext';
import type { Review, Database, Plan, ReviewSubject } from '../../../../types';
import Spinner from '../../../Spinner';
import ReviewCard from '../../../ReviewCard';
import {
    getReviewsForBusiness,
    submitReviewResponse,
    updateReviewResponse,
    deleteReviewResponse,
    incrementAiCredits,
    getBusinessProducts,
    getReviewProductLinks,
    assignReviewToProduct,
    unassignReviewFromProduct,
    assignReviewsToProduct,
    unassignReviews,
} from '../../../../services/supabaseService';
import { getSuggestedReplies, AI_ENABLED } from '../../../../services/geminiService';
import { useNotification } from '../../../../contexts/NotificationContext';
import { useConfirm } from '../../../../contexts/ConfirmContext';
import { useTranslation } from '../../../../contexts/i18nContext';
import { usePluralT } from '../../../../utils/plural';
import { useUserErrorNotifier } from '../../../../utils/userFacingError';

const PAGE_SIZE = 20;

const PLAN_CREDIT_LIMITS: Record<Plan, number> = {
    free: 0,
    starter: 200,
    growth: 1000,
    pro: 5000,
    v2: 100000,
    enterprise: 100000,
};
const AI_SUGGESTION_COST = 10;


const DashboardReviews: React.FC = () => {
    // Plan y créditos viven en `profiles`. setProfile actualiza el contador
    // local tras consumir créditos para feedback inmediato.
    const { profile, setProfile } = useAuth();
    const { business } = useBusinessDashboard();
    const { showNotification } = useNotification();
    const { notifyError } = useUserErrorNotifier();
    const { confirm } = useConfirm();
    const t = useTranslation();
    const tn = usePluralT();
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);
    const [respondingTo, setRespondingTo] = useState<number | null>(null);
    const [responseText, setResponseText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [editingResponseId, setEditingResponseId] = useState<number | null>(null);
    const [editedResponseText, setEditedResponseText] = useState('');
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [isSuggesting, setIsSuggesting] = useState<number | null>(null);
    const [suggestedReplies, setSuggestedReplies] = useState<{ reviewId: number; suggestions: string[] } | null>(null);
    const [suggestionError, setSuggestionError] = useState<string | null>(null);

    // Asignacion de resenas a productos. Los productos se cargan una vez; los
    // enlaces, para las resenas que hay en pantalla en cada momento.
    const [products, setProducts] = useState<ReviewSubject[]>([]);
    // Tambien los desactivados: una resena enlazada a un producto retirado
    // salia como "Sin asignar" y, al tocar el selector, se perdia el enlace.
    const [inactiveProducts, setInactiveProducts] = useState<ReviewSubject[]>([]);
    const [productLinks, setProductLinks] = useState<Record<string, string>>({});
    const [assigningId, setAssigningId] = useState<string | null>(null);
    // Selección múltiple: asignar de una en una no es viable con miles.
    const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
    const [asignandoLote, setAsignandoLote] = useState(false);

    const fetchReviewsPage = useCallback(async (currentPage: number) => {
        if (!business) return;
        if (currentPage === 1) setLoading(true);
        else setIsLoadingMore(true);

        try {
            const data = await getReviewsForBusiness(business.id, currentPage, PAGE_SIZE);
            setReviews(prev => currentPage === 1 ? data : [...prev, ...data]);
            setHasMore(data.length === PAGE_SIZE);

            // Que producto tiene asignado cada resena de esta pagina. Si falla,
            // las resenas se siguen viendo: el selector aparece vacio.
            try {
                const links = await getReviewProductLinks(data.map(r => String(r.id)));
                setProductLinks(prev => currentPage === 1 ? links : { ...prev, ...links });
            } catch (linkError) {
                console.error('No se pudieron cargar las asignaciones a productos:', linkError);
            }
        } catch (error) {
            console.error("Failed to fetch business reviews:", error);
        } finally {
            setLoading(false);
            setIsLoadingMore(false);
        }
    }, [business]);

    useEffect(() => {
        if(business) {
            fetchReviewsPage(1);
        }
    }, [business, fetchReviewsPage]);

    useEffect(() => {
        if (!business?.id) return;
        let cancelled = false;
        getBusinessProducts(business.id)
            .then(list => {
                if (cancelled) return;
                setProducts(list.filter(p => p.is_active));
                setInactiveProducts(list.filter(p => !p.is_active));
            })
            // Sin productos el selector no se pinta, asi que un fallo aqui solo
            // significa que esta pantalla se comporta como siempre.
            .catch(err => {
                // Si las tablas aun no estan aplicadas, esta pantalla se comporta
                // como antes de que existieran los productos: sin selector.
                const faltaLaTabla = err?.code === 'PGRST205' || err?.code === '42P01';
                if (faltaLaTabla) console.info('Productos no disponibles en esta base de datos todavía.');
                else console.error('No se pudieron cargar los productos:', err);
            });
        return () => { cancelled = true; };
    }, [business?.id]);

    const handleAssignProduct = async (reviewId: string, productId: string) => {
        setAssigningId(reviewId);
        try {
            if (productId) {
                await assignReviewToProduct(reviewId, productId);
                setProductLinks(prev => ({ ...prev, [reviewId]: productId }));
                const name = products.find(p => p.id === productId)?.name || '';
                showNotification(t('businessDashboard.reviewAssignedToast', { name }), 'success');
            } else {
                await unassignReviewFromProduct(reviewId);
                setProductLinks(prev => {
                    const next = { ...prev };
                    delete next[reviewId];
                    return next;
                });
                showNotification(t('businessDashboard.reviewUnassignedToast'), 'success');
            }
        } catch (error: any) {
            await notifyError(error, { fallbackKey: 'businessDashboard.reviewProductAssignError' });
        } finally {
            setAssigningId(null);
        }
    };

    const alternarSeleccion = (reviewId: string) => {
        setSeleccion(prev => {
            const siguiente = new Set(prev);
            if (siguiente.has(reviewId)) siguiente.delete(reviewId);
            else siguiente.add(reviewId);
            return siguiente;
        });
    };

    const seleccionarTodasLasVisibles = () => {
        setSeleccion(new Set(reviews.map(r => String(r.id))));
    };

    const asignarLote = async (productId: string) => {
        const ids = [...seleccion];
        if (ids.length === 0) return;
        setAsignandoLote(true);
        try {
            if (productId) {
                await assignReviewsToProduct(ids, productId);
                setProductLinks(prev => {
                    const siguiente = { ...prev };
                    ids.forEach(id => { siguiente[id] = productId; });
                    return siguiente;
                });
                const nombre = products.find(p => p.id === productId)?.name || '';
                showNotification(tn('businessDashboard.bulkAssignedToast', ids.length, { name: nombre }), 'success');
            } else {
                await unassignReviews(ids);
                setProductLinks(prev => {
                    const siguiente = { ...prev };
                    ids.forEach(id => { delete siguiente[id]; });
                    return siguiente;
                });
                showNotification(tn('businessDashboard.bulkUnassignedToast', ids.length), 'success');
            }
            setSeleccion(new Set());
        } catch (error: any) {
            await notifyError(error, { fallbackKey: 'businessDashboard.bulkAssignError' });
        } finally {
            setAsignandoLote(false);
        }
    };

    const handleSuggestReplies = async (review: Review) => {
        // Plan y créditos viven en `profiles`.
        if (!profile || !business || profile.plan === 'free') {
            showNotification(t('businessDashboard.aiSuggestionRequiresPaidPlan'), 'info');
            return;
        }
        if (!review.review_text) return;

        const creditLimit = PLAN_CREDIT_LIMITS[profile.plan];
        const creditsUsed = profile.ai_credits_used || 0;

        if (creditLimit > 0 && creditsUsed + AI_SUGGESTION_COST > creditLimit) {
            showNotification(t('businessDashboard.aiCreditLimitReached'), 'error');
            setSuggestionError(t('businessDashboard.aiCreditLimitError'));
            return;
        }

        setIsSuggesting(review.id);
        setSuggestionError(null);
        setSuggestedReplies(null);
        try {
            const replies = await getSuggestedReplies(review.review_text, review.rating);
            setSuggestedReplies({ reviewId: review.id, suggestions: replies });

            if (creditLimit > 0) {
                // Descuenta créditos en profile.ai_credits_used vía RPC server-side.
                await incrementAiCredits(profile.id, AI_SUGGESTION_COST);

                // Reflejo local inmediato del contador para la UI.
                setProfile(prev => prev
                    ? { ...prev, ai_credits_used: (prev.ai_credits_used || 0) + AI_SUGGESTION_COST }
                    : prev
                );
            }

        } catch (error) {
            console.error('AI suggestions failed:', error);
            setSuggestionError(t('businessDashboard.aiRepliesUnavailable'));
            showNotification(t('businessDashboard.aiRepliesUnavailable'), 'error');
        } finally {
            setIsSuggesting(null);
        }
    };

    const handleRespondSubmit = async (e: React.FormEvent<HTMLFormElement>, reviewId: number) => {
        e.preventDefault();
        if (!responseText.trim() || !business || !profile) return;
        setIsSubmitting(true);
        try {
            await submitReviewResponse(String(reviewId), responseText.trim());
            setPage(1);
            await fetchReviewsPage(1);
            setResponseText('');
            setRespondingTo(null);
        } catch (error) {
            await notifyError(error, { fallbackKey: 'businessDashboard.errorSendingResponse' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteResponse = async (responseId: number) => {
        const ok = await confirm({
            title: t('businessDashboard.deleteResponseTitle'),
            message: t('businessDashboard.deleteResponseConfirm'),
            confirmText: t('common.delete'),
            cancelText: t('common.cancel'),
            danger: true,
        });
        if (!ok) return;
        try {
            await deleteReviewResponse(responseId);
            setPage(1);
            await fetchReviewsPage(1);
        } catch (error) {
            await notifyError(error, { fallbackKey: 'businessDashboard.errorDeletingResponse' });
        }
    };

    const handleEditClick = (response: any) => {
        setEditingResponseId(response.id);
        setEditedResponseText(response.response_text);
    };
    
    const handleSaveEdit = async (e: React.FormEvent, responseId: number) => {
        e.preventDefault();
        setIsSavingEdit(true);
        try {
            await updateReviewResponse(responseId, editedResponseText);
            setEditingResponseId(null);
            setEditedResponseText('');
            setPage(1);
            await fetchReviewsPage(1);
        } catch (error) {
            await notifyError(error, { fallbackKey: 'businessDashboard.errorSavingEditedResponse' });
        } finally {
            setIsSavingEdit(false);
        }
    };

    const handleLoadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchReviewsPage(nextPage);
    };

    if (!business) {
        return <div className="flex justify-center items-center h-48 sm:h-64"><Spinner /></div>;
    }

    return (
        <div className="space-y-5 sm:space-y-6 md:space-y-8">
            <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-gray-800 dark:text-gray-100">{t('businessDashboard.manageReviewsTitle')}</h1>
                {products.length > 0 && (
                    <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-400 max-w-2xl">
                        {t('businessDashboard.assignProductsHint')}
                    </p>
                )}
            </div>

            <section>
                {suggestionError && <div className="bg-red-100 text-red-700 p-3 sm:p-4 mb-3 sm:mb-4 rounded-md text-sm sm:text-base">{suggestionError}</div>}

                {loading ? (
                    <div className="flex justify-center items-center h-48 sm:h-64"><Spinner /></div>
                ) : (
                    <div className="space-y-4 sm:space-y-6">
                         {reviews.length === 0 ? (
                            <div className="text-center py-8 sm:py-10 text-sm sm:text-base text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-800/50 rounded-lg">
                                <p className="font-semibold">{t('businessDashboard.noReviewsYet')}</p>
                            </div>
                        ) : (
                            reviews.map(review => (
                                <div key={review.id} className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border dark:border-zinc-700">
                                    <ReviewCard review={review} hideResponse={true} />
                                    <div className="p-3 sm:p-4 bg-gray-50/50 dark:bg-zinc-900/50 rounded-b-lg">
                                        {/* Asignacion a producto. Solo aparece si la empresa tiene
                                            productos activos: si no, esta pantalla es la de siempre. */}
                                        {products.length > 0 && (
                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 mb-3 pb-3 border-b dark:border-zinc-700">
                                                {/* Marcar varias y asignarlas de golpe: con miles de
                                                    reseñas, una por una no es un flujo viable. */}
                                                <label className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer select-none mr-1">
                                                    <input
                                                        type="checkbox"
                                                        checked={seleccion.has(String(review.id))}
                                                        onChange={() => alternarSeleccion(String(review.id))}
                                                        aria-label={t('businessDashboard.selectReviewAria', { title: review.title || '' })}
                                                        className="w-4 h-4 rounded border-gray-300 dark:border-zinc-600 text-brand-green focus:ring-brand-green"
                                                    />
                                                </label>
                                                <label htmlFor={`product-for-${review.id}`} className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                    <i className="fa-solid fa-box-open text-gray-400 dark:text-gray-500" aria-hidden="true"></i>
                                                    {t('businessDashboard.assignToProductLabel')}
                                                </label>
                                                <select
                                                    id={`product-for-${review.id}`}
                                                    value={productLinks[String(review.id)] || ''}
                                                    disabled={assigningId === String(review.id)}
                                                    onChange={(e) => handleAssignProduct(String(review.id), e.target.value)}
                                                    className="min-h-[36px] max-w-full text-xs sm:text-sm rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-800 dark:text-gray-100 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-green disabled:opacity-50"
                                                >
                                                    <option value="">{t('businessDashboard.unassignedOption')}</option>
                                                    {products.map(product => (
                                                        <option key={product.id} value={product.id}>{product.name}</option>
                                                    ))}
                                                    {(() => {
                                                        const retirado = inactiveProducts.find(p => p.id === productLinks[String(review.id)]);
                                                        return retirado ? (
                                                            <option value={retirado.id} disabled>
                                                                {retirado.name} ({t('businessDashboard.productStatusInactive')})
                                                            </option>
                                                        ) : null;
                                                    })()}
                                                </select>
                                                {assigningId === String(review.id) && (
                                                    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                                                        <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" aria-hidden="true"></span>
                                                        {t('common.saving')}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        {/* Response management UI */}
                                         {review.review_responses && review.review_responses.length > 0 ? (
                                            review.review_responses.map(response => (
                                                <div key={response.id}>
                                                    {editingResponseId === response.id ? (
                                                        <form onSubmit={(e) => handleSaveEdit(e, response.id)}>
                                                            <h4 className="text-xs sm:text-sm font-semibold mb-2">{t('businessDashboard.editingResponse')}</h4>
                                                            <textarea value={editedResponseText} onChange={(e) => setEditedResponseText(e.target.value)} required className="w-full p-2 sm:p-2.5 border rounded-md bg-transparent text-sm sm:text-base" rows={3}/>
                                                            <div className="flex items-center justify-end gap-2 sm:gap-3 mt-2">
                                                                <button type="button" onClick={() => setEditingResponseId(null)} className="text-xs sm:text-sm font-semibold">{t('common.cancel')}</button>
                                                                <button type="submit" disabled={isSavingEdit} className="bg-brand-green text-white font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm">{isSavingEdit ? t('common.saving') : t('common.save')}</button>
                                                            </div>
                                                        </form>
                                                    ) : (
                                                        <div className="group relative">
                                                            <p className="text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-200">{t('businessDashboard.yourResponseLabel')}</p>
                                                            <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 mt-1.5 sm:mt-2 pr-16 sm:pr-0">{response.response_text}</p>
                                                            <div className="absolute top-0 right-0 flex gap-2 sm:gap-3 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                                <button onClick={() => handleEditClick(response)} className="text-xs font-semibold text-brand-blue hover:underline">{t('common.edit').toUpperCase()}</button>
                                                                <button onClick={() => handleDeleteResponse(response.id)} className="text-xs font-semibold text-red-600 hover:underline">{t('common.delete').toUpperCase()}</button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        ) : respondingTo === review.id ? (
                                            <form onSubmit={(e) => handleRespondSubmit(e, review.id)}>
                                                <textarea value={responseText} onChange={(e) => setResponseText(e.target.value)} placeholder={t('common.placeholders.writeResponse')} required className="w-full p-2 sm:p-2.5 border rounded-md bg-transparent text-sm sm:text-base" rows={3}/>
                                                <div className="flex justify-end gap-2 sm:gap-3 mt-2">
                                                    <button type="button" onClick={() => setRespondingTo(null)} className="text-xs sm:text-sm font-semibold">{t('common.cancel')}</button>
                                                    <button type="submit" disabled={isSubmitting} className="bg-brand-green text-white font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm">{isSubmitting ? t('common.sending') : t('common.submit')}</button>
                                                </div>
                                            </form>
                                        ) : (
                                            <div className="flex flex-col xs:flex-row gap-2 sm:gap-3">
                                                <button onClick={() => setRespondingTo(review.id)} className="bg-green-100 text-brand-green font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm">{t('businessDashboard.respond')}</button>
                                                {AI_ENABLED && <button
                                                    onClick={() => handleSuggestReplies(review)}
                                                    disabled={isSuggesting === review.id || !review.review_text || profile?.plan === 'free'}
                                                    className="bg-purple-100 text-purple-800 font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                                    title={profile?.plan === 'free' ? t('businessDashboard.upgradeForAISuggestions') : t('businessDashboard.generateSuggestedRepliesTitle')}
                                                >
                                                    {profile?.plan === 'free' && <i className="fa-solid fa-lock text-xs mr-1.5 sm:mr-2"></i>}
                                                    {isSuggesting === review.id ? t('common.creating') : t('businessDashboard.suggestWithAI')}
                                                </button>}
                                            </div>
                                        )}
                                        {suggestedReplies?.reviewId === review.id && (
                                            <div className="mt-3 sm:mt-4 border-t pt-3 sm:pt-4">
                                                <h4 className="text-xs sm:text-sm font-semibold mb-2">{t('businessDashboard.aiSuggestionsTitle')}</h4>
                                                <div className="space-y-2">
                                                    {suggestedReplies.suggestions.map((reply, index) => (
                                                        <div key={index} className="group p-2.5 sm:p-3 bg-white hover:bg-green-50 border rounded-md text-xs sm:text-sm cursor-pointer" onClick={() => { setResponseText(reply); setRespondingTo(review.id); setSuggestedReplies(null); }}>
                                                            <p>{reply}</p>
                                                            <span className="text-xs font-bold text-brand-green opacity-0 group-hover:opacity-100">{t('businessDashboard.useThisResponse')}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
                {/* Barra de lote: aparece solo con algo seleccionado y se queda
                    pegada abajo, que es donde esta la vista cuando revisas. */}
                {products.length > 0 && seleccion.size > 0 && (
                    <div className="sticky bottom-3 z-30 mt-4 p-3 rounded-xl bg-white dark:bg-zinc-800 border-2 border-brand-green shadow-lg flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                        <p className="text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-100 flex-shrink-0">
                            {tn('businessDashboard.selectedCount', seleccion.size)}
                        </p>
                        <select
                            defaultValue=""
                            disabled={asignandoLote}
                            onChange={(e) => { const v = e.target.value; e.target.value = ''; if (v) asignarLote(v === '__quitar__' ? '' : v); }}
                            aria-label={t('businessDashboard.bulkAssignTo')}
                            className="flex-1 min-w-0 min-h-[40px] text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-gray-800 dark:text-gray-100 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-green disabled:opacity-50"
                        >
                            <option value="">{t('businessDashboard.bulkAssignTo')}</option>
                            {products.map(product => (
                                <option key={product.id} value={product.id}>{product.name}</option>
                            ))}
                            <option value="__quitar__">{t('businessDashboard.bulkUnassign')}</option>
                        </select>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                                type="button"
                                onClick={seleccionarTodasLasVisibles}
                                disabled={asignandoLote}
                                className="min-h-[40px] px-3 rounded-lg text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600 transition-colors disabled:opacity-50"
                            >
                                {t('businessDashboard.selectAllVisible')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setSeleccion(new Set())}
                                disabled={asignandoLote}
                                className="min-h-[40px] px-3 rounded-lg text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
                            >
                                {t('businessDashboard.clearSelection')}
                            </button>
                        </div>
                        {asignandoLote && (
                            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                                <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" aria-hidden="true"></span>
                                {t('common.saving')}
                            </span>
                        )}
                    </div>
                )}

                {hasMore && (
                    <div className="pt-6 sm:pt-8 text-center">
                        <button onClick={handleLoadMore} disabled={isLoadingMore} className="bg-brand-dark text-white font-semibold px-5 sm:px-6 py-2.5 sm:py-3 rounded-md text-sm sm:text-base">{isLoadingMore ? t('common.loading') : t('explorePage.loadMore')}</button>
                    </div>
                )}
            </section>
        </div>
    );
};

export default DashboardReviews;