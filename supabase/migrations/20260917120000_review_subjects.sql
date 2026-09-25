-- =====================================================
-- SUJETOS RESEÑABLES (fase 1: productos)
-- =====================================================
-- Permite que una empresa tenga entidades propias -- de momento productos --
-- con su propia nota y su propio widget embebible.
--
-- PRINCIPIO DE DISENO: ADITIVO Y AISLADO
-- Esta migracion solo crea objetos nuevos. No hay ningun ALTER ni DROP sobre
-- tablas, indices o funciones existentes. En concreto NO se toca:
--   - la tabla reviews (ni una columna nueva)
--   - el indice uniq_review_per_user_business
--   - widget_business_stats / business_review_stats / review_stats_batch
-- Revertirla entera es un DROP de las dos tablas y las dos funciones nuevas.
--
-- NINGUNA RESENA QUEDA LIGADA AL APLICARLA. No hay backfill ni heuristica: un
-- enlace resena->sujeto existe solo si alguien lo crea explicitamente.
--
-- LIMITACION CONOCIDA DE ESTA FASE
-- uniq_review_per_user_business sigue vigente, asi que un usuario sigue pudiendo
-- dejar una sola resena por empresa. Los productos se nutren de resenas ya
-- existentes que el negocio asigna. Permitir una resena por producto exige
-- rehacer ese indice, y eso va en su propia migracion con su propio plan.
--
-- TIPO DE reviews.id (corregido el 24/09/2026, bloqueo B1 del runbook
-- docs/DESPLIEGUE-2026-09.md)
-- En PRODUCCION reviews.id es BIGINT (identity); en la base local construida
-- desde docs/01-DATABASE-SETUP.md es UUID. La primera version declaraba
-- review_id UUID y en produccion fallaba entera (FK entre uuid y bigint). Ahora
-- review_subject_links.review_id e is_review_author() toman el tipo de
-- reviews.id del propio esquema, asi que la misma migracion vale en los dos.
--
-- Idempotente (IF NOT EXISTS / DROP ... IF EXISTS): se puede repetir.

BEGIN;

-- 1. Sujetos reseñables
-- =====================================================
CREATE TABLE IF NOT EXISTS review_subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  -- El tipo esta abierto desde el principio para que anadir empleados o sedes
  -- mas adelante sea una fila, no una tabla nueva con su propio widget, su
  -- propia RPC y su propia RLS duplicadas.
  type TEXT NOT NULL DEFAULT 'product'
    CHECK (type IN ('product', 'service', 'employee', 'location')),

  name TEXT NOT NULL CHECK (length(trim(name)) > 0),

  -- Referencia del negocio: codigo de curso, SKU, lo que use internamente.
  -- Opcional, y unico dentro de la empresa cuando se rellena (en Postgres los
  -- NULL no chocan entre si, asi que varios productos pueden no tener codigo).
  code TEXT,

  slug TEXT,
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Slug y codigo solo tienen que ser unicos dentro de la empresa.
  UNIQUE (business_id, slug),
  UNIQUE (business_id, code)
);

CREATE INDEX IF NOT EXISTS idx_review_subjects_business_id ON review_subjects(business_id);
CREATE INDEX IF NOT EXISTS idx_review_subjects_type ON review_subjects(type);

COMMENT ON TABLE review_subjects IS 'Entidades reseñables dentro de una empresa (productos, y en el futuro servicios, empleados o sedes). Cada una puede tener su propio widget.';
COMMENT ON COLUMN review_subjects.code IS 'Referencia interna del negocio (código de curso, SKU). Opcional y única dentro de la empresa. No se muestra al visitante.';
COMMENT ON COLUMN review_subjects.type IS 'product | service | employee | location. Fase 1 solo usa product.';

-- 2. Enlace reseña -> sujeto
-- =====================================================
-- Tabla aparte en lugar de una columna en reviews: la tabla de resenas no se
-- toca, y revertir es un DROP TABLE sin consecuencias sobre los datos reales.
--
-- review_id lleva EL MISMO TIPO que reviews.id (bigint en produccion, uuid en
-- local). CREATE TABLE no admite `reviews.id%TYPE`, por eso se lee del catalogo
-- y se construye la sentencia. Si la tabla ya existiera con otro tipo, se para.
DO $do$
DECLARE
  v_tipo text;
  v_actual text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO v_tipo
  FROM pg_attribute a
  WHERE a.attrelid = 'public.reviews'::regclass AND a.attname = 'id' AND NOT a.attisdropped;

  IF v_tipo IS NULL OR v_tipo NOT IN ('bigint', 'integer', 'uuid') THEN
    RAISE EXCEPTION 'reviews.id tiene un tipo inesperado (%): revisa antes de aplicar.', v_tipo;
  END IF;

  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS public.review_subject_links (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

      -- UNIQUE: una resena pertenece como mucho a un sujeto, para que no pueda
      -- aparecer en dos widgets a la vez ni contarse dos veces.
      review_id %s NOT NULL UNIQUE REFERENCES public.reviews(id) ON DELETE CASCADE,

      -- Al borrar un producto desaparece el enlace, nunca la resena.
      subject_id UUID NOT NULL REFERENCES public.review_subjects(id) ON DELETE CASCADE,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
    )$sql$, v_tipo);

  SELECT format_type(a.atttypid, a.atttypmod) INTO v_actual
  FROM pg_attribute a
  WHERE a.attrelid = 'public.review_subject_links'::regclass AND a.attname = 'review_id' AND NOT a.attisdropped;
  IF v_actual IS DISTINCT FROM v_tipo THEN
    RAISE EXCEPTION 'review_subject_links.review_id es % y reviews.id es %: no coinciden.', v_actual, v_tipo;
  END IF;
END
$do$;

CREATE INDEX IF NOT EXISTS idx_review_subject_links_subject_id ON review_subject_links(subject_id);

COMMENT ON TABLE review_subject_links IS 'Asigna una reseña existente a un sujeto. Vacía al crearse: ninguna reseña queda ligada automáticamente.';

-- 3. Barrera: una reseña no puede colgar del producto de otra empresa
-- =====================================================
-- Es el error que mezclaria resenas entre empresas, y un CHECK no puede mirar
-- otra tabla. Trigger, y por tanto imposible saltarselo desde la app.
CREATE OR REPLACE FUNCTION public.review_subject_link_same_business()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_review_business UUID;
  v_subject_business UUID;
BEGIN
  SELECT business_id INTO v_review_business FROM public.reviews WHERE id = NEW.review_id;
  SELECT business_id INTO v_subject_business FROM public.review_subjects WHERE id = NEW.subject_id;

  IF v_review_business IS DISTINCT FROM v_subject_business THEN
    RAISE EXCEPTION 'La reseña % pertenece a la empresa % y el sujeto % a la empresa %: no se pueden enlazar.',
      NEW.review_id, v_review_business, NEW.subject_id, v_subject_business;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_review_subject_link_same_business ON review_subject_links;
CREATE TRIGGER trg_review_subject_link_same_business
  BEFORE INSERT OR UPDATE ON review_subject_links
  FOR EACH ROW EXECUTE FUNCTION public.review_subject_link_same_business();

-- 4. RLS
-- =====================================================
ALTER TABLE review_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_subject_links ENABLE ROW LEVEL SECURITY;

-- Lectura publica: son datos que el widget muestra en webs de terceros.
DROP POLICY IF EXISTS "Anyone can view active subjects" ON review_subjects;
CREATE POLICY "Anyone can view active subjects"
  ON review_subjects FOR SELECT
  USING (is_active = TRUE);

DROP POLICY IF EXISTS "Owners can view own subjects" ON review_subjects;
CREATE POLICY "Owners can view own subjects"
  ON review_subjects FOR SELECT
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = business_id AND b.owner_id = auth.uid()));

DROP POLICY IF EXISTS "Owners can manage own subjects" ON review_subjects;
CREATE POLICY "Owners can manage own subjects"
  ON review_subjects FOR ALL
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = business_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses b WHERE b.id = business_id AND b.owner_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage all subjects" ON review_subjects;
CREATE POLICY "Admins can manage all subjects"
  ON review_subjects FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Anyone can view links" ON review_subject_links;
CREATE POLICY "Anyone can view links"
  ON review_subject_links FOR SELECT
  USING (TRUE);

-- Escritura solo del dueno de la empresa del sujeto. El trigger ya garantiza
-- que la resena sea de esa misma empresa.
DROP POLICY IF EXISTS "Owners can manage own links" ON review_subject_links;
CREATE POLICY "Owners can manage own links"
  ON review_subject_links FOR ALL
  USING (EXISTS (
    SELECT 1 FROM review_subjects s
    JOIN businesses b ON b.id = s.business_id
    WHERE s.id = subject_id AND b.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM review_subjects s
    JOIN businesses b ON b.id = s.business_id
    WHERE s.id = subject_id AND b.owner_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Admins can manage all links" ON review_subject_links;
CREATE POLICY "Admins can manage all links"
  ON review_subject_links FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- 5. El codigo interno no sale al API publico
-- =====================================================
-- La RLS filtra FILAS, no columnas: sin esto, `code` (la referencia interna del
-- negocio) viajaria a cualquiera que consulte la tabla como anonimo. Se recorta
-- por columnas para el rol anon; `authenticated` y `service_role` la siguen
-- leyendo entera, que es lo que necesita el panel del dueno.
REVOKE SELECT ON public.review_subjects FROM anon;
GRANT SELECT (
  id, business_id, type, name, slug, description, image_url, is_active, created_at, updated_at
) ON public.review_subjects TO anon;

-- 6. Limite de productos por plan, comprobado en la base de datos
-- =====================================================
-- El resto de puertas de plan de la app son solo de interfaz: la RLS comprueba
-- propiedad, no plan. Aqui se comprueba de verdad, porque un limite que solo
-- vive en el navegador no es un limite.
--
-- LOS NUMEROS SON EDITABLES: estan todos en este CASE y en PLAN_PRODUCT_LIMITS
-- (components/pages/business/dashboard/DashboardProducts.tsx). Si cambian aqui,
-- cambiarlos alli para que la interfaz no prometa algo que la BD rechaza.
CREATE OR REPLACE FUNCTION public.enforce_product_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan TEXT;
  v_limite INT;
  v_actual INT;
BEGIN
  -- Un admin de Opynio arreglando la cuenta de un cliente no deberia chocar
  -- contra el limite comercial de ese cliente.
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin') THEN
    RETURN NEW;
  END IF;

  SELECT p.plan INTO v_plan
  FROM public.businesses b
  JOIN public.profiles p ON p.id = b.owner_id
  WHERE b.id = NEW.business_id;

  v_limite := CASE coalesce(v_plan, 'free')
                WHEN 'free'    THEN 0
                WHEN 'starter' THEN 10
                WHEN 'growth'  THEN 30
                WHEN 'pro'     THEN 100
                ELSE 2147483647   -- v2 y enterprise: sin limite practico
              END;

  SELECT count(*) INTO v_actual
  FROM public.review_subjects s
  WHERE s.business_id = NEW.business_id;

  IF v_actual >= v_limite THEN
    RAISE EXCEPTION 'PRODUCT_LIMIT_REACHED: el plan % permite % productos y la empresa % ya tiene %.',
      coalesce(v_plan, 'free'), v_limite, NEW.business_id, v_actual
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_product_limit ON review_subjects;
CREATE TRIGGER trg_enforce_product_limit
  BEFORE INSERT ON review_subjects
  FOR EACH ROW EXECUTE FUNCTION public.enforce_product_limit();

COMMENT ON FUNCTION public.enforce_product_limit() IS
  'Limita cuántos productos puede crear una empresa según el plan de su dueño. Se comprueba en la BD, no solo en la interfaz.';

-- 7. El autor de una resena puede enlazarla a un producto
-- =====================================================
-- Sin esto, quien llega desde el widget de un curso y pulsa "Escribe tu resena"
-- escribe una resena que NO queda asociada a ese curso: solo el dueno de la
-- empresa podia crear enlaces, y el visitante no lo es.
--
-- Es una politica de INSERT y nada mas: el autor puede decir a que producto se
-- refiere SU resena, pero no reasignarla despues ni tocar las de nadie. El
-- trigger de misma-empresa sigue aplicando, asi que no puede colar su resena en
-- el producto de otro negocio.
-- La comprobacion va en una funcion SECURITY DEFINER a proposito: si la politica
-- consultara `reviews` directamente, dependeria de que el autor PUEDA LEER su
-- propia resena, y una resena recien creada esta en estado 'pending'. Con esto,
-- la autorizacion no depende de las politicas de lectura de otra tabla.
--
-- p_review_id usa `public.reviews.id%TYPE`: Postgres lo resuelve al crearla
-- (bigint en produccion, uuid en local; sale un NOTICE "type reference ...
-- converted to ..."). En COMMENT y GRANT la firma se escribe igual.
CREATE OR REPLACE FUNCTION public.is_review_author(p_review_id public.reviews.id%TYPE)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.reviews r
        WHERE r.id = p_review_id AND r.user_id = auth.uid()
    );
$$;

COMMENT ON FUNCTION public.is_review_author(public.reviews.id%TYPE) IS
    'Si quien llama es el autor de esa reseña. La usa la política que le deja asociarla a un producto.';

GRANT EXECUTE ON FUNCTION public.is_review_author(public.reviews.id%TYPE) TO authenticated;

DROP POLICY IF EXISTS "Authors can link their own review" ON review_subject_links;
CREATE POLICY "Authors can link their own review"
  ON review_subject_links FOR INSERT
  WITH CHECK (
    public.is_review_author(review_id)
    -- Y solo a un producto publicado: un producto retirado no deberia recibir
    -- resenas nuevas por una URL antigua.
    AND EXISTS (
      SELECT 1 FROM public.review_subjects s
      WHERE s.id = subject_id AND s.is_active
    )
  );

COMMIT;
