# Script PowerShell pour afficher une notification de mise a jour Google Sheets
param(
    [string]$Action = "Mise a jour",
    [string]$Component = "Application",
    [string]$Files = "",
    [string]$Details = ""
)

# Couleurs
$SuccessColor = "Green"
$InfoColor = "Cyan"
$LabelColor = "Yellow"

# Afficher une boite de notification
function Show-UpdateNotification {
    param(
        [string]$Action,
        [string]$Component,
        [string]$Files,
        [string]$Details
    )

    $timestamp = Get-Date -Format "dd/MM/yyyy HH:mm:ss"

    Write-Host ""
    Write-Host "================================================================================" -ForegroundColor $SuccessColor
    Write-Host "  LOG GOOGLE SHEETS ENREGISTRE                                                " -ForegroundColor $SuccessColor
    Write-Host "================================================================================" -ForegroundColor $SuccessColor
    Write-Host "  Date/Heure: $timestamp" -ForegroundColor $InfoColor
    Write-Host "  Action:     $Action" -ForegroundColor $InfoColor
    Write-Host "  Composant:  $Component" -ForegroundColor $InfoColor

    if ($Files) {
        Write-Host "  Fichiers:   $Files" -ForegroundColor $InfoColor
    }

    if ($Details -and $Details.Length -gt 0) {
        Write-Host "  Details:    $Details" -ForegroundColor $InfoColor
    }

    Write-Host "================================================================================" -ForegroundColor $SuccessColor
    Write-Host "  Lien: https://docs.google.com/spreadsheets/d/1Y26_Zf7-jHPgpjWa...            " -ForegroundColor $LabelColor
    Write-Host "================================================================================" -ForegroundColor $SuccessColor
    Write-Host ""
}

# Afficher la notification
Show-UpdateNotification -Action $Action -Component $Component -Files $Files -Details $Details

# Son de notification (optionnel) - DESACTIVE pour eviter les beeps repetitifs
# Decommentez pour reactiver:
# try {
#     [console]::beep(600, 100)  # Frequence plus basse (600Hz) et plus court (100ms)
# } catch {
#     # Ignore si le son ne peut pas etre joue
# }

# Ecrire aussi dans un fichier log local
$logFile = Join-Path $PSScriptRoot "..\tracking\claude-updates.log"
$logDir = Split-Path $logFile -Parent

if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$logEntry = "[$timestamp] $Action | $Component | $Files"
Add-Content -Path $logFile -Value $logEntry -Encoding UTF8

Write-Host "Log local sauvegarde: $logFile" -ForegroundColor DarkGray
Write-Host ""
