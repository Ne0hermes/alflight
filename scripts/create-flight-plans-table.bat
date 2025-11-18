@echo off
chcp 65001 >nul
echo.
echo ================================================
echo   Configuration table flight_plans - Supabase
echo ================================================
echo.
echo 📊 Table: flight_plans
echo 📍 Projet: https://bgmscwckawgybymbimga.supabase.co
echo.
echo Ouvrez le lien suivant dans votre navigateur:
echo https://bgmscwckawgybymbimga.supabase.co/project/_/sql
echo.
echo Puis copiez-collez le contenu du fichier:
echo supabase-flight-plans-setup.sql
echo.
echo Et cliquez sur "Run" pour créer la table.
echo.
start https://bgmscwckawgybymbimga.supabase.co/project/_/sql
notepad.exe D:\Applicator\alflight\supabase-flight-plans-setup.sql
echo.
echo ✅ Script terminé
pause
