// Importar reseñas desde un CSV (#17, punto 3). Lee el fichero en el navegador,
// enseña cuantas filas valen y que lineas fallan, y manda las validas a la Edge
// Function import-reviews-csv (que vuelve a validar, comprueba dueño y plan, y
// no duplica). Las importadas entran pendientes de revision.
import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../../services/supabaseService';
import { useAuth } from '../../../../contexts/AuthContext';
import { useNotification } from '../../../../contexts/NotificationContext';
import { useTranslation } from '../../../../contexts/i18nContext';
import { effectivePlan, hasPlanAccess } from '../../../../utils/planFeatures';
import { usePricingHref } from './useDashboardSections';
import {
    parseReviewsCsv,
    CSV_MAX_ROWS,
    CSV_TEMPLATE,
    type CsvParseResult,
    type CsvRowError,
} from '../../../../utils/reviewsCsv';

const REASON_KEY: Record<CsvRowError['code'], string> = {
    rating: 'businessDashboard.importCsvReasonRating',
    author: 'businessDashboard.importCsvReasonAuthor',
    text: 'businessDashboard.importCsvReasonText',
    date: 'businessDashboard.importCsvReasonDate',
    columns: 'businessDashboard.importCsvReasonColumns',
};
// Nombre de cada columna obligatoria tal como sale en la plantilla.
const COLUMN_NAME = { author: 'author', rating: 'rating', text: 'text' } as const;
const ERRORS_SHOWN = 8;

const ImportReviewsCsv: React.FC<{ businessId: string; onImported: () => void }> = ({ businessId, onImported }) => {
    const t = useTranslation();
    const { profile } = useAuth();
    const { showNotification } = useNotification();
    const pricingHref = usePricingHref();
    const inputRef = useRef<HTMLInputElement>(null);
    const [fileName, setFileName] = useState('');
    const [parsed, setParsed] = useState<CsvParseResult | null>(null);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState<{ imported: number; duplicates: number } | null>(null);

    const allowed = hasPlanAccess(effectivePlan(profile), 'starter');

    const downloadTemplate = () => {
        const url = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'opynio-resenas-plantilla.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        setResult(null);
        if (!file) return;
        setFileName(file.name);
        setParsed(parseReviewsCsv(await file.text()));
    };

    const reset = () => {
        setParsed(null);
        setFileName('');
        if (inputRef.current) inputRef.current.value = '';
    };

    const tooMany = !!parsed && parsed.rows.length > CSV_MAX_ROWS;

    const handleImport = async () => {
        if (!parsed || parsed.rows.length === 0 || tooMany) return;
        setImporting(true);
        try {
            const { data, error } = await supabase.functions.invoke('import-reviews-csv', {
                body: { businessId, rows: parsed.rows },
            });
            if (error || !data || typeof data.imported !== 'number') throw error || new Error('import-reviews-csv: respuesta vacia');
            setResult({ imported: data.imported, duplicates: data.duplicates ?? 0 });
            showNotification(t('businessDashboard.importCsvDone', { imported: String(data.imported), duplicates: String(data.duplicates ?? 0) }), 'success');
            reset();
            if (data.imported > 0) onImported();
        } catch (err) {
            console.error('No se pudieron importar las reseñas:', err);
            showNotification(t('businessDashboard.importCsvFailed'), 'error');
        } finally {
            setImporting(false);
        }
    };

    return (
        <section className="bg-white dark:bg-zinc-800 p-4 sm:p-5 md:p-6 rounded-lg sm:rounded-xl shadow-sm border dark:border-zinc-700">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100">
                        <i className="fa-solid fa-file-csv text-brand-green mr-2" aria-hidden="true"></i>
                        {t('businessDashboard.importCsvTitle')}
                    </h2>
                    <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-400 max-w-2xl">{t('businessDashboard.importCsvDesc')}</p>
                </div>
                <button
                    type="button"
                    onClick={downloadTemplate}
                    className="flex-shrink-0 text-sm font-semibold text-brand-green hover:underline self-start"
                >
                    <i className="fa-solid fa-download mr-1" aria-hidden="true"></i>{t('businessDashboard.importCsvTemplate')}
                </button>
            </div>

            {!allowed ? (
                <p className="mt-4 text-sm text-gray-700 dark:text-gray-300">
                    <i className="fa-solid fa-lock mr-2 text-gray-400" aria-hidden="true"></i>
                    {t('businessDashboard.importCsvLocked')}{' '}
                    <Link to={pricingHref} className="font-semibold text-brand-green hover:underline">{t('businessDashboard.seePlansLink')}</Link>
                </p>
            ) : (
                <div className="mt-4 space-y-3">
                    <label className="inline-flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:border-brand-green">
                        <i className="fa-solid fa-upload" aria-hidden="true"></i>
                        {fileName || t('businessDashboard.importCsvChoose')}
                        <input ref={inputRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={onFile} disabled={importing} />
                    </label>

                    {parsed && parsed.missingColumns.length > 0 && (
                        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
                            {t('businessDashboard.importCsvMissingColumns', { columns: parsed.missingColumns.map(c => COLUMN_NAME[c]).join(', ') })}
                        </p>
                    )}

                    {parsed && parsed.missingColumns.length === 0 && (
                        <div className="space-y-2 text-sm">
                            <p className="font-semibold text-gray-800 dark:text-gray-100">
                                {t('businessDashboard.importCsvSummary', { valid: String(parsed.rows.length), invalid: String(parsed.errors.length) })}
                            </p>
                            {parsed.errors.length > 0 && (
                                <ul className="text-xs text-red-700 dark:text-red-300 space-y-0.5">
                                    {parsed.errors.slice(0, ERRORS_SHOWN).map(err => (
                                        <li key={err.line}>{t('businessDashboard.importCsvErrorLine', { line: String(err.line), reason: t(REASON_KEY[err.code]) })}</li>
                                    ))}
                                    {parsed.errors.length > ERRORS_SHOWN && (
                                        <li>{t('businessDashboard.importCsvMoreErrors', { count: String(parsed.errors.length - ERRORS_SHOWN) })}</li>
                                    )}
                                </ul>
                            )}
                            {tooMany && <p role="alert" className="text-red-700 dark:text-red-300">{t('businessDashboard.importCsvTooMany', { max: String(CSV_MAX_ROWS) })}</p>}
                            {parsed.rows.length === 0 && <p className="text-gray-600 dark:text-gray-400">{t('businessDashboard.importCsvEmpty')}</p>}
                            {parsed.rows.length > 0 && !tooMany && (
                                <button
                                    type="button"
                                    onClick={handleImport}
                                    disabled={importing}
                                    className="bg-brand-green text-white font-semibold px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-60"
                                >
                                    {importing ? t('businessDashboard.importCsvImporting') : t('businessDashboard.importCsvButton', { count: String(parsed.rows.length) })}
                                </button>
                            )}
                        </div>
                    )}

                    {result && (
                        <p role="status" className="text-sm text-green-700 dark:text-green-300">
                            {t('businessDashboard.importCsvDone', { imported: String(result.imported), duplicates: String(result.duplicates) })}
                        </p>
                    )}
                </div>
            )}
        </section>
    );
};

export default ImportReviewsCsv;
