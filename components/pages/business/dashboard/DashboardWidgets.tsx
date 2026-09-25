import React, { useRef, useState, useEffect } from 'react';
import { useBusinessDashboard } from '../../../../contexts/BusinessDashboardContext';
import { ReviewSubject } from '../../../../types';
import * as ReactRouterDOM from 'react-router-dom';
import { useNotification } from '../../../../contexts/NotificationContext';
import Spinner from '../../../Spinner';
import { getWidgetScript, WidgetConfig, WIDGET_CSS } from './widgets/widgetShared';
import { getBusinessProducts } from '../../../../services/supabaseService';
import { useTranslation, useI18n } from '../../../../contexts/i18nContext';
import SectionLock from './SectionLock';

// `code` va tal cual al snippet como data-lang, y lo interpreta public/widget.js
// (no la app): tiene que ser un codigo que el widget entienda. Los de pais que
// usa la app (gb, au, sg, ie, at, cn, br) el widget los resuelve a su idioma;
// 'tw' NO: para Google es twi (Ghana). Por eso el chino tradicional es 'zh-TW'.
// Con textos propios en UI_STRINGS de widget.js: todos los de esta lista.
const WIDGET_LANGUAGES = [
    { code: 'auto', name: '', flag: '' },
    { code: 'es', name: 'Español', flag: 'https://flagcdn.com/es.svg' },
    { code: 'en', name: 'English (US)', flag: 'https://flagcdn.com/us.svg' },
    { code: 'gb', name: 'English (UK)', flag: 'https://flagcdn.com/gb.svg' },
    { code: 'au', name: 'English (AU)', flag: 'https://flagcdn.com/au.svg' },
    { code: 'sg', name: 'English (SG)', flag: 'https://flagcdn.com/sg.svg' },
    { code: 'ie', name: 'English (IE)', flag: 'https://flagcdn.com/ie.svg' },
    { code: 'fr', name: 'Français', flag: 'https://flagcdn.com/fr.svg' },
    { code: 'de', name: 'Deutsch', flag: 'https://flagcdn.com/de.svg' },
    { code: 'at', name: 'Deutsch (AT)', flag: 'https://flagcdn.com/at.svg' },
    { code: 'it', name: 'Italiano', flag: 'https://flagcdn.com/it.svg' },
    { code: 'pt', name: 'Português', flag: 'https://flagcdn.com/pt.svg' },
    { code: 'ca', name: 'Català', flag: 'https://flagcdn.com/ad.svg' },
    { code: 'zh-CN', name: '简体中文', flag: 'https://flagcdn.com/cn.svg' },
    { code: 'sv', name: 'Svenska', flag: 'https://flagcdn.com/se.svg' },
    { code: 'pl', name: 'Polski', flag: 'https://flagcdn.com/pl.svg' },
    { code: 'ja', name: '日本語', flag: 'https://flagcdn.com/jp.svg' },
    { code: 'ko', name: '한국어 (KR)', flag: 'https://flagcdn.com/kr.svg' },
    { code: 'nl', name: 'Nederlands', flag: 'https://flagcdn.com/nl.svg' },
    { code: 'ru', name: 'Русский', flag: 'https://flagcdn.com/ru.svg' },
    { code: 'ar', name: 'العربية', flag: 'https://flagcdn.com/sa.svg' },
    { code: 'tr', name: 'Türkçe', flag: 'https://flagcdn.com/tr.svg' },
    { code: 'id', name: 'Bahasa Indonesia', flag: 'https://flagcdn.com/id.svg' },
    { code: 'ms', name: 'Bahasa Melayu', flag: 'https://flagcdn.com/my.svg' },
    { code: 'zh-TW', name: '繁體中文', flag: 'https://flagcdn.com/tw.svg' },
    { code: 'th', name: 'ไทย', flag: 'https://flagcdn.com/th.svg' },
    { code: 'fa', name: 'فارسی', flag: 'https://flagcdn.com/ir.svg' },
    { code: 'vi', name: 'Tiếng Việt', flag: 'https://flagcdn.com/vn.svg' },
    { code: 'bn', name: 'বাংলা', flag: 'https://flagcdn.com/bd.svg' },
    { code: 'hi', name: 'हिन्दी', flag: 'https://flagcdn.com/in.svg' },
    { code: 'tl', name: 'Filipino', flag: 'https://flagcdn.com/ph.svg' },
];

const WidgetLanguageSelect: React.FC<{ value: string; onChange: (v: string) => void; autoLabel: string }> = ({ value, onChange, autoLabel }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const selected = WIDGET_LANGUAGES.find(l => l.code === value) || WIDGET_LANGUAGES[0];

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full flex items-center gap-2.5 p-2 sm:p-2.5 rounded-lg bg-gray-100 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-xs sm:text-sm font-medium hover:border-brand-green transition-colors"
            >
                {selected.flag ? (
                    <img src={selected.flag} alt="" className="w-5 h-3.5 rounded-[2px] object-cover ring-1 ring-black/10" loading="lazy" />
                ) : (
                    <i className="fa-solid fa-globe text-brand-green text-sm w-5 text-center"></i>
                )}
                <span className="flex-1 text-left truncate">{selected.code === 'auto' ? autoLabel : selected.name}</span>
                <i className={`fa-solid fa-chevron-down text-[10px] text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}></i>
            </button>

            {open && (
                <div className="absolute z-50 mt-1 w-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-xl max-h-64 overflow-y-auto">
                    {WIDGET_LANGUAGES.map(lang => (
                        <button
                            key={lang.code}
                            type="button"
                            onClick={() => { onChange(lang.code); setOpen(false); }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs sm:text-sm transition-colors hover:bg-gray-100 dark:hover:bg-zinc-700
                                ${value === lang.code ? 'bg-brand-green/10 text-brand-green font-semibold' : 'text-gray-700 dark:text-gray-200'}
                                ${lang.code === 'auto' ? 'border-b border-gray-100 dark:border-zinc-700' : ''}`}
                        >
                            {lang.flag ? (
                                <img src={lang.flag} alt="" className="w-5 h-3.5 rounded-[2px] object-cover ring-1 ring-black/10 flex-shrink-0" loading="lazy" />
                            ) : (
                                <i className="fa-solid fa-globe text-brand-green text-sm w-5 text-center flex-shrink-0"></i>
                            )}
                            <span className="truncate">{lang.code === 'auto' ? autoLabel : lang.name}</span>
                            {value === lang.code && <i className="fa-solid fa-check text-brand-green text-xs ml-auto"></i>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// Import all widget components and render logic
import { HorizontalCarouselPreview } from './widgets/HorizontalCarouselWidget';
import { ShowcasePreview } from './widgets/ShowcaseWidget';
import { LargeCarouselPreview } from './widgets/LargeCarouselWidget';
import { SidebarPreview } from './widgets/SidebarWidget';
import { FloatingPreview } from './widgets/FloatingWidget';
import { GridPreview } from './widgets/GridWidget';
import { BadgePreview } from './widgets/BadgeWidget';
import { WallPreview } from './widgets/WallWidget';
import { StarsCarouselPreview } from './widgets/StarsCarouselWidget';


type WidgetCardConfig = WidgetConfig & { icon: string };

const WIDGETS: WidgetCardConfig[] = [
    { name: 'stars-carousel', description: 'businessDashboard.widgetDescriptions.stars-carousel', component: StarsCarouselPreview, type: 'stars-carousel', icon: 'fa-star' },
    { name: 'horizontal-carousel', description: 'businessDashboard.widgetDescriptions.horizontal-carousel', component: HorizontalCarouselPreview, type: 'horizontal-carousel', icon: 'fa-arrows-left-right' },
    { name: 'showcase', description: 'businessDashboard.widgetDescriptions.showcase', component: ShowcasePreview, type: 'showcase', icon: 'fa-store' },
    { name: 'large-carousel', description: 'businessDashboard.widgetDescriptions.large-carousel', component: LargeCarouselPreview, type: 'large-carousel', icon: 'fa-images' },
    { name: 'wall', description: 'businessDashboard.widgetDescriptions.wall', component: WallPreview, type: 'wall', icon: 'fa-grip' },
    { name: 'grid', description: 'businessDashboard.widgetDescriptions.grid', component: GridPreview, type: 'grid', icon: 'fa-table-cells-large' },
    { name: 'sidebar', description: 'businessDashboard.widgetDescriptions.sidebar', component: SidebarPreview, type: 'sidebar', icon: 'fa-bars-staggered' },
    { name: 'floating', description: 'businessDashboard.widgetDescriptions.floating', component: FloatingPreview, type: 'floating', icon: 'fa-comment-dots' },
    { name: 'badge', description: 'businessDashboard.widgetDescriptions.badge', component: BadgePreview, type: 'badge', icon: 'fa-award' },
];

const DashboardWidgets: React.FC = () => {
    const { business } = useBusinessDashboard();
    const { showNotification } = useNotification();
    const t = useTranslation();
    const { language } = useI18n();
    const [selectedWidget, setSelectedWidget] = useState<WidgetCardConfig>(WIDGETS[0]);
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    // Buscador del selector de producto: con cientos de cursos el desplegable
    // solo no se puede usar. El producto elegido se mantiene visible aunque no
    // coincida con la busqueda.
    const [productQuery, setProductQuery] = useState('');
    const [widgetLang, setWidgetLang] = useState<string>('auto');
    // '' = la empresa entera, que es el comportamiento de siempre.
    const [selectedProductId, setSelectedProductId] = useState<string>('');
    const [products, setProducts] = useState<ReviewSubject[]>([]);
    const previewRef = useRef<HTMLDivElement>(null);
    const [searchParams] = ReactRouterDOM.useSearchParams();
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!business?.id) return;
        let cancelled = false;
        getBusinessProducts(business.id)
            .then(list => { if (!cancelled) setProducts(list.filter(p => p.is_active)); })
            // Sin productos no se pinta el selector: la pantalla queda como estaba.
            .catch(err => {
                // Si las tablas aun no estan aplicadas, esta pantalla se comporta
                // como antes de que existieran los productos: sin selector.
                const faltaLaTabla = err?.code === 'PGRST205' || err?.code === '42P01';
                if (faltaLaTabla) console.info('Productos no disponibles en esta base de datos todavía.');
                else console.error('No se pudieron cargar los productos:', err);
            });
        return () => { cancelled = true; };
    }, [business?.id]);

    // Se llega aquí desde "Ver widget" en la pantalla de Productos. Solo se
    // acepta el id si ese producto existe y está activo, para que una URL vieja
    // no deje el selector apuntando a algo que ya no está.
    useEffect(() => {
        const requested = searchParams.get('producto');
        if (requested && products.some(p => p.id === requested)) {
            setSelectedProductId(requested);
        }
    }, [searchParams, products]);

    const handleSelectWidget = (widget: WidgetCardConfig) => {
        setSelectedWidget(widget);
        previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    if (!business) {
        return <div className="flex justify-center items-center h-48 sm:h-64"><Spinner /></div>;
    }

    const selectedProduct = products.find(p => p.id === selectedProductId) || null;

    // La vista previa tiene que enseñar lo mismo que enseñará el widget: si hay
    // un producto elegido, sus cifras. Si no, un preview que dice una cosa y un
    // snippet que hace otra.
    const previewTarget = selectedProduct
        ? { ...business, avg_rating: selectedProduct.avg_rating ?? 0, average_rating: selectedProduct.avg_rating ?? 0, review_count: selectedProduct.review_count ?? 0 }
        : business;

    const previewLang = widgetLang !== 'auto' ? widgetLang : language;

    const productLabel = selectedProduct
        ? (selectedProduct.code ? `${selectedProduct.name} [${selectedProduct.code}]` : selectedProduct.name)
        : undefined;
    const codeSnippet = getWidgetScript(business.id, selectedWidget.type, theme, widgetLang !== 'auto' ? widgetLang : undefined, selectedProductId || undefined, productLabel);

    const copyCode = async () => {
        try {
            await navigator.clipboard.writeText(codeSnippet);
            setCopied(true);
            showNotification(t('businessDashboard.codeCopiedToast'), 'success');
            // La confirmación vive en el propio botón unos segundos: el aviso
            // se va solo y el usuario necesita saber que el copiado ocurrió.
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            showNotification(t('businessDashboard.codeCopyFailed'), 'error');
        }
    };

    const downloadCodeAsTxt = () => {
        try {
            const blob = new Blob([codeSnippet], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `opynio-widget-${selectedWidget.type}.txt`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            showNotification('Descarga iniciada.', 'success');
        } catch (err) {
            showNotification('No se pudo iniciar la descarga.', 'error');
            console.error('Could not initiate download: ', err);
        }
    };

    return (
        <div className="space-y-5 sm:space-y-6 md:space-y-8">
            <style>{WIDGET_CSS}</style>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-gray-800 dark:text-gray-100">{t('businessDashboard.webWidgetsTitle')}</h1>
            <SectionLock section="widgets" title={t('businessDashboard.widgetsLockFeatureName')} subtitleKey="businessDashboard.widgetsLockSubtitle">
                <div className="space-y-5 sm:space-y-6">
                    {/* Paso 1: Galería visual de tarjetas */}
                    <div>
                        <h2 className="text-base sm:text-lg font-bold mb-2.5 sm:mb-3 text-gray-800 dark:text-gray-100">{t('businessDashboard.step1ChooseWidget')}</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3">
                            {WIDGETS.map(widget => {
                                const active = selectedWidget.type === widget.type;
                                return (
                                    <button
                                        type="button"
                                        key={widget.type}
                                        onClick={() => handleSelectWidget(widget)}
                                        className={`group relative aspect-[4/3] sm:aspect-square rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2 p-2 sm:p-3 ${active
                                            ? 'border-brand-green bg-brand-green/10 shadow-md shadow-brand-green/20'
                                            : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-brand-green/40 hover:shadow-sm hover:-translate-y-0.5'}`}
                                    >
                                        {active && (
                                            <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-brand-green text-white flex items-center justify-center text-[10px]">
                                                <i className="fa-solid fa-check"></i>
                                            </span>
                                        )}
                                        {widget.type === 'stars-carousel' && (
                                            <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[9px] sm:text-[10px] font-bold leading-none border border-emerald-200 dark:border-emerald-800">
                                                {t('businessDashboard.widgetSeoFriendly')}
                                            </span>
                                        )}
                                        {widget.type === 'large-carousel' && (
                                            <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[9px] sm:text-[10px] font-bold leading-none border border-amber-200 dark:border-amber-800">
                                                {t('businessDashboard.widgetSeoNotFriendly')}
                                            </span>
                                        )}
                                        <i className={`fa-solid ${widget.icon} text-2xl sm:text-3xl ${active ? 'text-brand-green' : 'text-gray-400 dark:text-gray-500 group-hover:text-brand-green/70'}`} aria-hidden="true"></i>
                                        <span className={`text-[11px] sm:text-xs font-semibold text-center leading-tight ${active ? 'text-brand-green' : 'text-gray-700 dark:text-gray-200'}`}>
                                            {t(`businessDashboard.widgetNames.${widget.name}`)}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Alcance, tema e idioma en UNA tarjeta, y delante de la vista
                        previa. Antes eran tres paneles sueltos colocados DESPUES del
                        paso 3, asi que la pantalla se leia 1 -> 3 -> 2 -> 4. */}
                    <div className="bg-white dark:bg-zinc-800 p-3 sm:p-4 rounded-lg sm:rounded-xl shadow-sm border dark:border-zinc-700">
                        <div className={`grid grid-cols-1 gap-3 sm:gap-4 ${products.length > 0 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                            {products.length > 0 && (
                                <div>
                                    <h2 className="text-sm font-bold mb-2 text-gray-800 dark:text-gray-100">
                                        <i className="fa-solid fa-box-open mr-1.5 text-brand-green" aria-hidden="true"></i>
                                        {t('businessDashboard.widgetScopeTitle')}
                                    </h2>
                                    {products.length > 10 && (
                                        <input
                                            type="search"
                                            value={productQuery}
                                            onChange={(e) => setProductQuery(e.target.value)}
                                            placeholder={t('writeReviewPage.productSearchPlaceholder')}
                                            aria-label={t('writeReviewPage.productSearchPlaceholder')}
                                            className="w-full mb-2 min-h-[40px] text-sm rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-gray-800 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-green"
                                        />
                                    )}
                                    <select
                                        value={selectedProductId}
                                        onChange={(e) => setSelectedProductId(e.target.value)}
                                        aria-label={t('businessDashboard.widgetScopeTitle')}
                                        className="w-full min-h-[44px] text-sm rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-gray-800 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-green"
                                    >
                                        <option value="">{t('businessDashboard.widgetScopeWholeBusiness')}</option>
                                        {products.filter(product => {
                                            if (product.id === selectedProductId) return true;
                                            const normalizar = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
                                            const texto = normalizar(`${product.code || ''} ${product.name}`);
                                            return normalizar(productQuery.trim()).split(/\s+/).filter(Boolean).every(w => texto.includes(w));
                                        }).map(product => (
                                            <option key={product.id} value={product.id}>
                                                {product.code ? `[${product.code}] ` : ''}{product.name} ({(product.review_count ?? 0) > 0
                                                    ? `${(product.avg_rating ?? 0).toFixed(1)} · ${product.review_count}`
                                                    : '0'})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div>
                                <h2 className="text-sm font-bold mb-2 text-gray-800 dark:text-gray-100">{t('businessDashboard.step2ChooseTheme')}</h2>
                                <div className="flex gap-1.5 p-1 bg-gray-100 dark:bg-zinc-900 rounded-lg">
                                    <button type="button" onClick={() => setTheme('light')} className={`flex-1 min-h-[36px] py-1.5 px-2 rounded-md font-semibold text-xs sm:text-sm transition-all ${theme === 'light' ? 'bg-white dark:bg-zinc-700 shadow' : 'bg-transparent'}`}>{t('businessDashboard.lightTheme')}</button>
                                    <button type="button" onClick={() => setTheme('dark')} className={`flex-1 min-h-[36px] py-1.5 px-2 rounded-md font-semibold text-xs sm:text-sm transition-all ${theme === 'dark' ? 'bg-white dark:bg-zinc-700 shadow' : 'bg-transparent'}`}>{t('businessDashboard.darkTheme')}</button>
                                </div>
                            </div>
                            <div>
                                <h2 className="text-sm font-bold mb-2 text-gray-800 dark:text-gray-100">
                                    <i className="fa-solid fa-language mr-1.5 text-brand-green" aria-hidden="true"></i>
                                    {t('businessDashboard.widgetLanguageTitle')}
                                </h2>
                                <WidgetLanguageSelect
                                    value={widgetLang}
                                    onChange={setWidgetLang}
                                    autoLabel={t('businessDashboard.widgetLangAuto')}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Preview */}
                    <div ref={previewRef} className="bg-white dark:bg-zinc-800 p-4 sm:p-5 md:p-6 rounded-lg sm:rounded-xl shadow-sm border dark:border-zinc-700 scroll-mt-4">
                        <h2 className="text-lg sm:text-xl font-bold mb-1">{t('businessDashboard.step3Preview', { widgetName: t(`businessDashboard.widgetNames.${selectedWidget.name}`) })}</h2>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-3 sm:mb-4">{t(selectedWidget.description)}</p>
                        {/* Las vistas previas rellenan con cifras de ejemplo cuando no hay
                            datos (5.0 y 123 reseñas). Para un producto sin reseñas eso
                            contradiría al widget real, que mostrará 0: se avisa aquí mismo,
                            pegado a las cifras que no son suyas. */}
                        {selectedProduct && (selectedProduct.review_count ?? 0) === 0 && (
                            <p className="mb-3 text-xs sm:text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5 flex items-start gap-2">
                                <i className="fa-solid fa-triangle-exclamation mt-0.5" aria-hidden="true"></i>
                                <span>{t('businessDashboard.widgetScopeProductWarning')}</span>
                            </p>
                        )}
                        <div className={`p-3 sm:p-4 rounded-lg overflow-x-auto ${theme === 'dark' ? 'bg-zinc-900' : 'bg-gray-100'}`}>
                            <selectedWidget.component business={previewTarget} theme={theme} lang={previewLang} isProduct={!!selectedProduct} productName={selectedProduct?.name} />
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-800 p-3 sm:p-4 rounded-lg sm:rounded-xl shadow-sm border dark:border-zinc-700">
                        <div className="flex items-center justify-between gap-3 mb-2">
                            <h2 className="text-sm sm:text-base font-bold text-gray-800 dark:text-gray-100">
                                <i className="fa-solid fa-code mr-1.5 text-brand-green" aria-hidden="true"></i>
                                {t('businessDashboard.step4GetCode')}
                            </h2>
                            <button
                                type="button"
                                onClick={copyCode}
                                aria-label={t('businessDashboard.copyCodeButton')}
                                title={t('businessDashboard.copyCodeButton')}
                                className="flex-shrink-0 min-h-[36px] min-w-[36px] rounded-lg text-sm font-semibold text-brand-green bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 transition-[background-color,transform] duration-100 active:scale-[0.97] motion-reduce:transform-none"
                            >
                                <i className={`fa-solid ${copied ? 'fa-check' : 'fa-clipboard'}`} aria-hidden="true"></i>
                            </button>
                        </div>
                        <pre className="overflow-x-auto rounded-lg bg-gray-900 dark:bg-black/60 p-3 text-[11px] sm:text-xs leading-relaxed text-gray-100 border dark:border-zinc-700"><code>{codeSnippet}</code></pre>
                        {/* Copiar y descargar viven aqui, pegados al codigo: eran un
                            panel aparte llamado "Paso 4" a tres tarjetas de distancia. */}
                        <div className="mt-3 flex flex-col sm:flex-row gap-2">
                            <button type="button" onClick={copyCode} className={`flex-1 min-h-[44px] font-semibold py-2 px-3 rounded-lg transition-[background-color,transform] duration-100 active:scale-[0.98] motion-reduce:transform-none flex items-center justify-center gap-2 text-xs sm:text-sm ${
                                copied
                                    ? 'bg-green-100 dark:bg-green-900/40 text-brand-green'
                                    : 'bg-brand-green text-white hover:bg-opacity-90 shadow-sm shadow-brand-green/30'
                            }`}>
                                <i className={`fa-solid ${copied ? 'fa-check' : 'fa-clipboard'}`} aria-hidden="true"></i>
                                <span>{copied ? t('businessDashboard.codeCopiedToast') : t('businessDashboard.copyCodeButton')}</span>
                            </button>
                            <button type="button" onClick={downloadCodeAsTxt} className="flex-1 min-h-[44px] bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600 text-gray-800 dark:text-gray-100 font-semibold py-2 px-3 rounded-lg transition-[background-color,transform] duration-100 active:scale-[0.98] motion-reduce:transform-none flex items-center justify-center gap-2 text-xs sm:text-sm">
                                <i className="fa-solid fa-download" aria-hidden="true"></i>
                                <span>{t('businessDashboard.downloadCodeButton')}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </SectionLock>
        </div>
    );
};

export default DashboardWidgets;
