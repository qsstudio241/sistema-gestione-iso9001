# Imposta la variabile utente Windows GITHUB_PERSONAL_ACCESS_TOKEN da mcp.env.
# Non stampa il token. Eseguire dopo aver incollato il PAT in mcp.env, poi riavviare Cursor.

$ErrorActionPreference = 'Stop'
$envFile = Join-Path $PSScriptRoot 'mcp.env'

if (-not (Test-Path $envFile)) {
    Write-Error "File mancante: $envFile (copia da mcp.env.example)"
}

$line = Get-Content $envFile | Where-Object { $_ -match '^\s*GITHUB_PERSONAL_ACCESS_TOKEN=' } | Select-Object -First 1
if (-not $line) {
    Write-Error 'Riga GITHUB_PERSONAL_ACCESS_TOKEN= non trovata in mcp.env'
}

$token = ($line -replace '^\s*GITHUB_PERSONAL_ACCESS_TOKEN=', '').Trim()
if ($token.StartsWith('Bearer ')) {
    $token = $token.Substring(7).Trim()
}

if ($token -match 'sostituisci|INCOLLA|placeholder|YOUR_GITHUB|example' -or $token.Length -lt 30) {
    Write-Error 'Token non valido o ancora placeholder in mcp.env. Incolla un PAT reale (github_pat_ o ghp_).'
}

$prefixType = if ($token -match '^github_pat_') { 'fine-grained' } elseif ($token -match '^ghp_') { 'classic' } else { 'formato non riconosciuto' }
if ($prefixType -eq 'formato non riconosciuto') {
    Write-Error 'Il token deve iniziare con github_pat_ o ghp_ (senza Bearer).'
}

[Environment]::SetEnvironmentVariable('GITHUB_PERSONAL_ACCESS_TOKEN', $token, 'User')
$headerPreview = "Bearer $($token.Substring(0, 4))..."
Write-Host "OK: variabile utente impostata. Tipo=$prefixType lunghezza=$($token.Length) header~$headerPreview"
Write-Host 'Riavvia Cursor completamente (chiudi tutte le finestre).'
