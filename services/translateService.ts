// Traduccion automatica de textos de usuario (reseñas, descripciones) con el
// endpoint publico de Google Translate + cache en memoria de la sesion. Ya no
// se lee la tabla translation_cache de Supabase: en produccion tiene 0 filas y
// nadie la rellena (su RLS solo deja escribir a service_role y ninguna Edge
// Function lo hace), asi que era una peticion inutil a la BD por cada texto.
// Vive aparte de geminiService.ts para que i18nContext (carga inicial) no
// arrastre el SDK de Gemini (@google/genai, ~36 KB gzip) a cada visita.

const memoryCache = new Map<string, string>();

const GOOGLE_LANG_CODES: { [key: string]: string } = {
    'en': 'en',
    'gb': 'en',
    'au': 'en',
    'sg': 'en',
    'ie': 'en',
    'ko': 'ko',
    'ar': 'ar',
    'nl': 'nl',
    'ru': 'ru',
    'id': 'id',
    'ms': 'ms',
    'tw': 'zh-TW',
    'th': 'th',
    'fa': 'fa',
    'vi': 'vi',
    'bn': 'bn',
    'hi': 'hi',
    'tl': 'tl',
    'br': 'pt',
    'pt': 'pt',
    'fr': 'fr',
    'de': 'de',
    'at': 'de',
    'it': 'it',
    'ca': 'ca',
    'cn': 'zh-CN',
    'sv': 'sv',
    'pl': 'pl',
    'ja': 'ja',
    'es': 'es',
    'tr': 'tr',
};

// ---------------------------------------------------------------------------
// ¿Hace falta traducir? Antes se pedia TODO a Google, tambien una resena en
// espanol vista en espanol: en moderacion (admin, siempre en espanol) salian
// decenas de peticiones inutiles y el endpoint respondia 429 (en el navegador,
// error de CORS porque el 429 no trae cabeceras). Ahora se descarta la peticion
// cuando el texto ya esta en el idioma de destino:
// 1. Idioma del texto si el llamador lo sabe (hints.sourceLanguage).
// 2. Deteccion barata y conservadora (palabras funcionales exclusivas de cada
//    idioma y algunos alfabetos). Si no esta clara, no decide.
// 3. Si no decide, el pais del contenido (hints.country) cuando su idioma es el
//    de destino.
// En la duda se traduce, como antes: cuando SI hay que traducir nada cambia.
// ---------------------------------------------------------------------------

export interface TranslationHints {
    /** Idioma del texto si se conoce (codigo de la app, p. ej. 'es', 'br', 'cn', o de Google). */
    sourceLanguage?: string | null;
    /** Pais del contenido (resena, empresa): solo cuenta si la deteccion no decide. */
    country?: string | null;
    /**
     * Texto del mismo autor que acompana a este (el titulo y el cuerpo de una
     * resena): si el texto es demasiado corto para detectar su idioma
     * ("Excelente servicio"), se detecta con este. Lo pone useAutoTranslations.
     */
    contextText?: string | null;
}

// Idioma principal por pais (codigo de Google). Solo paises con un idioma claro.
const COUNTRY_LANGUAGE: Record<string, string> = {
    ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es', VE: 'es', EC: 'es', GT: 'es',
    CR: 'es', PA: 'es', UY: 'es', BO: 'es', PY: 'es', NI: 'es', HN: 'es', DO: 'es', CU: 'es', SV: 'es',
    BR: 'pt', PT: 'pt', FR: 'fr', DE: 'de', AT: 'de', IT: 'it', AD: 'ca',
    US: 'en', GB: 'en', IE: 'en', AU: 'en', NZ: 'en',
};

// Palabras muy frecuentes de cada idioma (funcionales y de resena). Solo
// puntuan las EXCLUSIVAS (las que estan en una sola lista): "de", "que", "la",
// "curso", "todos"... no deciden nada. Por eso las listas llevan tambien
// palabras compartidas ("as", "do", "me", "su", "curso"): para que dejen de
// contar como exclusivas de otro idioma.
const FUNCTION_WORDS: Record<string, string[]> = {
    es: ['el', 'los', 'las', 'y', 'a', 'muy', 'pero', 'para', 'por', 'con', 'una', 'un', 'del', 'al', 'es', 'fue', 'son', 'hay', 'lo', 'su', 'sus', 'mi', 'me', 'nos', 'le', 'les', 'se', 'que', 'de', 'en', 'la', 'no', 'más', 'también', 'todo', 'todos', 'todas', 'gracias', 'atención', 'trato', 'recomiendo', 'recomendable', 'buena', 'bueno', 'buen', 'muchas', 'mucho', 'muchos', 'mucha', 'sin', 'como', 'cuando', 'porque', 'están', 'está', 'servicio', 'siempre', 'ellos', 'nada', 'aquí', 'estoy', 'estaba', 'tienen', 'tiene', 'tengo', 'hace', 'hacer', 'hecho', 'hice', 'años', 'ya', 'ahora', 'así', 'asi', 'mejor', 'curso', 'cursos', 'formación', 'formacion', 'experiencia', 'trabajo', 'trabajar', 'aprender', 'aprendido', 'aprendes', 'puedes', 'puede', 'contenido', 'práctico', 'practico', 'clases', 'profesores', 'dudas', 'hemos', 'eso', 'esto', 'estos', 'esta', 'este', 'estas', 'después', 'despues', 'mismo', 'justo', 'buscaba', 'desde', 'gente', 'lugar', 'sobre', 'calidad', 'precio', 'personal', 'ha', 'han', 'era', 'sido', 'algo', 'cada', 'nuevo', 'nueva'],
    pt: ['o', 'os', 'as', 'e', 'a', 'é', 'muito', 'muita', 'mas', 'para', 'por', 'com', 'uma', 'um', 'do', 'da', 'dos', 'das', 'no', 'na', 'nos', 'nas', 'em', 'foi', 'são', 'há', 'seu', 'sua', 'meu', 'minha', 'não', 'mais', 'também', 'tudo', 'todo', 'todos', 'todas', 'obrigado', 'obrigada', 'atendimento', 'serviço', 'recomendo', 'boa', 'bom', 'sem', 'como', 'quando', 'porque', 'você', 'ótimo', 'ótima', 'que', 'de', 'se', 'está', 'eles', 'nada', 'aqui', 'sempre', 'estou', 'tem', 'têm', 'anos', 'já', 'agora', 'assim', 'melhor', 'curso', 'cursos', 'formação', 'experiência', 'trabalho', 'aprender', 'pode', 'conteúdo', 'prático', 'aulas', 'professores', 'esta', 'este', 'estas', 'desde', 'sobre', 'qualidade', 'preço', 'pessoal', 'era', 'sido', 'algo', 'cada', 'novo', 'nova', 'ha'],
    en: ['the', 'and', 'to', 'of', 'in', 'is', 'it', 'for', 'was', 'with', 'very', 'but', 'this', 'that', 'my', 'i', 'they', 'we', 'you', 'are', 'not', 'great', 'recommend', 'staff', 'good', 'have', 'had', 'be', 'on', 'at', 'so', 'all', 'from', 'would', 'highly', 'as', 'do', 'me', 'no', 'a', 'an', 'our', 'their', 'there', 'were', 'been', 'will', 'always', 'thank', 'thanks', 'service', 'friendly', 'here', 'years', 'he', 'she', 'his', 'her', 'personal', 'era'],
    fr: ['le', 'la', 'les', 'des', 'et', 'est', 'pour', 'avec', 'très', 'mais', 'pas', 'je', 'nous', 'vous', 'ce', 'cette', 'du', 'au', 'aux', 'sur', 'bien', 'merci', 'une', 'un', 'qui', 'que', 'de', 'en', 'il', 'elle', 'sont', 'été', 'accueil', 'service', 'recommande', 'personnel', 'tout', 'plus', 'ont', 'avons', 'toujours', 'ici', 'ans', 'ne', 'se', 'me', 'on', 'son', 'sa', 'ses', 'mon', 'ma'],
    de: ['der', 'die', 'das', 'und', 'ist', 'nicht', 'sehr', 'mit', 'für', 'ich', 'wir', 'sie', 'ein', 'eine', 'auf', 'zu', 'den', 'dem', 'auch', 'war', 'gut', 'aber', 'es', 'sich', 'von', 'im', 'bei', 'wie', 'hat', 'haben', 'immer', 'freundlich', 'kann', 'empfehlen', 'wurde', 'wurden', 'uns', 'mir', 'hier', 'jahre', 'in', 'so', 'an', 'personal'],
    it: ['il', 'lo', 'gli', 'di', 'a', 'che', 'è', 'e', 'per', 'con', 'molto', 'ma', 'non', 'sono', 'del', 'della', 'dei', 'delle', 'anche', 'ho', 'bene', 'grazie', 'un', 'una', 'la', 'le', 'in', 'si', 'mi', 'ci', 'al', 'alla', 'servizio', 'personale', 'consiglio', 'ottimo', 'ottima', 'tutto', 'sempre', 'abbiamo', 'qui', 'anni', 'o', 'no', 'se', 'come', 'quando', 'perché', 'su', 'da', 'ha', 'era', 'poco', 'nuovo', 'cucina'],
    ca: ['el', 'els', 'les', 'i', 'a', 'és', 'amb', 'per', 'molt', 'molta', 'però', 'no', 'un', 'una', 'del', 'al', 'als', 'ho', 'hi', 'perquè', 'gràcies', 'servei', 'bé', 'tot', 'que', 'de', 'la', 'en', 'ha', 'han', 'són', 'recomano', 'bon', 'bona', 'sempre', 'aquí', 'anys', 'se', 'me', 'com', 'quan', 'curs', 'cada', 'era', 'personal', 'desde'],
    nl: ['de', 'het', 'een', 'en', 'van', 'is', 'niet', 'met', 'voor', 'zeer', 'heel', 'maar', 'dat', 'die', 'wij', 'ik', 'op', 'ook', 'goed', 'zijn', 'was', 'er', 'te', 'aan', 'bij', 'altijd', 'vriendelijk', 'we', 'in', 'hier', 'jaar', 'so', 'as', 'personeel'],
};

// Letras o signos que solo usa un idioma de la lista (una palabra con ñ, un ¿).
const SIGNATURE_CHARS: Array<[RegExp, string]> = [
    [/[ñ¿¡]/, 'es'],
    [/[ãõ]/, 'pt'],
    [/ß/, 'de'],
];

const DISTINCTIVE: Map<string, string> = (() => {
    const owners = new Map<string, Set<string>>();
    for (const [lang, words] of Object.entries(FUNCTION_WORDS)) {
        for (const w of words) {
            if (!owners.has(w)) owners.set(w, new Set());
            owners.get(w)!.add(lang);
        }
    }
    const result = new Map<string, string>();
    for (const [w, langs] of owners) if (langs.size === 1) result.set(w, [...langs][0]);
    return result;
})();

const countMatches = (text: string, re: RegExp) => (text.match(re) || []).length;

/** Idioma del texto (codigo de Google) si esta claro; null si no. */
export const detectTextLanguage = (text: string): string | null => {
    const sample = text.slice(0, 2000);
    const letters = countMatches(sample, /\p{L}/gu);
    if (letters < 8) return null;
    // Alfabetos que no dejan duda.
    if (countMatches(sample, /[\u3040-\u30ff]/g) / letters > 0.1) return 'ja';
    if (countMatches(sample, /[\uac00-\ud7af\u1100-\u11ff]/g) / letters > 0.5) return 'ko';
    if (countMatches(sample, /[\u0e00-\u0e7f]/g) / letters > 0.5) return 'th';
    if (countMatches(sample, /[a-zA-Z\u00c0-\u024f]/g) / letters < 0.9) return null;
    // Latino: palabras exclusivas y letras propias.
    const score: Record<string, number> = {};
    let words = 0;
    for (const token of sample.toLowerCase().split(/[^\p{L}]+/u)) {
        if (!token) continue;
        words++;
        const lang = DISTINCTIVE.get(token);
        if (lang) score[lang] = (score[lang] || 0) + 1;
        else {
            const sig = SIGNATURE_CHARS.find(([re]) => re.test(token));
            if (sig) score[sig[1]] = (score[sig[1]] || 0) + 1;
        }
    }
    if (/[¿¡]/.test(sample)) score.es = (score.es || 0) + 1;
    const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
    if (ranked.length === 0) return null;
    const [best, bestHits] = ranked[0];
    const second = ranked[1]?.[1] || 0;
    // Conservador: 2 aciertos sin ninguno de otro idioma, o 3 y el triple que
    // el siguiente. En textos cortos (un titulo, "Borrador sin enviar") basta
    // uno si ningun otro idioma puntua: no dan para mas y eran la mayoria de
    // las peticiones es->es. Con una palabra suelta en un texto largo no se
    // decide.
    const minHits = words <= 6 ? 1 : 2;
    if (second === 0 ? bestHits < minHits : (bestHits < 3 || bestHits < second * 3)) return null;
    return best;
};

const googleCode = (lang: string | null | undefined): string | null => {
    if (!lang) return null;
    return GOOGLE_LANG_CODES[lang] || lang;
};

/**
 * false si el texto ya esta en el idioma de destino y pedirlo a Google no
 * cambiaria nada. En la duda devuelve true (se traduce, como siempre).
 */
export const needsTranslation = (text: string | null | undefined, targetLanguage: string, hints?: TranslationHints): boolean => {
    if (!text || !text.trim()) return false;
    const target = googleCode(targetLanguage);
    const source = googleCode(hints?.sourceLanguage);
    if (source) return source !== target;
    const detected = detectTextLanguage(text)
        || (hints?.contextText ? detectTextLanguage(hints.contextText) : null);
    if (detected) return detected !== target;
    const countryLang = hints?.country ? COUNTRY_LANGUAGE[hints.country.toUpperCase()] : undefined;
    if (countryLang && countryLang === target) return false;
    return true;
};

// Backoff de Google: tras un 429 (o el error de red/CORS con el que el
// navegador lo disfraza) no se le pide nada durante un rato, que crece si se
// repite. En ese tiempo se muestra el original, sin recordarlo como traducido:
// al pasar el rato se vuelve a intentar.
const BACKOFF_KEY = 'opynio_translate_backoff_until';
const BACKOFF_MIN_MS = 30_000;
const BACKOFF_MAX_MS = 10 * 60_000;
let backoffMs = BACKOFF_MIN_MS;
let backoffUntil = (() => {
    try { return Number(sessionStorage.getItem(BACKOFF_KEY) || 0); } catch { return 0; }
})();
const inBackoff = () => Date.now() < backoffUntil;
const startBackoff = () => {
    backoffUntil = Date.now() + backoffMs;
    backoffMs = Math.min(backoffMs * 2, BACKOFF_MAX_MS);
    try { sessionStorage.setItem(BACKOFF_KEY, String(backoffUntil)); } catch { /* sin almacenamiento */ }
};

// Peticiones en curso por texto+idioma. Una ficha con 20 tarjetas pedia el
// mismo texto a Google hasta 14 veces a la vez, y el endpoint (no oficial)
// responde 429 Too Many Requests y corta al visitante.
const inflight = new Map<string, Promise<string>>();

export const translateText = async (text: string, targetLanguage: string = 'en', hints?: TranslationHints): Promise<string> => {
    if (!text) return text;
    // Ya esta en el idioma de destino: no se pide nada.
    if (!needsTranslation(text, targetLanguage, hints)) return text;

    const targetCode = GOOGLE_LANG_CODES[targetLanguage] || targetLanguage;
    const memKey = `${text}_${targetCode}`;

    // L1: Memory cache (instant)
    if (memoryCache.has(memKey)) return memoryCache.get(memKey)!;

    const pending = inflight.get(memKey);
    if (pending) return pending;

    const request = translateWithGoogle(text, targetCode, memKey)
        .finally(() => inflight.delete(memKey));
    inflight.set(memKey, request);
    return request;
};

// Mismo idioma para Google: 'pt' y 'pt-PT' si, 'zh-CN' y 'zh-TW' no (el chino
// simplificado y el tradicional si se traducen entre si).
const isSameGoogleLanguage = (a: string, b: string): boolean => {
    const x = a.toLowerCase();
    const y = b.toLowerCase();
    if (x === y) return true;
    if (x.startsWith('zh') || y.startsWith('zh')) return false;
    return x.split('-')[0] === y.split('-')[0];
};

// Google Translate (salvo en backoff por 429). Sin cache persistente: ver la
// cabecera del fichero.
const translateWithGoogle = async (text: string, targetCode: string, memKey: string): Promise<string> => {
    if (inBackoff()) return text;
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetCode}&dt=t&q=${encodeURIComponent(text)}`;
        let response: Response;
        try {
            response = await fetch(url);
        } catch {
            // Sin respuesta legible: red caida o, casi siempre, un 429 sin
            // cabeceras CORS. Se espera antes de volver a pedir nada.
            startBackoff();
            return text;
        }
        if (response.status === 429) {
            startBackoff();
            return text;
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        backoffMs = BACKOFF_MIN_MS;

        const data = await response.json();
        const segments = data?.[0];
        if (!Array.isArray(segments)) throw new Error('Unexpected response format');

        // Google dice en data[2] el idioma que ha detectado. Si ya era el de
        // destino, su "traduccion" es el mismo texto con retoques (mayusculas,
        // puntuacion) y la tarjeta ofrecia «Ver original» sin haber traducido.
        const detectedSource = typeof data?.[2] === 'string' ? data[2].toLowerCase() : '';
        if (detectedSource && isSameGoogleLanguage(detectedSource, targetCode)) {
            memoryCache.set(memKey, text);
            return text;
        }

        const translated = segments.map((seg: any[]) => seg[0]).join('').trim();
        if (!translated) throw new Error('Empty translation');

        memoryCache.set(memKey, translated);
        return translated;
    } catch {
        // El fallo tambien se recuerda en esta sesion: sin esto, cada render
        // volvia a pedir el mismo texto y el 429 no terminaba nunca.
        memoryCache.set(memKey, text);
        return text;
    }
};