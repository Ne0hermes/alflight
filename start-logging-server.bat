@echo off
echo ========================================
echo  Google Sheets Auto-Logger
echo ========================================
echo.
echo Demarrage du serveur de logging...
echo Spreadsheet: 1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k
echo Port: 3001
echo.

cd /d D:\Applicator\alflight
node server/googleSheetsServer.js

pause
