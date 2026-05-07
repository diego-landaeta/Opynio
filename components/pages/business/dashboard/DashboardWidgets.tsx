import React, { useRef, useState } from 'react';
import { useBusinessDashboard } from '../../../../contexts/BusinessDashboardContext';
import { useAuth } from '../../../../contexts/AuthContext';
import { Plan } from '../../../../types';
import * as ReactRouterDOM from 'react-router-dom';
import { useNotification } from '../../../../contexts/NotificationContext';
import Spinner from '../../../Spinner';
// FIX: WIDGET_CSS is now correctly exported from the shared file and imported here.
import { getWidgetScript, WidgetConfig, WIDGET_CSS } from './widgets/widgetShared';
import { useTranslation, useI18n, pathTranslations } from '../../../../contexts/i18nContext';

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

const PLAN_HIERARCHY: Record<Plan, number> = {
    free: 0,
    starter: 1,
    growth: 2,
    pro: 3,
    v2: 4,
    enterprise: 4,
};

type WidgetCardConfig = WidgetConfig & { icon: string };

const WIDGETS: WidgetCardConfig[] = [
    { name: 'horizontal-carousel', description: 'businessDashboard.widgetDescriptions.horizontal-carousel', component: HorizontalCarouselPreview, type: 'horizontal-carousel', icon: 'fa-star' },
    { name: 'stars-carousel', description: 'businessDashboard.widgetDescriptions.stars-carousel', component: StarsCarouselPreview, type: 'stars-carousel', icon: 'fa-arrows-left-right' },
    { name: 'showcase', description: 'businessDashboard.widgetDescriptions.showcase', component: ShowcasePreview, type: 'showcase', icon: 'fa-store' },
    { name: 'large-carousel', description: 'businessDashboard.widgetDescriptions.large-carousel', component: LargeCarouselPreview, type: 'large-carousel', icon: 'fa-images' },
    { name: 'wall', description: 'businessDashboard.widgetDescriptions.wall', component: WallPreview, type: 'wall', icon: 'fa-grip' },
    { name: 'grid', description: 'businessDashboard.widgetDescriptions.grid', component: GridPreview, type: 'grid', icon: 'fa-table-cells-large' },
    { name: 'sidebar', description: 'businessDashboard.widgetDescriptions.sidebar', component: SidebarPreview, type: 'sidebar', icon: 'fa-bars-staggered' },
    { name: 'floating', description: 'businessDashboard.widgetDescriptions.floating', component: FloatingPreview, type: 'floating', icon: 'fa-comment-dots' },
    { name: 'badge', description: 'businessDashboard.widgetDescriptions.badge', component: BadgePreview, type: 'badge', icon: 'fa-award' },
];

const FeatureLock: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { profile } = useAuth();
    const { language } = useI18n();
    const t = useTranslation();
    if (!profile) return null;
    const currentPlanLevel = PLAN_HIERARCHY[profile.plan];
    const requiredPlanLevel = PLAN_HIERARCHY['starter'];
    if (currentPlanLevel >= requiredPlanLevel) {
        return <>{children}</>;
    }
    return (
        <div className="text-center p-6 sm:p-8 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border-2 border-dashed dark:border-zinc-700">
            <div className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-300 rounded-full w-14 h-14 sm:w-16 sm:h-16 inline-flex items-center justify-center shadow-sm border-4 border-white dark:border-zinc-800 mb-3 sm:mb-4"><i className="fa-solid fa-lock text-2xl sm:text-3xl"></i></div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100">{t('businessDashboard.widgetsLockFeatureName')}</h2>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-2 max-w-md mx-auto">{t('businessDashboard.widgetsLockSubtitle')}</p>
            <ReactRouterDOM.Link to={`/${pathTranslations[language].pricing}`} className="mt-4 sm:mt-6 inline-block bg-brand-green text-white font-bold px-6 sm:px-8 py-2.5 sm:py-3 rounded-md hover:bg-opacity-90 transition-all shadow-lg shadow-brand-green/30 text-base sm:text-lg">{t('businessDashboard.upgradePlanButton')}</ReactRouterDOM.Link>
        </div>
    );
};

const DashboardWidgets: React.FC = () => {
    const { business } = useBusinessDashboard();
    const { showNotification } = useNotification();
    const t = useTranslation();
    const { language } = useI18n();
    const [selectedWidget, setSelectedWidget] = useState<WidgetCardConfig>(WIDGETS[0]);
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [widgetLang, setWidgetLang] = useState<string>('auto');
    const previewRef = useRef<HTMLDivElement>(null);

    const handleSelectWidget = (widget: WidgetCardConfig) => {
        setSelectedWidget(widget);
        previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    if (!business) {
        return <div className="flex justify-center items-center h-48 sm:h-64"><Spinner /></div>;
    }

    const codeSnippet = getWidgetScript(business.id, selectedWidget.type, theme, widgetLang !== 'auto' ? widgetLang : undefined);

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
            <FeatureLock>
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
                                        <i className={`fa-solid ${widget.icon} text-2xl sm:text-3xl ${active ? 'text-brand-green' : 'text-gray-400 dark:text-gray-500 group-hover:text-brand-green/70'}`} aria-hidden="true"></i>
                                        <span className={`text-[11px] sm:text-xs font-semibold text-center leading-tight ${active ? 'text-brand-green' : 'text-gray-700 dark:text-gray-200'}`}>
                                            {t(`businessDashboard.widgetNames.${widget.name}`)}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Preview */}
                    <div ref={previewRef} className="bg-white dark:bg-zinc-800 p-4 sm:p-5 md:p-6 rounded-lg sm:rounded-xl shadow-sm border dark:border-zinc-700 scroll-mt-4">
                        <h2 className="text-lg sm:text-xl font-bold mb-1">{t('businessDashboard.step3Preview', { widgetName: t(`businessDashboard.widgetNames.${selectedWidget.name}`) })}</h2>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-3 sm:mb-4">{t(selectedWidget.description)}</p>
                        <div className={`p-3 sm:p-4 rounded-lg overflow-x-auto ${theme === 'dark' ? 'bg-zinc-900' : 'bg-gray-100'}`}>
                            <selectedWidget.component business={business} theme={theme} lang={widgetLang !== 'auto' ? widgetLang : language} />
                        </div>
                    </div>

                    {/* Theme + idioma + descarga en una fila */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                        <div className="bg-white dark:bg-zinc-800 p-3 sm:p-4 rounded-lg sm:rounded-xl shadow-sm border dark:border-zinc-700">
                            <h2 className="text-sm sm:text-base font-bold mb-2">{t('businessDashboard.step2ChooseTheme')}</h2>
                            <div className="flex gap-1.5 sm:gap-2 p-1 bg-gray-100 dark:bg-zinc-900 rounded-lg">
                                <button type="button" onClick={() => setTheme('light')} className={`flex-1 py-1.5 sm:py-2 px-2 sm:px-3 rounded-md font-semibold text-xs sm:text-sm transition-all ${theme === 'light' ? 'bg-white dark:bg-zinc-700 shadow' : 'bg-transparent'}`}>{t('businessDashboard.lightTheme')}</button>
                                <button type="button" onClick={() => setTheme('dark')} className={`flex-1 py-1.5 sm:py-2 px-2 sm:px-3 rounded-md font-semibold text-xs sm:text-sm transition-all ${theme === 'dark' ? 'bg-white dark:bg-zinc-700 shadow' : 'bg-transparent'}`}>{t('businessDashboard.darkTheme')}</button>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-zinc-800 p-3 sm:p-4 rounded-lg sm:rounded-xl shadow-sm border dark:border-zinc-700">
                            <h2 className="text-sm sm:text-base font-bold mb-2">
                                <i className="fa-solid fa-language mr-1.5 text-brand-green"></i>
                                {t('businessDashboard.widgetLanguageTitle')}
                            </h2>
                            <select
                                aria-label={t('businessDashboard.widgetLanguageTitle')}
                                value={widgetLang}
                                onChange={(e) => setWidgetLang(e.target.value)}
                                className="w-full p-2 sm:p-2.5 rounded-lg bg-gray-100 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-brand-green focus:border-transparent"
                            >
                                <option value="auto">{t('businessDashboard.widgetLangAuto')}</option>
                                <option value="es">Español</option>
                                <option value="en">English</option>
                                <option value="fr">Français</option>
                                <option value="de">Deutsch</option>
                                <option value="it">Italiano</option>
                                <option value="pt">Português</option>
                                <option value="ca">Català</option>
                                <option value="zh-CN">中文</option>
                            </select>
                        </div>
                        <div className="bg-white dark:bg-zinc-800 p-3 sm:p-4 rounded-lg sm:rounded-xl shadow-sm border dark:border-zinc-700 flex flex-col">
                            <h2 className="text-sm sm:text-base font-bold mb-2">{t('businessDashboard.step4GetCode')}</h2>
                            <button type="button" onClick={downloadCodeAsTxt} className="mt-auto w-full bg-brand-dark hover:bg-black text-white dark:bg-gray-200 dark:text-brand-dark dark:hover:bg-white font-semibold py-2 sm:py-2.5 px-3 rounded-lg transition-colors flex items-center justify-center gap-2 text-xs sm:text-sm">
                                <i className="fa-solid fa-download"></i>
                                <span>{t('businessDashboard.downloadCodeButton')}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </FeatureLock>
        </div>
    );
};

export default DashboardWidgets;
