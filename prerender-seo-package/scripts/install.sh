#!/bin/bash

# ============================================
# Script de Instalación Automática - Prerender SEO
# Para Opynio (web.opynio.com)
# ============================================

set -e  # Salir si hay error

echo "=========================================="
echo "  Instalación de Prerender SEO para Opynio"
echo "=========================================="
echo ""

# Verificar que somos root
if [ "$EUID" -ne 0 ]; then
    echo "ERROR: Este script debe ejecutarse como root"
    echo "Usa: sudo ./install.sh"
    exit 1
fi

# Verificar que estamos en el directorio correcto
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"

if [ ! -f "$PACKAGE_DIR/server/server.js" ]; then
    echo "ERROR: No se encuentra server/server.js"
    echo "Asegúrate de ejecutar este script desde el directorio del paquete"
    exit 1
fi

echo "1/7 - Actualizando sistema..."
apt-get update -qq

echo "2/7 - Instalando dependencias de Chrome..."
apt-get install -y -qq \
    gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 \
    libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 \
    libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 \
    libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 \
    libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 \
    libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation \
    libnss3 lsb-release xdg-utils wget libgbm1 > /dev/null 2>&1

echo "3/7 - Instalando Google Chrome..."
if ! command -v google-chrome-stable &> /dev/null; then
    wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - > /dev/null 2>&1
    echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list
    apt-get update -qq
    apt-get install -y -qq google-chrome-stable > /dev/null 2>&1
    echo "   Chrome instalado: $(google-chrome-stable --version)"
else
    echo "   Chrome ya está instalado: $(google-chrome-stable --version)"
fi

echo "4/7 - Configurando servidor de prerender..."
mkdir -p /opt/prerender-simple
cp "$PACKAGE_DIR/server/server.js" /opt/prerender-simple/
cp "$PACKAGE_DIR/server/package.json" /opt/prerender-simple/
cd /opt/prerender-simple
npm install --silent > /dev/null 2>&1
echo "   Servidor configurado en /opt/prerender-simple"

echo "5/7 - Configurando servicio systemd..."
cp "$PACKAGE_DIR/systemd/prerender.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable prerender > /dev/null 2>&1
systemctl start prerender
echo "   Servicio prerender habilitado e iniciado"

echo "6/7 - Configurando Nginx..."
# Hacer backup de la configuración actual
if [ -f /etc/nginx/sites-available/web.opynio.com ]; then
    BACKUP_NAME="/etc/nginx/sites-available/web.opynio.com.backup.$(date +%Y%m%d_%H%M%S)"
    cp /etc/nginx/sites-available/web.opynio.com "$BACKUP_NAME"
    echo "   Backup creado: $BACKUP_NAME"
fi

cp "$PACKAGE_DIR/nginx/web.opynio.com" /etc/nginx/sites-available/
nginx -t > /dev/null 2>&1
systemctl reload nginx
echo "   Nginx configurado y recargado"

echo "7/7 - Verificando instalación..."
sleep 3

# Verificar que el servicio está corriendo
if systemctl is-active --quiet prerender; then
    echo "   ✓ Servicio prerender: ACTIVO"
else
    echo "   ✗ Servicio prerender: ERROR"
    systemctl status prerender
    exit 1
fi

# Verificar que responde
if curl -s "http://localhost:3001/render?url=https://web.opynio.com/es" > /dev/null 2>&1; then
    echo "   ✓ Prerender responde correctamente"
else
    echo "   ✗ Prerender no responde"
    exit 1
fi

echo ""
echo "=========================================="
echo "  INSTALACIÓN COMPLETADA"
echo "=========================================="
echo ""
echo "Prueba el prerender con:"
echo "  curl -A \"Googlebot\" \"https://web.opynio.com/es/empresa/Tarot_IA\" | grep \"<title>\""
echo ""
echo "Comandos útiles:"
echo "  systemctl status prerender    # Ver estado"
echo "  systemctl restart prerender   # Reiniciar"
echo "  journalctl -u prerender -f    # Ver logs"
echo ""
