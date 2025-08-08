# Script PowerShell pour notifications sonores Claude
# Joue un son quand vous appuyez sur une touche

Write-Host "🔔 Notification Claude activée" -ForegroundColor Green
Write-Host "Appuyez sur [Espace] quand Claude a fini une tâche" -ForegroundColor Yellow
Write-Host "Appuyez sur [Q] pour quitter" -ForegroundColor Red

while ($true) {
    $key = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    
    if ($key.Character -eq ' ') {
        # Jouer le son de notification Windows
        [System.Media.SystemSounds]::Exclamation.Play()
        
        # Alternative : Son personnalisé
        # [console]::beep(1000, 500)
        
        # Afficher une notification toast (Windows 10+)
        $notify = New-Object System.Windows.Forms.NotifyIcon
        $notify.Icon = [System.Drawing.SystemIcons]::Information
        $notify.Visible = $true
        $notify.ShowBalloonTip(3000, "Claude", "Tâche terminée!", [System.Windows.Forms.ToolTipIcon]::Info)
        
        Write-Host "✅ Notification envoyée!" -ForegroundColor Green
    }
    elseif ($key.Character -eq 'q' -or $key.Character -eq 'Q') {
        Write-Host "`n👋 Au revoir!" -ForegroundColor Cyan
        break
    }
}