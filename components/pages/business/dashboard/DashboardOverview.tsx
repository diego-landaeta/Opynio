import React, { useState, useEffect, useMemo } from 'react';
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
import { useNotification } from '../../../../contexts/NotificationContext';

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


// Card "Comparte tu negocio" — genera la URL pública del perfil y permite
// compartirla por WhatsApp / email / redes, con un mensaje sugerido para
// pedir reseñas. Disponible en todos los planes (incluido free).
const ShareBusinessCard: React.FC<{ businessName: string; language: string }> = ({ businessName, language }) => {
    const { showNotification } = useNotification();
    const [copiedField, setCopiedField] = useState<'url' | 'message' | null>(null);

    // Construye la URL pública del perfil. window.location.origin permite que
    // el enlace funcione tanto en localhost (test) como en producción.
    const publicUrl = useMemo(() => {
        const slug = encodeURIComponent(businessName.replace(/ /g, '_'));
        const base = (typeof window !== 'undefined' && window.location.origin) || 'https://web.opynio.com';
        return `${base}/${language}/empresa/${slug}`;
    }, [businessName, language]);

    const suggestedMessage = useMemo(
        () => `¡Hola! Si has tenido una buena experiencia con ${businessName}, ¿podrías compartirla con una reseña en Opynio? Tu opinión ayuda a otros y a nosotros a mejorar. Aquí el enlace: ${publicUrl}`,
        [businessName, publicUrl]
    );

    const copyToClipboard = async (text: string, field: 'url' | 'message') => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedField(field);
            showNotification(field === 'url' ? '¡Enlace copiado!' : '¡Mensaje copiado!', 'success');
            setTimeout(() => setCopiedField(null), 2000);
        } catch {
            showNotification('No se pudo copiar — copia manualmente.', 'error');
        }
    };

    const encodedMessage = encodeURIComponent(suggestedMessage);
    const encodedUrl = encodeURIComponent(publicUrl);
    const encodedSubject = encodeURIComponent(`¿Te animarías a dejar una reseña a ${businessName}?`);

    const shareLinks = [
        {
            label: 'WhatsApp',
            icon: 'fa-brands fa-whatsapp',
            href: `https://wa.me/?text=${encodedMessage}`,
            color: 'bg-[#25D366] hover:bg-[#1fb958]',
        },
        {
            label: 'Email',
            icon: 'fa-solid fa-envelope',
            href: `mailto:?subject=${encodedSubject}&body=${encodedMessage}`,
            color: 'bg-gray-700 hover:bg-gray-800 dark:bg-zinc-600 dark:hover:bg-zinc-500',
        },
        {
            label: 'X / Twitter',
            icon: 'fa-brands fa-x-twitter',
            href: `https://twitter.com/intent/tweet?text=${encodedMessage}`,
            color: 'bg-black hover:bg-zinc-800',
        },
        {
            label: 'Facebook',
            icon: 'fa-brands fa-facebook-f',
            href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedMessage}`,
            color: 'bg-[#1877F2] hover:bg-[#1466d3]',
        },
        {
            label: 'LinkedIn',
            icon: 'fa-brands fa-linkedin-in',
            href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
            color: 'bg-[#0A66C2] hover:bg-[#08549e]',
        },
    ];

    return (
        <div className="relative bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-emerald-900/15 dark:via-zinc-800 dark:to-teal-900/15 rounded-xl shadow-sm border border-emerald-200 dark:border-emerald-800/40 overflow-hidden">
            {/* Decorative ribbon */}
            <div className="h-1 bg-gradient-to-r from-emerald-500 via-brand-green to-teal-500"></div>

            <div className="p-4 sm:p-6">
                <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-5">
                    <div className="flex-shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-brand-green flex items-center justify-center shadow-md shadow-brand-green/20">
                        <i className="fa-solid fa-share-nodes text-white text-lg sm:text-xl"></i>
                    </div>
                    <div className="flex-grow min-w-0">
                        <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.14em] text-brand-green">
                            Consigue más reseñas
                        </p>
                        <h2 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-gray-100 tracking-tight mt-0.5">
                            Comparte tu empresa
                        </h2>
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                            Cuantas más reseñas, más confianza. Comparte el enlace con tus clientes para que valoren su experiencia.
                        </p>
                    </div>
                </div>

                {/* URL pública */}
                <div className="mb-4">
                    <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                        Enlace público de tu perfil
                    </label>
                    <div className="flex items-stretch gap-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-brand-green focus-within:border-transparent transition-all">
                        <input
                            readOnly
                            value={publicUrl}
                            onFocus={(e) => e.target.select()}
                            aria-label="Enlace público del perfil"
                            title="Enlace público del perfil"
                            className="flex-grow min-w-0 px-3 py-2.5 text-xs sm:text-sm text-gray-700 dark:text-gray-200 bg-transparent focus:outline-none truncate"
                        />
                        <button
                            type="button"
                            onClick={() => copyToClipboard(publicUrl, 'url')}
                            className={`flex-shrink-0 px-3 sm:px-4 text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 ${
                                copiedField === 'url'
                                    ? 'bg-brand-green text-white'
                                    : 'bg-gray-50 dark:bg-zinc-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700'
                            }`}
                        >
                            <i className={`fa-solid ${copiedField === 'url' ? 'fa-check' : 'fa-copy'} text-xs`}></i>
                            <span className="hidden xs:inline">{copiedField === 'url' ? 'Copiado' : 'Copiar'}</span>
                        </button>
                    </div>
                </div>

                {/* Quick share buttons */}
                <div className="mb-4">
                    <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                        Compartir por
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {shareLinks.map((s) => (
                            <a
                                key={s.label}
                                href={s.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={`Compartir por ${s.label}`}
                                className={`group inline-flex items-center gap-2 ${s.color} text-white text-xs sm:text-sm font-semibold px-3 sm:px-4 py-2 rounded-lg shadow-sm transition-all hover:-translate-y-0.5`}
                            >
                                <i className={`${s.icon} text-sm`}></i>
                                <span>{s.label}</span>
                            </a>
                        ))}
                    </div>
                </div>

                {/* Mensaje sugerido */}
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Mensaje sugerido
                        </label>
                        <button
                            type="button"
                            onClick={() => copyToClipboard(suggestedMessage, 'message')}
                            className={`text-[11px] sm:text-xs font-semibold transition-colors flex items-center gap-1 ${
                                copiedField === 'message'
                                    ? 'text-brand-green'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-brand-green'
                            }`}
                        >
                            <i className={`fa-solid ${copiedField === 'message' ? 'fa-check' : 'fa-copy'} text-[10px]`}></i>
                            <span>{copiedField === 'message' ? 'Copiado' : 'Copiar mensaje'}</span>
                        </button>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 bg-white/60 dark:bg-zinc-900/40 border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2.5 leading-relaxed">
                        {suggestedMessage}
                    </p>
                </div>

                {/* Tip pro */}
                <div className="mt-4 pt-4 border-t border-emerald-200/50 dark:border-emerald-800/30 flex items-start gap-2.5">
                    <i className="fa-solid fa-lightbulb text-amber-500 text-sm mt-0.5 flex-shrink-0"></i>
                    <p className="text-[11px] sm:text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                        <strong className="text-gray-700 dark:text-gray-300">Tip:</strong> el mejor momento
                        para pedir una reseña es justo después de una experiencia positiva. Mejora tu plan
                        para enviar invitaciones masivas por email o generar códigos QR.
                    </p>
                </div>
            </div>
        </div>
    );
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

            {/* Sección "Comparte tu empresa" — accesible para todos los planes,
                permite obtener más reseñas de forma orgánica antes de pasar a
                invitaciones automatizadas (planes pago). */}
            <ShareBusinessCard businessName={business.name} language={language} />

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
