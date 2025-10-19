# auto-track.ps1
# Script pour automatiquement tracker les modifications via un wrapper

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('Write', 'Edit', 'Delete')]
    [string]$Operation,

    [Parameter(Mandatory=$true)]
    [string]$FilePath,

    [string]$Summary = ""
)

# Mapper l'opération vers l'action
$action = switch ($Operation) {
    'Write' { 'write' }
    'Edit' { 'edit' }
    'Delete' { 'delete' }
}

# Appeler le script de tracking
$trackScript = Join-Path $PSScriptRoot "track-change.ps1"
& $trackScript -File $FilePath -Action $action -Summary $Summary

Write-Host "✅ Tracking synchronisé pour: $FilePath [$Operation]" -ForegroundColor Green
