import React, { useState } from 'react';
import { useTranslation } from '../contexts/i18nContext';

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & { id: string };

/**
 * Campo de contrasena con boton propio de mostrar/ocultar.
 *
 * Antes se dependia del ojo nativo de Edge (::-ms-reveal): desaparece en cuanto
 * el campo pierde el foco y no vuelve hasta vaciarlo, ni con el valor
 * autorrellenado tras recargar. Este boton esta siempre visible, alterna cuantas
 * veces se pulse y se anuncia como conmutador (aria-pressed). El ojo nativo se
 * oculta en index.css (.password-input) para no ver dos.
 */
const PasswordInput: React.FC<Props> = ({ id, className = '', style, ...rest }) => {
    const t = useTranslation();
    const [visible, setVisible] = useState(false);
    return (
        <div className="relative">
            <input
                {...rest}
                id={id}
                type={visible ? 'text' : 'password'}
                className={`password-input ${className}`}
                // Hueco para el boton. En linea y no con pr-11: el sm:p-3 del
                // llamador va en una media query y lo pisaria desde 640 px.
                style={{ ...style, paddingRight: '2.75rem' }}
            />
            <button
                type="button"
                onClick={() => setVisible(v => !v)}
                aria-controls={id}
                aria-pressed={visible}
                aria-label={t('common.showPassword')}
                title={visible ? t('common.hidePassword') : t('common.showPassword')}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
            >
                <i className={`fa-solid ${visible ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true"></i>
            </button>
        </div>
    );
};

export default PasswordInput;
