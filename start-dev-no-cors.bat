@echo off
echo ====================================
echo DEMARRAGE EN MODE DEVELOPPEMENT
echo (Sans restrictions CORS)
echo ====================================
echo.
echo ATTENTION: Ce mode desactive la securite CORS
echo Utiliser UNIQUEMENT pour le developpement local!
echo.
echo Fermer toutes les instances de Chrome avant de continuer...
pause

echo.
echo Demarrage de Chrome sans CORS...
start chrome.exe --disable-web-security --disable-site-isolation-trials --user-data-dir="C:\temp\chrome-dev" "http://localhost:4000"

echo.
echo Chrome demarre. L'application devrait s'ouvrir automatiquement.
echo Si l'API ne fonctionne pas, verifier que le serveur proxy est demarre:
echo   cd server
echo   npm run dev
echo.
pause