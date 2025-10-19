# track-change.ps1
# Wrapper simplifié pour logger les changements

param(
    [Parameter(Mandatory=$true, Position=0)]
    [string]$File,

    [Parameter(Position=1)]
    [string]$Action = "edit",

    [Parameter(Position=2)]
    [string]$Summary = ""
)

$scriptPath = Join-Path $PSScriptRoot "log-claude-change.ps1"
$fullPath = if ([System.IO.Path]::IsPathRooted($File)) { $File } else {
    Join-Path "D:\Applicator\alflight" $File
}

& $scriptPath -FilePath $fullPath -Action $Action -Summary $Summary
