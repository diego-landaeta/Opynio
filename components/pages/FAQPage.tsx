import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Meta from '../Meta';
import { useTranslation, useI18n, pathTranslations } from '../../contexts/i18nContext';
import { useCountry } from '../../contexts/CountryContext';
import { COUNTRIES } from '../../constants';

// FAQ Item component
const FaqItem: React.FC<{ question: string; answer: string }> = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-gray-200 dark:border-zinc-700">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center text-left py-4 font-semibold text-gray-800 dark:text-gray-100"
        aria-expanded={isOpen}
      >
        <span>{question}</span>
        <i className={`fa-solid fa-chevron-down transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}></i>
      </button>
      <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <div className="pb-4 text-gray-600 dark:text-gray-300">{answer}</div>
        </div>
      </div>
    </div>
  );
};

// Category tab button
const CategoryTab: React.FC<{
  label: string;
  icon: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ label, icon, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
      isActive
        ? 'bg-brand-green text-white'
        : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700'
    }`}
  >
    <i className={`${icon} text-sm`}></i>
    <span>{label}</span>
  </button>
);

const FAQPage: React.FC = () => {
  const t = useTranslation();
  const { language } = useI18n();
  const { country } = useCountry();
  const [activeCategory, setActiveCategory] = useState('general');

  const countryPrefix = country ? `/${country.toLowerCase()}` : '';
  const paths = pathTranslations[language] || pathTranslations.es;

  // SEO: Obtener nombre del país para títulos únicos
  const countryName = COUNTRIES.find(c => c.code === country)?.name || '';
  const countryInTitle = countryName ? ` ${t('common.in')} ${countryName}` : '';

  const categories = [
    { id: 'general', labelKey: 'faqPage.generalTitle', icon: 'fa-solid fa-circle-info' },
    { id: 'account', labelKey: 'faqPage.accountTitle', icon: 'fa-solid fa-user' },
    { id: 'reviews', labelKey: 'faqPage.reviewsTitle', icon: 'fa-solid fa-star' },
    { id: 'business', labelKey: 'faqPage.businessTitle', icon: 'fa-solid fa-building' },
    { id: 'widgets', labelKey: 'faqPage.widgetsTitle', icon: 'fa-solid fa-puzzle-piece' },
    { id: 'plans', labelKey: 'faqPage.plansTitle', icon: 'fa-solid fa-credit-card' },
    { id: 'privacy', labelKey: 'faqPage.privacyTitle', icon: 'fa-solid fa-shield' },
    { id: 'support', labelKey: 'faqPage.supportTitle', icon: 'fa-solid fa-headset' },
  ];

  const faqsByCategory: Record<string, Array<{ qKey: string; aKey: string }>> = {
    general: [
      { qKey: 'faqPage.general1Q', aKey: 'faqPage.general1A' },
      { qKey: 'faqPage.general2Q', aKey: 'faqPage.general2A' },
    ],
    account: [
      { qKey: 'faqPage.account1Q', aKey: 'faqPage.account1A' },
      { qKey: 'faqPage.account2Q', aKey: 'faqPage.account2A' },
    ],
    reviews: [
      { qKey: 'faqPage.reviews1Q', aKey: 'faqPage.reviews1A' },
      { qKey: 'faqPage.reviews2Q', aKey: 'faqPage.reviews2A' },
    ],
    business: [
      { qKey: 'faqPage.business1Q', aKey: 'faqPage.business1A' },
      { qKey: 'faqPage.business2Q', aKey: 'faqPage.business2A' },
    ],
    widgets: [
      { qKey: 'faqPage.widgets1Q', aKey: 'faqPage.widgets1A' },
      { qKey: 'faqPage.widgets2Q', aKey: 'faqPage.widgets2A' },
    ],
    plans: [
      { qKey: 'faqPage.plans1Q', aKey: 'faqPage.plans1A' },
      { qKey: 'faqPage.plans2Q', aKey: 'faqPage.plans2A' },
    ],
    privacy: [
      { qKey: 'faqPage.privacy1Q', aKey: 'faqPage.privacy1A' },
      { qKey: 'faqPage.privacy2Q', aKey: 'faqPage.privacy2A' },
    ],
    support: [
      { qKey: 'faqPage.support1Q', aKey: 'faqPage.support1A' },
    ],
  };

  return (
    <>
      <Meta
        title={`${t('faqPage.metaTitle')}${countryInTitle}`}
        description={`${t('faqPage.metaDescription')}${countryInTitle}.`}
      />

      <div className="max-w-4xl mx-auto">
        {/* Hero Section */}
        <section className="text-center py-12 md:py-16">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            {t('faqPage.title')}{countryInTitle}
          </h1>
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            {t('faqPage.subtitle')}
          </p>
        </section>

        {/* Category Tabs */}
        <section className="py-6">
          <div className="flex flex-wrap gap-2 justify-center">
            {categories.map((category) => (
              <CategoryTab
                key={category.id}
                label={t(category.labelKey)}
                icon={category.icon}
                isActive={activeCategory === category.id}
                onClick={() => setActiveCategory(category.id)}
              />
            ))}
          </div>
        </section>

        {/* FAQ List */}
        <section className="py-8">
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-zinc-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
              <i className={`${categories.find(c => c.id === activeCategory)?.icon} text-brand-green`}></i>
              {t(categories.find(c => c.id === activeCategory)?.labelKey || '')}
            </h2>
            <div>
              {faqsByCategory[activeCategory]?.map((faq, index) => (
                <FaqItem
                  key={index}
                  question={t(faq.qKey)}
                  answer={t(faq.aKey)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* All Categories Quick View */}
        <section className="py-12">
          <div className="grid md:grid-cols-2 gap-6">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`p-6 rounded-xl border-2 text-left transition-all ${
                  activeCategory === category.id
                    ? 'border-brand-green bg-brand-green/5'
                    : 'border-gray-200 dark:border-zinc-700 hover:border-brand-green/50'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    activeCategory === category.id
                      ? 'bg-brand-green text-white'
                      : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400'
                  }`}>
                    <i className={`${category.icon} text-lg`}></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {t(category.labelKey)}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {faqsByCategory[category.id]?.length || 0} {t('faqPage.questionsCount')}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-12">
          <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-2xl p-8 md:p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-brand-green/10 flex items-center justify-center mx-auto mb-6">
              <i className="fa-solid fa-comments text-3xl text-brand-green"></i>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4">
              {t('faqPage.ctaTitle')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-xl mx-auto">
              {t('faqPage.ctaDesc')}
            </p>
            <Link
              to={`${countryPrefix}/${paths.support}`}
              className="inline-flex items-center gap-2 bg-brand-green text-white px-8 py-4 rounded-lg font-semibold hover:bg-green-700 transition-colors"
            >
              {t('faqPage.ctaButton')}
              <i className="fa-solid fa-arrow-right"></i>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
};

export default FAQPage;
