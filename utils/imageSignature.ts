/**
 * Tipo REAL de una imagen, leido de sus primeros bytes.
 *
 * El navegador da `file.type` a partir de la extension («falso.png» es
 * image/png aunque dentro haya texto) y el bucket de Storage solo mira el tipo
 * declarado, asi que un fichero que no es imagen se subia y quedaba como una
 * `image_url` rota. Aqui se comprueba la firma de JPEG, PNG, GIF y WebP.
 */

export type ImageKind = 'png' | 'jpeg' | 'gif' | 'webp';

export const IMAGE_KIND_MIME: Record<ImageKind, string> = {
    png: 'image/png',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
};

/** Extension por tipo detectado (la del nombre puede mentir). */
export const IMAGE_KIND_EXT: Record<ImageKind, string> = {
    png: 'png',
    jpeg: 'jpg',
    gif: 'gif',
    webp: 'webp',
};

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0): boolean =>
    bytes.length >= offset + signature.length && signature.every((b, i) => bytes[offset + i] === b);

/** Tipo por firma, o null si no es JPEG, PNG, GIF ni WebP. */
export function imageKindFromBytes(bytes: Uint8Array): ImageKind | null {
    if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
    if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';
    // GIF87a / GIF89a
    if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) || startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) return 'gif';
    // RIFF....WEBP
    if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return 'webp';
    return null;
}

/**
 * Tipo real del fichero (lee solo los 12 primeros bytes). null = no es una
 * imagen admitida, o no se pudo leer.
 */
export async function detectImageKind(file: Blob): Promise<ImageKind | null> {
    try {
        const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
        return imageKindFromBytes(head);
    } catch {
        return null;
    }
}
