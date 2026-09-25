/**
 * Mensajes de error de Supabase Auth traducidos.
 *
 * Las paginas de acceso, registro y contrasena mostraban `err.message` tal cual
 * («Error sending recovery email», «Invalid login credentials», «For security
 * purposes, you can only request this after 42 seconds»): en ingles para todos
 * y a veces echando la culpa al usuario de un fallo del servicio. Aqui se
 * clasifica el error por su `code`/`status` (auth-js >= 2.x) y, si falta, por
 * el texto, y se devuelve una clave i18n. El texto crudo de Supabase no se
 * ensena nunca; como ultimo recurso sale un mensaje generico traducido.
 */

export type AuthErrorKind =
    | 'invalidCredentials'
    | 'emailNotConfirmed'
    | 'userAlreadyExists'
    | 'weakPassword'
    | 'samePassword'
    | 'rateLimit'
    | 'invalidEmail'
    | 'signupDisabled'
    | 'emailSendFailed'
    | 'databaseError'
    | 'userBanned'
    | 'sessionMissing'
    | 'resetLinkExpired'
    | 'network'
    | 'service'
    | 'unknown';

/** Donde ocurre: cambia el mensaje de algunos casos (p. ej. un 500 al pedir el correo). */
export type AuthErrorContext = 'login' | 'register' | 'recover' | 'reset' | 'oauth';

export interface AuthErrorInfo {
    kind: AuthErrorKind;
    /** Clave i18n del mensaje. */
    key: string;
    /** Si conviene ofrecer el enlace a Soporte (fallos del servicio, no del usuario). */
    showSupport: boolean;
    /** Enlace a «Recuperar contraseña» para pedir un enlace nuevo (el de recuperacion caduco o ya se uso). */
    showRecoverLink?: boolean;
}

type AnyError = { code?: unknown; status?: unknown; message?: unknown; name?: unknown; __isAuthError?: unknown } | null | undefined;

export function classifyAuthError(err: unknown): AuthErrorKind {
    const e = err as AnyError;
    const code = typeof e?.code === 'string' ? e.code : '';
    const status = Number(e?.status) || 0;
    const msg = typeof e?.message === 'string' ? e.message : '';
    const name = typeof e?.name === 'string' ? e.name : '';

    if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) return 'invalidCredentials';
    // Cuenta bloqueada por un admin (ban_duration). Antes caia en el generico
    // «algo ha fallado por nuestra parte» y el usuario reintentaba sin fin.
    if (code === 'user_banned' || /user is banned/i.test(msg)) return 'userBanned';
    // Sin sesion de recuperacion: el enlace del correo caduco, ya se uso o se
    // abrio en otro navegador. auth-js lanza AuthSessionMissingError al
    // cambiar la contrasena; el servidor responde session_not_found u
    // otp_expired. Que mensaje sale lo decide el contexto (getAuthErrorInfo).
    if (name === 'AuthSessionMissingError' || code === 'session_not_found' || code === 'otp_expired'
        || /auth session missing|session.*(not found|does not exist)|email link is invalid or has expired|token has expired or is invalid/i.test(msg)) return 'sessionMissing';
    if (code === 'email_not_confirmed' || /email not confirmed/i.test(msg)) return 'emailNotConfirmed';
    if (code === 'user_already_exists' || code === 'email_exists' || /already (been )?registered|user already exists/i.test(msg)) return 'userAlreadyExists';
    // same_password antes que weak_password: su texto («New password should be
    // different...») tambien contiene «password should be».
    if (code === 'same_password' || /different from the old password/i.test(msg)) return 'samePassword';
    if (code === 'weak_password' || name === 'AuthWeakPasswordError' || /password should (be|contain)|weak password|password is known to be weak/i.test(msg)) return 'weakPassword';
    if (status === 429 || /^over_.*_rate_limit$/.test(code) || /for security purposes|rate limit/i.test(msg)) return 'rateLimit';
    if (code === 'email_address_invalid' || code === 'email_address_not_authorized' || /unable to validate email|invalid format|email address .* is invalid/i.test(msg)) return 'invalidEmail';
    if (code === 'signup_disabled' || code === 'email_provider_disabled' || /signups? not allowed|signups? (are )?disabled/i.test(msg)) return 'signupDisabled';
    if (/error sending .*(email|link)/i.test(msg)) return 'emailSendFailed';
    if (/database error saving new user/i.test(msg)) return 'databaseError';
    // Sin respuesta del servidor (sin red, CORS, DNS): auth-js lo da con status 0.
    if ((name === 'AuthRetryableFetchError' && status === 0) || /failed to fetch|networkerror|load failed|network request failed/i.test(msg)) return 'network';
    if (status >= 500 || name === 'AuthRetryableFetchError' || code === 'unexpected_failure' || code === 'request_timeout' || /^hook_/.test(code)) return 'service';
    return 'unknown';
}

/**
 * Clave i18n y si hay que ofrecer Soporte. `fallbackKey` sustituye al generico
 * cuando la pagina ya tiene uno mejor (p. ej. «No se pudo iniciar sesion con Google»).
 */
export function getAuthErrorInfo(err: unknown, context: AuthErrorContext, fallbackKey?: string): AuthErrorInfo {
    let kind = classifyAuthError(err);
    // Al pedir el correo de recuperacion, cualquier fallo del servidor es un
    // problema de envio del servicio, no de la direccion.
    if (context === 'recover' && kind === 'service') kind = 'emailSendFailed';
    // Al poner la contrasena nueva, «sin sesion» es que el enlace del correo ya
    // no vale: se dice asi y se ofrece pedir otro. En otros contextos no es
    // algo que el usuario pueda arreglar: generico con Soporte.
    if (kind === 'sessionMissing') kind = context === 'reset' ? 'resetLinkExpired' : 'unknown';

    switch (kind) {
        case 'resetLinkExpired':
            return { kind, key: 'common.authErrorResetLinkExpired', showSupport: false, showRecoverLink: true };
        case 'userBanned':
            return { kind, key: 'common.authErrorUserBanned', showSupport: true };
        case 'invalidCredentials':
            return { kind, key: 'loginPage.error', showSupport: false };
        case 'emailNotConfirmed':
            return { kind, key: 'common.authErrorEmailNotConfirmed', showSupport: false };
        case 'userAlreadyExists':
            return { kind, key: 'common.authErrorUserExists', showSupport: false };
        case 'weakPassword':
            return { kind, key: 'common.authErrorWeakPassword', showSupport: false };
        case 'samePassword':
            return { kind, key: 'common.authErrorSamePassword', showSupport: false };
        case 'rateLimit':
            return { kind, key: 'common.authErrorRateLimit', showSupport: false };
        case 'invalidEmail':
            return { kind, key: 'common.authErrorInvalidEmail', showSupport: false };
        case 'signupDisabled':
            return { kind, key: 'common.authErrorSignupDisabled', showSupport: true };
        case 'emailSendFailed':
            return { kind, key: 'common.authErrorEmailSendFailed', showSupport: true };
        case 'databaseError':
            return { kind, key: 'registerPage.registrationErrorDB', showSupport: true };
        case 'network':
            return { kind, key: 'common.authErrorNetwork', showSupport: false };
        default:
            return { kind, key: fallbackKey || 'common.authErrorGeneric', showSupport: true };
    }
}
