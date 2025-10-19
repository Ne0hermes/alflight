# Script de commit/push automatique quotidien
# Exécution programmée : tous les jours à 22h00

$ErrorActionPreference = "Stop"
$ProjectRoot = "D:\Applicator\alflight"

Set-Location $ProjectRoot

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  COMMIT AUTOMATIQUE QUOTIDIEN - 22H" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Obtenir la date
$today = Get-Date -Format "yyyy-MM-dd"
$time = Get-Date -Format "HH:mm"

# Vérifier les changements
$changes = git status --porcelain

if ($changes) {
    Write-Host "✅ Changements détectés`n" -ForegroundColor Green

    # Compter les fichiers modifiés
    $fileCount = ($changes | Measure-Object).Count
    Write-Host "📝 $fileCount fichier(s) modifié(s)`n" -ForegroundColor Yellow

    # Ajouter tous les fichiers
    git add -A

    # Message de commit
    $commitMsg = "Sauvegarde automatique quotidienne - $today à $time"

    # Commit
    git commit -m $commitMsg

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Commit créé : $commitMsg`n" -ForegroundColor Green

        # Push
        Write-Host "📤 Push vers GitHub...`n" -ForegroundColor Yellow
        git push

        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Push réussi !`n" -ForegroundColor Green

            # Log dans Google Sheets
            $body = @{
                action = "COMMIT_QUOTIDIEN_22H"
                component = "Sauvegarde automatique"
                summary = "Commit automatique effectué"
                details = "$fileCount fichier(s) sauvegardé(s) et pushé(s) vers GitHub"
                files = "Voir git log"
                status = "completed"
            } | ConvertTo-Json

            try {
                Invoke-RestMethod -Uri "http://localhost:3001/api/log" `
                    -Method Post `
                    -ContentType "application/json" `
                    -Body $body | Out-Null
                Write-Host "📊 Enregistré dans Google Sheets`n" -ForegroundColor Cyan
            } catch {
                Write-Host "⚠️  Impossible d'enregistrer dans Google Sheets`n" -ForegroundColor Yellow
            }

        } else {
            Write-Host "❌ Erreur lors du push`n" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "❌ Erreur lors du commit`n" -ForegroundColor Red
        exit 1
    }

} else {
    Write-Host "ℹ️  Aucun changement à commiter`n" -ForegroundColor Yellow

    # Vérifier si commit aujourd'hui
    $todayCommit = git log --since="00:00" --until="23:59" --oneline

    if ($todayCommit) {
        Write-Host "✅ Commit déjà effectué aujourd'hui :`n" -ForegroundColor Green
        Write-Host $todayCommit -ForegroundColor Gray
    } else {
        Write-Host "⚠️  ATTENTION : Aucun commit aujourd'hui !`n" -ForegroundColor Red
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  5 DERNIERS COMMITS" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan
git log --oneline -5
Write-Host ""
