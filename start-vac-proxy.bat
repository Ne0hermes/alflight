@echo off
echo ======================================
echo   Demarrage du serveur VAC Proxy
echo ======================================
echo.
echo NB: ce serveur demarre aussi automatiquement avec "npm run dev"
echo     (ou seul via "npm run dev:vac").
echo.

echo Demarrage du serveur sur http://localhost:3003
echo.
echo Services disponibles:
echo   - GET  /api/vac/{OACI}      : Telecharger une carte VAC (PDF)
echo   - POST /api/vac-download    : Telecharger une carte VAC (body {icao})
echo   - GET  /api/airac-info      : Info cycle AIRAC actuel
echo   - POST /api/clear-cache     : Vider le cache
echo   - GET  /health              : Etat du serveur
echo.
echo Appuyez sur Ctrl+C pour arreter le serveur
echo ======================================
echo.

node server\vac-proxy-server.js

pause
