# .claude/hooks/on-file-delete.ps1
# Hook appelé automatiquement après chaque suppression de fichier par Claude Code

param(
    [string]$FilePath
)

$trackScript = Join-Path (Split-Path $PSScriptRoot -Parent) "..\scripts\log-claude-change.ps1"

if (Test-Path $trackScript) {
    & $trackScript -FilePath $FilePath -Action "delete" -Summary "Fichier supprimé par Claude Code"
}
