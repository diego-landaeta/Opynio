import React from 'react';

/**
 * Pinta un texto traducido que lleva <b>…</b> sin usar innerHTML: cada trozo es
 * un nodo de texto de React, asi que ni un nombre de empresa ni de usuario con
 * «<» puede inyectar marcado. Una etiqueta sin cerrar se deja como texto.
 */
const RichText: React.FC<{ text: string; boldClassName?: string }> = ({ text, boldClassName = 'font-bold text-gray-900 dark:text-white' }) => {
    const parts = text.split(/(<b>[\s\S]*?<\/b>)/g);
    return (
        <>
            {parts.map((part, i) => {
                const m = /^<b>([\s\S]*?)<\/b>$/.exec(part);
                return m ? <strong key={i} className={boldClassName}>{m[1]}</strong> : <React.Fragment key={i}>{part}</React.Fragment>;
            })}
        </>
    );
};

export default RichText;
