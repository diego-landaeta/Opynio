import React from 'react';
import { Link } from 'react-router-dom';
import Meta from '../Meta';
import { useTranslation, useI18n, pathTranslations } from '../../contexts/i18nContext';
import { useCountry } from '../../contexts/CountryContext';
import { COUNTRIES } from '../../constants';

// Step card component
const StepCard: React.FC<{
  step: number;
  title: string;
  description: string;
  detail: string;
  icon: string;
}> = ({ step, title, description, detail, icon }) => (
  <div className="relative">
    <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-700">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-brand-green text-white flex items-center justify-center font-bold text-lg flex-shrink-0">
          {step}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <i className={`${icon} text-brand-green text-xl`}></i>
            <h3 className="font-semibold text-xl text-gray-900 dark:text-white">{title}</h3>
          </div>
          <p className="text-gray-700 dark:text-gray-300 mb-2">{description}</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{detail}</p>
        </div>
      </div>
    </div>
  </div>
);

// Feature highlight component
const FeatureHighlight: React.FC<{
  icon: string;
  title: string;
  description: string;
}> = ({ icon, title, description }) => (
  <div className="text-center p-6">
    <div className="w-16 h-16 rounded-2xl bg-brand-green/10 flex items-center justify-center mx-auto mb-4">
      <i className={`${icon} text-2xl text-brand-green`}></i>
    </div>
    <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-2">{title}</h3>
    <p className="text-gray-600 dark:text-gray-400">{description}</p>
  </div>
);

// Verification check component
const VerificationCheck: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex items-center gap-3">
    <div className="w-6 h-6 rounded-full bg-brand-green/10 flex items-center justify-center flex-shrink-0">
      <i className="fa-solid fa-check text-brand-green text-sm"></i>
    </div>
    <span className="text-gray-700 dark:text-gray-300">{text}</span>
  </div>
);

const HowItWorksPage: React.FC = () => {
  const t = useTranslation();
  const { language } = useI18n();
  const { country } = useCountry();

  const countryPrefix = country ? `/${country.toLowerCase()}` : '';
  const paths = pathTranslations[language] || pathTranslations.es;

  // SEO: Obtener nombre del país para títulos únicos
  const countryName = COUNTRIES.find(c => c.code === country)?.name || '';
  const countryInTitle = countryName ? ` ${t('common.in')} ${countryName}` : '';

  const steps = [
    { icon: 'fa-solid fa-user-plus', titleKey: 'howItWorksPage.step1Title', descKey: 'howItWorksPage.step1Desc', detailKey: 'howItWorksPage.step1Detail' },
    { icon: 'fa-solid fa-building', titleKey: 'howItWorksPage.step2Title', descKey: 'howItWorksPage.step2Desc', detailKey: 'howItWorksPage.step2Detail' },
    { icon: 'fa-solid fa-paper-plane', titleKey: 'howItWorksPage.step3Title', descKey: 'howItWorksPage.step3Desc', detailKey: 'howItWorksPage.step3Detail' },
    { icon: 'fa-solid fa-comments', titleKey: 'howItWorksPage.step4Title', descKey: 'howItWorksPage.step4Desc', detailKey: 'howItWorksPage.step4Detail' },
    { icon: 'fa-solid fa-puzzle-piece', titleKey: 'howItWorksPage.step5Title', descKey: 'howItWorksPage.step5Desc', detailKey: 'howItWorksPage.step5Detail' },
  ];

  return (
    <>
      <Meta
        title={`${t('howItWorksPage.metaTitle')}${countryInTitle}`}
        description={`${t('howItWorksPage.metaDescription')}${countryInTitle}.`}
      />

      <div className="max-w-6xl mx-auto">
        {/* Hero Section */}
        <section className="text-center py-12 md:py-16">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            {t('howItWorksPage.title')}{countryInTitle}
          </h1>
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            {t('howItWorksPage.subtitle')}
          </p>
        </section>

        {/* Overview Section */}
        <section className="py-12">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4 text-center">
            {t('howItWorksPage.overviewTitle')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-center max-w-2xl mx-auto mb-12">
            {t('howItWorksPage.overviewDesc')}
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            {/* For Users */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-8">
              <div className="w-14 h-14 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4">
                <i className="fa-solid fa-user text-2xl text-blue-600 dark:text-blue-400"></i>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                {t('howItWorksPage.forUsersTitle')}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {t('howItWorksPage.forUsersDesc')}
              </p>
            </div>

            {/* For Businesses */}
            <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-8">
              <div className="w-14 h-14 rounded-xl bg-brand-green/10 flex items-center justify-center mb-4">
                <i className="fa-solid fa-building text-2xl text-brand-green"></i>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                {t('howItWorksPage.forBusinessesTitle')}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {t('howItWorksPage.forBusinessesDesc')}
              </p>
            </div>
          </div>
        </section>

        {/* Steps Section */}
        <section className="py-12">
          <div className="space-y-6">
            {steps.map((step, index) => (
              <StepCard
                key={index}
                step={index + 1}
                icon={step.icon}
                title={t(step.titleKey)}
                description={t(step.descKey)}
                detail={t(step.detailKey)}
              />
            ))}
          </div>
        </section>

        {/* Verification Section */}
        <section className="py-12">
          <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-2xl p-8 md:p-12">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4">
                  {t('howItWorksPage.verificationTitle')}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {t('howItWorksPage.verificationDesc')}
                </p>
                <div className="space-y-4">
                  <VerificationCheck text={t('howItWorksPage.verification1')} />
                  <VerificationCheck text={t('howItWorksPage.verification2')} />
                  <VerificationCheck text={t('howItWorksPage.verification3')} />
                </div>
              </div>
              <div className="flex items-center justify-center">
                <div className="w-48 h-48 bg-brand-green/10 rounded-full flex items-center justify-center">
                  <i className="fa-solid fa-shield text-7xl text-brand-green"></i>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Overview Section */}
        <section className="py-12">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4 text-center">
            {t('howItWorksPage.featuresOverviewTitle')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-center max-w-2xl mx-auto mb-10">
            {t('howItWorksPage.featuresOverviewDesc')}
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            <FeatureHighlight
              icon="fa-solid fa-microphone"
              title={t('howItWorksPage.audioReviewsTitle')}
              description={t('howItWorksPage.audioReviewsDesc')}
            />
            <FeatureHighlight
              icon="fa-solid fa-brain"
              title={t('howItWorksPage.aiSummariesTitle')}
              description={t('howItWorksPage.aiSummariesDesc')}
            />
            <FeatureHighlight
              icon="fa-solid fa-globe"
              title={t('howItWorksPage.multiLanguageTitle')}
              description={t('howItWorksPage.multiLanguageDesc')}
            />
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-12 text-center">
          <div className="bg-brand-green rounded-2xl p-8 md:p-12">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              {t('howItWorksPage.ctaTitle')}
            </h2>
            <p className="text-white/90 mb-8 max-w-2xl mx-auto">
              {t('howItWorksPage.ctaDesc')}
            </p>
            <Link
              to={`${countryPrefix}/${paths.register}`}
              className="inline-flex items-center gap-2 bg-white text-brand-green px-8 py-4 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              {t('howItWorksPage.ctaButton')}
              <i className="fa-solid fa-arrow-right"></i>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
};

export default HowItWorksPage;
