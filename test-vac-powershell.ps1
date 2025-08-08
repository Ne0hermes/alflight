# Script PowerShell pour tester l'API VAC

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "    Test API VAC - PowerShell" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Vérifier l'état du serveur
Write-Host "1. Test de santé du serveur..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3002/health" -Method GET
    Write-Host "✅ Serveur en ligne!" -ForegroundColor Green
    Write-Host "   Service: $($health.service)"
    Write-Host "   AIRAC: $($health.airac)"
} catch {
    Write-Host "❌ Serveur hors ligne!" -ForegroundColor Red
    Write-Host "   Erreur: $_"
}
Write-Host ""

# Test 2: Info AIRAC
Write-Host "2. Informations AIRAC..." -ForegroundColor Yellow
try {
    $airac = Invoke-RestMethod -Uri "http://localhost:3002/api/airac-info" -Method GET
    Write-Host "📅 Cycle AIRAC actuel: $($airac.current)" -ForegroundColor Green
    Write-Host "   Prochain changement dans $($airac.daysUntilChange) jours"
} catch {
    Write-Host "❌ Erreur AIRAC: $_" -ForegroundColor Red
}
Write-Host ""

# Test 3: Télécharger une carte VAC
Write-Host "3. Test téléchargement carte VAC..." -ForegroundColor Yellow
$icao = Read-Host "   Entrez un code ICAO (ex: LFPG)"
if ($icao -eq "") { $icao = "LFPG" }

$body = @{
    icao = $icao.ToUpper()
} | ConvertTo-Json

try {
    Write-Host "   Téléchargement de $($icao.ToUpper())..." -ForegroundColor Cyan
    $response = Invoke-WebRequest -Uri "http://localhost:3002/api/vac-download" `
                                  -Method POST `
                                  -ContentType "application/json" `
                                  -Body $body `
                                  -ErrorAction Stop
    
    if ($response.StatusCode -eq 200) {
        # Sauvegarder le PDF
        $filename = "$($icao.ToUpper())_VAC.pdf"
        [System.IO.File]::WriteAllBytes($filename, $response.Content)
        Write-Host "✅ Carte téléchargée: $filename" -ForegroundColor Green
        Write-Host "   Taille: $([math]::Round($response.Content.Length / 1024, 1)) KB"
        
        # Ouvrir le PDF
        $open = Read-Host "   Voulez-vous ouvrir le PDF? (O/N)"
        if ($open -eq "O" -or $open -eq "o") {
            Start-Process $filename
        }
    }
} catch {
    # Si c'est une erreur 404, afficher le message du serveur
    if ($_.Exception.Response.StatusCode -eq 404) {
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $errorBody = $reader.ReadToEnd() | ConvertFrom-Json
            Write-Host "❌ $($errorBody.error)" -ForegroundColor Red
            Write-Host "   $($errorBody.suggestion)" -ForegroundColor Yellow
        } catch {
            Write-Host "❌ Carte non trouvée" -ForegroundColor Red
        }
    } else {
        Write-Host "❌ Erreur: $_" -ForegroundColor Red
    }
}
Write-Host ""

# Menu
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Options:" -ForegroundColor Yellow
Write-Host "1. Vider le cache"
Write-Host "2. Tester un autre ICAO"
Write-Host "3. Quitter"
$choice = Read-Host "Choix"

switch ($choice) {
    "1" {
        try {
            $result = Invoke-RestMethod -Uri "http://localhost:3002/api/clear-cache" -Method POST
            Write-Host "✅ $($result.message)" -ForegroundColor Green
            Write-Host "   Fichiers supprimés: $($result.filesDeleted)"
        } catch {
            Write-Host "❌ Erreur: $_" -ForegroundColor Red
        }
    }
    "2" {
        & $PSCommandPath
    }
    default {
        Write-Host "Au revoir!" -ForegroundColor Cyan
    }
}