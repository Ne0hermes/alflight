# Script PowerShell pour configurer le repository GitHub des MANEX
# Usage: .\setup-github-manex.ps1

Write-Host "`n=== Configuration du repository GitHub pour les MANEX ===" -ForegroundColor Cyan
Write-Host ""

# Étape 1: Vérifications
Write-Host "ÉTAPE 1: Vérifications préalables" -ForegroundColor Yellow
Write-Host ""

# Vérifier si Git est installé
$gitInstalled = Get-Command git -ErrorAction SilentlyContinue
if (-not $gitInstalled) {
    Write-Host "❌ Git n'est pas installé sur votre système" -ForegroundColor Red
    Write-Host "   Téléchargez Git: https://git-scm.com/download/win" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "OU utilisez la méthode via le site web (plus simple):" -ForegroundColor Green
    Write-Host "   1. Allez sur https://github.com/new" -ForegroundColor White
    Write-Host "   2. Nom: alflight-manex" -ForegroundColor White
    Write-Host "   3. Public ✓" -ForegroundColor White
    Write-Host "   4. Add README ✓" -ForegroundColor White
    Write-Host "   5. Create repository" -ForegroundColor White
    Write-Host "   6. Upload files → Glissez votre PDF" -ForegroundColor White
    Write-Host "   7. Cliquez sur le PDF → Raw → Copiez l'URL" -ForegroundColor White
    Write-Host ""
    Read-Host "Appuyez sur Entrée pour quitter"
    exit
}

Write-Host "✅ Git est installé: $($gitInstalled.Version)" -ForegroundColor Green
Write-Host ""

# Étape 2: Demander le nom d'utilisateur GitHub
Write-Host "ÉTAPE 2: Configuration GitHub" -ForegroundColor Yellow
Write-Host ""
$githubUsername = Read-Host "Entrez votre nom d'utilisateur GitHub"

if ([string]::IsNullOrWhiteSpace($githubUsername)) {
    Write-Host "❌ Nom d'utilisateur requis" -ForegroundColor Red
    Read-Host "Appuyez sur Entrée pour quitter"
    exit
}

Write-Host ""
Write-Host "📋 Instructions à suivre MAINTENANT:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Ouvrez votre navigateur: https://github.com/new" -ForegroundColor White
Write-Host "2. Repository name: alflight-manex" -ForegroundColor White
Write-Host "3. Description: MANEX files for ALFlight aircraft presets" -ForegroundColor White
Write-Host "4. Public ✓ (IMPORTANT)" -ForegroundColor White
Write-Host "5. Add a README file ✓" -ForegroundColor White
Write-Host "6. Cliquez sur 'Create repository'" -ForegroundColor White
Write-Host ""
$created = Read-Host "Avez-vous créé le repository? (o/n)"

if ($created -ne "o" -and $created -ne "O") {
    Write-Host "Veuillez créer le repository puis relancer ce script" -ForegroundColor Yellow
    Read-Host "Appuyez sur Entrée pour quitter"
    exit
}

# Étape 3: Cloner le repository
Write-Host ""
Write-Host "ÉTAPE 3: Clonage du repository" -ForegroundColor Yellow
Write-Host ""

$repoPath = "D:\Applicator\alflight-manex"

if (Test-Path $repoPath) {
    Write-Host "⚠️  Le dossier existe déjà: $repoPath" -ForegroundColor Yellow
    $overwrite = Read-Host "Voulez-vous le supprimer et recommencer? (o/n)"
    if ($overwrite -eq "o" -or $overwrite -eq "O") {
        Remove-Item -Path $repoPath -Recurse -Force
        Write-Host "✅ Dossier supprimé" -ForegroundColor Green
    } else {
        Write-Host "Annulation..." -ForegroundColor Yellow
        Read-Host "Appuyez sur Entrée pour quitter"
        exit
    }
}

$repoUrl = "https://github.com/$githubUsername/alflight-manex.git"
Write-Host "Clonage depuis: $repoUrl" -ForegroundColor Cyan

try {
    git clone $repoUrl $repoPath
    Write-Host "✅ Repository cloné avec succès" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur lors du clonage. Vérifiez:" -ForegroundColor Red
    Write-Host "   - Votre nom d'utilisateur: $githubUsername" -ForegroundColor Yellow
    Write-Host "   - Le repository existe: $repoUrl" -ForegroundColor Yellow
    Write-Host "   - Vous êtes connecté à GitHub" -ForegroundColor Yellow
    Read-Host "Appuyez sur Entrée pour quitter"
    exit
}

# Étape 4: Créer la structure
Write-Host ""
Write-Host "ÉTAPE 4: Création de la structure" -ForegroundColor Yellow
Write-Host ""

Set-Location $repoPath

# Créer les dossiers pour les modèles d'avions
$aircraftModels = @("da40ng", "c172", "pa28", "dr400", "sr20", "sr22")

foreach ($model in $aircraftModels) {
    $modelPath = Join-Path $repoPath $model
    if (-not (Test-Path $modelPath)) {
        New-Item -ItemType Directory -Path $modelPath | Out-Null
        Write-Host "✅ Dossier créé: $model" -ForegroundColor Green
    }
}

# Créer un README
$readmeContent = @"
# ALFlight MANEX Repository

Repository contenant les fichiers MANEX (manuels d'exploitation) pour les avions pré-configurés d'ALFlight.

## Structure

Chaque modèle d'avion a son propre dossier:

- ``da40ng/`` - Diamond DA40 NG
- ``c172/`` - Cessna 172
- ``pa28/`` - Piper PA-28
- ``dr400/`` - Robin DR400
- ``sr20/`` - Cirrus SR20
- ``sr22/`` - Cirrus SR22

## URLs des fichiers

Les fichiers sont accessibles via:
``````
https://raw.githubusercontent.com/$githubUsername/alflight-manex/main/MODELE/FICHIER.pdf
``````

Exemple:
``````
https://raw.githubusercontent.com/$githubUsername/alflight-manex/main/da40ng/MANEX_DA40NG_V2.0.pdf
``````

## Utilisation

1. Uploader les PDFs dans les dossiers appropriés
2. Copier l'URL Raw du fichier
3. Ajouter l'URL dans le champ ``remoteUrl`` du JSON de l'avion

## Maintenance

- Chaque mise à jour d'un MANEX doit créer un nouveau fichier avec version
- Ne pas supprimer les anciennes versions (pour compatibilité)
"@

Set-Content -Path "README.md" -Value $readmeContent -Encoding UTF8
Write-Host "✅ README.md créé" -ForegroundColor Green

# Étape 5: Chercher les MANEX existants
Write-Host ""
Write-Host "ÉTAPE 5: Recherche des MANEX existants" -ForegroundColor Yellow
Write-Host ""

$logAppPath = "D:\log app"
if (Test-Path $logAppPath) {
    $pdfFiles = Get-ChildItem -Path $logAppPath -Filter "*.pdf" -ErrorAction SilentlyContinue

    if ($pdfFiles.Count -gt 0) {
        Write-Host "📄 PDFs trouvés dans D:\log app:" -ForegroundColor Cyan
        foreach ($pdf in $pdfFiles) {
            Write-Host "   - $($pdf.Name) ($([math]::Round($pdf.Length/1MB, 2)) MB)" -ForegroundColor White
        }
        Write-Host ""
        $copyFiles = Read-Host "Voulez-vous copier ces fichiers? (o/n)"

        if ($copyFiles -eq "o" -or $copyFiles -eq "O") {
            foreach ($pdf in $pdfFiles) {
                # Déterminer le dossier de destination
                $destFolder = "da40ng"  # Par défaut
                if ($pdf.Name -like "*C172*" -or $pdf.Name -like "*Cessna*") { $destFolder = "c172" }
                if ($pdf.Name -like "*PA28*" -or $pdf.Name -like "*Piper*") { $destFolder = "pa28" }
                if ($pdf.Name -like "*DR400*" -or $pdf.Name -like "*Robin*") { $destFolder = "dr400" }
                if ($pdf.Name -like "*SR20*" -or $pdf.Name -like "*Cirrus*") { $destFolder = "sr20" }
                if ($pdf.Name -like "*SR22*") { $destFolder = "sr22" }

                $destPath = Join-Path $repoPath "$destFolder\$($pdf.Name)"
                Copy-Item -Path $pdf.FullName -Destination $destPath
                Write-Host "✅ Copié: $($pdf.Name) → $destFolder/" -ForegroundColor Green
            }
        }
    } else {
        Write-Host "ℹ️  Aucun PDF trouvé dans D:\log app" -ForegroundColor Cyan
    }
}

# Étape 6: Commit et push
Write-Host ""
Write-Host "ÉTAPE 6: Envoi sur GitHub" -ForegroundColor Yellow
Write-Host ""

git add .
git commit -m "Initial setup: Add structure and MANEX files"

Write-Host ""
Write-Host "📤 Envoi vers GitHub..." -ForegroundColor Cyan
Write-Host "   (Vous devrez peut-être entrer vos identifiants GitHub)" -ForegroundColor Yellow
Write-Host ""

try {
    git push origin main
    Write-Host ""
    Write-Host "✅ ✅ ✅ SUCCESS! ✅ ✅ ✅" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎉 Repository configuré avec succès!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Prochaines étapes:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Visitez votre repository: https://github.com/$githubUsername/alflight-manex" -ForegroundColor White
    Write-Host "2. Cliquez sur un fichier PDF" -ForegroundColor White
    Write-Host "3. Cliquez sur 'Raw'" -ForegroundColor White
    Write-Host "4. Copiez l'URL (ex: https://raw.githubusercontent.com/$githubUsername/alflight-manex/main/...)" -ForegroundColor White
    Write-Host "5. Utilisez cette URL dans le champ 'remoteUrl' de vos JSON" -ForegroundColor White
    Write-Host ""
    Write-Host "Exemple d'URL:" -ForegroundColor Cyan
    Write-Host "https://raw.githubusercontent.com/$githubUsername/alflight-manex/main/da40ng/MANEX_DA40NG_V2.0.pdf" -ForegroundColor Yellow
    Write-Host ""
} catch {
    Write-Host "❌ Erreur lors du push" -ForegroundColor Red
    Write-Host "Vérifiez votre connexion et vos identifiants GitHub" -ForegroundColor Yellow
}

Read-Host "`nAppuyez sur Entrée pour terminer"
