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
