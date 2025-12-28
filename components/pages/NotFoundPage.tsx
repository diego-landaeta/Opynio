import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useI18n, useTranslation, pathTranslations } from '../../contexts/i18nContext';
import Meta from '../Meta';

const NotFoundPage: React.FC = () => {
    const { language } = useI18n();
    const t = useTranslation();
    const location = useLocation();

    // Log 404 for debugging
    useEffect(() => {
        console.log(`🚫 404 Page: ${location.pathname}`);
    }, [location.pathname]);

    return (
        <>
            <Meta
                title={`404 - ${t('notFoundPage.title')}`}
                description={t('notFoundPage.subtitle')}
                noindex={true}
            />
        <div className="flex flex-col items-center justify-center text-center py-20">
            <h1 className="text-8xl md:text-9xl font-extrabold text-brand-green">
                404
            </h1>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 dark:text-gray-100 mt-4">
                {t('notFoundPage.title')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-2 max-w-md">
                {t('notFoundPage.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 mt-8">
                <Link
                    to="/"
                    className="w-full sm:w-auto bg-brand-green text-white font-semibold px-6 py-3 rounded-lg hover:bg-opacity-90 transition-all shadow-md"
                >
                    {t('notFoundPage.backToHome')}
                </Link>
                <Link
                    to={`/${pathTranslations[language].businesses}`}
                    className="w-full sm:w-auto bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-200 font-semibold px-6 py-3 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600 transition-all"
                >
                    {t('notFoundPage.exploreBusinesses')}
                </Link>
            </div>
        </div>
        </>
    );
};

export default NotFoundPage;