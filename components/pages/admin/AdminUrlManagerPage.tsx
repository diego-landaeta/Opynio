import React, { useState, useEffect, useCallback } from 'react';
import {
  getBusinessesWithProblematicUrls,
  getUrlRedirects,
  updateBusinessSlug,
  deleteUrlRedirect,
  isSlugAvailable,
  batchUpdateSlugs,
  removeBusinessSlug
} from '../../../services/supabaseService';
import { useNotification } from '../../../contexts/NotificationContext';
import { useTranslation } from '../../../contexts/i18nContext';
import { slugify, isValidSlug, hasProblematicCharacters } from '../../../utils/slugify';
import type { UrlRedirect } from '../../../types';
import Meta from '../../Meta';
import Spinner from '../../Spinner';
import Modal from '../../Modal';

interface BusinessForSlug {
  id: string;
  name: string;
  slug: string | null;
  country: string | null;
  logo_url: string | null;
  created_at: string;
}

const AdminUrlManagerPage: React.FC = () => {
  const { showNotification } = useNotification();
  const t = useTranslation();

  // State for businesses with problematic URLs
  const [businesses, setBusinesses] = useState<BusinessForSlug[]>([]);
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);
  const [totalSearchResults, setTotalSearchResults] = useState(0);
  const [problematicCount, setProblematicCount] = useState(0);

  // State for redirects
  const [redirects, setRedirects] = useState<any[]>([]);
  const [loadingRedirects, setLoadingRedirects] = useState(true);

  // State for editing
  const [editingBusiness, setEditingBusiness] = useState<BusinessForSlug | null>(null);
  const [newSlug, setNewSlug] = useState('');
  const [createRedirect, setCreateRedirect] = useState(true);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [saving, setSaving] = useState(false);

  // State for batch operations
  const [selectedBusinesses, setSelectedBusinesses] = useState<Set<string>>(new Set());
  const [batchProcessing, setBatchProcessing] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<'problematic' | 'redirects'>('problematic');

  // Search
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Debounce search term for server-side search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Fetch businesses with problematic URLs (with search term)
  const fetchBusinesses = useCallback(async (search?: string) => {
    setLoadingBusinesses(true);
    try {
      const result = await getBusinessesWithProblematicUrls(1, 100, search);
      setBusinesses(result.data);
      setTotalSearchResults(result.total);
      setProblematicCount(result.problematicCount);
    } catch (error) {
      console.error('Error fetching businesses:', error);
      showNotification(t('admin.urlManager.errorLoading'), 'error');
    } finally {
      setLoadingBusinesses(false);
    }
  }, [showNotification, t]);

  // Fetch redirects
  const fetchRedirects = useCallback(async () => {
    setLoadingRedirects(true);
    try {
      const data = await getUrlRedirects();
      setRedirects(data);
    } catch (error) {
      console.error('Error fetching redirects:', error);
    } finally {
      setLoadingRedirects(false);
    }
  }, []);

  // Fetch businesses when search term changes (debounced)
  useEffect(() => {
    fetchBusinesses(debouncedSearchTerm || undefined);
  }, [fetchBusinesses, debouncedSearchTerm]);

  // Fetch redirects on mount
  useEffect(() => {
    fetchRedirects();
  }, [fetchRedirects]);

  // Check slug availability with debounce
  useEffect(() => {
    if (!newSlug || !editingBusiness) {
      setSlugAvailable(null);
      return;
    }

    if (!isValidSlug(newSlug)) {
      setSlugAvailable(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setCheckingSlug(true);
      const available = await isSlugAvailable(newSlug, editingBusiness.id);
      setSlugAvailable(available);
      setCheckingSlug(false);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [newSlug, editingBusiness]);

  // Open edit modal
  const handleEdit = (business: BusinessForSlug, fromRedirectsTab: boolean = false) => {
    setEditingBusiness(business);
    // Si ya tiene slug, sugerimos el slug actual; si no, generamos uno nuevo
    setNewSlug(business.slug || slugify(business.name));
    // Si viene del tab de redirecciones o ya tiene slug, no crear otra redirección por defecto
    // porque la empresa ya está correctamente configurada
    setCreateRedirect(!fromRedirectsTab && !business.slug);
    setSlugAvailable(null);
  };

  // Save slug
  const handleSave = async () => {
    if (!editingBusiness || !newSlug || !slugAvailable) return;

    setSaving(true);
    try {
      // Construir la URL original exacta para la redirección
      // SIEMPRE usar el nombre URL-encoded para la redirección, ya que esa es la URL
      // "problemática" que queremos redirigir al nuevo slug limpio
      // Ejemplo: "ISEIE Innovation School | Formación" -> "ISEIE_Innovation_School_%7C_Formaci%C3%B3n"
      const originalUrlFromName = encodeURIComponent(editingBusiness.name.replace(/ /g, '_'));

      // Si ya tiene slug y es diferente al nuevo, redirigir desde el slug actual
      // Si no tiene slug, redirigir desde la URL basada en nombre
      const originalUrlSlug = editingBusiness.slug && editingBusiness.slug !== newSlug
        ? editingBusiness.slug
        : originalUrlFromName;

      const result = await updateBusinessSlug(
        editingBusiness.id,
        newSlug,
        createRedirect,
        createRedirect ? originalUrlSlug : undefined // Pasar URL original solo si se crea redirección
      );
      if (result.success) {
        showNotification(t('admin.urlManager.slugUpdated'), 'success');
        setEditingBusiness(null);
        fetchBusinesses();
        fetchRedirects();
      } else {
        showNotification(result.error || t('admin.urlManager.errorUpdating'), 'error');
      }
    } catch (error) {
      showNotification(t('admin.urlManager.errorUpdating'), 'error');
    } finally {
      setSaving(false);
    }
  };

  // Delete redirect
  const handleDeleteRedirect = async (id: string) => {
    if (!confirm(t('admin.urlManager.confirmDeleteRedirect'))) return;

    try {
      const success = await deleteUrlRedirect(id);
      if (success) {
        showNotification(t('admin.urlManager.redirectDeleted'), 'success');
        fetchRedirects();
      } else {
        showNotification(t('admin.urlManager.errorDeletingRedirect'), 'error');
      }
    } catch (error) {
      showNotification(t('admin.urlManager.errorDeletingRedirect'), 'error');
    }
  };

  // Remove slug from business (revert to name-based URL)
  const handleRemoveSlug = async (businessId: string, businessName: string) => {
    if (!confirm(`¿Eliminar el slug de "${businessName}"? La empresa volverá a usar la URL basada en su nombre.`)) return;

    try {
      const result = await removeBusinessSlug(businessId);
      if (result.success) {
        showNotification('Slug eliminado correctamente', 'success');
        fetchBusinesses(debouncedSearchTerm || undefined);
        fetchRedirects();
      } else {
        showNotification(result.error || 'Error al eliminar slug', 'error');
      }
    } catch (error) {
      showNotification('Error al eliminar slug', 'error');
    }
  };

  // Toggle selection
  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedBusinesses);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedBusinesses(newSelection);
  };

  // Select all - uses businesses already filtered by server
  const selectAll = () => {
    if (selectedBusinesses.size === businesses.length && businesses.length > 0) {
      setSelectedBusinesses(new Set());
    } else {
      setSelectedBusinesses(new Set(businesses.map(b => b.id)));
    }
  };

  // Batch update
  const handleBatchUpdate = async () => {
    if (selectedBusinesses.size === 0) return;
    if (!confirm(t('admin.urlManager.confirmBatchUpdate').replace('{count}', String(selectedBusinesses.size)))) return;

    setBatchProcessing(true);
    try {
      const updates = Array.from(selectedBusinesses).map(id => {
        const business = businesses.find(b => b.id === id);
        // Construir la URL original exacta para la redirección
        // Si no tiene slug, usar el nombre URL-encoded (como aparece en el navegador)
        const originalUrlSlug = business?.slug ||
          encodeURIComponent((business?.name || '').replace(/ /g, '_'));

        const update = {
          businessId: id,
          newSlug: slugify(business?.name || ''),
          createRedirect: true,
          originalUrlSlug: originalUrlSlug
        };

        console.log('📦 [AdminUrlManager] Preparando update:', {
          businessName: business?.name,
          businessId: id,
          currentSlug: business?.slug,
          originalUrlSlug,
          newSlug: update.newSlug,
          createRedirect: true
        });

        return update;
      });

      console.log('🚀 [AdminUrlManager] Enviando batch de', updates.length, 'empresas');
      const result = await batchUpdateSlugs(updates);
      console.log('📊 [AdminUrlManager] Resultado del batch:', result);
      showNotification(
        t('admin.urlManager.batchComplete')
          .replace('{success}', String(result.success))
          .replace('{failed}', String(result.failed)),
        result.failed > 0 ? 'warning' : 'success'
      );

      setSelectedBusinesses(new Set());

      // Pequeño delay para asegurar que Supabase complete las operaciones
      await new Promise(resolve => setTimeout(resolve, 500));

      await Promise.all([
        fetchBusinesses(),
        fetchRedirects()
      ]);
    } catch (error) {
      showNotification(t('admin.urlManager.errorBatch'), 'error');
    } finally {
      setBatchProcessing(false);
    }
  };

  // Get current URL for a business
  const getCurrentUrl = (business: BusinessForSlug) => {
    const slug = business.slug || business.name.replace(/ /g, '_');
    return `/${business.country?.toLowerCase() || 'es'}/empresa/${encodeURIComponent(slug)}`;
  };

  // Get suggested URL
  const getSuggestedUrl = (business: BusinessForSlug) => {
    const slug = slugify(business.name);
    return `/${business.country?.toLowerCase() || 'es'}/empresa/${slug}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Meta
        title={t('admin.urlManager.title')}
        description={t('admin.urlManager.description')}
        noIndex={true}
      />

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {t('admin.urlManager.title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {t('admin.urlManager.description')}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-zinc-700">
        <button
          onClick={() => setActiveTab('problematic')}
          className={`pb-3 px-1 font-medium transition-colors ${
            activeTab === 'problematic'
              ? 'text-brand-dark border-b-2 border-brand-dark'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          {t('admin.urlManager.problematicUrls')} ({problematicCount})
        </button>
        <button
          onClick={() => setActiveTab('redirects')}
          className={`pb-3 px-1 font-medium transition-colors ${
            activeTab === 'redirects'
              ? 'text-brand-dark border-b-2 border-brand-dark'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          {t('admin.urlManager.activeRedirects')} ({redirects.length})
        </button>
      </div>

      {/* Problematic URLs Tab */}
      {activeTab === 'problematic' && (
        <div>
          {/* Search bar */}
          <div className="mb-4">
            <div className="relative">
              <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('admin.urlManager.searchPlaceholder') || 'Buscar empresa por nombre...'}
                className="w-full pl-10 pr-10 py-2.5 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 placeholder-gray-400"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {loadingBusinesses && searchTerm && (
                  <div className="w-4 h-4 border-2 border-brand-dark border-t-transparent rounded-full animate-spin" />
                )}
                {searchTerm && !loadingBusinesses && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <i className="fa-solid fa-times" />
                  </button>
                )}
              </div>
            </div>
            {searchTerm && !loadingBusinesses && (
              <p className="text-sm text-gray-500 mt-2">
                {totalSearchResults} {totalSearchResults === 1 ? 'empresa encontrada' : 'empresas encontradas'} con "{searchTerm}"
              </p>
            )}
          </div>

          {/* Batch actions */}
          {selectedBusinesses.size > 0 && (
            <div className="mb-4 p-4 bg-brand-light/20 dark:bg-brand-dark/20 rounded-lg flex items-center justify-between">
              <span className="text-sm font-medium">
                {selectedBusinesses.size} {t('admin.urlManager.selected')}
              </span>
              <button
                onClick={handleBatchUpdate}
                disabled={batchProcessing}
                className="bg-brand-dark text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-dark/90 disabled:opacity-50 flex items-center gap-2"
              >
                {batchProcessing ? (
                  <Spinner size="sm" />
                ) : (
                  <i className="fa-solid fa-wand-magic-sparkles" />
                )}
                {t('admin.urlManager.autoFixSelected')}
              </button>
            </div>
          )}

          {loadingBusinesses ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : businesses.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              {searchTerm ? (
                <>
                  <i className="fa-solid fa-search text-4xl mb-4" />
                  <p>No se encontraron empresas que coincidan con "{searchTerm}"</p>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-check-circle text-4xl text-green-500 mb-4" />
                  <p>{t('admin.urlManager.noProblematicUrls')}</p>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-zinc-700">
                    <th className="text-left py-3 px-4">
                      <input
                        type="checkbox"
                        checked={selectedBusinesses.size === businesses.length && businesses.length > 0}
                        onChange={selectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                      {t('admin.urlManager.business')}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                      {t('admin.urlManager.currentUrl')}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                      {t('admin.urlManager.suggestedUrl')}
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                      {t('admin.urlManager.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {businesses.map((business) => (
                    <tr
                      key={business.id}
                      className="border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedBusinesses.has(business.id)}
                          onChange={() => toggleSelection(business.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {business.logo_url ? (
                            <img
                              src={business.logo_url}
                              alt=""
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center">
                              <i className="fa-solid fa-building text-gray-400 text-xs" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white text-sm">
                              {business.name}
                            </p>
                            <p className="text-xs text-gray-500">{business.country}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <code className={`text-xs px-2 py-1 rounded break-all ${
                          business.slug
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                            : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                        }`}>
                          {getCurrentUrl(business)}
                        </code>
                        {business.slug && (
                          <span className="ml-2 text-xs text-green-600 dark:text-green-400">
                            <i className="fa-solid fa-check" /> OK
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {!business.slug ? (
                          <code className="text-xs bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-2 py-1 rounded break-all">
                            {getSuggestedUrl(business)}
                          </code>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(business)}
                            className="text-brand-dark hover:text-brand-dark/80 font-medium text-sm"
                          >
                            <i className="fa-solid fa-pen mr-1" />
                            {t('admin.urlManager.edit')}
                          </button>
                          {business.slug && (
                            <button
                              onClick={() => handleRemoveSlug(business.id, business.name)}
                              className="text-red-500 hover:text-red-600 font-medium text-sm"
                              title="Eliminar slug (volver a URL por nombre)"
                            >
                              <i className="fa-solid fa-trash" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Redirects Tab - Updated */}
      {activeTab === 'redirects' && (
        <div>
          {loadingRedirects ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : redirects.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <i className="fa-solid fa-link-slash text-4xl mb-4" />
              <p>{t('admin.urlManager.noRedirects')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-zinc-700">
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                      {t('admin.urlManager.oldUrl')}
                    </th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                      {t('admin.urlManager.redirectsTo')}
                    </th>
                    <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                      {t('admin.urlManager.hits')}
                    </th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                      {t('admin.urlManager.created')}
                    </th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                      {t('admin.urlManager.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {redirects.map((redirect) => (
                    <tr
                      key={redirect.id}
                      className="border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                    >
                      <td className="py-2 px-3">
                        <code className="text-xs bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 px-2 py-1 rounded break-all">
                          /empresa/{redirect.old_slug}
                        </code>
                      </td>
                      <td className="py-2 px-3">
                        <code className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded break-all">
                          /empresa/{redirect.businesses?.slug || redirect.businesses?.name || '???'}
                        </code>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          {redirect.hits}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span className="text-xs text-gray-500">
                          {new Date(redirect.created_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {redirect.businesses && (
                            <button
                              onClick={() => {
                                // Crear objeto BusinessForSlug desde los datos del redirect
                                const businessForEdit: BusinessForSlug = {
                                  id: redirect.businesses.id,
                                  name: redirect.businesses.name,
                                  slug: redirect.businesses.slug || null,
                                  country: redirect.businesses.country || null,
                                  logo_url: redirect.businesses.logo_url || null,
                                  created_at: redirect.created_at
                                };
                                // Pasar true para indicar que viene del tab de redirecciones
                                handleEdit(businessForEdit, true);
                              }}
                              className="text-brand-dark hover:text-brand-dark/80 text-sm"
                              title={t('admin.urlManager.editSlug')}
                            >
                              <i className="fa-solid fa-pen" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteRedirect(redirect.id)}
                            className="text-red-500 hover:text-red-600 text-sm"
                            title={t('admin.urlManager.deleteRedirect')}
                          >
                            <i className="fa-solid fa-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editingBusiness && (
        <Modal
          title={t('admin.urlManager.editSlug')}
          onClose={() => setEditingBusiness(null)}
        >
          <div className="py-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('admin.urlManager.businessName')}
              </label>
              <p className="text-gray-900 dark:text-white font-medium">
                {editingBusiness.name}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('admin.urlManager.currentUrl')}
              </label>
              <code className="text-sm bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 px-2 py-1 rounded block">
                {getCurrentUrl(editingBusiness)}
              </code>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('admin.urlManager.newSlug')}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  className={`w-full p-3 border rounded-lg bg-transparent ${
                    slugAvailable === false
                      ? 'border-red-500'
                      : slugAvailable === true
                      ? 'border-green-500'
                      : 'border-gray-300 dark:border-zinc-600'
                  }`}
                  placeholder="mi_empresa"
                />
                {checkingSlug && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Spinner size="sm" />
                  </div>
                )}
                {!checkingSlug && slugAvailable !== null && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {slugAvailable ? (
                      <i className="fa-solid fa-check text-green-500" />
                    ) : (
                      <i className="fa-solid fa-times text-red-500" />
                    )}
                  </div>
                )}
              </div>
              {slugAvailable === false && (
                <p className="text-sm text-red-500 mt-1">
                  {!isValidSlug(newSlug)
                    ? t('admin.urlManager.invalidSlug')
                    : t('admin.urlManager.slugTaken')}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('admin.urlManager.preview')}
              </label>
              <code className="text-sm bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-2 py-1 rounded block">
                /{editingBusiness.country?.toLowerCase() || 'es'}/empresa/{newSlug}
              </code>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="createRedirect"
                checked={createRedirect}
                onChange={(e) => setCreateRedirect(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="createRedirect" className="text-sm text-gray-700 dark:text-gray-300">
                {t('admin.urlManager.createRedirect')}
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setEditingBusiness(null)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={!slugAvailable || saving}
                className="flex-1 px-4 py-2 bg-brand-dark text-white rounded-lg font-medium hover:bg-brand-dark/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Spinner size="sm" /> : <i className="fa-solid fa-save" />}
                {t('common.save')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AdminUrlManagerPage;
