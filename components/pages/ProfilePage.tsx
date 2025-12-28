import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Spinner from '../Spinner';
// FIX: Changed react-router-dom imports to a namespace import to resolve module resolution issues.
import * as ReactRouterDOM from 'react-router-dom';
import type { Review } from '../../types';
import { getReviewsForUser } from '../../services/supabaseService';
import ReviewCard from '../ReviewCard';
import Meta from '../Meta';
import LazyRender from '../LazyRender';
import { useTranslation, useI18n, pathTranslations } from '../../contexts/i18nContext';

const StatCard: React.FC<{ title: string; value: number | string; icon: string }> = ({ title, value, icon }) => (
    <div className="bg-gray-50 dark:bg-zinc-800 p-4 rounded-lg flex items-center gap-4">
        <div className="text-brand-green bg-green-100 dark:bg-green-900/50 p-3 rounded-full">
            <i className={`fa-solid ${icon} text-xl`}></i>
        </div>
        <div>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{value}</p>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
        </div>
    </div>
);


const ProfilePage: React.FC = () => {
    const { user, profile, loading: authLoading } = useAuth();
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loadingReviews, setLoadingReviews] = useState(true);
    const t = useTranslation();
    const { language } = useI18n();

    useEffect(() => {
        if (user) {
            const fetchUserReviews = async () => {
                setLoadingReviews(true);
                try {
                    const userReviews = await getReviewsForUser(user.id);
                    setReviews(userReviews);
                } catch (error) {
                    console.error("Failed to fetch user reviews:", error);
                } finally {
                    setLoadingReviews(false);
                }
            };
            fetchUserReviews();
        }
    }, [user]);

    if (authLoading) {
        return <div className="flex justify-center items-center h-64"><Spinner /></div>;
    }

    if (!user || !profile) {
        return (
            <div className="text-center">
                <h1 className="text-2xl font-bold">{t('profilePage.notLoggedIn')}</h1>
                <p className="text-gray-600 mt-2">{t('profilePage.pleaseLogIn')}</p>
            </div>
        );
    }
    
    const roleKey = `profilePage.role_${profile.role}`;
    const roleName = t(roleKey);
    const roleInfo = {
        name: roleName,
        badgeColor: profile.role === 'admin' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' :
                    profile.role === 'business_owner' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' :
                    'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
    };

    const averageRatingGiven = reviews.length > 0
        ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
        : 'N/A';

    return (
        <>
            <Meta
                title={t('meta.profileTitle')}
                description={t('meta.profileDesc')}
                noindex={true}
            />
            <div className="max-w-4xl mx-auto space-y-12">
                <div className="bg-white dark:bg-zinc-800 p-8 rounded-xl shadow-lg">
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                         <div className="w-24 h-24 rounded-full bg-brand-green/20 flex items-center justify-center text-brand-green text-4xl font-bold flex-shrink-0">
                            {profile.avatar_url ? (
                                <img src={profile.avatar_url} alt="Avatar" width={96} height={96} loading="lazy" decoding="async" className="w-full h-full object-cover rounded-full" />
                            ) : (
                                <span>{profile.name?.charAt(0).toUpperCase()}</span>
                            )}
                        </div>
                        <div className="flex-grow">
                            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">{profile.name}</h1>
                            <p className="text-gray-500 dark:text-gray-400">
                                {profile.username && <span className="font-semibold">@{profile.username}</span>}
                                {profile.username && user.email && <span className="mx-2">&middot;</span>}
                                {user.email}
                            </p>
                             <span className={`mt-2 inline-block text-xs font-semibold px-3 py-1 rounded-full capitalize ${roleInfo.badgeColor}`}>
                                {roleInfo.name}
                            </span>
                        </div>
                         <ReactRouterDOM.Link to={`/${pathTranslations.es.editProfile}`} className="bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-200 font-semibold px-4 py-2 rounded-md hover:bg-gray-200 dark:hover:bg-zinc-600 transition-all text-sm self-start sm:self-center">
                            {t('profilePage.editProfile')}
                        </ReactRouterDOM.Link>
                    </div>

                    <div className="mt-8 border-t dark:border-zinc-700 pt-6">
                        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">{t('profilePage.yourStats')}</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <StatCard title={t('profilePage.reviewsWritten')} value={reviews.length} icon="fa-pencil" />
                            <StatCard title={t('profilePage.helpfulVotesReceived')} value={profile.helpful_review_count || 0} icon="fa-thumbs-up" />
                            <StatCard title={t('profilePage.averageRatingGiven')} value={averageRatingGiven} icon="fa-star-half-alt" />
                        </div>
                    </div>
                    
                    <div className="mt-8">
                         <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">{t('profilePage.accountInfo')}</h2>
                         <div className="mt-2 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                            <p><span className="font-medium text-gray-800 dark:text-gray-200">{t('profilePage.userId')}</span> {user.id}</p>
                            <p><span className="font-medium text-gray-800 dark:text-gray-200">{t('profilePage.registeredOn')}</span> {new Date(user.created_at).toLocaleDateString(language)}</p>
                         </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-800 p-8 rounded-xl shadow-lg">
                    <h2 className="text-2xl font-bold mb-4 dark:text-gray-100">{t('profilePage.myRecentReviews')}</h2>
                    {loadingReviews ? (
                        <div className="flex justify-center items-center h-40"><Spinner /></div>
                    ) : reviews.length > 0 ? (
                        <div className="space-y-6">
                            {reviews.map(review => (
                                <LazyRender key={review.id} placeholderHeight="250px">
                                    <ReviewCard review={review} showBusinessName={true} />
                                </LazyRender>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-900/50 rounded-lg">
                            <p className="font-semibold">{t('profilePage.noReviewsWrittenYet')}</p>
                            <p className="text-sm mt-1">
                                <ReactRouterDOM.Link to={`/${pathTranslations.es.writeReview}`} className="text-brand-green font-bold hover:underline">
                                    {t('profilePage.shareFirstExperience')}
                                </ReactRouterDOM.Link>
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default ProfilePage;