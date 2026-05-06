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
// compartirla por WhatsApp / email / redes, con varias plantillas de mensaje
// para pedir reseñas y un QR descargable para imprimir o mostrar en el local.
// Disponible en todos los planes (incluido free).
const SUPPORTED_LANGS = ['es', 'en', 'ca', 'fr', 'de', 'it', 'pt', 'br', 'cn'];

type MessageTone = 'friendly' | 'short' | 'warm';
const MESSAGE_TEMPLATES: { id: MessageTone; label: string; icon: string; build: (name: string, url: string) => string }[] = [
    {
        id: 'friendly',
        label: 'Amable',
        icon: 'fa-face-smile',
        build: (name, url) => `¡Hola! Si has tenido una buena experiencia con ${name}, ¿podrías compartirla con una reseña en Opynio? Tu opinión nos ayuda muchísimo. Aquí tienes el enlace: ${url}`,
    },
    {
        id: 'short',
        label: 'Directo',
        icon: 'fa-bolt',
        build: (name, url) => `¡Hola! ¿Nos dejas una reseña sobre ${name} en Opynio? Solo te lleva 1 minuto: ${url}`,
    },
    {
        id: 'warm',
        label: 'Cercano',
        icon: 'fa-heart',
        build: (name, url) => `¡Gracias por confiar en ${name}! Si te ha gustado, tu reseña en Opynio sería un regalazo. Te dejo el enlace: ${url}`,
    },
];

const ShareBusinessCard: React.FC<{ businessName: string; language: string }> = ({ businessName, language }) => {
    const { showNotification } = useNotification();
    const [copiedField, setCopiedField] = useState<'url' | 'message' | null>(null);
    const [activeTone, setActiveTone] = useState<MessageTone>('friendly');
    const [showQr, setShowQr] = useState(false);

    // Construye la URL pública del perfil tomando el lang code del PATH ACTUAL
    // del navegador (no del context i18n, que puede quedarse stale tras un
    // cambio de idioma rápido). Así si el dueño está viendo /en/... el enlace
    // que comparte también es /en/...
    const publicUrl = useMemo(() => {
        const slug = encodeURIComponent(businessName.replace(/ /g, '_'));
        let base = 'https://web.opynio.com';
        let langCode = language || 'es';
        if (typeof window !== 'undefined') {
            base = window.location.origin;
            const segs = window.location.pathname.split('/').filter(Boolean);
            // Primer segmento puede ser un país (ES, US…) o un idioma (es, en…).
            // Sólo aceptamos el segundo si está en la whitelist de idiomas.
            const first = (segs[0] || '').toLowerCase();
            if (SUPPORTED_LANGS.includes(first)) langCode = first;
        }
        return `${base}/${langCode}/empresa/${slug}`;
    }, [businessName, language]);

    const activeTemplate = MESSAGE_TEMPLATES.find(m => m.id === activeTone) ?? MESSAGE_TEMPLATES[0];
    const suggestedMessage = useMemo(
        () => activeTemplate.build(businessName, publicUrl),
        [activeTemplate, businessName, publicUrl]
    );

    // QR generado por servicio público (sin libs ni tokens). Tamaño grande para
    // imprimir bien en cartelitos / sticker de mesa.
    const qrSrc = useMemo(
        () => `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=12&data=${encodeURIComponent(publicUrl)}`,
        [publicUrl]
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
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border dark:border-zinc-700 overflow-hidden">
            {/* Header compacto: solo título + descripción de una línea */}
            <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 flex items-start justify-between gap-3 border-b border-gray-100 dark:border-zinc-700/60">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-brand-green/10 text-brand-green flex items-center justify-center">
                        <i className="fa-solid fa-share-nodes text-base sm:text-lg"></i>
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                            Comparte tu empresa
                        </h2>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            Más reseñas, más confianza
                        </p>
                    </div>
                </div>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
                {/* URL pública — pill clickeable que copia el enlace.
                    Acompañada de un botón QR para mostrar/imprimir el código. */}
                <div className="flex items-stretch gap-2">
                    <button
                        type="button"
                        onClick={() => copyToClipboard(publicUrl, 'url')}
                        title="Copiar enlace"
                        className={`group flex-1 min-w-0 flex items-center gap-2.5 sm:gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${
                            copiedField === 'url'
                                ? 'bg-brand-green/10 border-brand-green/40 dark:bg-brand-green/15'
                                : 'bg-gray-50 dark:bg-zinc-900/60 border-gray-200 dark:border-zinc-700 hover:border-brand-green/40 hover:bg-brand-green/5 dark:hover:bg-brand-green/5'
                        }`}
                    >
                        <i className={`fa-solid ${copiedField === 'url' ? 'fa-check text-brand-green' : 'fa-link text-gray-400 group-hover:text-brand-green'} text-sm flex-shrink-0 transition-colors`}></i>
                        <span className="flex-grow min-w-0 font-mono text-xs sm:text-[13px] text-gray-700 dark:text-gray-200 truncate">
                            {publicUrl}
                        </span>
                        <span className={`hidden xs:inline flex-shrink-0 text-[11px] sm:text-xs font-semibold transition-colors ${
                            copiedField === 'url' ? 'text-brand-green' : 'text-gray-400 group-hover:text-brand-green'
                        }`}>
                            {copiedField === 'url' ? '¡Copiado!' : 'Copiar'}
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowQr(v => !v)}
                        title={showQr ? 'Ocultar QR' : 'Mostrar QR'}
                        aria-pressed={showQr ? 'true' : 'false'}
                        className={`flex-shrink-0 w-11 sm:w-12 rounded-lg border flex items-center justify-center transition-all ${
                            showQr
                                ? 'bg-brand-green text-white border-brand-green shadow-sm'
                                : 'bg-gray-50 dark:bg-zinc-900/60 border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-gray-400 hover:border-brand-green/40 hover:text-brand-green'
                        }`}
                    >
                        <i className="fa-solid fa-qrcode text-base"></i>
                    </button>
                </div>

                {/* QR desplegable — pensado para imprimir en cartelitos y mesas.
                    Genera la imagen vía api.qrserver.com (público, sin auth). */}
                {showQr && (
                    <div className="rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900/60 p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
                        <div className="bg-white p-2 sm:p-3 rounded-lg shadow-sm flex-shrink-0">
                            <img
                                src={qrSrc}
                                alt={`Código QR para ${businessName}`}
                                width={160}
                                height={160}
                                loading="lazy"
                                className="block w-32 h-32 sm:w-40 sm:h-40"
                            />
                        </div>
                        <div className="flex-1 min-w-0 text-center sm:text-left">
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                Imprime este QR en tu local
                            </p>
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                                Tus clientes lo escanean y van directo a tu perfil para dejarte una reseña en segundos.
                            </p>
                            <a
                                href={qrSrc}
                                download={`opynio-qr-${businessName.toLowerCase().replace(/\s+/g, '-')}.png`}
                                className="mt-3 inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-brand-green hover:underline"
                            >
                                <i className="fa-solid fa-download text-[11px]"></i>
                                Descargar QR
                            </a>
                        </div>
                    </div>
                )}

                {/* Botones de share como iconos circulares grandes — share sheet style */}
                <div className="grid grid-cols-5 gap-2 sm:gap-3">
                    {shareLinks.map((s) => (
                        <a
                            key={s.label}
                            href={s.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Compartir por ${s.label}`}
                            className="group flex flex-col items-center gap-1.5 sm:gap-2"
                        >
                            <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full ${s.color} text-white flex items-center justify-center shadow-md transition-all group-hover:-translate-y-0.5 group-hover:shadow-lg`}>
                                <i className={`${s.icon} text-base sm:text-lg`}></i>
                            </div>
                            <span className="text-[10px] sm:text-xs font-medium text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-colors truncate max-w-full">
                                {s.label}
                            </span>
                        </a>
                    ))}
                </div>

                {/* Plantillas de mensaje para pedir reseñas — el dueño elige el tono
                    (amable / directo / cercano) y copia el mensaje listo. Colapsable
                    para no abrumar con texto cuando el card sólo se usa para share. */}
                <details className="group rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50/50 dark:bg-zinc-900/40">
                    <summary className="flex items-center justify-between gap-2 cursor-pointer list-none px-3 py-2.5 select-none">
                        <span className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">
                            <i className="fa-solid fa-comment-dots text-brand-green text-xs"></i>
                            Plantillas para pedir reseñas
                        </span>
                        <i className="fa-solid fa-chevron-down text-xs text-gray-400 transition-transform group-open:rotate-180"></i>
                    </summary>
                    <div className="px-3 pb-3 pt-1 space-y-2.5">
                        {/* Selector de tono */}
                        <div className="flex flex-wrap gap-1.5">
                            {MESSAGE_TEMPLATES.map(tpl => {
                                const active = tpl.id === activeTone;
                                return (
                                    <button
                                        key={tpl.id}
                                        type="button"
                                        onClick={() => setActiveTone(tpl.id)}
                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-all ${
                                            active
                                                ? 'bg-brand-green text-white shadow-sm'
                                                : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-zinc-700 hover:border-brand-green/50 hover:text-brand-green'
                                        }`}
                                    >
                                        <i className={`fa-solid ${tpl.icon} text-[10px]`}></i>
                                        {tpl.label}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-zinc-900/60 border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2.5 leading-relaxed">
                            {suggestedMessage}
                        </p>
                        <button
                            type="button"
                            onClick={() => copyToClipboard(suggestedMessage, 'message')}
                            className={`inline-flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                                copiedField === 'message'
                                    ? 'text-brand-green'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-brand-green'
                            }`}
                        >
                            <i className={`fa-solid ${copiedField === 'message' ? 'fa-check' : 'fa-copy'} text-[10px]`}></i>
                            <span>{copiedField === 'message' ? '¡Mensaje copiado!' : 'Copiar mensaje'}</span>
                        </button>
                    </div>
                </details>
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
