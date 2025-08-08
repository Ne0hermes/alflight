@echo off
echo ========================================
echo   DEMARRAGE COMPLET FLIGHT MANAGEMENT
echo ========================================
echo.
echo [1/2] Demarrage du serveur proxy OpenAIP (port 3001)...
start "Proxy OpenAIP" cmd /k "cd server && npm start"
echo      Proxy demarre dans une nouvelle fenetre
echo.
timeout /t 3 /nobreak > nul
echo [2/2] Demarrage de l'application React...
echo.
npm run dev