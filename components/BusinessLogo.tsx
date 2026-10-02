import React, { useState } from 'react';
import type { LogoTone } from '../types';

/**
 * Logo de empresa sobre un chip que garantiza contraste.
 *
 * La imagen NO se modifica: mismo src, sin filtros ni recolores. Lo unico que cambia
 * es el fondo que hay detras, segun `tone`:
 *
 *   'light'  logo de contenido claro (PNG blanco con transparencia). El chip va oscuro
 *            en AMBOS temas, porque sobre el gris claro por defecto no se ve nada.
 *   'dark'   logo de contenido oscuro. El chip va claro en AMBOS temas.
 *   null     sin medir o medida no concluyente. Fondo por defecto, igual que siempre.
 *
 * `tone` se mide offline y llega en businesses.logo_tone: el navegador no puede
 * calcularlo porque los logos viven en dominios ajenos sin CORS y contaminan el canvas.
 */

interface BusinessLogoProps {
    logoUrl?: string | null;
    businessName: string;
    tone?: LogoTone | null;
    /** Clases de tamano del chip. Debe incluir ancho y alto. */
    className?: string;
    /** Tamano del icono de respaldo cuando no hay logo o falla la carga. */
    iconSize?: string;
    /**
     * Icono de respaldo. Por defecto una tienda, que es lo que representa una
     * empresa; quien pinte otra cosa (un producto, por ejemplo) pasa el suyo.
     */
    fallbackIcon?: string;
    /** Radio del chip, para encajar con cada tarjeta. */
    rounded?: string;
    /** Borde del chip. Se desactiva donde el diseno no lo lleva. */
    bordered?: boolean;
    /** Padding interior alrededor del logo. */
    padding?: string;
    /**
     * Encaje de la imagen. 'contain' (por defecto) muestra el logo entero; 'cover'
     * recorta, y solo se usa donde la pagina ya lo hacia, para no cambiar su aspecto.
     */
    fit?: 'contain' | 'cover';
    /**
     * Clases del chip cuando NO hay tono medido. Cada pagina tenia su propio matiz
     * (unas usan zinc-700, otras zinc-800 con sombra); se respeta tal cual para que
     * este componente no cambie el aspecto de nada que hoy ya se vea bien.
     */
    defaultChip?: string;
    width?: number;
    height?: number;
}

const CHIP_BY_TONE: Record<string, string> = {
    // Logo claro -> siempre fondo oscuro. zinc-800 es el mismo tono que ya usan las
    // tarjetas en modo oscuro, asi que no introduce un color nuevo al sistema.
    light: 'bg-zinc-800 border-zinc-700',
    // Logo oscuro -> siempre fondo claro.
    dark: 'bg-white border-gray-200',
};

const CHIP_DEFAULT = 'bg-gray-100 dark:bg-zinc-700 border-gray-200 dark:border-zinc-600';

// Clases literales: Tailwind escanea el fuente en busca de nombres completos, asi que
// una clase compuesta en tiempo de ejecucion (`object-${fit}`) no se generaria.
const FIT_CLASS: Record<'contain' | 'cover', string> = {
    contain: 'object-contain',
    cover: 'object-cover',
};

const BusinessLogo: React.FC<BusinessLogoProps> = ({
    logoUrl,
    businessName,
    tone,
    className = 'w-16 h-16',
    iconSize = 'text-xl',
    fallbackIcon = 'fa-store',
    rounded = 'rounded-lg',
    bordered = true,
    padding = 'p-1',
    fit = 'contain',
    defaultChip = CHIP_DEFAULT,
    width = 64,
    height = 64,
}) => {
    const [imageError, setImageError] = useState(false);

    const hasLogo = Boolean(logoUrl) && !imageError;
    // El chip especial solo tiene sentido si de verdad hay un logo que enseñar.
    // Sin logo se pinta el icono de respaldo, que ya contrasta en ambos temas.
    const chip = hasLogo && tone ? CHIP_BY_TONE[tone] : defaultChip;

    return (
        <div
            className={`${className} ${rounded} ${chip} ${bordered ? 'border' : ''} flex-shrink-0 flex items-center justify-center overflow-hidden`}
        >
            {hasLogo ? (
                <img
                    src={logoUrl as string}
                    alt={`${businessName} logo`}
                    width={width}
                    height={height}
                    loading="lazy"
                    decoding="async"
                    className={`w-full h-full ${FIT_CLASS[fit]} ${padding}`}
                    onError={() => setImageError(true)}
                />
            ) : (
                <div className="text-gray-400 dark:text-gray-500">
                    <i className={`fa-solid ${fallbackIcon} ${iconSize}`}></i>
                </div>
            )}
        </div>
    );
};

export default BusinessLogo;
