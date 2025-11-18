# Script PowerShell pour créer la table flight_plans dans Supabase
# Ce script affiche le SQL à exécuter manuellement

Write-Host "🚀 Configuration de la table flight_plans dans Supabase" -ForegroundColor Cyan
Write-Host ""

$sqlFile = Join-Path $PSScriptRoot "..\supabase-flight-plans-setup.sql"

if (-not (Test-Path $sqlFile)) {
    Write-Host "❌ Fichier SQL introuvable: $sqlFile" -ForegroundColor Red
    exit 1
}

$sqlContent = Get-Content $sqlFile -Raw

Write-Host "📊 Table à créer: flight_plans" -ForegroundColor Green
Write-Host "📍 Projet Supabase: https://bgmscwckawgybymbimga.supabase.co" -ForegroundColor Yellow
Write-Host ""
Write-Host "📋 INSTRUCTIONS:" -ForegroundColor Cyan
Write-Host "1. Ouvrez votre projet Supabase dans le navigateur"
Write-Host "2. Cliquez sur 'SQL Editor' dans le menu de gauche"
Write-Host "3. Cliquez sur '+ New query'"
Write-Host "4. Copiez-collez le SQL ci-dessous:"
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host $sqlContent -ForegroundColor White
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host ""
Write-Host "5. Cliquez sur 'Run' ou appuyez sur Ctrl+Enter" -ForegroundColor Green
Write-Host ""
Write-Host "✅ Une fois exécuté, la table flight_plans sera créée avec:" -ForegroundColor Green
Write-Host "   - Toutes les colonnes nécessaires pour les plans de vol"
Write-Host "   - Index pour recherche rapide"
Write-Host "   - Politiques RLS (lecture/écriture publique)"
Write-Host ""

# Copier le SQL dans le presse-papier si possible
$sqlContent | Set-Clipboard -ErrorAction SilentlyContinue
if ($?) {
    Write-Host "📋 Le SQL a été copié dans le presse-papier!" -ForegroundColor Green
    Write-Host "   Vous pouvez le coller directement dans Supabase (Ctrl+V)" -ForegroundColor Yellow
} else {
    Write-Host "⚠️  Impossible de copier dans le presse-papier automatiquement" -ForegroundColor Yellow
    Write-Host "   Copiez manuellement le SQL ci-dessus" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🌐 Ouvrir Supabase maintenant? (O/N)" -ForegroundColor Cyan -NoNewline
$response = Read-Host " "

if ($response -eq "O" -or $response -eq "o") {
    Start-Process "https://bgmscwckawgybymbimga.supabase.co/project/_/sql"
    Write-Host "✅ Navigateur ouvert sur SQL Editor" -ForegroundColor Green
}

Write-Host ""
Write-Host "✅ Script terminé" -ForegroundColor Green
