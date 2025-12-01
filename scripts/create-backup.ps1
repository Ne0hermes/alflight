# Script de création de backup ALFlight
$date = Get-Date -Format 'yyyy-MM-dd_HHmm'
$backupDir = 'D:\Applicator\backups'
$backupName = "alflight_backup_$date"
$backupPath = Join-Path $backupDir $backupName

# Créer le dossier backups s'il n'existe pas
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
}

Write-Host "Creation du backup: $backupName" -ForegroundColor Cyan

# Copier le projet (exclure node_modules et dist)
Write-Host "Copie des fichiers en cours..." -ForegroundColor Yellow
$excludeDirs = @('node_modules', 'dist', '.git')

# Utiliser robocopy pour exclure les dossiers
robocopy "D:\Applicator\alflight" $backupPath /E /XD node_modules dist .git /NFL /NDL /NJH /NJS /NC /NS /NP

# Créer un fichier info
$infoContent = @"
ALFlight Backup
===============
Date: $(Get-Date)
Commit: 3e03b53
Branch: main

Description:
- Configuration profil obligatoire
- UI improvements
- API Route Vercel pour OpenAIP
- Nombreuses ameliorations UI/UX

Contenu:
- Code source complet (sans node_modules/dist/.git)
"@

$infoContent | Out-File -FilePath (Join-Path $backupPath 'BACKUP_INFO.txt') -Encoding UTF8

# Compresser le backup
Write-Host "Compression en cours..." -ForegroundColor Yellow
$zipPath = "$backupPath.zip"
Compress-Archive -Path $backupPath -DestinationPath $zipPath -Force

# Supprimer le dossier non compressé
Remove-Item -Path $backupPath -Recurse -Force

Write-Host ""
Write-Host "Backup cree avec succes!" -ForegroundColor Green
Write-Host "Fichier: $zipPath" -ForegroundColor Cyan

# Afficher les infos du fichier
$fileInfo = Get-Item $zipPath
Write-Host "Taille: $([math]::Round($fileInfo.Length / 1MB, 2)) MB" -ForegroundColor Cyan
Write-Host "Date: $($fileInfo.LastWriteTime)" -ForegroundColor Cyan
