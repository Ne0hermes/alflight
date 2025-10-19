# .claude/hooks/on-file-write.ps1
# Hook appelé automatiquement après chaque écriture de fichier par Claude Code

param(
    [string]$FilePath
)

$trackScript = Join-Path (Split-Path $PSScriptRoot -Parent) "..\scripts\log-claude-change.ps1"

if (Test-Path $trackScript) {
    & $trackScript -FilePath $FilePath -Action "write" -Summary "Fichier créé par Claude Code"
}
