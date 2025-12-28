import React, { useMemo, useState, useEffect, memo } from 'react';
import type { Review } from '../types';
import StarRating from './StarRating';
import AudioPlayer from './AudioPlayer';
import LazyImage from './LazyImage';
import * as ReactRouterDOM from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { voteOnReview, getUserVoteOnReview, removeVoteOnReview } from '../services/supabaseService';
import { useI18n, useTranslation, useGeminiTranslation, pathTranslations, type Language, getLanguageForCountryCode } from '../contexts/i18nContext';
import { useNotification } from '../contexts/NotificationContext';
import esTranslations from '../locales/es';
import { COUNTRIES } from '../constants';
import { generateBusinessPath } from '../utils/linkUtils';
import { getSubcategoryKey, getCategorySpanishName } from '../utils/categoryMappings';


interface ReviewCardProps {
    review: Review;
    showBusinessName?: boolean;
    hideResponse?: boolean;
}

const ReviewCard: React.FC<ReviewCardProps> = ({ review, showBusinessName = false, hideResponse = false }) => {
    const { user } = useAuth();
    const { language } = useI18n();
    const t = useTranslation();
    const { showNotification } = useNotification();
    const { text: textToDisplay, isTranslating, canToggle, showOriginal, toggle, translationError } = useGeminiTranslation(review.review_text);

    // Local state for vote counts to update immediately after voting
    const [localHelpfulVotes, setLocalHelpfulVotes] = useState(review.helpful_votes || 0);
    const [localNotHelpfulVotes, setLocalNotHelpfulVotes] = useState(review.not_helpful_votes || 0);
    const [isVoting, setIsVoting] = useState(false);
    const [userVote, setUserVote] = useState<'helpful' | 'not_helpful' | null>(null);

    // Load user's vote on mount
    useEffect(() => {
        const loadUserVote = async () => {
            if (user) {
                try {
                    const vote = await getUserVoteOnReview(review.id, user.id);
                    if (vote.hasVoted) {
                        setUserVote(vote.isHelpful ? 'helpful' : 'not_helpful');
                    }
                } catch (error) {
                    console.error('Error loading user vote:', error);
                }
            }
        };
        loadUserVote();
    }, [review.id, user]);

    // Update local state when review prop changes
    useEffect(() => {
        setLocalHelpfulVotes(review.helpful_votes || 0);
        setLocalNotHelpfulVotes(review.not_helpful_votes || 0);
    }, [review.helpful_votes, review.not_helpful_votes]);
    
    const hasResponse = review.review_responses && review.review_responses.length > 0;
    const isPending = review.status === 'pending';
    const isRejected = review.status === 'rejected';
    
    const sourceKey = (review.source || 'opynio').trim().toLowerCase();
    const isGoogleReview = sourceKey === 'google';
    const isTrustIndexReview = sourceKey === 'trustindex';
    const isImportedReview = isGoogleReview || isTrustIndexReview;
    
    const sourceDetails: { [key: string]: { name: string; icon: string; } } = {
        google: { name: 'Google', icon: 'fab fa-google' },
        trustindex: { name: 'Trustindex', icon: 'fa-solid fa-check-circle' },
    };

    const sourceInfo = isImportedReview ? sourceDetails[sourceKey] : null;
    const originalResponseText = (review.review_responses && review.review_responses[0]?.response_text) || review.original_response_text;

    const countryInfo = useMemo(() => {
        if (!review.businesses || !review.businesses.country) return null;
        return COUNTRIES.find(c => c.code === review.businesses.country);
    }, [review.businesses]);
    
    const getCategoryTranslation = (categoryString: string | null): string => {
        if (!categoryString) return '';

        // Extract main category and subcategory if format is "Category: Subcategory"
        let mainCategory = categoryString;
        let subCategory = '';

        if (categoryString.includes(':')) {
            [mainCategory, subCategory] = categoryString.split(':');
            mainCategory = mainCategory.trim();
            subCategory = subCategory.trim();
        }

        // Convert English category name to Spanish if needed (for database compatibility)
        const categoryKey = getCategorySpanishName(mainCategory);

        // Translate main category using i18n
        const translatedMain = t(`categories.${categoryKey}`);
        const mainCategoryTranslated = translatedMain.startsWith('categories.') ? mainCategory : translatedMain;

        // If there's a subcategory, translate it too
        if (subCategory) {
            // Check if subcategory is already in snake_case format (e.g., "climatizacion_aerotermia_y_energia_solar")
            // or in Spanish format (e.g., "Climatización, Aerotermia Y Energía Solar")
            let subCategoryKey: string | null = null;

            if (subCategory.includes('_')) {
                // Already in snake_case format, use directly
                subCategoryKey = subCategory;
            } else {
                // Spanish format, use mapping to get the correct translation key
                subCategoryKey = getSubcategoryKey(subCategory);
            }

            if (subCategoryKey) {
                const translatedSub = t(`subcategories.${subCategoryKey}`);
                const subCategoryTranslated = translatedSub.startsWith('subcategories.') ? subCategory : translatedSub;
                return `${mainCategoryTranslated}: ${subCategoryTranslated}`;
            }

            // Fallback if no mapping found
            return `${mainCategoryTranslated}: ${subCategory}`;
        }

        return mainCategoryTranslated;
    };

    const displayTags = useMemo(() => {
        const tags = new Set<string>();

        // Use the business's current category instead of the review's stored category
        const categoryToUse = review.businesses?.category || review.category;
        const translatedCategory = getCategoryTranslation(categoryToUse);
        if(translatedCategory) tags.add(translatedCategory);

        (review.tags || []).forEach(tag => {
            // Translate format tags like 'texto', 'audio', etc.
            if (['texto', 'imágenes', 'audio'].includes(tag)) {
                tags.add(t(`common.${tag}`));
            } else {
                tags.add(tag);
            }
        });

        if (review.review_text && !review.audio_url && !tags.has(t('common.texto'))) {
            tags.add(t('common.texto'));
        }
        
        return Array.from(tags);
    }, [review.tags, review.review_text, review.audio_url, review.category, review.businesses?.category, t]);

    const timeAgo = (dateString: string): string => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        // Handle future dates by treating them as "just now"
        // This can happen if the server time is ahead or data has incorrect dates
        if (diffInSeconds < 0) {
            return t('common.justNow');
        }

        if (diffInSeconds < 60) {
            return t('common.justNow');
        }

        // Map language codes to Intl-compatible locale codes
        const localeMap: { [key: string]: string } = {
            cn: 'zh-CN',
            br: 'pt-BR',
            en: 'en-US',
            es: 'es-ES',
            fr: 'fr-FR',
            de: 'de-DE',
            it: 'it-IT',
            ca: 'ca-ES',
        };
        const locale = localeMap[language] || language;

        const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

        const units: { [key: string]: number } = { year: 31536000, month: 2592000, week: 604800, day: 86400, hour: 3600, minute: 60 };

        for (const unit in units) {
            const interval = diffInSeconds / units[unit];
            if (interval >= 1) {
                return rtf.format(-Math.floor(interval), unit as Intl.RelativeTimeFormatUnit);
            }
        }

        return t('common.justNow');
    };


    const handleVote = async (voteType: 'helpful' | 'not_helpful') => {
        if (!user) {
            showNotification(t('common.loginToVote') || "Debes iniciar sesión para votar.", 'info');
            return;
        }

        if (isVoting) return; // Prevent multiple clicks

        // Si el usuario ya votó lo mismo, eliminar el voto
        if (userVote === voteType) {
            setIsVoting(true);
            try {
                const result = await removeVoteOnReview(review.id, user.id);

                // Update local state with the new vote counts
                setLocalHelpfulVotes(result.helpful_votes);
                setLocalNotHelpfulVotes(result.not_helpful_votes);

                // Clear user's vote state
                setUserVote(null);

                // Show notification
                showNotification(t('common.voteRemoved') || "Voto eliminado", 'info');
            } catch (error) {
                console.error("Failed to remove vote:", error);
                showNotification(t('common.voteError') || "No se pudo eliminar tu voto.", 'error');
            } finally {
                setIsVoting(false);
            }
            return;
        }

        // Votar o cambiar voto
        setIsVoting(true);
        try {
            const result = await voteOnReview(review.id, user.id, voteType);

            // Update local state with the new vote counts
            setLocalHelpfulVotes(result.helpful_votes);
            setLocalNotHelpfulVotes(result.not_helpful_votes);

            // Update user's vote state
            setUserVote(voteType);

            // Show success notification
            const message = voteType === 'helpful'
                ? (t('common.voteRegisteredHelpful') || "¡Gracias por tu voto!")
                : (t('common.voteRegisteredNotHelpful') || "Voto registrado");
            showNotification(message, 'success');
        } catch (error) {
            console.error("Failed to cast vote:", error);
            showNotification(t('common.voteError') || "No se pudo registrar tu voto.", 'error');
        } finally {
            setIsVoting(false);
        }
    };

    // Generate business path, but only if we have business data
    const businessPath = review.businesses
        ? generateBusinessPath(review.businesses)
        : '#'; // Fallback to # if no business data

    return (
        <article className="bg-white dark:bg-zinc-800 p-3 sm:p-4 md:p-5 rounded-lg border border-gray-200 dark:border-zinc-700">
            {isPending && (
                 <div className="px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 md:py-3 -mx-3 sm:-mx-4 md:-mx-5 -mt-3 sm:-mt-4 md:-mt-5 mb-3 sm:mb-4 md:mb-5 bg-yellow-50 dark:bg-yellow-900/30 border-b border-yellow-200 dark:border-yellow-800/50 text-yellow-800 dark:text-yellow-300 text-xs sm:text-sm">
                    <div className="font-semibold flex items-center gap-2 mb-1"><i className="fa-solid fa-clock"></i><span>{t('common.pendingReview')}</span></div>
                </div>
            )}
             {isRejected && (
                <div className="px-3 sm:px-4 md:px-5 py-2 -mx-3 sm:-mx-4 md:-mx-5 -mt-3 sm:-mt-4 md:-mt-5 mb-3 sm:mb-4 md:mb-5 bg-red-50 dark:bg-red-900/30 border-b border-red-200 dark:border-red-800/50 text-red-800 dark:text-red-300 text-xs sm:text-sm font-semibold">
                    <div className="flex items-center gap-2"><i className="fa-solid fa-times-circle"></i><span>{t('common.rejectedReview')}</span></div>
                    {review.rejection_reason && <p className="text-[10px] sm:text-xs font-normal mt-1 pl-4 sm:pl-6">{t('common.reason')}: {review.rejection_reason}</p>}
                    {user?.id === review.user_id && <ReactRouterDOM.Link to="/soporte" state={{ initialTab: 'claim_review', reviewId: review.id, reviewTitle: review.title }} className="text-[10px] sm:text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline mt-1 sm:mt-2 inline-block pl-4 sm:pl-6"><i className="fa-solid fa-flag mr-1"></i>{t('common.appealDecision')}</ReactRouterDOM.Link>}
                </div>
            )}

            <div className="flex flex-col gap-3 sm:gap-4">
                <div className="flex justify-between items-center">
                    <StarRating rating={review.rating} size="small" />
                    <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{timeAgo(review.created_at)}</span>
                </div>

                <h3 className="font-bold text-base sm:text-lg text-gray-900 dark:text-gray-100 break-words">{review.title}</h3>

                {showBusinessName && review.businesses && (
                    <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">
                        Para: <ReactRouterDOM.Link to={businessPath} className="font-bold text-gray-700 dark:text-gray-300 hover:underline">{review.businesses.name}</ReactRouterDOM.Link>
                    </p>
                )}

                {displayTags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        {displayTags.map(tag => (
                             <span key={tag} className="bg-gray-100 dark:bg-zinc-700 text-gray-800 dark:text-gray-300 text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded capitalize">
                                {tag}
                            </span>
                        ))}
                    </div>
                )}

                {isTranslating && <div className="animate-pulse bg-gray-200 dark:bg-zinc-700 h-12 sm:h-16 rounded-md"></div>}
                {!isTranslating && translationError && <p className="text-xs sm:text-sm text-red-500 bg-red-50 dark:bg-red-900/30 p-2 rounded-md">Could not translate review. Viewing in original language.</p>}
                {textToDisplay && <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 leading-relaxed">{textToDisplay}</p>}

                {canToggle && (
                    <button onClick={toggle} className="text-[10px] sm:text-xs font-bold text-brand-green hover:underline self-start">
                        {showOriginal ? 'Show translation' : 'Read in original language'}
                    </button>
                )}

                {review.audio_url && <AudioPlayer audioSrc={review.audio_url} />}
                {review.image_urls && review.image_urls.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
                        {review.image_urls.map((url, index) => (
                            <a key={index} href={url} target="_blank" rel="noopener noreferrer" className="block">
                                <LazyImage src={url} alt={`Imagen de reseña ${index + 1}`} width={200} height={96} className="w-full h-20 sm:h-24 object-cover rounded-md border border-gray-200 dark:border-zinc-700 hover:opacity-90 transition-opacity" />
                            </a>
                        ))}
                    </div>
                )}
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200 dark:border-zinc-700">
                <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center font-bold overflow-hidden flex-shrink-0">
                         {review.profiles?.avatar_url ? (
                             <img src={review.profiles.avatar_url} alt={review.profiles?.name ?? 'Avatar'} width={32} height={32} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                         ) : (
                             <span className="text-xs sm:text-sm dark:text-gray-200">{(review.original_author_name || review.profiles?.name || 'A').charAt(0).toUpperCase()}</span>
                         )}
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="text-gray-500 dark:text-gray-400">
                            {t('common.reviewBy')} <span className="font-medium text-gray-800 dark:text-gray-200">{isImportedReview ? review.original_author_name : (review.profiles ? `${review.profiles.name}` : review.original_author_name) || 'Anónimo'}</span>
                        </span>
                        {countryInfo && (
                            <img src={countryInfo.flag} alt={countryInfo.name} title={countryInfo.name} width={16} height={16} loading="lazy" decoding="async" className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full" />
                        )}
                    </div>
                </div>
                {!isImportedReview && (
                    <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm">
                        <span className="text-gray-500 dark:text-gray-400 font-medium hidden sm:inline">{t('common.wasThisHelpful')}</span>
                        <button
                            onClick={() => handleVote('helpful')}
                            disabled={isVoting}
                            className={`flex items-center gap-1 sm:gap-1.5 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                userVote === 'helpful'
                                    ? 'text-green-600 dark:text-green-400'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400'
                            }`}
                        >
                            <i className={userVote === 'helpful' ? 'fa-solid fa-thumbs-up' : 'fa-regular fa-thumbs-up'}></i>
                            <span>{localHelpfulVotes}</span>
                        </button>
                        <button
                            onClick={() => handleVote('not_helpful')}
                            disabled={isVoting}
                            className={`flex items-center gap-1 sm:gap-1.5 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                userVote === 'not_helpful'
                                    ? 'text-red-600 dark:text-red-400'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400'
                            }`}
                        >
                            <i className={userVote === 'not_helpful' ? 'fa-solid fa-thumbs-down' : 'fa-regular fa-thumbs-down'}></i>
                            <span>{localNotHelpfulVotes}</span>
                        </button>
                    </div>
                )}
            </div>

            {(hasResponse || originalResponseText) && !hideResponse && (
                 <div className="bg-gray-50 dark:bg-zinc-900/50 -mx-3 sm:-mx-4 md:-mx-5 -mb-3 sm:-mb-4 md:-mb-5 mt-3 sm:mt-4 p-3 sm:p-4 md:p-5 border-t border-gray-200 dark:border-zinc-700">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-brand-green/20 flex items-center justify-center text-brand-green flex-shrink-0">
                            <i className="fa-solid fa-store text-xs sm:text-sm"></i>
                        </div>
                        <div>
                            <p className="text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-200">{t('common.responseFrom', {businessName: review.businesses?.name || 'La empresa'})}</p>
                            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{timeAgo(review.review_responses?.[0]?.created_at || review.original_response_date || new Date().toISOString())}</p>
                        </div>
                    </div>
                    <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 mt-2 sm:mt-3 pl-9 sm:pl-11">
                        {originalResponseText}
                    </p>
                </div>
            )}
        </article>
    );
};

export default memo(ReviewCard);
