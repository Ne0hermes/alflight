# Script PowerShell pour envoyer un rapport détaillé des modifications à Google Sheets
# Usage: .\send-modification-report.ps1 -ModificationSummary "Description des modifications"

param(
    [Parameter(Mandatory=$true)]
    [string]$ModificationSummary,

    [Parameter(Mandatory=$false)]
    [string[]]$FilesModified = @(),

    [Parameter(Mandatory=$false)]
    [string]$Category = "Claude Code Modifications",

    [Parameter(Mandatory=$false)]
    [string]$Status = "success"
)

# Configuration
$GOOGLE_SHEETS_ENDPOINT = "http://localhost:3001/api/log"
$TIMESTAMP = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

# Couleurs pour l'affichage
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

# Construire le rapport détaillé
$detailsObject = @{
    timestamp = $TIMESTAMP
    summary = $ModificationSummary
    files_modified = $FilesModified
    status = $Status
    environment = "Development"
    tool = "Claude Code (PowerShell)"
}

$detailsJson = $detailsObject | ConvertTo-Json -Compress

# Préparer le payload pour Google Sheets
$payload = @{
    action = "CODE_MODIFICATION"
    component = "Claude Code Assistant"
    summary = $ModificationSummary
    details = $detailsJson
    status = $Status
} | ConvertTo-Json

Write-ColorOutput "`n========================================" "Cyan"
Write-ColorOutput "📊 ENVOI RAPPORT GOOGLE SHEETS" "Cyan"
Write-ColorOutput "========================================" "Cyan"
Write-ColorOutput "Timestamp:    $TIMESTAMP" "Gray"
Write-ColorOutput "Action:       CODE_MODIFICATION" "Gray"
Write-ColorOutput "Summary:      $ModificationSummary" "Yellow"

if ($FilesModified.Count -gt 0) {
    Write-ColorOutput "`nFichiers modifiés:" "Gray"
    foreach ($file in $FilesModified) {
        Write-ColorOutput "  - $file" "DarkGray"
    }
}

Write-ColorOutput "`nEnvoi vers: $GOOGLE_SHEETS_ENDPOINT" "Gray"

# Envoyer à Google Sheets
try {
    $response = Invoke-RestMethod -Uri $GOOGLE_SHEETS_ENDPOINT `
                                   -Method POST `
                                   -ContentType "application/json" `
                                   -Body $payload `
                                   -TimeoutSec 10

    Write-ColorOutput "`n✅ SUCCÈS - Rapport envoyé à Google Sheets" "Green"
    Write-ColorOutput "   Range: $($response.range)" "Green"
    Write-ColorOutput "   Spreadsheet: $($response.spreadsheetId)" "DarkGreen"

    # Log local pour historique
    $logEntry = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ✅ Rapport envoyé: $ModificationSummary"
    Add-Content -Path "D:\Applicator\alflight\tracking\claude-updates.log" -Value $logEntry

    Write-ColorOutput "========================================`n" "Cyan"

    return $true
}
catch {
    Write-ColorOutput "`n❌ ERREUR - Échec d'envoi du rapport" "Red"
    Write-ColorOutput "   Message: $($_.Exception.Message)" "Red"

    # Log local de l'erreur
    $errorEntry = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ❌ Erreur envoi: $($_.Exception.Message)"
    Add-Content -Path "D:\Applicator\alflight\tracking\claude-updates.log" -Value $errorEntry

    Write-ColorOutput "========================================`n" "Cyan"

    return $false
}
