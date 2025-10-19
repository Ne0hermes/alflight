@echo off
setlocal enabledelayedexpansion
REM ============================================================================
REM SCRIPT: Envoi rapport final des modifications à Google Sheets
REM ============================================================================

cd /d D:\Applicator\alflight

echo.
echo ================================================================================
echo   📊 RAPPORT FINAL DES MODIFICATIONS - GOOGLE SHEETS
echo ================================================================================
echo.
echo   Date: %DATE% %TIME%
echo   Outil: Claude Code Assistant
echo.

REM Définir le rapport détaillé des modifications
set "SUMMARY=Ameliorations Step5Review - Suppression alerts redondantes et optimisation detection modifications"

set "DETAILS_JSON={^
\"timestamp\": \"%DATE% %TIME%\",^
\"fichiers_modifies\": [^
  \"src/features/aircraft/components/wizard-steps/Step5Review.jsx\",^
  \"START_SESSION.bat\",^
  \"scripts/send-modification-report.ps1\"^
],^
\"modifications_principales\": [^
  \"Suppression Alert tooltip abaques dans section performance recap (ligne 847-858)\",^
  \"Suppression Alert redondante dans tableau comparatif variantes (ligne 1344-1355)\",^
  \"Ajout manex et flightManual a la liste des champs ignores (ligne 157)\",^
  \"Amelioration logique comparaison abaques - remplacement JSON.stringify par comparaison intelligente (ligne 1301-1323)\",^
  \"Ajout confirmations systematiques envoi Google Sheets dans START_SESSION.bat\"^
],^
\"resultats\": [^
  \"Les abaques ne sont plus signales comme modifies a tort\",^
  \"Le MANEX n'apparait plus dans le tableau comparatif sans modification reelle\",^
  \"Confirmations visibles dans PowerShell pour tous les uploads Google Sheets\"^
],^
\"impact\": \"Amelioration UX - elimination faux positifs dans detection modifications\",^
\"status\": \"success\"^
}"

echo [INFO] Preparation du rapport final...
echo.
echo   MODIFICATIONS APPORTEES:
echo   -------------------------
echo   1. Step5Review.jsx - Ligne 847-858
echo      ^> Suppression Alert "Systeme abaque ajoute ou modifie" (section recap)
echo.
echo   2. Step5Review.jsx - Ligne 1344-1355
echo      ^> Suppression Alert redondante (tableau comparatif)
echo.
echo   3. Step5Review.jsx - Ligne 157
echo      ^> Ajout 'manex' et 'flightManual' aux champs ignores
echo.
echo   4. Step5Review.jsx - Ligne 1301-1323
echo      ^> Amelioration comparaison abaques (intelligente vs stricte)
echo.
echo   5. START_SESSION.bat
echo      ^> Ajout confirmations systematiques uploads Google Sheets
echo.
echo   6. Nouveaux scripts crees:
echo      ^> scripts/send-modification-report.ps1
echo      ^> SEND_REPORT.bat
echo      ^> RAPPORT_FINAL.bat
echo.

REM Construire le payload JSON
set "JSON={\"action\":\"RAPPORT_FINAL_MODIFICATIONS\",\"component\":\"Claude Code Assistant\",\"summary\":\"%SUMMARY%\",\"details\":%DETAILS_JSON%,\"status\":\"success\"}"

echo ================================================================================
echo   📤 ENVOI VERS GOOGLE SHEETS
echo ================================================================================
echo.
echo   Endpoint: http://localhost:3001/api/log
echo   Spreadsheet: 1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k
echo.

REM Envoyer vers Google Sheets avec curl
curl -X POST http://localhost:3001/api/log ^
     -H "Content-Type: application/json" ^
     -d "%JSON%" ^
     -o rapport_response.json ^
     -w "   HTTP Status: %%{http_code}\n   Time: %%{time_total}s\n" ^
     2>nul

echo.

if %errorlevel% equ 0 (
    echo ================================================================================
    echo   ✅ SUCCES - RAPPORT ENVOYE ET ENREGISTRE
    echo ================================================================================
    echo.

    REM Extraire et afficher la range
    for /f "tokens=2 delims=:," %%a in ('type rapport_response.json ^| findstr "range"') do (
        set "RANGE=%%a"
        set "RANGE=!RANGE:"=!"
        set "RANGE=!RANGE: =!"
        echo   📍 Range Google Sheets: !RANGE!
    )

    echo   📊 Spreadsheet URL:
    echo      https://docs.google.com/spreadsheets/d/1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k
    echo.
    echo   ✓ Toutes les modifications ont ete loggees avec succes
    echo   ✓ Le rapport detaille est disponible dans Google Sheets
    echo   ✓ Les confirmations systematiques sont actives
    echo.

    REM Sauvegarder dans le log local
    echo [%DATE% %TIME%] ✅ RAPPORT FINAL ENVOYE - Toutes modifications documentees >> tracking\claude-updates.log

) else (
    echo ================================================================================
    echo   ❌ ERREUR - ECHEC ENVOI RAPPORT
    echo ================================================================================
    echo.
    echo   Le serveur Google Sheets n'a pas repondu correctement.
    echo   Verifiez que le serveur est actif sur le port 3001.
    echo.

    REM Sauvegarder l'erreur dans le log local
    echo [%DATE% %TIME%] ❌ ERREUR - Echec envoi rapport final >> tracking\claude-updates.log
)

REM Nettoyer
if exist rapport_response.json del rapport_response.json >nul 2>&1

echo ================================================================================
echo.
pause
