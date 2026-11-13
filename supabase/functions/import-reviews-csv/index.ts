// supabase/functions/import-reviews-csv/index.ts
//
// Importa las reseñas que una empresa trae de fuera en un CSV (#17, punto 3).
// El navegador lee el fichero (utils/reviewsCsv.ts) y manda las filas; aqui se
// vuelve a validar todo, porque el body lo controla quien llama.
//
// - Solo el dueño de la empresa y con plan Starter o superior (la prueba con
//   acceso completo cuenta, como en plan_efectivo, migracion 20261026100000).
// - Se guardan con source='imported', el nombre del autor en original_author_name
//   y status='pending': pasan por moderacion como cualquier reseña nueva y la
//   ficha las marca «Importada por la empresa».
// - Idempotente: source_id = 'csv-' + sha256 de empresa|autor|fecha|puntuacion|texto.
//   Subir dos veces el mismo fichero no duplica nada.
// - El trigger block_owner_self_review deja insertar source='imported' con
//   service_role aunque user_id sea el dueño (migracion 20260924130000).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";

declare const Deno: { env: { get: (key: string) => string | undefined } };

// Los mismos topes que utils/reviewsCsv.ts.
const MAX_ROWS = 500;
const MAX_AUTHOR = 100;
const MAX_TITLE = 150;
const MAX_TEXT = 5000;

const PLAN_LEVEL: Record<string, number> = { free: 0, starter: 1, growth: 2, pro: 3, v2: 4, enterprise: 4 };
const REQUIRED_PLAN_LEVEL = PLAN_LEVEL.starter;

type Row = { author: string; rating: number; text: string; title: string | null; date: string | null };

/** Fila valida o null. La fecha tiene que ser real, no futura y de 2000 en adelante. */
function cleanRow(raw: unknown, now: number): Row | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const rating = Number(r.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return null;
  const author = String(r.author ?? "").replace(/\s+/g, " ").trim();
  if (!author || author.length > MAX_AUTHOR) return null;
  const text = String(r.text ?? "").trim();
  if (text.length > MAX_TEXT) return null;
  const title = r.title == null ? null : String(r.title).trim().slice(0, MAX_TITLE) || null;
  let date: string | null = null;
  if (r.date != null && String(r.date).trim() !== "") {
    const t = Date.parse(String(r.date));
    if (!Number.isFinite(t) || t > now || new Date(t).getUTCFullYear() < 2000) return null;
    date = new Date(t).toISOString();
  }
  return { author, rating, text, title, date };
}

async function sha256(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return json({ error: "unauthorized" }, 401);

    let body: { businessId?: unknown; rows?: unknown };
    try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
    const businessId = typeof body.businessId === "string" ? body.businessId : "";
    if (!businessId || !Array.isArray(body.rows)) return json({ error: "bad_request" }, 400);
    if (body.rows.length === 0) return json({ error: "no_rows" }, 400);
    if (body.rows.length > MAX_ROWS) return json({ error: "too_many_rows", max: MAX_ROWS }, 400);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // La empresa y su dueño salen de la BD, no del body.
    const { data: business, error: businessError } = await supabaseAdmin
      .from("businesses")
      .select("id, owner_id, category")
      .eq("id", businessId)
      .maybeSingle();
    if (businessError) return json({ error: "server_error" }, 500);
    if (!business || business.owner_id !== user.id) return json({ error: "forbidden" }, 403);

    // select('*'): trial_full_access_until puede no existir todavia en una base sin esa migracion.
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) return json({ error: "server_error" }, 500);
    // Misma regla que plan_efectivo() y effectivePlan() (utils/planFeatures.ts).
    const finPrueba = Date.parse(String(profile?.trial_full_access_until ?? ""));
    const planEfectivo = Number.isFinite(finPrueba) && finPrueba > Date.now() ? "enterprise" : String(profile?.plan ?? "free");
    if ((PLAN_LEVEL[planEfectivo] ?? 0) < REQUIRED_PLAN_LEVEL) {
      return json({ error: "plan_required", plan: "starter" }, 403);
    }

    // Validar y quitar repetidas dentro del propio fichero.
    const now = Date.now();
    let invalid = 0;
    const porId = new Map<string, Row>();
    for (const raw of body.rows) {
      const row = cleanRow(raw, now);
      if (!row) { invalid++; continue; }
      const id = "csv-" + await sha256([businessId, row.author.toLowerCase(), row.date?.slice(0, 10) ?? "", row.rating, row.text].join("|"));
      porId.set(id, row);
    }

    // Las que ya estaban (otra importacion del mismo fichero). En tandas: la lista
    // va en la URL de PostgREST.
    const ids = [...porId.keys()];
    const existentes = new Set<string>();
    for (let i = 0; i < ids.length; i += 100) {
      const { data, error } = await supabaseAdmin
        .from("reviews")
        .select("source_id")
        .eq("business_id", businessId)
        .in("source_id", ids.slice(i, i + 100));
      if (error) return json({ error: "server_error" }, 500);
      for (const r of data ?? []) existentes.add(r.source_id);
    }

    const nuevas = ids.filter(id => !existentes.has(id)).map(id => {
      const row = porId.get(id)!;
      return {
        business_id: businessId,
        user_id: user.id,
        rating: row.rating,
        title: row.title || (row.text ? row.text.slice(0, 60) : `${row.rating}/5`),
        review_text: row.text || null,
        created_at: row.date ?? new Date(now).toISOString(),
        category: business.category,
        source: "imported",
        source_id: id,
        original_author_name: row.author,
        is_verified_purchase: false,
        status: "pending",
      };
    });

    for (let i = 0; i < nuevas.length; i += 100) {
      const { error } = await supabaseAdmin.from("reviews").insert(nuevas.slice(i, i + 100));
      if (error) {
        console.error("import-reviews-csv: insert", error.message);
        return json({ error: "server_error", imported: i }, 500);
      }
    }

    return json({
      imported: nuevas.length,
      duplicates: (body.rows.length - invalid) - nuevas.length,
      invalid,
    });
  } catch (e) {
    console.error("import-reviews-csv:", e);
    return json({ error: "server_error" }, 500);
  }
});
