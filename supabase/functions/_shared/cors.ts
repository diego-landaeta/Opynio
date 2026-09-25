// supabase/functions/_shared/cors.ts
//
// CORS restringido para funciones administrativas. Antes respondian
// `Access-Control-Allow-Origin: *`, asi que cualquier web podia llamarlas
// desde el navegador de un admin con sesion abierta.
//
// Solo se refleja el Origin si esta en la lista; si no, no se devuelve
// Access-Control-Allow-Origin y el navegador bloquea la respuesta.
// `Vary: Origin` evita que una cache sirva la cabecera de un origen a otro.
//
// NO usar en funciones publicas (widget-proxy, generate-sitemap, stripe-webhook,
// meta-capi...): esas deben seguir abiertas o no usan CORS.

const ALLOWED_ORIGINS = new Set([
  "https://web.opynio.com",
  "https://opynio.com",
  "https://www.opynio.com",
]);

// Desarrollo local: cualquier puerto de localhost / 127.0.0.1.
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;

export function isAllowedOrigin(origin: string | null): origin is string {
  if (!origin) return false;
  return ALLOWED_ORIGINS.has(origin) || LOCAL_ORIGIN.test(origin);
}

export function corsHeadersFor(
  req: Request,
  methods = "POST, OPTIONS",
): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": methods,
    "Vary": "Origin",
  };
  const origin = req.headers.get("Origin");
  if (isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}
