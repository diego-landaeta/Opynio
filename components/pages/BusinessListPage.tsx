import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import type { Business, Plan } from '../../types';
import Spinner from '../Spinner';
import { Link } from 'react-router-dom';
import Meta from '../Meta';

const BusinessCard: React.FC<{ business: Business }> = ({ business }) => {
    const [imageError, setImageError] = useState(false);
    return (
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-md border dark:border-zinc-700 p-5 flex flex-col transition-all hover:shadow-lg hover:-translate-y-1">
            <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-zinc-700 flex-shrink-0 flex items-center justify-center overflow-hidden border dark:border-zinc-600">
                    {business.logo_url && !imageError ? (
                        <img src={business.logo_url} alt={`${business.name} logo`} width={64} height={64} loading="lazy" decoding="async" className="w-full h-full object-contain p-1" onError={() => setImageError(true)} />
                    ) : (
                        <div className="text-gray-400 dark:text-gray-500">
                            <i className="fa-solid fa-store text-3xl"></i>
                        </div>
                    )}
                </div>
                <div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">{business.name}</h3>
                </div>
            </div>
            <div className="mt-auto pt-4 border-t dark:border-zinc-700">
                <Link to={`/empresa/panel/${business.id}`} className="text-brand-green font-semibold hover:text-green-700 dark:hover:text-green-400 flex items-center gap-2">
                    <span>Gestionar</span>
                    <i className="fa-solid fa-arrow-right"></i>
                </Link>
            </div>
        </div>
    );
};


const BusinessListPage: React.FC = () => {
    const { businesses, loading, profile } = useAuth();

    if (loading) {
        return <div className="flex justify-center items-center h-64"><Spinner /></div>;
    }

    // FIX: Add 'enterprise' plan to PLAN_LIMITS to match the Plan type definition.
    const PLAN_LIMITS: Record<Plan, number> = {
        free: 1,
        starter: 1,
        growth: 3,
        pro: 10,
        enterprise: Infinity,
    };

    const currentPlan = profile?.plan || 'free';
    const limit = PLAN_LIMITS[currentPlan];
    const canCreateBusiness = businesses.length < limit;
    
    return (
        <>
            <Meta title="Mis Negocios - Opynio" description="Gestiona todos tus negocios registrados en Opynio desde un único panel." />
            <div className="max-w-6xl mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold text-gray-800 dark:text-gray-100">Mis Negocios ({businesses.length}/{limit === Infinity ? '∞' : limit})</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Tu plan <strong className="capitalize">{currentPlan}</strong> te permite gestionar hasta {limit === Infinity ? 'ilimitados' : limit} negocio{limit > 1 ? 's' : ''}.</p>
                    </div>
                    {canCreateBusiness ? (
                        <Link to="/asignar-empresa" className="bg-brand-green text-white font-bold py-2.5 px-5 rounded-lg hover:bg-opacity-90 transition-colors shadow-sm flex items-center gap-2">
                            <i className="fa-solid fa-plus-circle"></i>
                            <span>Añadir Negocio</span>
                        </Link>
                    ) : (
                        <Link to="/planes" className="bg-brand-blue text-white font-bold py-2.5 px-5 rounded-lg hover:bg-opacity-90 transition-colors shadow-sm flex items-center gap-2">
                            <i className="fa-solid fa-rocket"></i>
                            <span>Mejorar Plan</span>
                        </Link>
                    )}
                </div>

                {businesses.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {businesses.map(biz => (
                            <BusinessCard key={biz.id} business={biz} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-800/50 rounded-lg border-2 border-dashed border-gray-200 dark:border-zinc-700">
                        <i className="fa-solid fa-store-slash text-6xl mb-4 text-gray-300 dark:text-gray-600"></i>
                        <h2 className="font-semibold text-lg text-gray-600 dark:text-gray-300">No tienes negocios registrados</h2>
                        <p className="text-sm mt-2 max-w-sm mx-auto">Haz clic en "Añadir Negocio" para empezar a gestionar tu reputación online.</p>
                    </div>
                )}
            </div>
        </>
    );
};

export default BusinessListPage;
