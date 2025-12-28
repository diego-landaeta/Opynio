// components/pages/business/MigrateTrustindexReviewsPage.tsx

import React, { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { importTrustindexReviews } from '../../../services/supabaseService';
import { trustIndexReplacementImporter } from '../../../services/serpApiService';
import { useNotification } from '../../../contexts/NotificationContext';
import { useTranslation } from '../../../contexts/i18nContext';
import Spinner from '../../Spinner';
import Meta from '../../Meta';
import * as ReactRouterDOM from 'react-router-dom';

const MigrateTrustindexReviewsPage: React.FC = () => {
    // FIX: Updated to use `businesses` array from AuthContext and select the first one.
    const { businesses, profile } = useAuth();
    const business = businesses.length > 0 ? businesses[0] : null;
    const { showNotification } = useNotification();
    const t = useTranslation();

    const [trustindexUrl, setTrustindexUrl] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [importStatus, setImportStatus] = useState<string[]>([]);
    const [importResult, setImportResult] = useState<{ importedCount: number } | null>(null);
    const [importError, setImportError] = useState<string | null>(null);

    const handleProgressUpdate = (message: string) => {
        setImportStatus(prev => [...prev, message]);
    };

    const handleImport = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!trustindexUrl.trim() || !business || !profile) {
            setImportError('Por favor, introduce una URL de TrustIndex válida.');
            return;
        }

        setIsImporting(true);
        setImportStatus([]);
        setImportResult(null);
        setImportError(null);

        try {
            // Step 1: Scrape reviews from TrustIndex
            const scrapedData = await trustIndexReplacementImporter.importReviews(trustindexUrl, handleProgressUpdate);

            if (scrapedData.reviews.length === 0) {
                handleProgressUpdate('No se encontraron reseñas para importar en TrustIndex.');
                showNotification('No se encontraron reseñas en esa página de TrustIndex.', 'info');
                setIsImporting(false);
                setImportResult({ importedCount: 0 });
                return;
            }

            // Step 2: Save reviews to our database
            handleProgressUpdate('Guardando reseñas en la base de datos de Opynio...');
            const importedCount = await importTrustindexReviews(
                business.id,
                profile.id,
                scrapedData
            );
            
            setImportResult({ importedCount });
            
            if (importedCount > 0) {
                 handleProgressUpdate(`¡Proceso completado! Se importaron ${importedCount} nuevas reseñas.`);
                 showNotification(`${importedCount} nuevas reseñas importadas.`, 'success');
            } else {
                 handleProgressUpdate('Proceso completado. No se encontraron reseñas nuevas para importar.');
                 showNotification('Todas las reseñas de esa fuente ya estaban en tu perfil.', 'info');
            }

        } catch (err: any) {
            const errorMessage = err.message || 'Ocurrió un error desconocido durante la importación.';
            setImportError(errorMessage);
            handleProgressUpdate(`Error: ${errorMessage}`);
            showNotification(errorMessage, 'error');
        } finally {
            setIsImporting(false);
        }
    };

    const resetWizard = () => {
        setTrustindexUrl('');
        setIsImporting(false);
        setImportStatus([]);
        setImportResult(null);
        setImportError(null);
    };

    const isFinished = !isImporting && (importResult !== null || importError !== null);

    return (
        <>
            <Meta title="Importar desde TrustIndex - Opynio" description="Importa reseñas desde tu página pública de TrustIndex para unificar tu reputación online." noindex={true} />
            <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-lg">
                <div className="flex items-center gap-4 mb-6 pb-6 border-b">
                    <i className="fa-solid fa-check-circle text-4xl text-orange-500"></i>
                    <div>
                        <h1 className="text-3xl font-bold">Importar desde TrustIndex</h1>
                        <p className="text-gray-600 mt-1">Centraliza tu reputación online importando reseñas desde tu página pública de TrustIndex.</p>
                    </div>
                </div>

                {!isFinished ? (
                    <form onSubmit={handleImport} className="space-y-4">
                        <div>
                            <label htmlFor="trustindexUrl" className="block text-sm font-medium text-gray-700 mb-1">
                                URL de tu página pública en TrustIndex
                            </label>
                            <input
                                id="trustindexUrl"
                                type="url"
                                value={trustindexUrl}
                                onChange={(e) => setTrustindexUrl(e.target.value)}
                                placeholder={t('common.placeholders.pasteReviewsUrl')}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green"
                                disabled={isImporting}
                                required
                            />
                        </div>
                        <button 
                            type="submit"
                            disabled={isImporting}
                            className="w-full bg-orange-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-orange-600 transition-all text-lg disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-3"
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
                        <button onClick={resetWizard} className="bg-orange-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-orange-600">
                            Importar desde otra URL
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
                                        : 'fa-spinner fa-spin text-orange-500'} mt-1`}></i>
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
                    <ReactRouterDOM.Link to="/empresa/panel" className="text-sm font-semibold text-gray-600 hover:underline">
                        <i className="fa-solid fa-arrow-left mr-2"></i>
                        Volver al panel
                    </ReactRouterDOM.Link>
                </div>
            </div>
        </>
    );
};

export default MigrateTrustindexReviewsPage;