# Script per eseguire test E2E Multi-Tenant
# Avvia server e test in processi separati

Write-Host "🚀 Avvio Test E2E Multi-Tenant" -ForegroundColor Cyan
Write-Host ""

# Percorso backend robusto: cartella dove si trova questo script
$backendPath = $PSScriptRoot
Set-Location $backendPath

# Avvia server in background
Write-Host "📡 Avvio server backend..." -ForegroundColor Yellow
$serverProcess = Start-Process -FilePath "node" -ArgumentList "src/server.js" -PassThru -NoNewWindow -RedirectStandardOutput ".\logs\server-out.log" -RedirectStandardError ".\logs\server-err.log"

# Aspetta che il server sia pronto
Write-Host "⏳ Attesa avvio server (5 secondi)..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Verifica che il server risponda
try {
    $response = Invoke-WebRequest -Uri "http://localhost:10443/api/v1/health" -ErrorAction Stop
    Write-Host "✅ Server pronto!" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Server potrebbe non essere pronto, procedo comunque..." -ForegroundColor Yellow
}

Write-Host ""

# Esegui test
Write-Host "🧪 Esecuzione test..." -ForegroundColor Cyan
node tests/test-multi-tenant.js

# Cattura exit code
$testExitCode = $LASTEXITCODE

Write-Host ""

# Termina server
Write-Host "🛑 Arresto server..." -ForegroundColor Yellow
Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue

Write-Host ""
if ($testExitCode -eq 0) {
    Write-Host "✅ Test completati con successo!" -ForegroundColor Green
} else {
    Write-Host "❌ Test falliti (exit code: $testExitCode)" -ForegroundColor Red
}

exit $testExitCode
