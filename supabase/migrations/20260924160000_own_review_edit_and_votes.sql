-- =============================================================================
-- Resena propia: editarla y no poder votarla. 2026-09-24
--
-- Hallazgos #3 y #4 del QA en produccion.
--
-- #3 El autor edita su resena desde su perfil (valoracion, titulo, texto).
--    Regla de moderacion: si estaba APROBADA vuelve a PENDIENTE; si estaba
--    pendiente, sigue pendiente. Antes de esta migracion:
--      - RLS «Users can update own pending reviews» solo dejaba editar las
--        pendientes (una aprobada daba 0 filas, sin error).
--      - guard_review_sensitive_columns (20260923120000) bloquea que el autor
--        cambie `status`, asi que el paso aprobada -> pendiente no lo puede
--        pedir el cliente.
--    Ahora:
--      1. El guard, para un llamador que no es admin ni service_role/postgres,
--         pone `status = 'pending'` cuando la fila cambia (cualquier columna
--         salvo updated_at) y no estaba pendiente. El cliente NUNCA manda
--         `status`; si lo manda (aprobada o pendiente), el guard sigue dando
--         error. helpful_votes, business_id, user_id, source... siguen
--         protegidos igual que antes.
--         Los contadores de votos no disparan esto: update_review_vote_counts
--         es SECURITY DEFINER (current_user = su dueno -> bypass del guard).
--      2. RLS de UPDATE para el autor: sus resenas pendientes o aprobadas
--         (las rechazadas se apelan, no se editan), y la fila resultante
--         pendiente o aprobada. Que una aprobada editada vuelva a pendiente y
--         que el autor no se apruebe lo garantiza el guard; el WITH CHECK
--         admite 'approved' para que guardar SIN cambios una aprobada no dé
--         error de RLS (antes exigia 'pending').
--    Produccion puede tener otra policy de UPDATE con nombre de plantilla
--    («Users can update their own reviews.»): se borran los nombres conocidos.
--    Aunque quedara otra con nombre distinto (las policies se suman con OR),
--    el guard sigue devolviendo a pendiente toda edicion del autor.
--
-- #4 El autor no puede votar la utilidad de su propia resena.
--      3. Trigger BEFORE INSERT OR UPDATE en review_votes:
--           SQLSTATE OPY02 · mensaje «OWN_REVIEW_VOTE: ...»  (autor = votante)
--           SQLSTATE OPY03 · mensaje «VOTE_REASSIGN: ...»    (UPDATE que mueve
--             un voto a otra resena u otro usuario: con eso se saltaba el
--             chequeo del INSERT y el contador de la resena de origen se
--             quedaba sin recalcular, porque el trigger de recuento solo salta
--             cuando cambia is_helpful)
--         PostgREST devuelve el SQLSTATE en `code` (HTTP 400). El frontend
--         (voteOnReview en services/supabaseService.ts) traduce OPY02 a
--         common.cannotVoteOwnReview. No hay excepcion para service_role: un
--         voto del propio autor no es legitimo venga de donde venga.
--      4. Un voto por usuario y resena: UNIQUE (review_id, user_id). Existe en
--         local (review_votes_review_id_user_id_key) y el front hace upsert con
--         onConflict sobre esas columnas; se crea solo si falta.
--    «Votar con user_id ajeno» ya lo impiden las policies de INSERT/UPDATE
--    (auth.uid() = user_id); esta migracion no las toca.
--
-- Tipos: en produccion reviews.id y review_votes.review_id son BIGINT (en local
-- uuid). Nada aqui nombra el tipo de esas columnas: el trigger de votos compara
-- review_id con reviews.id tal cual y declara la variable con %TYPE.
--
-- Requiere 20260923120000_fix_security_guards (crea el trigger del guard; aqui
-- se recrea igualmente para que la migracion se sostenga sola).
--
-- Idempotente. Rollback (en este orden):
--   DROP TRIGGER IF EXISTS trg_review_votes_block_own_review ON public.review_votes;
--   DROP FUNCTION IF EXISTS public.block_own_review_vote();
--   DROP POLICY IF EXISTS "Authors can edit own pending or approved reviews" ON public.reviews;
--   CREATE POLICY "Users can update own pending reviews" ON public.reviews FOR UPDATE
--     USING (auth.uid() = user_id AND status = 'pending');
--   y volver a ejecutar la seccion 3 de 20260923120000 (guard sin el paso a pendiente).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. reviews: el guard devuelve a pendiente la edicion del autor.
--    Mismo cuerpo que en 20260923120000 salvo el bloque marcado como NUEVO.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_review_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  caller_role public.user_role;
  col text;
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role = 'admin'::public.user_role THEN
    RETURN NEW;
  END IF;

  -- Mismo enfoque jsonb que en businesses: tolera columnas ausentes.
  IF TG_OP = 'INSERT' THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object(
      'status', 'pending',
      'source', 'opynio',
      'source_id', NULL,
      'original_author_name', NULL,
      'original_response_text', NULL,
      'original_response_date', NULL,
      'published_at', NULL,
      'rejection_reason', NULL,
      'helpful_votes', 0,
      'not_helpful_votes', 0,
      'helpful_count', 0,
      'is_verified_customer', false,
      'created_at', now()
    ));
    RETURN NEW;
  END IF;

  FOREACH col IN ARRAY ARRAY[
    'status', 'source', 'source_id', 'user_id', 'business_id',
    'original_author_name', 'published_at', 'rejection_reason',
    'helpful_votes', 'not_helpful_votes', 'helpful_count',
    'is_verified_customer', 'created_at',
    -- La "respuesta de la empresa" importada y el sello de compra verificada:
    -- el autor podia escribirse una respuesta falsa de la empresa en su propia
    -- resena (visible al publico al aprobarse). is_verified_purchase se marca
    -- al crear la resena; despues ya no lo cambia el autor.
    'original_response_text', 'original_response_date', 'is_verified_purchase'
  ] LOOP
    IF (to_jsonb(NEW) -> col) IS DISTINCT FROM (to_jsonb(OLD) -> col) THEN
      RAISE EXCEPTION 'No autorizado: campos protegidos de la reseña sólo pueden modificarlos admin o service_role.';
    END IF;
  END LOOP;

  -- NUEVO (20260924160000): el autor ha cambiado el contenido (valoracion,
  -- titulo, texto, fotos...) de una resena que no estaba pendiente -> vuelve a
  -- moderacion. updated_at no cuenta: lo pone otro trigger o el propio cliente.
  IF OLD.status IS DISTINCT FROM 'pending'
     AND (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at') THEN
    NEW.status := 'pending';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_review_sensitive_columns ON public.reviews;
CREATE TRIGGER trg_guard_review_sensitive_columns
  BEFORE INSERT OR UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_review_sensitive_columns();

-- -----------------------------------------------------------------------------
-- 2. reviews: el autor puede editar sus resenas pendientes o aprobadas.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update own pending reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can update their own reviews." ON public.reviews;
DROP POLICY IF EXISTS "Users can update their own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can update own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Authors can edit own pending or approved reviews" ON public.reviews;
-- WITH CHECK admite 'approved' (24/09, noche): con `status = 'pending'`, un
-- UPDATE SIN cambios de una resena aprobada (el autor abre la edicion y guarda
-- tal cual) fallaba con «new row violates row-level security policy»: el guard
-- solo la pasa a pendiente si cambia algo. Lo de aprobar sigue cerrado por el
-- guard: el autor no puede tocar `status` (pendiente -> approved da error) y
-- toda edicion con cambios de una aprobada vuelve a 'pending'. 'rejected' sigue
-- fuera tambien por el WITH CHECK.
CREATE POLICY "Authors can edit own pending or approved reviews"
  ON public.reviews FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status IN ('pending', 'approved'))
  WITH CHECK (auth.uid() = user_id AND status IN ('pending', 'approved'));

-- -----------------------------------------------------------------------------
-- 3. review_votes: nadie vota su propia resena ni mueve un voto de sitio.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.block_own_review_vote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_author public.reviews.user_id%TYPE;
BEGIN
  IF TG_OP = 'UPDATE'
     AND (NEW.review_id IS DISTINCT FROM OLD.review_id
          OR NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'OPY03',
      MESSAGE = 'VOTE_REASSIGN: un voto no se puede mover a otra reseña ni a otro usuario.',
      HINT    = 'Borra el voto y vota la otra reseña.';
  END IF;

  -- SECURITY DEFINER: la resena puede no ser visible para el votante por RLS
  -- (p. ej. pendiente); el autor se lee igual.
  SELECT r.user_id INTO v_author FROM public.reviews r WHERE r.id = NEW.review_id;

  IF v_author IS NOT NULL AND v_author = NEW.user_id THEN
    RAISE EXCEPTION USING
      ERRCODE = 'OPY02',
      MESSAGE = 'OWN_REVIEW_VOTE: el autor no puede votar la utilidad de su propia reseña.',
      HINT    = 'Los votos de utilidad son de otros lectores.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.block_own_review_vote() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_review_votes_block_own_review ON public.review_votes;
CREATE TRIGGER trg_review_votes_block_own_review
  BEFORE INSERT OR UPDATE ON public.review_votes
  FOR EACH ROW EXECUTE FUNCTION public.block_own_review_vote();

-- -----------------------------------------------------------------------------
-- 4. review_votes: un voto por usuario y resena (solo si falta).
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    WHERE i.indrelid = 'public.review_votes'::regclass
      AND i.indisunique
      AND i.indpred IS NULL
      AND i.indnkeyatts = 2
      AND (
        SELECT array_agg(a.attname::text ORDER BY a.attname::text)
        FROM pg_attribute a
        WHERE a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
      ) = ARRAY['review_id', 'user_id']
  ) THEN
    ALTER TABLE public.review_votes
      ADD CONSTRAINT review_votes_review_id_user_id_key UNIQUE (review_id, user_id);
  END IF;
END $$;

COMMIT;
