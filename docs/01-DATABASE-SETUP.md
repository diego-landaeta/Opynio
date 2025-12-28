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

## 🚀 Configuración Inicial

### Extensiones Requeridas

```sql
-- Activar extensión UUID para IDs únicos
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Activar extensión pgcrypto para funciones criptográficas
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

---

## 👥 Tablas de Autenticación y Usuarios

### Tabla: `profiles`
Extiende la autenticación de Supabase con información adicional del usuario.

```sql
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),

    -- Configuración
    language TEXT DEFAULT 'es',
    theme TEXT DEFAULT 'system',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- Trigger para actualizar updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
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
    description TEXT,
    category TEXT NOT NULL,

    -- Ubicación
    country TEXT NOT NULL,
    address TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),

    -- Contacto
    contact_phone TEXT,
    website_url TEXT,

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

    -- Relaciones
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

    -- Contenido
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title TEXT NOT NULL,
    review_text TEXT NOT NULL,
    category TEXT NOT NULL,

    -- Metadata de origen (para reseñas importadas)
    source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'google', 'imported')),
    source_id TEXT, -- ID original en la plataforma de origen
    original_author_name TEXT, -- Nombre del autor original
    is_verified_purchase BOOLEAN DEFAULT FALSE,

    -- Respuesta del negocio (importada)
    original_response_text TEXT,
    original_response_date TIMESTAMPTZ,

    -- Estado
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    published_at TIMESTAMPTZ,

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
- [ ] Crear tablas de Stripe (`customers`, `products`, `prices`, `subscriptions`)
- [ ] Crear funciones y triggers
- [ ] Crear vistas útiles
- [ ] Verificar políticas RLS
- [ ] Verificar índices

---

**Última actualización:** Noviembre 2025
**Versión:** 1.0.0
