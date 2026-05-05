import React, { useState, useEffect } from 'react';
import { useBusinessDashboard } from '../../../../contexts/BusinessDashboardContext';
import Spinner from '../../../Spinner';
import StarRating from '../../../StarRating';
import { supabase, getReviewsForBusiness } from '../../../../services/supabaseService';
import type { Review, Plan } from '../../../../types';
import ReviewCard from '../../../ReviewCard';
import RatingDistribution from '../../../RatingDistribution';
import * as ReactRouterDOM from 'react-router-dom';
import { useTranslation, useI18n, pathTranslations } from '../../../../contexts/i18nContext';
import { useAuth } from '../../../../contexts/AuthContext';

const StatCard: React.FC<{ title: string; value: string | number; icon: string }> = ({ title, value, icon }) => (
    <div className="bg-white dark:bg-zinc-800 p-4 sm:p-5 md:p-6 rounded-lg shadow-sm flex items-center justify-between border dark:border-zinc-700">
        <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{title}</p>
            <p className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100">{value}</p>
        </div>
        <div className="text-brand-green bg-green-100 dark:bg-green-900/50 p-2 sm:p-2.5 md:p-3 rounded-full flex-shrink-0 ml-2">
            <i className={`fa-solid ${icon} text-lg sm:text-xl md:text-2xl`}></i>
        </div>
    </div>
);

const PLAN_CREDIT_LIMITS: Record<Plan, number> = {
    free: 0,
    starter: 200,
    growth: 1000,
    pro: 5000,
    v2: 100000,
    enterprise: 100000,
};


const DashboardOverview: React.FC = () => {
    const { business } = useBusinessDashboard();
    const { profile } = useAuth();
    const t = useTranslation();
    const { language } = useI18n();
    const [stats, setStats] = useState<{
        totalReviews: number;
        averageRating: number;
        distribution: Record<number, number>;
    } | null>(null);
    const [recentReviews, setRecentReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (business) {
            const fetchData = async () => {
                setLoading(true);
                try {
                    // Fetch recent reviews and all ratings for stats in parallel
                    const [reviewsData, allRatingsRes] = await Promise.all([
                        getReviewsForBusiness(business.id, 1, 5), // for recent list
                        supabase.from('reviews').select('rating').eq('business_id', business.id).eq('status', 'approved') // for stats
                    ]);

                    // Calculate stats from allRatingsRes
                    const ratingsData = allRatingsRes.data || [];
                    const totalReviews = ratingsData.length;
                    const totalRatingSum = ratingsData.reduce((sum, { rating }) => sum + rating, 0);
                    const averageRating = totalReviews > 0 ? totalRatingSum / totalReviews : 0;

                    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
                    ratingsData.forEach(({ rating }) => {
                        if (distribution[rating] !== undefined) {
                            distribution[rating]++;
                        }
                    });

                    setStats({
                        totalReviews: totalReviews,
                        averageRating: averageRating,
                        distribution: distribution,
                    });
                    setRecentReviews(reviewsData);

                } catch (error) {
                    console.error("Failed to fetch dashboard overview data:", error);
                } finally {
                    setLoading(false);
                }
            };
            fetchData();
        }
    }, [business]);

    if (loading || !business) {
        return <div className="flex justify-center items-center h-48 sm:h-64"><Spinner /></div>;
    }

    if (!stats) {
        return <div className="text-center text-sm sm:text-base p-6 sm:p-8">{t('businessDashboard.errorLoadingStats')}</div>;
    }

    // Plan, créditos y AI usage viven en `profiles`, NO en `businesses`.
    const currentPlan: Plan = profile?.plan ?? 'free';
    const creditLimit = (currentPlan === 'enterprise' && profile?.ai_credit_limit)
        ? profile.ai_credit_limit
        : PLAN_CREDIT_LIMITS[currentPlan];
    const creditsUsed = profile?.ai_credits_used || 0;

    return (
        <div className="space-y-5 sm:space-y-6 md:space-y-8">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-gray-800 dark:text-gray-100">{t('businessDashboard.dashboardOverview')}</h1>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
                <StatCard title={t('businessDashboard.totalReviews')} value={stats.totalReviews} icon="fa-star" />
                <StatCard title={t('businessDashboard.averageRating')} value={stats.averageRating.toFixed(1)} icon="fa-star-half-alt" />
                {creditLimit > 0 && (
                     <StatCard title={t('businessDashboard.aiCreditsUsed')} value={`${creditsUsed} / ${creditLimit.toLocaleString()}`} icon="fa-robot" />
                )}
            </div>

            <div className="bg-white dark:bg-zinc-800 p-4 sm:p-5 md:p-6 rounded-lg sm:rounded-xl shadow-sm border dark:border-zinc-700">
                <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 dark:text-gray-100">{t('businessDashboard.ratingDistribution')}</h2>
                <RatingDistribution distribution={stats.distribution} totalReviews={stats.totalReviews} />
            </div>

            <div className="bg-white dark:bg-zinc-800 p-4 sm:p-5 md:p-6 rounded-lg sm:rounded-xl shadow-sm border dark:border-zinc-700">
                <div className="flex flex-col xs:flex-row justify-between items-start xs:items-center gap-2 sm:gap-0 mb-3 sm:mb-4">
                    <h2 className="text-lg sm:text-xl font-bold dark:text-gray-100">{t('businessDashboard.recentReviews')}</h2>
                    <ReactRouterDOM.Link to={pathTranslations[language].dashboardReviews} className="text-xs sm:text-sm font-semibold text-brand-green hover:underline">
                        {t('businessDashboard.seeAll')}
                    </ReactRouterDOM.Link>
                </div>
                <div className="space-y-3 sm:space-y-4">
                    {recentReviews.length > 0 ? (
                        recentReviews.map(review => <ReviewCard key={review.id} review={review} />)
                    ) : (
                        <p className="text-center text-sm sm:text-base text-gray-500 dark:text-gray-400 py-6 sm:py-8">{t('businessDashboard.noReviewsYet')}</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DashboardOverview;
