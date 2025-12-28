import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface MetaProps {
  title: string;
  description: string;
  canonical?: string; // URL canónica específica (opcional)
  ogImage?: string; // Imagen para Open Graph (opcional)
  noindex?: boolean; // Evitar indexación de páginas privadas
  isPremium?: boolean; // Metaetiquetas mejoradas para empresas premium
  lang?: string; // Idioma de la página (ej: 'es', 'pt', 'en') - se aplica al atributo lang del HTML
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
  lang
}) => {
  const location = useLocation();

  useEffect(() => {
    // Update document title
    document.title = title;

    // Update HTML lang attribute (importante para SEO y accesibilidad)
    if (lang) {
      document.documentElement.setAttribute('lang', lang);
    }

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
    // Si se pasa una canonical explícita, usarla; si no, construir desde pathname limpio
    const canonicalUrl = canonical || `${APP_URL}${currentPath}`;
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
    const allLangCodes = 'es|en|br|pt|ca|fr|de|it|mx|ar|co|pe|ve|cl|ec|gt|cr|pa|uy|us|gb|ad|cn';

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
    const isBusinessPage = pathWithoutLang.includes('/empresa/') || pathWithoutLang.includes('/business/');

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

      const languages = [
        // Spanish-speaking countries
        { code: 'es-ES', path: `/es${pathWithoutLang}` },   // España
        { code: 'es-MX', path: `/mx${pathWithoutLang}` },   // México
        { code: 'es-AR', path: `/ar${pathWithoutLang}` },   // Argentina
        { code: 'es-CO', path: `/co${pathWithoutLang}` },   // Colombia
        { code: 'es-CL', path: `/cl${pathWithoutLang}` },   // Chile
        { code: 'es-PE', path: `/pe${pathWithoutLang}` },   // Perú
        // English-speaking countries
        { code: 'en-US', path: `/us${pathWithoutLang}` },   // USA
        { code: 'en-GB', path: `/gb${pathWithoutLang}` },   // UK
        // Portuguese
        { code: 'pt-BR', path: `/br${pathWithoutLang}` },   // Brasil
        { code: 'pt-PT', path: `/pt${pathWithoutLang}` },   // Portugal
        // Other languages
        { code: 'fr', path: `/fr${pathWithoutLang}` },      // Français
        { code: 'de', path: `/de${pathWithoutLang}` },      // Deutsch
        { code: 'it', path: `/it${pathWithoutLang}` },      // Italiano
        { code: 'ca', path: `/ad${pathWithoutLang}` },      // Català (Andorra)
        { code: 'zh', path: `/cn${pathWithoutLang}` },      // 中文 (China)
      ];

      // Añadir hreflang para cada idioma
      languages.forEach(({ code, path }) => {
        setLinkTag('alternate', `${APP_URL}${path}`, code);
      });

      // Hreflang x-default (español como predeterminado)
      setLinkTag('alternate', `${APP_URL}/es${pathWithoutLang}`, 'x-default');
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
  }, [title, description, canonical, ogImage, noindex, isPremium, lang, location]);

  return null; // This component does not render anything
};

export default Meta;
