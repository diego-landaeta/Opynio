import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import Meta from '../Meta';
import Schema from '../Schema';
import Spinner from '../Spinner';
import StarRating from '../StarRating';
import ReviewCard from '../ReviewCard';
import LazyRender from '../LazyRender';
import BusinessLogo from '../BusinessLogo';
import { getBusinessBySlug, getBusinessByName, getPublicProductBySlug } from '../../services/supabaseService';
import { getReviewsOptimized } from '../../services/optimizedQueries';
import { useTranslation, useI18n, pathTranslations, getLanguageForCountryCode } from '../../contexts/i18nContext';
import type { Business, Review, ReviewSubject } from '../../types';

const PUBLIC_BASE_URL = 'https://web.opynio.com';
const PAGE_SIZE = 20;

/**
 * Ficha pública de un producto: su nota, sus reseñas y su propio
 * `schema.org/Product` con `aggregateRating`.
 *
 * Hasta ahora el widget de un producto prometía "Reseñas de X" y llevaba a la
 * ficha de la empresa. Esta página es el destino que de verdad corresponde, y
 * es la única forma de que Google entienda que ese curso tiene su propia nota:
 * el schema de la ficha de empresa usa la EMPRESA como si fuera un producto.
 */
const ProductPage: React.FC = () => {
    const { identifier, productSlug, countryCode } = useParams<{ identifier: string; productSlug: string; countryCode: string }>();
    const t = useTranslation();
    const { language } = useI18n();

    const [business, setBusiness] = useState<Business | null>(null);
    const [product, setProduct] = useState<ReviewSubject | null>(null);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [noExiste, setNoExiste] = useState(false);

    // Empresa y producto. Si cualquiera de los dos no está, la página no existe:
    // mejor decirlo que enseñar una ficha vacía que Google indexaría.
    useEffect(() => {
        let cancelado = false;
        const cargar = async () => {
            if (!identifier || !productSlug) return;
            setIsLoading(true);
            setNoExiste(false);
            try {
                const decodificado = decodeURIComponent(identifier);
                let negocio = await getBusinessBySlug(decodificado.toLowerCase());
                if (!negocio) negocio = await getBusinessByName(decodificado.replace(/_/g, ' ').trim());
                if (!negocio) { if (!cancelado) { setNoExiste(true); setIsLoading(false); } return; }

                const producto = await getPublicProductBySlug(negocio.id, productSlug);
                if (!producto) { if (!cancelado) { setBusiness(negocio as Business); setNoExiste(true); setIsLoading(false); } return; }

                if (cancelado) return;
                setBusiness(negocio as Business);
                setProduct(producto);
            } catch (error) {
                console.error('Error cargando la ficha del producto:', error);
                if (!cancelado) setNoExiste(true);
            } finally {
                if (!cancelado) setIsLoading(false);
            }
        };
        cargar();
        return () => { cancelado = true; };
    }, [identifier, productSlug]);

    const cargarResenas = useCallback(async (pagina: number) => {
        if (!business || !product) return;
        if (pagina > 1) setIsLoadingMore(true);
        try {
            const datos = await getReviewsOptimized(business.id, pagina, PAGE_SIZE, 'all', 'all', product.id);
            setReviews(prev => pagina === 1 ? datos : [...prev, ...datos]);
            setHasMore(datos.length === PAGE_SIZE);
        } catch (error) {
            console.error('Error cargando reseñas del producto:', error);
        } finally {
            setIsLoadingMore(false);
        }
    }, [business, product]);

    useEffect(() => { setPage(1); cargarResenas(1); }, [cargarResenas]);
    useEffect(() => { if (page > 1) cargarResenas(page); }, [page, cargarResenas]);

    const paisActivo = (countryCode || business?.country || 'es').toLowerCase();
    const idiomaDeLaPagina = getLanguageForCountryCode(paisActivo.toUpperCase()) || language;
    const rutas = pathTranslations[idiomaDeLaPagina] || pathTranslations.es;

    const urlDeLaEmpresa = useMemo(() => {
        if (!business) return '#';
        const slug = (business as any).slug || encodeURIComponent(business.name.replace(/ /g, '_'));
        return `/${paisActivo}/${rutas.business.replace(':identifier', slug)}`;
    }, [business, paisActivo, rutas]);

    const canonical = useMemo(() => {
        if (!business || !product) return undefined;
        const slug = (business as any).slug || encodeURIComponent(business.name.replace(/ /g, '_'));
        const ruta = rutas.productPage
            .replace(':identifier', slug)
            .replace(':productSlug', product.slug || product.id);
        return `${PUBLIC_BASE_URL}/${paisActivo}/${ruta}`;
    }, [business, product, paisActivo, rutas]);

    // El `Product` de verdad: con su propia nota agregada y sus propias reseñas,
    // no la empresa disfrazada de producto.
    const schema = useMemo(() => {
        if (!business || !product) return null;
        const datos: any = {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: product.name,
            description: product.description || undefined,
            image: product.image_url || undefined,
            brand: { '@type': 'Organization', name: business.name },
            url: canonical,
        };
        if ((product.review_count ?? 0) > 0) {
            datos.aggregateRating = {
                '@type': 'AggregateRating',
                ratingValue: (product.avg_rating ?? 0).toFixed(1),
                reviewCount: product.review_count,
                bestRating: 5,
                worstRating: 1,
            };
        }
        if (reviews.length > 0) {
            datos.review = reviews.slice(0, 10).map(r => ({
                '@type': 'Review',
                author: { '@type': 'Person', name: r.profiles?.name || r.original_author_name || t('common.anonymous') },
                datePublished: new Date(r.created_at).toISOString().split('T')[0],
                reviewBody: r.review_text || undefined,
                reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
            }));
        }
        return datos;
    }, [business, product, reviews, canonical, t]);

    if (isLoading) {
        return <div className="flex justify-center items-center min-h-[60vh]"><Spinner /></div>;
    }

    if (noExiste || !business || !product) {
        return (
            <div className="max-w-3xl mx-auto px-4 py-16 text-center">
                <Meta title={t('businessPage.productNotFound')} description={t('businessPage.productNotFound')} noindex />
                <i className="fa-solid fa-box-open text-4xl text-gray-300 dark:text-gray-600 mb-4" aria-hidden="true"></i>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">{t('businessPage.productNotFound')}</h1>
                {business && (
                    <Link to={urlDeLaEmpresa} className="mt-4 inline-block font-semibold text-brand-green hover:underline">
                        {t('businessPage.productBackToBusiness', { name: business.name })}
                    </Link>
                )}
            </div>
        );
    }

    const nota = product.avg_rating ?? 0;
    const total = product.review_count ?? 0;

    return (
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-5 sm:py-8 space-y-5 sm:space-y-6">
            <Meta
                title={t('businessPage.productMetaTitle', { name: product.name, business: business.name })}
                description={product.description || t('businessPage.productMetaDescription', { name: product.name, business: business.name })}
                canonical={canonical}
                lang={idiomaDeLaPagina}
            />
            {schema && <Schema data={schema} id="schema-product-page" />}

            <nav className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                <Link to={urlDeLaEmpresa} className="hover:text-brand-green font-medium">{business.name}</Link>
                <span className="mx-1.5" aria-hidden="true">/</span>
                <span className="text-gray-700 dark:text-gray-300">{product.name}</span>
            </nav>

            <header className="bg-white dark:bg-zinc-800 p-4 sm:p-6 rounded-xl shadow-sm border dark:border-zinc-700">
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
                    <BusinessLogo
                        logoUrl={product.image_url}
                        businessName={product.name}
                        className="w-20 h-20 sm:w-24 sm:h-24"
                        iconSize="text-2xl sm:text-3xl"
                        fallbackIcon="fa-box-open"
                        rounded="rounded-xl"
                        fit="cover"
                        padding=""
                    />
                    <div className="min-w-0 flex-1">
                        <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100 break-words">{product.name}</h1>
                        <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                            {t('businessPage.productOfferedBy')}{' '}
                            <Link to={urlDeLaEmpresa} className="font-semibold text-brand-green hover:underline">{business.name}</Link>
                        </p>
                        {total > 0 ? (
                            <div className="mt-3 flex items-center gap-2 sm:gap-3">
                                <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">{nota.toFixed(1)}</span>
                                <StarRating rating={nota} size="small" />
                                <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                                    {total} {total === 1 ? t('common.review') : t('common.reviews')}
                                </span>
                            </div>
                        ) : (
                            <p className="mt-3 text-xs sm:text-sm text-gray-500 dark:text-gray-400 italic">{t('businessPage.productNoReviewsYet')}</p>
                        )}
                        {product.description && (
                            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300 break-words">{product.description}</p>
                        )}
                    </div>
                </div>
            </header>

            <section className="bg-white dark:bg-zinc-800 p-3 sm:p-4 md:p-6 rounded-xl shadow-sm border dark:border-zinc-700">
                <h2 className="text-base sm:text-lg md:text-xl font-bold mb-3 sm:mb-4 text-gray-800 dark:text-gray-100">
                    {t('businessPage.reviewsOfProduct', { name: product.name })}
                </h2>

                {reviews.length > 0 ? (
                    <div className="space-y-4 sm:space-y-6">
                        {reviews.map(review => (
                            <LazyRender key={review.id} placeholderHeight="250px"><ReviewCard review={review} /></LazyRender>
                        ))}
                        {hasMore && (
                            <div className="text-center pt-3 sm:pt-4">
                                <button
                                    onClick={() => setPage(p => p + 1)}
                                    disabled={isLoadingMore}
                                    className="bg-brand-dark text-white font-semibold px-5 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base rounded-md hover:bg-opacity-90 disabled:opacity-60"
                                >
                                    {isLoadingMore ? t('common.loading') : t('businessPage.loadMore')}
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">{t('businessPage.productNoReviewsYet')}</p>
                )}
            </section>
        </div>
    );
};

export default ProductPage;
