# Paquete de Configuración Prerender SEO para Opynio

## Descripción

Este paquete contiene todos los archivos necesarios para configurar el sistema de pre-rendering en el servidor VPS de Opynio. El sistema mejora el SEO permitiendo que los bots de búsqueda (Google, Bing, etc.) reciban HTML completamente renderizado.

---

## Contenido del paquete

```
prerender-seo-package/
├── README.md                    # Este archivo
├── INSTALACION.md               # Guía paso a paso de instalación
├── server/
│   ├── server.js                # Servidor de prerender (copiar a /opt/prerender-simple/)
│   └── package.json             # Dependencias del servidor
├── systemd/
│   └── prerender.service        # Servicio systemd (copiar a /etc/systemd/system/)
├── nginx/
│   └── web.opynio.com           # Configuración de Nginx completa
└── scripts/
    ├── install.sh               # Script de instalación automática
    └── test.sh                  # Script de pruebas
```

---

## Requisitos del Servidor

- **OS**: Ubuntu 20.04+ / Debian 10+
- **Node.js**: v18 o superior
- **RAM**: Mínimo 2GB libres (Chrome headless usa ~512MB)
- **Disco**: 500MB libres
- **Nginx**: Instalado y funcionando

---

## Instalación Rápida

```bash
# 1. Subir este paquete al servidor
scp -r prerender-seo-package root@72.60.90.135:/tmp/

# 2. Conectar al servidor
ssh root@72.60.90.135

# 3. Ejecutar script de instalación
cd /tmp/prerender-seo-package
chmod +x scripts/install.sh
./scripts/install.sh
```

---

## Instalación Manual

Ver archivo `INSTALACION.md` para instrucciones detalladas paso a paso.

---

## Verificar que funciona

```bash
# Ver estado del servicio
systemctl status prerender

# Probar como Googlebot
curl -A "Googlebot" "https://web.opynio.com/es/empresa/Tarot_IA" 2>/dev/null | grep "<title>"

# Debería mostrar algo como:
# <title>Opiniones Tarot IA 2025 - 4.8★ de 132 Reseñas | Opynio</title>
```

---

## Archivos Críticos - NO MODIFICAR

| Archivo | Ubicación en servidor | Notas |
|---------|----------------------|-------|
| server.js | /opt/prerender-simple/server.js | Servidor de prerender |
| prerender.service | /etc/systemd/system/prerender.service | Servicio systemd |
| web.opynio.com | /etc/nginx/sites-available/web.opynio.com | **Solo la sección `location /`** |

---

## Solución de Problemas

### El servicio no inicia
```bash
journalctl -u prerender -n 50
pkill -f chrome && pkill -f node
systemctl restart prerender
```

### Error 502 en Nginx
```bash
systemctl status prerender
netstat -tlnp | grep 3001
systemctl restart prerender
```

---

## Contacto

- **Implementado por**: Claude Code
- **Fecha**: 25 de Diciembre de 2025
- **Versión**: 1.0
