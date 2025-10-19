# START_SESSION.ps1
# Script PowerShell pour démarrer une session Claude Code avec tracking Google Sheets

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "  DEMARRAGE SESSION CLAUDE CODE - TRACKING GOOGLE SHEETS" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location "D:\Applicator\alflight"

# Vérifier si le serveur est déjà actif
Write-Host "[1/3] Verification du serveur sur le port 3001..." -ForegroundColor Yellow

$serverRunning = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue

if ($serverRunning) {
    Write-Host "  ✅ Status: Serveur deja actif sur le port 3001" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "  ℹ️  Status: Port 3001 libre" -ForegroundColor Gray
    Write-Host ""

    Write-Host "[2/3] Demarrage du serveur Google Sheets Logger..." -ForegroundColor Yellow

    # Démarrer le serveur en arrière-plan
    Start-Process -NoNewWindow -FilePath "node" -ArgumentList "server/googleSheetsServer.js"
    Start-Sleep -Seconds 3

    Write-Host "  ✅ Status: Serveur demarre en arriere-plan" -ForegroundColor Green
    Write-Host ""
}

# Vérification de la connexion
Write-Host "[3/3] Verification de la connexion..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/health" -Method Get -TimeoutSec 5
    Write-Host "  ✅ Status: Serveur operationnel" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Response:" -ForegroundColor Gray
    Write-Host "  $($response | ConvertTo-Json -Compress)" -ForegroundColor Gray
} catch {
    Write-Host "  ❌ ERREUR: Serveur non accessible" -ForegroundColor Red
    Write-Host "  Verifiez les logs dans la console Node.js" -ForegroundColor Red
}

Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "  SESSION PRETE" -ForegroundColor Green
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "  Serveur:     http://localhost:3001" -ForegroundColor White
Write-Host "  Spreadsheet: https://docs.google.com/spreadsheets/d/1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k" -ForegroundColor White
Write-Host "  Logs:        tracking/claude-updates.log" -ForegroundColor White
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Toutes vos modifications seront automatiquement synchronisees avec Google Sheets" -ForegroundColor Green
Write-Host ""
