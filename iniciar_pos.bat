@echo off
echo Iniciando Sistema POS - Terra Frutos Secos...
cd /d C:\Users\Anthony\Documents\sistema-pos
start /min cmd /c "npm start"
start /min cmd /c "npm run dev"
start /min cmd /c "ngrok http --url=spindle-careless-liquid.ngrok-free.dev 5174"