@echo off
REM Script pour envoyer un rapport de modifications à Google Sheets
REM Usage: SEND_REPORT.bat

cd /d D:\Applicator\alflight

echo ================================================================================
echo   ENVOI RAPPORT DE MODIFICATIONS VERS GOOGLE SHEETS
echo ================================================================================
echo.

REM Définir le résumé des modifications
set "SUMMARY=Step5Review.jsx: Suppression alerts abaques redondantes + Amelioration detection modifications MANEX/abaques"

REM Définir les fichiers modifiés
set "FILES=src/features/aircraft/components/wizard-steps/Step5Review.jsx"

echo [INFO] Preparation du rapport...
echo   Summary: %SUMMARY%
echo   Files:   %FILES%
echo.

REM Créer le payload JSON
set "JSON={\"action\":\"CODE_MODIFICATION\",\"component\":\"Claude Code Assistant\",\"summary\":\"%SUMMARY%\",\"details\":\"{files: ['%FILES%'], timestamp: '%DATE% %TIME%'}\",\"status\":\"success\"}"

echo [INFO] Envoi vers http://localhost:3001/api/log...
echo.

REM Envoyer via curl
curl -X POST http://localhost:3001/api/log ^
     -H "Content-Type: application/json" ^
     -d "%JSON%" ^
     2>nul

if %errorlevel% equ 0 (
    echo.
    echo ================================================================================
    echo   ✅ SUCCES - Rapport envoye a Google Sheets
    echo ================================================================================
    echo.
    echo   Le rapport des modifications a ete enregistre dans Google Sheets.
    echo   Consultez: https://docs.google.com/spreadsheets/d/1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k
    echo.
) else (
    echo.
    echo ================================================================================
    echo   ❌ ERREUR - Echec de l'envoi du rapport
    echo ================================================================================
    echo.
    echo   Verifiez que le serveur Google Sheets est actif (port 3001)
    echo.
)

echo ================================================================================
echo.
pause
