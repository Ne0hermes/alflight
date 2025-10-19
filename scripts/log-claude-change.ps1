# log-claude-change.ps1
# Script pour logger les modifications de Claude Code dans Google Sheets

param(
    [Parameter(Mandatory=$true)]
    [string]$FilePath,

    [Parameter(Mandatory=$true)]
    [ValidateSet('edit', 'write', 'delete')]
    [string]$Action,

    [string]$Summary = ""
)

# Configuration
$TRACKING_ENDPOINT = "http://localhost:3001/api/log"
$PROJECT_ROOT = "D:\Applicator\alflight"

# Obtenir les infos Git
try {
    $gitBranch = git -C $PROJECT_ROOT rev-parse --abbrev-ref HEAD 2>$null
    if (-not $gitBranch) { $gitBranch = "main" }
} catch {
    $gitBranch = "main"
}

# Déterminer le chemin relatif
$relativePath = $FilePath -replace [regex]::Escape($PROJECT_ROOT), "" -replace "^\\", ""

# Déterminer le composant
$component = "Unknown"
if ($relativePath -match "features[\\/]aircraft") { $component = "Aircraft Module" }
elseif ($relativePath -match "features[\\/]flight-wizard") { $component = "Flight Wizard" }
elseif ($relativePath -match "features[\\/]logbook") { $component = "Logbook" }
elseif ($relativePath -match "features[\\/]pilot") { $component = "Pilot Module" }
elseif ($relativePath -match "utils") { $component = "Utilities" }
elseif ($relativePath -match "core[\\/]stores") { $component = "State Management" }
elseif ($relativePath -match "server") { $component = "Backend" }
elseif ($relativePath -match "scripts") { $component = "Scripts" }

# Déterminer l'action et le résumé
$actionText = switch ($Action) {
    'edit' { "Code update - $component" }
    'write' { "File created - $component" }
    'delete' { "File deleted - $component" }
}

$summaryText = if ($Summary) { $Summary } else {
    switch ($Action) {
        'edit' { "Modification du fichier" }
        'write' { "Création du fichier" }
        'delete' { "Suppression du fichier" }
    }
}

$detailsText = "$Action effectué par Claude Code. Branch: $gitBranch"

# Créer le payload JSON
$payload = @{
    action = $actionText
    summary = $summaryText
    details = $detailsText
    component = $component
    files = $relativePath
    status = "completed"
} | ConvertTo-Json -Compress

# Envoyer au serveur de logging
try {
    $response = Invoke-RestMethod -Uri $TRACKING_ENDPOINT -Method Post -Body $payload -ContentType "application/json" -ErrorAction Stop
    Write-Host "✅ Logged: $actionText → $($response.range)" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to log: $actionText - $($_.Exception.Message)" -ForegroundColor Red
}
