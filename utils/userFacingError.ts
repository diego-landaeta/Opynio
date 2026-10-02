/**
 * Errores de pagos y de cuenta traducidos para el usuario.
 *
 * Los flujos de pago y de cuenta ensenaban el texto tecnico tal cual: «Edge
 * Function returned a non-2xx status code» (lo que supabase-js pone en TODOS
 * los errores de funciones), «duplicate key value violates unique constraint»,
 * «Failed to fetch»... en espanol o en ingles segun de donde viniera, e igual
 * para todos los idiomas. Aqui se clasifica el error por lo que lleva dentro y
 * se devuelve una clave i18n y la accion recomendada. El texto crudo va solo a
 * la consola.
 *
 * Fuentes que entiende:
 *   - supabase.functions.invoke: FunctionsHttpError (context = Response; el
 *     cuerpo es JSON { error, code } en create-checkout-session y
 *     create-portal-session), FunctionsFetchError (sin red / CORS) y
 *     FunctionsRelayError.
 *   - PostgREST / RPC: { code: SQLSTATE | PGRSTxxx, message, details }.
 *   - Supabase Auth ({ status, code }) y errores de red del navegador.
 *
 * Codigos estables de las funciones (no renombrar sin tocar esto):
 *   duplicate_subscription, has_active_subscription, business_name_taken,
 *   business_limit_reached, plan_required,
 *   unauthorized, business_not_found, forbidden, rate_limited, quota_exceeded,
 *   invalid_request, invalid_plan, invalid_business_data,
 *   checkout_session_not_found,
 *   stripe_not_configured, price_unavailable, stripe_error, internal_error.
 *
 * has_active_subscription se clasifica como 'duplicateSubscription' a
 * proposito: todas las pantallas que ya abrian el portal ante un 409 de
 * checkout (Planes, Perfil) lo siguen haciendo sin cambios. Solo cambia el
 * texto, por si se ensena.
 */
import { useCallback } from 'react';
import { useI18n, useTranslation, localizedPathOrRoot } from '../contexts/i18nContext';
import { useCountry } from '../contexts/CountryContext';
import { useNotification, type NotificationAction } from '../contexts/NotificationContext';

export type UserErrorKind =
    | 'network'
    | 'sessionExpired'
    | 'forbidden'
    | 'notFound'
    | 'invalidRequest'
    | 'conflict'
    | 'rateLimit'
    | 'duplicateSubscription'
    | 'businessNameTaken'
    | 'businessLimit'
    | 'planRequired'
    | 'service'
    | 'unknown';

/** Que estaba haciendo el usuario: decide el mensaje de los fallos genericos. */
export type UserErrorFlow = 'checkout' | 'portal' | 'businessSignup' | 'invitations' | 'support' | 'generic';

/** Accion recomendada: se ensena como enlace junto al mensaje. */
export type UserErrorAction = 'support' | 'login' | 'pricing' | null;

export interface UserFacingError {
    kind: UserErrorKind;
    /** Clave i18n del mensaje. */
    key: string;
    action: UserErrorAction;
    /** Estado HTTP de la funcion, si lo hay. */
    status?: number;
    /** `code` de la funcion, SQLSTATE o PGRSTxxx, si lo hay. */
    code?: string;
    /**
     * Campos extra del cuerpo JSON de la funcion (sin error/details/code), p. ej.
     * `existing_business` de business_name_taken. Nunca texto para el usuario.
     */
    data?: Record<string, unknown>;
}

export interface UserErrorOptions {
    flow?: UserErrorFlow;
    /** Sustituye al mensaje generico del flujo (p. ej. 'myBusinesses.deleteError'). */
    fallbackKey?: string;
}

interface RawError {
    name: string;
    status: number;
    code: string;
    message: string;
    data?: Record<string, unknown>;
}

const NETWORK_RE = /failed to fetch|networkerror|load failed|network request failed|failed to send a request|err_network|err_internet_disconnected/i;

const FUNCTION_CODES: Record<string, UserErrorKind> = {
    duplicate_subscription: 'duplicateSubscription',
    // Ya tiene OTRA suscripcion: el front abre el portal para cambiar de plan
    // (antes se creaba una segunda y se cobraban las dos).
    has_active_subscription: 'duplicateSubscription',
    business_name_taken: 'businessNameTaken',
    checkout_session_not_found: 'notFound',
    business_limit_reached: 'businessLimit',
    plan_required: 'planRequired',
    unauthorized: 'sessionExpired',
    session_expired: 'sessionExpired',
    business_not_found: 'forbidden',
    forbidden: 'forbidden',
    rate_limited: 'rateLimit',
    quota_exceeded: 'rateLimit',
    invalid_request: 'invalidRequest',
    invalid_plan: 'invalidRequest',
    invalid_business_data: 'invalidRequest',
    stripe_not_configured: 'service',
    price_unavailable: 'service',
    stripe_error: 'service',
    internal_error: 'service',
    // Supabase Auth
    session_not_found: 'sessionExpired',
    refresh_token_not_found: 'sessionExpired',
    refresh_token_already_used: 'sessionExpired',
    bad_jwt: 'sessionExpired',
    no_authorization: 'sessionExpired',
};

const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');

/** Cuerpo de la respuesta de una Edge Function que ha fallado (sin consumir el original). */
async function readFunctionBody(context: any): Promise<{ code: string; message: string; data?: Record<string, unknown> }> {
    if (!context || typeof context.clone !== 'function') return { code: '', message: '' };
    try {
        const text: string = await context.clone().text();
        try {
            const body = JSON.parse(text);
            let code = str(body?.code);
            const error = str(body?.error);
            // Versiones antiguas de las funciones mandaban el codigo en `error`
            // (409 { error: 'duplicate_subscription' }).
            if (!code && /^[a-z]+(_[a-z]+)+$/.test(error)) code = error;
            let data: Record<string, unknown> | undefined;
            if (body && typeof body === 'object' && !Array.isArray(body)) {
                const { error: _e, details: _d, code: _c, message: _m, msg: _g, ...rest } = body;
                if (Object.keys(rest).length > 0) data = rest;
            }
            return { code, message: str(body?.details) || error || str(body?.message) || str(body?.msg), data };
        } catch {
            return { code: '', message: text.slice(0, 300) };
        }
    } catch {
        return { code: '', message: '' };
    }
}

async function extractRaw(err: unknown): Promise<RawError> {
    const e = (err ?? {}) as any;
    const raw: RawError = {
        name: str(e.name),
        status: Number(e.status) || 0,
        code: str(e.code),
        message: str(e.message) || (typeof err === 'string' ? err : ''),
    };
    if (raw.name === 'FunctionsHttpError' || raw.name === 'FunctionsRelayError') {
        const ctx = e.context;
        raw.status = Number(ctx?.status) || raw.status;
        const body = await readFunctionBody(ctx);
        raw.code = body.code || raw.code;
        raw.message = body.message || raw.message;
        raw.data = body.data;
    }
    return raw;
}

export function classifyUserError(raw: RawError, flow: UserErrorFlow = 'generic'): UserErrorKind {
    const { name, status, code, message } = raw;

    const byCode = FUNCTION_CODES[code.toLowerCase()];
    if (byCode) return byCode;

    if (name === 'FunctionsFetchError' || NETWORK_RE.test(message)) return 'network';
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'network';
    if (name === 'FunctionsRelayError') return 'service';

    // PostgREST / Postgres
    if (/^PGRST30[1-3]$/.test(code) || /jwt expired|invalid jwt/i.test(message)) return 'sessionExpired';
    if (code === 'PGRST116') return 'notFound';
    if (code === '42501' || /row-level security/i.test(message)) return 'forbidden';
    if (code === '23505') return 'conflict';
    // PGRST20x: funcion, columna, tabla o relacion que no esta en la cache de
    // esquema (migracion sin aplicar, app desplegada antes que la BD). Es un
    // fallo NUESTRO: antes salia «Revisa el formulario» y el usuario lo
    // reintentaba sin fin, sin enlace a Soporte.
    if (/^PGRST20[0-9]$/.test(code)) return 'service';
    // Datos que el servidor rechaza: SQLSTATE 22xxx (valor invalido) y 23xxx
    // (restriccion), y los filtros o el cuerpo mal formados (PGRST100/102). El
    // resto de PGRST10x son fallos de la peticion que monta la app.
    if (/^(2[23][0-9A-Z]{3}|PGRST10[02])$/.test(code)) return 'invalidRequest';
    if (/^PGRST10[0-9]$/.test(code)) return 'service';

    // Mensajes propios conocidos (RPC con RAISE EXCEPTION, funciones sin `code`).
    if (/l[ií]mite de negocios/i.test(message)) return 'businessLimit';
    if (/requieren? el plan|plan starter o superior/i.test(message)) return 'planRequired';
    if (/l[ií]mite de .*invitaciones/i.test(message)) return 'rateLimit';
    if (/^no autenticado/i.test(message)) return 'sessionExpired';
    if (/^no autorizado/i.test(message)) return 'forbidden';

    // Estado HTTP (funciones, Auth)
    if (status === 401) return 'sessionExpired';
    if (status === 403) return 'forbidden';
    if (status === 409) return flow === 'checkout' ? 'duplicateSubscription' : 'conflict';
    if (status === 429) return 'rateLimit';
    if (status === 400 || status === 422) return 'invalidRequest';
    // 404 de una funcion = no desplegada: fallo del servicio, no del usuario.
    if (status === 404 || status >= 500) return 'service';
    return 'unknown';
}

const FLOW_FALLBACK: Record<UserErrorFlow, string> = {
    checkout: 'userErrors.checkoutFailed',
    portal: 'userErrors.portalFailed',
    businessSignup: 'userErrors.businessSignupFailed',
    invitations: 'userErrors.invitationsFailed',
    support: 'supportPage.errorSending',
    generic: 'userErrors.generic',
};

function toUserFacing(kind: UserErrorKind, flow: UserErrorFlow, fallbackKey?: string): Pick<UserFacingError, 'key' | 'action'> {
    const fallback = fallbackKey || FLOW_FALLBACK[flow];
    // En Soporte no se ofrece «escribir a soporte»: ya esta ahi.
    const support: UserErrorAction = flow === 'support' ? null : 'support';
    // Pago y portal: un fallo que el usuario no puede arreglar (datos del
    // formulario ya validados, negocio ajeno, 404...) es «no se ha podido
    // iniciar el pago, sin cargo».
    const payment = flow === 'checkout' || flow === 'portal';

    switch (kind) {
        case 'network':
            return { key: 'userErrors.network', action: null };
        case 'sessionExpired':
            return { key: 'userErrors.sessionExpired', action: 'login' };
        case 'rateLimit':
            return { key: flow === 'invitations' ? 'userErrors.invitationsQuota' : 'userErrors.rateLimit', action: null };
        case 'businessLimit':
            return { key: 'userErrors.businessLimit', action: 'pricing' };
        case 'planRequired':
            return { key: 'userErrors.planRequired', action: 'pricing' };
        case 'duplicateSubscription':
            return { key: 'userErrors.alreadySubscribed', action: null };
        case 'businessNameTaken':
            // La pantalla de alta decide si ofrece reclamar la existente
            // (data.existing_business.claimable): ver AssignBusinessPage.
            return { key: 'userErrors.businessNameTaken', action: null };
        case 'conflict':
            if (flow === 'businessSignup') return { key: 'userErrors.businessDuplicate', action: support };
            return { key: fallback, action: support };
        case 'invalidRequest':
            if (flow === 'invitations') return { key: 'userErrors.invitationsInvalid', action: null };
            if (payment) return { key: fallback, action: support };
            return { key: fallbackKey || 'userErrors.invalidData', action: null };
        case 'forbidden':
            if (payment) return { key: fallback, action: support };
            return { key: 'userErrors.forbidden', action: support };
        default:
            return { key: fallback, action: support };
    }
}

/**
 * Clasifica un error y devuelve la clave i18n y la accion recomendada. Es
 * asincrona porque el motivo de un error de Edge Function viene en el cuerpo
 * de la respuesta.
 */
export async function getUserFacingError(err: unknown, options: UserErrorOptions = {}): Promise<UserFacingError> {
    const flow = options.flow ?? 'generic';
    const raw = await extractRaw(err);
    const kind = classifyUserError(raw, flow);
    // El detalle tecnico solo a la consola (soporte lo pide al usuario).
    console.warn(`[userFacingError] ${flow}: ${kind}`, { status: raw.status, code: raw.code, message: raw.message, name: raw.name });
    const facing = toUserFacing(kind, flow, options.fallbackKey);
    // Otra suscripcion (no la misma): «ya tienes este plan» seria falso.
    if (raw.code === 'has_active_subscription') facing.key = 'userErrors.hasActiveSubscription';
    // El price de ese plan/ciclo no existe o esta archivado en Stripe (p. ej.
    // Starter anual, docs/04 seccion 4): «intentalo de nuevo» no sirve; se
    // sugiere la otra modalidad de facturacion o Soporte.
    if (raw.code === 'price_unavailable') facing.key = 'userErrors.planUnavailable';
    return { kind, ...facing, status: raw.status || undefined, code: raw.code || undefined, data: raw.data };
}

const ACTION_LABEL: Record<Exclude<UserErrorAction, null>, string> = {
    support: 'userErrors.actionSupport',
    login: 'userErrors.actionLogin',
    pricing: 'userErrors.actionPricing',
};

/**
 * Para pantallas: traduce y ensena el error en el aviso, con el enlace de la
 * accion recomendada (Soporte, Iniciar sesion, Planes) en el idioma y pais
 * activos.
 */
export function useUserErrorNotifier() {
    const t = useTranslation();
    const { language } = useI18n();
    const { country } = useCountry();
    const { showNotification } = useNotification();

    const actionFor = useCallback(
        (action: UserErrorAction): NotificationAction | undefined =>
            action ? { label: t(ACTION_LABEL[action]), to: localizedPathOrRoot(action, language, country) } : undefined,
        [t, language, country],
    );

    /** Ensena un error ya clasificado. */
    const showUserError = useCallback(
        (info: UserFacingError) => showNotification(t(info.key), 'error', { action: actionFor(info.action) }),
        [showNotification, t, actionFor],
    );

    /** Clasifica, ensena y devuelve la clasificacion. */
    const notifyError = useCallback(
        async (err: unknown, options: UserErrorOptions = {}): Promise<UserFacingError> => {
            const info = await getUserFacingError(err, options);
            showUserError(info);
            return info;
        },
        [showUserError],
    );

    return { notifyError, showUserError, actionFor };
}
