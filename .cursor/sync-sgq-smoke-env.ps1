# Imposta SGQ_APP_EMAIL e SGQ_APP_PASSWORD (variabili utente Windows) da .cursor/mcp.env.
# Non stampa la password. Dopo l'esecuzione: riavvia Cursor (o il terminale) per smoke Playwright/E2E.

$ErrorActionPreference = 'Stop'
$envFile = Join-Path $PSScriptRoot 'mcp.env'

if (-not (Test-Path $envFile)) {
    Write-Error "File mancante: $envFile (copia da mcp.env.example e compila SGQ_APP_* )"
}

function Read-EnvLine([string]$Key) {
    $line = Get-Content $envFile | Where-Object { $_ -match "^\s*$([regex]::Escape($Key))=" } | Select-Object -First 1
    if (-not $line) { return $null }
    return ($line -replace "^\s*$([regex]::Escape($Key))=", '').Trim()
}

$email = Read-EnvLine 'SGQ_APP_EMAIL'
$password = Read-EnvLine 'SGQ_APP_PASSWORD'

if (-not $email -or $email -match 'INCOLLA|sostituisci|placeholder') {
    Write-Error 'SGQ_APP_EMAIL mancante o placeholder in mcp.env'
}

if (-not $password -or $password -match 'INCOLLA|sostituisci|placeholder' -or $password.Length -lt 8) {
    Write-Error 'SGQ_APP_PASSWORD mancante o placeholder in mcp.env (min 8 caratteri).'
}

[Environment]::SetEnvironmentVariable('SGQ_APP_EMAIL', $email, 'User')
[Environment]::SetEnvironmentVariable('SGQ_APP_PASSWORD', $password, 'User')

Write-Host "OK: SGQ_APP_EMAIL impostata ($email). Password salvata (lunghezza=$($password.Length))."
Write-Host 'Riavvia Cursor completamente per smoke MCP/Playwright con env aggiornate.'
Write-Host 'Cursor Cloud: imposta gli stessi nomi in Settings ? Cloud ? Secrets (non usare mcp.env sul cloud).'
