@echo off
echo Nettoyage du cache et redemarrage...

:: Arrêter les processus Node existants
echo Arret des processus Node...
taskkill /F /IM node.exe 2>nul

:: Supprimer le cache de Vite
echo Suppression du cache Vite...
rmdir /s /q node_modules\.vite 2>nul
rmdir /s /q .vite 2>nul

:: Supprimer les fichiers temporaires
echo Suppression des fichiers temporaires...
del /q *.log 2>nul

:: Redémarrer le serveur de développement
echo Redemarrage du serveur...
npm run dev

pause