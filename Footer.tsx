
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation, useI18n, pathTranslations } from './contexts/i18nContext';

const Footer: React.FC = () => {
  const t = useTranslation();
  const { language } = useI18n();
  const langPrefix = language === 'en' ? '/en' : '';

  return (
    <footer className="bg-brand-dark text-gray-300">
      <div className="container mx-auto px-4 pt-16 pb-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Logo & Country */}
          <div className="col-span-2 md:col-span-1">
             <Link to={langPrefix || '/'} className="flex items-center gap-2 mb-4">
                <span className="text-2xl font-bold text-white">Opynio</span>
            </Link>
            <div className="mt-4">
                <label htmlFor="country-select" className="sr-only">{t('common.aria.chooseCountry')}</label>
                <select id="country-select" className="bg-gray-700 dark:bg-zinc-700 text-white rounded-md p-2 w-full md:w-auto">
                    <option>{t('common.country.spain')}</option>
                    <option>{t('common.country.unitedStates')}</option>
                    <option>{t('common.country.unitedKingdom')}</option>
                </select>
            </div>
          </div>
          
          {/* About */}
          <div>
            <h3 className="font-bold text-white mb-4">{t('aboutUs')}</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white">{t('aboutOpynio')}</a></li>
              <li><Link to={`${langPrefix}/${pathTranslations[language].support}`} className="hover:text-white">{t('contact')}</Link></li>
              <li><a href="#" className="hover:text-white">{t('blog')}</a></li>
            </ul>
          </div>

          {/* Community */}
          <div>
            <h3 className="font-bold text-white mb-4">{t('community')}</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white">{t('trustCenter')}</a></li>
              <li><Link to={`${langPrefix}/${pathTranslations[language].support}`} className="hover:text-white">{t('help')}</Link></li>
              <li><Link to={`${langPrefix}/${pathTranslations[language].login}`} className="hover:text-white">{t('login')}</Link></li>
              <li><Link to={`${langPrefix}/${pathTranslations[language].register}`} className="hover:text-white">{t('register')}</Link></li>
            </ul>
          </div>
          
          {/* Businesses */}
          <div>
            <h3 className="font-bold text-white mb-4">{t('businesses')}</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white">{t('opynioBusiness')}</a></li>
              <li><Link to={`${langPrefix}/${pathTranslations[language].pricing}`} className="hover:text-white">{t('pricingAndPlans')}</Link></li>
              <li><a href="#" className="hover:text-white">{t('businessLogin')}</a></li>
            </ul>
          </div>
          
          {/* Follow Us */}
          <div>
            <h3 className="font-bold text-white mb-4">{t('followUs')}</h3>
            <div className="flex gap-4 text-xl">
                <a href="#" className="hover:text-white"><i className="fab fa-facebook-f"></i></a>
                <a href="#" className="hover:text-white"><i className="fab fa-twitter"></i></a>
                <a href="#" className="hover:text-white"><i className="fab fa-instagram"></i></a>
                <a href="#" className="hover:text-white"><i className="fab fa-linkedin-in"></i></a>
            </div>
          </div>

        </div>

        <div className="flex flex-col md:flex-row justify-between items-center text-sm mt-12 pt-8 border-t border-gray-700 dark:border-zinc-700">
          <p>&copy; {new Date().getFullYear()} Opynio. {t('allRightsReserved')}</p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <a href="#" className="hover:text-white">{t('legalNotice')}</a>
            <a href="#" className="hover:text-white">{t('termsOfUse')}</a>
            <a href="#" className="hover:text-white">{t('privacy')}</a>
          </div>
        </div>

      </div>
    </footer>
  );
};

export default Footer;
