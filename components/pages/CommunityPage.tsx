import React, { useMemo } from 'react';
import Meta from '../Meta';
import { useTranslation } from '../../contexts/i18nContext';
import { COUNTRIES } from '../../constants';
import { useCountry } from '../../contexts/CountryContext';

const CommunityPage: React.FC = () => {
    const t = useTranslation();
    const { country } = useCountry();

    const countryInfo = useMemo(() => COUNTRIES.find(c => c.code === country), [country]);
    const brandName = countryInfo ? `Opynio ${countryInfo.name}` : 'Opynio';
    const metaTitle = `${t('communityPage.communityTitle')} - ${brandName}`;
    const metaDescription = t('meta.communityDesc').replace('Opynio', brandName);
    const communityTitle = t('communityPage.communityTitle').replace('Opynio', brandName);

    return (
        <>
            <Meta
                title={metaTitle}
                description={metaDescription}
            />
            <div className="max-w-4xl mx-auto bg-white dark:bg-zinc-800 p-8 rounded-xl shadow-lg text-center">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-4">{communityTitle}</h1>
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