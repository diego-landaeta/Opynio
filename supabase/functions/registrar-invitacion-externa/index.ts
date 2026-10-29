// supabase/functions/registrar-invitacion-externa/index.ts
//
// Certifex#97: deja constancia en el historial de invitaciones de una empresa de que un alumno
// ha recibido, con su diploma, la invitación a opinar. No envía correo (lo manda Certifex).
// La lógica está en _shared/invitacionExterna.ts, donde se prueba.
//
// Se llama SIN sesión de usuario (lo llama el servidor de Certifex): va con verify_jwt = false en
// config.toml y se protege con un secreto compartido en la cabecera `x-registro-clave`
// (secreto de Supabase CERTIFEX_REGISTRO_CLAVE, el mismo valor en Certifex).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { manejar, type Db } from "../_shared/invitacionExterna.ts";

declare const Deno: {
  env: { get: (key: string) => string | undefined };
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const db: Db = {
  async empresaPorSlug(slug) {
    const { data, error } = await admin.from("businesses").select("id").eq("slug", slug).maybeSingle();
    if (error) throw error;
    return data ? { id: data.id as string } : null;
  },
  async invitacionVigente(businessId, email, desde) {
    const { data, error } = await admin
      .from("review_invitations")
      .select("id")
      .eq("business_id", businessId)
      .eq("email", email)
      .neq("status", "failed")
      .gte("created_at", desde.toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? { id: data.id as string } : null;
  },
  async externasDesde(businessId, desde) {
    const { count, error } = await admin
      .from("review_invitations")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .is("sent_by", null)
      .gte("created_at", desde.toISOString());
    if (error) throw error;
    return count ?? 0;
  },
  async crearInvitacion(businessId, email) {
    const { data, error } = await admin
      .from("review_invitations")
      .insert({ business_id: businessId, email, status: "sent" })
      .select("id")
      .single();
    if (error) throw error;
    return { id: data.id as string };
  },
};

serve((req) => manejar(req, { claveEsperada: Deno.env.get("CERTIFEX_REGISTRO_CLAVE"), db }));
