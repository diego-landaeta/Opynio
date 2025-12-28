# Guía de Instalación Completa - Prerender SEO

## Pre-requisitos

Antes de comenzar, asegúrate de tener:
- Acceso SSH al servidor como root
- El servidor debe tener Ubuntu 20.04+ o Debian 10+

---

## Paso 1: Instalar Dependencias del Sistema

```bash
# Actualizar sistema
sudo apt-get update

# Instalar dependencias de Chrome/Puppeteer
sudo apt-get install -y \
  gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 \
  libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 \
  libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 \
  libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 \
  libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 \
  libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation \
  libnss3 lsb-release xdg-utils wget libgbm1
```

---

## Paso 2: Instalar Google Chrome

```bash
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
sudo apt-get update
sudo apt-get install -y google-chrome-stable

# Verificar instalación
google-chrome-stable --version
```

---

## Paso 3: Crear el Servidor de Prerender

```bash
# Crear directorio
mkdir -p /opt/prerender-simple
cd /opt/prerender-simple

# Inicializar proyecto Node
npm init -y
npm install puppeteer-core express
```

### Crear archivo server.js

```bash
cat > /opt/prerender-simple/server.js << 'EOF'
const express = require('express');
const puppeteer = require('puppeteer-core');

const app = express();
const PORT = 3001;

let browser;

async function getBrowser() {
    if (!browser) {
        browser = await puppeteer.launch({
            executablePath: '/usr/bin/google-chrome-stable',
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote'
            ]
        });
    }
    return browser;
}

app.get('/render', async (req, res) => {
    const url = req.query.url;
    if (!url) {
        return res.status(400).send('Missing url parameter');
    }

    try {
        const browser = await getBrowser();
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
        const html = await page.content();
        await page.close();
        res.send(html);
    } catch (error) {
        console.error('Error rendering:', error.message);
        res.status(500).send('Error rendering page');
    }
});

app.listen(PORT, () => {
    console.log(`Prerender server running on port ${PORT}`);
});
EOF
```

---

## Paso 4: Crear Servicio Systemd

```bash
cat > /etc/systemd/system/prerender.service << 'EOF'
[Unit]
Description=Prerender Service for SEO
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/prerender-simple
ExecStart=/usr/bin/node /opt/prerender-simple/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Habilitar e iniciar servicio
systemctl daemon-reload
systemctl enable prerender
systemctl start prerender

# Verificar estado
systemctl status prerender
```

---

## Paso 5: Probar el Prerender

```bash
# Esperar 5 segundos a que inicie
sleep 5

# Probar localmente
curl "http://localhost:3001/render?url=https://web.opynio.com/es" | head -50

# Debería mostrar HTML completo
```

---

## Paso 6: Configurar Nginx

### Hacer backup de la configuración actual
```bash
cp /etc/nginx/sites-available/web.opynio.com /etc/nginx/sites-available/web.opynio.com.backup.$(date +%Y%m%d)
```

### Reemplazar la configuración completa

```bash
cat > /etc/nginx/sites-available/web.opynio.com << 'EOF'
# HTTP → HTTPS REDIRECT
server {
    if ($host = web.opynio.com) {
        return 301 https://$host$request_uri;
    } # managed by Certbot


    listen 80;
    listen [::]:80;
    server_name web.opynio.com;
    return 301 https://$server_name$request_uri;


}

# HTTPS PRINCIPAL
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name web.opynio.com;

    # SSL - COMENTA ESTAS LÍNEAS PRIMERO, CERTBOT LAS DESCOMENTAR
    ssl_certificate /etc/letsencrypt/live/web.opynio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/web.opynio.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    root /var/www/web.opynio.com/public/dist;
    index index.html;

    # SITEMAP PROXY
    location = /sitemap.xml {
        proxy_pass https://hvtrrhxeqrsnjxhngdsj.supabase.co/functions/v1/generate-sitemap;
        proxy_ssl_server_name on;
        proxy_set_header Host hvtrrhxeqrsnjxhngdsj.supabase.co;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        proxy_pass_header Content-Type;
        proxy_pass_header Cache-Control;
    }

    # 404 PARA URLs LEGACY
    location ~ ^/(empresa|business|entreprise|negocio|company)/ {
        return 404;
    }

    # WIDGET EXTERNO - Opynio
    location = /widget.js {
        add_header Content-Type "application/javascript" always;
        add_header Access-Control-Allow-Origin "*" always;
        add_header Cache-Control "public, max-age=31536000";
        try_files $uri =404;
    }

    # ARCHIVOS ESTÁTICOS
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webp)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # 404 HTTP STATUS REAL
    error_page 404 /404.html;
    location = /404.html {
        internal;
    }
    location = /404 {
        return 404;
    }

    # ============================================
    # SPA ROUTING CON PRERENDER PARA SEO
    # ⚠️ NO MODIFICAR ESTA SECCIÓN
    # ============================================
    location / {
        # Detectar bots de búsqueda
        set $prerender 0;

        if ($http_user_agent ~* "googlebot|bingbot|yandex|baiduspider|twitterbot|facebookexternalhit|rogerbot|linkedinbot|embedly|quora link preview|showyoubot|outbrain|pinterest|slackbot|vkShare|W3C_Validator|whatsapp|Applebot|DuckDuckBot") {
            set $prerender 1;
        }

        # No prerenderizar archivos estáticos
        if ($uri ~* "\.(js|css|xml|less|png|jpg|jpeg|gif|pdf|txt|ico|rss|zip|mp3|rar|exe|wmv|avi|ppt|mpg|mpeg|tif|wav|mov|psd|ai|xls|mp4|m4a|swf|dat|dmg|iso|flv|m4v|torrent|ttf|woff|woff2|svg|eot|webp|webm|json)$") {
            set $prerender 0;
        }

        # Si es bot, enviar a prerender
        if ($prerender = 1) {
            rewrite .* /render?url=https://$host$request_uri break;
            proxy_pass http://127.0.0.1:3001;
        }

        # Para usuarios normales, SPA
        try_files $uri $uri/ /index.html;
    }
    # ============================================

    access_log /var/log/nginx/web.opynio.com.access.log;
    error_log /var/log/nginx/web.opynio.com.error.log;

    ssl_certificate /etc/letsencrypt/live/web.opynio.com/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/web.opynio.com/privkey.pem; # managed by Certbot
}
EOF
```

### Verificar y recargar Nginx
```bash
nginx -t && systemctl reload nginx
```

---

## Paso 7: Prueba Final

```bash
# Como Googlebot (debería mostrar contenido dinámico)
curl -A "Googlebot" "https://web.opynio.com/es/empresa/Tarot_IA" 2>/dev/null | grep "<title>"
# Resultado esperado: <title>Opiniones Tarot IA 2025 - 4.8★ de 132 Reseñas | Opynio</title>

# Como usuario normal (debería mostrar título genérico)
curl "https://web.opynio.com/es/empresa/Tarot_IA" 2>/dev/null | grep "<title>"
# Resultado esperado: <title>Opynio: Reseñas Auténticas de Empresas</title>
```

---

## Comandos Útiles

```bash
# Ver estado del servicio
systemctl status prerender

# Reiniciar el servicio
systemctl restart prerender

# Ver logs en tiempo real
journalctl -u prerender -f

# Matar procesos huérfanos
pkill -f chrome && pkill -f node && systemctl restart prerender
```

---

## Restaurar Backup

Si algo sale mal, restaura el backup de Nginx:

```bash
# Listar backups disponibles
ls -la /etc/nginx/sites-available/web.opynio.com.backup.*

# Restaurar (cambiar la fecha según corresponda)
cp /etc/nginx/sites-available/web.opynio.com.backup.YYYYMMDD /etc/nginx/sites-available/web.opynio.com
nginx -t && systemctl reload nginx

# Detener prerender si es necesario
systemctl stop prerender
systemctl disable prerender
```
