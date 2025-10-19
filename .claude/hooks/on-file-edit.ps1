# .claude/hooks/on-file-edit.ps1
# Hook appelé automatiquement après chaque modification de fichier par Claude Code

param(
    [string]$FilePath
)

$trackScript = Join-Path (Split-Path $PSScriptRoot -Parent) "..\scripts\log-claude-change.ps1"

if (Test-Path $trackScript) {
    & $trackScript -FilePath $FilePath -Action "edit" -Summary "Fichier modifié par Claude Code"
}
