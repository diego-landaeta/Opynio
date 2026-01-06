import React from 'react';
import Meta from '../Meta';
import { useTranslation } from '../../contexts/i18nContext';
import { COUNTRIES } from '../../constants';
import { useCountry } from '../../contexts/CountryContext';

const CommunityPage: React.FC = () => {
    const t = useTranslation();
    const { country } = useCountry();

    // SEO: Obtener nombre del país para títulos únicos
    const countryName = COUNTRIES.find(c => c.code === country)?.name || '';
    const countryInTitle = countryName ? ` ${t('common.in')} ${countryName}` : '';

    return (
        <>
            <Meta
                title={`${t('communityPage.communityTitle')}${countryInTitle}`}
                description={`${t('meta.communityDesc')}${countryInTitle}.`}
            />
            <div className="max-w-4xl mx-auto bg-white dark:bg-zinc-800 p-8 rounded-xl shadow-lg text-center">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-4">{t('communityPage.communityTitle')}{countryInTitle}</h1>
                <i className="fa-solid fa-users-line text-6xl text-brand-green mb-6"></i>
                <p className="text-gray-600 dark:text-gray-300 text-lg">
                    {t('communityPage.underConstruction')}
                </p>
                <p className="text-gray-500 dark:text-gray-400 mt-2">
                    {t('communityPage.comingSoonCommunity')}
                </p>
            </div>
        </>
    );
};

export default CommunityPage;