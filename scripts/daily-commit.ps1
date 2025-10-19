# Script de commit automatique quotidien
# À exécuter chaque jour à 22h via Windows Task Scheduler

param(
    [string]$CommitMessage = "Sauvegarde automatique quotidienne - $(Get-Date -Format 'yyyy-MM-dd')"
)

$ProjectRoot = "D:\Applicator\alflight"
Set-Location $ProjectRoot

Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "  SAUVEGARDE QUOTIDIENNE AUTOMATIQUE" -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier s'il y a des changements
$status = git status --porcelain

if ($status) {
    Write-Host "✅ Changements détectés. Création du commit..." -ForegroundColor Green

    # Ajouter tous les fichiers
    git add -A

    # Créer le commit
    $commitResult = git commit -m $CommitMessage 2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Commit créé avec succès" -ForegroundColor Green

        # Push vers le remote
        Write-Host "📤 Push vers GitHub..." -ForegroundColor Yellow
        $pushResult = git push 2>&1

        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Push réussi !" -ForegroundColor Green

            # Logger dans Google Sheets
            $logPayload = @{
                action = "COMMIT_AUTOMATIQUE"
                component = "Git Automation"
                summary = "Sauvegarde quotidienne réussie"
                details = "Commit et push automatique effectués à $(Get-Date -Format 'HH:mm:ss')"
                status = "completed"
            } | ConvertTo-Json

            try {
                Invoke-RestMethod -Uri "http://localhost:3001/api/log" `
                    -Method Post `
                    -ContentType "application/json" `
                    -Body $logPayload `
                    -ErrorAction SilentlyContinue | Out-Null
                Write-Host "📊 Enregistré dans Google Sheets" -ForegroundColor Cyan
            } catch {
                Write-Host "⚠️  Google Sheets non disponible" -ForegroundColor Yellow
            }

        } else {
            Write-Host "❌ Erreur lors du push: $pushResult" -ForegroundColor Red
            exit 1
        }

    } else {
        Write-Host "❌ Erreur lors du commit: $commitResult" -ForegroundColor Red
        exit 1
    }

} else {
    Write-Host "ℹ️  Aucun changement à commiter" -ForegroundColor Yellow

    # Vérifier si un commit a été fait aujourd'hui
    $todayCommits = git log --since="midnight" --oneline

    if ($todayCommits) {
        Write-Host "✅ Un commit a déjà été fait aujourd'hui :" -ForegroundColor Green
        Write-Host $todayCommits
    } else {
        Write-Host "⚠️  Aucun commit aujourd'hui et aucun changement détecté" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "  Derniers commits :" -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Cyan
git log --oneline -5
Write-Host ""
