// utils/reviewsCsv.ts
// Lectura del CSV con el que una empresa importa sus reseñas (#17, punto 3).
// El navegador lo lee y lo valida para enseñar la vista previa; la Edge Function
// import-reviews-csv vuelve a validar cada fila (el servidor es quien manda).

/** Fila lista para enviar a import-reviews-csv. */
export interface CsvReviewRow {
    author: string;
    rating: number;
    text: string;
    title: string | null;
    /** ISO 8601 o null (sin fecha: la del momento de importar). */
    date: string | null;
}

/** Error de una línea del fichero (1 = la cabecera). */
export interface CsvRowError {
    line: number;
    code: 'rating' | 'author' | 'text' | 'date' | 'columns';
}

export interface CsvParseResult {
    rows: CsvReviewRow[];
    errors: CsvRowError[];
    /** Columnas obligatorias que no se encontraron en la cabecera. */
    missingColumns: Array<'author' | 'rating' | 'text'>;
}

// Los mismos topes que la Edge Function.
export const CSV_MAX_ROWS = 500;
export const CSV_MAX_AUTHOR = 100;
export const CSV_MAX_TITLE = 150;
export const CSV_MAX_TEXT = 5000;

// Nombres de columna aceptados (sin tildes ni mayúsculas): español, inglés y
// los que exportan Google Takeout y las herramientas más comunes.
const ALIASES: Record<keyof CsvReviewRow, string[]> = {
    author: ['autor', 'nombre', 'cliente', 'author', 'name', 'reviewer', 'reviewer_name', 'user'],
    rating: ['puntuacion', 'valoracion', 'estrellas', 'nota', 'rating', 'stars', 'score', 'star_rating'],
    text: ['texto', 'comentario', 'opinion', 'resena', 'text', 'comment', 'review', 'review_text', 'content'],
    title: ['titulo', 'title', 'asunto', 'subject'],
    date: ['fecha', 'date', 'created_at', 'review_date', 'published_at', 'create_time'],
};

const normalizeHeader = (h: string): string =>
    h.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/[\s-]+/g, '_');

/** Separa un CSV (RFC 4180: comillas dobles, "" dentro de comillas, saltos de línea dentro de un campo). */
export function splitCsv(input: string, delimiter: string): string[][] {
    const text = input.replace(/^\uFEFF/, '');
    const out: string[][] = [];
    let row: string[] = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quoted) {
            if (c === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; }
                else quoted = false;
            } else field += c;
            continue;
        }
        if (c === '"' && field === '') quoted = true;
        else if (c === delimiter) { row.push(field); field = ''; }
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && text[i + 1] === '\n') i++;
            row.push(field); out.push(row); row = []; field = '';
        } else field += c;
    }
    if (field !== '' || row.length > 0) { row.push(field); out.push(row); }
    return out;
}

/** «;» si la cabecera tiene más «;» que «,» (Excel en español guarda así). */
export function detectDelimiter(input: string): string {
    const first = input.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] || '';
    const count = (ch: string) => first.split(ch).length - 1;
    if (count('\t') > count(',') && count('\t') > count(';')) return '\t';
    return count(';') > count(',') ? ';' : ',';
}

/** Fecha a ISO: 2024-05-31, 2024-05-31T10:00:00Z, 31/05/2024, 31-05-2024 o 31.05.2024 (día primero). */
export function parseReviewDate(value: string, now: number = Date.now()): string | null | 'invalid' {
    const v = value.trim();
    if (!v) return null;
    let y: number, m: number, d: number;
    let iso: string | null = null;
    const ymd = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/);
    const dmy = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (ymd) {
        [y, m, d] = [Number(ymd[1]), Number(ymd[2]), Number(ymd[3])];
        if (v.length > 10) iso = v;
    } else if (dmy) {
        [d, m, y] = [Number(dmy[1]), Number(dmy[2]), Number(dmy[3])];
    } else {
        return 'invalid';
    }
    const date = iso ? new Date(iso) : new Date(Date.UTC(y, m - 1, d, 12));
    if (Number.isNaN(date.getTime())) return 'invalid';
    // El dia tiene que existir (31/02 no) y no puede ser futuro ni anterior al 2000.
    if (!iso && (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d)) return 'invalid';
    if (date.getTime() > now || date.getUTCFullYear() < 2000) return 'invalid';
    return date.toISOString();
}

/** Puntuación entera de 1 a 5 («5», «4/5», «4 estrellas», «★★★★»). */
export function parseRating(value: string): number | null {
    const v = value.trim();
    if (/^★+$/.test(v)) return v.length <= 5 ? v.length : null;
    const m = v.match(/^([1-5])(?:[.,]0+)?(?:\s*\/\s*5)?(?:\s*[a-zA-Záéíóú]+)?$/);
    return m ? Number(m[1]) : null;
}

export function parseReviewsCsv(input: string, now: number = Date.now()): CsvParseResult {
    const table = splitCsv(input, detectDelimiter(input)).filter(r => r.some(c => c.trim() !== ''));
    const header = (table[0] || []).map(normalizeHeader);
    const col = (key: keyof CsvReviewRow) => header.findIndex(h => ALIASES[key].includes(h));
    const idx = { author: col('author'), rating: col('rating'), text: col('text'), title: col('title'), date: col('date') };
    const missingColumns = (['author', 'rating', 'text'] as const).filter(k => idx[k] < 0);
    if (missingColumns.length) return { rows: [], errors: [], missingColumns };

    const rows: CsvReviewRow[] = [];
    const errors: CsvRowError[] = [];
    table.slice(1).forEach((cells, i) => {
        const line = i + 2;
        const get = (k: number) => (k >= 0 ? (cells[k] ?? '').trim() : '');
        // Una fila con una sola celda y varias columnas en la cabecera: otro separador o una linea partida.
        if (cells.length < 2 && header.length > 1) { errors.push({ line, code: 'columns' }); return; }
        const rating = parseRating(get(idx.rating));
        if (rating === null) { errors.push({ line, code: 'rating' }); return; }
        const author = get(idx.author).replace(/\s+/g, ' ');
        if (!author || author.length > CSV_MAX_AUTHOR) { errors.push({ line, code: 'author' }); return; }
        const text = get(idx.text);
        if (text.length > CSV_MAX_TEXT) { errors.push({ line, code: 'text' }); return; }
        const date = parseReviewDate(get(idx.date), now);
        if (date === 'invalid') { errors.push({ line, code: 'date' }); return; }
        const title = get(idx.title).slice(0, CSV_MAX_TITLE) || null;
        rows.push({ author, rating, text, title, date });
    });
    return { rows, errors, missingColumns: [] };
}

/** Plantilla que se descarga desde el panel. Cabeceras en ingles: valen en todos los idiomas (ver ALIASES). */
export const CSV_TEMPLATE = [
    'author,rating,text,date,title',
    '"María López",5,"Muy buena atención, volveré.",2025-03-14,"Excelente"',
    '"John Smith",4,"Good service.",02/01/2025,',
].join('\r\n') + '\r\n';
