# 📊 Base de Datos - Configuración Completa de Opynio

Este documento contiene **TODOS los scripts SQL** necesarios para crear la plataforma Opynio desde cero.

---

## 📋 Tabla de Contenidos

1. [Configuración Inicial](#configuración-inicial)
2. [Tablas Principales](#tablas-principales)
3. [Tablas de Autenticación y Usuarios](#tablas-de-autenticación-y-usuarios)
4. [Tablas de Negocios y Reseñas](#tablas-de-negocios-y-reseñas)
5. [Tablas de Funcionalidades Avanzadas](#tablas-de-funcionalidades-avanzadas)
6. [Tablas de Planes y Facturación (Stripe)](#tablas-de-planes-y-facturación-stripe)
7. [Políticas RLS (Row Level Security)](#políticas-rls-row-level-security)
8. [Funciones y Triggers](#funciones-y-triggers)
9. [Índices para Rendimiento](#índices-para-rendimiento)

---

## ⚠️ Antes de usar este documento

Este esquema se **corrigió el 17/09/2026** tras descubrir que describía una
versión antigua de la base de datos: faltaban 12 columnas en `profiles`, el
`slug` de `businesses`, restricciones que el propio código viola, el tipo
`user_role`, el disparador que crea el perfil al registrarse y nueve tablas
enteras. Se detectó al intentar levantar un Supabase local a partir de él.

Dos cosas que conviene saber:

1. **El orden importa.** El documento anterior no se podía ejecutar de arriba
   abajo: `profiles` usaba una función definida 500 líneas más abajo. Ahora el
   orden es: extensiones → tipos → funciones → tablas → disparadores → vistas.
2. **Esto se reconstruyó desde el código** (`types.ts` y las consultas reales),
   no desde un volcado de producción. Antes de fiarte, contrástalo con tu base
   usando la consulta de verificación del final, que es de solo lectura.

---

## 🚀 Configuración Inicial

### Extensiones Requeridas

```sql
-- Activar extensión UUID para IDs únicos
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Activar extensión pgcrypto para funciones criptográficas
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Rol de usuario. Es un ENUM, no un TEXT con CHECK: varias funciones
-- SECURITY DEFINER castean a este tipo (`'authenticated'::public.user_role`)
-- y fallan si no existe.
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('admin', 'business_owner', 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Función de los disparadores de updated_at. Va AQUÍ y no al final: la usan
-- casi todas las tablas de abajo.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 👥 Tablas de Autenticación y Usuarios

### Tabla: `profiles`
Extiende la autenticación de Supabase con información adicional del usuario.

```sql
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Identidad. OJO: la columna es `name`, no `full_name`, y NO hay `email`
    -- (el correo vive en auth.users). El código lee `profiles.name`.
    name TEXT,
    username TEXT,
    avatar_url TEXT,

    -- Rol: enum, y los valores son estos tres. El disparador de alta inserta
    -- 'authenticated'; 'user' no existe en esta aplicación.
    role public.user_role NOT NULL DEFAULT 'authenticated',

    -- Plan y facturación
    plan TEXT NOT NULL DEFAULT 'free',
    billing_cycle TEXT,
    plan_expires_at TIMESTAMPTZ,
    business_limit INTEGER,
    feature_permissions JSONB,   -- solo enterprise: permisos por funcionalidad

    -- Contadores
    helpful_review_count INTEGER DEFAULT 0,
    reviews_count INTEGER DEFAULT 0,

    -- Créditos de IA
    ai_credits_used INTEGER DEFAULT 0,
    ai_credits_last_reset TIMESTAMPTZ,
    ai_credit_limit INTEGER,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- OJO: los perfiles son PUBLICOS de lectura, no privados. Si solo se pudiera
-- ver el propio, el nombre del autor de cualquier reseña saldria como
-- «Anónimo» para todo el mundo: la ficha los lee de aquí. Comprobado contra
-- producción, donde la política se llama "Profiles are viewable by everyone".
CREATE POLICY "Profiles are viewable by everyone."
    ON profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- Trigger para actualizar updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Función que rellena el perfil con los metadatos del registro. Se define
-- también en la migración 20260429214703; aquí va para que el documento se
-- pueda ejecutar entero sin depender de ella.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  INSERT INTO public.profiles (id, name, role, username, plan)
  VALUES (
    new.id,
    COALESCE(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      'Nuevo Usuario'
    ),
    'authenticated'::public.user_role,
    new.raw_user_meta_data ->> 'username',
    'free'
  );
  RETURN new;
END;
$function$;

-- SIN ESTO NO SE CREA NINGÚN PERFIL. Al registrarse un usuario, este
-- disparador copia su nombre desde los metadatos a `profiles`. La función
-- `handle_new_user()` está en la migración 20260429214703.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## 🏢 Tablas de Negocios y Reseñas

### Tabla: `businesses`
Almacena información de empresas/negocios.

```sql
CREATE TABLE IF NOT EXISTS businesses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Información básica
    name TEXT NOT NULL,
    -- `slug` es por donde la aplicación resuelve la ficha pública
    -- (/es/empresa/<slug>). Sin esta columna no carga ninguna ficha.
    slug TEXT UNIQUE,
    description TEXT,
    category TEXT NOT NULL,
    meta_description_override TEXT,

    -- Ubicación
    country TEXT NOT NULL,
    address TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),

    -- Contacto
    contact_phone TEXT,
    contact_email TEXT,
    website_url TEXT,
    social_links JSONB,

    -- Sedes adicionales por país, y si ofrece servicio internacional
    sedes JSONB,
    offers_international_services BOOLEAN DEFAULT FALSE,

    -- Medios
    logo_url TEXT,

    -- Google Maps integration
    google_maps_url TEXT UNIQUE,
    source_search_url TEXT, -- URL de búsqueda original

    -- Horarios (JSON)
    horarios JSONB,

    -- Propietario
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Plan actual
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'growth', 'pro')),

    -- Estado
    is_verified BOOLEAN DEFAULT FALSE,
    is_featured BOOLEAN DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_businesses_owner_id ON businesses(owner_id);
CREATE INDEX idx_businesses_category ON businesses(category);
CREATE INDEX idx_businesses_country ON businesses(country);
CREATE INDEX idx_businesses_google_maps_url ON businesses(google_maps_url);
CREATE INDEX idx_businesses_source_search_url ON businesses(source_search_url);

-- RLS
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view businesses"
    ON businesses FOR SELECT
    USING (true);

CREATE POLICY "Admins can manage all businesses"
    ON businesses FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Owners can manage their businesses"
    ON businesses FOR ALL
    USING (auth.uid() = owner_id);
```

### Tabla: `reviews`
Almacena reseñas de usuarios sobre negocios.

```sql
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Relaciones. `user_id` admite NULL A PROPÓSITO: las reseñas de Google y
    -- las importadas no tienen usuario en Opynio (su autor va en
    -- `original_author_name`). Ponerlo NOT NULL rompe la importación.
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

    -- Contenido
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title TEXT NOT NULL,
    review_text TEXT NOT NULL,
    category TEXT NOT NULL,

    -- Metadata de origen (para reseñas importadas)
    -- 'opynio' es el origen que escribe la aplicación al crear una reseña
    -- desde la web; sin él en el CHECK, publicar falla.
    source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'google', 'imported', 'opynio', 'scraped', 'trustindex')),
    source_id TEXT, -- ID original en la plataforma de origen
    original_author_name TEXT, -- Nombre del autor original
    is_verified_purchase BOOLEAN DEFAULT FALSE,

    -- Respuesta del negocio (importada)
    original_response_text TEXT,
    original_response_date TIMESTAMPTZ,

    -- Estado
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    published_at TIMESTAMPTZ,

    -- Contenido multimedia y etiquetas (el código las selecciona siempre)
    image_urls TEXT[],
    audio_url TEXT,
    tags TEXT[],

    -- Votos y moderación
    helpful_votes INTEGER DEFAULT 0,
    not_helpful_votes INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    is_verified_customer BOOLEAN DEFAULT FALSE,
    rejection_reason TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_reviews_user_id ON reviews(user_id);
CREATE INDEX idx_reviews_business_id ON reviews(business_id);
CREATE INDEX idx_reviews_status ON reviews(status);
CREATE INDEX idx_reviews_rating ON reviews(rating);
CREATE INDEX idx_reviews_source_id ON reviews(source_id);

-- RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view approved reviews"
    ON reviews FOR SELECT
    USING (status = 'approved');

CREATE POLICY "Users can view own reviews"
    ON reviews FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create reviews"
    ON reviews FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pending reviews"
    ON reviews FOR UPDATE
    USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins can manage all reviews"
    ON reviews FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
```

---

### Tabla: `review_responses`
Respuesta pública del negocio a una reseña. La leen el panel de reseñas, la
ficha pública y `getReviewsOptimized`.

```sql
CREATE TABLE IF NOT EXISTS review_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    response_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE review_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Respuestas visibles para todos"
    ON review_responses FOR SELECT USING (true);

-- Solo el dueño de la empresa a la que pertenece la reseña puede responder.
CREATE POLICY "El dueno responde a sus resenas"
    ON review_responses FOR ALL USING (EXISTS (
        SELECT 1 FROM reviews r
        JOIN businesses b ON b.id = r.business_id
        WHERE r.id = review_responses.review_id AND b.owner_id = auth.uid()
    ));

CREATE TRIGGER update_review_responses_updated_at
    BEFORE UPDATE ON review_responses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

> **Nota:** además de esta, el código usa tablas que siguen sin documentarse
> aquí porque no se ha podido reconstruir su forma con seguridad:
> `notifications`, `push_subscriptions`, `translation_cache`, `url_redirects`,
> `scraping_queue` y `scraping_sessions`. Si tocas alguna, documéntala.

---

## 📦 Productos reseñables (sujetos)

Permiten que una empresa tenga entidades propias con **su propia nota y su propio
widget**: hoy productos o cursos, y el tipo está abierto a servicios, empleados y
sedes sin rehacer el modelo.

> ⚠️ **No confundir con la tabla `products`**, que es de Stripe (catálogo de
> planes). Estas entidades se llaman `review_subjects` precisamente por eso.

### Tabla: `review_subjects`

```sql
CREATE TABLE IF NOT EXISTS review_subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'product'
    CHECK (type IN ('product', 'service', 'employee', 'location')),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  code TEXT,                    -- referencia interna del negocio (código de curso, SKU)
  slug TEXT,
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, slug),
  UNIQUE (business_id, code)    -- el código es único dentro de la empresa, no global
);
```

### Tabla: `review_subject_links`

Asigna una reseña **existente** a un sujeto. Es una tabla aparte y no una columna
en `reviews` para no tocar la tabla de reseñas.

```sql
CREATE TABLE IF NOT EXISTS review_subject_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID NOT NULL UNIQUE REFERENCES reviews(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES review_subjects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
```

### Reglas que hay que conocer antes de tocar esto

- **Ninguna reseña se asigna sola.** No hay backfill ni heurística: el enlace existe
  solo si alguien lo crea. Al aplicar las migraciones, cero enlaces.
- **El total de la empresa NO es la suma de sus productos.** Las reseñas de Google y
  las scrapeadas no tienen producto; `widget_business_stats` sigue contándolas todas.
  Por diseño: `suma de productos ≤ total de la empresa`.
- **`UNIQUE(review_id)`**: una reseña pertenece como mucho a un sujeto, así que no
  puede aparecer en dos widgets ni contarse dos veces. Reasignar **mueve** el enlace
  (la app usa `ON CONFLICT (review_id) DO UPDATE`).
- **Trigger `review_subject_link_same_business`**: impide enlazar una reseña de una
  empresa con el producto de otra. Un `CHECK` no puede mirar otra tabla.
- **Borrar un producto no borra reseñas**: se va el enlace, la reseña sigue contando
  en su empresa.
- **`uniq_review_per_user_business` sigue vigente**, así que un usuario sigue pudiendo
  dejar **una sola reseña por empresa**. Permitir una reseña por producto exige
  rehacer ese índice, y eso va en su propia migración.

### RPCs asociadas

| Función | Para qué |
| - | - |
| `widget_subject_stats(p_subject_id)` | Nota y nº de reseñas de un producto. La usa `widget-proxy`. |
| `widget_subject_reviews(p_subject_id, p_limit)` | Las reseñas que pinta el widget del producto. |
| `business_subject_stats(p_business_id)` | Cifras de **todos** los productos de una empresa en una sola llamada (listado del panel y ficha pública). |

Ninguna toca `widget_business_stats`: el widget de empresa devuelve exactamente lo
mismo que antes.

---

## 🎯 Tablas de Funcionalidades Avanzadas

### Tabla: `business_claims`
Solicitudes de reclamación de negocios.

```sql
CREATE TABLE IF NOT EXISTS business_claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),

    -- Documentación
    documentation_url TEXT,
    notes TEXT,
    admin_notes TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- Índices
CREATE INDEX idx_business_claims_business_id ON business_claims(business_id);
CREATE INDEX idx_business_claims_user_id ON business_claims(user_id);
CREATE INDEX idx_business_claims_status ON business_claims(status);

-- RLS
ALTER TABLE business_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own claims"
    ON business_claims FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create claims"
    ON business_claims FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all claims"
    ON business_claims FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
```

### Tabla: `review_appeals`
Apelaciones de reseñas rechazadas.

```sql
CREATE TABLE IF NOT EXISTS review_appeals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- Índices
CREATE INDEX idx_review_appeals_review_id ON review_appeals(review_id);
CREATE INDEX idx_review_appeals_user_id ON review_appeals(user_id);
CREATE INDEX idx_review_appeals_status ON review_appeals(status);

-- RLS
ALTER TABLE review_appeals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own appeals"
    ON review_appeals FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create appeals"
    ON review_appeals FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all appeals"
    ON review_appeals FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
```

### Tabla: `bug_reports`
Reportes de bugs de usuarios.

```sql
CREATE TABLE IF NOT EXISTS bug_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    title TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),

    -- Metadata
    browser_info TEXT,
    url TEXT,

    admin_notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- Índices
CREATE INDEX idx_bug_reports_user_id ON bug_reports(user_id);
CREATE INDEX idx_bug_reports_status ON bug_reports(status);
CREATE INDEX idx_bug_reports_severity ON bug_reports(severity);

-- RLS
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bug reports"
    ON bug_reports FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create bug reports"
    ON bug_reports FOR INSERT
    WITH CHECK (true); -- Cualquiera puede reportar bugs

CREATE POLICY "Admins can manage all bug reports"
    ON bug_reports FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
```

---

## 💳 Tablas de Planes y Facturación (Stripe)

### Tabla: `customers`
Mapea usuarios de Opynio con clientes de Stripe.

```sql
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    stripe_customer_id TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own customer data"
    ON customers FOR SELECT
    USING (auth.uid() = id);
```

### Tabla: `products`
Planes/productos disponibles.

```sql
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    active BOOLEAN DEFAULT TRUE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active products"
    ON products FOR SELECT
    USING (active = TRUE);
```

### Tabla: `prices`
Precios de cada producto (mensual/anual).

```sql
CREATE TABLE IF NOT EXISTS prices (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    active BOOLEAN DEFAULT TRUE,
    unit_amount BIGINT NOT NULL, -- En céntimos
    currency TEXT NOT NULL DEFAULT 'eur',
    type TEXT NOT NULL DEFAULT 'recurring',
    interval TEXT CHECK (interval IN ('month', 'year')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_prices_product_id ON prices(product_id);

-- RLS
ALTER TABLE prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active prices"
    ON prices FOR SELECT
    USING (active = TRUE);
```

### Tabla: `subscriptions`
Estado de suscripciones de usuarios.

```sql
CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired')),
    price_id TEXT NOT NULL REFERENCES prices(id),
    current_period_end TIMESTAMPTZ NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
    ON subscriptions FOR SELECT
    USING (auth.uid() = user_id);
```

---

## 🔒 Funciones y Triggers

### Función: `update_updated_at_column()`
Actualiza automáticamente la columna `updated_at`.

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar a todas las tablas con updated_at
CREATE TRIGGER update_businesses_updated_at
    BEFORE UPDATE ON businesses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at
    BEFORE UPDATE ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_claims_updated_at
    BEFORE UPDATE ON business_claims
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bug_reports_updated_at
    BEFORE UPDATE ON bug_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

---

## 📊 Vistas Útiles

### Vista: `business_stats`
Estadísticas agregadas por negocio.

```sql
CREATE OR REPLACE VIEW business_stats AS
SELECT
    b.id AS business_id,
    b.name,
    b.category,
    b.country,
    COUNT(r.id) AS total_reviews,
    AVG(r.rating) AS average_rating,
    COUNT(CASE WHEN r.status = 'pending' THEN 1 END) AS pending_reviews
FROM businesses b
LEFT JOIN reviews r ON b.id = r.business_id
GROUP BY b.id, b.name, b.category, b.country;
```

---

## ✅ Checklist de Configuración

- [ ] Ejecutar extensiones requeridas
- [ ] Crear tabla `profiles`
- [ ] Crear tabla `businesses`
- [ ] Crear tabla `reviews`
- [ ] Crear tabla `business_claims`
- [ ] Crear tabla `review_appeals`
- [ ] Crear tabla `bug_reports`
- [ ] Crear tablas `review_subjects` y `review_subject_links` + trigger + RLS
- [ ] Crear tablas de Stripe (`customers`, `products`, `prices`, `subscriptions`)
- [ ] Crear funciones y triggers
- [ ] Crear vistas útiles
- [ ] Verificar políticas RLS
- [ ] Verificar índices

---

---

## 🔎 Verificar este documento contra tu base real

Esta consulta es de **solo lectura**: no crea, no borra y no modifica nada.
Pégala en el editor SQL de Supabase y te dice en qué se diferencia tu base de
lo que dice este documento. Es la forma de no volver a fiarse a ciegas.

```sql
-- Columnas que este documento espera y que tu base PODRÍA no tener.
WITH esperado(tabla, columna) AS (VALUES
  ('profiles','name'), ('profiles','username'), ('profiles','role'),
  ('profiles','plan'), ('profiles','billing_cycle'), ('profiles','plan_expires_at'),
  ('profiles','business_limit'), ('profiles','feature_permissions'),
  ('profiles','helpful_review_count'), ('profiles','reviews_count'),
  ('profiles','ai_credits_used'), ('profiles','ai_credit_limit'),
  ('businesses','slug'), ('businesses','sedes'), ('businesses','logo_tone'),
  ('businesses','offers_international_services'), ('businesses','social_links'),
  ('reviews','image_urls'), ('reviews','audio_url'), ('reviews','tags'),
  ('reviews','source'), ('reviews','status'), ('reviews','original_author_name'),
  ('review_subjects','code'), ('review_subjects','slug'), ('review_subjects','is_active'),
  ('review_subject_links','review_id'), ('review_subject_links','subject_id')
)
SELECT e.tabla, e.columna,
       CASE WHEN c.column_name IS NULL THEN 'FALTA EN TU BASE' ELSE 'ok' END AS estado
FROM esperado e
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public' AND c.table_name = e.tabla AND c.column_name = e.columna
ORDER BY (c.column_name IS NULL) DESC, e.tabla, e.columna;  -- los problemas, primero

-- Tablas que el código usa. Las que salgan como FALTA romperán alguna pantalla.
WITH esperado(tabla) AS (VALUES
  ('profiles'), ('businesses'), ('reviews'), ('review_responses'), ('review_votes'),
  ('review_subjects'), ('review_subject_links'), ('claims'), ('bug_reports'),
  ('review_appeals'), ('notifications'), ('push_subscriptions'),
  ('translation_cache'), ('url_redirects'), ('customers'), ('subscriptions')
)
SELECT e.tabla,
       CASE WHEN t.table_name IS NULL THEN 'FALTA EN TU BASE' ELSE 'ok' END AS estado
FROM esperado e
LEFT JOIN information_schema.tables t
  ON t.table_schema = 'public' AND t.table_name = e.tabla
ORDER BY (t.table_name IS NULL) DESC, e.tabla;  -- los problemas, primero

-- Restricciones que el código viola si están como decía el documento viejo.
SELECT conrelid::regclass AS tabla, conname, pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE conrelid IN ('public.reviews'::regclass, 'public.profiles'::regclass)
  AND contype = 'c'
ORDER BY 1, 2;

-- El disparador que crea el perfil al registrarse. Si no sale ninguna fila,
-- los usuarios nuevos se quedan sin perfil.
SELECT tgname FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal;
```

---

**Última actualización:** 17 de septiembre de 2026
**Versión:** 2.0.0 — esquema corregido y hecho ejecutable en orden
