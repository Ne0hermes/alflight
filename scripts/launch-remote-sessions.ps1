# launch-remote-sessions.ps1
# Lance plusieurs sessions Claude Code avec --remote-control dans des onglets Windows Terminal
# Usage : .\launch-remote-sessions.ps1
#         .\launch-remote-sessions.ps1 -Sessions "W&B","Perf"  (sélection partielle)

param(
    [string[]]$Sessions = @()  # vide = toutes les sessions
)

# ─── CONFIGURATION : ajoute / retire tes sessions ici ──────────────────────────
$AllSessions = @(
    @{ Name = "AlFlight - W&B";         Dir = "D:\Applicator\alflight" },
    @{ Name = "AlFlight - Performance"; Dir = "D:\Applicator\alflight" },
    @{ Name = "AlFlight - Fuel";        Dir = "D:\Applicator\alflight" },
    @{ Name = "AlFlight - UI/Charte";   Dir = "D:\Applicator\alflight" },
    @{ Name = "AlFlight - Main";        Dir = "D:\Applicator\alflight" }
)
# ───────────────────────────────────────────────────────────────────────────────

# Filtre si des noms sont passés en paramètre
$ToLaunch = if ($Sessions.Count -gt 0) {
    $AllSessions | Where-Object { $s = $_.Name; $Sessions | Where-Object { $s -like "*$_*" } }
} else {
    $AllSessions
}

if ($ToLaunch.Count -eq 0) {
    Write-Host "Aucune session trouvée. Vérifie les noms passés en paramètre." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   Lancement de $($ToLaunch.Count) session(s) remote Claude Code" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan

# Vérifie que wt (Windows Terminal) est disponible
$wt = Get-Command wt -ErrorAction SilentlyContinue
if (-not $wt) {
    Write-Host "Windows Terminal (wt) non trouvé. Utilisation de PowerShell classique." -ForegroundColor Yellow
    foreach ($s in $ToLaunch) {
        Write-Host "  → Lancement : $($s.Name)" -ForegroundColor Green
        Start-Process powershell -ArgumentList '-NoExit', '-Command',
            "Set-Location '$($s.Dir)'; Write-Host 'Session : $($s.Name)' -ForegroundColor Cyan; claude --remote-control '$($s.Name)'"
        Start-Sleep -Milliseconds 800
    }
} else {
    # Construit la commande wt avec un onglet par session
    $first = $ToLaunch[0]
    $cmd = "wt -d `"$($first.Dir)`" powershell -NoExit -Command `"Write-Host 'Session : $($first.Name)' -ForegroundColor Cyan; claude --remote-control '$($first.Name)'`""

    foreach ($s in $ToLaunch | Select-Object -Skip 1) {
        $cmd += " `; new-tab -d `"$($s.Dir)`" powershell -NoExit -Command `"Write-Host 'Session : $($s.Name)' -ForegroundColor Cyan; claude --remote-control '$($s.Name)'`""
    }

    Write-Host ""
    foreach ($s in $ToLaunch) {
        Write-Host "  ✓ $($s.Name)  →  $($s.Dir)" -ForegroundColor Green
    }
    Write-Host ""
    Write-Host "Ouverture des onglets Windows Terminal..." -ForegroundColor DarkGray

    Invoke-Expression $cmd
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Sessions lancées. URLs remote affichées dans chaque onglet." -ForegroundColor Cyan
Write-Host "  Scanne le QR code ou copie l'URL pour te connecter." -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
