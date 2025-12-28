import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Meta from '../Meta';
import { useTranslation, useI18n, pathTranslations } from '../../contexts/i18nContext';
import { useCountry } from '../../contexts/CountryContext';

// Demo widget component for preview
const WidgetPreviewCard: React.FC<{
  title: string;
  description: string;
  icon: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ title, description, icon, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`p-6 rounded-xl border-2 transition-all text-left ${
      isActive
        ? 'border-brand-green bg-brand-green/5 shadow-lg'
        : 'border-gray-200 dark:border-zinc-700 hover:border-brand-green/50'
    }`}
  >
    <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${
      isActive ? 'bg-brand-green text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400'
    }`}>
      <i className={`${icon} text-xl`}></i>
    </div>
    <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-2">{title}</h3>
    <p className="text-gray-600 dark:text-gray-400 text-sm">{description}</p>
  </button>
);

// Benefit card component
const BenefitCard: React.FC<{
  icon: string;
  title: string;
  description: string;
}> = ({ icon, title, description }) => (
  <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-700">
    <div className="w-12 h-12 rounded-lg bg-brand-green/10 flex items-center justify-center mb-4">
      <i className={`${icon} text-xl text-brand-green`}></i>
    </div>
    <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-2">{title}</h3>
    <p className="text-gray-600 dark:text-gray-400">{description}</p>
  </div>
);

// Integration step component
const IntegrationStep: React.FC<{
  step: number;
  text: string;
}> = ({ step, text }) => (
  <div className="flex items-center gap-4">
    <div className="w-10 h-10 rounded-full bg-brand-green text-white flex items-center justify-center font-bold flex-shrink-0">
      {step}
    </div>
    <span className="text-gray-700 dark:text-gray-300">{text}</span>
  </div>
);

const WidgetsShowcasePage: React.FC = () => {
  const t = useTranslation();
  const { language } = useI18n();
  const { country } = useCountry();
  const [activeWidget, setActiveWidget] = useState('carousel');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const countryPrefix = country ? `/${country.toLowerCase()}` : '';
  const paths = pathTranslations[language] || pathTranslations.es;

  const widgets = [
    { id: 'carousel', titleKey: 'widgetsPage.widgetCarouselTitle', descKey: 'widgetsPage.widgetCarouselDesc', icon: 'fa-solid fa-images' },
    { id: 'grid', titleKey: 'widgetsPage.widgetGridTitle', descKey: 'widgetsPage.widgetGridDesc', icon: 'fa-solid fa-table-cells' },
    { id: 'badge', titleKey: 'widgetsPage.widgetBadgeTitle', descKey: 'widgetsPage.widgetBadgeDesc', icon: 'fa-solid fa-certificate' },
    { id: 'floating', titleKey: 'widgetsPage.widgetFloatingTitle', descKey: 'widgetsPage.widgetFloatingDesc', icon: 'fa-solid fa-comment-dots' },
    { id: 'sidebar', titleKey: 'widgetsPage.widgetSidebarTitle', descKey: 'widgetsPage.widgetSidebarDesc', icon: 'fa-solid fa-bars' },
    { id: 'wall', titleKey: 'widgetsPage.widgetWallTitle', descKey: 'widgetsPage.widgetWallDesc', icon: 'fa-solid fa-grip' },
    { id: 'showcase', titleKey: 'widgetsPage.widgetShowcaseTitle', descKey: 'widgetsPage.widgetShowcaseDesc', icon: 'fa-solid fa-star' },
    { id: 'horizontal', titleKey: 'widgetsPage.widgetHorizontalTitle', descKey: 'widgetsPage.widgetHorizontalDesc', icon: 'fa-solid fa-arrows-left-right' },
  ];

  return (
    <>
      <Meta
        title={t('widgetsPage.metaTitle')}
        description={t('widgetsPage.metaDescription')}
      />

      <div className="max-w-6xl mx-auto">
        {/* Hero Section */}
        <section className="text-center py-12 md:py-16">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            {t('widgetsPage.title')}
          </h1>
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto mb-8">
            {t('widgetsPage.subtitle')}
          </p>
          <Link
            to={`${countryPrefix}/${paths.register}?type=business`}
            className="inline-flex items-center gap-2 bg-brand-green text-white px-8 py-4 rounded-lg font-semibold hover:bg-green-700 transition-colors"
          >
            {t('widgetsPage.ctaButton')}
            <i className="fa-solid fa-arrow-right"></i>
          </Link>
        </section>

        {/* Why Widgets Section */}
        <section className="py-12">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4 text-center">
            {t('widgetsPage.whyWidgetsTitle')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-center max-w-2xl mx-auto mb-10">
            {t('widgetsPage.whyWidgetsDesc')}
          </p>
        </section>

        {/* Benefits Section */}
        <section className="py-12">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-10 text-center">
            {t('widgetsPage.benefitsTitle')}
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <BenefitCard
              icon="fa-solid fa-shield"
              title={t('widgetsPage.benefit1Title')}
              description={t('widgetsPage.benefit1Desc')}
            />
            <BenefitCard
              icon="fa-solid fa-chart-line"
              title={t('widgetsPage.benefit2Title')}
              description={t('widgetsPage.benefit2Desc')}
            />
            <BenefitCard
              icon="fa-solid fa-search"
              title={t('widgetsPage.benefit3Title')}
              description={t('widgetsPage.benefit3Desc')}
            />
          </div>
        </section>

        {/* Widget Types Section */}
        <section className="py-12">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-10 text-center">
            {t('widgetsPage.widgetTypesTitle')}
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {widgets.map((widget) => (
              <WidgetPreviewCard
                key={widget.id}
                title={t(widget.titleKey)}
                description={t(widget.descKey)}
                icon={widget.icon}
                isActive={activeWidget === widget.id}
                onClick={() => setActiveWidget(widget.id)}
              />
            ))}
          </div>
        </section>

        {/* Preview Section */}
        <section className="py-12">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4 text-center">
            {t('widgetsPage.previewTitle')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-center mb-8">
            {t('widgetsPage.previewDesc')}
          </p>

          {/* Theme Toggle */}
          <div className="flex justify-center gap-4 mb-8">
            <button
              onClick={() => setTheme('light')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                theme === 'light'
                  ? 'bg-brand-green text-white'
                  : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400'
              }`}
            >
              <i className="fa-solid fa-sun mr-2"></i>
              {t('businessDashboard.lightTheme')}
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                theme === 'dark'
                  ? 'bg-brand-green text-white'
                  : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400'
              }`}
            >
              <i className="fa-solid fa-moon mr-2"></i>
              {t('businessDashboard.darkTheme')}
            </button>
          </div>

          {/* Widget Preview Area */}
          <div className={`rounded-xl p-8 min-h-[400px] ${
            theme === 'dark' ? 'bg-zinc-900' : 'bg-gray-100'
          }`}>
            {/* Mockup de widget de reseñas */}
            <div className="max-w-4xl mx-auto">
              {activeWidget === 'carousel' && (
                <div className={`${theme === 'dark' ? 'bg-zinc-800' : 'bg-white'} rounded-xl p-6 shadow-lg`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-brand-green font-bold text-lg">Opynio</span>
                      <div className="flex text-yellow-400">
                        {[1,2,3,4,5].map(i => <i key={i} className="fa-solid fa-star text-sm"></i>)}
                      </div>
                      <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>4.8/5</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {[1,2,3].map(i => (
                      <div key={i} className={`${theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-50'} rounded-lg p-4`}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-8 h-8 rounded-full ${theme === 'dark' ? 'bg-zinc-600' : 'bg-gray-300'}`}></div>
                          <div>
                            <div className={`h-3 w-16 ${theme === 'dark' ? 'bg-zinc-600' : 'bg-gray-300'} rounded`}></div>
                            <div className="flex text-yellow-400 mt-1">
                              {[1,2,3,4,5].map(j => <i key={j} className="fa-solid fa-star text-xs"></i>)}
                            </div>
                          </div>
                        </div>
                        <div className={`h-2 w-full ${theme === 'dark' ? 'bg-zinc-600' : 'bg-gray-300'} rounded mb-1`}></div>
                        <div className={`h-2 w-3/4 ${theme === 'dark' ? 'bg-zinc-600' : 'bg-gray-300'} rounded mb-1`}></div>
                        <div className={`h-2 w-1/2 ${theme === 'dark' ? 'bg-zinc-600' : 'bg-gray-300'} rounded`}></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {activeWidget === 'badge' && (
                <div className="flex justify-center">
                  <div className={`${theme === 'dark' ? 'bg-zinc-800' : 'bg-white'} rounded-xl p-6 shadow-lg inline-block`}>
                    <div className="text-center">
                      <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-brand-green/10 flex items-center justify-center">
                        <span className="text-brand-green font-bold text-2xl">4.8</span>
                      </div>
                      <div className="flex justify-center text-yellow-400 mb-2">
                        {[1,2,3,4,5].map(i => <i key={i} className="fa-solid fa-star"></i>)}
                      </div>
                      <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>124 {t('widgetsPage.previewReviews')}</p>
                      <p className="text-brand-green text-xs mt-2">{t('widgetsPage.previewVerified')}</p>
                    </div>
                  </div>
                </div>
              )}
              {activeWidget === 'grid' && (
                <div className={`${theme === 'dark' ? 'bg-zinc-800' : 'bg-white'} rounded-xl p-6 shadow-lg`}>
                  <div className="grid grid-cols-2 gap-4">
                    {[1,2,3,4].map(i => (
                      <div key={i} className={`${theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-50'} rounded-lg p-4`}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-10 h-10 rounded-full ${theme === 'dark' ? 'bg-zinc-600' : 'bg-gray-300'}`}></div>
                          <div className="flex-1">
                            <div className={`h-3 w-20 ${theme === 'dark' ? 'bg-zinc-600' : 'bg-gray-300'} rounded mb-1`}></div>
                            <div className="flex text-yellow-400">
                              {[1,2,3,4,5].map(j => <i key={j} className="fa-solid fa-star text-xs"></i>)}
                            </div>
                          </div>
                        </div>
                        <div className={`h-2 w-full ${theme === 'dark' ? 'bg-zinc-600' : 'bg-gray-300'} rounded mb-1`}></div>
                        <div className={`h-2 w-2/3 ${theme === 'dark' ? 'bg-zinc-600' : 'bg-gray-300'} rounded`}></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(activeWidget !== 'carousel' && activeWidget !== 'badge' && activeWidget !== 'grid') && (
                <div className={`${theme === 'dark' ? 'bg-zinc-800' : 'bg-white'} rounded-xl p-8 shadow-lg text-center`}>
                  <i className={`fa-solid fa-${activeWidget === 'floating' ? 'comment-dots' : activeWidget === 'sidebar' ? 'bars-staggered' : activeWidget === 'wall' ? 'grip' : activeWidget === 'showcase' ? 'star' : 'arrows-left-right'} text-5xl text-brand-green mb-4`}></i>
                  <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    {t(`widgetsPage.widget${activeWidget.charAt(0).toUpperCase() + activeWidget.slice(1)}Title`)}
                  </p>
                  <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                    {t('widgetsPage.previewAvailableDashboard')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Integration Section */}
        <section className="py-12">
          <div className="bg-gradient-to-br from-brand-green/10 to-blue-500/10 rounded-2xl p-8 md:p-12">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4">
                  {t('widgetsPage.integrationTitle')}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-8">
                  {t('widgetsPage.integrationDesc')}
                </p>
                <div className="space-y-4">
                  <IntegrationStep step={1} text={t('widgetsPage.integrationStep1')} />
                  <IntegrationStep step={2} text={t('widgetsPage.integrationStep2')} />
                  <IntegrationStep step={3} text={t('widgetsPage.integrationStep3')} />
                  <IntegrationStep step={4} text={t('widgetsPage.integrationStep4')} />
                </div>
              </div>
              <div className="bg-zinc-900 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-gray-500 ml-2">{t('widgetsPage.codeGeneratedTitle')}</span>
                </div>
                <div className="text-center py-6">
                  <i className="fa-solid fa-lock text-4xl text-brand-green mb-4"></i>
                  <p className="text-gray-300 mb-2">{t('widgetsPage.codeGeneratedDesc')}</p>
                  <p className="text-gray-500 text-sm">{t('widgetsPage.codeGeneratedSubdesc')}</p>
                </div>
                <div className="border-t border-zinc-700 pt-4 mt-4">
                  <p className="text-gray-400 text-xs text-center">
                    {t('widgetsPage.needHelp')} <a href="mailto:support@opynio.com" className="text-brand-green hover:underline">support@opynio.com</a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Customization Section */}
        <section className="py-12">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4 text-center">
            {t('widgetsPage.customizationTitle')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-center max-w-2xl mx-auto mb-10">
            {t('widgetsPage.customizationDesc')}
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl border border-gray-100 dark:border-zinc-700 text-center">
              <i className="fa-solid fa-palette text-3xl text-brand-green mb-4"></i>
              <h3 className="font-semibold text-gray-900 dark:text-white">{t('widgetsPage.customizationColors')}</h3>
            </div>
            <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl border border-gray-100 dark:border-zinc-700 text-center">
              <i className="fa-solid fa-moon text-3xl text-brand-green mb-4"></i>
              <h3 className="font-semibold text-gray-900 dark:text-white">{t('widgetsPage.customizationTheme')}</h3>
            </div>
            <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl border border-gray-100 dark:border-zinc-700 text-center">
              <i className="fa-solid fa-mobile-screen text-3xl text-brand-green mb-4"></i>
              <h3 className="font-semibold text-gray-900 dark:text-white">{t('widgetsPage.customizationResponsive')}</h3>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-12 text-center">
          <div className="bg-brand-green rounded-2xl p-8 md:p-12">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              {t('widgetsPage.ctaTitle')}
            </h2>
            <p className="text-white/90 mb-8 max-w-2xl mx-auto">
              {t('widgetsPage.ctaDesc')}
            </p>
            <Link
              to={`${countryPrefix}/${paths.register}?type=business`}
              className="inline-flex items-center gap-2 bg-white text-brand-green px-8 py-4 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              {t('widgetsPage.ctaButton')}
              <i className="fa-solid fa-arrow-right"></i>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
};

export default WidgetsShowcasePage;
