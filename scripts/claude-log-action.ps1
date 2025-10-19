# Helper pour que Claude Code envoie ses resumes a Google Sheets
# Usage: .\claude-log-action.ps1 -Summary "Ce que j'ai fait" -Details "Details complets"

param(
    [Parameter(Mandatory=$true)]
    [string]$Summary,

    [string]$Details = "",
    [string]$Component = "Claude Code Assistant",
    [string]$Files = "",
    [string]$Status = "completed"
)

$body = @{
    action = "CLAUDE_CODE_ACTION"
    component = $Component
    summary = $Summary
    details = $Details
    files = $Files
    status = $Status
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod `
        -Uri "http://localhost:3001/api/log" `
        -Method Post `
        -ContentType "application/json; charset=utf-8" `
        -Body $body

    Write-Host "OK Action enregistree dans Google Sheets" -ForegroundColor Green
    Write-Host "Lien: https://docs.google.com/spreadsheets/d/1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k" -ForegroundColor Cyan

    return $true
} catch {
    Write-Host "ERREUR: $_" -ForegroundColor Red
    return $false
}
