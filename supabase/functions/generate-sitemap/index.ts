// supabase/functions/generate-sitemap/index.ts

// Proporciona la información de tipos para el entorno de Deno en las Edge Functions.
declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
};

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// URL base de tu aplicación
const APP_URL = 'https://web.opynio.com';

// =============================================================================
// TRADUCCIONES DE PATHS POR IDIOMA (sincronizado con locales/*.ts)
// =============================================================================
// Cada país usa un idioma base para los paths de URL
// es = español, en = inglés, br = portugués, fr = francés, de = alemán, it = italiano, ca = catalán, cn = chino

type PathTranslations = {
  explore: string;
  businesses: string;
  business: string; // Solo la parte base, sin /:identifier
  community: string;
  whatsNew: string;
  pricing: string;
  support: string;
  about: string;
  faq: string;
  howItWorks: string;
  forBusinesses: string;
  caseStudies: string;
  widgets: string;
};

const pathsByLanguage: Record<string, PathTranslations> = {
  // Español (España y Latinoamérica)
  es: {
    explore: 'explorar',
    businesses: 'empresas',
    business: 'empresa',
    community: 'comunidad',
    whatsNew: 'novedades',
    pricing: 'planes',
    support: 'soporte',
    about: 'sobre-nosotros',
    faq: 'preguntas-frecuentes',
    howItWorks: 'como-funciona',
    forBusinesses: 'para-empresas',
    caseStudies: 'casos-de-exito',
    widgets: 'widgets',
  },
  // Inglés (US, GB)
  en: {
    explore: 'explore',
    businesses: 'businesses',
    business: 'business',
    community: 'community',
    whatsNew: 'whats-new',
    pricing: 'pricing',
    support: 'support',
    about: 'about',
    faq: 'faq',
    howItWorks: 'how-it-works',
    forBusinesses: 'for-businesses',
    caseStudies: 'case-studies',
    widgets: 'widgets',
  },
  // Portugués Brasil (pt-BR)
  br: {
    explore: 'explorar',
    businesses: 'empresas',
    business: 'empresa',
    community: 'comunidade',
    whatsNew: 'novidades',
    pricing: 'precos',
    support: 'suporte',
    about: 'sobre-nos',
    faq: 'perguntas-frequentes',
    howItWorks: 'como-funciona',
    forBusinesses: 'para-empresas',
    caseStudies: 'casos-de-sucesso',
    widgets: 'widgets',
  },
  // Portugués Portugal (pt-PT) — vocabulario diferente: análises, palavra-passe, utilizador, etc.
  pt: {
    explore: 'explorar',
    businesses: 'empresas',
    business: 'empresa',
    community: 'comunidade',
    whatsNew: 'novidades',
    pricing: 'precos',
    support: 'apoio',
    about: 'sobre-nos',
    faq: 'perguntas-frequentes',
    howItWorks: 'como-funciona',
    forBusinesses: 'para-empresas',
    caseStudies: 'casos-de-sucesso',
    widgets: 'widgets',
  },
  // Francés
  fr: {
    explore: 'explorer',
    businesses: 'entreprises',
    business: 'entreprise',
    community: 'communaute',
    whatsNew: 'nouveautes',
    pricing: 'tarifs',
    support: 'support',
    about: 'a-propos',
    faq: 'faq',
    howItWorks: 'comment-ca-marche',
    forBusinesses: 'pour-les-entreprises',
    caseStudies: 'cas-clients',
    widgets: 'widgets',
  },
  // Alemán
  de: {
    explore: 'entdecken',
    businesses: 'unternehmen',
    business: 'unternehmen',
    community: 'gemeinschaft',
    whatsNew: 'neuigkeiten',
    pricing: 'preise',
    support: 'support',
    about: 'ueber-uns',
    faq: 'faq',
    howItWorks: 'wie-es-funktioniert',
    forBusinesses: 'fuer-unternehmen',
    caseStudies: 'fallstudien',
    widgets: 'widgets',
  },
  // Italiano
  it: {
    explore: 'esplora',
    businesses: 'aziende',
    business: 'azienda',
    community: 'comunita',
    whatsNew: 'novita',
    pricing: 'prezzi',
    support: 'supporto',
    about: 'chi-siamo',
    faq: 'faq',
    howItWorks: 'come-funziona',
    forBusinesses: 'per-le-aziende',
    caseStudies: 'casi-di-successo',
    widgets: 'widgets',
  },
  // Catalán (Andorra)
  ca: {
    explore: 'explorar',
    businesses: 'empreses',
    business: 'empresa',
    community: 'comunitat',
    whatsNew: 'novetats',
    pricing: 'preus',
    support: 'suport',
    about: 'sobre-nosaltres',
    faq: 'preguntes-frequents',
    howItWorks: 'com-funciona',
    forBusinesses: 'per-a-empreses',
    caseStudies: 'casos-dexit',
    widgets: 'widgets',
  },
  // Sueco
  sv: {
    explore: 'utforska',
    businesses: 'foretag',
    business: 'foretag',
    community: 'community',
    whatsNew: 'nyheter',
    pricing: 'priser',
    support: 'support',
    about: 'om-oss',
    faq: 'vanliga-fragor',
    howItWorks: 'sa-funkar-det',
    forBusinesses: 'for-foretag',
    caseStudies: 'kundberattelser',
    widgets: 'widgets',
  },
  // Polaco
  pl: {
    explore: 'odkrywaj',
    businesses: 'firmy',
    business: 'firma',
    community: 'spolecznosc',
    whatsNew: 'nowosci',
    pricing: 'cennik',
    support: 'pomoc',
    about: 'o-nas',
    faq: 'najczestsze-pytania',
    howItWorks: 'jak-to-dziala',
    forBusinesses: 'dla-firm',
    caseStudies: 'historie-sukcesu',
    widgets: 'widgets',
  },
  // Japonés (slugs en inglés para evitar problemas de encoding en sitemap XML; las URLs reales usan caracteres japoneses via locale)
  ja: {
    explore: 'explore',
    businesses: 'businesses',
    business: 'business',
    community: 'community',
    whatsNew: 'whats-new',
    pricing: 'pricing',
    support: 'support',
    about: 'about',
    faq: 'faq',
    howItWorks: 'how-it-works',
    forBusinesses: 'for-businesses',
    caseStudies: 'case-studies',
    widgets: 'widgets',
  },
  // Chino
  cn: {
    explore: 'explore',
    businesses: 'businesses',
    business: 'business',
    community: 'community',
    whatsNew: 'whats-new',
    pricing: 'pricing',
    support: 'support',
    about: 'about',
    faq: 'faq',
    howItWorks: 'how-it-works',
    forBusinesses: 'for-businesses',
    caseStudies: 'case-studies',
    widgets: 'widgets',
  },
};

// Mapea código de país URL → idioma para paths
const countryToLanguage: Record<string, string> = {
  // Países hispanohablantes → español
  'es': 'es', 'mx': 'es', 'ar': 'es', 'co': 'es', 'cl': 'es',
  'pe': 'es', 've': 'es', 'ec': 'es', 'gt': 'es', 'cr': 'es',
  'pa': 'es', 'uy': 'es',
  // Países anglófonos → inglés
  'en': 'en', 'us': 'en', 'gb': 'en',
  // Portugués (BR y PT separados — vocabulario distinto)
  'br': 'br', 'pt': 'pt',
  // Otros idiomas
  'fr': 'fr',
  'de': 'de',
  'it': 'it',
  'ca': 'ca', // Andorra - catalán
  'cn': 'cn',
  'se': 'sv', // Suecia
  'pl': 'pl', // Polonia
  'jp': 'ja', // Japón
};

// Obtener paths traducidos para un código de país
const getPathsForCountry = (countryCode: string): PathTranslations => {
  const lang = countryToLanguage[countryCode] || 'es';
  return pathsByLanguage[lang] || pathsByLanguage.es;
};

serve(async (_req) => {
  // Maneja la solicitud preflight de CORS.
  if (_req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Inicializa el cliente de Supabase con la clave SERVICE_ROLE para bypassear RLS.
    // Esto es necesario para que el sitemap incluya TODAS las empresas públicas.
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Obtiene las empresas con sus datos, país Y slug limpio
    const { data: businesses, error } = await supabaseClient
      .from('businesses')
      .select('name, slug, created_at, country')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching businesses:', error);
      throw error;
    }

    // IMPORTANTE: Solo páginas con prefijo de idioma (NO rutas sin prefijo)
    // Códigos de país soportados (ver APP_LANGUAGES en constants.ts)
    const countryCodes = [
      'es', 'en', 'br', 'pt', 'ca', 'fr', 'de', 'it',
      'mx', 'ar', 'co', 'pe', 've', 'cl', 'ec', 'gt',
      'cr', 'pa', 'uy', 'us', 'gb', 'cn', 'se', 'pl', 'jp'
    ];

    const sitemapEntries: string[] = [];

    // Añadir homepage raíz (sin idioma) solo una vez con prioridad máxima
    sitemapEntries.push(`
      <url>
        <loc>${APP_URL}/</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>1.0</priority>
      </url>`);

    // Generar páginas estáticas para cada país con PATHS TRADUCIDOS
    for (const countryCode of countryCodes) {
      const paths = getPathsForCountry(countryCode);

      // Lista de páginas estáticas a generar (usando paths traducidos)
      const staticPages = [
        { path: '', priority: '0.9' }, // Homepage del país
        { path: `/${paths.explore}`, priority: '0.8' },
        { path: `/${paths.businesses}`, priority: '0.8' },
        { path: `/${paths.community}`, priority: '0.7' },
        { path: `/${paths.whatsNew}`, priority: '0.6' },
        { path: `/${paths.pricing}`, priority: '0.7' },
        { path: `/${paths.support}`, priority: '0.5' },
        { path: `/${paths.about}`, priority: '0.5' },
        { path: `/${paths.faq}`, priority: '0.6' },
        { path: `/${paths.howItWorks}`, priority: '0.7' },
        { path: `/${paths.forBusinesses}`, priority: '0.7' },
        { path: `/${paths.caseStudies}`, priority: '0.6' },
        { path: `/${paths.widgets}`, priority: '0.5' },
      ];

      for (const page of staticPages) {
        const fullPath = `/${countryCode}${page.path}`;

        sitemapEntries.push(`
      <url>
        <loc>${APP_URL}${fullPath}</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>${page.priority}</priority>
      </url>`);
      }
    }

    // Añade cada empresa al sitemap CON su prefijo de país Y path traducido
    if (businesses) {
      // Mapea país de BD (mayúscula) → código de país URL (minúscula)
      const countryToUrlCode: Record<string, string> = {
        'ES': 'es',  // España
        'MX': 'mx',  // México
        'AR': 'ar',  // Argentina
        'CO': 'co',  // Colombia
        'CL': 'cl',  // Chile
        'PE': 'pe',  // Perú
        'VE': 've',  // Venezuela
        'EC': 'ec',  // Ecuador
        'GT': 'gt',  // Guatemala
        'CR': 'cr',  // Costa Rica
        'PA': 'pa',  // Panamá
        'UY': 'uy',  // Uruguay
        'US': 'us',  // United States
        'GB': 'gb',  // United Kingdom
        'BR': 'br',  // Brasil
        'PT': 'pt',  // Portugal
        'FR': 'fr',  // France
        'DE': 'de',  // Germany
        'IT': 'it',  // Italy
        'AD': 'ca',  // Andorra (Catalán)
        'CN': 'cn',  // China
        'SE': 'se',  // Suecia
        'PL': 'pl',  // Polonia
        'JP': 'jp',  // Japón
      };

      for (const business of businesses) {
        const urlCode = countryToUrlCode[business.country || 'ES'] || 'es';
        const paths = getPathsForCountry(urlCode);
        // IMPORTANTE: Usar slug limpio si existe, sino fallback al nombre URL-encoded
        const businessSlug = business.slug || encodeURIComponent(business.name.replace(/ /g, '_'));

        // Usar el path de "business" traducido (empresa/entreprise/business/azienda/etc.)
        const businessPath = `/${urlCode}/${paths.business}/${businessSlug}`;

        // Usar created_at para la fecha de última modificación
        const lastMod = new Date(business.created_at).toISOString().split('T')[0];

        sitemapEntries.push(`
          <url>
            <loc>${APP_URL}${businessPath}</loc>
            <lastmod>${lastMod}</lastmod>
            <changefreq>monthly</changefreq>
            <priority>0.9</priority>
          </url>`);
      }
    }
    
    // Une todas las entradas para crear el sitemap XML final.
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${sitemapEntries.join('')}
</urlset>`;

    return new Response(sitemap, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400', // Cache por 24 horas
      },
      status: 200,
    });

  } catch (err) {
    console.error('Error generating sitemap:', err);
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      details: err.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});