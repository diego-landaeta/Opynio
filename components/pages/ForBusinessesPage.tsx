import React from 'react';
import { Link } from 'react-router-dom';
import Meta from '../Meta';
import { useTranslation, useI18n, pathTranslations } from '../../contexts/i18nContext';
import { useCountry } from '../../contexts/CountryContext';

// Feature card component
const FeatureCard: React.FC<{
  icon: string;
  title: string;
  description: string;
}> = ({ icon, title, description }) => (
  <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-700 hover:shadow-md transition-shadow">
    <div className="w-14 h-14 rounded-xl bg-brand-green/10 flex items-center justify-center mb-4">
      <i className={`${icon} text-2xl text-brand-green`}></i>
    </div>
    <h3 className="font-semibold text-xl text-gray-900 dark:text-white mb-3">{title}</h3>
    <p className="text-gray-600 dark:text-gray-400">{description}</p>
  </div>
);

// Stat card component
const StatCard: React.FC<{
  stat: string;
}> = ({ stat }) => (
  <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl border border-gray-100 dark:border-zinc-700 text-center">
    <div className="w-10 h-10 rounded-full bg-brand-green/10 flex items-center justify-center mx-auto mb-3">
      <i className="fa-solid fa-chart-line text-brand-green"></i>
    </div>
    <p className="text-gray-700 dark:text-gray-300 font-medium">{stat}</p>
  </div>
);

// FAQ Item component
const FaqItem: React.FC<{ question: string; answer: string }> = ({ question, answer }) => {
  const [isOpen, setIsOpen] = React.useState(false);
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

// Trusted company logo placeholder
const TrustedLogo: React.FC<{ name: string; url: string }> = ({ name, url }) => (
  <a
    href={url}
    target="_blank"
    rel="noopener noreferrer"
    className="bg-gray-100 dark:bg-zinc-800 px-6 py-3 rounded-lg hover:bg-brand-green/10 hover:border-brand-green border-2 border-transparent transition-all"
  >
    <span className="text-gray-500 dark:text-gray-400 font-medium hover:text-brand-green transition-colors">{name}</span>
  </a>
);

const ForBusinessesPage: React.FC = () => {
  const t = useTranslation();
  const { language } = useI18n();
  const { country } = useCountry();

  const countryPrefix = country ? `/${country.toLowerCase()}` : '';
  const paths = pathTranslations[language] || pathTranslations.es;

  const features = [
    { icon: 'fa-solid fa-paper-plane', titleKey: 'forBusinessesPage.feature1Title', descKey: 'forBusinessesPage.feature1Desc' },
    { icon: 'fa-solid fa-robot', titleKey: 'forBusinessesPage.feature2Title', descKey: 'forBusinessesPage.feature2Desc' },
    { icon: 'fa-solid fa-puzzle-piece', titleKey: 'forBusinessesPage.feature3Title', descKey: 'forBusinessesPage.feature3Desc' },
    { icon: 'fa-solid fa-chart-pie', titleKey: 'forBusinessesPage.feature4Title', descKey: 'forBusinessesPage.feature4Desc' },
    { icon: 'fa-brands fa-google', titleKey: 'forBusinessesPage.feature5Title', descKey: 'forBusinessesPage.feature5Desc' },
    { icon: 'fa-solid fa-location-dot', titleKey: 'forBusinessesPage.feature6Title', descKey: 'forBusinessesPage.feature6Desc' },
  ];

  return (
    <>
      <Meta
        title={t('forBusinessesPage.metaTitle')}
        description={t('forBusinessesPage.metaDescription')}
      />

      <div className="max-w-6xl mx-auto">
        {/* Hero Section */}
        <section className="py-12 md:py-20">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
                {t('forBusinessesPage.title')}
              </h1>
              <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 mb-8">
                {t('forBusinessesPage.subtitle')}
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  to={`${countryPrefix}/${paths.register}?type=business`}
                  className="inline-flex items-center justify-center gap-2 bg-brand-green text-white px-8 py-4 rounded-lg font-semibold hover:bg-green-700 transition-colors"
                >
                  {t('forBusinessesPage.ctaButton')}
                  <i className="fa-solid fa-arrow-right"></i>
                </Link>
                <Link
                  to={`${countryPrefix}/${paths.support}`}
                  className="inline-flex items-center justify-center gap-2 border-2 border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 px-8 py-4 rounded-lg font-semibold hover:border-brand-green hover:text-brand-green transition-colors"
                >
                  {t('forBusinessesPage.ctaSecondary')}
                </Link>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="bg-gradient-to-br from-brand-green/20 to-blue-500/20 rounded-2xl p-8 aspect-square flex items-center justify-center">
                <i className="fa-solid fa-building text-8xl text-brand-green/50"></i>
              </div>
            </div>
          </div>
        </section>

        {/* Why Opynio Section */}
        <section className="py-12">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4 text-center">
            {t('forBusinessesPage.whyOpynioTitle')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-center max-w-2xl mx-auto mb-12">
            {t('forBusinessesPage.whyOpynioDesc')}
          </p>
        </section>

        {/* Features Section */}
        <section className="py-12">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-10 text-center">
            {t('forBusinessesPage.featuresTitle')}
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <FeatureCard
                key={index}
                icon={feature.icon}
                title={t(feature.titleKey)}
                description={t(feature.descKey)}
              />
            ))}
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-12">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-10 text-center">
            {t('forBusinessesPage.statsTitle')}
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <StatCard stat={t('forBusinessesPage.stat1')} />
            <StatCard stat={t('forBusinessesPage.stat2')} />
            <StatCard stat={t('forBusinessesPage.stat3')} />
          </div>
        </section>

        {/* Social Proof Section */}
        <section className="py-12">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4 text-center">
            {t('forBusinessesPage.socialProofTitle')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-center mb-10">
            {t('forBusinessesPage.socialProofDesc')}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <TrustedLogo name="ISEIE" url="https://iseie.com/" />
            <TrustedLogo name="Psiko Aprende" url="https://psikoaprende.com/" />
            <TrustedLogo name="Solvenic" url="https://solvenic.es/" />
            <TrustedLogo name="El Gran Catering" url="https://elgrancatering.com/" />
            <TrustedLogo name="Tareas Online" url="https://tareasonline.es/" />
            <TrustedLogo name="Agencia IA" url="https://agenciaia.ai/" />
          </div>
        </section>

        {/* Integration Section */}
        <section className="py-12">
          <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-2xl p-8 md:p-12">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4">
                  {t('forBusinessesPage.integrationsTitle')}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {t('forBusinessesPage.integrationsDesc')}
                </p>
                <div className="flex flex-wrap gap-4">
                  <div className="bg-white dark:bg-zinc-800 px-4 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 flex items-center gap-2">
                    <i className="fa-solid fa-code text-brand-green"></i>
                    <span className="font-medium">HTML</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-center">
                <div className="w-40 h-40 bg-brand-green/10 rounded-full flex items-center justify-center">
                  <i className="fa-solid fa-plug text-6xl text-brand-green"></i>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Preview Section */}
        <section className="py-12">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4 text-center">
            {t('forBusinessesPage.pricingPreviewTitle')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-center mb-8">
            {t('forBusinessesPage.pricingPreviewDesc')}
          </p>
          <div className="text-center">
            <Link
              to={`${countryPrefix}/${paths.pricing}`}
              className="inline-flex items-center gap-2 bg-brand-dark dark:bg-white text-white dark:text-brand-dark px-8 py-4 rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
              {t('forBusinessesPage.viewPricingButton')}
              <i className="fa-solid fa-arrow-right"></i>
            </Link>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-12">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-10 text-center">
            {t('forBusinessesPage.faqTitle')}
          </h2>
          <div className="max-w-3xl mx-auto">
            <FaqItem
              question={t('forBusinessesPage.faq1Q')}
              answer={t('forBusinessesPage.faq1A')}
            />
            <FaqItem
              question={t('forBusinessesPage.faq2Q')}
              answer={t('forBusinessesPage.faq2A')}
            />
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-12">
          <div className="bg-gradient-to-r from-brand-green to-green-600 rounded-2xl p-8 md:p-12 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              {t('forBusinessesPage.ctaTitle')}
            </h2>
            <p className="text-white/90 mb-8 max-w-2xl mx-auto">
              {t('forBusinessesPage.ctaDesc')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to={`${countryPrefix}/${paths.register}?type=business`}
                className="inline-flex items-center justify-center gap-2 bg-white text-brand-green px-8 py-4 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
              >
                {t('forBusinessesPage.ctaButton')}
                <i className="fa-solid fa-arrow-right"></i>
              </Link>
              <Link
                to={`${countryPrefix}/${paths.support}`}
                className="inline-flex items-center justify-center gap-2 border-2 border-white text-white px-8 py-4 rounded-lg font-semibold hover:bg-white/10 transition-colors"
              >
                {t('forBusinessesPage.ctaSecondary')}
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default ForBusinessesPage;
