# Test simple API VAC
Write-Host "Test API VAC" -ForegroundColor Cyan

# Test téléchargement LFPG
$body = '{"icao":"LFPG"}'

Write-Host "Test téléchargement LFPG..." -ForegroundColor Yellow
Invoke-RestMethod -Uri "http://localhost:3002/api/vac-download" -Method POST -ContentType "application/json" -Body $body