import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Spinner from '../Spinner';
// FIX: Changed react-router-dom imports to a namespace import to resolve module resolution issues.
import * as ReactRouterDOM from 'react-router-dom';
import type { Review } from '../../types';
import { getReviewsForUser, supabase } from '../../services/supabaseService';
import ReviewCard from '../ReviewCard';
import Meta from '../Meta';
import LazyRender from '../LazyRender';
import { useTranslation, useI18n, pathTranslations } from '../../contexts/i18nContext';
import { useNotification } from '../../contexts/NotificationContext';

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
    const { user, profile, businesses, loading: authLoading } = useAuth();
    const { showNotification } = useNotification();
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loadingReviews, setLoadingReviews] = useState(true);
    const [v2Loading, setV2Loading] = useState(false);
    const t = useTranslation();
    const { language } = useI18n();
    const navigate = ReactRouterDOM.useNavigate();

    // Flujo en dos pasos:
    //   1) Usuario authenticated sin negocios → debe registrar su empresa (gratis).
    //   2) Una vez es business_owner con un negocio → puede gestionar planes y v.2.
    // 'admin' no ve ninguna de las dos secciones.
    const isAdmin = profile?.role === 'admin';
    const isBusinessOwner = profile?.role === 'business_owner';
    const primaryBusinessId = businesses?.[0]?.id;
    const hasBusiness = !!primaryBusinessId;
    const showRegisterBusinessBlock = !!user && !isAdmin && !isBusinessOwner && !hasBusiness;

    // Auto-redirect: si el usuario se registró como empresa (intención
    // detectada en user_metadata o en el flag de localStorage) pero aún
    // no completó el wizard, mandarlo allí en lugar de mostrarle el perfil
    // de "usuario normal". Antes el usuario quedaba con role=authenticated
    // tras abandonar el wizard y la siguiente vez que entraba veía la pantalla
    // de "¿Tienes un negocio?" como si nunca se hubiera registrado como tal.
    useEffect(() => {
        if (authLoading) return;
        if (!user || !profile) return;
        if (isAdmin || isBusinessOwner) return;
        const intendedBusiness =
            user.user_metadata?.intended_role === 'business_owner' ||
            (typeof window !== 'undefined' && (
                localStorage.getItem('opynio_business_signup_flow') === 'true' ||
                localStorage.getItem('opynio_pending_business_data') !== null
            ));
        if (intendedBusiness) {
            const completePath = `/${pathTranslations[language].completeBusinessRegistration}?type=business`;
            navigate(completePath, { replace: true });
        }
    }, [authLoading, user, profile, isAdmin, isBusinessOwner, language, navigate]);

    const isOnV2 = profile?.plan === 'v2';
    // El bloque de gestión de suscripción sólo aparece cuando el usuario YA es
    // business_owner con al menos un negocio. Antes de eso debe registrar empresa.
    const canBuyV2 = !!user && isBusinessOwner && hasBusiness && !isOnV2;

    const handleBuyV2 = async () => {
        if (!primaryBusinessId) return;
        setV2Loading(true);
        try {
            const { data, error } = await supabase.functions.invoke('create-checkout-session', {
                body: { plan: 'v2', billingCycle: 'monthly', businessId: primaryBusinessId },
            });
            if (error) {
                // 409 → ya tiene v2 → mandar al portal en su lugar.
                // deno-lint-ignore no-explicit-any
                const ctx: any = (error as any)?.context;
                const status = ctx?.response?.status ?? ctx?.status;
                if (status === 409) {
                    await handleOpenPortal();
                    return;
                }
                throw error;
            }
            if (data?.url) {
                window.location.href = data.url;
            } else {
                throw new Error('No se recibió la URL de pago.');
            }
        } catch (err: any) {
            showNotification(err.message || 'No se pudo iniciar el checkout.', 'error');
            setV2Loading(false);
        }
    };

    const handleOpenPortal = async () => {
        setV2Loading(true);
        try {
            const { data, error } = await supabase.functions.invoke('create-portal-session');
            if (error) throw error;
            if (data?.url) {
                window.location.href = data.url;
            } else {
                throw new Error('No se recibió la URL del portal.');
            }
        } catch (err: any) {
            showNotification(err.message || 'No se pudo abrir el portal de facturación.', 'error');
            setV2Loading(false);
        }
    };

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
                         <ReactRouterDOM.Link to={`/${pathTranslations[language].editProfile}`} className="bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-200 font-semibold px-4 py-2 rounded-md hover:bg-gray-200 dark:hover:bg-zinc-600 transition-all text-sm self-start sm:self-center">
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

                    {/* Paso 1 — Usuario sin empresa: invitación a registrar empresa gratis. */}
                    {showRegisterBusinessBlock && (
                        <div className="mt-8 pt-6 border-t dark:border-zinc-700">
                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800/50 rounded-xl p-5 sm:p-6">
                                <div className="flex items-start gap-4">
                                    <div className="text-brand-green bg-green-100 dark:bg-green-900/40 p-3 rounded-full flex-shrink-0">
                                        <i className="fa-solid fa-store text-xl"></i>
                                    </div>
                                    <div className="flex-grow min-w-0">
                                        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">¿Tienes un negocio?</h2>
                                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1.5">
                                            Convierte tu cuenta en una <strong>cuenta de empresa</strong> para gestionar reseñas,
                                            responder a clientes y aparecer en Opynio. Es gratis empezar.
                                        </p>
                                        <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:gap-3">
                                            <ReactRouterDOM.Link
                                                to={`/${pathTranslations[language].completeBusinessRegistration}?type=business`}
                                                onClick={() => {
                                                    // Marca de intent + bandera para el modal de bienvenida tras éxito.
                                                    localStorage.setItem('opynio_business_signup_flow', 'true');
                                                }}
                                                className="bg-brand-green text-white font-semibold py-2.5 px-5 rounded-lg hover:bg-opacity-90 transition-colors shadow-sm flex items-center justify-center gap-2 text-sm"
                                            >
                                                <i className="fa-solid fa-rocket"></i>
                                                <span>Registra tu empresa gratis</span>
                                            </ReactRouterDOM.Link>
                                            <ReactRouterDOM.Link
                                                to={`/${pathTranslations[language].pricing}`}
                                                className="bg-white dark:bg-zinc-700 text-gray-700 dark:text-gray-200 font-semibold py-2.5 px-5 rounded-lg border border-gray-200 dark:border-zinc-600 hover:bg-gray-50 dark:hover:bg-zinc-600 transition-colors flex items-center justify-center gap-2 text-sm"
                                            >
                                                <i className="fa-solid fa-list-check"></i>
                                                <span>Ver planes</span>
                                            </ReactRouterDOM.Link>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Paso 2 — Business owner: gestión de plan / suscripción premium v.2. */}
                    {isBusinessOwner && hasBusiness && (
                        <div className="mt-8 pt-6 border-t dark:border-zinc-700">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Plan premium</h2>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                        Plan premium con capacidad para hasta <strong>20 negocios</strong>.
                                    </p>
                                </div>
                                <ReactRouterDOM.Link
                                    to={`/${pathTranslations[language].pricing}`}
                                    className="text-xs sm:text-sm font-semibold text-brand-green hover:underline self-start sm:self-center"
                                >
                                    Ver todos los planes <i className="fa-solid fa-arrow-right ml-1"></i>
                                </ReactRouterDOM.Link>
                            </div>
                            {isOnV2 ? (
                                <button
                                    type="button"
                                    onClick={handleOpenPortal}
                                    disabled={v2Loading}
                                    className="bg-brand-blue text-white font-bold py-2.5 px-5 rounded-lg hover:bg-opacity-90 transition-colors shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {v2Loading
                                        ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        : <i className="fa-solid fa-credit-card"></i>}
                                    <span>{v2Loading ? 'Abriendo portal…' : 'Gestionar plan'}</span>
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleBuyV2}
                                    disabled={v2Loading}
                                    className="bg-pink-600 text-white font-bold py-2.5 px-5 rounded-lg hover:bg-pink-700 transition-colors shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {v2Loading
                                        ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        : <i className="fa-solid fa-rocket"></i>}
                                    <span>{v2Loading ? 'Redirigiendo a Stripe…' : 'Activar plan'}</span>
                                </button>
                            )}
                        </div>
                    )}
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
                                <ReactRouterDOM.Link to={`/${pathTranslations[language].writeReview}`} className="text-brand-green font-bold hover:underline">
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