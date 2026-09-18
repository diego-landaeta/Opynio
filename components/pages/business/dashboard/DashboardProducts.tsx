import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useBusinessDashboard } from '../../../../contexts/BusinessDashboardContext';
import { useAuth } from '../../../../contexts/AuthContext';
import { Plan, ReviewSubject } from '../../../../types';
import * as ReactRouterDOM from 'react-router-dom';
import { useNotification } from '../../../../contexts/NotificationContext';
import { useConfirm } from '../../../../contexts/ConfirmContext';
import {
    getBusinessProducts,
    getUnassignedReviewCount,
    createBusinessProduct,
    updateBusinessProduct,
    deleteBusinessProduct,
} from '../../../../services/supabaseService';
import Spinner from '../../../Spinner';
import Modal from '../../../Modal';
import StarRating from '../../../StarRating';
import BusinessLogo from '../../../BusinessLogo';
import { useTranslation, pathTranslations } from '../../../../contexts/i18nContext';

// Espejo de enforce_product_limit() en la migracion. Si cambian los numeros
// alli, cambiarlos aqui: si no, la interfaz promete algo que la BD rechaza.
const PLAN_PRODUCT_LIMITS: Record<Plan, number> = {
    free: 0,
    starter: 10,
    growth: 30,
    pro: 100,
    v2: Infinity,
    enterprise: Infinity,
};

const PLAN_HIERARCHY: Record<Plan, number> = {
    free: 0,
    starter: 1,
    growth: 2,
    pro: 3,
    v2: 4,
    enterprise: 4,
};

const FeatureLock: React.FC<{ requiredPlan: Plan, featureName: string, children: React.ReactNode }> = ({ requiredPlan, featureName, children }) => {
    const { profile } = useAuth();
    const t = useTranslation();

    if (!profile) {
        return null;
    }

    if (PLAN_HIERARCHY[profile.plan] >= PLAN_HIERARCHY[requiredPlan]) {
        return <>{children}</>;
    }

    return (
        <div className="text-center p-6 sm:p-8 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border-2 border-dashed dark:border-zinc-700">
            <div className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-300 rounded-full w-14 h-14 sm:w-16 sm:h-16 inline-flex items-center justify-center shadow-sm border-4 border-white dark:border-zinc-800 mb-3 sm:mb-4">
                <i className="fa-solid fa-lock text-2xl sm:text-3xl"></i>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100">{featureName}</h2>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-2 max-w-md mx-auto">
                {t('businessDashboard.productsLockSubtitle')}
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

// Misma tarjeta de métrica que usa el Resumen del panel, para que las dos
// pantallas se lean como la misma aplicación.
const StatCard: React.FC<{ title: string; value: string | number; icon: string }> = ({ title, value, icon }) => (
    <div className="bg-white dark:bg-zinc-800 px-4 py-3 rounded-lg shadow-sm flex items-center justify-between border dark:border-zinc-700">
        <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{title}</p>
            <p className="text-xl sm:text-2xl font-bold tracking-tight text-gray-800 dark:text-gray-100">{value}</p>
        </div>
        <i className={`fa-solid ${icon} text-xl sm:text-2xl text-gray-300 dark:text-zinc-600 flex-shrink-0 ml-3`} aria-hidden="true"></i>
    </div>
);

// Búsqueda insensible a mayúsculas y a acentos: "cafe" tiene que encontrar
// "Café", o el filtro es inútil en español.
const normalize = (text: string) =>
    text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// A partir de este número de productos el listado deja de recorrerse a ojo.
const SEARCH_THRESHOLD = 10;

type FormState = { name: string; code: string; description: string; image_url: string };
const EMPTY_FORM: FormState = { name: '', code: '', description: '', image_url: '' };

const ProductFormModal: React.FC<{
    product: ReviewSubject | null;
    onClose: () => void;
    onSave: (fields: FormState) => Promise<void>;
}> = ({ product, onClose, onSave }) => {
    const t = useTranslation();
    const [form, setForm] = useState<FormState>(product
        ? { name: product.name, code: product.code || '', description: product.description || '', image_url: product.image_url || '' }
        : EMPTY_FORM);
    const [nameError, setNameError] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) {
            // El error se queda hasta que el usuario lo arregla, no se
            // autodestruye mientras lo está leyendo.
            setNameError(t('businessDashboard.productNameRequired'));
            return;
        }
        setNameError('');
        setIsSaving(true);
        try {
            await onSave(form);
        } finally {
            setIsSaving(false);
        }
    };

    const inputClass = "w-full p-2.5 border border-gray-300 dark:border-zinc-600 rounded-lg bg-transparent text-sm sm:text-base text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-green";

    return (
        <Modal title={product ? t('businessDashboard.editProductTitle') : t('businessDashboard.createProductTitle')} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4 mt-4 sm:mt-5 text-left">
                <div>
                    <label htmlFor="product-name" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('businessDashboard.productNameLabel')}
                    </label>
                    <input
                        id="product-name"
                        type="text"
                        maxLength={120}
                        value={form.name}
                        onChange={e => { setForm({ ...form, name: e.target.value }); if (nameError) setNameError(''); }}
                        placeholder={t('businessDashboard.productNamePlaceholder')}
                        className={`${inputClass} ${nameError ? 'border-red-500 dark:border-red-500' : ''}`}
                        aria-invalid={!!nameError}
                        aria-describedby={nameError ? 'product-name-error' : undefined}
                        autoFocus
                    />
                    {nameError && (
                        <p id="product-name-error" className="mt-1 text-xs sm:text-sm text-red-600 dark:text-red-400 flex items-center gap-1.5">
                            <i className="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
                            <span>{nameError}</span>
                        </p>
                    )}
                </div>
                <div>
                    <label htmlFor="product-code" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('businessDashboard.productCodeLabel')}
                    </label>
                    <input
                        id="product-code"
                        type="text"
                        maxLength={40}
                        value={form.code}
                        onChange={e => setForm({ ...form, code: e.target.value })}
                        placeholder={t('businessDashboard.productCodePlaceholder')}
                        aria-describedby="product-code-help"
                        className={`${inputClass} font-mono`}
                    />
                    <p id="product-code-help" className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {t('businessDashboard.productCodeHelp')}
                    </p>
                </div>
                <div>
                    <label htmlFor="product-description" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('businessDashboard.productDescriptionLabel')}
                    </label>
                    <textarea
                        id="product-description"
                        rows={3}
                        maxLength={500}
                        value={form.description}
                        onChange={e => setForm({ ...form, description: e.target.value })}
                        placeholder={t('businessDashboard.productDescriptionPlaceholder')}
                        className={inputClass}
                    />
                </div>
                <div>
                    <label htmlFor="product-image" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('businessDashboard.productImageUrlLabel')}
                    </label>
                    <div className="flex items-center gap-3">
                        {/* La miniatura confirma que la URL pegada carga de verdad,
                            en vez de descubrirlo al guardar. */}
                        <BusinessLogo
                            logoUrl={form.image_url.trim() || null}
                            businessName={form.name || '?'}
                            className="w-12 h-12"
                            iconSize="text-base"
                            fallbackIcon="fa-box-open"
                            rounded="rounded-lg"
                            fit="cover"
                            padding=""
                        />
                        <input
                            id="product-image"
                            type="url"
                            value={form.image_url}
                            onChange={e => setForm({ ...form, image_url: e.target.value })}
                            placeholder={t('businessDashboard.productImageUrlPlaceholder')}
                            className={inputClass}
                        />
                    </div>
                </div>
                <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-1">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 min-h-[44px] px-4 py-2.5 rounded-lg font-semibold text-sm sm:text-base text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600 transition-colors"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="flex-1 min-h-[44px] px-4 py-2.5 rounded-lg font-bold text-sm sm:text-base bg-brand-green text-white hover:bg-opacity-90 transition-colors shadow-sm disabled:bg-gray-400 flex items-center justify-center gap-2"
                    >
                        {isSaving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true"></div>}
                        <span>{isSaving ? t('common.saving') : t('common.save')}</span>
                    </button>
                </div>
            </form>
        </Modal>
    );
};

const ProductCard: React.FC<{
    product: ReviewSubject;
    widgetHref: string;
    reviewsHref: string;
    index: number;
    onEdit: () => void;
    onToggle: () => void;
    onDelete: () => void;
    isBusy: boolean;
}> = ({ product, widgetHref, reviewsHref, index, onEdit, onToggle, onDelete, isBusy }) => {
    const t = useTranslation();
    const reviewCount = product.review_count ?? 0;
    const rating = product.avg_rating ?? 0;
    const iconButton = "min-h-[44px] min-w-[44px] sm:min-h-[38px] sm:min-w-[38px] inline-flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700 hover:text-gray-800 dark:hover:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-green transition-[background-color,color,transform] duration-100 active:scale-90 motion-reduce:transform-none disabled:opacity-50";

    return (
        <li className={product.is_active ? '' : 'bg-gray-50 dark:bg-zinc-900/50'}>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 sm:px-4 py-2.5">
                {/* Identidad: nombre, referencia y —solo si esta retirado— su marca. */}
                <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                        {product.image_url && (
                            <span className={product.is_active ? 'flex-shrink-0' : 'flex-shrink-0 grayscale opacity-60'}>
                                <BusinessLogo
                                    logoUrl={product.image_url}
                                    businessName={product.name}
                                    className="w-7 h-7"
                                    iconSize="text-xs"
                                    fallbackIcon="fa-box-open"
                                    rounded="rounded"
                                    fit="cover"
                                    padding=""
                                />
                            </span>
                        )}
                        <h3 title={product.name} className="font-semibold text-sm text-gray-800 dark:text-gray-100 truncate">{product.name}</h3>
                        {product.code && (
                            <span className="flex-shrink-0 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-zinc-700 text-gray-500 dark:text-gray-400 text-[10px] font-mono" title={t('businessDashboard.productCodeLabel')}>
                                {product.code}
                            </span>
                        )}
                        {/* Solo la excepcion lleva marca; el estado normal no se etiqueta. */}
                        {!product.is_active && (
                            <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-gray-300">
                                <i className="fa-solid fa-circle-pause" aria-hidden="true"></i>
                                {t('businessDashboard.productStatusInactive')}
                            </span>
                        )}
                    </div>
                    {product.description && (
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate" title={product.description}>{product.description}</p>
                    )}
                </div>

                {/* La nota, en columna propia para que se puedan comparar de un vistazo. */}
                <div className="flex items-center gap-2 flex-shrink-0 sm:w-44">
                    {reviewCount > 0 ? (
                        <>
                            <span className="text-base font-bold tabular-nums text-gray-800 dark:text-gray-100">{rating.toFixed(1)}</span>
                            <StarRating rating={rating} size="small" />
                            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{reviewCount}</span>
                        </>
                    ) : (
                        // Un cero no es solo un dato: es la accion que falta.
                        <ReactRouterDOM.Link to={reviewsHref} className="min-h-[44px] sm:min-h-0 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-green hover:underline focus:outline-none focus:ring-2 focus:ring-brand-green rounded">
                            <i className="fa-regular fa-comment-dots" aria-hidden="true"></i>
                            {t('businessDashboard.assignReviewsAction')}
                        </ReactRouterDOM.Link>
                    )}
                </div>

                <div className="ml-auto flex items-center gap-0.5 flex-shrink-0">
                    <ReactRouterDOM.Link
                        to={`${widgetHref}?producto=${product.id}`}
                        className="min-h-[44px] sm:min-h-[36px] inline-flex items-center gap-1.5 px-2 rounded-lg text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-brand-green hover:bg-gray-100 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand-green transition-[background-color,color] duration-100"
                    >
                        <i className="fa-solid fa-puzzle-piece" aria-hidden="true"></i>
                        <span className="hidden md:inline">{t('businessDashboard.viewWidgetAction')}</span>
                    </ReactRouterDOM.Link>
                    <button type="button" onClick={onEdit} disabled={isBusy} className={iconButton}
                        aria-label={`${t('common.edit')}: ${product.name}`} title={t('common.edit')}>
                        <i className="fa-solid fa-pen" aria-hidden="true"></i>
                    </button>
                    <button type="button" onClick={onToggle} disabled={isBusy} className={iconButton}
                        aria-label={`${product.is_active ? t('businessDashboard.deactivateProductAction') : t('businessDashboard.activateProductAction')}: ${product.name}`}
                        title={product.is_active ? t('businessDashboard.deactivateProductAction') : t('businessDashboard.activateProductAction')}>
                        <i className={`fa-solid ${product.is_active ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true"></i>
                    </button>
                    <button type="button" onClick={onDelete} disabled={isBusy}
                        className={`${iconButton} hover:text-red-600 dark:hover:text-red-400`}
                        aria-label={`${t('common.delete')}: ${product.name}`} title={t('common.delete')}>
                        <i className="fa-solid fa-trash" aria-hidden="true"></i>
                    </button>
                </div>
            </div>
        </li>
    );
};

const DashboardProducts: React.FC = () => {
    const { business } = useBusinessDashboard();
    const { profile } = useAuth();
    const { showNotification } = useNotification();
    const { confirm } = useConfirm();
    const t = useTranslation();

    // La pestaña de widgets es hermana de esta en la URL. Se calcula sustituyendo
    // el último segmento en vez de con un enlace relativo: así da igual cómo estén
    // anidadas las rutas y en qué idioma venga el slug de la URL actual.
    const { pathname } = ReactRouterDOM.useLocation();
    const widgetHref = pathname.replace(/\/[^/]*$/, `/${pathTranslations.es.dashboardWidgets}`);
    const reviewsHref = pathname.replace(/\/[^/]*$/, `/${pathTranslations.es.dashboardReviews}`);

    const [products, setProducts] = useState<ReviewSubject[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    // null | 'generic' (fallo pasajero) | 'not-installed' (faltan las tablas)
    const [loadError, setLoadError] = useState<null | 'generic' | 'not-installed'>(null);
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState<{ product: ReviewSubject | null } | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    // Reseñas de la empresa que no están asignadas a ningún producto.
    const [sinAsignar, setSinAsignar] = useState(0);

    const load = useCallback(async () => {
        if (!business?.id) return;
        setIsLoading(true);
        setLoadError(null);
        try {
            setProducts(await getBusinessProducts(business.id));
        } catch (error: any) {
            console.error('Error cargando productos:', error);
            // PGRST205: PostgREST no encuentra la tabla. 42P01: Postgres dice que
            // no existe. Significa que la migracion no se ha aplicado en esta base
            // de datos, y entonces reintentar no puede funcionar nunca.
            const faltaLaTabla = error?.code === 'PGRST205' || error?.code === '42P01'
                || /review_subjects/.test(error?.message || '');
            setLoadError(faltaLaTabla ? 'not-installed' : 'generic');
        } finally {
            setIsLoading(false);
        }
    }, [business?.id]);

    useEffect(() => { load(); }, [load]);

    // Las reseñas nuevas (Google, scraping) entran sin producto y nadie se
    // entera: este número es lo que evita que los widgets se queden atrás.
    useEffect(() => {
        if (!business?.id) return;
        let cancelado = false;
        getUnassignedReviewCount(business.id)
            .then(n => { if (!cancelado) setSinAsignar(n); })
            .catch(() => { /* sin tablas o sin permiso: simplemente no se avisa */ });
        return () => { cancelado = true; };
    }, [business?.id, products.length]);

    const filtered = useMemo(() => {
        const term = normalize(search.trim());
        if (!term) return products;
        return products.filter(p =>
            normalize(p.name).includes(term)
            || normalize(p.code || '').includes(term)
            || normalize(p.description || '').includes(term)
        );
    }, [products, search]);

    // La media global es ponderada por número de reseñas: promediar las medias
    // daría el mismo peso a un producto con 1 reseña que a otro con 200.
    const stats = useMemo(() => {
        const assigned = products.reduce((sum, p) => sum + (p.review_count ?? 0), 0);
        const weighted = products.reduce((sum, p) => sum + (p.avg_rating ?? 0) * (p.review_count ?? 0), 0);
        return {
            active: products.filter(p => p.is_active).length,
            assigned,
            average: assigned > 0 ? (weighted / assigned).toFixed(1) : '—',
        };
    }, [products]);

    const handleSave = async (fields: FormState) => {
        const target = editing?.product;
        try {
            if (target) {
                const updated = await updateBusinessProduct(target.id, {
                    name: fields.name.trim(),
                    code: fields.code.trim() || null,
                    description: fields.description.trim() || null,
                    image_url: fields.image_url.trim() || null,
                });
                // Conserva las cifras que ya teníamos: el update no las devuelve.
                setProducts(prev => prev.map(p => p.id === target.id
                    ? { ...updated, review_count: p.review_count, avg_rating: p.avg_rating }
                    : p));
                showNotification(t('businessDashboard.productUpdatedToast'), 'success');
            } else {
                const created = await createBusinessProduct(business.id, {
                    name: fields.name,
                    code: fields.code,
                    description: fields.description,
                    image_url: fields.image_url,
                });
                setProducts(prev => [{ ...created, review_count: 0, avg_rating: 0 }, ...prev]);
                showNotification(t('businessDashboard.productCreatedToast'), 'success');
            }
            setEditing(null);
        } catch (error: any) {
            console.error('Error guardando producto:', error);
            // El codigo ya lo usa otro producto de esta empresa: es un dato que
            // acaba de escribir el usuario, asi que se le dice exactamente eso.
            const mensaje = error?.code === 'DUPLICATE_PRODUCT_CODE'
                ? t('businessDashboard.productCodeDuplicate')
                : /PRODUCT_LIMIT_REACHED/.test(error?.message || '')
                    ? t('businessDashboard.productLimitReached', { limit: limiteDeProductos })
                    : (error.message || t('common.error'));
            showNotification(mensaje, 'error');
        }
    };

    const handleToggle = async (product: ReviewSubject) => {
        // Desactivar tiene un efecto fuera de Opynio: si ese widget está pegado
        // en su web, pasa a mostrar las reseñas de toda la empresa. Activar no
        // rompe nada, así que no se pregunta.
        if (product.is_active) {
            const confirmado = await confirm({
                title: t('businessDashboard.deactivateProductAction'),
                message: t('businessDashboard.deactivateProductWarning', { name: product.name }),
                confirmText: t('businessDashboard.deactivateProductAction'),
                cancelText: t('common.cancel'),
            });
            if (!confirmado) return;
        }

        setBusyId(product.id);
        try {
            const updated = await updateBusinessProduct(product.id, { is_active: !product.is_active });
            setProducts(prev => prev.map(p => p.id === product.id
                ? { ...updated, review_count: p.review_count, avg_rating: p.avg_rating }
                : p));
        } catch (error: any) {
            console.error('Error cambiando el estado del producto:', error);
            showNotification(error.message || t('common.error'), 'error');
        } finally {
            setBusyId(null);
        }
    };

    const handleDelete = async (product: ReviewSubject) => {
        const confirmed = await confirm({
            title: t('businessDashboard.deleteProductTitle'),
            message: (
                <span className="block space-y-2 text-left">
                    <span className="block">{t('businessDashboard.deleteProductWarning', { name: product.name })}</span>
                    {/* Lo que mas asusta al borrar es perder resenas: se dice explicitamente que no pasa. */}
                    <span className="block text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        {t('businessDashboard.deleteProductReviewsSafe')}
                    </span>
                </span>
            ),
            confirmText: t('common.delete'),
            cancelText: t('common.cancel'),
            danger: true,
        });
        if (!confirmed) return;

        setBusyId(product.id);
        try {
            await deleteBusinessProduct(product.id);
            setProducts(prev => prev.filter(p => p.id !== product.id));
            showNotification(t('businessDashboard.productDeletedToast'), 'success');
        } catch (error: any) {
            console.error('Error borrando producto:', error);
            showNotification(error.message || t('common.error'), 'error');
        } finally {
            setBusyId(null);
        }
    };

    if (!business) {
        return <div className="flex justify-center items-center h-48 sm:h-64"><Spinner /></div>;
    }

    // El boton de la cabecera queda fuera del FeatureLock, asi que el plan hay
    // que comprobarlo tambien aqui: si no, un plan sin acceso ve el boton y abre
    // el formulario.
    const tieneAcceso = !!profile && PLAN_HIERARCHY[profile.plan] >= PLAN_HIERARCHY['starter'];
    const limiteDeProductos = profile ? PLAN_PRODUCT_LIMITS[profile.plan] : 0;
    const limiteAlcanzado = products.length >= limiteDeProductos;
    const hasProducts = tieneAcceso && products.length > 0 && !isLoading && !loadError;

    const newProductButton = (
        <button
            type="button"
            disabled={limiteAlcanzado}
            title={limiteAlcanzado ? t('businessDashboard.productLimitReached', { limit: limiteDeProductos }) : undefined}
            onClick={() => setEditing({ product: null })}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 bg-brand-green text-white font-bold px-4 sm:px-5 py-2.5 rounded-lg hover:bg-opacity-90 transition-colors shadow-sm text-sm sm:text-base"
        >
            <i className="fa-solid fa-plus" aria-hidden="true"></i>
            <span>{t('businessDashboard.newProductButton')}</span>
        </button>
    );

    const renderBody = () => {
        if (isLoading) {
            return (
                <div className="bg-white dark:bg-zinc-800 rounded-xl border dark:border-zinc-700 divide-y dark:divide-zinc-700 overflow-hidden" aria-busy="true" aria-live="polite">
                    {[0, 1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="h-[58px] animate-pulse"></div>
                    ))}
                </div>
            );
        }

        if (loadError === 'not-installed') {
            // Sin tablas no hay nada que reintentar: se explica que pasa y ya.
            return (
                <div className="text-center py-10 sm:py-14 px-4 bg-white dark:bg-zinc-800 rounded-lg border dark:border-zinc-700">
                    <i className="fa-solid fa-screwdriver-wrench text-3xl sm:text-4xl text-amber-500 mb-3" aria-hidden="true"></i>
                    <p className="font-semibold text-sm sm:text-base text-gray-800 dark:text-gray-100">{t('businessDashboard.productsNotInstalledTitle')}</p>
                    {/* Al admin de Opynio no le sirve "escríbenos": el que lo
                        habilita es él. Se le da la causa técnica directamente. */}
                    {profile?.role === 'admin' ? (
                        <p className="mt-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400 max-w-lg mx-auto">
                            Falta aplicar las migraciones en esta base de datos:{' '}
                            <code className="font-mono text-[11px] bg-gray-100 dark:bg-zinc-700 px-1.5 py-0.5 rounded">20260917120000_review_subjects.sql</code>
                            {' '}y{' '}
                            <code className="font-mono text-[11px] bg-gray-100 dark:bg-zinc-700 px-1.5 py-0.5 rounded">20260917121000_widget_subject_rpcs.sql</code>.
                        </p>
                    ) : (
                        <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">{t('businessDashboard.productsNotInstalledSubtitle')}</p>
                    )}
                </div>
            );
        }

        if (loadError) {
            return (
                <div className="text-center py-10 sm:py-14 px-4 bg-white dark:bg-zinc-800 rounded-lg border dark:border-zinc-700">
                    <i className="fa-solid fa-triangle-exclamation text-3xl sm:text-4xl text-red-500 mb-3" aria-hidden="true"></i>
                    <p className="font-semibold text-sm sm:text-base text-gray-800 dark:text-gray-100">{t('businessDashboard.productsLoadError')}</p>
                    <button
                        type="button"
                        onClick={load}
                        className="mt-4 min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm sm:text-base bg-gray-100 dark:bg-zinc-700 text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-zinc-600 transition-colors"
                    >
                        <i className="fa-solid fa-rotate-right" aria-hidden="true"></i>
                        <span>{t('businessDashboard.retryButton')}</span>
                    </button>
                </div>
            );
        }

        if (products.length === 0) {
            return (
                <div className="text-center py-8 sm:py-12 px-4 bg-white dark:bg-zinc-800 rounded-xl border-2 border-dashed dark:border-zinc-700">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/40 text-brand-green flex items-center justify-center">
                        <i className="fa-solid fa-box-open text-2xl sm:text-3xl" aria-hidden="true"></i>
                    </div>
                    <p className="font-bold text-base sm:text-lg text-gray-800 dark:text-gray-100">{t('businessDashboard.productsEmptyTitle')}</p>
                    <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">{t('businessDashboard.productsEmptySubtitle')}</p>

                    {/* El recorrido completo, para que se entienda para qué sirve un
                        producto antes de crear el primero. */}
                    <ol className="mt-6 mb-6 flex flex-col sm:flex-row items-stretch justify-center gap-3 sm:gap-2 max-w-2xl mx-auto text-left">
                        {[
                            t('businessDashboard.productsEmptyStep1'),
                            t('businessDashboard.productsEmptyStep2'),
                            t('businessDashboard.productsEmptyStep3'),
                        ].map((step, index) => (
                            <li key={index} className="flex-1 flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-zinc-900/50 border dark:border-zinc-700">
                                <span className="w-8 h-8 flex-shrink-0 rounded-full bg-white dark:bg-zinc-800 border dark:border-zinc-600 text-brand-green font-bold text-sm flex items-center justify-center">
                                    {index + 1}
                                </span>
                                <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">{step}</span>
                            </li>
                        ))}
                    </ol>

                    {newProductButton}
                </div>
            );
        }

        if (filtered.length === 0) {
            return (
                <div className="text-center py-10 sm:py-14 px-4 bg-white dark:bg-zinc-800 rounded-lg border dark:border-zinc-700">
                    <i className="fa-solid fa-magnifying-glass text-3xl sm:text-4xl text-gray-400 dark:text-gray-500 mb-3" aria-hidden="true"></i>
                    <p className="font-semibold text-sm sm:text-base text-gray-800 dark:text-gray-100">{t('businessDashboard.noProductsMatchSearch')}</p>
                    <button
                        type="button"
                        onClick={() => setSearch('')}
                        className="mt-4 min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm sm:text-base bg-gray-100 dark:bg-zinc-700 text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-zinc-600 transition-colors"
                    >
                        <i className="fa-solid fa-xmark" aria-hidden="true"></i>
                        <span>{t('businessDashboard.clearSearchButton')}</span>
                    </button>
                </div>
            );
        }

        return (
            <ul className="bg-white dark:bg-zinc-800 rounded-xl border dark:border-zinc-700 shadow-sm divide-y dark:divide-zinc-700 overflow-hidden">
                {filtered.map((product, index) => (
                    <ProductCard
                        key={product.id}
                        index={index}
                        product={product}
                        widgetHref={widgetHref}
                        reviewsHref={reviewsHref}
                        isBusy={busyId === product.id}
                        onEdit={() => setEditing({ product })}
                        onToggle={() => handleToggle(product)}
                        onDelete={() => handleDelete(product)}
                    />
                ))}
            </ul>
        );
    };

    return (
        <>
        <div className="space-y-5 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-gray-800 dark:text-gray-100">
                        {t('businessDashboard.dashboardProducts')}
                    </h1>
                    <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-400 max-w-2xl">
                        {!hasProducts && t('businessDashboard.productsSubtitle')}
                        {hasProducts && (
                            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                                {/* Las cifras, en una linea de texto. Antes eran tres
                                    tarjetas: un bloque entero para tres numeros que
                                    solo dan contexto, delante de lo que se viene a ver. */}
                                <span className="font-semibold text-gray-700 dark:text-gray-300">
                                    {t('businessDashboard.productsCountOfLimit', { count: products.length, limit: limiteDeProductos })}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>{stats.assigned} {t('businessDashboard.productsStatAssigned').toLowerCase()}</span>
                                {stats.average !== '—' && (
                                    <>
                                        <span aria-hidden="true">·</span>
                                        <span>{t('businessDashboard.productsStatAverage')} {stats.average}</span>
                                    </>
                                )}
                            </span>
                        )}
                        {!hasProducts && tieneAcceso && Number.isFinite(limiteDeProductos) && (
                            <span className="ml-1 font-semibold text-gray-700 dark:text-gray-300">
                                {t('businessDashboard.productsCountOfLimit', { count: products.length, limit: limiteDeProductos })}
                            </span>
                        )}
                    </p>
                </div>
                {hasProducts && <div className="flex-shrink-0">{newProductButton}</div>}
            </div>

            <FeatureLock requiredPlan="starter" featureName={t('businessDashboard.productsLockFeatureName')}>
                <div className="space-y-4 sm:space-y-5">
                    {hasProducts && limiteAlcanzado && (
                        <p className="p-3 rounded-lg bg-gray-100 dark:bg-zinc-800 border dark:border-zinc-700 text-xs sm:text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                            <i className="fa-solid fa-circle-info mt-0.5 text-gray-400" aria-hidden="true"></i>
                            <span>{t('businessDashboard.productLimitReached', { limit: limiteDeProductos })}</span>
                        </p>
                    )}

                    {hasProducts && sinAsignar > 0 && (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                            <p className="flex-1 text-xs sm:text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
                                <i className="fa-solid fa-inbox mt-0.5 flex-shrink-0" aria-hidden="true"></i>
                                <span>{t('businessDashboard.unassignedReviewsNotice', { count: sinAsignar })}</span>
                            </p>
                            <ReactRouterDOM.Link
                                to={reviewsHref}
                                className="flex-shrink-0 min-h-[36px] inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100 hover:bg-amber-200 dark:hover:bg-amber-900/60 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors"
                            >
                                {t('businessDashboard.assignReviewsAction')}
                            </ReactRouterDOM.Link>
                        </div>
                    )}

                    {products.length > SEARCH_THRESHOLD && (
                        <div className="relative">
                            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true"></i>
                            <input
                                type="search"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder={t('businessDashboard.searchProductsPlaceholder')}
                                aria-label={t('businessDashboard.searchProductsPlaceholder')}
                                className="w-full min-h-[44px] pl-9 pr-3 py-2.5 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-sm sm:text-base text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-green"
                            />
                        </div>
                    )}
                    {renderBody()}
                </div>
            </FeatureLock>

        </div>

        {/* Fuera del contenedor con space-y-*: esa utilidad aplica margin-top a
            los hijos siguientes, y sobre un overlay fixed inset-0 lo desplaza
            hacia abajo dejando una franja sin oscurecer en la parte superior. */}
        {editing && (
            <ProductFormModal
                product={editing.product}
                onClose={() => setEditing(null)}
                onSave={handleSave}
            />
        )}
        </>
    );
};

export default DashboardProducts;
