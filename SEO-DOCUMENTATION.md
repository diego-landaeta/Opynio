# Documentación SEO - Opynio

## Resumen del Sistema SEO

El sitio web.opynio.com utiliza un sistema de SEO completo que incluye:

1. **Meta tags dinámicos** (componente React)
2. **Prerender para bots** (servicio en servidor VPS)
3. **Sitemap dinámico** (Supabase Edge Function)
4. **Schema.org markup** (datos estructurados)

---

## 1. Meta Tags Dinámicos

### Archivo: `components/Meta.tsx`

Este componente maneja todos los meta tags de SEO de forma dinámica:

```tsx
<Meta
  title="Título de la página"
  description="Descripción para Google"
  lang="es"
  ogImage="https://..."
  noindex={false}
  isPremium={false}
/>
```

### Funcionalidades:
- **Title y Description**: Actualizados dinámicamente por página
- **Open Graph**: Para compartir en redes sociales
- **Twitter Cards**: Preview en Twitter/X
- **Canonical URL**: Evita contenido duplicado
- **Hreflang**: SEO internacional (15 países/idiomas)
- **Robots**: Control de indexación

### Importante - Hreflang:
- Para páginas de empresa individual: **NO genera hreflang múltiples**
- Razón: Las empresas solo existen en UN país, generar hreflang a otros países causa 404s
- Para páginas estáticas: Genera hreflang para todos los idiomas

---

## 2. Prerender para Bots de Búsqueda

### Problema que resuelve:
Google y otros bots no ejecutan JavaScript correctamente. En una SPA (Single Page Application), ven solo el loader inicial, no el contenido.

### Solución implementada:
Un servidor Puppeteer en el VPS que renderiza las páginas para los bots.

### Ubicación en servidor:
```
/opt/prerender-simple/server.js    # Servidor de prerender
/etc/systemd/system/prerender.service  # Servicio systemd
/etc/nginx/sites-available/web.opynio.com  # Configuración Nginx
```

### Cómo funciona:
1. Usuario normal visita → Recibe SPA (React)
2. Googlebot visita → Nginx detecta el User-Agent → Envía a prerender → Recibe HTML completo

### Comandos útiles:
```bash
# Ver estado del servicio
systemctl status prerender

# Reiniciar servicio
systemctl restart prerender

# Ver logs
journalctl -u prerender -f

# Probar como Googlebot
curl -A "Googlebot" "https://web.opynio.com/es/empresa/Tarot_IA" | grep "<title>"
```

### Bots detectados:
- googlebot, bingbot, yandex, baiduspider
- twitterbot, facebookexternalhit, linkedinbot
- whatsapp, Applebot, DuckDuckBot
- Y más...

---

## 3. Sitemap Dinámico

### URL: `https://web.opynio.com/sitemap.xml`

### Implementación:
- **Supabase Edge Function**: `generate-sitemap`
- **Nginx proxy**: Redirige /sitemap.xml a Supabase

### Contenido:
- Todas las empresas activas de la base de datos
- URLs con formato: `/{lang}/empresa/{slug}`
- Actualizado dinámicamente

---

## 4. Archivos NO Modificar

| Archivo | Razón |
|---------|-------|
| `components/Meta.tsx` | Gestiona todos los meta tags SEO |
| `robots.txt` | Configuración para crawlers |
| Nginx `location /` | Sección de prerender para bots |

---

## 5. Estructura de URLs

### Formato:
```
https://web.opynio.com/{idioma}/empresa/{slug}
```

### Idiomas soportados:
- `es` - España
- `mx` - México
- `ar` - Argentina
- `co` - Colombia
- `cl` - Chile
- `pe` - Perú
- `br` - Brasil
- `pt` - Portugal
- `us` - Estados Unidos
- `en` - Inglés (UK)
- `fr` - Francia
- `de` - Alemania
- `it` - Italia
- Y más...

---

## 6. Google Search Console

### Problemas comunes y soluciones:

| Problema | Causa | Solución |
|----------|-------|----------|
| "Descubiertas, no indexadas" | Google no ve contenido | Prerender resuelve esto |
| "Rastreadas, no indexadas" | Contenido thin/duplicado | Mejorar contenido único |
| "Soft 404" | Página existe pero sin contenido | Prerender resuelve esto |
| "404" | URL eliminada o incorrecta | Limpiar sitemap |

### Después de implementar prerender:
1. Esperar 1-2 semanas para re-rastreo
2. Usar "Inspeccionar URL" en GSC
3. Solicitar indexación de páginas importantes

---

## 7. Verificar que el SEO funciona

### Test de prerender:
```bash
# Como Googlebot (debe mostrar título dinámico)
curl -A "Googlebot" "https://web.opynio.com/es/empresa/Tarot_IA" 2>/dev/null | grep "<title>"
# Resultado: <title>Opiniones Tarot IA 2025 - 4.8★ de 132 Reseñas | Opynio</title>

# Como usuario normal (muestra título genérico)
curl "https://web.opynio.com/es/empresa/Tarot_IA" 2>/dev/null | grep "<title>"
# Resultado: <title>Opynio: Reseñas Auténticas de Empresas</title>
```

### Test de meta tags:
Usar herramientas como:
- Google Rich Results Test
- Facebook Sharing Debugger
- Twitter Card Validator

---

## 8. Mantenimiento

### Mensual:
- Revisar Google Search Console
- Verificar que prerender sigue funcionando
- Revisar errores 404 en sitemap

### Si hay problemas:
```bash
# Reiniciar prerender
pkill -f chrome && pkill -f node && systemctl restart prerender

# Ver logs de errores
journalctl -u prerender -n 100

# Verificar Nginx
nginx -t && systemctl reload nginx
```

---

## 9. Recursos del Servidor

### Requisitos mínimos:
- RAM: 2GB libres (Chrome usa ~512MB)
- CPU: Bajo impacto
- Disco: 500MB

### Servidor actual:
- IP: 72.60.90.135
- OS: Ubuntu
- Node: v20.19.6
- App: /var/www/web.opynio.com/public/dist

---

## Contacto

- **Implementado**: 25 de Diciembre de 2025
- **Versión**: 1.0
