@echo off
REM Lancer le développement avec tracking automatique
REM Double-cliquez sur ce fichier pour démarrer

cd /d "%~dp0"
powershell.exe -ExecutionPolicy Bypass -File "start-dev-tracked.ps1"
pause
