@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instala Node.js 24 y vuelve a abrir este archivo.
  pause
  exit /b 1
)
where python >nul 2>nul
if errorlevel 1 (
  echo Instala Python 3.10 o posterior y activa la opcion de agregarlo a PATH.
  pause
  exit /b 1
)
echo Abre http://localhost:8080 en tu navegador cuando aparezca Portafolio listo.
node server.ts
pause
