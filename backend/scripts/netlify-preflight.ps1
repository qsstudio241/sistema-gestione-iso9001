# Verifica accesso Netlify CLI da Windows (Cursor desktop).
# Uso: .\backend\scripts\netlify-preflight.ps1
# L'agente deve eseguirlo PRIMA di dichiarare "netlify non disponibile" o "Not logged in".

$ErrorActionPreference = 'Stop'

Write-Host '=== SGQ Netlify preflight (Windows) ===' -ForegroundColor Cyan

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$localFile = Join-Path $repoRoot 'backend\config\.netlify.local.ps1'

if (Test-Path -LiteralPath $localFile) {
    Write-Host '  OK - backend/config/.netlify.local.ps1 presente' -ForegroundColor Green
    . $localFile
} else {
    Write-Host '  MANCA - backend/config/.netlify.local.ps1' -ForegroundColor Red
    Write-Host '  Copia da backend/config/.netlify.local.ps1.example e incolla NETLIFY_AUTH_TOKEN (fuori chat).' -ForegroundColor Yellow
    exit 1
}

$token = [string]$env:NETLIFY_AUTH_TOKEN
if ([string]::IsNullOrWhiteSpace($token)) {
    Write-Host '  ERRORE - NETLIFY_AUTH_TOKEN vuoto in .netlify.local.ps1' -ForegroundColor Red
    exit 1
}

$netlifyCmd = Get-Command netlify -ErrorAction SilentlyContinue
if (-not $netlifyCmd) {
    Write-Host '  ERRORE - netlify CLI non trovato (npm install -g netlify-cli)' -ForegroundColor Red
    exit 1
}

$version = (& netlify --version 2>&1 | Out-String).Trim()
if ($version) {
    Write-Host "  OK - netlify CLI ($version)" -ForegroundColor Green
}

$statusLines = @(& netlify status 2>&1)
$statusText = ($statusLines | Out-String).Trim()
$statusExit = $LASTEXITCODE

if ($statusExit -ne 0 -or $statusText -match '(?i)not logged in|please log in|unauthorized|401') {
    Write-Host '  ERRORE - netlify status: token assente, scaduto o non valido' -ForegroundColor Red
    Write-Host '  Suggerimento: rigenera il token su app.netlify.com e aggiorna .netlify.local.ps1 (fuori chat).' -ForegroundColor Yellow
    exit 1
}

Write-Host '  OK - netlify status (autenticato)' -ForegroundColor Green
Write-Host ''
Write-Host 'NETLIFY_ACCESS_OK — usa netlify CLI dal repo (site collegato: systemgest).' -ForegroundColor Green
exit 0
