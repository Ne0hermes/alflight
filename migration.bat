@echo off
REM Script de migration pour Windows - Flight Management System

echo ============================================
echo   Migration du projet Flight Management System
echo ============================================
echo.

REM 1. Supprimer les fichiers et dossiers inutiles
echo [1/6] Suppression des fichiers Tailwind et Service Worker...
if exist "src\postcss.config.js" del "src\postcss.config.js"
if exist "src\tailwind.config.js" del "src\tailwind.config.js"
if exist "src\serviceWorker" rmdir /s /q "src\serviceWorker"

REM 2. Supprimer le fichier TypeScript types
echo [2/6] Suppression des fichiers TypeScript...
if exist "src\modules\vac\types\index.ts" del "src\modules\vac\types\index.ts"

REM 3. Supprimer les dépendances inutiles
echo [3/6] Suppression des dependances inutiles...
call npm uninstall tailwindcss autoprefixer postcss react-pdf scribe.js-ocr workbox-webpack-plugin

REM 4. Installer les bonnes versions
echo [4/6] Installation des nouvelles dependances...
call npm install react@18.2.0 react-dom@18.2.0 --save
call npm install pdfjs-dist@4.0.379 --save
call npm install vite@5.0.12 vite-plugin-pwa@0.20.5 --save-dev

REM 5. Créer les alias dans jsconfig.json pour l'IDE
echo [5/6] Creation du jsconfig.json...
(
echo {
echo   "compilerOptions": {
echo     "baseUrl": ".",
echo     "paths": {
echo       "@/*": ["./src/*"],
echo       "@components/*": ["./src/components/*"],
echo       "@context/*": ["./src/context/*"],
echo       "@hooks/*": ["./src/hooks/*"],
echo       "@modules/*": ["./src/modules/*"],
echo       "@utils/*": ["./src/utils/*"]
echo     }
echo   },
echo   "include": ["src/**/*"],
echo   "exclude": ["node_modules", "dist"]
echo }
) > jsconfig.json

echo [6/6] Nettoyage du cache npm...
call npm cache clean --force

echo.
echo ============================================
echo   Migration terminee !
echo ============================================
echo.
echo IMPORTANT - Actions manuelles requises :
echo.
echo 1. Remplacer tous les fichiers modifies par les versions corrigees
echo 2. Verifier que tous les imports utilisent les nouveaux alias
echo    Exemple: @components, @context, @hooks, etc.
echo 3. Rechercher et remplacer dans tous les fichiers :
echo    - fobFuel -^> fobFuel
echo    - setfobFuel -^> setFobFuel
echo    - CRM -^> FOB
echo 4. Relancer 'npm run dev' pour tester l'application
echo.
echo Consultez MIGRATION.md pour plus de details
echo.
pause