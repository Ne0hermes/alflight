# Script de configuration de la tâche planifiée Windows
# Exécuter UNE SEULE FOIS pour installer le commit quotidien à 22h

$ErrorActionPreference = "Stop"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  CONFIGURATION TÂCHE PLANIFIÉE" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Paramètres
$TaskName = "AlFlight-Daily-Commit-22h"
$ScriptPath = "D:\Applicator\alflight\scripts\daily-auto-commit.ps1"
$Time = "22:00"

# Vérifier que le script existe
if (-not (Test-Path $ScriptPath)) {
    Write-Host "❌ Script non trouvé : $ScriptPath`n" -ForegroundColor Red
    exit 1
}

# Supprimer la tâche si elle existe déjà
$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "🗑️  Suppression de la tâche existante...`n" -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Créer l'action
$Action = New-ScheduledTaskAction `
    -Execute "PowerShell.exe" `
    -Argument "-ExecutionPolicy Bypass -WindowStyle Normal -File `"$ScriptPath`""

# Créer le déclencheur (tous les jours à 22h)
$Trigger = New-ScheduledTaskTrigger -Daily -At $Time

# Paramètres de la tâche
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10)

# Enregistrer la tâche
Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Description "Commit et push automatique quotidien du projet AlFlight à 22h" `
    -User $env:USERNAME `
    -RunLevel Highest

Write-Host "✅ Tâche planifiée créée avec succès !`n" -ForegroundColor Green
Write-Host "📋 Nom de la tâche : $TaskName" -ForegroundColor Cyan
Write-Host "⏰ Heure d'exécution : $Time (tous les jours)" -ForegroundColor Cyan
Write-Host "📄 Script exécuté : $ScriptPath`n" -ForegroundColor Cyan

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  COMMANDES UTILES" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "🔍 Voir la tâche :" -ForegroundColor Yellow
Write-Host "   Get-ScheduledTask -TaskName '$TaskName'`n" -ForegroundColor Gray

Write-Host "▶️  Exécuter maintenant (test) :" -ForegroundColor Yellow
Write-Host "   Start-ScheduledTask -TaskName '$TaskName'`n" -ForegroundColor Gray

Write-Host "🗑️  Supprimer la tâche :" -ForegroundColor Yellow
Write-Host "   Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false`n" -ForegroundColor Gray

Write-Host "📊 Voir l'historique d'exécution :" -ForegroundColor Yellow
Write-Host "   Get-ScheduledTask -TaskName '$TaskName' | Get-ScheduledTaskInfo`n" -ForegroundColor Gray

Write-Host "========================================`n" -ForegroundColor Cyan

# Proposer un test
$test = Read-Host "Voulez-vous tester maintenant ? (o/n)"
if ($test -eq "o" -or $test -eq "O") {
    Write-Host "`n🚀 Exécution du test...`n" -ForegroundColor Yellow
    Start-ScheduledTask -TaskName $TaskName
    Start-Sleep -Seconds 2
    Get-ScheduledTask -TaskName $TaskName | Get-ScheduledTaskInfo
}
