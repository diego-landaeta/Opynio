/**
 * Preparacion de la foto de perfil antes de subirla al bucket `avatars`.
 *
 * El bucket (migracion 20260923180000_avatars_bucket.sql) solo admite JPEG,
 * PNG y WebP de hasta 2 MB. Una foto de movil pesa 3-8 MB, asi que en vez de
 * rechazarla se reduce en el navegador a 512 px de lado mayor (el avatar se
 * pinta a 80 px como mucho) y se recodifica en WebP, o JPEG si el navegador no
 * sabe codificar WebP. Asi pesa decenas de KB y la subida no falla por tamano.
 */

export const AVATAR_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_MAX_SIDE = 512;
const CALIDAD = 0.85;

export type AvatarError = 'invalidType' | 'tooLarge';

export class AvatarPrepError extends Error {
    constructor(public readonly reason: AvatarError) {
        super(reason);
    }
}

const cargarImagen = (file: File): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
        img.src = url;
    });

const aBlob = (canvas: HTMLCanvasElement, type: string): Promise<Blob | null> =>
    new Promise((resolve) => canvas.toBlob(resolve, type, CALIDAD));

/**
 * Devuelve un File listo para subir o lanza AvatarPrepError.
 * - Tipo no admitido (GIF, HEIC, SVG...): 'invalidType'.
 * - Si no se puede reducir (imagen corrupta, navegador sin canvas) se usa el
 *   original solo si ya cumple el limite; si no, 'tooLarge'.
 */
export async function prepareAvatar(file: File): Promise<File> {
    if (!AVATAR_ALLOWED_TYPES.includes(file.type)) throw new AvatarPrepError('invalidType');

    let reducido: Blob | null = null;
    try {
        const img = await cargarImagen(file);
        const escala = Math.min(1, AVATAR_MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        const ancho = Math.max(1, Math.round(img.naturalWidth * escala));
        const alto = Math.max(1, Math.round(img.naturalHeight * escala));
        const canvas = document.createElement('canvas');
        canvas.width = ancho;
        canvas.height = alto;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(img, 0, 0, ancho, alto);
            // Safari antiguo devuelve PNG cuando se le pide WebP: se comprueba el tipo.
            const webp = await aBlob(canvas, 'image/webp');
            if (webp && webp.type === 'image/webp') {
                reducido = webp;
            } else {
                // JPEG no tiene transparencia: fondo blanco en vez de negro.
                ctx.globalCompositeOperation = 'destination-over';
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, ancho, alto);
                reducido = await aBlob(canvas, 'image/jpeg');
            }
        }
    } catch {
        reducido = null;
    }

    // Se sube la mas ligera de las dos (una imagen ya pequena puede no mejorar).
    if (reducido && AVATAR_ALLOWED_TYPES.includes(reducido.type) && reducido.size < file.size) {
        const ext = reducido.type === 'image/webp' ? 'webp' : 'jpg';
        const base = file.name.replace(/\.[^.]+$/, '') || 'avatar';
        return new File([reducido], `${base}.${ext}`, { type: reducido.type });
    }
    if (file.size > AVATAR_MAX_BYTES) throw new AvatarPrepError('tooLarge');
    return file;
}
