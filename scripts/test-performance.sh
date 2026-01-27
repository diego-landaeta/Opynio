#!/bin/bash

# Script para medir rendimiento con Lighthouse CLI
# Uso: bash scripts/test-performance.sh

echo "🔍 Instalando Lighthouse CLI (si no está instalado)..."
npm list -g lighthouse || npm install -g lighthouse

echo ""
echo "📊 Analizando web.opynio.com con Lighthouse..."
echo "⏳ Esto puede tomar 1-2 minutos..."
echo ""

# Crear carpeta para reportes si no existe
mkdir -p lighthouse-reports

# Fecha para nombre de archivo
DATE=$(date +%Y%m%d-%H%M%S)

# Análisis MÓVIL
echo "📱 Analizando versión MÓVIL..."
lighthouse https://web.opynio.com \
  --output html \
  --output json \
  --output-path "./lighthouse-reports/mobile-${DATE}" \
  --preset=perf \
  --emulated-form-factor=mobile \
  --throttling-method=simulate \
  --throttling.cpuSlowdownMultiplier=4 \
  --chrome-flags="--headless"

echo ""
echo "💻 Analizando versión DESKTOP..."
lighthouse https://web.opynio.com \
  --output html \
  --output json \
  --output-path "./lighthouse-reports/desktop-${DATE}" \
  --preset=perf \
  --emulated-form-factor=desktop \
  --throttling-method=simulate \
  --chrome-flags="--headless"

echo ""
echo "✅ Análisis completado!"
echo ""
echo "📄 Reportes guardados en:"
echo "   - lighthouse-reports/mobile-${DATE}.report.html"
echo "   - lighthouse-reports/desktop-${DATE}.report.html"
echo ""
echo "🌐 Abre los archivos HTML en tu navegador para ver resultados"
