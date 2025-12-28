import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';
import { useBusinessDashboard } from '../../../../contexts/BusinessDashboardContext';
import type { Review, Database, Plan } from '../../../../types';
import Spinner from '../../../Spinner';
import ReviewCard from '../../../ReviewCard';
import { getReviewsForBusiness, submitReviewResponse, updateReviewResponse, deleteReviewResponse, incrementAiCredits } from '../../../../services/supabaseService';
import { getSuggestedReplies } from '../../../../services/geminiService';
import { useNotification } from '../../../../contexts/NotificationContext';
import { useTranslation } from '../../../../contexts/i18nContext';

const PAGE_SIZE = 20;

// FIX: Add 'enterprise' plan to PLAN_CREDIT_LIMITS to match the Plan type definition.
const PLAN_CREDIT_LIMITS: Record<Plan, number> = {
    free: 0,
    starter: 200,
    growth: 1000,
    pro: 5000, // Assumption
    enterprise: 100000, // High limit for enterprise
};
const AI_SUGGESTION_COST = 10;


const DashboardReviews: React.FC = () => {
    // FIX: Get setBusinesses from useAuth to update business state after using credits.
    const { profile, setBusinesses } = useAuth();
    const { business } = useBusinessDashboard();
    const { showNotification } = useNotification();
    const t = useTranslation();
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

    const fetchReviewsPage = useCallback(async (currentPage: number) => {
        if (!business) return;
        if (currentPage === 1) setLoading(true);
        else setIsLoadingMore(true);

        try {
            const data = await getReviewsForBusiness(business.id, currentPage, PAGE_SIZE);
            setReviews(prev => currentPage === 1 ? data : [...prev, ...data]);
            setHasMore(data.length === PAGE_SIZE);
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

    const handleSuggestReplies = async (review: Review) => {
        // FIX: Check against business plan, not profile plan. Free plan cannot use this.
        if (!profile || !business || business.plan === 'free') {
            showNotification(t('businessDashboard.aiSuggestionRequiresPaidPlan'), 'info');
            return;
        }
        if (!review.review_text) return;

        // FIX: Credit check logic now uses business's plan and credit usage.
        const creditLimit = PLAN_CREDIT_LIMITS[business.plan];
        const creditsUsed = business.ai_credits_used || 0;
        
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
                // FIX: Pass business.id to increment credits for the correct entity.
                await incrementAiCredits(business.id, AI_SUGGESTION_COST);
                
                // FIX: Update the businesses array in the global context for immediate UI feedback on credit usage.
                setBusinesses(prevBusinesses => 
                    prevBusinesses.map(b => 
                        b.id === business.id 
                        ? { ...b, ai_credits_used: (b.ai_credits_used || 0) + AI_SUGGESTION_COST } 
                        : b
                    )
                );
            }

        } catch (error) {
            setSuggestionError(t('businessDashboard.errorGeneratingSuggestions'));
            showNotification(t('businessDashboard.errorGeneratingSuggestions'), 'error');
        } finally {
            setIsSuggesting(null);
        }
    };

    const handleRespondSubmit = async (e: React.FormEvent<HTMLFormElement>, reviewId: number) => {
        e.preventDefault();
        if (!responseText.trim() || !business || !profile) return;
        setIsSubmitting(true);
        const responsePayload: Database['public']['Tables']['review_responses']['Insert'] = {
            review_id: reviewId,
            business_id: business.id,
            user_id: profile.id,
            response_text: responseText,
        };
        try {
            await submitReviewResponse(responsePayload);
            setPage(1);
            await fetchReviewsPage(1);
            setResponseText('');
            setRespondingTo(null);
        } catch (error) {
            alert("Hubo un error al enviar la respuesta.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteResponse = async (responseId: number) => {
        if (window.confirm('¿Estás seguro?')) {
            try {
                await deleteReviewResponse(responseId);
                setPage(1);
                await fetchReviewsPage(1);
            } catch (error) {
                alert('No se pudo eliminar la respuesta.');
            }
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
            alert('No se pudo guardar la respuesta editada.');
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
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-gray-800 dark:text-gray-100">{t('businessDashboard.manageReviewsTitle')}</h1>

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
                                                            <p className="text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-200">Tu respuesta</p>
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
                                                <button
                                                    onClick={() => handleSuggestReplies(review)}
                                                    disabled={isSuggesting === review.id || !review.review_text || business.plan === 'free'}
                                                    className="bg-purple-100 text-purple-800 font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                                    title={business.plan === 'free' ? 'Mejora tu plan para usar sugerencias con IA' : 'Generar respuestas sugeridas'}
                                                >
                                                    {business.plan === 'free' && <i className="fa-solid fa-lock text-xs mr-1.5 sm:mr-2"></i>}
                                                    {isSuggesting === review.id ? t('common.creating') : t('businessDashboard.suggestWithAI')}
                                                </button>
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