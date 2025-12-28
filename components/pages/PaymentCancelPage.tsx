import React from 'react';
import { Link } from 'react-router-dom';
import Meta from '../Meta';
import { useI18n, pathTranslations, getLanguageForCountryCode } from '../../contexts/i18nContext';
import { useCountry } from '../../contexts/CountryContext';

const PaymentCancelPage: React.FC = () => {
    const { language } = useI18n();
    const { country } = useCountry();

    // Use country directly - don't infer from language
    const countryPrefix = country ? `/${country.toLowerCase()}` : '';
    const pathLang = country ? getLanguageForCountryCode(country) : language;
    const paths = pathTranslations[pathLang] || pathTranslations.es;

    return (
        <>
            <Meta title="Pago Cancelado - Opynio" description="El proceso de pago ha sido cancelado." noindex={true} />
            <div className="max-w-2xl mx-auto text-center py-12">
                <div className="bg-white dark:bg-zinc-800 p-8 rounded-xl shadow-lg">
                     <div className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-300 rounded-full w-20 h-20 inline-flex items-center justify-center shadow-sm mb-6">
                        <i className="fa-solid fa-triangle-exclamation text-5xl"></i>
                    </div>
                    <h1 className="text-3xl font-extrabold text-gray-800 dark:text-gray-100">Proceso de Pago Cancelado</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-4 text-lg">
                        Parece que el proceso de pago no se completó. Tu plan no ha sido modificado.
                    </p>
                    <p className="text-gray-500 dark:text-gray-500 mt-2 text-sm">
                        Puedes volver a intentarlo cuando quieras.
                    </p>
                    <div className="mt-8 flex justify-center gap-4">
                        <Link
                            to={`${countryPrefix}/${paths.pricing}`}
                            className="inline-block bg-brand-green text-white font-bold px-8 py-3 rounded-md hover:bg-opacity-90 transition-all shadow-md"
                        >
                            Ver Planes de Nuevo
                        </Link>
                         <Link
                            to={`${countryPrefix}/${paths.myBusinesses}`}
                            className="inline-block bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-200 font-semibold px-6 py-3 rounded-md hover:bg-gray-200 dark:hover:bg-zinc-600 transition-all"
                        >
                            Volver a Mis Negocios
                        </Link>
                    </div>
                </div>
            </div>
        </>
    );
};

export default PaymentCancelPage;