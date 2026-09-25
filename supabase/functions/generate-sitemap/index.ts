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

// GENERADO por scripts/_sitemap-sync.mjs desde locales/*.ts: no editar a mano.
const pathsByLanguage: Record<string, PathTranslations> = {
  ar: { explore: 'istakshif', businesses: 'sharikat', business: 'sharika', community: 'mojtama3', whatsNew: 'jadid', pricing: 'as3ar', support: 'da3m', about: '3anna', faq: 'faq', howItWorks: 'kayfa-ya3mal', forBusinesses: 'lil-sharikat', caseStudies: 'qissas-najah', widgets: 'widgets' },
  at: { explore: 'entdecken', businesses: 'unternehmen', business: 'unternehmen', community: 'gemeinschaft', whatsNew: 'neuigkeiten', pricing: 'preise', support: 'support', about: 'ueber-uns', faq: 'haeufige-fragen', howItWorks: 'so-funktioniert-es', forBusinesses: 'fuer-unternehmen', caseStudies: 'erfolgsgeschichten', widgets: 'widgets' },
  au: { explore: 'explore', businesses: 'businesses', business: 'business', community: 'community', whatsNew: 'whats-new', pricing: 'pricing', support: 'support', about: 'about', faq: 'faq', howItWorks: 'how-it-works', forBusinesses: 'for-businesses', caseStudies: 'case-studies', widgets: 'widgets' },
  bn: { explore: 'explore', businesses: 'businesses', business: 'business', community: 'community', whatsNew: 'whats-new', pricing: 'pricing', support: 'support', about: 'about', faq: 'faq', howItWorks: 'how-it-works', forBusinesses: 'for-businesses', caseStudies: 'case-studies', widgets: 'widgets' },
  br: { explore: 'explorar', businesses: 'empresas', business: 'empresa', community: 'comunidade', whatsNew: 'novidades', pricing: 'planos', support: 'suporte', about: 'sobre-nos', faq: 'perguntas-frequentes', howItWorks: 'como-funciona', forBusinesses: 'para-empresas', caseStudies: 'casos-de-sucesso', widgets: 'widgets' },
  ca: { explore: 'explorar', businesses: 'empreses', business: 'empresa', community: 'comunitat', whatsNew: 'novetats', pricing: 'plans', support: 'suport', about: 'sobre-nosaltres', faq: 'preguntes-frequents', howItWorks: 'com-funciona', forBusinesses: 'per-a-empreses', caseStudies: 'casos-exit', widgets: 'ginys' },
  cn: { explore: '%E6%8E%A2%E7%B4%A2', businesses: '%E5%85%AC%E5%8F%B8', business: '%E5%85%AC%E5%8F%B8', community: '%E7%A4%BE%E5%8C%BA', whatsNew: '%E6%96%B0%E5%8A%9F%E8%83%BD', pricing: '%E5%AE%9A%E4%BB%B7', support: '%E6%94%AF%E6%8C%81', about: '%E5%85%B3%E4%BA%8E%E6%88%91%E4%BB%AC', faq: '%E5%B8%B8%E8%A7%81%E9%97%AE%E9%A2%98', howItWorks: '%E4%BD%BF%E7%94%A8%E6%96%B9%E6%B3%95', forBusinesses: '%E4%BC%81%E4%B8%9A%E6%9C%8D%E5%8A%A1', caseStudies: '%E6%88%90%E5%8A%9F%E6%A1%88%E4%BE%8B', widgets: '%E6%8F%92%E4%BB%B6%E5%B1%95%E7%A4%BA' },
  de: { explore: 'entdecken', businesses: 'unternehmen', business: 'unternehmen', community: 'gemeinschaft', whatsNew: 'neuigkeiten', pricing: 'preise', support: 'support', about: 'ueber-uns', faq: 'haeufige-fragen', howItWorks: 'so-funktioniert-es', forBusinesses: 'fuer-unternehmen', caseStudies: 'erfolgsgeschichten', widgets: 'widgets' },
  en: { explore: 'explore', businesses: 'businesses', business: 'business', community: 'community', whatsNew: 'whats-new', pricing: 'pricing', support: 'support', about: 'about', faq: 'faq', howItWorks: 'how-it-works', forBusinesses: 'for-businesses', caseStudies: 'case-studies', widgets: 'widgets' },
  es: { explore: 'explorar', businesses: 'empresas', business: 'empresa', community: 'comunidad', whatsNew: 'novedades', pricing: 'planes', support: 'soporte', about: 'sobre-nosotros', faq: 'preguntas-frecuentes', howItWorks: 'como-funciona', forBusinesses: 'para-empresas', caseStudies: 'casos-exito', widgets: 'widgets' },
  fa: { explore: 'jostoju', businesses: 'sherkat-ha', business: 'sherkat', community: 'anjoman', whatsNew: 'tazeh-ha', pricing: 'gheymat', support: 'poshtibani', about: 'darbare-ma', faq: 'soalat', howItWorks: 'chegune-kar-mikonad', forBusinesses: 'baraye-kasb-o-kar', caseStudies: 'dastanha-ye-movafaghiyat', widgets: 'widgets' },
  fr: { explore: 'explorer', businesses: 'entreprises', business: 'entreprise', community: 'communaute', whatsNew: 'nouveautes', pricing: 'tarifs', support: 'support', about: 'a-propos', faq: 'faq', howItWorks: 'comment-ca-marche', forBusinesses: 'pour-les-entreprises', caseStudies: 'cas-clients', widgets: 'widgets' },
  gb: { explore: 'explore', businesses: 'businesses', business: 'business', community: 'community', whatsNew: 'whats-new', pricing: 'pricing', support: 'support', about: 'about', faq: 'faq', howItWorks: 'how-it-works', forBusinesses: 'for-businesses', caseStudies: 'case-studies', widgets: 'widgets' },
  hi: { explore: 'explore', businesses: 'businesses', business: 'business', community: 'community', whatsNew: 'whats-new', pricing: 'pricing', support: 'support', about: 'about', faq: 'faq', howItWorks: 'how-it-works', forBusinesses: 'for-businesses', caseStudies: 'case-studies', widgets: 'widgets' },
  id: { explore: 'jelajahi', businesses: 'perusahaan', business: 'perusahaan', community: 'komunitas', whatsNew: 'apa-yang-baru', pricing: 'harga', support: 'dukungan', about: 'tentang-kami', faq: 'faq', howItWorks: 'cara-kerja', forBusinesses: 'untuk-bisnis', caseStudies: 'studi-kasus', widgets: 'widgets' },
  ie: { explore: 'explore', businesses: 'businesses', business: 'business', community: 'community', whatsNew: 'whats-new', pricing: 'pricing', support: 'support', about: 'about', faq: 'faq', howItWorks: 'how-it-works', forBusinesses: 'for-businesses', caseStudies: 'case-studies', widgets: 'widgets' },
  it: { explore: 'esplora', businesses: 'aziende', business: 'azienda', community: 'comunita', whatsNew: 'novita', pricing: 'piani', support: 'supporto', about: 'chi-siamo', faq: 'domande-frequenti', howItWorks: 'come-funziona', forBusinesses: 'per-le-aziende', caseStudies: 'casi-di-successo', widgets: 'widget' },
  ja: { explore: '%E6%8E%A2%E3%81%99', businesses: '%E4%BC%9A%E7%A4%BE', business: '%E4%BC%9A%E7%A4%BE', community: '%E3%82%B3%E3%83%9F%E3%83%A5%E3%83%8B%E3%83%86%E3%82%A3', whatsNew: '%E6%96%B0%E7%9D%80%E6%83%85%E5%A0%B1', pricing: '%E6%96%99%E9%87%91', support: '%E3%82%B5%E3%83%9D%E3%83%BC%E3%83%88', about: '%E7%A7%81%E3%81%9F%E3%81%A1%E3%81%AB%E3%81%A4%E3%81%84%E3%81%A6', faq: '%E3%82%88%E3%81%8F%E3%81%82%E3%82%8B%E8%B3%AA%E5%95%8F', howItWorks: '%E4%BD%BF%E3%81%84%E6%96%B9', forBusinesses: '%E4%BC%81%E6%A5%AD%E5%90%91%E3%81%91', caseStudies: '%E5%B0%8E%E5%85%A5%E4%BA%8B%E4%BE%8B', widgets: '%E3%82%A6%E3%82%A3%E3%82%B8%E3%82%A7%E3%83%83%E3%83%88%E7%B4%B9%E4%BB%8B' },
  ko: { explore: '%ED%83%90%EC%83%89', businesses: '%ED%9A%8C%EC%82%AC', business: '%ED%9A%8C%EC%82%AC', community: '%EC%BB%A4%EB%AE%A4%EB%8B%88%ED%8B%B0', whatsNew: '%EC%83%88%EC%86%8C%EC%8B%9D', pricing: '%EC%9A%94%EA%B8%88', support: '%EC%A7%80%EC%9B%90', about: '%ED%9A%8C%EC%82%AC%EC%86%8C%EA%B0%9C', faq: '%EC%9E%90%EC%A3%BC%EB%AC%BB%EB%8A%94%EC%A7%88%EB%AC%B8', howItWorks: '%EC%9D%B4%EC%9A%A9%EB%B0%A9%EB%B2%95', forBusinesses: '%EB%B9%84%EC%A6%88%EB%8B%88%EC%8A%A4%EC%9A%A9', caseStudies: '%EC%84%B1%EA%B3%B5%EC%82%AC%EB%A1%80', widgets: '%EC%9C%84%EC%A0%AF' },
  ms: { explore: 'jelajah', businesses: 'syarikat', business: 'syarikat', community: 'komuniti', whatsNew: 'terkini', pricing: 'harga', support: 'sokongan', about: 'tentang-kami', faq: 'soalan-lazim', howItWorks: 'cara-guna', forBusinesses: 'untuk-perniagaan', caseStudies: 'kajian-kes', widgets: 'widgets' },
  nl: { explore: 'ontdek', businesses: 'bedrijven', business: 'bedrijf', community: 'community', whatsNew: 'nieuws', pricing: 'prijzen', support: 'support', about: 'over-ons', faq: 'veelgestelde-vragen', howItWorks: 'hoe-werkt-het', forBusinesses: 'voor-bedrijven', caseStudies: 'casestudies', widgets: 'widgets' },
  pl: { explore: 'odkrywaj', businesses: 'firmy', business: 'firma', community: 'spolecznosc', whatsNew: 'nowosci', pricing: 'cennik', support: 'pomoc', about: 'o-nas', faq: 'najczestsze-pytania', howItWorks: 'jak-to-dziala', forBusinesses: 'dla-firm', caseStudies: 'historie-sukcesu', widgets: 'widgets' },
  pt: { explore: 'explorar', businesses: 'empresas', business: 'empresa', community: 'comunidade', whatsNew: 'novidades', pricing: 'planos', support: 'suporte', about: 'sobre-nos', faq: 'perguntas-frequentes', howItWorks: 'como-funciona', forBusinesses: 'para-empresas', caseStudies: 'casos-de-sucesso', widgets: 'widgets' },
  ru: { explore: 'explore', businesses: 'kompanii', business: 'kompaniya', community: 'soobshchestvo', whatsNew: 'novosti', pricing: 'tseny', support: 'podderzhka', about: 'o-nas', faq: 'faq', howItWorks: 'kak-eto-rabotaet', forBusinesses: 'dlya-kompaniy', caseStudies: 'kejsy', widgets: 'widgets' },
  sg: { explore: 'explore', businesses: 'businesses', business: 'business', community: 'community', whatsNew: 'whats-new', pricing: 'pricing', support: 'support', about: 'about', faq: 'faq', howItWorks: 'how-it-works', forBusinesses: 'for-businesses', caseStudies: 'case-studies', widgets: 'widgets' },
  sv: { explore: 'utforska', businesses: 'foretag', business: 'foretag', community: 'community', whatsNew: 'nyheter', pricing: 'priser', support: 'support', about: 'om-oss', faq: 'vanliga-fragor', howItWorks: 'sa-funkar-det', forBusinesses: 'for-foretag', caseStudies: 'kundberattelser', widgets: 'widgets' },
  th: { explore: 'samruat', businesses: 'thurakij', business: 'thurakij', community: 'chumchon', whatsNew: 'mee-arai-mai', pricing: 'rakha', support: 'chuailue', about: 'kiao-kap-rao', faq: 'kham-tham', howItWorks: 'withi-chai', forBusinesses: 'samrap-thurakij', caseStudies: 'korani-suksaa', widgets: 'widgets' },
  tl: { explore: 'explore', businesses: 'businesses', business: 'business', community: 'community', whatsNew: 'whats-new', pricing: 'pricing', support: 'support', about: 'about', faq: 'faq', howItWorks: 'how-it-works', forBusinesses: 'for-businesses', caseStudies: 'case-studies', widgets: 'widgets' },
  tr: { explore: 'kesfet', businesses: 'isletmeler', business: 'isletme', community: 'topluluk', whatsNew: 'yenilikler', pricing: 'fiyatlandirma', support: 'destek', about: 'hakkimizda', faq: 'sss', howItWorks: 'nasil-calisir', forBusinesses: 'isletmeler-icin', caseStudies: 'basari-hikayeleri', widgets: 'widgetlar' },
  tw: { explore: '%E6%8E%A2%E7%B4%A2', businesses: '%E5%85%AC%E5%8F%B8', business: '%E5%85%AC%E5%8F%B8', community: '%E7%A4%BE%E7%BE%A4', whatsNew: '%E6%96%B0%E5%8A%9F%E8%83%BD', pricing: '%E5%83%B9%E6%A0%BC', support: '%E6%94%AF%E6%8F%B4', about: '%E9%97%9C%E6%96%BC%E6%88%91%E5%80%91', faq: '%E5%B8%B8%E8%A6%8B%E5%95%8F%E9%A1%8C', howItWorks: '%E4%BD%BF%E7%94%A8%E6%96%B9%E6%B3%95', forBusinesses: '%E4%BC%81%E6%A5%AD%E6%9C%8D%E5%8B%99', caseStudies: '%E6%88%90%E5%8A%9F%E6%A1%88%E4%BE%8B', widgets: '%E5%B0%8F%E5%B7%A5%E5%85%B7%E5%B1%95%E7%A4%BA' },
  vi: { explore: 'kham-pha', businesses: 'doanh-nghiep', business: 'doanh-nghiep', community: 'cong-dong', whatsNew: 'co-gi-moi', pricing: 'gia', support: 'ho-tro', about: 've-chung-toi', faq: 'cau-hoi', howItWorks: 'cach-hoat-dong', forBusinesses: 'danh-cho-doanh-nghiep', caseStudies: 'cau-chuyen', widgets: 'widgets' },
};

// Mapea código de país URL → idioma para paths
const countryToLanguage: Record<string, string> = {
  // Países hispanohablantes → español
  'es': 'es', 'mx': 'es', 'ar': 'es', 'co': 'es', 'cl': 'es',
  'pe': 'es', 've': 'es', 'ec': 'es', 'gt': 'es', 'cr': 'es',
  'pa': 'es', 'uy': 'es',
  // Países anglófonos (US/CA → en, GB/IE → gb, AU → au). 'ca' es Canada;
  // el catalan va con Andorra ('ad'). Antes 'ca' aparecia dos veces y el
  // segundo valor (catalan) pisaba al primero: /ca/empreses daba 404.
  'us': 'en', 'ca': 'en',
  // Alias /en (no es un pais): sus URLs del sitemap de siempre, en ingles, ya
  // responden 200 y no se tocan.
  'en': 'en',
  'ph': 'tl', // Philippines → Filipino/Tagalog
  'gb': 'gb', 'ie': 'ie', 'sg': 'sg', 'nz': 'gb', 'za': 'gb', 'ng': 'gb',
  'in': 'hi', // India → hindi
  'au': 'au',
  // Portugués (BR y PT separados — vocabulario distinto)
  'br': 'br', 'pt': 'pt',
  // Otros idiomas
  'fr': 'fr',
  'de': 'de',
  'at': 'at', // Austria - alemán austriaco

  'it': 'it',
  'ad': 'ca', // Andorra - catalán
  'tr': 'tr', // Turquia
  // /cn es un alias (no esta en COUNTRIES): la app sirve cualquier ruta tras
  // el, y las URLs que el sitemap publica desde siempre son las inglesas
  // (/cn/explore, /cn/business/<slug>), que responden 200. No se cambian por
  // las chinas (/cn/公司/...) aunque tambien funcionen.
  'cn': 'en',
  'kr': 'ko', // Corea del Sur
  'ae': 'ar', 'sa': 'ar', 'kw': 'ar', 'eg': 'ar', // Países árabes
  'nl': 'nl', 'ru': 'ru', 'id': 'id', 'my': 'ms', 'tw': 'tw', 'hk': 'tw', 'th': 'th', 'ir': 'fa',
  'vn': 'vi', // Vietnam
  'bd': 'bn', // Bangladesh

  'se': 'sv', // Suecia
  'pl': 'pl', // Polonia
  'jp': 'ja', // Japón
};

// Obtener paths traducidos para un código de país
// Los productos resenables NO tienen URL propia (decision SEO): sus resenas se
// ven filtrando dentro de la ficha de la empresa, asi que aqui no hay entradas
// de producto.
const getPathsForCountry = (countryCode: string): PathTranslations => {
  const lang = countryToLanguage[countryCode] || 'es';
  return pathsByLanguage[lang] || pathsByLanguage.es;
};

// PostgREST corta cada respuesta en max_rows (1000 en config.toml y en el
// proyecto). Sin paginar, el sitemap se quedaria con las primeras 1000
// empresas.
// Se pide pagina a pagina con un orden total (la consulta debe terminar en
// .order('id')) y se avanza lo que haya llegado de verdad, asi que funciona
// aunque max_rows sea menor que PAGE_SIZE. Para al recibir una pagina vacia.
const PAGE_SIZE = 1000;
const MAX_PAGES = 500; // tope de seguridad: 500k filas

// Texto de cada <loc>. Los slugs vienen de la base y un solo `&` o `</loc>`
// sin escapar deja el XML entero
// invalido: Google descarta el sitemap completo, no solo esa URL. Se escapan
// SOLO `&`, `<` y `>`, los que el texto de un elemento XML no admite tal cual.
// `'` y `"` no hace falta escaparlos dentro de un elemento, y `'` es un caracter
// valido de URL que encodeURIComponent no toca (p. ej. el nombre de una empresa
// sin slug): escaparlo cambiaria los bytes de URLs validas respecto a master.
// Una URL sin `&`, `<` ni `>` sale byte a byte igual que antes; con `&`, antes
// el sitemap entero era XML invalido. No se re-codifica nada (encodeURIComponent
// cambiaria URLs ya publicadas).
const XML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
const xmlLoc = (url: string): string => url.replace(/[&<>]/g, (c) => XML_ESCAPES[c]);

async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; i < MAX_PAGES; i++) {
    const { data, error } = await page(rows.length, rows.length + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) return rows;
    rows.push(...data);
  }
  throw new Error(`fetchAllRows: mas de ${MAX_PAGES} paginas, se aborta`);
}

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

    // Obtiene las empresas con sus datos, país Y slug limpio (paginado: con mas
    // de 1000 empresas tambien se cortaria). `id` desempata created_at para que
    // el orden sea total y ninguna fila salte de pagina.
    type BusinessRow = { id: string; name: string; slug: string | null; created_at: string; country: string | null };
    let businesses: BusinessRow[];
    try {
      businesses = await fetchAllRows<BusinessRow>((from, to) =>
        supabaseClient
          .from('businesses')
          .select('id, name, slug, created_at, country')
          .order('created_at', { ascending: false })
          .order('id')
          .range(from, to)
      );
    } catch (error) {
      console.error('Error fetching businesses:', error);
      throw error;
    }

    // IMPORTANTE: Solo páginas con prefijo de idioma (NO rutas sin prefijo)
    // Los mismos prefijos que el sitemap publicaba (no se quitan ni se anaden
    // URLs): 'en', 've' y 'cn' son alias que la app sirve (URL_PREFIX_ALIASES
    // en constants.ts). 'ca' salia dos veces con las mismas URLs; va una.
    // Lo unico que cambia son los segmentos que daban 404 (ver pathsByLanguage).
    const countryCodes = [
      'es', 'en', 'br', 'pt', 'ca', 'fr', 'de', 'it',
      'mx', 'ar', 'co', 'pe', 've', 'cl', 'ec', 'gt',
      'cr', 'pa', 'uy', 'us', 'gb', 'ie', 'sg', 'nz', 'za', 'in', 'ph', 'ng', 'au', 'at',
      'cn', 'se', 'pl', 'jp', 'kr', 'ae', 'sa', 'kw', 'eg',
      'nl', 'ru', 'id', 'my', 'tw', 'hk', 'th', 'ir', 'vn', 'bd'
    ];

    const sitemapEntries: string[] = [];

    // Añadir homepage raíz (sin idioma) solo una vez con prioridad máxima
    sitemapEntries.push(`
      <url>
        <loc>${xmlLoc(`${APP_URL}/`)}</loc>
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
        <loc>${xmlLoc(`${APP_URL}${fullPath}`)}</loc>
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
        'VE': 've',  // Venezuela (alias /ve: /ve/empresa/<slug> responde 200)
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
        'AT': 'at',  // Austria
        'IT': 'it',  // Italy
        'AD': 'ad',  // Andorra (Catalán)
        'CN': 'cn',  // China
        'SE': 'se',  // Suecia
        'PL': 'pl',  // Polonia
        'JP': 'jp',  // Japón
        'AU': 'au',  // Australia
        'CA': 'ca',  // Canadá
        'KR': 'kr',  // Corea del Sur
        'IE': 'ie',  // Irlanda
        'SG': 'sg',  // Singapur
        'NZ': 'nz',  // Nueva Zelanda
        'ZA': 'za',  // Sudáfrica
        'IN': 'in',  // India
        'PH': 'ph',  // Filipinas
        'NG': 'ng',  // Nigeria
        'AE': 'ae',  // EAU
        'SA': 'sa',  // Arabia Saudita
        'KW': 'kw',  // Kuwait
        'EG': 'eg',  // Egipto
        'NL': 'nl',  // Países Bajos
        'RU': 'ru',  // Rusia
        'ID': 'id',  // Indonesia
        'MY': 'my',  // Malasia
        'TW': 'tw',  // Taiwán
        'HK': 'hk',  // Hong Kong
        'TH': 'th',  // Tailandia
        'IR': 'ir',  // Irán
        'VN': 'vn',  // Vietnam
        'BD': 'bd',  // Bangladesh
        // Turquia no estaba: sus fichas salen como /es/empresa/<slug> (la app
        // redirige a /tr/isletme/<slug>), igual que siempre. Cambiarlo es una
        // decision de SEO pendiente, no un arreglo de 404.
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
            <loc>${xmlLoc(`${APP_URL}${businessPath}`)}</loc>
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