# 📚 Documentación de Opynio

Bienvenido a la documentación completa de Opynio - Plataforma de reseñas auténticas de empresas.

---

## 📖 Índice de Documentos

### 1. [Base de Datos - Configuración Completa](./01-DATABASE-SETUP.md)
**TODO el SQL necesario para crear la plataforma desde cero.**

- ✅ Tablas principales (profiles, businesses, reviews)
- ✅ Tablas de funcionalidades (claims, appeals, bugs)
- ✅ Tablas de Stripe (customers, subscriptions, products, prices)
- ✅ Políticas RLS completas
- ✅ Funciones y triggers
- ✅ Índices de rendimiento

**Cuándo usar**: Al configurar un nuevo proyecto desde cero o resetear la base de datos.

---

### 2. [Sistema de Scraping](./02-SCRAPING-SYSTEM.md)
**Sistema completo de importación desde Google Maps.**

- ✅ SQL de scraping (migraciones incluidas)
- ✅ Arquitectura del sistema
- ✅ Configuración de SerpAPI y Gemini
- ✅ Edge Functions explicadas
- ✅ Flujo completo optimizado
- ✅ Límites y troubleshooting

**Cuándo usar**: Para entender o modificar el sistema de importación de empresas y reseñas.

---

### 3. [Documentación General de la Plataforma](./03-PLATFORM-DOCUMENTATION.md)
**Guía completa de arquitectura, desarrollo y despliegue.**

- ✅ Visión general y arquitectura
- ✅ Stack tecnológico
- ✅ Estructura del proyecto
- ✅ Funcionalidades principales
- ✅ Sistema de roles y permisos
- ✅ Internacionalización (i18n)
- ✅ Guías de desarrollo
- ✅ Despliegue y producción

**Cuándo usar**: Para desarrolladores nuevos en el proyecto o para consultas generales.

---

### 4. [Integración de Stripe](./04-STRIPE-INTEGRATION.md)
**Plan detallado de integración de pagos con Stripe.**

- ✅ Modelo de datos de facturación
- ✅ Configuración de Stripe
- ✅ Edge Functions de pagos
- ✅ Implementación en frontend
- ✅ Webhook handling
- ✅ Checklist completo

**Cuándo usar**: Para implementar o modificar funcionalidades de pago y suscripciones.

---

### 5. [Fix de Admin Claims](./05-ADMIN-CLAIMS-FIX.md)
**Correcciones aplicadas a la página /admin/reclamaciones.**

- ✅ Corrección de tipos en `getAdminClaims`
- ✅ Datos faltantes en consultas SQL
- ✅ Error de foreign keys con múltiples relaciones
- ✅ Migración de tabla claims
- ✅ Políticas RLS

**Cuándo usar**: Para entender los problemas resueltos en el sistema de reclamaciones y cómo se solucionaron.

---

### 6. [Fix de Foreign Keys](./06-FOREIGN-KEYS-FIX.md)
**Solución definitiva para errores de relaciones en la tabla claims.**

- ✅ Problema de foreign keys apuntando a auth.users
- ✅ Solución con foreign keys a profiles
- ✅ Script SQL para corregir relaciones
- ✅ Verificación de tipos de datos

**Cuándo usar**: Si encuentras errores relacionados con "Could not find a relationship" en consultas de Supabase.

---

### 7. [Optimizaciones Críticas](./OPTIMIZACIONES-CRITICAS.md)
**Roadmap de optimizaciones de SEO y rendimiento.**

- ✅ Vite config optimizado
- ❌ Optimización de queries Supabase (pendiente)
- ❌ Sistema de caché (pendiente)
- ❌ Lazy loading de imágenes (pendiente)
- ❌ Meta tags dinámicos (pendiente)
- ❌ Pre-renderizado (pendiente)

**Cuándo usar**: Para planificar y ejecutar mejoras de rendimiento y SEO de la plataforma.

---

### 8. [Solución Rápida - Claims](./07-SOLUCION-RAPIDA-CLAIMS.md)
**Guía paso a paso para resolver error de foreign keys en claims.**

- ✅ Error específico: "more than one relationship was found"
- ✅ Script SQL listo para copiar y pegar
- ✅ Pasos numerados para Supabase Dashboard
- ✅ Verificación de resultados

**Cuándo usar**: Si encuentras el error específico de múltiples relaciones en la tabla claims y necesitas una solución rápida.

---

## 🗂️ Migraciones SQL

Todas las migraciones SQL están en: `../supabase/migrations/`

| Archivo | Descripción |
|---------|-------------|
| `create_review_votes_system.sql` | Sistema completo de votos para reseñas |
| `create_claims_table.sql` | Tabla de reclamaciones de negocios |
| `fix_claims_foreign_keys.sql` | Corrección de foreign keys en claims |
| `README_VOTES.md` | Documentación del sistema de votos |

**Orden de ejecución**:
1. Primero ejecutar todo el SQL de `01-DATABASE-SETUP.md`
2. Luego ejecutar las migraciones en este orden:
   - `create_review_votes_system.sql`
   - `create_claims_table.sql`
   - `fix_claims_foreign_keys.sql` (si aplica)

---

## 🚀 Inicio Rápido

### Para Desarrolladores Nuevos

1. **Leer primero**: [03-PLATFORM-DOCUMENTATION.md](./03-PLATFORM-DOCUMENTATION.md)
   - Entender la arquitectura
   - Conocer el stack tecnológico
   - Configurar entorno local

2. **Configurar Base de Datos**: [01-DATABASE-SETUP.md](./01-DATABASE-SETUP.md)
   - Crear proyecto en Supabase
   - Ejecutar scripts SQL
   - Verificar RLS

3. **Entender Scraping** (si necesario): [02-SCRAPING-SYSTEM.md](./02-SCRAPING-SYSTEM.md)
   - Configurar SerpAPI
   - Desplegar Edge Functions
   - Probar importación

4. **Configurar Stripe** (si necesario): [04-STRIPE-INTEGRATION.md](./04-STRIPE-INTEGRATION.md)
   - Crear cuenta Stripe
   - Configurar productos
   - Implementar checkout

---

## 🎯 Casos de Uso Comunes

### "Quiero configurar el proyecto desde cero"
1. [03-PLATFORM-DOCUMENTATION.md](./03-PLATFORM-DOCUMENTATION.md) → Sección "Configuración Local"
2. [01-DATABASE-SETUP.md](./01-DATABASE-SETUP.md) → Ejecutar todo el SQL
3. Configurar variables de entorno
4. `npm install && npm run dev`

### "El scraping no funciona"
1. [02-SCRAPING-SYSTEM.md](./02-SCRAPING-SYSTEM.md) → Sección "Troubleshooting"
2. Verificar Secrets de Supabase (SERPAPI_KEY)
3. Revisar logs de Edge Functions

### "Necesito agregar una nueva tabla"
1. [01-DATABASE-SETUP.md](./01-DATABASE-SETUP.md) → Ver ejemplos de tablas
2. Crear migración en `supabase/migrations/`
3. Agregar políticas RLS
4. Actualizar documentación

### "Quiero modificar los planes de pago"
1. [04-STRIPE-INTEGRATION.md](./04-STRIPE-INTEGRATION.md)
2. Actualizar productos en Stripe Dashboard
3. Actualizar constantes en código
4. Probar checkout

---

## 📝 Convenciones de Documentación

### Formato de Código SQL
```sql
-- Comentario descriptivo
CREATE TABLE IF NOT EXISTS table_name (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ...
);
```

### Formato de Código TypeScript
```typescript
// Comentario descriptivo
function myFunction(): ReturnType {
    // Implementación
}
```

### Iconos Usados
- ✅ Completado / Implementado
- ❌ No implementado / No soportado
- 🚀 Característica destacada
- ⚠️ Advertencia importante
- 💡 Tip / Sugerencia
- 🔧 Configuración requerida

---

## 🔄 Actualización de Documentación

**Al agregar nuevas funcionalidades**:
1. Actualizar el documento correspondiente
2. Agregar migraciones SQL si aplica
3. Actualizar este README si es necesario
4. Incrementar versión en el footer del documento

**Al encontrar errores**:
1. Crear issue en GitHub
2. Documentar el bug en `02-SCRAPING-SYSTEM.md` (sección Troubleshooting) si aplica
3. Actualizar documentación una vez resuelto

---

## 📧 Contacto y Soporte

- **Issues**: GitHub Issues del repositorio
- **Documentación**: Esta carpeta `/docs`
- **Código**: Ver `/src` para implementación

---

**Última actualización**: Noviembre 2025
**Versión de documentación**: 1.0.0
