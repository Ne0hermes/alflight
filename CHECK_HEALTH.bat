@echo off
setlocal enabledelayedexpansion
echo ================================================================================
echo   DIAGNOSTIC SYSTEME ALFLIGHT
echo ================================================================================
echo.

cd /d D:\Applicator\alflight

set ALL_OK=1

REM ============================================================================
REM 1. VERIFICATION FICHIERS CRITIQUES
REM ============================================================================
echo [1/7] FICHIERS CRITIQUES
echo --------------------------------------------------------------------------------

REM Credentials Google Sheets
if exist "D:\Applicator\alfight-46443ca54259.json" (
    echo   [OK] Credentials Google Sheets present
) else (
    echo   [ERREUR] Credentials Google Sheets MANQUANT
    echo           Chemin: D:\Applicator\alfight-46443ca54259.json
    set ALL_OK=0
)

REM Serveur Google Sheets
if exist "server\googleSheetsServer.js" (
    echo   [OK] Serveur Google Sheets present
) else (
    echo   [ERREUR] Serveur Google Sheets MANQUANT
    echo           Chemin: server\googleSheetsServer.js
    set ALL_OK=0
)

REM Fichier .env
if exist ".env" (
    echo   [OK] Fichier .env present
) else (
    echo   [ATTENTION] Fichier .env MANQUANT
)

REM Auto-tracker
if exist "scripts\autoTracker.cjs" (
    echo   [OK] Auto-tracker present
) else (
    echo   [ATTENTION] Auto-tracker MANQUANT
)

echo.

REM ============================================================================
REM 2. VERIFICATION PORTS
REM ============================================================================
echo [2/7] PORTS RESEAU
echo --------------------------------------------------------------------------------

REM Port 3001 - Google Sheets Logger
netstat -ano | findstr :3001 >nul
if %errorlevel% equ 0 (
    echo   [OK] Port 3001 (Google Sheets Logger) - ACTIF
) else (
    echo   [INFO] Port 3001 (Google Sheets Logger) - LIBRE
)

REM Port 4001 - Application Vite
netstat -ano | findstr :4001 >nul
if %errorlevel% equ 0 (
    echo   [OK] Port 4001 (Application Vite) - ACTIF
) else (
    echo   [INFO] Port 4001 (Application Vite) - LIBRE
)

echo.

REM ============================================================================
REM 3. TEST CONNEXION GOOGLE SHEETS
REM ============================================================================
echo [3/7] SERVEUR GOOGLE SHEETS
echo --------------------------------------------------------------------------------

REM Vérifier si le serveur est accessible
curl -s -o nul -w "%%{http_code}" http://localhost:3001/health >temp_http_code.txt 2>nul
set /p HTTP_CODE=<temp_http_code.txt
del temp_http_code.txt >nul 2>&1

if "!HTTP_CODE!" equ "200" (
    echo   [OK] Serveur accessible sur http://localhost:3001
    echo   [OK] Endpoint /health repond correctement

    REM Tester l'endpoint /api/test
    curl -s http://localhost:3001/api/test >temp_test.json 2>nul
    if !errorlevel! equ 0 (
        echo   [OK] Endpoint /api/test operationnel

        REM Afficher le nombre de lignes dans Google Sheets
        for /f "tokens=*" %%a in ('type temp_test.json ^| findstr /i "rows"') do (
            echo   [INFO] %%a
        )
        del temp_test.json >nul 2>&1
    ) else (
        echo   [ATTENTION] Endpoint /api/test non accessible
        del temp_test.json >nul 2>&1
    )
) else (
    echo   [ERREUR] Serveur Google Sheets NON ACCESSIBLE
    echo           HTTP Code: !HTTP_CODE!
    echo           URL: http://localhost:3001/health
    echo.
    echo   Le serveur doit etre demarre avec: START_SESSION.bat
    set ALL_OK=0
)

echo.

REM ============================================================================
REM 4. VERIFICATION SUPABASE
REM ============================================================================
echo [4/7] CONFIGURATION SUPABASE
echo --------------------------------------------------------------------------------

if exist ".env" (
    REM Charger les variables d'environnement
    for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
        if "%%a"=="VITE_SUPABASE_URL" set SUPABASE_URL=%%b
        if "%%a"=="VITE_SUPABASE_ANON_KEY" set SUPABASE_KEY=%%b
    )

    if defined SUPABASE_URL (
        echo   [OK] VITE_SUPABASE_URL definie
        echo        URL: !SUPABASE_URL!
    ) else (
        echo   [ERREUR] VITE_SUPABASE_URL NON DEFINIE dans .env
        set ALL_OK=0
    )

    if defined SUPABASE_KEY (
        echo   [OK] VITE_SUPABASE_ANON_KEY definie
        REM Afficher seulement les 20 premiers caractères de la clé
        set KEY_PREFIX=!SUPABASE_KEY:~0,20!
        echo        Key: !KEY_PREFIX!...
    ) else (
        echo   [ERREUR] VITE_SUPABASE_ANON_KEY NON DEFINIE dans .env
        set ALL_OK=0
    )
) else (
    echo   [ERREUR] Fichier .env MANQUANT
    set ALL_OK=0
)

echo.

REM ============================================================================
REM 5. VERIFICATION NODE.JS
REM ============================================================================
echo [5/7] ENVIRONNEMENT NODE.JS
echo --------------------------------------------------------------------------------

REM Vérifier Node.js
node --version >temp_node.txt 2>&1
if %errorlevel% equ 0 (
    set /p NODE_VERSION=<temp_node.txt
    echo   [OK] Node.js installe - !NODE_VERSION!
    del temp_node.txt >nul 2>&1
) else (
    echo   [ERREUR] Node.js NON INSTALLE ou non accessible
    set ALL_OK=0
    del temp_node.txt >nul 2>&1
)

REM Vérifier npm
npm --version >temp_npm.txt 2>&1
if %errorlevel% equ 0 (
    set /p NPM_VERSION=<temp_npm.txt
    echo   [OK] npm installe - v!NPM_VERSION!
    del temp_npm.txt >nul 2>&1
) else (
    echo   [ERREUR] npm NON INSTALLE ou non accessible
    set ALL_OK=0
    del temp_npm.txt >nul 2>&1
)

REM Vérifier node_modules
if exist "node_modules\" (
    echo   [OK] Dependances Node.js installees
) else (
    echo   [ATTENTION] Dossier node_modules MANQUANT
    echo              Executez: npm install
)

echo.

REM ============================================================================
REM 6. VERIFICATION TRACKING
REM ============================================================================
echo [6/7] SYSTEME DE TRACKING
echo --------------------------------------------------------------------------------

REM Vérifier le dossier tracking
if exist "tracking\" (
    echo   [OK] Dossier tracking presente
) else (
    echo   [INFO] Dossier tracking ABSENT (sera cree au premier log)
)

REM Vérifier le fichier de log local
if exist "tracking\claude-updates.log" (
    REM Compter les lignes du fichier
    for /f %%a in ('type "tracking\claude-updates.log" ^| find /c /v ""') do set LOG_LINES=%%a
    echo   [OK] Fichier de log local existe
    echo        Lignes: !LOG_LINES!
) else (
    echo   [INFO] Fichier de log local ABSENT (sera cree au premier log)
)

REM Vérifier le script PowerShell de notification
if exist "scripts\notify-update.ps1" (
    echo   [OK] Script de notification PowerShell present
) else (
    echo   [INFO] Script de notification PowerShell ABSENT
)

echo.

REM ============================================================================
REM 7. ACCES GOOGLE SHEETS
REM ============================================================================
echo [7/7] ACCES GOOGLE SHEETS
echo --------------------------------------------------------------------------------

echo   [INFO] Spreadsheet ID: 1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k
echo   [INFO] Lien direct:
echo          https://docs.google.com/spreadsheets/d/1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k

echo.

REM ============================================================================
REM RESULTAT FINAL
REM ============================================================================
echo ================================================================================
if !ALL_OK! equ 1 (
    echo   RESULTAT: [OK] SYSTEME OPERATIONNEL
    echo.
    echo   Tous les composants critiques sont presents et fonctionnels.
    echo   Vous pouvez demarrer l'application avec START_SESSION.bat
) else (
    echo   RESULTAT: [ERREUR] PROBLEMES DETECTES
    echo.
    echo   Des composants critiques sont manquants ou non fonctionnels.
    echo   Veuillez corriger les erreurs ci-dessus avant de demarrer.
)
echo ================================================================================
echo.

pause
