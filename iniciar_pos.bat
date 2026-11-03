@echo off
echo Iniciando Sistema POS local conectado a la base de datos Turso...
cd /d "%~dp0"

if not defined TURSO_DATABASE_URL goto missing_config
if not defined TURSO_AUTH_TOKEN goto missing_config

start "Terra POS Backend" /min cmd /c "npm start"
timeout /t 5 /nobreak >nul
start "" "http://localhost:3000"
echo.
echo El POS esta iniciando en esta PC.
echo Para acceso remoto, conecte los dispositivos a la misma red Tailscale.
echo No publique el puerto 3000 ni use enlaces publicos de tunel.
echo Mantenga esta computadora encendida y conectada a Internet.
goto end

:missing_config
echo.
echo No se inicio el POS para evitar usar la base local vacia.
echo En Render, abra el servicio y copie los valores privados de
echo TURSO_DATABASE_URL y TURSO_AUTH_TOKEN. Luego, en Windows, busque
echo "Editar las variables de entorno de tu cuenta" y cree ambas variables.
echo No comparta esos valores por chat ni los guarde en este archivo.
pause

:end