@echo off
echo ======================================
echo   Démarrage du serveur VAC Proxy
echo ======================================
echo.

cd server

REM Vérifier si node_modules existe
if not exist "node_modules" (
    echo Installation des dépendances...
    npm install express cors axios puppeteer
    echo.
)

echo Démarrage du serveur sur http://localhost:3002
echo.
echo Services disponibles:
echo   - POST /api/vac-download     : Télécharger une carte VAC
echo   - GET  /api/airac-info      : Info cycle AIRAC actuel
echo   - POST /api/clear-cache     : Vider le cache
echo   - GET  /health              : État du serveur
echo.
echo Appuyez sur Ctrl+C pour arrêter le serveur
echo ======================================
echo.

node vac-proxy-server.js

pause