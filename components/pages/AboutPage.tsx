import React from 'react';
import { Link } from 'react-router-dom';
import Meta from '../Meta';
import { useTranslation, useI18n, pathTranslations } from '../../contexts/i18nContext';
import { useCountry } from '../../contexts/CountryContext';
import { COUNTRIES } from '../../constants';

// Value card component
const ValueCard: React.FC<{
  icon: string;
  title: string;
  description: string;
}> = ({ icon, title, description }) => (
  <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-700 text-center">
    <div className="w-14 h-14 rounded-xl bg-brand-green/10 flex items-center justify-center mx-auto mb-4">
      <i className={`${icon} text-2xl text-brand-green`}></i>
    </div>
    <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-2">{title}</h3>
    <p className="text-gray-600 dark:text-gray-400">{description}</p>
  </div>
);

// Stat card component
const StatCard: React.FC<{
  value: string;
  label: string;
}> = ({ value, label }) => (
  <div className="text-center">
    <div className="text-4xl md:text-5xl font-bold text-brand-green mb-2">{value}</div>
    <div className="text-gray-600 dark:text-gray-400">{label}</div>
  </div>
);

// Story point component
const StoryPoint: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex items-center gap-3">
    <div className="w-2 h-2 rounded-full bg-brand-green flex-shrink-0"></div>
    <span className="text-gray-700 dark:text-gray-300">{text}</span>
  </div>
);

const AboutPage: React.FC = () => {
  const t = useTranslation();
  const { language } = useI18n();
  const { country } = useCountry();

  const countryPrefix = country ? `/${country.toLowerCase()}` : '';
  const paths = pathTranslations[language] || pathTranslations.es;

  // SEO: Obtener nombre del país para títulos únicos
  const countryName = COUNTRIES.find(c => c.code === country)?.name || '';
  const countryInTitle = countryName ? ` ${t('common.in')} ${countryName}` : '';

  const values = [
    { icon: 'fa-solid fa-fingerprint', titleKey: 'aboutPage.value1Title', descKey: 'aboutPage.value1Desc' },
    { icon: 'fa-solid fa-eye', titleKey: 'aboutPage.value2Title', descKey: 'aboutPage.value2Desc' },
    { icon: 'fa-solid fa-lightbulb', titleKey: 'aboutPage.value3Title', descKey: 'aboutPage.value3Desc' },
    { icon: 'fa-solid fa-users', titleKey: 'aboutPage.value4Title', descKey: 'aboutPage.value4Desc' },
  ];

  return (
    <>
      <Meta
        title={`${t('aboutPage.metaTitle')}${countryInTitle}`}
        description={`${t('aboutPage.metaDescription')}${countryInTitle}.`}
      />

      <div className="max-w-6xl mx-auto">
        {/* Hero Section */}
        <section className="text-center py-12 md:py-16">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            {t('aboutPage.title')}{countryInTitle}
          </h1>
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            {t('aboutPage.subtitle')}
          </p>
        </section>

        {/* Mission Section */}
        <section className="py-12">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4">
                {t('aboutPage.missionTitle')}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed">
                {t('aboutPage.missionDesc')}
              </p>
            </div>
            <div className="flex items-center justify-center">
              <div className="w-48 h-48 bg-gradient-to-br from-brand-green/20 to-blue-500/20 rounded-full flex items-center justify-center">
                <i className="fa-solid fa-bullseye text-7xl text-brand-green"></i>
              </div>
            </div>
          </div>
        </section>

        {/* Vision Section */}
        <section className="py-12">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div className="order-2 md:order-1 flex items-center justify-center">
              <div className="w-48 h-48 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full flex items-center justify-center">
                <i className="fa-solid fa-eye text-7xl text-purple-500"></i>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4">
                {t('aboutPage.visionTitle')}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed">
                {t('aboutPage.visionDesc')}
              </p>
            </div>
          </div>
        </section>

        {/* Story Section */}
        <section className="py-12">
          <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-2xl p-8 md:p-12">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-6 text-center">
              {t('aboutPage.storyTitle')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-lg text-center max-w-3xl mx-auto mb-8">
              {t('aboutPage.storyDesc')}
            </p>
            <div className="flex flex-col md:flex-row justify-center gap-6 md:gap-12">
              <StoryPoint text={t('aboutPage.story1')} />
              <StoryPoint text={t('aboutPage.story2')} />
              <StoryPoint text={t('aboutPage.story3')} />
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="py-12">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-10 text-center">
            {t('aboutPage.valuesTitle')}
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => (
              <ValueCard
                key={index}
                icon={value.icon}
                title={t(value.titleKey)}
                description={t(value.descKey)}
              />
            ))}
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-12">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-10 text-center">
            {t('aboutPage.statsTitle')}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <StatCard value={t('aboutPage.stat1Title')} label={t('aboutPage.stat1Desc')} />
            <StatCard value={t('aboutPage.stat2Title')} label={t('aboutPage.stat2Desc')} />
            <StatCard value={t('aboutPage.stat3Title')} label={t('aboutPage.stat3Desc')} />
            <StatCard value={t('aboutPage.stat4Title')} label={t('aboutPage.stat4Desc')} />
          </div>
        </section>

        {/* Team Section */}
        <section className="py-12">
          <div className="text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4">
              {t('aboutPage.teamTitle')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-10">
              {t('aboutPage.teamDesc')}
            </p>
            <div className="flex justify-center gap-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand-green to-green-600 flex items-center justify-center">
                <i className="fa-solid fa-user text-3xl text-white"></i>
              </div>
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <i className="fa-solid fa-user text-3xl text-white"></i>
              </div>
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                <i className="fa-solid fa-user text-3xl text-white"></i>
              </div>
            </div>
          </div>
        </section>

        {/* Careers Section */}
        <section className="py-12">
          <div className="bg-brand-green/5 dark:bg-brand-green/10 rounded-2xl p-8 md:p-12">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4">
                  {t('aboutPage.careersTitle')}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {t('aboutPage.careersDesc')}
                </p>
                <button className="inline-flex items-center gap-2 bg-brand-green text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors">
                  {t('aboutPage.careersButton')}
                  <i className="fa-solid fa-arrow-right"></i>
                </button>
              </div>
              <div className="flex items-center justify-center">
                <div className="w-32 h-32 bg-brand-green/10 rounded-full flex items-center justify-center">
                  <i className="fa-solid fa-briefcase text-5xl text-brand-green"></i>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section className="py-12 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4">
            {t('aboutPage.contactTitle')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {t('aboutPage.contactDesc')}
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <a
              href={`mailto:${t('aboutPage.contactEmail')}`}
              className="inline-flex items-center justify-center gap-2 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
            >
              <i className="fa-solid fa-envelope"></i>
              {t('aboutPage.contactEmail')}
            </a>
            <Link
              to={`${countryPrefix}/${paths.support}`}
              className="inline-flex items-center justify-center gap-2 bg-brand-green text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
            >
              {t('aboutPage.contactButton')}
              <i className="fa-solid fa-arrow-right"></i>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
};

export default AboutPage;
