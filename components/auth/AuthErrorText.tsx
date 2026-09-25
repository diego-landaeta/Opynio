import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n, useTranslation, localizedPathOrRoot } from '../../contexts/i18nContext';
import { useCountry } from '../../contexts/CountryContext';
import type { AuthErrorInfo } from '../../utils/authErrors';

/**
 * Texto de un error de Supabase Auth ya clasificado (utils/authErrors), con
 * enlace a Soporte cuando el fallo es del servicio y no del usuario, o a
 * «Recuperar contraseña» cuando el enlace del correo ya no vale.
 */
const AuthErrorText: React.FC<{ info: AuthErrorInfo }> = ({ info }) => {
    const t = useTranslation();
    const { language } = useI18n();
    const { country } = useCountry();
    return (
        <>
            {t(info.key)}
            {info.showRecoverLink && (
                <>
                    {' '}
                    <Link to={localizedPathOrRoot('forgotPassword', language, country)} className="font-semibold underline" data-testid="auth-error-recover-link">
                        {t('common.authErrorRequestNewLink')}
                    </Link>
                </>
            )}
            {info.showSupport && (
                <>
                    {' '}
                    <Link to={localizedPathOrRoot('support', language, country)} className="font-semibold underline">
                        {t('common.authErrorSupportLink')}
                    </Link>
                </>
            )}
        </>
    );
};

export default AuthErrorText;
