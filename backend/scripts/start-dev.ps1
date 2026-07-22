# Avvio backend in sviluppo locale
# Uso (dalla root del repo): .\backend\scripts\start-dev.ps1
#
# - Imposta la directory su backend/
# - NODE_PATH: di default non serve (npm start risolve i moduli da backend/node_modules).
#   Se in futuro servisse un path extra, decommentare la riga $env:NODE_PATH sotto.
# - Richiede: npm install gia eseguito in backend/

$ErrorActionPreference = 'Stop'
$BackendRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $BackendRoot

# $env:NODE_PATH = Join-Path $BackendRoot 'node_modules'

if (-not (Test-Path (Join-Path $BackendRoot 'node_modules'))) {
    Write-Host 'node_modules mancante: esegui prima "npm install" in backend/' -ForegroundColor Yellow
}

npm start
