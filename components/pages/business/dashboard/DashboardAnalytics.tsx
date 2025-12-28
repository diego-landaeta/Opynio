import React, { useState, useEffect } from 'react';
import { useBusinessDashboard } from '../../../../contexts/BusinessDashboardContext';
import { useAuth } from '../../../../contexts/AuthContext';
import * as ReactRouterDOM from 'react-router-dom';
import { Plan } from '../../../../types';
import { getBusinessAnalytics } from '../../../../services/supabaseService';
import Spinner from '../../../Spinner';
import { useTranslation, useI18n, getLocaleFromLanguage } from '../../../../contexts/i18nContext';

// FIX: Add 'enterprise' plan to PLAN_HIERARCHY to match the Plan type definition.
const PLAN_HIERARCHY: Record<Plan, number> = {
    free: 0,
    starter: 1,
    growth: 2,
    pro: 3,
    enterprise: 4,
};

// --- START: Chart & Stat Components ---

const StatCard: React.FC<{ title: string; value: string; icon: string; trend?: string }> = ({ title, value, icon, trend }) => (
    <div className="bg-white dark:bg-zinc-800 p-3 sm:p-4 rounded-lg shadow-sm flex items-start justify-between border dark:border-zinc-700">
        <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{title}</p>
            <p className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100 mt-1">{value}</p>
            {trend && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 sm:mt-2">{trend}</p>}
        </div>
        <div className="text-brand-green bg-green-100 dark:bg-green-900/50 p-2 sm:p-2.5 md:p-3 rounded-full flex-shrink-0 ml-2">
            <i className={`fa-solid ${icon} text-lg sm:text-xl`}></i>
        </div>
    </div>
);

const BarChart: React.FC<{ data: Record<number, number>; total: number }> = ({ data, total }) => (
    <div className="space-y-2">
        {[5, 4, 3, 2, 1].map(star => {
            const count = data[star] || 0;
            const percentage = total > 0 ? (count / total) * 100 : 0;
            return (
                <div key={star} className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                    <span className="font-medium text-gray-600 dark:text-gray-300 w-10 sm:w-12 flex-shrink-0">{star} ★</span>
                    <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-2 sm:h-2.5">
                        <div
                            className="bg-brand-green h-2 sm:h-2.5 rounded-full"
                            style={{ width: `${percentage}%` }}
                        >
                        </div>
                    </div>
                     <span className="font-semibold text-gray-800 dark:text-gray-200 w-6 sm:w-8 text-right flex-shrink-0">{count}</span>
                </div>
            );
        })}
    </div>
);

const LineChart: React.FC<{ data: { date: string; count: number }[] }> = ({ data }) => {
    const t = useTranslation();
    const { language } = useI18n();

    if (!data || data.length === 0) {
        return <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">{t('businessPage.notEnoughDataForSummary')}</div>;
    }

    const maxValue = Math.max(...data.map(d => d.count), 1);

    // Create Y-axis with proper scaling
    const numMarkers = Math.min(5, maxValue + 1); // Don't show more markers than we have values
    const yAxisMarkers = [];

    if (maxValue <= 4) {
        // For small values, show each integer from max to 0
        for (let i = maxValue; i >= 0; i--) {
            yAxisMarkers.push(i);
        }
    } else {
        // For larger values, create evenly spaced markers
        for (let i = numMarkers - 1; i >= 0; i--) {
            const value = Math.round((maxValue / (numMarkers - 1)) * i);
            yAxisMarkers.push(value);
        }
    }

    // Limit data points for better visualization
    const limitedData = data.length > 52 ? data.slice(-52) : data;

    // Show labels intelligently based on data length to avoid overlap
    const showLabel = (index: number, total: number) => {
        if (total <= 7) return true; // Show all labels for very few bars
        if (total <= 14) return index % 2 === 0; // Show every 2nd
        if (total <= 30) return index % 5 === 0; // Show every 5th
        // For many bars, show ~6-8 labels evenly distributed
        const interval = Math.ceil(total / 7);
        return index % interval === 0;
    };

    // Format date label based on data length
    const formatDateLabel = (dateStr: string, total: number) => {
        const date = new Date(dateStr);
        const locale = getLocaleFromLanguage(language);
        if (total > 90) {
            // Show month for long ranges
            return date.toLocaleDateString(locale, { month: 'short', year: '2-digit' });
        } else if (total > 31) {
            // Show month and day for medium ranges
            return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
        }
        // Show day and month for short ranges
        return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    };

    return (
        <div className="h-48 sm:h-56 md:h-64 flex gap-2 sm:gap-4 text-[10px] sm:text-xs pb-6 sm:pb-8">
            <div className="flex flex-col justify-between text-right text-gray-500 dark:text-gray-400 min-w-[1.5rem] sm:min-w-[2rem]">
                {yAxisMarkers.map((marker, i) => <div key={`marker-${i}`}>{marker}</div>)}
            </div>
            <div className="flex-1 relative border-l border-gray-200 dark:border-zinc-700">
                {/* Grid lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                    {yAxisMarkers.slice(1).map((_, i) => (
                        <div key={`line-${i}`} className="border-b border-gray-200 dark:border-zinc-700"></div>
                    ))}
                </div>
                {/* Chart bars */}
                <div className="absolute inset-0 flex items-end justify-start gap-1 sm:gap-2 px-1 sm:px-2">
                    {limitedData.map((point, index) => {
                        const heightPercent = (point.count / maxValue) * 100;
                        // Limit bar width based on number of bars
                        const maxWidth = limitedData.length <= 7 ? '60px' : limitedData.length <= 30 ? '40px' : '100%';
                        return (
                            <div key={`bar-${point.date}-${index}`} className="flex flex-col justify-end items-center group relative" style={{ height: '100%', width: limitedData.length > 30 ? 'auto' : maxWidth, flexGrow: limitedData.length > 30 ? 1 : 0 }}>
                                <div
                                    className="w-full bg-brand-green rounded-t transition-all duration-300 hover:brightness-110 shadow-sm"
                                    style={{ height: `${heightPercent}%`, minHeight: point.count > 0 ? '4px' : '0px' }}
                                ></div>
                                {showLabel(index, limitedData.length) && (
                                    <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-gray-600 dark:text-gray-300 text-xs whitespace-nowrap">
                                        {formatDateLabel(point.date, limitedData.length)}
                                    </div>
                                )}
                                {point.count > 0 && (
                                    <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-10">
                                        <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs px-2 py-1.5 rounded shadow-lg whitespace-nowrap">
                                            <div className="font-semibold">{point.count} {point.count !== 1 ? t('businessDashboard.reviewsPlural') : t('common.review')}</div>
                                            <div className="text-[10px] opacity-75 mt-0.5">{formatDateLabel(point.date, limitedData.length)}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const DonutChart: React.FC<{ data: Record<string, number> }> = ({ data }) => {
    const t = useTranslation();
    const total = Object.values(data).reduce((sum, value) => sum + value, 0);
    if (total === 0) return <div className="text-sm text-center text-gray-500 dark:text-gray-400">{t('businessPage.notEnoughDataForSummary')}</div>;

    const colors: Record<string, string> = { opynio: '#00b67a', google: '#4285F4', trustindex: '#FFA500' };

    // Build conic gradient segments
    let cumulativePercent = 0;
    const gradients = Object.entries(data).map(([key, value]) => {
        const percent = (value / total) * 100;
        const color = colors[key] || '#ccc';
        const gradientPart = `${color} ${cumulativePercent}% ${cumulativePercent + percent}%`;
        cumulativePercent += percent;
        return gradientPart;
    });

    return (
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            <div className="relative w-32 h-32 sm:w-40 sm:h-40 flex items-center justify-center">
                <div
                    className="absolute inset-0 rounded-full"
                    style={{ background: `conic-gradient(from 0deg, ${gradients.join(', ')})` }}
                ></div>
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 bg-white dark:bg-zinc-800 rounded-full flex items-center justify-center shadow-inner">
                    <div className="text-center">
                        <div className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">{total}</div>
                        <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{total === 1 ? t('common.review') : t('businessDashboard.reviewsPlural')}</div>
                    </div>
                </div>
            </div>
            <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                {Object.entries(data).map(([key, value]) => (
                    <li key={key} className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: colors[key] }}></span>
                        <span className="font-semibold capitalize text-gray-800 dark:text-gray-200">{key}</span>
                        <span className="text-gray-500 dark:text-gray-400">({value} - {((value/total)*100).toFixed(0)}%)</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

// --- END: Chart & Stat Components ---


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
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100">{t('businessDashboard.advancedAnalyticsLockTitle')}: {featureName}</h2>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-2 max-w-md mx-auto">
                {t('businessDashboard.advancedAnalyticsLockSubtitle', { plan: requiredPlan })}
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

type DateRange = 30 | 90 | 3650; // Using a large number for "All time"

const DashboardAnalytics: React.FC = () => {
    const { business } = useBusinessDashboard();
    const t = useTranslation();
    const [loading, setLoading] = useState(true);
    const [analyticsData, setAnalyticsData] = useState<any>(null);
    const [dateRange, setDateRange] = useState<DateRange>(30);

    useEffect(() => {
        const loadAnalytics = async () => {
            if (!business) return;
            setLoading(true);
            try {
                const data = await getBusinessAnalytics(business.id, dateRange);
                setAnalyticsData(data);
            } catch (error) {
                console.error("Failed to load analytics:", error);
                setAnalyticsData(null);
            } finally {
                setLoading(false);
            }
        };
        loadAnalytics();
    }, [business, dateRange]);
    
    const dateFilters: { labelKey: string; value: DateRange }[] = [
        { labelKey: 'businessDashboard.last30Days', value: 30 },
        { labelKey: 'businessDashboard.last90Days', value: 90 },
        { labelKey: 'businessDashboard.allTime', value: 3650 },
    ];

    return (
        <div className="space-y-5 sm:space-y-6 md:space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
                 <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-gray-800 dark:text-gray-100">{t('businessDashboard.analyticsTitle')}</h1>
                 <div className="flex items-center gap-1 sm:gap-2 p-1 bg-gray-100 dark:bg-zinc-900 rounded-lg w-full sm:w-auto">
                    {dateFilters.map(filter => (
                        <button
                            key={filter.value}
                            onClick={() => setDateRange(filter.value)}
                            className={`flex-1 sm:flex-none py-1.5 sm:py-2 px-2 sm:px-4 rounded-md font-semibold transition-all text-xs sm:text-sm ${dateRange === filter.value ? 'bg-white dark:bg-zinc-700 shadow' : 'text-gray-600 dark:text-gray-400'}`}
                        >
                            {t(filter.labelKey)}
                        </button>
                    ))}
                </div>
            </div>

            <FeatureLock requiredPlan="growth" featureName={t('businessDashboard.dashboardAnalytics')}>
                {loading ? (
                     <div className="flex justify-center items-center h-64 sm:h-96"><Spinner /></div>
                ) : !analyticsData || analyticsData.totalReviews === 0 ? (
                    <div className="text-center p-8 sm:p-10 md:p-12 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border-2 border-dashed dark:border-zinc-700">
                        <i className="fa-solid fa-chart-simple text-4xl sm:text-5xl md:text-6xl text-gray-300 dark:text-gray-600 mb-3 sm:mb-4"></i>
                        <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100">{t('businessDashboard.noAnalyticsDataTitle')}</h2>
                        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-2">
                           {t('businessDashboard.noAnalyticsDataSubtitle')}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4 sm:space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
                            <StatCard title={t('businessDashboard.reviewsPeriod')} value={analyticsData.totalReviews} icon="fa-star" />
                            <StatCard title={t('businessDashboard.averageRating')} value={analyticsData.averageRating.toFixed(1)} icon="fa-star-half-alt" />
                            <StatCard title={t('businessDashboard.responseRate')} value={`${analyticsData.responseRate.toFixed(0)}%`} icon="fa-reply-all" />
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
                            <div className="lg:col-span-3 bg-white dark:bg-zinc-800 p-4 sm:p-5 md:p-6 rounded-lg shadow-sm border dark:border-zinc-700">
                                <h3 className="text-sm sm:text-base font-bold mb-3 sm:mb-4 text-gray-800 dark:text-gray-100">{t('businessDashboard.reviewsOverTime')}</h3>
                                <LineChart data={analyticsData.reviewsOverTime} />
                            </div>
                            <div className="lg:col-span-2 bg-white dark:bg-zinc-800 p-4 sm:p-5 md:p-6 rounded-lg shadow-sm border dark:border-zinc-700">
                                <h3 className="text-sm sm:text-base font-bold mb-3 sm:mb-4 text-gray-800 dark:text-gray-100">{t('businessDashboard.reviewSource')}</h3>
                                <DonutChart data={analyticsData.reviewsBySource} />
                            </div>
                        </div>
                         <div className="bg-white dark:bg-zinc-800 p-4 sm:p-5 md:p-6 rounded-lg shadow-sm border dark:border-zinc-700">
                            <h3 className="text-sm sm:text-base font-bold mb-3 sm:mb-4 text-gray-800 dark:text-gray-100">{t('businessDashboard.ratingDistribution')}</h3>
                            <BarChart data={analyticsData.ratingDistribution} total={analyticsData.totalReviews} />
                        </div>
                    </div>
                )}
            </FeatureLock>
        </div>
    );
};

export default DashboardAnalytics;