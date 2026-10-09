import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { detectLanguageFromPath, LANGUAGE_DEFAULT_COUNTRY, pathTranslations, getLanguageForCountryCode } from '../contexts/i18nContext';

const unSegmento = (v: unknown): v is string => typeof v === 'string' && !/[/:]/.test(v);

// Clave de una ruta de un solo segmento fijo (/planes, /impressum…) en cualquier idioma.
const claveDeSegmento = (seg: string): string | null => {
  for (const rutas of Object.values(pathTranslations)) {
    for (const [clave, v] of Object.entries(rutas)) {
      if (v === seg && unSegmento(v)) return clave;
    }
  }
  return null;
};

interface MetaProps {
  title: string;
  description: string;
  canonical?: string; // URL canónica específica (opcional)
  ogImage?: string; // Imagen para Open Graph (opcional)
  noindex?: boolean; // Evitar indexación de páginas privadas
  isPremium?: boolean; // Metaetiquetas mejoradas para empresas premium
}

// SIEMPRE usar la URL de producción para canonicals y hreflang
// Esto evita que URLs de localhost o staging se indexen accidentalmente
const APP_URL = 'https://web.opynio.com';

const Meta: React.FC<MetaProps> = ({
  title,
  description,
  canonical,
  ogImage = 'https://opynio.com/wp-content/uploads/2025/09/Logo-opynio.png',
  noindex = false,
  isPremium = false,
}) => {
  const location = useLocation();

  useEffect(() => {
    // Update document title
    document.title = title;

    // <html lang> NO se toca aqui: lo pone I18nProvider con el idioma que se ve
    // en pantalla. Antes las fichas pasaban el idioma del pais de la empresa y
    // pisaban el de la UI (usuario en espanol viendo /de/... -> lang="de").

    // Helper function to set or create meta tag
    const setMetaTag = (selector: string, attribute: string, value: string, attributeKey: string = 'name') => {
      let tag = document.querySelector(selector) as HTMLMetaElement;
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(attributeKey, attribute);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', value);
    };

    // Helper function to set or create link tag (evita duplicados)
    const setLinkTag = (rel: string, href: string, hreflang?: string) => {
      // Para canonical: solo debe haber UNO, eliminar cualquier duplicado primero
      if (rel === 'canonical') {
        const existingCanonicals = document.querySelectorAll('link[rel="canonical"]');
        // Si hay más de uno, eliminar todos excepto el primero
        if (existingCanonicals.length > 1) {
          for (let i = 1; i < existingCanonicals.length; i++) {
            existingCanonicals[i].remove();
          }
        }
      }

      const selector = hreflang
        ? `link[rel="${rel}"][hreflang="${hreflang}"]`
        : `link[rel="${rel}"]`;

      let tag = document.querySelector(selector) as HTMLLinkElement;
      if (!tag) {
        tag = document.createElement('link');
        tag.setAttribute('rel', rel);
        if (hreflang) tag.setAttribute('hreflang', hreflang);
        document.head.appendChild(tag);
      }
      tag.setAttribute('href', href);
    };

    // 1. Meta Description
    setMetaTag('meta[name="description"]', 'description', description);

    // 2. Robots meta (noindex para páginas privadas o 404)
    // IMPORTANTE: Siempre establecer el valor explícitamente para evitar problemas de timing
    if (noindex) {
      setMetaTag('meta[name="robots"]', 'robots', 'noindex, nofollow');
    } else {
      // Para páginas normales, establecer index, follow (sobrescribir cualquier valor previo)
      setMetaTag('meta[name="robots"]', 'robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    }

    // 3. Canonical URL
    // IMPORTANTE: La canonical debe ser limpia, sin query params ni trailing slashes duplicados
    let currentPath = location.pathname;

    // Normalizar path: remover trailing slash excepto para raíz
    if (currentPath.length > 1 && currentPath.endsWith('/')) {
      currentPath = currentPath.slice(0, -1);
    }

    // La canonical NUNCA debe incluir query params (sort, filter, page, etc.)
    // Si se pasa una canonical explícita, usarla; si no, construir el canonical:
    //   - Para paths con country prefix → canonical = URL actual.
    //   - Para paths en raíz en español → canonical = URL actual (el dominio
    //     raíz ES la versión canónica española).
    //   - Para paths en raíz en otro idioma (en/de/fr/it/br/ca/cn) →
    //     canonical = /<countryDefault>/<path> para evitar duplicate content
    //     entre /login (raíz) y /us/login (country-prefixed).
    // Patrón identificador de country/lang prefix (mismo set que el resto del Meta).
    const PREFIX_RE = /^\/(es|en|br|pt|ca|fr|de|it|mx|ar|co|pe|ve|cl|ec|gt|cr|pa|uy|us|gb|ad|cn)(?=\/|$)/;
    let canonicalUrl: string;
    if (canonical) {
      canonicalUrl = canonical;
    } else if (PREFIX_RE.test(currentPath)) {
      // Tiene country prefix → la URL actual es ya la canónica.
      canonicalUrl = `${APP_URL}${currentPath}`;
    } else {
      // No tiene country prefix → estamos en el dominio raíz. Detectar
      // idioma del primer segmento. Si es no-español, redirigir el
      // canonical al país default de ese idioma.
      const firstSeg = currentPath.split('/').filter(Boolean)[0] || '';
      const detectedLang = detectLanguageFromPath(firstSeg);
      const defaultCountry = detectedLang ? LANGUAGE_DEFAULT_COUNTRY[detectedLang] : undefined;
      if (defaultCountry) {
        canonicalUrl = `${APP_URL}/${defaultCountry}${currentPath}`;
      } else {
        // Path en español o no detectado → la URL actual es canónica.
        canonicalUrl = `${APP_URL}${currentPath}`;
      }
    }
    setLinkTag('canonical', canonicalUrl);

    // También actualizar og:url para que coincida con canonical
    setMetaTag('meta[property="og:url"]', 'og:url', canonicalUrl, 'property');

    // 4. Open Graph meta tags
    setMetaTag('meta[property="og:title"]', 'og:title', title, 'property');
    setMetaTag('meta[property="og:description"]', 'og:description', description, 'property');
    // og:url ya se estableció arriba junto con canonical
    setMetaTag('meta[property="og:image"]', 'og:image', ogImage, 'property');
    setMetaTag('meta[property="og:type"]', 'og:type', 'website', 'property');
    setMetaTag('meta[property="og:site_name"]', 'og:site_name', 'Opynio', 'property');

    // 5. Twitter Card meta tags
    setMetaTag('meta[name="twitter:card"]', 'twitter:card', 'summary_large_image');
    setMetaTag('meta[name="twitter:title"]', 'twitter:title', title);
    setMetaTag('meta[name="twitter:description"]', 'twitter:description', description);
    setMetaTag('meta[name="twitter:image"]', 'twitter:image', ogImage);

    // 6. Hreflang tags (internacional SEO)
    // Detectar TODOS los prefijos de idioma/país (incluyendo gb, ad, cn que se usan en hreflang)
    const allLangCodes = 'es|en|br|pt|ca|fr|de|it|mx|ar|co|pe|ve|cl|ec|gt|cr|pa|uy|us|gb|ad|cn|sg|ie|at|tr';

    // Extraer el path SIN el código de país
    // Ejemplos:
    //   /es/explorar -> /explorar
    //   /es -> '' (vacío, es la home del país)
    //   /mx/empresa/Test -> /empresa/Test
    let pathWithoutLang = currentPath.replace(new RegExp(`^/(${allLangCodes})(?=/|$)`), '');

    // Normalizar: si es solo '/', convertir a '' para evitar doble slash
    if (pathWithoutLang === '/') {
      pathWithoutLang = '';
    }

    // IMPORTANTE: Para páginas de empresa individual, NO generar hreflang múltiples
    // porque la empresa solo existe en UN país. Generar hreflang a otros países
    // causa que Google indexe URLs 404 (ej: /co/empresa/X cuando solo existe /es/empresa/X)
    // Lista de TODOS los paths de empresa en todos los idiomas:
    // - es/br/pt/ca: empresa
    // - en: business
    // - fr: entreprise
    // - de: unternehmen
    // - it: azienda
    // - cn: 公司
    const businessPaths = ['/empresa/', '/business/', '/entreprise/', '/unternehmen/', '/azienda/', '/公司/'];
    const isBusinessPage = businessPaths.some(path => pathWithoutLang.includes(path));

    // Limpiar hreflang tags existentes antes de añadir nuevos
    const removeHreflangTags = () => {
      const existingHreflangTags = document.querySelectorAll('link[rel="alternate"][hreflang]');
      existingHreflangTags.forEach(tag => tag.remove());
    };

    if (isBusinessPage) {
      // Para páginas de empresa: solo mantener canonical, NO generar hreflang múltiples
      // Esto evita que Google descubra URLs de países donde la empresa no existe
      removeHreflangTags();
      // Solo añadir x-default apuntando a la URL actual (canónica)
      setLinkTag('alternate', canonicalUrl, 'x-default');
    } else {
      // Para páginas estáticas: generar hreflang para todos los idiomas principales
      removeHreflangTags();

      // Cada alternativa usa el slug del idioma de su pais (/de/preise,
      // /us/legal-notice): con el slug de la pagina actual daban 404 en todos
      // los paises que no hablan español. Rutas de varios segmentos o con
      // parametros conservan el slug actual, como antes.
      const segmento = pathWithoutLang.replace(/^\//, '');
      const clave = segmento && unSegmento(segmento) ? claveDeSegmento(decodeURIComponent(segmento)) : null;
      const rutaPara = (cc: string): string => {
        const destino = clave ? (pathTranslations as any)[getLanguageForCountryCode(cc)]?.[clave] : null;
        return unSegmento(destino) ? encodeURI(`/${cc}/${destino}`) : `/${cc}${pathWithoutLang}`;
      };

      const languages = [
        // Spanish-speaking countries
        { code: 'es-ES', path: rutaPara('es') },   // España
        { code: 'es-MX', path: rutaPara('mx') },   // México
        { code: 'es-AR', path: rutaPara('ar') },   // Argentina
        { code: 'es-CO', path: rutaPara('co') },   // Colombia
        { code: 'es-CL', path: rutaPara('cl') },   // Chile
        { code: 'es-PE', path: rutaPara('pe') },   // Perú
        // English-speaking countries
        { code: 'en-US', path: rutaPara('us') },   // USA
        { code: 'en-GB', path: rutaPara('gb') },   // UK
        // Portuguese
        { code: 'pt-BR', path: rutaPara('br') },   // Brasil
        { code: 'pt-PT', path: rutaPara('pt') },   // Portugal
        // Other languages
        { code: 'fr', path: rutaPara('fr') },      // Français
        { code: 'de', path: rutaPara('de') },      // Deutsch
        { code: 'it', path: rutaPara('it') },      // Italiano
        { code: 'ca', path: rutaPara('ad') },      // Català (Andorra)
        { code: 'zh', path: rutaPara('cn') },      // 中文 (China)
        { code: 'sv', path: rutaPara('se') },      // Svenska (Sverige)
        { code: 'pl', path: rutaPara('pl') },      // Polski (Polska)
        { code: 'ja', path: rutaPara('jp') },      // 日本語 (日本)
        { code: 'en-AU', path: rutaPara('au') },   // English (Australia)
        { code: 'ko', path: rutaPara('kr') },       // 한국어 (Korea)
        { code: 'ar', path: rutaPara('ae') },       // العربية (UAE)
        { code: 'nl', path: rutaPara('nl') },       // Nederlands
        { code: 'ru', path: rutaPara('ru') },       // Русский
        { code: 'id', path: rutaPara('id') },       // Indonesia
        { code: 'ms', path: rutaPara('my') },       // Malaysia
        { code: 'zh-TW', path: rutaPara('tw') },    // 繁體中文 (Taiwan)
        { code: 'th', path: rutaPara('th') },       // Thai
        { code: 'fa', path: rutaPara('ir') },       // فارسی (Iran)
        { code: 'vi', path: rutaPara('vn') },       // Tiếng Việt (Vietnam)
        { code: 'bn', path: rutaPara('bd') },       // বাংলা (Bangladesh)
        { code: 'hi', path: rutaPara('in') },       // हिन्दी (India)
        { code: 'tl', path: rutaPara('ph') },       // Filipino (Philippines)
        { code: 'en-SG', path: rutaPara('sg') },     // English (Singapore)
        { code: 'en-IE', path: rutaPara('ie') },     // English (Ireland)
        { code: 'en-CA', path: rutaPara('ca') },     // English (Canada)
        { code: 'de-AT', path: rutaPara('at') },     // Deutsch (Österreich)
      ];

      // Añadir hreflang para cada idioma
      languages.forEach(({ code, path }) => {
        setLinkTag('alternate', `${APP_URL}${path}`, code);
      });

      // Hreflang x-default (español como predeterminado)
      setLinkTag('alternate', `${APP_URL}${rutaPara('es')}`, 'x-default');
    }

    // 7. Metaetiquetas PREMIUM (para empresas con plan premium)
    if (isPremium) {
      // Schema.org LocalBusiness markup mejorado
      setMetaTag('meta[property="business:contact_data:street_address"]', 'business:contact_data:street_address', '', 'property');
      setMetaTag('meta[property="business:contact_data:locality"]', 'business:contact_data:locality', '', 'property');
      setMetaTag('meta[property="business:contact_data:country_name"]', 'business:contact_data:country_name', '', 'property');

      // Author y publisher para mejor credibilidad
      setMetaTag('meta[name="author"]', 'author', 'Opynio Verified Business');
      setMetaTag('meta[name="publisher"]', 'publisher', 'Opynio');

      // Verificación de negocio (opcional, según el plan)
      setMetaTag('meta[name="business-verified"]', 'business-verified', 'true');
    }

    // Cleanup function para remover tags obsoletos al cambiar de página
    return () => {
      // No removemos nada aquí porque las tags se sobrescriben dinámicamente
    };
  }, [title, description, canonical, ogImage, noindex, isPremium, location]);

  return null; // This component does not render anything
};

export default Meta;
