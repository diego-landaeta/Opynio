# 📚 Opynio - Documentación General de la Plataforma

Documentación completa de arquitectura, funcionalidades y guías de desarrollo para Opynio.

---

## 📋 Tabla de Contenidos

1. [Visión General](#visión-general)
2. [Arquitectura](#arquitectura)
3. [Stack Tecnológico](#stack-tecnológico)
4. [Estructura del Proyecto](#estructura-del-proyecto)
5. [Funcionalidades Principales](#funcionalidades-principales)
6. [Planes y Facturación (Stripe)](#planes-y-facturación-stripe)
7. [Sistema de Roles y Permisos](#sistema-de-roles-y-permisos)
8. [Internacionalización (i18n)](#internacionalización-i18n)
9. [Despliegue](#despliegue)
10. [Guías de Desarrollo](#guías-de-desarrollo)

---

## 🎯 Visión General

**Opynio** es una plataforma de reseñas auténticas de empresas que permite:

- ✅ **Usuarios**: Escribir y leer reseñas verificadas de negocios
- ✅ **Negocios**: Reclamar y gestionar su perfil
- ✅ **Administradores**: Moderar contenido e importar datos desde Google Maps
- ✅ **Planes Premium**: Funcionalidades avanzadas para negocios (Stripe)

### Diferenciadores Clave

1. **Reseñas Auténticas**: Sistema de verificación y moderación
2. **Importación Masiva**: Scraping automatizado desde Google Maps
3. **Multi-idioma**: Soporte para español, portugués e inglés
4. **Geolocalización**: Búsqueda por país y ubicación
5. **Planes de Pago**: Integración completa con Stripe

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────┐
│           Frontend (React + Vite)           │
│  - TypeScript                               │
│  - React Router                             │
│  - Tailwind CSS                             │
└──────────────┬──────────────────────────────┘
               │
               │ API Calls
               ↓
┌─────────────────────────────────────────────┐
│        Supabase (Backend as a Service)      │
│  ┌─────────────────────────────────────┐   │
│  │ PostgreSQL Database                 │   │
│  │ - Row Level Security (RLS)          │   │
│  │ - Realtime Subscriptions            │   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │ Authentication                      │   │
│  │ - Email/Password                    │   │
│  │ - OAuth (Google, GitHub)            │   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │ Edge Functions (Deno)               │   │
│  │ - instant-full-scrape               │   │
│  │ - stripe-webhook                    │   │
│  │ - create-checkout-session           │   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │ Storage                             │   │
│  │ - Logos                             │   │
│  │ - Avatares                          │   │
│  │ - Documentación                     │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
               │
               │ External APIs
               ↓
┌─────────────────┬──────────────────┬─────────┐
│   SerpAPI       │   Gemini AI      │ Stripe  │
│ (Google Maps)   │ (Categorización) │ (Pagos) │
└─────────────────┴──────────────────┴─────────┘
```

---

## 🛠️ Stack Tecnológico

### Frontend
- **React 18** - Biblioteca UI
- **TypeScript** - Tipado estático
- **Vite** - Build tool ultrarrápido
- **React Router 6** - Navegación
- **Tailwind CSS** - Estilos utility-first
- **Leaflet** - Mapas interactivos
- **Recharts** - Gráficos y estadísticas

### Backend
- **Supabase** - Backend as a Service
- **PostgreSQL 15** - Base de datos
- **Deno** - Runtime para Edge Functions
- **Row Level Security** - Seguridad a nivel de fila

### APIs Externas
- **SerpAPI** - Scraping de Google Maps
- **Gemini AI** - IA para categorización (opcional)
- **Stripe** - Procesamiento de pagos

### DevOps
- **Git + GitHub** - Control de versiones
- **Netlify / Cloudflare Pages** - Hosting frontend
- **Supabase Cloud** - Hosting backend

---

## 📁 Estructura del Proyecto

```
opynio/
├── docs/                           # 📚 Documentación
│   ├── 01-DATABASE-SETUP.md       # SQL de base de datos
│   ├── 02-SCRAPING-SYSTEM.md      # Sistema de scraping
│   └── 03-PLATFORM-DOCUMENTATION.md # Este archivo
│
├── src/                            # Código fuente
│   ├── components/                 # Componentes React
│   │   ├── pages/                  # Páginas completas
│   │   │   ├── admin/              # Panel de administración
│   │   │   ├── auth/               # Login, registro
│   │   │   └── user/               # Dashboard de usuario
│   │   ├── business/               # Componentes de negocios
│   │   ├── review/                 # Componentes de reseñas
│   │   └── layout/                 # Layout, header, footer
│   │
│   ├── contexts/                   # Context API
│   │   ├── AuthContext.tsx         # Autenticación
│   │   ├── i18nContext.tsx         # Internacionalización
│   │   └── NotificationContext.tsx # Notificaciones
│   │
│   ├── services/                   # Lógica de negocio
│   │   └── supabaseService.ts      # Cliente de Supabase
│   │
│   ├── types/                      # Tipos TypeScript
│   │   └── index.ts                # Interfaces y tipos
│   │
│   ├── constants/                  # Constantes
│   │   └── index.ts                # Categorías, países
│   │
│   └── translations/               # Traducciones i18n
│       ├── es.json                 # Español
│       ├── pt.json                 # Portugués
│       └── en.json                 # Inglés
│
├── supabase/                       # Backend Supabase
│   ├── functions/                  # Edge Functions
│   │   └── instant-full-scrape/    # Función de scraping
│   │       └── index.ts
│   │
│   └── migrations/                 # Migraciones SQL
│       ├── create_review_votes_system.sql
│       ├── create_claims_table.sql
│       └── fix_claims_foreign_keys.sql
│
├── public/                         # Archivos estáticos
├── .env.local                      # Variables de entorno (local)
├── package.json                    # Dependencies
├── tsconfig.json                   # Config TypeScript
├── tailwind.config.js              # Config Tailwind
└── vite.config.ts                  # Config Vite
```

---

## ⚙️ Funcionalidades Principales

### 1. Sistema de Autenticación

**Métodos Disponibles**:
- Email/Password
- Google OAuth
- GitHub OAuth

**Roles**:
- `user`: Usuario estándar
- `admin`: Administrador con permisos completos

### 2. Gestión de Negocios

**Usuarios pueden**:
- Buscar negocios por país, categoría, nombre
- Ver detalles completos del negocio
- Ver ubicación en mapa interactivo
- Reclamar propiedad de un negocio

**Propietarios pueden**:
- Editar información del negocio
- Responder a reseñas
- Ver estadísticas
- Subir logo

### 3. Sistema de Reseñas

**Características**:
- Rating de 1-5 estrellas
- Título y texto descriptivo
- Categorización automática
- Estados: `pending`, `approved`, `rejected`
- Apelaciones de reseñas rechazadas

**Moderación**:
- Revisión manual por administradores
- Filtros anti-spam
- Sistema de reportes

### 4. Panel de Administración

**Funcionalidades**:
- Moderar reseñas
- Gestionar reclamaciones de negocios
- Importar desde Google Maps (scraping)
- Ver estadísticas globales
- Gestionar usuarios
- Gestionar empresas destacadas
- Ver reportes de bugs

### 5. Scraping de Google Maps

Ver documento: [02-SCRAPING-SYSTEM.md](./02-SCRAPING-SYSTEM.md)

**Características**:
- Importación masiva de empresas
- Extracción de reseñas
- Progreso en tiempo real
- Filtrado de duplicados
- Límites inteligentes

---

## 💳 Planes y Facturación (Stripe)

Ver documento completo: [stripe_integration.md](../stripe_integration.md)

### Planes Disponibles

| Plan | Precio/mes | Características |
|------|------------|-----------------|
| **Free** | Gratis | - 1 negocio<br>- Respuestas básicas<br>- Estadísticas limitadas |
| **Starter** | €9.99 | - 3 negocios<br>- Respuestas ilimitadas<br>- Estadísticas completas |
| **Growth** | €29.99 | - 10 negocios<br>- Análisis avanzados<br>- Soporte prioritario |
| **Pro** | €99.99 | - Negocios ilimitados<br>- API access<br>- Whitelabel |

### Integración Stripe

**Edge Functions**:
1. `create-checkout-session` - Inicia proceso de pago
2. `create-portal-session` - Portal de gestión de suscripción
3. `stripe-webhook` - Manejo de eventos de Stripe

**Eventos Manejados**:
- `checkout.session.completed` - Suscripción creada
- `invoice.paid` - Pago procesado
- `customer.subscription.updated` - Plan cambiado
- `customer.subscription.deleted` - Cancelación

---

## 🔐 Sistema de Roles y Permisos

### Row Level Security (RLS)

Todas las tablas tienen políticas RLS para seguridad a nivel de fila.

**Ejemplo: Tabla `businesses`**:
```sql
-- Cualquiera puede ver negocios
CREATE POLICY "Anyone can view businesses"
    ON businesses FOR SELECT
    USING (true);

-- Solo propietarios pueden editar
CREATE POLICY "Owners can manage their businesses"
    ON businesses FOR ALL
    USING (auth.uid() = owner_id);

-- Admins pueden todo
CREATE POLICY "Admins can manage all businesses"
    ON businesses FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
```

### Permisos por Rol

| Acción | User | Owner | Admin |
|--------|------|-------|-------|
| Ver negocios | ✅ | ✅ | ✅ |
| Escribir reseñas | ✅ | ✅ | ✅ |
| Reclamar negocio | ✅ | ✅ | ✅ |
| Editar negocio | ❌ | ✅ (propio) | ✅ (todos) |
| Moderar reseñas | ❌ | ❌ | ✅ |
| Scraping | ❌ | ❌ | ✅ |
| Gestionar usuarios | ❌ | ❌ | ✅ |

---

## 🌍 Internacionalización (i18n)

### Idiomas Soportados

- 🇪🇸 **Español (es)** - Por defecto
- 🇧🇷 **Portugués (pt)** - Brasil
- 🇬🇧 **Inglés (en)** - Internacional

### Uso en Componentes

```typescript
import { useTranslation } from '../contexts/i18nContext';

function MyComponent() {
  const t = useTranslation();

  return (
    <div>
      <h1>{t('homePage.title')}</h1>
      <p>{t('homePage.subtitle')}</p>
    </div>
  );
}
```

### Estructura de Traducciones

```json
{
  "homePage": {
    "title": "Bienvenido a Opynio",
    "subtitle": "Reseñas auténticas de empresas"
  },
  "common": {
    "search": "Buscar",
    "save": "Guardar",
    "cancel": "Cancelar"
  }
}
```

---

## 🚀 Despliegue

### Frontend (Netlify / Cloudflare Pages)

1. **Conectar Repositorio**:
   - En Netlify: New site from Git → escoge el repo → build command `npm run build`, publish directory `dist`
   - En Cloudflare Pages: Create a project → Connect to Git → mismas opciones

2. **Variables de Entorno**:
   ```bash
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
   ```

### Backend (Supabase)

1. **Crear Proyecto** en https://supabase.com

2. **Ejecutar Migraciones**:
   ```bash
   # Desde el SQL Editor de Supabase
   # Copiar y pegar los scripts de docs/01-DATABASE-SETUP.md
   ```

3. **Desplegar Edge Functions**:
   ```bash
   supabase functions deploy instant-full-scrape
   supabase functions deploy stripe-webhook
   ```

4. **Configurar Secrets**:
   ```bash
   supabase secrets set SERPAPI_KEY=your-key
   supabase secrets set GEMINI_API_KEY=your-key
   supabase secrets set STRIPE_SECRET_KEY=sk_live_...
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
   ```

---

## 🧑‍💻 Guías de Desarrollo

### Configuración Local

1. **Clonar Repositorio**:
   ```bash
   git clone https://github.com/tu-usuario/opynio.git
   cd opynio
   ```

2. **Instalar Dependencias**:
   ```bash
   npm install
   ```

3. **Configurar Variables de Entorno**:
   ```bash
   cp .env.example .env.local
   # Editar .env.local con tus credenciales
   ```

4. **Iniciar Desarrollo**:
   ```bash
   npm run dev
   ```

### Crear Nueva Página

1. **Crear Componente**:
   ```typescript
   // src/components/pages/MyPage.tsx
   import React from 'react';
   import Meta from '../Meta';

   const MyPage: React.FC = () => {
     return (
       <>
         <Meta title="Mi Página - Opynio" />
         <div className="container mx-auto px-4 py-8">
           <h1>Mi Nueva Página</h1>
         </div>
       </>
     );
   };

   export default MyPage;
   ```

2. **Agregar Ruta**:
   ```typescript
   // src/App.tsx
   import MyPage from './components/pages/MyPage';

   <Route path="/mi-pagina" element={<MyPage />} />
   ```

### Agregar Nueva Traducción

1. **Actualizar Archivos**:
   ```json
   // src/translations/es.json
   {
     "myPage": {
       "title": "Mi Página",
       "description": "Descripción en español"
     }
   }
   ```

2. **Usar en Componente**:
   ```typescript
   const t = useTranslation();
   <h1>{t('myPage.title')}</h1>
   ```

### Crear Edge Function

1. **Crear Archivo**:
   ```bash
   mkdir -p supabase/functions/my-function
   touch supabase/functions/my-function/index.ts
   ```

2. **Implementar Lógica**:
   ```typescript
   import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
   import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

   serve(async (req) => {
     // Tu lógica aquí
     return new Response(JSON.stringify({ ok: true }), {
       headers: { 'Content-Type': 'application/json' }
     })
   })
   ```

3. **Desplegar**:
   ```bash
   supabase functions deploy my-function
   ```

---

## 📊 Métricas y Análisis

### Estadísticas Disponibles

**Para Negocios**:
- Total de reseñas
- Rating promedio
- Tendencias de rating
- Respuestas pendientes

**Para Administradores**:
- Usuarios totales
- Negocios totales
- Reseñas pendientes de moderación
- Ingresos mensuales (Stripe)

---

## 🐛 Debugging y Logs

### Frontend

```typescript
// Habilitar logs detallados
if (import.meta.env.DEV) {
  console.log('[DEBUG]', data);
}
```

### Edge Functions

```typescript
// Logs aparecen en Supabase Dashboard > Edge Functions > Logs
console.log('🔍 Query extraída:', searchQuery);
console.error('❌ Error:', error.message);
```

### Base de Datos

```sql
-- Ver logs de cambios
SELECT * FROM scraping_sessions
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

---

## 🔗 Enlaces Útiles

- **Repositorio**: https://github.com/tu-usuario/opynio
- **Supabase Dashboard**: https://app.supabase.com
- **SerpAPI Docs**: https://serpapi.com/google-maps-api
- **Stripe Docs**: https://stripe.com/docs
- **Gemini AI**: https://ai.google.dev

---

## ✅ Checklist de Producción

### Base de Datos
- [ ] Todas las tablas creadas
- [ ] Políticas RLS verificadas
- [ ] Índices optimizados
- [ ] Migraciones documentadas

### Edge Functions
- [ ] Funciones desplegadas
- [ ] Secrets configurados
- [ ] Webhooks configurados
- [ ] Logs monitoreados

### Frontend
- [ ] Build sin errores
- [ ] Variables de entorno configuradas
- [ ] SEO optimizado
- [ ] Performance auditado

### Seguridad
- [ ] HTTPS habilitado
- [ ] CORS configurado
- [ ] Rate limiting implementado
- [ ] Validación de inputs

---

**Última actualización:** Noviembre 2025
**Versión:** 1.0.0
**Mantenedores:** Equipo Opynio
