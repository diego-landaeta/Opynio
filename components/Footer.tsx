
import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation, useI18n, pathTranslations, getLanguageForCountryCode, isDashboardRoute, Language } from '../contexts/i18nContext';
import { useCountry } from '../contexts/CountryContext';
import { LANGUAGES } from '../constants';

const Footer: React.FC = () => {
  const t = useTranslation();
  const { country } = useCountry();
  const { language, setLanguage } = useI18n();
  const location = useLocation();
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const langDropdownRef = useRef<HTMLDivElement>(null);

  // En dashboards el cambio de idioma se oculta — la URL está atada al país
  // de la empresa y cambiar idioma rompería navegación.
  const hideLanguageSwitcher = isDashboardRoute(location.pathname);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
        setLangDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLanguageChange = (newLang: Language) => {
    if (newLang !== language) {
      setLanguage(newLang);
    }
    setLangDropdownOpen(false);
  };

  const selectedLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  // Use country directly - don't infer from language
  const countryPrefix = country ? `/${country.toLowerCase()}` : '';
  const pathLang = country ? getLanguageForCountryCode(country) : language;
  const paths = pathTranslations[pathLang] || pathTranslations.es;


  return (
    <footer className="bg-brand-dark text-gray-300 footer-always-dark">
      <div className="container mx-auto px-3 sm:px-4 pt-10 sm:pt-12 md:pt-16 pb-6 sm:pb-8">
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-6 sm:gap-8">
          <div className="col-span-2 sm:col-span-2 lg:col-span-1">
             <Link to={countryPrefix || '/'} className="flex items-center gap-2 mb-3 sm:mb-4">
                <span className="text-xl sm:text-2xl font-bold text-white">Opynio</span>
            </Link>
          </div>

          <div>
            <h3 className="font-bold text-white mb-3 sm:mb-4 text-sm sm:text-base">{t('footer.aboutUs')}</h3>
            <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
              <li><Link to={`${countryPrefix}/${paths.about}`} className="hover:text-white transition-colors inline-block">{t('footer.aboutOpynio')}</Link></li>
              <li><Link to={`${countryPrefix}/${paths.howItWorks}`} className="hover:text-white transition-colors inline-block">{t('header.howItWorks')}</Link></li>
              <li><Link to={`${countryPrefix}/${paths.caseStudies}`} className="hover:text-white transition-colors inline-block">{t('header.caseStudies')}</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-white mb-3 sm:mb-4 text-sm sm:text-base">{t('footer.resources')}</h3>
            <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
              <li><Link to={`${countryPrefix}/${paths.faq}`} className="hover:text-white transition-colors inline-block">{t('header.faq')}</Link></li>
              <li><Link to={`${countryPrefix}/${paths.support}`} className="hover:text-white transition-colors inline-block">{t('footer.help')}</Link></li>
              <li><Link to={`${countryPrefix}/${paths.explore}`} className="hover:text-white transition-colors inline-block">{t('header.explore')}</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-white mb-3 sm:mb-4 text-sm sm:text-base">{t('footer.businesses')}</h3>
            <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
              <li><Link to={`${countryPrefix}/${paths.forBusinesses}`} className="hover:text-white transition-colors inline-block">{t('header.forBusinessesMenu')}</Link></li>
              <li><Link to={`${countryPrefix}/${paths.widgets}`} className="hover:text-white transition-colors inline-block">{t('header.widgets')}</Link></li>
              <li><Link to={`${countryPrefix}/${paths.pricing}`} className="hover:text-white transition-colors inline-block">{t('footer.pricingAndPlans')}</Link></li>
            </ul>
          </div>

          <div className="col-span-2 sm:col-span-2 lg:col-span-1">
            <h3 className="font-bold text-white mb-3 sm:mb-4 text-sm sm:text-base">{t('footer.contact')}</h3>
            <p className="text-xs sm:text-sm">
              <a href="mailto:info@opynio.com" className="hover:text-white transition-colors">
                <i className="fa-solid fa-envelope mr-2"></i>info@opynio.com
              </a>
            </p>
          </div>

        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center text-xs sm:text-sm mt-8 sm:mt-10 md:mt-12 pt-6 sm:pt-8 border-t border-gray-700 dark:border-zinc-700 gap-4">
          <p className="text-center sm:text-left">&copy; {new Date().getFullYear()} Opynio. {t('footer.allRightsReserved')}</p>

          {/* Language Selector - Desktop only (hidden on mobile, shown in mobile menu).
              Oculto también en dashboards (URL atada a país de la empresa). */}
          <div className={`${hideLanguageSwitcher ? 'hidden' : 'hidden sm:block'} relative`} ref={langDropdownRef}>
            <button
              onClick={() => setLangDropdownOpen(v => !v)}
              className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors px-3 py-1.5 rounded-full border border-gray-600 hover:border-gray-500 text-sm"
              aria-label={t('header.language')}
            >
              <img src={selectedLang.flag} alt={selectedLang.name} width={20} height={20} loading="lazy" decoding="async" className="w-5 h-5 rounded-full object-cover" />
              <span className="font-medium">{selectedLang.name}</span>
              <i className={`fa-solid fa-chevron-down text-xs transition-transform ${langDropdownOpen ? 'rotate-180' : ''}`}></i>
            </button>
            {langDropdownOpen && (
              <div className="absolute bottom-full mb-2 left-0 w-48 max-h-60 overflow-y-auto bg-white dark:bg-zinc-800 rounded-md shadow-lg py-1 z-50 border border-gray-200 dark:border-zinc-700">
                {LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => handleLanguageChange(lang.code as Language)}
                    className={`w-full text-left flex items-center gap-3 px-4 py-2 text-sm transition-colors ${language === lang.code ? 'font-bold text-brand-green' : 'text-gray-700 dark:text-gray-300'} hover:bg-gray-100 dark:hover:bg-zinc-700`}
                  >
                    <img src={lang.flag} alt={lang.name} width={20} height={20} loading="lazy" decoding="async" className="w-5 h-5 rounded-full object-cover" />
                    <span>{lang.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Enlaces legales - descomentar cuando existan las páginas
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
            <Link to={`${countryPrefix}/${paths.legal}`} className="hover:text-white transition-colors">{t('footer.legalNotice')}</Link>
            <Link to={`${countryPrefix}/${paths.terms}`} className="hover:text-white transition-colors">{t('footer.termsOfUse')}</Link>
            <Link to={`${countryPrefix}/${paths.privacy}`} className="hover:text-white transition-colors">{t('footer.privacy')}</Link>
          </div>
          */}
        </div>

      </div>
    </footer>
  );
};

export default Footer;
