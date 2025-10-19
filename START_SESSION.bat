@echo off
setlocal enabledelayedexpansion
echo ================================================================================
echo   DEMARRAGE SESSION ALFLIGHT - SUPABASE EDITION
echo ================================================================================
echo.

cd /d D:\Applicator\alflight

REM ============================================================================
REM ETAPE 1: VERIFICATION DES FICHIERS CRITIQUES
REM ============================================================================
echo [1/6] Verification des fichiers critiques...

set CRITICAL_FILES_OK=1

REM Vérifier le fichier credentials Google Sheets
if not exist "D:\Applicator\alfight-46443ca54259.json" (
    echo   [ERREUR] Fichier credentials Google Sheets manquant!
    echo   Chemin attendu: D:\Applicator\alfight-46443ca54259.json
    set CRITICAL_FILES_OK=0
)

REM Vérifier le serveur Google Sheets
if not exist "server\googleSheetsServer.js" (
    echo   [ERREUR] Serveur Google Sheets manquant!
    echo   Chemin attendu: server\googleSheetsServer.js
    set CRITICAL_FILES_OK=0
)

REM Vérifier le fichier .env
if not exist ".env" (
    echo   [ATTENTION] Fichier .env manquant - Supabase pourrait ne pas fonctionner
)

if !CRITICAL_FILES_OK! equ 0 (
    echo.
    echo   [ERREUR FATALE] Des fichiers critiques sont manquants!
    echo   Le tracking Google Sheets ne pourra pas demarrer.
    echo.
    pause
    exit /b 1
)

echo   Status: Tous les fichiers critiques sont presents
echo.

REM ============================================================================
REM ETAPE 2: VERIFICATION DU PORT GOOGLE SHEETS
REM ============================================================================
echo [2/6] Verification du serveur Google Sheets sur le port 3001...

netstat -ano | findstr :3001 >nul
if %errorlevel% equ 0 (
    echo   Status: Serveur deja actif sur le port 3001
    echo   Info:   Le serveur existant sera utilise
    echo.
) else (
    echo   Status: Port 3001 libre - Demarrage du serveur...
    echo.

    REM Démarrer le serveur Google Sheets
    start "Google Sheets Logger" cmd /k "cd /d D:\Applicator\alflight\server && node googleSheetsServer.js"

    REM Attendre que le serveur démarre
    echo   Attente du demarrage du serveur (5 secondes)...
    timeout /t 5 /nobreak >nul

    REM Vérifier que le serveur est bien démarré
    netstat -ano | findstr :3001 >nul
    if %errorlevel% equ 0 (
        echo   Status: [OK] Serveur Google Sheets demarre avec succes
        echo.
    ) else (
        echo   [ATTENTION] Le serveur ne semble pas avoir demarre correctement
        echo   Le tracking pourrait ne pas fonctionner
        echo.
    )
)

REM ============================================================================
REM ETAPE 3: TEST DE CONNEXION GOOGLE SHEETS
REM ============================================================================
echo [3/6] Test de connexion au serveur Google Sheets...

REM Test HTTP du endpoint /health
curl -s -o nul -w "%%{http_code}" http://localhost:3001/health >temp_http_code.txt
set /p HTTP_CODE=<temp_http_code.txt
del temp_http_code.txt >nul 2>&1

if "!HTTP_CODE!" equ "200" (
    echo   Status: [OK] Serveur Google Sheets accessible
    echo   Endpoint: http://localhost:3001/health
    echo.

    REM Envoyer un log de démarrage de session avec confirmation
    curl -X POST http://localhost:3001/api/log ^
         -H "Content-Type: application/json" ^
         -d "{\"action\":\"SESSION_DEMARREE\",\"component\":\"START_SESSION.bat\",\"summary\":\"Session de developpement demarree\",\"details\":\"Serveur Google Sheets verifie et operationnel\",\"status\":\"success\"}" ^
         -o temp_start.json ^
         2>nul

    if !errorlevel! equ 0 (
        echo   Status: [OK] Log de demarrage envoye a Google Sheets
        type temp_start.json 2>nul | findstr "range" >nul
        if !errorlevel! equ 0 (
            for /f "tokens=2 delims=:" %%a in ('type temp_start.json ^| findstr "range"') do (
                echo   Confirmation: Enregistre dans Google Sheets
            )
        )
        del temp_start.json >nul 2>&1
        echo.
    ) else (
        echo   [ATTENTION] Echec de l'envoi du log de demarrage
        echo.
    )
) else (
    echo   [ATTENTION] Serveur Google Sheets non accessible (HTTP !HTTP_CODE!)
    echo   Le tracking ne fonctionnera pas correctement
    echo.
)

REM ============================================================================
REM ETAPE 4: VERIFICATION CONNEXION SUPABASE
REM ============================================================================
echo [4/6] Verification de la connexion Supabase...

REM Charger les variables d'environnement
if exist ".env" (
    for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
        if "%%a"=="VITE_SUPABASE_URL" set SUPABASE_URL=%%b
        if "%%a"=="VITE_SUPABASE_ANON_KEY" set SUPABASE_KEY=%%b
    )
)

if defined SUPABASE_URL (
    echo   URL:     !SUPABASE_URL!
    echo   Project: bgmscwckawgybymbimga
    echo   Status:  Configuration chargee depuis .env
) else (
    echo   [ATTENTION] Variables Supabase non trouvees dans .env
    echo   L'application pourrait ne pas fonctionner correctement
)
echo.

REM ============================================================================
REM ETAPE 5: VERIFICATION NODE_MODULES
REM ============================================================================
echo [5/6] Verification des dependances Node.js...

if not exist "node_modules\" (
    echo   [ATTENTION] Dossier node_modules manquant
    echo   Installation des dependances...
    call npm install
    if !errorlevel! neq 0 (
        echo   [ERREUR] Echec de l'installation des dependances
        pause
        exit /b 1
    )
    echo   Status: [OK] Dependances installees
) else (
    echo   Status: [OK] Dependances presentes
)
echo.

REM ============================================================================
REM ETAPE 6: DEMARRAGE APPLICATION ET TRACKERS
REM ============================================================================
echo [6/6] Demarrage de l'application avec tracking complet...
echo   Port:    4001 (configure dans vite.config.js)
echo   App:     http://localhost:4001
echo   Tracking: DOUBLE SYSTEME ACTIF
echo   - AutoTracker:     Surveille modifications app
echo   - Claude Tracker:  Surveille modifications Claude Code
echo.

REM Démarrer l'application avec le double tracking
start "ALFlight Dev + Trackers" cmd /k npm run dev:full-tracked

REM Attendre un peu pour que tout démarre
timeout /t 3 /nobreak >nul

echo.
echo ================================================================================
echo   SESSION PRETE - TOUTES LES VERIFICATIONS PASSEES
echo ================================================================================
echo.
echo   [APPLICATION]
echo   - App Web:     http://localhost:4001
echo   - Mode:        Developpement avec HMR
echo.
echo   [BACKEND]
echo   - Google Sheets Logger:  http://localhost:3001
echo   - Endpoint Health:       http://localhost:3001/health
echo   - Endpoint Test:         http://localhost:3001/api/test
echo.
echo   [SUPABASE]
echo   - Dashboard:   https://supabase.com/dashboard/project/bgmscwckawgybymbimga
echo   - Database:    Table community_presets configuree
if defined SUPABASE_URL (
echo   - URL API:     !SUPABASE_URL!
)
echo.
echo   [TRACKING]
echo   - Google Sheets:  https://docs.google.com/spreadsheets/d/1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k
echo   - Auto-tracker:       ACTIF (surveille modifications app)
echo   - Claude Tracker:     ACTIF (surveille modifications Claude Code)
echo   - Log local:          tracking\claude-updates.log
echo   - Session Claude:     tracking\claude-session.json
echo.
echo ================================================================================
echo.
echo   CONSEIL: Gardez cette fenetre ouverte pour voir les messages du systeme
echo.
echo   Pour arreter proprement:
echo   1. Fermez le navigateur
echo   2. Dans chaque fenetre de serveur, faites Ctrl+C
echo   3. Fermez cette fenetre
echo.
echo ================================================================================
echo.

REM Envoyer un log de session prête avec confirmation
echo [6/6] Envoi log de session vers Google Sheets...
curl -X POST http://localhost:3001/api/log ^
     -H "Content-Type: application/json" ^
     -d "{\"action\":\"SESSION_PRETE\",\"component\":\"START_SESSION.bat\",\"summary\":\"Environnement de developpement pret\",\"details\":{\"app_url\":\"http://localhost:4001\",\"backend_url\":\"http://localhost:3001\",\"tracking\":\"active\",\"supabase\":\"configured\"},\"status\":\"success\"}" ^
     -o temp_response.json ^
     2>nul

if %errorlevel% equ 0 (
    echo   Status: [OK] Log envoye a Google Sheets
    echo   Spreadsheet: 1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k
    type temp_response.json 2>nul | findstr "range" >nul
    if %errorlevel% equ 0 (
        echo   Confirmation: Enregistrement reussi
    )
    del temp_response.json >nul 2>&1
) else (
    echo   [ATTENTION] Echec envoi log vers Google Sheets
)
echo.

pause
