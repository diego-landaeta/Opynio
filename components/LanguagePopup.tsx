import React, { useState, useEffect, useMemo } from 'react';
import { useI18n, Language, getLanguageForCountryCode } from '../contexts/i18nContext';
import { useCountry } from '../contexts/CountryContext';
import { LANGUAGES, COUNTRIES } from '../constants';
import { useLocation } from 'react-router-dom';

const FIRST_VISIT_KEY = 'opynio_first_visit';
const COUNTRY_LANGUAGE_PROMPT_KEY = 'opynio_country_lang_prompt';
const LAST_URL_COUNTRY_KEY = 'opynio_last_url_country';
const INTERNAL_NAV_KEY = 'opynio_internal_nav';

// Helper function to mark navigation as internal (called before navigating to a country)
export const markInternalNavigation = () => {
    sessionStorage.setItem(INTERNAL_NAV_KEY, 'true');
};

// Translations for the popup based on browser language
const popupTranslations: Record<string, {
    welcome: string;
    selectLanguage: string;
    changeLanguageHint: string;
    countryDetected: string;
    changeToLanguage: string;
    keepCurrentLanguage: string;
}> = {
    es: {
        welcome: '¡Bienvenido a Opynio!',
        selectLanguage: 'Selecciona tu idioma preferido',
        changeLanguageHint: 'Puedes cambiar el idioma en cualquier momento desde el pie de página',
        countryDetected: 'Has entrado a Opynio {country}',
        changeToLanguage: 'Cambiar a {language}',
        keepCurrentLanguage: 'Mantener idioma actual',
    },
    en: {
        welcome: 'Welcome to Opynio!',
        selectLanguage: 'Select your preferred language',
        changeLanguageHint: 'You can change the language anytime from the footer',
        countryDetected: 'You have entered Opynio {country}',
        changeToLanguage: 'Switch to {language}',
        keepCurrentLanguage: 'Keep current language',
    },
    pt: {
        welcome: 'Bem-vindo ao Opynio!',
        selectLanguage: 'Selecione seu idioma preferido',
        changeLanguageHint: 'Você pode alterar o idioma a qualquer momento no rodapé',
        countryDetected: 'Você entrou no Opynio {country}',
        changeToLanguage: 'Mudar para {language}',
        keepCurrentLanguage: 'Manter idioma atual',
    },
    fr: {
        welcome: 'Bienvenue sur Opynio!',
        selectLanguage: 'Sélectionnez votre langue préférée',
        changeLanguageHint: 'Vous pouvez changer la langue à tout moment depuis le pied de page',
        countryDetected: 'Vous êtes entré dans Opynio {country}',
        changeToLanguage: 'Passer à {language}',
        keepCurrentLanguage: 'Garder la langue actuelle',
    },
    de: {
        welcome: 'Willkommen bei Opynio!',
        selectLanguage: 'Wählen Sie Ihre bevorzugte Sprache',
        changeLanguageHint: 'Sie können die Sprache jederzeit in der Fußzeile ändern',
        countryDetected: 'Sie haben Opynio {country} betreten',
        changeToLanguage: 'Zu {language} wechseln',
        keepCurrentLanguage: 'Aktuelle Sprache beibehalten',
    },
    it: {
        welcome: 'Benvenuto su Opynio!',
        selectLanguage: 'Seleziona la tua lingua preferita',
        changeLanguageHint: 'Puoi cambiare la lingua in qualsiasi momento dal piè di pagina',
        countryDetected: 'Sei entrato in Opynio {country}',
        changeToLanguage: 'Passa a {language}',
        keepCurrentLanguage: 'Mantieni lingua attuale',
    },
    ca: {
        welcome: 'Benvingut a Opynio!',
        selectLanguage: 'Selecciona el teu idioma preferit',
        changeLanguageHint: 'Pots canviar l\'idioma en qualsevol moment des del peu de pàgina',
        countryDetected: 'Has entrat a Opynio {country}',
        changeToLanguage: 'Canviar a {language}',
        keepCurrentLanguage: 'Mantenir idioma actual',
    },
    zh: {
        welcome: '欢迎来到 Opynio!',
        selectLanguage: '选择您的首选语言',
        changeLanguageHint: '您可以随时从页脚更改语言',
        countryDetected: '您已进入 Opynio {country}',
        changeToLanguage: '切换到{language}',
        keepCurrentLanguage: '保持当前语言',
    },
    sv: {
        welcome: 'Välkommen till Opynio!',
        selectLanguage: 'Välj ditt föredragna språk',
        changeLanguageHint: 'Du kan när som helst ändra språk i sidfoten',
        countryDetected: 'Du har gått in på Opynio {country}',
        changeToLanguage: 'Byt till {language}',
        keepCurrentLanguage: 'Behåll nuvarande språk',
    },
    pl: {
        welcome: 'Witamy w Opynio!',
        selectLanguage: 'Wybierz preferowany język',
        changeLanguageHint: 'Możesz zmienić język w dowolnym momencie w stopce',
        countryDetected: 'Wszedłeś do Opynio {country}',
        changeToLanguage: 'Przełącz na {language}',
        keepCurrentLanguage: 'Zachowaj obecny język',
    },
    ja: {
        welcome: 'Opynioへようこそ!',
        selectLanguage: 'お好みの言語を選択してください',
        changeLanguageHint: 'フッターからいつでも言語を変更できます',
        countryDetected: 'Opynio {country}に入りました',
        changeToLanguage: '{language}に切り替え',
        keepCurrentLanguage: '現在の言語を維持',
    },
};

// Language names in different languages
const languageNames: Record<string, Record<string, string>> = {
    es: { es: 'Español', en: 'Inglés', br: 'Portugués (BR)', pt: 'Portugués (PT)', fr: 'Francés', de: 'Alemán', it: 'Italiano', ca: 'Catalán', cn: 'Chino', sv: 'Sueco', pl: 'Polaco', ja: 'Japonés' },
    en: { es: 'Spanish', en: 'English', br: 'Portuguese (BR)', pt: 'Portuguese (PT)', fr: 'French', de: 'German', it: 'Italian', ca: 'Catalan', cn: 'Chinese', sv: 'Swedish', pl: 'Polish', ja: 'Japanese' },
    pt: { es: 'Espanhol', en: 'Inglês', br: 'Português (BR)', pt: 'Português (PT)', fr: 'Francês', de: 'Alemão', it: 'Italiano', ca: 'Catalão', cn: 'Chinês', sv: 'Sueco', pl: 'Polonês', ja: 'Japonês' },
    br: { es: 'Espanhol', en: 'Inglês', br: 'Português (BR)', pt: 'Português (PT)', fr: 'Francês', de: 'Alemão', it: 'Italiano', ca: 'Catalão', cn: 'Chinês', sv: 'Sueco', pl: 'Polonês', ja: 'Japonês' },
    fr: { es: 'Espagnol', en: 'Anglais', br: 'Portugais (BR)', pt: 'Portugais (PT)', fr: 'Français', de: 'Allemand', it: 'Italien', ca: 'Catalan', cn: 'Chinois', sv: 'Suédois', pl: 'Polonais', ja: 'Japonais' },
    de: { es: 'Spanisch', en: 'Englisch', br: 'Portugiesisch (BR)', pt: 'Portugiesisch (PT)', fr: 'Französisch', de: 'Deutsch', it: 'Italienisch', ca: 'Katalanisch', cn: 'Chinesisch', sv: 'Schwedisch', pl: 'Polnisch', ja: 'Japanisch' },
    it: { es: 'Spagnolo', en: 'Inglese', br: 'Portoghese (BR)', pt: 'Portoghese (PT)', fr: 'Francese', de: 'Tedesco', it: 'Italiano', ca: 'Catalano', cn: 'Cinese', sv: 'Svedese', pl: 'Polacco', ja: 'Giapponese' },
    ca: { es: 'Espanyol', en: 'Anglès', br: 'Portuguès (BR)', pt: 'Portuguès (PT)', fr: 'Francès', de: 'Alemany', it: 'Italià', ca: 'Català', cn: 'Xinès', sv: 'Suec', pl: 'Polonès', ja: 'Japonès' },
    zh: { es: '西班牙语', en: '英语', br: '葡萄牙语 (BR)', pt: '葡萄牙语 (PT)', fr: '法语', de: '德语', it: '意大利语', ca: '加泰罗尼亚语', cn: '中文', sv: '瑞典语', pl: '波兰语', ja: '日语' },
    cn: { es: '西班牙语', en: '英语', br: '葡萄牙语 (BR)', pt: '葡萄牙语 (PT)', fr: '法语', de: '德语', it: '意大利语', ca: '加泰罗尼亚语', cn: '中文', sv: '瑞典语', pl: '波兰语', ja: '日语' },
    sv: { es: 'Spanska', en: 'Engelska', br: 'Portugisiska (BR)', pt: 'Portugisiska (PT)', fr: 'Franska', de: 'Tyska', it: 'Italienska', ca: 'Katalanska', cn: 'Kinesiska', sv: 'Svenska', pl: 'Polska', ja: 'Japanska' },
    pl: { es: 'Hiszpański', en: 'Angielski', br: 'Portugalski (BR)', pt: 'Portugalski (PT)', fr: 'Francuski', de: 'Niemiecki', it: 'Włoski', ca: 'Kataloński', cn: 'Chiński', sv: 'Szwedzki', pl: 'Polski', ja: 'Japoński' },
    ja: { es: 'スペイン語', en: '英語', br: 'ポルトガル語 (BR)', pt: 'ポルトガル語 (PT)', fr: 'フランス語', de: 'ドイツ語', it: 'イタリア語', ca: 'カタルーニャ語', cn: '中国語', sv: 'スウェーデン語', pl: 'ポーランド語', ja: '日本語' },
};

// Country names in different languages
const countryNames: Record<string, Record<string, string>> = {
    es: { ES: 'España', MX: 'México', AR: 'Argentina', CO: 'Colombia', CL: 'Chile', PE: 'Perú', VE: 'Venezuela', EC: 'Ecuador', GT: 'Guatemala', CR: 'Costa Rica', PA: 'Panamá', UY: 'Uruguay', US: 'Estados Unidos', GB: 'Reino Unido', BR: 'Brasil', PT: 'Portugal', FR: 'Francia', DE: 'Alemania', IT: 'Italia', AD: 'Andorra', SE: 'Suecia', PL: 'Polonia', JP: 'Japón' },
    en: { ES: 'Spain', MX: 'Mexico', AR: 'Argentina', CO: 'Colombia', CL: 'Chile', PE: 'Peru', VE: 'Venezuela', EC: 'Ecuador', GT: 'Guatemala', CR: 'Costa Rica', PA: 'Panama', UY: 'Uruguay', US: 'United States', GB: 'United Kingdom', BR: 'Brazil', PT: 'Portugal', FR: 'France', DE: 'Germany', IT: 'Italy', AD: 'Andorra', SE: 'Sweden', PL: 'Poland', JP: 'Japan' },
    pt: { ES: 'Espanha', MX: 'México', AR: 'Argentina', CO: 'Colômbia', CL: 'Chile', PE: 'Peru', VE: 'Venezuela', EC: 'Equador', GT: 'Guatemala', CR: 'Costa Rica', PA: 'Panamá', UY: 'Uruguai', US: 'Estados Unidos', GB: 'Reino Unido', BR: 'Brasil', PT: 'Portugal', FR: 'França', DE: 'Alemanha', IT: 'Itália', AD: 'Andorra', SE: 'Suécia', PL: 'Polônia', JP: 'Japão' },
    br: { ES: 'Espanha', MX: 'México', AR: 'Argentina', CO: 'Colômbia', CL: 'Chile', PE: 'Peru', VE: 'Venezuela', EC: 'Equador', GT: 'Guatemala', CR: 'Costa Rica', PA: 'Panamá', UY: 'Uruguai', US: 'Estados Unidos', GB: 'Reino Unido', BR: 'Brasil', PT: 'Portugal', FR: 'França', DE: 'Alemanha', IT: 'Itália', AD: 'Andorra', SE: 'Suécia', PL: 'Polônia', JP: 'Japão' },
    fr: { ES: 'Espagne', MX: 'Mexique', AR: 'Argentine', CO: 'Colombie', CL: 'Chili', PE: 'Pérou', VE: 'Venezuela', EC: 'Équateur', GT: 'Guatemala', CR: 'Costa Rica', PA: 'Panama', UY: 'Uruguay', US: 'États-Unis', GB: 'Royaume-Uni', BR: 'Brésil', PT: 'Portugal', FR: 'France', DE: 'Allemagne', IT: 'Italie', AD: 'Andorre', SE: 'Suède', PL: 'Pologne', JP: 'Japon' },
    de: { ES: 'Spanien', MX: 'Mexiko', AR: 'Argentinien', CO: 'Kolumbien', CL: 'Chile', PE: 'Peru', VE: 'Venezuela', EC: 'Ecuador', GT: 'Guatemala', CR: 'Costa Rica', PA: 'Panama', UY: 'Uruguay', US: 'Vereinigte Staaten', GB: 'Vereinigtes Königreich', BR: 'Brasilien', PT: 'Portugal', FR: 'Frankreich', DE: 'Deutschland', IT: 'Italien', AD: 'Andorra', SE: 'Schweden', PL: 'Polen', JP: 'Japan' },
    it: { ES: 'Spagna', MX: 'Messico', AR: 'Argentina', CO: 'Colombia', CL: 'Cile', PE: 'Perù', VE: 'Venezuela', EC: 'Ecuador', GT: 'Guatemala', CR: 'Costa Rica', PA: 'Panama', UY: 'Uruguay', US: 'Stati Uniti', GB: 'Regno Unito', BR: 'Brasile', PT: 'Portogallo', FR: 'Francia', DE: 'Germania', IT: 'Italia', AD: 'Andorra', SE: 'Svezia', PL: 'Polonia', JP: 'Giappone' },
    ca: { ES: 'Espanya', MX: 'Mèxic', AR: 'Argentina', CO: 'Colòmbia', CL: 'Xile', PE: 'Perú', VE: 'Veneçuela', EC: 'Equador', GT: 'Guatemala', CR: 'Costa Rica', PA: 'Panamà', UY: 'Uruguai', US: 'Estats Units', GB: 'Regne Unit', BR: 'Brasil', PT: 'Portugal', FR: 'França', DE: 'Alemanya', IT: 'Itàlia', AD: 'Andorra', SE: 'Suècia', PL: 'Polònia', JP: 'Japó' },
    sv: { ES: 'Spanien', MX: 'Mexiko', AR: 'Argentina', CO: 'Colombia', CL: 'Chile', PE: 'Peru', VE: 'Venezuela', EC: 'Ecuador', GT: 'Guatemala', CR: 'Costa Rica', PA: 'Panama', UY: 'Uruguay', US: 'USA', GB: 'Storbritannien', BR: 'Brasilien', PT: 'Portugal', FR: 'Frankrike', DE: 'Tyskland', IT: 'Italien', AD: 'Andorra', SE: 'Sverige', PL: 'Polen', JP: 'Japan' },
    pl: { ES: 'Hiszpania', MX: 'Meksyk', AR: 'Argentyna', CO: 'Kolumbia', CL: 'Chile', PE: 'Peru', VE: 'Wenezuela', EC: 'Ekwador', GT: 'Gwatemala', CR: 'Kostaryka', PA: 'Panama', UY: 'Urugwaj', US: 'Stany Zjednoczone', GB: 'Wielka Brytania', BR: 'Brazylia', PT: 'Portugalia', FR: 'Francja', DE: 'Niemcy', IT: 'Włochy', AD: 'Andora', SE: 'Szwecja', PL: 'Polska', JP: 'Japonia' },
    ja: { ES: 'スペイン', MX: 'メキシコ', AR: 'アルゼンチン', CO: 'コロンビア', CL: 'チリ', PE: 'ペルー', VE: 'ベネズエラ', EC: 'エクアドル', GT: 'グアテマラ', CR: 'コスタリカ', PA: 'パナマ', UY: 'ウルグアイ', US: 'アメリカ合衆国', GB: 'イギリス', BR: 'ブラジル', PT: 'ポルトガル', FR: 'フランス', DE: 'ドイツ', IT: 'イタリア', AD: 'アンドラ', SE: 'スウェーデン', PL: 'ポーランド', JP: '日本' },
};

type PopupMode = 'first_visit' | 'country_change' | null;

const LanguagePopup: React.FC = () => {
    const { language, setLanguage } = useI18n();
    const { setCountry } = useCountry();
    const location = useLocation();
    const [isVisible, setIsVisible] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [popupMode, setPopupMode] = useState<PopupMode>(null);
    const [suggestedLanguage, setSuggestedLanguage] = useState<Language | null>(null);
    const [detectedCountryCode, setDetectedCountryCode] = useState<string | null>(null);

    // Get country code from URL
    const urlCountryCode = useMemo(() => {
        const pathParts = location.pathname.split('/').filter(Boolean);
        if (pathParts.length > 0) {
            const potentialCountry = pathParts[0].toUpperCase();
            if (COUNTRIES.some(c => c.code === potentialCountry)) {
                return potentialCountry;
            }
        }
        return null;
    }, [location.pathname]);

    // Detect browser language for popup text
    const browserLang = useMemo(() => {
        const lang = navigator.language.toLowerCase().split('-')[0];
        return lang;
    }, []);

    const currentLangTexts = useMemo(() => {
        return popupTranslations[language] || popupTranslations[browserLang] || popupTranslations.es;
    }, [language, browserLang]);

    // Effect for handling language based on URL country
    // - Direct entry (URL typed, page refresh, external link) → auto-set language
    // - Internal navigation (clicking country button in app) → show popup asking to change
    useEffect(() => {
        if (!urlCountryCode) {
            // No country in URL - show language selection popup for first visit
            const hasVisited = localStorage.getItem(FIRST_VISIT_KEY);
            if (!hasVisited) {
                const timer = setTimeout(() => {
                    setPopupMode('first_visit');
                    setIsVisible(true);
                }, 500);
                return () => clearTimeout(timer);
            }
            return;
        }

        const countryLanguage = getLanguageForCountryCode(urlCountryCode);
        const lastUrlCountry = sessionStorage.getItem(LAST_URL_COUNTRY_KEY);
        const isInternalNav = sessionStorage.getItem(INTERNAL_NAV_KEY) === 'true';

        // Clear internal nav flag after reading
        sessionStorage.removeItem(INTERNAL_NAV_KEY);

        // Country changed?
        const countryChanged = lastUrlCountry !== urlCountryCode;

        if (countryChanged) {
            // Save the new country
            sessionStorage.setItem(LAST_URL_COUNTRY_KEY, urlCountryCode);
            localStorage.setItem(FIRST_VISIT_KEY, 'true');

            if (isInternalNav) {
                // Internal navigation (clicked country button) - show popup if language differs
                if (countryLanguage !== language) {
                    setSuggestedLanguage(countryLanguage);
                    setDetectedCountryCode(urlCountryCode);
                    setPopupMode('country_change');
                    setIsVisible(true);
                }
                // Update country context regardless
                setCountry(urlCountryCode as any);
            } else {
                // Direct entry (URL typed, page load, external link) - auto-set language
                setLanguage(countryLanguage);
                setCountry(urlCountryCode as any);
            }
        }
    }, [urlCountryCode, setLanguage, setCountry, language]);

    const handleLanguageSelect = (lang: Language) => {
        setLanguage(lang);
        localStorage.setItem(FIRST_VISIT_KEY, 'true');
        closePopup();
    };

    const handleChangeLanguage = () => {
        if (suggestedLanguage) {
            setLanguage(suggestedLanguage);
            if (detectedCountryCode) {
                setCountry(detectedCountryCode as any);
            }
        }
        closePopup();
    };

    const handleKeepLanguage = () => {
        closePopup();
    };

    const closePopup = () => {
        setIsClosing(true);
        setTimeout(() => {
            setIsVisible(false);
            setIsClosing(false);
            setPopupMode(null);
            setSuggestedLanguage(null);
            setDetectedCountryCode(null);
        }, 300);
    };

    const handleClose = () => {
        if (popupMode === 'first_visit') {
            localStorage.setItem(FIRST_VISIT_KEY, 'true');
        }
        closePopup();
    };

    if (!isVisible) return null;

    // Get country info
    const countryInfo = detectedCountryCode ? COUNTRIES.find(c => c.code === detectedCountryCode) : null;
    const suggestedLanguageName = suggestedLanguage ? (languageNames[language]?.[suggestedLanguage] || suggestedLanguage) : '';
    const suggestedLangInfo = suggestedLanguage ? LANGUAGES.find(l => l.code === suggestedLanguage) : null;
    // Get translated country name based on current language
    const translatedCountryName = detectedCountryCode ? (countryNames[language]?.[detectedCountryCode] || countryInfo?.name || detectedCountryCode) : '';

    // Country change popup
    if (popupMode === 'country_change' && countryInfo && suggestedLanguage) {
        return (
            <div
                className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`}
                onClick={handleClose}
            >
                <div
                    className={`bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl max-w-md w-[90%] mx-4 overflow-hidden transform transition-all duration-300 ${isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="bg-gradient-to-r from-brand-green to-green-600 p-5 sm:p-6 text-center">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-full mx-auto flex items-center justify-center mb-3 shadow-lg overflow-hidden">
                            <img
                                src={countryInfo.flag}
                                alt={translatedCountryName}
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">
                            {currentLangTexts.countryDetected.replace('{country}', translatedCountryName)}
                        </h2>
                    </div>

                    {/* Options */}
                    <div className="p-5 sm:p-6 space-y-3">
                        {/* Change language button */}
                        <button
                            onClick={handleChangeLanguage}
                            className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-brand-green text-white font-semibold hover:bg-brand-green/90 transition-all"
                        >
                            {suggestedLangInfo && (
                                <img
                                    src={suggestedLangInfo.flag}
                                    alt={suggestedLangInfo.name}
                                    className="w-8 h-8 rounded-full object-cover shadow-sm ring-2 ring-white/30"
                                />
                            )}
                            <span>{currentLangTexts.changeToLanguage.replace('{language}', suggestedLanguageName)}</span>
                        </button>

                        {/* Keep current language button */}
                        <button
                            onClick={handleKeepLanguage}
                            className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-gray-200 dark:border-zinc-600 text-gray-700 dark:text-gray-200 font-medium hover:border-gray-300 dark:hover:border-zinc-500 hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition-all"
                        >
                            <span>{currentLangTexts.keepCurrentLanguage}</span>
                        </button>
                    </div>

                    {/* Footer hint */}
                    <div className="bg-gray-50 dark:bg-zinc-900 px-4 sm:px-6 py-3 sm:py-4 border-t dark:border-zinc-700">
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-center">
                            <i className="fa-solid fa-info-circle mr-1.5"></i>
                            {currentLangTexts.changeLanguageHint}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // First visit popup (original)
    return (
        <div
            className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`}
            onClick={handleClose}
        >
            <div
                className={`bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl max-w-md w-[90%] mx-4 overflow-hidden transform transition-all duration-300 ${isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-brand-green to-green-600 p-5 sm:p-6 text-center">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-full mx-auto flex items-center justify-center mb-3 shadow-lg">
                        <i className="fa-solid fa-globe text-brand-green text-2xl sm:text-3xl"></i>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">
                        {currentLangTexts.welcome}
                    </h2>
                    <p className="text-green-100 text-sm sm:text-base">
                        {currentLangTexts.selectLanguage}
                    </p>
                </div>

                {/* Language Grid */}
                <div className="p-4 sm:p-6">
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                        {LANGUAGES.map((lang) => (
                            <button
                                key={lang.code}
                                onClick={() => handleLanguageSelect(lang.code as Language)}
                                className="flex items-center gap-3 p-3 sm:p-4 rounded-xl border-2 border-gray-200 dark:border-zinc-600 hover:border-brand-green hover:bg-brand-green/5 dark:hover:bg-brand-green/10 transition-all duration-200 group"
                            >
                                <img
                                    src={lang.flag}
                                    alt={lang.name}
                                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover shadow-sm ring-2 ring-white dark:ring-zinc-700"
                                    loading="lazy"
                                />
                                <span className="font-semibold text-gray-700 dark:text-gray-200 group-hover:text-brand-green transition-colors text-sm sm:text-base">
                                    {lang.name}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Footer hint */}
                <div className="bg-gray-50 dark:bg-zinc-900 px-4 sm:px-6 py-3 sm:py-4 border-t dark:border-zinc-700">
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-center">
                        <i className="fa-solid fa-info-circle mr-1.5"></i>
                        {currentLangTexts.changeLanguageHint}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LanguagePopup;
