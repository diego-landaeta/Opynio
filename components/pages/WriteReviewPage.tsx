import React, { useState, useRef, useEffect, useCallback } from 'react';
import StarRating from '../StarRating';
import AudioPlayer from '../AudioPlayer';
import { useAuth } from '../../contexts/AuthContext';
import type { Database, Business, BusinessListItem } from '../../types';
import { CATEGORIES } from '../../constants';
import { createReview, searchBusinessList, getBusinessListItemById, userCreateBusiness, getPublicProductById, getPublicBusinessProducts, linkOwnReviewToProduct } from '../../services/supabaseService';
import { generateReviewDraft, AI_ENABLED } from '../../services/geminiService';
import Spinner from '../Spinner';
import BusinessLogo from '../BusinessLogo';
import Meta from '../Meta';
import Modal from '../Modal';
// FIX: Changed react-router-dom namespace import to named imports to resolve module resolution issues.
import { Link, useLocation } from 'react-router-dom';
import { useNotification } from '../../contexts/NotificationContext';
import { getUserFacingError } from '../../utils/userFacingError';
import { useTranslation, useI18n } from '../../contexts/i18nContext';
import { getBusinessDashboardPath } from '../../utils/businessOwnership';
import OwnBusinessBadge from '../OwnBusinessBadge';
import { getSubcategoryKey } from '../../utils/categoryMappings';

type ReviewType = 'text' | 'audio';
type RecordingStatus = 'idle' | 'recording' | 'stopped';
type SubmissionStatus = 'idle' | 'uploading' | 'submitting';

const DRAFT_KEY = 'opynio_review_draft';
// Mismos limites que el bucket review_media (migracion 20260923140000).
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGES = 5;
// Audio: los mismos tipos que admite el bucket review_media (migracion
// 20260923140000_storage_bucket_limits.sql). Con `audio/*` se podia elegir un
// .flac o .aac que Storage rechaza, y la resena se publicaba sin audio.
const ALLOWED_AUDIO_TYPES = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/x-m4a', 'audio/ogg', 'audio/wav', 'audio/x-wav'];
// Alias que dan algunos navegadores/sistemas para esos mismos formatos, y el
// tipo por extension cuando el navegador no da ninguno.
const AUDIO_TYPE_ALIASES: Record<string, string> = {
    'audio/mp3': 'audio/mpeg', 'audio/x-mp3': 'audio/mpeg', 'audio/x-mpeg': 'audio/mpeg',
    'audio/m4a': 'audio/x-m4a', 'audio/vnd.wave': 'audio/wav', 'audio/wave': 'audio/wav',
    'video/webm': 'audio/webm', 'application/ogg': 'audio/ogg',
};
const AUDIO_TYPE_BY_EXTENSION: Record<string, string> = {
    mp3: 'audio/mpeg', m4a: 'audio/x-m4a', ogg: 'audio/ogg', oga: 'audio/ogg',
    wav: 'audio/wav', webm: 'audio/webm', weba: 'audio/webm',
};
const AUDIO_ACCEPT = [...ALLOWED_AUDIO_TYPES, '.mp3', '.m4a', '.ogg', '.oga', '.wav', '.webm', '.weba'].join(',');
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

// Devuelve el fichero con un tipo que el bucket admite, o null si no vale.
const normalizarAudio = (file: File): File | null => {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const bruto = (file.type || '').split(';')[0].trim().toLowerCase();
    const tipo = ALLOWED_AUDIO_TYPES.includes(bruto)
        ? bruto
        : AUDIO_TYPE_ALIASES[bruto] || (!bruto || bruto === 'application/octet-stream' ? AUDIO_TYPE_BY_EXTENSION[ext] : undefined);
    if (!tipo) return null;
    return tipo === file.type ? file : new File([file], file.name, { type: tipo });
};
const DRAFT_EXPIRATION_MS = 60 * 60 * 1000; // 1 hour

interface DraftImage {
    name: string;
    type: string;
    dataUrl: string;
}

interface DraftAudio {
    name: string;
    type: string;
    dataUrl: string;
}

interface ReviewDraft {
    timestamp: number;
    data: {
        selectedBusinessId: string;
        category: string;
        rating: number;
        title: string;
        text: string;
        isVerifiedPurchase: boolean;
        images: DraftImage[];
        audio: DraftAudio | null;
        reviewType: ReviewType;
        productId?: string;
    };
}

const BusinessSearchResultItem: React.FC<{ business: BusinessListItem, onSelect: (business: BusinessListItem) => void, isOwn?: boolean }> = ({ business, onSelect, isOwn = false }) => {
    const t = useTranslation();

    const getCategoryTranslation = (categoryString: string | null): string => {
        if (!categoryString) return '';

        let mainCategory = categoryString;
        let subCategory = '';

        if (categoryString.includes(':')) {
            [mainCategory, subCategory] = categoryString.split(':');
            mainCategory = mainCategory.trim();
            subCategory = subCategory.trim();
        }

        const translatedMain = t(`categories.${mainCategory}`);
        const mainCategoryTranslated = translatedMain.startsWith('categories.') ? mainCategory : translatedMain;

        if (subCategory) {
            // Use mapping to get the correct translation key
            // Check if already in snake_case or Spanish format
            const subCategoryKey = subCategory.includes('_') ? subCategory : getSubcategoryKey(subCategory);

            if (subCategoryKey) {
                const translatedSub = t(`subcategories.${subCategoryKey}`);
                const subCategoryTranslated = translatedSub.startsWith('subcategories.') ? subCategory : translatedSub;
                return `${mainCategoryTranslated}: ${subCategoryTranslated}`;
            }

            // Fallback if no mapping found
            return `${mainCategoryTranslated}: ${subCategory}`;
        }

        return mainCategoryTranslated;
    };

    return (
        <li
            // Su propio negocio sale en la lista (si no, "no encontrado"
            // confunde), pero no se puede elegir.
            onClick={isOwn ? undefined : () => onSelect(business)}
            aria-disabled={isOwn || undefined}
            title={isOwn ? t('businessPage.cannotReviewOwnBusiness') : undefined}
            data-own-business={isOwn ? 'true' : undefined}
            className={`px-4 py-2 flex items-center gap-3 ${isOwn ? 'cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-zinc-700 cursor-pointer'}`}
        >
            <BusinessLogo
                logoUrl={business.logo_url}
                businessName={business.name}
                tone={(business as any).logo_tone}
                className={`w-10 h-10 ${isOwn ? 'opacity-60' : ''}`}
                rounded="rounded-md"
                iconSize="text-base"
                fit="cover"
                padding=""
                width={40}
                height={40}
            />
            {/* Atenuado el nombre, no la etiqueta: «Tu negocio» es el motivo y debe leerse. */}
            <div className={isOwn ? '[&>p]:opacity-60' : undefined}>
                <p className="font-semibold text-gray-800 dark:text-gray-200">{business.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{getCategoryTranslation(business.category)}</p>
                {isOwn && <OwnBusinessBadge business={business} className="mt-1" />}
            </div>
        </li>
    );
};


const WriteReviewPage: React.FC = () => {
    const [reviewType, setReviewType] = useState<ReviewType>('text');
    const [rating, setRating] = useState(0);
    const [title, setTitle] = useState('');
    const [text, setText] = useState('');
    const [isVerifiedPurchase, setIsVerifiedPurchase] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>('idle');
    const [timer, setTimer] = useState(0);
    const [selectedBusinessId, setSelectedBusinessId] = useState<string>('');
    const [category, setCategory] = useState('');
    const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus>('idle');
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [draftLoaded, setDraftLoaded] = useState(false);
    const [showUsernameModal, setShowUsernameModal] = useState(false);
    
    // State for image handling and drag-and-drop
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // AI Assistant State
    const [isAssistantOpen, setIsAssistantOpen] = useState(false);
    const [keyPoints, setKeyPoints] = useState('');
    const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
    const [generatedDraft, setGeneratedDraft] = useState<{ title: string; reviewText: string } | null>(null);
    const [generationError, setGenerationError] = useState<string | null>(null);

    // Business Search State
    const [businessSearchTerm, setBusinessSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<BusinessListItem[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isResultsVisible, setIsResultsVisible] = useState(false);
    const searchContainerRef = useRef<HTMLDivElement>(null);
    const [selectedBusinessLogoUrl, setSelectedBusinessLogoUrl] = useState<string | null>(null);
    
    // Create Business Modal State
    const [isCreateBusinessModalOpen, setIsCreateBusinessModalOpen] = useState(false);
    const [newBusinessData, setNewBusinessData] = useState({ name: '', category: '', website_url: '', logo_url: '', description: '' });
    const [isCreatingBusiness, setIsCreatingBusiness] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    const t = useTranslation();
    const { user, profile, businesses: misEmpresas, loading: authLoading } = useAuth();
    const { language } = useI18n();
    // Empresa elegida que es del propio usuario (llegó preseleccionada por URL,
    // estado o borrador): se avisa y no se deja enviar.
    const empresaPropiaElegida = selectedBusinessId ? (misEmpresas.find(b => b.id === selectedBusinessId) ?? null) : null;
    const esEmpresaPropiaElegida = empresaPropiaElegida !== null;
    const { showNotification } = useNotification();
    const location = useLocation();
    // El widget enlaza con ?businessId=…&producto=…, pero hasta ahora solo se
    // miraba location.state: quien llegaba desde un widget aterrizaba en el
    // formulario sin empresa preseleccionada.
    const paramsDeLaUrl = new URLSearchParams(location.search);
    const preselectedBusinessId = location.state?.businessId || paramsDeLaUrl.get('businessId') || undefined;
    const productoSolicitado = paramsDeLaUrl.get('producto') || null;
    // Producto sobre el que se está opinando, si se llegó desde su widget.
    const [productoDeLaResena, setProductoDeLaResena] = useState<{ id: string; business_id: string; name: string } | null>(null);

    useEffect(() => {
        if (!productoSolicitado) return;
        let cancelado = false;
        getPublicProductById(productoSolicitado)
            .then(prod => { if (!cancelado) setProductoDeLaResena(prod); })
            .catch(() => { /* producto borrado o desactivado: reseña normal */ });
        return () => { cancelado = true; };
    }, [productoSolicitado]);

    // Productos activos de la empresa elegida. Quien escribe la resena elige
    // aqui sobre que producto opina; antes solo se podia llegando desde el
    // widget de un producto, y el resto quedaba "sin asignar" hasta que el
    // dueno la asignaba a mano en su panel.
    const [productosEmpresa, setProductosEmpresa] = useState<Array<{ id: string; name: string }>>([]);
    const [productoElegidoId, setProductoElegidoId] = useState<string>('');
    // Buscador del selector: una empresa puede tener mas de mil cursos (Psiko
    // Aprende, 1.006) y un desplegable de mil opciones no se puede usar.
    const [busquedaProducto, setBusquedaProducto] = useState('');
    const normalizarBusqueda = (texto: string) =>
        texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const { productosFiltrados, coincidenciasBusqueda } = React.useMemo(() => {
        const q = normalizarBusqueda(busquedaProducto.trim());
        if (!q) return { productosFiltrados: productosEmpresa, coincidenciasBusqueda: productosEmpresa.length };
        const palabras = q.split(/\s+/);
        const coinciden = productosEmpresa.filter(p => {
            const nombre = normalizarBusqueda(p.name);
            return palabras.every(w => nombre.includes(w));
        });
        // El elegido se mantiene en la lista aunque no coincida, para que el
        // desplegable no cambie de valor solo por escribir en el buscador.
        const elegido = productosEmpresa.find(p => p.id === productoElegidoId);
        const lista = elegido && !coinciden.some(p => p.id === elegido.id) ? [elegido, ...coinciden] : coinciden;
        return { productosFiltrados: lista, coincidenciasBusqueda: coinciden.length };
    }, [productosEmpresa, busquedaProducto, productoElegidoId]);
    // Producto guardado en el borrador. Se aplica cuando llegan los productos de
    // la empresa: restaurar el borrador cambia la empresa, y ese cambio limpia
    // la seleccion antes de cargar la lista.
    const productoDelBorradorRef = useRef<string | null>(null);

    useEffect(() => {
        setProductosEmpresa([]);
        setProductoElegidoId('');
        setBusquedaProducto('');
        if (!selectedBusinessId) return;
        let cancelado = false;
        getPublicBusinessProducts(selectedBusinessId)
            .then(productos => {
                if (cancelado) return;
                setProductosEmpresa(productos.map(p => ({ id: p.id, name: p.name })));
                // Si se llego desde el widget de un producto de esta empresa,
                // viene preseleccionado; el usuario puede cambiarlo.
                const delBorrador = productoDelBorradorRef.current;
                productoDelBorradorRef.current = null;
                if (delBorrador && productos.some(p => p.id === delBorrador)) {
                    setProductoElegidoId(delBorrador);
                } else if (productoDeLaResena && productoDeLaResena.business_id === selectedBusinessId
                    && productos.some(p => p.id === productoDeLaResena.id)) {
                    setProductoElegidoId(productoDeLaResena.id);
                }
            })
            .catch(() => { /* sin productos: la resena es de la empresa */ });
        return () => { cancelado = true; };
    }, [selectedBusinessId, productoDeLaResena]);

    // Helper function to translate category string
    const getCategoryTranslation = (categoryString: string | null): string => {
        if (!categoryString) return '';

        if (categoryString.includes(':')) {
            const [mainKey, subKey] = categoryString.split(':').map(s => s.trim());
            const mainTranslation = t(`categories.${mainKey}`);
            const subTranslation = t(`subcategories.${subKey}`);

            // Check if translations were found (they won't start with the prefix if found)
            const mainDisplay = mainTranslation.startsWith('categories.')
                ? mainKey.replace(/_/g, ' ')
                : mainTranslation;
            const subDisplay = subTranslation.startsWith('subcategories.')
                ? subKey.replace(/_/g, ' ')
                : subTranslation;

            return `${mainDisplay}: ${subDisplay}`;
        }

        // Try to translate as a main category
        const translation = t(`categories.${categoryString}`);
        return translation.startsWith('categories.')
            ? categoryString.replace(/_/g, ' ')
            : translation;
    };

    const handleSelectBusiness = useCallback((business: BusinessListItem) => {
        setSelectedBusinessId(business.id);
        setBusinessSearchTerm(business.name);
        setCategory(business.category || '');
        setSelectedBusinessLogoUrl(business.logo_url);
        setIsResultsVisible(false);
        setSearchResults([]);
    }, []);

    // Effect to pre-select business if passed in state
    useEffect(() => {
        if (preselectedBusinessId && !selectedBusinessId) {
            const fetchAndSetPreselectedBusiness = async () => {
                try {
                    const businessDetails = await getBusinessListItemById(preselectedBusinessId);
                    if (businessDetails) {
                        handleSelectBusiness(businessDetails);
                    }
                } catch (error) {
                    console.error("Failed to fetch pre-selected business details:", error);
                }
            };
            fetchAndSetPreselectedBusiness();
        }
    }, [preselectedBusinessId, selectedBusinessId, handleSelectBusiness]);
    
     // Debounced effect for business search
    useEffect(() => {
        if (businessSearchTerm.length < 2) {
            setSearchResults([]);
            setIsResultsVisible(false);
            return;
        }

        const handler = setTimeout(async () => {
            setIsSearching(true);
            try {
                const results = await searchBusinessList(businessSearchTerm);
                setSearchResults(results);
                setIsResultsVisible(true);
            } catch (error) {
                console.error("Failed to search businesses:", error);
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 300); // 300ms debounce

        return () => {
            clearTimeout(handler);
        };
    }, [businessSearchTerm]);
    
    // Effect to close search results when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
                setIsResultsVisible(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const term = e.target.value;
        setBusinessSearchTerm(term);
        // If user changes search, deselect the business until they pick a new one
        if (selectedBusinessId) {
            const selectedBusinessName = businessSearchTerm; // The current value before this change
            if (term !== selectedBusinessName) {
                 setSelectedBusinessId('');
                 setCategory('');
                 setSelectedBusinessLogoUrl(null);
            }
        }
    };

    // Helper to convert File/Blob to a serializable format (Data URL)
    const blobToDataUrl = (blob: Blob): Promise<string> =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    
    // Helper to convert Data URL back to a File
    const dataUrlToFile = async (dataUrl: string, name: string, type: string): Promise<File> => {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        return new File([blob], name, { type });
    };

    // Load draft from localStorage on initial component mount
    useEffect(() => {
        const loadDraft = async () => {
            const savedDraftJson = localStorage.getItem(DRAFT_KEY);
            if (savedDraftJson) {
                try {
                    const savedDraft: ReviewDraft = JSON.parse(savedDraftJson);
                    const isExpired = Date.now() - savedDraft.timestamp > DRAFT_EXPIRATION_MS;

                    if (isExpired) {
                        localStorage.removeItem(DRAFT_KEY);
                        return;
                    }
                    
                    const { data } = savedDraft;
                    // Borrador de una empresa propia: no se puede enviar, y
                    // restaurarlo dejaba al dueño con su empresa fijada, sin
                    // buscador y con «Hemos cargado un borrador guardado».
                    if (data.selectedBusinessId && misEmpresas.some(b => b.id === data.selectedBusinessId)) {
                        localStorage.removeItem(DRAFT_KEY);
                        return;
                    }
                    if (preselectedBusinessId && data.selectedBusinessId !== preselectedBusinessId) {
                        return;
                    }
                    productoDelBorradorRef.current = data.productId || null;
                    setSelectedBusinessId(data.selectedBusinessId);
                    
                    if (data.selectedBusinessId) {
                       const businessDetails = await getBusinessListItemById(data.selectedBusinessId);
                       if(businessDetails) {
                           setBusinessSearchTerm(businessDetails.name);
                           setCategory(businessDetails.category || '');
                           setSelectedBusinessLogoUrl(businessDetails.logo_url);
                       }
                    } else {
                        setCategory(data.category);
                    }

                    setRating(data.rating);
                    setTitle(data.title);
                    setText(data.text);
                    setIsVerifiedPurchase(data.isVerifiedPurchase);
                    setReviewType(data.reviewType);

                    if (data.images && data.images.length > 0) {
                        const restoredImageFiles = await Promise.all(
                            data.images.map(img => dataUrlToFile(img.dataUrl, img.name, img.type))
                        );
                        setImageFiles(restoredImageFiles);
                        const newPreviews = restoredImageFiles.map(file => URL.createObjectURL(file));
                        setImagePreviews(newPreviews);
                    }

                    if (data.audio) {
                        const restoredAudioFile = await dataUrlToFile(data.audio.dataUrl, data.audio.name, data.audio.type);
                        setAudioBlob(restoredAudioFile);
                        setAudioUrl(URL.createObjectURL(restoredAudioFile));
                        setRecordingStatus('stopped');
                    }
                    
                    setDraftLoaded(true);

                } catch (error) {
                    console.error("Failed to load or parse draft:", error);
                    localStorage.removeItem(DRAFT_KEY);
                }
            }
        };

        // Con empresa preseleccionada en la URL (widget, invitacion) solo se
        // recupera el borrador si es de esa misma empresa. Es el caso de volver
        // tras poner el username en el perfil: antes se perdia lo escrito.
        // Se espera a que AuthContext haya cargado las empresas del usuario:
        // sin ellas no se sabe si el borrador es de una empresa suya.
        // misEmpresas no va en las dependencias a proposito: si cambia despues
        // (realtime), no hay que volver a pisar el formulario con el borrador.
        if (authLoading) return;
        loadDraft();
    }, [preselectedBusinessId, authLoading]);

    // Red de seguridad: si las empresas del usuario llegan despues de restaurar
    // (sesion recien iniciada), un borrador de su propia empresa se descarta
    // igual. Con ?businessId= propio, la preseleccion la vuelve a fijar, ya
    // bloqueada y con el aviso, pero sin borrador.
    useEffect(() => {
        if (draftLoaded && esEmpresaPropiaElegida) resetForm();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draftLoaded, esEmpresaPropiaElegida]);

    // Save draft to localStorage whenever form state changes (debounced)
    useEffect(() => {
        // Mientras AuthContext carga no se sabe si la empresa es del usuario (y
        // el formulario vacio borraria el borrador antes de restaurarlo).
        if (authLoading) return;
        // Empresa propia: no se guarda borrador. Esa reseña no se puede enviar
        // y el borrador la volvia a abrir en la siguiente visita.
        if (esEmpresaPropiaElegida) return;
        // Debounce handler
        const handler = setTimeout(async () => {
            // Don't save an empty form
            if (!selectedBusinessId && !title && !text && imageFiles.length === 0 && !audioBlob) {
                 if (localStorage.getItem(DRAFT_KEY)) {
                    localStorage.removeItem(DRAFT_KEY);
                }
                return;
            }
            
            const imagePromises = imageFiles.map(async file => ({
                name: file.name,
                type: file.type,
                dataUrl: await blobToDataUrl(file),
            }));

            const images = await Promise.all(imagePromises);
            
            let audio: DraftAudio | null = null;
            if (audioBlob) {
                audio = {
                    name: `audio-recording-${Date.now()}.webm`,
                    type: audioBlob.type,
                    dataUrl: await blobToDataUrl(audioBlob),
                };
            }

            const draft: ReviewDraft = {
                timestamp: Date.now(),
                data: {
                    selectedBusinessId,
                    category,
                    rating,
                    title,
                    text,
                    isVerifiedPurchase,
                    images,
                    audio,
                    reviewType,
                    productId: productoElegidoId || undefined,
                }
            };

            localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        }, 1000); // Save 1 second after user stops changing form

        return () => {
            clearTimeout(handler);
        };
    }, [selectedBusinessId, category, rating, title, text, isVerifiedPurchase, imageFiles, audioBlob, reviewType, productoElegidoId, authLoading, esEmpresaPropiaElegida]);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        return () => {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
             if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
            }
             imagePreviews.forEach(url => URL.revokeObjectURL(url));
        };
    }, [audioUrl, imagePreviews]);
    
    useEffect(() => {
        let timerId: ReturnType<typeof setTimeout>;
        if (showSuccessModal) {
            timerId = setTimeout(() => {
                setShowSuccessModal(false);
            }, 15000); // 15 seconds
        }
        return () => {
            if (timerId) {
                clearTimeout(timerId);
            }
        };
    }, [showSuccessModal]);

    const resetForm = useCallback(() => {
        setSelectedBusinessId('');
        setBusinessSearchTerm('');
        setSelectedBusinessLogoUrl(null);
        setCategory('');
        setRating(0);
        setTitle('');
        setText('');
        setAudioBlob(null);
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
        setReviewType('text');
        setRecordingStatus('idle');
        imagePreviews.forEach(url => URL.revokeObjectURL(url));
        setImageFiles([]);
        setImagePreviews([]);
        setIsVerifiedPurchase(false);
        // Clear draft from storage and state
        localStorage.removeItem(DRAFT_KEY);
        setDraftLoaded(false);
    }, [audioUrl, imagePreviews]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        if (!profile?.username) {
            setShowUsernameModal(true);
            return;
        }

        setSubmissionStatus('submitting');
        setSubmitError(null);
        setShowErrorModal(false);

        if (!user) {
            setSubmitError(t('mustLogInToWriteReview'));
            setShowErrorModal(true);
            setSubmissionStatus('idle');
            return;
        }

        // Un dueño no puede opinar de su propio negocio (en producción quedó
        // una reseña "El negocio es mío." de una dueña intentando reclamarlo).
        if (empresaPropiaElegida) {
            setSubmitError(t('businessPage.cannotReviewOwnBusiness'));
            setShowErrorModal(true);
            setSubmissionStatus('idle');
            return;
        }

        const missingFields: string[] = [];
        if (!selectedBusinessId) missingFields.push(t('business'));
        if (!category) missingFields.push(t('category'));
        if (rating === 0) missingFields.push(t('rating'));
        if (!title.trim()) missingFields.push(t('title'));
        // Una resena de audio sin audio saldria vacia (solo titulo y estrellas).
        if (reviewType === 'audio' && !audioBlob) missingFields.push(t('writeReviewPage.reviewTypeAudio'));

        if (missingFields.length > 0) {
            const errorMessage = `${t('pleaseCompleteFields')}: ${missingFields.join(', ')}.`;
            setSubmitError(errorMessage);
            setShowErrorModal(true);
            setSubmissionStatus('idle');
            return;
        }

        const tags: string[] = [];
        if (reviewType === 'text') tags.push('texto');
        if (imageFiles.length > 0) tags.push('imágenes');
        if (audioBlob) tags.push('audio');
        
        const reviewInsert: Database['public']['Tables']['reviews']['Insert'] = {
            rating,
            title,
            // review_text es NOT NULL: una resena de audio mandaba null y el
            // insert fallaba (23502) despues de haber subido el audio.
            review_text: reviewType === 'text' ? text : '',
            user_id: user.id,
            business_id: selectedBusinessId,
            category,
            tags,
            is_verified_purchase: isVerifiedPurchase,
            status: 'pending',
        };

        try {
            if (audioBlob || imageFiles.length > 0) {
                setSubmissionStatus('uploading');
            }
            const resenaCreada = await createReview(reviewInsert, {
                audioBlob: audioBlob || undefined,
                imageFiles: imageFiles.length > 0 ? imageFiles : undefined
            });

            // El producto elegido en el formulario (o el del widget, que llega
            // preseleccionado). Va DESPUÉS de crearla: si el enlace falla, la
            // reseña está publicada igual, que es lo que le importa al autor.
            if (productoElegidoId && (resenaCreada as any)?.id
                && productosEmpresa.some(p => p.id === productoElegidoId)) {
                try {
                    await linkOwnReviewToProduct(String((resenaCreada as any).id), productoElegidoId);
                } catch (linkError) {
                    console.error('No se pudo asociar la reseña al producto:', linkError);
                }
            }

            setShowSuccessModal(true);
            resetForm();
            setSubmissionStatus('idle');
        } catch (error: any) {
             const msg = error?.message === 'ALREADY_REVIEWED'
                 ? t('alreadyReviewedThisBusiness')
                 : error?.message === 'OWN_BUSINESS_REVIEW'
                     ? t('businessPage.cannotReviewOwnBusiness')
                     : error?.message === 'AUDIO_UPLOAD_FAILED'
                         // La resena NO se ha creado; el formulario conserva todo.
                         ? t('writeReviewPage.audioUploadFailed')
                         // El resto, traducido (nunca el texto de PostgREST).
                         : t((await getUserFacingError(error, { fallbackKey: 'writeReviewPage.errorPublishingReview' })).key);
             setSubmitError(msg);
             setShowErrorModal(true);
             setSubmissionStatus('idle');
        }
    };
    
    const processImageFiles = (files: File[]) => {
        // Lista cerrada de formatos, no `image/*`: arrastrando un fichero se
        // saltaba el `accept` del input y entraban SVG, que se sirven como
        // image/svg+xml y ejecutan su <script> al abrir la foto.
        const imageFiles = files
            .filter(file => ALLOWED_IMAGE_TYPES.includes(file.type) && file.size <= MAX_IMAGE_BYTES)
            .slice(0, MAX_IMAGES);

        if (imageFiles.length < files.length) {
            showNotification(t('writeReviewPage.photosSkipped'), 'info');
        }

        if (imageFiles.length > 0) {
            setImageFiles(imageFiles);
            // Clean up old previews
            imagePreviews.forEach(url => URL.revokeObjectURL(url));
            const newPreviews = imageFiles.map(file => URL.createObjectURL(file));
            setImagePreviews(newPreviews);
        }
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // FIX: Replaced `Array.from()` with the spread syntax `[...]` to correctly convert a `FileList` to a `File[]`. This resolves a TypeScript type inference issue where `Array.from()` was producing `unknown[]`.
        const files = e.target.files ? [...e.target.files] : [];
        processImageFiles(files);
    };
    
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        // FIX: Replaced `Array.from()` with the spread syntax `[...]` to correctly convert a `FileList` to a `File[]`. This resolves a TypeScript type inference issue where `Array.from()` was producing `unknown[]`.
        const files = [...e.dataTransfer.files];
        processImageFiles(files);
    };

    const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const elegido = e.target.files?.[0];
        if (elegido) {
            // El `accept` no basta: en el dialogo se puede cambiar a «Todos los
            // archivos». Se valida el tipo contra la lista del bucket.
            const file = normalizarAudio(elegido);
            if (!file) {
                showNotification(t('writeReviewPage.audioInvalidType'), 'error');
                e.target.value = '';
                return;
            }
            if (file.size > MAX_AUDIO_BYTES) {
                showNotification(t('audioFileTooLarge'), 'error');
                e.target.value = '';
                return;
            }
            setAudioBlob(file);
            if (audioUrl) URL.revokeObjectURL(audioUrl); // Clean up previous blob URL
            setAudioUrl(URL.createObjectURL(file as Blob));
            setRecordingStatus('stopped'); // Show the player
            if(timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            setTimer(0);
        }
    };

    const removeImage = (indexToRemove: number) => {
        URL.revokeObjectURL(imagePreviews[indexToRemove]);
        setImageFiles(prev => prev.filter((_, index) => index !== indexToRemove));
        setImagePreviews(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            mediaRecorderRef.current.ondataavailable = (event) => {
                chunksRef.current.push(event.data);
            };
            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                setAudioBlob(blob);
                if (audioUrl) URL.revokeObjectURL(audioUrl); // Clean up previous blob URL
                setAudioUrl(URL.createObjectURL(blob));
                chunksRef.current = [];
                stream.getTracks().forEach(track => track.stop());
            };
            mediaRecorderRef.current.start();
            setRecordingStatus('recording');
            setTimer(0);
            timerIntervalRef.current = setInterval(() => {
                setTimer(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            showNotification(t('microphoneAccessError'), 'error');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && recordingStatus === 'recording') {
            mediaRecorderRef.current.stop();
            setRecordingStatus('stopped');
            if(timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        }
    };
    
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };
    
    const handleGenerateDraft = async () => {
        if (!selectedBusinessId || rating === 0) {
            setGenerationError(t('selectBusinessAndRatingError'));
            return;
        }
        if (!keyPoints.trim()) {
            setGenerationError(t('enterKeyPointsError'));
            return;
        }
        
        setIsGeneratingDraft(true);
        setGenerationError(null);
        setGeneratedDraft(null);

        try {
            const businessName = businessSearchTerm || 'un negocio';
            const draft = await generateReviewDraft(keyPoints, businessName, rating);
            setGeneratedDraft(draft);
            setReviewType('text');
        } catch (err: any) {
            // Nunca el mensaje tecnico: salia «Failed to generate AI review
            // draft.» en ingles. Se explica que el asistente no esta y que
            // puede escribirla a mano (el formulario sigue disponible).
            console.error('AI draft failed:', err);
            setGenerationError(t('writeReviewPage.aiDraftUnavailable'));
        } finally {
            setIsGeneratingDraft(false);
        }
    };

    const resetAssistant = () => {
        setIsAssistantOpen(false);
        setKeyPoints('');
        setGeneratedDraft(null);
        setGenerationError(null);
        setIsGeneratingDraft(false);
    };

    const handleCreateBusinessSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreatingBusiness(true);
        setCreateError(null);
        try {
            const created = await userCreateBusiness({
                name: newBusinessData.name.trim(),
                category: newBusinessData.category,
                website_url: newBusinessData.website_url.trim(),
                logo_url: newBusinessData.logo_url.trim() || null,
                description: newBusinessData.description.trim() || null,
            });

            const businessListItem: BusinessListItem = {
                id: created.id,
                name: created.name,
                category: created.category,
                logo_url: created.logo_url,
            };
            
            handleSelectBusiness(businessListItem);
            setIsCreateBusinessModalOpen(false);
            showNotification(t('businessCreatedSuccess'), 'success');

        } catch (err: any) {
            // Traducido; una empresa repetida (23505) lo dice asi.
            const info = await getUserFacingError(err, { flow: 'businessSignup', fallbackKey: 'writeReviewPage.errorCreatingBusiness' });
            setCreateError(t(info.key));
        } finally {
            setIsCreatingBusiness(false);
        }
    };

    const isSubmitting = submissionStatus === 'uploading' || submissionStatus === 'submitting';
    const buttonText = isSubmitting
        ? (submissionStatus === 'uploading' ? t('writeReviewPage.uploadingFiles') : t('writeReviewPage.publishing'))
        : t('writeReviewPage.publishReviewButton');


    return (
        <>
            <Meta
                title={t('writeReviewPage.writeReviewTitle') + " - Opynio"}
                description={t('writeReviewPage.metaDescription')}
            />
            <div className="max-w-[98vw] sm:max-w-4xl mx-auto bg-white dark:bg-zinc-800 p-3 sm:p-6 md:p-8 rounded-xl shadow-lg">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6 sm:mb-8">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2 text-gray-900 dark:text-gray-100">{t('writeReviewPage.writeReviewTitle')}</h1>
                        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">{t('writeReviewPage.writeReviewSubtitle')}</p>
                        {/* Se llegó desde el widget de un producto: se dice, porque
                            asociar la reseña en silencio sería peor que no asociarla. */}
                        {productoDeLaResena && productoElegidoId === productoDeLaResena.id && (
                            <p className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-xs sm:text-sm text-green-800 dark:text-green-200">
                                <i className="fa-solid fa-box-open" aria-hidden="true"></i>
                                <span>{t('writeReviewPage.reviewingProduct', { name: productoDeLaResena.name })}</span>
                            </p>
                        )}
                    </div>
                     <div className={`w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 bg-gray-50 dark:bg-zinc-700/50 border dark:border-zinc-700 rounded-lg flex items-center justify-center transition-all duration-300 ${selectedBusinessId ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
                        {selectedBusinessLogoUrl ? (
                            <img src={selectedBusinessLogoUrl} alt="Logo de la empresa" width={112} height={112} loading="lazy" decoding="async" className="w-full h-full object-contain p-2" />
                        ) : selectedBusinessId ? (
                            <i className="fa-solid fa-store text-3xl sm:text-4xl md:text-5xl text-gray-300 dark:text-gray-600"></i>
                        ) : null}
                    </div>
                </div>

                {draftLoaded && (
                    <div className="bg-blue-50 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-800/50 rounded-lg p-2.5 sm:p-3 mb-4 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 animate-fade-in-up">
                        <p className="text-xs sm:text-sm font-medium text-blue-800 dark:text-blue-200">
                            <i className="fa-solid fa-floppy-disk mr-1 sm:mr-2"></i>
                            {t('writeReviewPage.draftLoadedMessage')}
                        </p>
                        <button
                            type="button"
                            onClick={resetForm}
                            className="text-xs sm:text-sm font-semibold text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100 hover:underline whitespace-nowrap"
                        >
                            {t('writeReviewPage.discardDraft')}
                        </button>
                    </div>
                )}

                {showSuccessModal && (
                    <Modal title={t('writeReviewPage.successModalTitle')} onClose={() => setShowSuccessModal(false)}>
                        <div className="text-center py-3 sm:py-4">
                            <i className="fa-solid fa-check-circle text-4xl sm:text-5xl text-brand-green mb-3 sm:mb-4"></i>
                            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-2">
                                {t('writeReviewPage.successModalBody')}
                            </p>
                        </div>
                    </Modal>
                )}

                {showErrorModal && (
                    <Modal title={t('writeReviewPage.errorModalTitle')} onClose={() => {
                        setShowErrorModal(false);
                        setSubmitError(null);
                    }}>
                        <div className="text-center py-3 sm:py-4">
                            <i className="fa-solid fa-triangle-exclamation text-4xl sm:text-5xl text-red-500 mb-3 sm:mb-4"></i>
                            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-2">
                                {submitError}
                            </p>
                        </div>
                    </Modal>
                )}

                {showUsernameModal && (
                    <Modal title={t('writeReviewPage.usernameModalTitle')} onClose={() => setShowUsernameModal(false)}>
                        <div className="text-center py-3 sm:py-4">
                            <i className="fa-solid fa-user-pen text-4xl sm:text-5xl text-brand-green mb-3 sm:mb-4"></i>
                            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-2 mb-4 sm:mb-6">
                                {t('writeReviewPage.usernameModalBody')}
                            </p>
                            <Link
                                to={`/perfil/editar?volver=${encodeURIComponent(location.pathname + location.search)}`}
                                onClick={() => setShowUsernameModal(false)}
                                className="inline-block bg-brand-green text-white font-semibold px-4 sm:px-5 md:px-6 py-2 sm:py-2.5 md:py-3 text-sm sm:text-base rounded-md hover:bg-opacity-90 transition-all shadow-sm"
                            >
                                {t('writeReviewPage.goToEditProfile')}
                            </Link>
                        </div>
                    </Modal>
                )}

                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 md:space-y-6">
                     <div className="relative" ref={searchContainerRef}>
                        <label htmlFor="business-search" className="block text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1.5 sm:mb-2">{t('writeReviewPage.step1Title')}</label>
                        {selectedBusinessId ? (
                            <div className="flex items-center gap-3 p-2.5 sm:p-3 border border-gray-300 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-700 rounded-lg">
                                {selectedBusinessLogoUrl ? (
                                    <img src={selectedBusinessLogoUrl} alt="" className="w-8 h-8 sm:w-10 sm:h-10 object-contain rounded" />
                                ) : (
                                    <i className="fa-solid fa-store text-lg sm:text-xl text-gray-400 dark:text-gray-500 w-8 sm:w-10 text-center"></i>
                                )}
                                <span className="text-sm sm:text-base font-medium text-gray-800 dark:text-gray-200 flex-1">{businessSearchTerm}</span>
                                {/* Sin enlace: el aviso de debajo ya lleva «Gestionar». */}
                                <OwnBusinessBadge business={empresaPropiaElegida} className="flex-shrink-0" />
                                {!preselectedBusinessId && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedBusinessId('');
                                            setBusinessSearchTerm('');
                                            setCategory('');
                                            setSelectedBusinessLogoUrl(null);
                                        }}
                                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                    >
                                        <i className="fa-solid fa-xmark"></i>
                                    </button>
                                )}
                            </div>
                        ) : (
                        <div className="relative">
                             <input
                                id="business-search"
                                type="search"
                                value={businessSearchTerm}
                                onChange={handleSearchChange}
                                required
                                placeholder={t('writeReviewPage.searchBusinessPlaceholder')}
                                autoComplete="off"
                                className="w-full p-2.5 sm:p-3 text-sm sm:text-base border border-gray-300 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-700 dark:text-gray-200 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent"
                            />
                            {isSearching && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <div className="w-5 h-5 border-2 border-gray-300 border-t-brand-green rounded-full animate-spin"></div>
                                </div>
                            )}
                        </div>
                        )}
                        {empresaPropiaElegida && (
                            <div role="alert" data-own-business="true" className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-900 dark:text-amber-100">
                                <i className="fa-solid fa-store text-amber-600 dark:text-amber-400" aria-hidden="true"></i>
                                <p className="flex-1">{t('businessPage.cannotReviewOwnBusiness')}</p>
                                <Link to={getBusinessDashboardPath(empresaPropiaElegida, 'dashboardInvitations', language)} className="font-semibold text-brand-green hover:underline whitespace-nowrap">
                                    {t('businessPage.manageBusiness')}
                                </Link>
                            </div>
                        )}
                        {isResultsVisible && !selectedBusinessId && (
                             <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                {searchResults.length > 0 ? (
                                    searchResults.map(biz => (
                                        <BusinessSearchResultItem key={biz.id} business={biz} onSelect={handleSelectBusiness} isOwn={misEmpresas.some(b => b.id === biz.id)} />
                                    ))
                                 ) : (
                                    <li className="px-4 py-3 text-center text-gray-500 dark:text-gray-400">
                                        {t('writeReviewPage.noBusinessFound')}
                                    </li>
                                )}
                            </ul>
                        )}
                    </div>

                    <div>
                        <label className="block text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1.5 sm:mb-2">{t('writeReviewPage.step2Title')}</label>
                        {category ? (
                             <div className="bg-gray-100 dark:bg-zinc-700 text-gray-800 dark:text-gray-200 font-semibold px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base rounded-full inline-block">
                                {getCategoryTranslation(category)}
                            </div>
                        ) : (
                            <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm italic">
                                {t('writeReviewPage.categoryWillAppear')}
                            </p>
                        )}
                    </div>

                    {productosEmpresa.length > 0 && (
                        <div>
                            <label htmlFor="review-product" className="block text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1">{t('writeReviewPage.productStepTitle')}</label>
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1.5 sm:mb-2">{t('writeReviewPage.productStepHint')}</p>
                            {productosEmpresa.length > 10 && (
                                <>
                                    <input
                                        type="search"
                                        id="review-product-search"
                                        value={busquedaProducto}
                                        onChange={e => setBusquedaProducto(e.target.value)}
                                        placeholder={t('writeReviewPage.productSearchPlaceholder')}
                                        aria-label={t('writeReviewPage.productSearchPlaceholder')}
                                        aria-controls="review-product"
                                        className="w-full mb-2 p-2.5 sm:p-3 text-sm sm:text-base border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100"
                                    />
                                    {busquedaProducto.trim() && coincidenciasBusqueda === 0 && (
                                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-2" role="status">
                                            {t('writeReviewPage.productSearchNoResults')}
                                        </p>
                                    )}
                                </>
                            )}
                            <select
                                id="review-product"
                                value={productoElegidoId}
                                onChange={e => setProductoElegidoId(e.target.value)}
                                className="w-full p-2.5 sm:p-3 text-sm sm:text-base border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100"
                            >
                                <option value="">{t('writeReviewPage.productGeneral')}</option>
                                {productosFiltrados.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="block text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1.5 sm:mb-2">{t('writeReviewPage.step3Title')}</label>
                        <StarRating rating={rating} onRating={setRating} size="large" />
                    </div>

                    <div>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 mb-2 sm:mb-3">
                            <label className="block text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100">{t('writeReviewPage.step4Title')}</label>
                            {AI_ENABLED && <button
                                type="button"
                                onClick={() => setIsAssistantOpen(true)}
                                className="flex items-center gap-1.5 sm:gap-2 bg-purple-100 text-purple-800 font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-md hover:bg-purple-200 transition-all text-xs sm:text-sm"
                            >
                                <i className="fa-solid fa-wand-magic-sparkles"></i>
                                <span>{t('writeReviewPage.generateWithAI')}</span>
                            </button>}
                        </div>
                        <div className="flex gap-1.5 sm:gap-2 p-1 bg-gray-100 dark:bg-zinc-900 rounded-lg">
                            <button type="button" onClick={() => setReviewType('text')} className={`flex-1 py-1.5 sm:py-2 px-2 sm:px-4 text-sm sm:text-base rounded-md font-semibold transition-all ${reviewType === 'text' ? 'bg-white dark:bg-zinc-700 shadow' : 'bg-transparent text-gray-600 dark:text-gray-400'}`}>{t('writeReviewPage.reviewTypeText')}</button>
                            <button type="button" onClick={() => setReviewType('audio')} className={`flex-1 py-1.5 sm:py-2 px-2 sm:px-4 text-sm sm:text-base rounded-md font-semibold transition-all ${reviewType === 'audio' ? 'bg-white dark:bg-zinc-700 shadow' : 'bg-transparent text-gray-600 dark:text-gray-400'}`}>{t('writeReviewPage.reviewTypeAudio')}</button>
                        </div>
                    </div>

                     <div>
                        <label htmlFor="title" className="block text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1.5 sm:mb-2">{t('writeReviewPage.step5Title')}</label>
                        <input id="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder={t('writeReviewPage.titlePlaceholder')} className="w-full p-2.5 sm:p-3 text-sm sm:text-base border border-gray-300 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-700 dark:text-gray-200 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent"/>
                    </div>


                    {reviewType === 'text' && (
                        <div className="space-y-3 sm:space-y-4">
                            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t('writeReviewPage.reviewTextPlaceholder')} className="w-full p-2.5 sm:p-3 text-sm sm:text-base border border-gray-300 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-700 dark:text-gray-200 rounded-lg h-32 sm:h-40 focus:ring-2 focus:ring-brand-green focus:border-transparent"></textarea>
                            <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">{t('writeReviewPage.uploadPhotosLabel')}</label>
                                <div
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`relative block w-full border-2 border-dashed rounded-lg p-6 sm:p-8 text-center cursor-pointer transition-colors duration-200 ease-in-out ${isDragging ? 'border-brand-green bg-green-50 dark:bg-green-900/30 ring-2 ring-offset-2 ring-brand-green' : 'border-gray-300 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-700/50 hover:border-gray-400 dark:hover:border-zinc-500'}`}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        multiple
                                        accept="image/png, image/jpeg, image/webp"
                                        onChange={handleFileInputChange}
                                        className="hidden"
                                    />
                                    <div className="flex flex-col items-center justify-center space-y-1.5 sm:space-y-2">
                                        <i className="fa-solid fa-cloud-arrow-up text-3xl sm:text-4xl text-gray-400"></i>
                                        <span className="mt-1 sm:mt-2 block text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-300">
                                            {t('writeReviewPage.dragAndDrop')}
                                        </span>
                                        <span className="block text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{t('writeReviewPage.orClickToSelect')}</span>
                                    </div>
                                </div>
                                {imagePreviews.length > 0 && (
                                    <div className="mt-3 sm:mt-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                                        {imagePreviews.map((src, index) => (
                                            <div key={src} className="relative">
                                                <img src={src} alt={`Preview ${index}`} width={96} height={96} loading="lazy" decoding="async" className="w-full h-20 sm:h-24 object-cover rounded-md border border-gray-200 dark:border-zinc-700" />
                                                <button type="button" onClick={() => removeImage(index)} className="absolute -top-1.5 -right-1.5 sm:-top-2 sm:-right-2 w-5 h-5 sm:w-6 sm:h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold hover:bg-red-700 transition-colors">
                                                   &times;
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {reviewType === 'audio' && (
                        <div className="text-center p-4 sm:p-6 border-2 border-dashed border-gray-300 dark:border-zinc-600 rounded-lg">
                            {recordingStatus === 'idle' && (
                                 <>
                                    <button type="button" onClick={startRecording} className="bg-red-600 text-white font-bold py-2.5 sm:py-3 px-4 sm:px-6 text-sm sm:text-base rounded-full hover:bg-red-700 transition-all flex items-center gap-2 mx-auto">
                                        <i className="fas fa-microphone"></i>
                                        <span>{t('writeReviewPage.startRecording')}</span>
                                    </button>
                                    <div className="mt-3 sm:mt-4">
                                        <label className="text-xs sm:text-sm text-brand-green hover:underline cursor-pointer">
                                            {t('writeReviewPage.uploadAudioFile')}
                                            <input type="file" accept={AUDIO_ACCEPT} className="hidden" onChange={handleAudioFileChange} />
                                        </label>
                                    </div>
                                </>
                            )}
                            {recordingStatus === 'recording' && (
                                 <div className="space-y-3 sm:space-y-4">
                                    <div className="text-red-600 font-bold text-base sm:text-lg animate-pulse">
                                        <i className="fas fa-circle mr-2"></i> {t('writeReviewPage.recording')}... {formatTime(timer)}
                                    </div>
                                    <button type="button" onClick={stopRecording} className="bg-gray-800 text-white font-bold py-2.5 sm:py-3 px-4 sm:px-6 text-sm sm:text-base rounded-full hover:bg-gray-900 transition-all">
                                        <i className="fas fa-stop mr-1 sm:mr-2"></i> {t('writeReviewPage.stopRecording')}
                                    </button>
                                </div>
                            )}
                            {recordingStatus === 'stopped' && audioUrl && (
                                 <div className="space-y-4">
                                    <h3 className="text-lg font-semibold dark:text-gray-200">{t('writeReviewPage.yourRecording')}</h3>
                                    <AudioPlayer audioSrc={audioUrl} />
                                    <div className="flex justify-center items-center gap-4 mt-2">
                                         <button type="button" onClick={startRecording} className="text-brand-green font-semibold hover:underline">
                                            {t('writeReviewPage.recordAgain')}
                                        </button>
                                         <span className="text-gray-400">|</span>
                                         <label className="text-sm text-brand-green hover:underline cursor-pointer">
                                            {t('writeReviewPage.uploadAnotherFile')}
                                            <input type="file" accept={AUDIO_ACCEPT} className="hidden" onChange={handleAudioFileChange} />
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    
                     <div className="pt-1 sm:pt-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isVerifiedPurchase}
                                onChange={(e) => setIsVerifiedPurchase(e.target.checked)}
                                className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded border-gray-300 dark:border-zinc-600 dark:bg-zinc-900 text-brand-green focus:ring-brand-green focus:ring-offset-2 dark:focus:ring-offset-zinc-800"
                            />
                            <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">{t('writeReviewPage.verifiedPurchaseLabel')}</span>
                        </label>
                    </div>

                    <div className="border-t dark:border-zinc-700 pt-4 sm:pt-5 md:pt-6">
                        <button type="submit" disabled={isSubmitting || !!empresaPropiaElegida} className="w-full bg-brand-green text-white font-bold py-2.5 sm:py-3 text-base sm:text-lg rounded-lg hover:bg-opacity-90 transition-colors shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 sm:gap-3">
                            {isSubmitting && <div className="w-5 h-5 sm:w-6 sm:h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>}
                            <span>{buttonText}</span>
                        </button>
                    </div>
                </form>

                {isAssistantOpen && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" aria-modal="true" role="dialog">
                        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl w-full max-w-lg p-6 relative animate-fade-in-up">
                            <button onClick={resetAssistant} className="absolute top-3 right-3 text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
                                <i className="fa-solid fa-times text-xl"></i>
                            </button>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
                                <i className="fa-solid fa-wand-magic-sparkles text-purple-600"></i>
                                {t('writeReviewPage.aiAssistantTitle')}
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">{t('writeReviewPage.aiAssistantSubtitle')}</p>

                            {!generatedDraft ? (
                                <div className="space-y-4">
                                    <textarea
                                        value={keyPoints}
                                        onChange={(e) => setKeyPoints(e.target.value)}
                                        placeholder={t('writeReviewPage.aiKeyPointsPlaceholder')}
                                        className="w-full p-3 border border-gray-300 dark:border-zinc-600 dark:bg-zinc-900 dark:text-gray-200 rounded-lg h-32 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                                        disabled={isGeneratingDraft}
                                    />
                                    {generationError && <p className="text-red-600 text-sm font-medium">{generationError}</p>}
                                    <button
                                        onClick={handleGenerateDraft}
                                        disabled={isGeneratingDraft}
                                        className="w-full bg-purple-600 text-white font-bold py-3 rounded-lg hover:bg-purple-700 transition-colors shadow-md disabled:bg-gray-400 flex items-center justify-center gap-2"
                                    >
                                        {isGeneratingDraft && <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                                        <span>{isGeneratingDraft ? t('writeReviewPage.aiGenerating') : t('writeReviewPage.aiGenerateDraft')}</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-gray-800 dark:text-gray-200">{t('writeReviewPage.aiDraftGenerated')}</h3>
                                    <div className="bg-gray-50 dark:bg-zinc-700/50 border border-gray-200 dark:border-zinc-600 p-4 rounded-lg space-y-2">
                                        <p className="font-bold text-gray-900 dark:text-gray-100">{generatedDraft.title}</p>
                                        <p className="text-gray-700 dark:text-gray-300 text-sm">{generatedDraft.reviewText}</p>
                                    </div>
                                    <div className="flex gap-4">
                                        <button 
                                            onClick={handleGenerateDraft}
                                            className="flex-1 bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-300 font-semibold py-2 px-4 rounded-md hover:bg-gray-200 dark:hover:bg-zinc-600 transition-all text-sm"
                                        >
                                            <i className="fa-solid fa-rotate-right mr-2"></i>
                                            {t('writeReviewPage.aiRegenerate')}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setTitle(generatedDraft.title);
                                                setText(generatedDraft.reviewText);
                                                resetAssistant();
                                            }}
                                            className="flex-1 bg-brand-green text-white font-bold py-2 px-4 rounded-lg hover:bg-opacity-90 transition-colors"
                                        >
                                            {t('writeReviewPage.aiUseDraft')}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <style>{`
                            @keyframes fade-in-up {
                                0% { opacity: 0; transform: translateY(20px); }
                                100% { opacity: 1; transform: translateY(0); }
                            }
                            .animate-fade-in-up {
                                animation: fade-in-up 0.3s ease-out forwards;
                            }
                        `}</style>
                    </div>
                )}
                {isCreateBusinessModalOpen && (
                    <Modal title={t('writeReviewPage.createBusinessModalTitle')} onClose={() => setIsCreateBusinessModalOpen(false)}>
                        <form onSubmit={handleCreateBusinessSubmit} className="py-4 space-y-4">
                            <p className="text-sm text-gray-600 dark:text-gray-400 text-center -mt-2 mb-4">{t('writeReviewPage.createBusinessModalSubtitle')}</p>
                            <div>
                                <label htmlFor="new-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('writeReviewPage.businessNameLabel')} <span className="text-red-500">*</span></label>
                                <input id="new-name" type="text" value={newBusinessData.name} onChange={(e) => setNewBusinessData(p => ({...p, name: e.target.value}))} required className="w-full p-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-transparent dark:text-gray-200"/>
                            </div>
                             <div>
                                <label htmlFor="new-category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('writeReviewPage.categoryLabel')} <span className="text-red-500">*</span></label>
                                <select id="new-category" value={newBusinessData.category} onChange={(e) => setNewBusinessData(p => ({...p, category: e.target.value}))} required className="w-full p-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 dark:text-gray-200">
                                    <option value="" disabled>{t('writeReviewPage.selectCategory')}</option>
                                    {Object.entries(CATEGORIES).map(([main, subs]) => (
                                        <optgroup key={main} label={t(`categories.${main}`)}>{subs.map(s => <option key={s} value={`${main}:${s}`}>{t(`subcategories.${s}`)}</option>)}</optgroup>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="new-website" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('writeReviewPage.websiteLabel')} <span className="text-red-500">*</span></label>
                                <input id="new-website" type="url" value={newBusinessData.website_url} onChange={(e) => setNewBusinessData(p => ({...p, website_url: e.target.value}))} required placeholder={t('common.placeholders.websiteUrl')} className="w-full p-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-transparent dark:text-gray-200"/>
                            </div>
                             <div>
                                <label htmlFor="new-logo" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('writeReviewPage.logoUrlLabel')}</label>
                                <input id="new-logo" type="url" value={newBusinessData.logo_url} onChange={e => setNewBusinessData(p => ({...p, logo_url: e.target.value}))} placeholder={t('common.placeholders.logoUrl')} className="w-full p-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-transparent dark:text-gray-200"/>
                            </div>
                             <div>
                                <label htmlFor="new-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('writeReviewPage.descriptionLabel')}</label>
                                <textarea id="new-description" value={newBusinessData.description} onChange={(e) => setNewBusinessData(p => ({...p, description: e.target.value}))} rows={3} className="w-full p-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-transparent dark:text-gray-200"/>
                            </div>

                            {createError && <p className="text-red-600 text-sm font-medium text-center">{createError}</p>}

                            <div className="flex justify-end gap-3 pt-4 border-t dark:border-zinc-700">
                                <button type="button" onClick={() => setIsCreateBusinessModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-zinc-700 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600">{t('common.cancel')}</button>
                                <button type="submit" disabled={isCreatingBusiness} className="px-4 py-2 text-sm font-semibold text-white bg-brand-green rounded-lg hover:bg-opacity-90 disabled:bg-gray-400">
                                    {isCreatingBusiness ? t('writeReviewPage.creatingBusiness') : t('writeReviewPage.createBusinessButton')}
                                </button>
                            </div>
                        </form>
                    </Modal>
                )}
            </div>
        </>
    );
};

export default WriteReviewPage;