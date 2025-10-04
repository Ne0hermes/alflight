# start-dev-tracked.ps1
# Script de demarrage automatique avec tracking pour le projet Alflight

Write-Host "Alflight - Demarrage avec tracking automatique" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# Fonction pour verifier si un port est utilise
function Test-Port {
    param([int]$Port)
    $connection = Test-NetConnection -ComputerName localhost -Port $Port -WarningAction SilentlyContinue
    return $connection.TcpTestSucceeded
}

# Fonction pour arreter un processus sur un port
function Stop-ProcessOnPort {
    param([int]$Port)
    $process = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
    if ($process) {
        Write-Host "Port $Port occupe, arret du processus..." -ForegroundColor Yellow
        Stop-Process -Id $process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
    }
}

# Verifier Node.js
Write-Host "Verification de Node.js..." -ForegroundColor Gray
$nodeVersion = node --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Node.js n'est pas installe ou n'est pas dans le PATH" -ForegroundColor Red
    exit 1
}
Write-Host "Node.js installe: $nodeVersion" -ForegroundColor Green

# Verifier npm
Write-Host "Verification de npm..." -ForegroundColor Gray
$npmVersion = npm --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "npm n'est pas installe" -ForegroundColor Red
    exit 1
}
Write-Host "npm installe: $npmVersion" -ForegroundColor Green

# Verifier les dependances
Write-Host ""
Write-Host "Verification des dependances..." -ForegroundColor Gray
if (-not (Test-Path "node_modules")) {
    Write-Host "node_modules manquant, installation..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Echec de l'installation des dependances" -ForegroundColor Red
        exit 1
    }
}
Write-Host "Dependances OK" -ForegroundColor Green

# Verifier chokidar (pour le tracker)
Write-Host "Verification de chokidar (tracking)..." -ForegroundColor Gray
$chokidar = npm list chokidar --depth=0 2>$null | Select-String "chokidar"
if (-not $chokidar) {
    Write-Host "chokidar manquant, installation..." -ForegroundColor Yellow
    npm install chokidar --save-dev
}
Write-Host "chokidar OK" -ForegroundColor Green

# Verifier les ports
Write-Host ""
Write-Host "Verification des ports..." -ForegroundColor Gray

# Port 3001 (Google Sheets Logger)
if (Test-Port -Port 3001) {
    Write-Host "Port 3001 deja utilise" -ForegroundColor Yellow
    $response = Read-Host "Voulez-vous arreter le processus existant? (o/N)"
    if ($response -eq 'o' -or $response -eq 'O') {
        Stop-ProcessOnPort -Port 3001
        Write-Host "Port 3001 libere" -ForegroundColor Green
    } else {
        Write-Host "Le logger Google Sheets pourrait ne pas demarrer" -ForegroundColor Yellow
    }
} else {
    Write-Host "Port 3001 disponible (Google Sheets Logger)" -ForegroundColor Green
}

# Port 4001 (Vite dev server)
if (Test-Port -Port 4001) {
    Write-Host "Port 4001 deja utilise" -ForegroundColor Yellow
    $response = Read-Host "Voulez-vous arreter le processus existant? (o/N)"
    if ($response -eq 'o' -or $response -eq 'O') {
        Stop-ProcessOnPort -Port 4001
        Write-Host "Port 4001 libere" -ForegroundColor Green
    } else {
        Write-Host "Vite pourrait ne pas demarrer" -ForegroundColor Yellow
    }
} else {
    Write-Host "Port 4001 disponible (Vite)" -ForegroundColor Green
}

# Verifier la connexion Internet (pour Google Sheets)
Write-Host ""
Write-Host "Verification de la connexion Internet..." -ForegroundColor Gray
$connection = Test-NetConnection -ComputerName google.com -WarningAction SilentlyContinue
if ($connection.PingSucceeded) {
    Write-Host "Connexion Internet OK" -ForegroundColor Green
} else {
    Write-Host "Pas de connexion Internet - Google Sheets pourrait ne pas fonctionner" -ForegroundColor Yellow
}

# Verifier les fichiers critiques
Write-Host ""
Write-Host "Verification des fichiers critiques..." -ForegroundColor Gray

$criticalFiles = @(
    "server/googleSheetsServer.js",
    "scripts/autoTracker.cjs",
    "package.json",
    "vite.config.js"
)

$missingFiles = @()
foreach ($file in $criticalFiles) {
    if (-not (Test-Path $file)) {
        $missingFiles += $file
        Write-Host "Manquant: $file" -ForegroundColor Red
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host ""
    Write-Host "Fichiers critiques manquants:" -ForegroundColor Red
    $missingFiles | ForEach-Object { Write-Host "   - $_" -ForegroundColor Red }
    exit 1
}
Write-Host "Tous les fichiers critiques presents" -ForegroundColor Green

# Resume
Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "Toutes les verifications passees!" -ForegroundColor Green
Write-Host ""
Write-Host "Le systeme va demarrer avec:" -ForegroundColor Cyan
Write-Host "   1. Vite (Frontend) sur http://localhost:4001" -ForegroundColor White
Write-Host "   2. Google Sheets Logger sur http://localhost:3001" -ForegroundColor White
Write-Host "   3. Auto Tracker (surveillance des fichiers)" -ForegroundColor White
Write-Host ""
Write-Host "Le tracker va automatiquement logger:" -ForegroundColor Cyan
Write-Host "   - Toutes les modifications de fichiers" -ForegroundColor White
Write-Host "   - Les ajouts et suppressions" -ForegroundColor White
Write-Host "   - Le composant/module concerne" -ForegroundColor White
Write-Host "   - Les fichiers modifies (colonne F)" -ForegroundColor White
Write-Host "   - Un resume et des details separes" -ForegroundColor White
Write-Host "   - Les infos Git (branche, auteur)" -ForegroundColor White
Write-Host ""
Write-Host "Structure Google Sheets (8 colonnes):" -ForegroundColor Cyan
Write-Host "   Date/Heure | Action | Composant | Resume | Details | Fichiers | Statut | Auteur" -ForegroundColor White
Write-Host ""
Write-Host "Logs Google Sheets:" -ForegroundColor Cyan
Write-Host "   https://docs.google.com/spreadsheets/d/1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k" -ForegroundColor White
Write-Host ""
Write-Host "Pour arreter: Ctrl+C" -ForegroundColor Yellow
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# Attendre confirmation
$response = Read-Host "Demarrer maintenant? (O/n)"
if ($response -eq 'n' -or $response -eq 'N') {
    Write-Host "Demarrage annule" -ForegroundColor Yellow
    exit 0
}

# Demarrer
Write-Host ""
Write-Host "Demarrage en cours..." -ForegroundColor Green
Write-Host ""

# Logger le demarrage de session
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$gitBranch = git rev-parse --abbrev-ref HEAD 2>$null
if (-not $gitBranch) { $gitBranch = "unknown" }

# Utiliser curl pour logger (compatible Windows) - Structure 8 colonnes
$logData = @{
    action = "Dev session started (auto)"
    summary = "Session de développement démarrée"
    details = "Session demarree via start-dev-tracked.ps1. Branch: $gitBranch. Tracking active."
    component = "Application"
    files = "start-dev-tracked.ps1"
    status = "active"
} | ConvertTo-Json

try {
    $null = Invoke-RestMethod -Uri "http://localhost:3001/api/log" -Method Post -Body $logData -ContentType "application/json" -ErrorAction SilentlyContinue
} catch {
    # Le serveur n'est pas encore demarre, c'est normal
}

# Lancer npm run dev:tracked
npm run dev:tracked
