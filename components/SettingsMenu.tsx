import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from '../contexts/i18nContext';
import SettingsDrawer from './SettingsDrawer';

// Engranaje de la cabecera: abre directamente el panel lateral de ajustes
// (tema, idioma, pais y, con cuenta, sus accesos). Sustituye al boton de la
// luna y al boton flotante de idioma. Con sesion, lo que se elige tambien se
// guarda en el perfil.
const SettingsMenu: React.FC<{ buttonClassName: string }> = ({ buttonClassName }) => {
    const t = useTranslation();
    const [open, setOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Estable: el panel bloquea el scroll de la pagina y lo restaura al
    // cerrarse; si esta funcion cambiara en cada render, el efecto del panel se
    // repetiria y el scroll podria quedarse bloqueado.
    const cerrar = useCallback(() => {
        setOpen(false);
        // El foco vuelve al engranaje al cerrar.
        buttonRef.current?.focus();
    }, []);

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setOpen(true)}
                className={buttonClassName}
                aria-label={t('editProfile.settingsOpen')}
                title={t('editProfile.settingsTitle')}
                aria-haspopup="dialog"
                aria-expanded={open}
            >
                <i className={`fa-solid fa-gear transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-45' : ''}`} aria-hidden="true"></i>
            </button>
            {open && <SettingsDrawer onClose={cerrar} />}
        </>
    );
};

export default SettingsMenu;
