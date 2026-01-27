@echo off
REM Script para medir rendimiento con Lighthouse CLI en Windows
REM Uso: scripts\test-performance.bat

echo Instalando Lighthouse CLI (si no esta instalado)...
call npm list -g lighthouse >nul 2>&1 || call npm install -g lighthouse

echo.
echo Analizando web.opynio.com con Lighthouse...
echo Esto puede tomar 1-2 minutos...
echo.

REM Crear carpeta para reportes si no existe
if not exist lighthouse-reports mkdir lighthouse-reports

REM Fecha para nombre de archivo
set TIMESTAMP=%date:~-4%%date:~3,2%%date:~0,2%-%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%

REM Analisis MOVIL
echo Analizando version MOVIL...
call lighthouse https://web.opynio.com ^
  --output html ^
  --output json ^
  --output-path "./lighthouse-reports/mobile-%TIMESTAMP%" ^
  --preset=perf ^
  --emulated-form-factor=mobile ^
  --throttling-method=simulate ^
  --throttling.cpuSlowdownMultiplier=4 ^
  --chrome-flags="--headless"

echo.
echo Analizando version DESKTOP...
call lighthouse https://web.opynio.com ^
  --output html ^
  --output json ^
  --output-path "./lighthouse-reports/desktop-%TIMESTAMP%" ^
  --preset=perf ^
  --emulated-form-factor=desktop ^
  --throttling-method=simulate ^
  --chrome-flags="--headless"

echo.
echo Analisis completado!
echo.
echo Reportes guardados en lighthouse-reports\
echo Abre los archivos HTML en tu navegador para ver resultados
echo.
pause
