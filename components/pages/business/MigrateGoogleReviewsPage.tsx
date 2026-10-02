// components/pages/business/MigrateGoogleReviewsPage.tsx

import React, { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { importSerpApiGoogleReviews, checkGoogleMapsUrlExists } from '../../../services/supabaseService';
import { googleReviewsImporter, SerpApiImportResult } from '../../../services/serpApiService';
import { useNotification } from '../../../contexts/NotificationContext';
import { useTranslation } from '../../../contexts/i18nContext';
import { useUserErrorNotifier, type UserFacingError } from '../../../utils/userFacingError';
import Spinner from '../../Spinner';
import Meta from '../../Meta';
import * as ReactRouterDOM from 'react-router-dom';

const MigrateGoogleReviewsPage: React.FC = () => {
    // La empresa sale de ?businessId= (el panel enlaza con ella). Antes era
    // siempre la primera: un dueno con varias importaba en la equivocada.
    const { businesses, profile } = useAuth();
    const [searchParams] = ReactRouterDOM.useSearchParams();
    const businessIdParam = searchParams.get('businessId');
    const business = businesses.find(b => b.id === businessIdParam) || (businesses.length > 0 ? businesses[0] : null);
    const { showNotification } = useNotification();
    const { notifyError, showUserError } = useUserErrorNotifier();
    const t = useTranslation();

    const [googleMapsUrl, setGoogleMapsUrl] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [importStatus, setImportStatus] = useState<string[]>([]);
    const [importResult, setImportResult] = useState<{ importedCount: number } | null>(null);
    const [importError, setImportError] = useState<string | null>(null);

    const handleProgressUpdate = (message: string) => {
        setImportStatus(prev => [...prev, message]);
    };

    const handleImport = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!googleMapsUrl.trim() || !business || !profile) {
            setImportError('Por favor, introduce una URL de Google Maps válida y asegúrate de tener un negocio asignado.');
            return;
        }

        setIsImporting(true);
        setImportStatus([]);
        setImportResult(null);
        setImportError(null);

        try {
            handleProgressUpdate('Verificando URL...');
            // La URL de la propia empresa no cuenta como "de otra empresa".
            const esLaPropia = !!business.google_maps_url
                && business.google_maps_url.trim().replace(/\/+$/, '') === googleMapsUrl.trim().replace(/\/+$/, '');
            const exists = !esLaPropia && await checkGoogleMapsUrlExists(googleMapsUrl.trim());
            if (exists) {
                throw Object.assign(new Error('GOOGLE_URL_TAKEN'), { code: 'GOOGLE_URL_TAKEN' });
            }

            // Step 1: Fetch all reviews from SerpApi
            const serpApiData = await googleReviewsImporter.importAllReviews(googleMapsUrl, handleProgressUpdate);

            if (serpApiData.reviews.length === 0) {
                handleProgressUpdate('No se encontraron reseñas para importar en Google.');
                showNotification('No se encontraron reseñas para este negocio en Google.', 'info');
                setIsImporting(false);
                setImportResult({ importedCount: 0 }); // Mark as finished with 0 results
                return;
            }

            // Step 2: Save reviews to our database
            handleProgressUpdate('Guardando reseñas en la base de datos de Opynio...');
            const importedCount = await importSerpApiGoogleReviews(
                business.id,
                googleMapsUrl
            );
            
            setImportResult({ importedCount });
            
            if (importedCount > 0) {
                 handleProgressUpdate(`¡Proceso completado! Se importaron ${importedCount} nuevas reseñas.`);
                 showNotification(`${importedCount} nuevas reseñas importadas.`, 'success');
            } else {
                 handleProgressUpdate('Proceso completado. No se encontraron reseñas nuevas para importar.');
                 showNotification('Todas las reseñas de Google ya estaban en tu perfil.', 'info');
            }

        } catch (err: any) {
            // Traducido y con accion. Antes salia tal cual el texto de SerpApi,
            // de la Edge Function o de la BD, en espanol o en ingles.
            let info: UserFacingError;
            if (err?.code === 'GOOGLE_URL_TAKEN') {
                info = { kind: 'conflict', key: 'businessDashboard.googleImportUrlTaken', action: 'support' };
                showUserError(info);
            } else {
                info = await notifyError(err, { fallbackKey: 'businessDashboard.googleImportFailed' });
            }
            const errorMessage = t(info.key);
            setImportError(errorMessage);
            handleProgressUpdate(`Error: ${errorMessage}`);
        } finally {
            setIsImporting(false);
        }
    };

    const resetWizard = () => {
        setGoogleMapsUrl('');
        setIsImporting(false);
        setImportStatus([]);
        setImportResult(null);
        setImportError(null);
    };

    const isFinished = !isImporting && (importResult !== null || importError !== null);

    return (
        <>
            <Meta title="Migrar Opiniones de Google - Opynio" description="Importa tus reseñas de Google Business a Opynio para unificar tu reputación online." noindex={true} />
            <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-lg">
                <div className="flex items-center gap-4 mb-6 pb-6 border-b">
                    <i className="fab fa-google text-4xl text-blue-500"></i>
                    <div>
                        <h1 className="text-3xl font-bold">Migrar Opiniones de Google</h1>
                        <p className="text-gray-600 mt-1">Unifica tu reputación online pegando la URL de tu negocio.</p>
                    </div>
                </div>

                {!isFinished ? (
                    <form onSubmit={handleImport} className="space-y-4">
                        <div>
                            <label htmlFor="googleMapsUrl" className="block text-sm font-medium text-gray-700 mb-1">
                                URL de tu Perfil de Empresa en Google Maps
                            </label>
                            <input
                                id="googleMapsUrl"
                                type="url"
                                value={googleMapsUrl}
                                onChange={(e) => setGoogleMapsUrl(e.target.value)}
                                placeholder={t('common.placeholders.pasteGoogleMapsUrl')}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green"
                                disabled={isImporting}
                                required
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                Ejemplo: <code className="bg-gray-100 p-1 rounded text-gray-700">https://www.google.com/maps/place/ISEIE+Innovation+School...</code>
                            </p>
                        </div>
                        <button 
                            type="submit"
                            disabled={isImporting}
                            className="w-full bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-all text-lg disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                        >
                            {isImporting ? (
                                <>
                                <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Importando...</span>
                                </>
                            ) : (
                                'Iniciar Importación'
                            )}
                        </button>
                    </form>
                ) : (
                     <div className="text-center">
                        <button onClick={resetWizard} className="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700">
                            Importar Otro Negocio
                        </button>
                    </div>
                )}
                
                {(importStatus.length > 0) && (
                    <div className="mt-6 p-4 bg-gray-50 border rounded-lg">
                        <h3 className="font-semibold mb-2 text-gray-800">Progreso de la Importación:</h3>
                        <ul className="text-sm text-gray-600 space-y-1.5 max-h-48 overflow-y-auto">
                            {importStatus.map((status, index) => (
                                <li key={index} className="flex items-start gap-2 animate-fade-in-up" style={{ animationDelay: `${index * 100}ms`}}>
                                    <i className={`fa-solid ${
                                        status.toLowerCase().includes('error') ? 'fa-circle-xmark text-red-500' 
                                        : (index === importStatus.length - 1 && isFinished) ? 'fa-circle-check text-green-500'
                                        : 'fa-spinner fa-spin text-blue-500'} mt-1`}></i>
                                    <span>{status}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                 <style>{`
                    @keyframes fade-in-up {
                        0% { opacity: 0; transform: translateY(10px); }
                        100% { opacity: 1; transform: translateY(0); }
                    }
                    .animate-fade-in-up {
                        animation: fade-in-up 0.3s ease-out forwards;
                    }
                `}</style>

                <div className="mt-8 border-t pt-6 text-center">
                    <ReactRouterDOM.Link to="/mis-negocios" className="text-sm font-semibold text-gray-600 hover:underline">
                        <i className="fa-solid fa-arrow-left mr-2"></i>
                        Volver al panel
                    </ReactRouterDOM.Link>
                </div>
            </div>
        </>
    );
};

export default MigrateGoogleReviewsPage;