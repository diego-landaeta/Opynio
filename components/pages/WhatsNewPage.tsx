
import React, { useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import Meta from '../Meta';
import { useTranslation, useI18n, pathTranslations } from '../../contexts/i18nContext';
import { COUNTRIES } from '../../constants';
import { useCountry } from '../../contexts/CountryContext';

interface Feature {
    icon: string;
    color: string;
    bgColor: string;
    titleKey: string;
    descriptionKey: string;
}

interface Update {
    version: string;
    dateKey: string;
    titleKey: string;
    features: Feature[];
}

export const updates: Update[] = [
    {
        version: '1.6.0',
        dateKey: 'whatsNew.whatsNew_v1_6_0_date',
        titleKey: 'whatsNew.whatsNew_v1_6_0_title',
        features: [
            {
                titleKey: "whatsNew.whatsNew_v1_6_0_f1_title",
                icon: "fa-solid fa-globe",
                color: "text-brand-green",
                bgColor: "bg-brand-green/10",
                descriptionKey: "whatsNew.whatsNew_v1_6_0_f1_desc"
            },
            {
                titleKey: "whatsNew.whatsNew_v1_6_0_f2_title",
                icon: "fa-solid fa-filter",
                color: "text-blue-600",
                bgColor: "bg-blue-100 dark:bg-blue-900/30",
                descriptionKey: "whatsNew.whatsNew_v1_6_0_f2_desc"
            },
            {
                titleKey: "whatsNew.whatsNew_v1_6_0_f3_title",
                icon: "fa-solid fa-earth-americas",
                color: "text-teal-600",
                bgColor: "bg-teal-100 dark:bg-teal-900/30",
                descriptionKey: "whatsNew.whatsNew_v1_6_0_f3_desc"
            },
            {
                titleKey: "whatsNew.whatsNew_v1_6_0_f4_title",
                icon: "fa-solid fa-building",
                color: "text-purple-600",
                bgColor: "bg-purple-100 dark:bg-purple-900/30",
                descriptionKey: "whatsNew.whatsNew_v1_6_0_f4_desc"
            },
            {
                titleKey: "whatsNew.whatsNew_v1_6_0_f5_title",
                icon: "fa-solid fa-magnifying-glass-chart",
                color: "text-orange-600",
                bgColor: "bg-orange-100 dark:bg-orange-900/30",
                descriptionKey: "whatsNew.whatsNew_v1_6_0_f5_desc"
            }
        ]
    },
    {
        version: '1.5.1',
        dateKey: 'whatsNew.whatsNew_v1_5_1_date',
        titleKey: 'whatsNew.whatsNew_v1_5_1_title',
        features: [
            {
                titleKey: "whatsNew.whatsNew_v1_5_1_f1_title",
                icon: "fa-solid fa-code",
                color: "text-blue-600",
                bgColor: "bg-blue-100 dark:bg-blue-900/30",
                descriptionKey: "whatsNew.whatsNew_v1_5_1_f1_desc"
            },
            {
                titleKey: "whatsNew.whatsNew_v1_5_1_f2_title",
                icon: "fa-solid fa-list-check",
                color: "text-sky-600",
                bgColor: "bg-sky-100 dark:bg-sky-900/30",
                descriptionKey: "whatsNew.whatsNew_v1_5_1_f2_desc"
            },
            {
                titleKey: "whatsNew.whatsNew_v1_5_1_f3_title",
                icon: "fa-solid fa-handshake",
                color: "text-green-600",
                bgColor: "bg-green-100 dark:bg-green-900/30",
                descriptionKey: "whatsNew.whatsNew_v1_5_1_f3_desc"
            },
            {
                titleKey: "whatsNew.whatsNew_v1_5_1_f4_title",
                icon: "fa-solid fa-share-nodes",
                color: "text-orange-600",
                bgColor: "bg-orange-100 dark:bg-orange-900/30",
                descriptionKey: "whatsNew.whatsNew_v1_5_1_f4_desc"
            }
        ]
    },
    {
        version: '1.5.0',
        dateKey: 'whatsNew.whatsNew_v1_5_0_date',
        titleKey: 'whatsNew.whatsNew_v1_5_0_title',
        features: [
            {
                titleKey: "whatsNew.whatsNew_v1_5_0_f1_title",
                icon: "fa-solid fa-life-ring",
                color: "text-red-600",
                bgColor: "bg-red-100 dark:bg-red-900/30",
                descriptionKey: "whatsNew.whatsNew_v1_5_0_f1_desc"
            },
            {
                titleKey: "whatsNew.whatsNew_v1_5_0_f2_title",
                icon: "fa-solid fa-arrow-right-to-city",
                color: "text-teal-600",
                bgColor: "bg-teal-100 dark:bg-teal-900/30",
                descriptionKey: "whatsNew.whatsNew_v1_5_0_f2_desc"
            },
            {
                titleKey: "whatsNew.whatsNew_v1_5_0_f3_title",
                icon: "fa-solid fa-user-pen",
                color: "text-purple-600",
                bgColor: "bg-purple-100 dark:bg-purple-900/30",
                descriptionKey: "whatsNew.whatsNew_v1_5_0_f3_desc"
            }
        ]
    },
    {
        version: '1.0.0',
        dateKey: 'whatsNew.whatsNew_v1_0_0_date',
        titleKey: 'whatsNew.whatsNew_v1_0_0_title',
        features: [
            {
                titleKey: "whatsNew.whatsNew_v1_0_0_f1_title",
                icon: "fa-brands fa-google",
                color: "text-blue-600",
                bgColor: "bg-blue-100 dark:bg-blue-900/30",
                descriptionKey: "whatsNew.whatsNew_v1_0_0_f1_desc",
            },
            {
                titleKey: "whatsNew.whatsNew_v1_0_0_f2_title",
                icon: "fa-solid fa-palette",
                color: "text-indigo-600",
                bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
                descriptionKey: "whatsNew.whatsNew_v1_0_0_f2_desc",
            },
            {
                titleKey: "whatsNew.whatsNew_v1_0_0_f3_title",
                icon: "fa-solid fa-rocket",
                color: "text-green-600",
                bgColor: "bg-green-100 dark:bg-green-900/30",
                descriptionKey: "whatsNew.whatsNew_v1_0_0_f3_desc",
            }
        ]
    },
    {
        version: '0.8.0',
        dateKey: 'whatsNew.whatsNew_v0_8_0_date',
        titleKey: 'whatsNew.whatsNew_v0_8_0_title',
        features: [
             {
                titleKey: "whatsNew.whatsNew_v0_8_0_f1_title",
                icon: "fa-solid fa-microphone-lines",
                color: "text-brand-green",
                bgColor: "bg-brand-green/10",
                descriptionKey: "whatsNew.whatsNew_v0_8_0_f1_desc",
            },
            {
                titleKey: "whatsNew.whatsNew_v0_8_0_f2_title",
                icon: "fa-solid fa-map-location-dot",
                color: "text-blue-600",
                bgColor: "bg-blue-100 dark:bg-blue-900/30",
                descriptionKey: "whatsNew.whatsNew_v0_8_0_f2_desc",
            },
            {
                titleKey: "whatsNew.whatsNew_v0_8_0_f3_title",
                icon: "fa-solid fa-chart-line",
                color: "text-sky-600",
                bgColor: "bg-sky-100 dark:bg-sky-900/30",
                descriptionKey: "whatsNew.whatsNew_v0_8_0_f3_desc",
            },
             {
                titleKey: "whatsNew.whatsNew_v0_8_0_f4_title",
                icon: "fa-solid fa-shield-halved",
                color: "text-red-600",
                bgColor: "bg-red-100 dark:bg-red-900/30",
                descriptionKey: "whatsNew.whatsNew_v0_8_0_f4_desc",
            },
        ]
    }
];

// Feature Card Component
const FeatureCard: React.FC<{ feature: Feature; t: (key: string) => string }> = ({ feature, t }) => (
    <div className="group bg-white dark:bg-zinc-800 rounded-xl p-4 sm:p-5 border border-gray-100 dark:border-zinc-700 hover:border-brand-green/30 dark:hover:border-brand-green/30 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
        <div className="flex items-start gap-4">
            <div className={`${feature.bgColor} ${feature.color} w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                <i className={`${feature.icon} text-xl sm:text-2xl`}></i>
            </div>
            <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm sm:text-base mb-1 group-hover:text-brand-green transition-colors">
                    {t(feature.titleKey)}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm leading-relaxed">
                    {t(feature.descriptionKey)}
                </p>
            </div>
        </div>
    </div>
);


const WhatsNewPage: React.FC = () => {
    const t = useTranslation();
    const { language } = useI18n();
    const { country } = useCountry();

    const countryInfo = useMemo(() => COUNTRIES.find(c => c.code === country), [country]);
    const brandName = countryInfo ? `Opynio ${countryInfo.name}` : 'Opynio';
    const metaTitle = `${t('meta.whatsNewTitle')} - ${brandName}`;
    const metaDescription = t('whatsNew.subtitle').replace('Opynio', brandName);
    const countryPrefix = country ? `/${country.toLowerCase()}` : '';

    return (
        <>
            <Meta
                title={metaTitle}
                description={metaDescription}
            />
            <div className="max-w-5xl mx-auto space-y-10 sm:space-y-16">
                {/* Hero Section */}
                <section className="relative text-center py-8 sm:py-12 px-4 rounded-2xl sm:rounded-3xl overflow-hidden">
                    {/* Background gradient */}
                    <div className="absolute inset-0 bg-gradient-to-br from-brand-green/10 via-transparent to-blue-500/10 dark:from-brand-green/20 dark:to-blue-500/20" />
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-green/5 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl" />

                    {/* Content */}
                    <div className="relative z-10">
                        <span className="inline-flex items-center gap-2 bg-brand-green/10 dark:bg-brand-green/20 text-brand-green px-4 py-2 rounded-full text-sm font-semibold mb-4 animate-pulse">
                            <i className="fa-solid fa-sparkles"></i>
                            {t('whatsNew.newVersionAvailable')}
                        </span>
                        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-4">
                            {t('whatsNew.title')}
                        </h1>
                        <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                            {t('whatsNew.subtitle')}
                        </p>
                    </div>
                </section>

                {/* Timeline */}
                <div className="relative">
                    {/* Vertical line - hidden on mobile */}
                    <div className="hidden md:block absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-brand-green via-blue-500 to-gray-300 dark:to-zinc-700" />

                    {/* Updates */}
                    <div className="space-y-8 sm:space-y-12">
                        {updates.map((update, index) => (
                            <div key={update.version} className={`relative md:pl-20`}>
                                {/* Version circle - hidden on mobile */}
                                <div className={`hidden md:flex absolute left-0 w-16 h-16 rounded-full items-center justify-center shadow-lg border-4 border-white dark:border-zinc-900 ${
                                    index === 0
                                        ? 'bg-gradient-to-br from-brand-green to-green-600 text-white'
                                        : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400'
                                }`}>
                                    <span className="text-sm font-bold">v{update.version}</span>
                                </div>

                                {/* Update card */}
                                <div className={`rounded-2xl sm:rounded-3xl overflow-hidden ${
                                    index === 0
                                        ? 'bg-gradient-to-br from-brand-green/5 to-blue-500/5 dark:from-brand-green/10 dark:to-blue-500/10 border-2 border-brand-green/20 shadow-xl'
                                        : 'bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 shadow-sm'
                                }`}>
                                    {/* Card header */}
                                    <div className={`px-5 sm:px-6 md:px-8 py-4 sm:py-5 ${
                                        index === 0
                                            ? 'bg-gradient-to-r from-brand-green/10 to-transparent dark:from-brand-green/20'
                                            : 'bg-gray-50 dark:bg-zinc-900/50'
                                    }`}>
                                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                            {index === 0 && (
                                                <span className="inline-flex items-center gap-1.5 bg-brand-green text-white text-xs font-bold px-3 py-1 rounded-full">
                                                    <i className="fa-solid fa-star text-[10px]"></i>
                                                    {t('whatsNew.latestVersion')}
                                                </span>
                                            )}
                                            <span className={`text-xs sm:text-sm font-bold px-3 py-1 rounded-full ${
                                                index === 0
                                                    ? 'bg-white dark:bg-zinc-800 text-brand-green'
                                                    : 'bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-gray-300'
                                            }`}>
                                                {t('whatsNew.version', { version: update.version })}
                                            </span>
                                            <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                                                {t(update.dateKey)}
                                            </span>
                                        </div>
                                        <h2 className={`text-lg sm:text-xl md:text-2xl font-bold mt-2 ${
                                            index === 0 ? 'text-brand-green' : 'text-gray-900 dark:text-white'
                                        }`}>
                                            {t(update.titleKey)}
                                        </h2>
                                    </div>

                                    {/* Features grid */}
                                    <div className="px-4 sm:px-6 md:px-8 py-5 sm:py-6">
                                        <div className={`grid gap-3 sm:gap-4 ${
                                            update.features.length >= 4 ? 'md:grid-cols-2' : 'md:grid-cols-1 max-w-2xl'
                                        }`}>
                                            {update.features.map(feature => (
                                                <FeatureCard key={feature.titleKey} feature={feature} t={t} />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* CTA Section */}
                <section className="relative text-center py-10 sm:py-14 px-6 sm:px-8 rounded-2xl sm:rounded-3xl overflow-hidden bg-gradient-to-r from-brand-green to-green-600 shadow-2xl shadow-brand-green/20">
                    {/* Decorative elements */}
                    <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                    <div className="absolute bottom-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl" />

                    <div className="relative z-10">
                        <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                            {t('whatsNew.readyToExplore')}
                        </h3>
                        <p className="text-green-100 mb-6 text-sm sm:text-base">
                            {t('homepage.haveYouBought')}
                        </p>
                        <ReactRouterDOM.Link
                            to={`${countryPrefix}/${pathTranslations[language].explore}`}
                            className="inline-flex items-center gap-2 bg-white text-brand-green font-bold px-6 sm:px-8 py-3 sm:py-4 rounded-xl hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 text-sm sm:text-base"
                        >
                            <i className="fa-solid fa-compass"></i>
                            {t('whatsNew.discoverNearby')}
                        </ReactRouterDOM.Link>
                    </div>
                </section>
            </div>
        </>
    );
};

export default WhatsNewPage;
