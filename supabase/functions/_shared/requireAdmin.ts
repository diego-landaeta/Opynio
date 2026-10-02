// supabase/functions/_shared/requireAdmin.ts
//
// Comprobacion comun para las funciones que gastan cuota de APIs de pago
// (SerpAPI, TrustIndex). Antes bastaba la anon key, que es publica porque va
// en el bundle: cualquiera podia consumir la cuota a cargo de Opynio.
//
// Devuelve null si quien llama es admin, o una Response 401/403 lista para
// devolver. Se comprueba ANTES de leer secretos, para que un anonimo no pueda
// saber que claves estan configuradas.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: {
  env: { get: (key: string) => string | undefined };
};

export async function requireAdmin(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const deny = (status: number, message: string) =>
    new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return deny(401, "No autenticado.");

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return deny(401, "No autenticado.");

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") return deny(403, "Acción solo para administradores.");

  return null;
}
