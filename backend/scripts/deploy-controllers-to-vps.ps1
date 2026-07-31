# Deploy backend (manifest unico) sul VPS
#
# IMPORTANTE: /var/www/sgq-backend sul VPS e' una COPIA di file (deploy), non un repository Git.
# Dopo `git push` su GitHub, Netlify aggiorna il frontend; il backend si aggiorna solo eseguendo questo script
# (o deploy-to-vps.sh) + restart sgq-backend.
#
# Esegui da PowerShell nella root del repo:
#   .\backend\scripts\deploy-controllers-to-vps.ps1
#   .\backend\scripts\deploy-controllers-to-vps.ps1 -AlsoRestartTest   # riavvia anche sgq-backend-test
#
# Manifest file list: backend/scripts/deploy-manifest.json (ordine dependency-aware)
#
# --- Autenticazione SSH (ordine consigliato) ---
# 1) backend/config/.ssh-deploy.local.ps1 (gitignored)
# 2) SGQ_PUTTY_SESSION o .putty-session.local
# 3) Chiave SSH + Pageant
# 4) SGQ_SSH_PASSWORD (sconsigliata)

param(
    [switch]$AlsoRestartTest   # Se presente, riavvia anche sgq-backend-test dopo il deploy prod
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$BackendRoot = Join-Path $ProjectRoot "backend"
$ManifestPath = Join-Path $PSScriptRoot "deploy-manifest.json"
$VPS = "spascarella@sistemi.fr-busato.it"
$Port = "1122"
$RemoteBase = "/var/www/sgq-backend"
$HostKey = "ssh-ed25519 255 SHA256:X7V82/1Ugdd7QmCJqaAXTn8Pazqv8bRA3mshLlwbsoc"
$HealthUrl = if ($env:SGQ_HEALTH_URL) { $env:SGQ_HEALTH_URL } else { "https://sistemi.fr-busato.it:8443/api/v1/health" }

if (-not (Test-Path -LiteralPath $ManifestPath)) {
    throw "Manifest non trovato: $ManifestPath"
}
$Manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
if ($Manifest.remoteBase) { $RemoteBase = $Manifest.remoteBase }

$DeployLocalPs1 = Join-Path $BackendRoot "config\.ssh-deploy.local.ps1"
if (Test-Path -LiteralPath $DeployLocalPs1) {
    try {
        . $DeployLocalPs1
        Write-Host "Caricato: backend/config/.ssh-deploy.local.ps1 (gitignored)" -ForegroundColor DarkGray
    } catch {
        throw "Errore eseguendo backend/config/.ssh-deploy.local.ps1: $_"
    }
}

$PuttySession = $env:SGQ_PUTTY_SESSION
$SshPassword = $env:SGQ_SSH_PASSWORD

$PuttySessionFile = Join-Path $BackendRoot "config\.putty-session.local"
if (-not $PuttySession -and (Test-Path $PuttySessionFile)) {
    $PuttySession = (Get-Content -LiteralPath $PuttySessionFile -Raw).Trim()
    if ($PuttySession) {
        Write-Host "Sessione PuTTY da backend/config/.putty-session.local" -ForegroundColor DarkGray
    }
}

if ($SshPassword) {
    if ($PuttySession) {
        Write-Host "SGQ_SSH_PASSWORD attiva: sessione PuTTY '$PuttySession' ignorata." -ForegroundColor DarkYellow
    }
    $PuttySession = $null
}

$Pscp = "C:\Program Files\PuTTY\pscp.exe"
$Plink = "C:\Program Files\PuTTY\plink.exe"

if (-not (Test-Path $Pscp)) { throw "pscp.exe non trovato in: $Pscp" }
if (-not (Test-Path $Plink)) { throw "plink.exe non trovato in: $Plink" }

function Invoke-Plink([string]$RemoteCommand) {
    if ($PuttySession -and $script:useSession) {
        & $Plink -batch -load $PuttySession $RemoteCommand
    } elseif ($SshPassword) {
        & $Plink -batch -pw $SshPassword -hostkey $HostKey -P $Port $VPS $RemoteCommand
    } else {
        & $Plink -batch -hostkey $HostKey -P $Port $VPS $RemoteCommand
    }
    if ($LASTEXITCODE -ne 0) { throw "plink fallito (exit $LASTEXITCODE): $RemoteCommand" }
}

function Copy-FileToVps([string]$LocalRelPath, [string]$RemoteAbsPath) {
    $local = Join-Path $BackendRoot ($LocalRelPath -replace '/', '\')
    if (-not (Test-Path -LiteralPath $local)) { throw "File locale non trovato: $local" }

    Write-Host "  -> $LocalRelPath" -ForegroundColor Gray
    if ($PuttySession -and $script:useSession) {
        & $Pscp -batch -load $PuttySession $local "${VPS}:${RemoteAbsPath}"
    } elseif ($SshPassword) {
        & $Pscp -batch -pw $SshPassword -hostkey $HostKey -P $Port $local "${VPS}:${RemoteAbsPath}"
    } else {
        & $Pscp -batch -hostkey $HostKey -P $Port $local "${VPS}:${RemoteAbsPath}"
    }
    if ($LASTEXITCODE -ne 0) { throw "pscp fallito per $LocalRelPath (exit $LASTEXITCODE)" }
}

# Raccogli tutti i file dal manifest
$AllFiles = @()
foreach ($group in $Manifest.groups) {
    foreach ($rel in $group.files) {
        $AllFiles += [PSCustomObject]@{ Group = $group.name; Path = $rel }
    }
}

Write-Host "=== Deploy SGQ Backend -> VPS ===" -ForegroundColor Cyan
Write-Host "Manifest: $($AllFiles.Count) file in $($Manifest.groups.Count) gruppi" -ForegroundColor Cyan
Set-Location $BackendRoot

# Preflight: tutti i file locali devono esistere PRIMA di aprire SSH
Write-Host "`nPreflight locale (verifica file manifest)..." -ForegroundColor Cyan
$missing = @()
foreach ($item in $AllFiles) {
    $local = Join-Path $BackendRoot ($item.Path -replace '/', '\')
    if (-not (Test-Path -LiteralPath $local)) { $missing += $item.Path }
}
if ($missing.Count -gt 0) {
    Write-Host "ERRORE: file mancanti nel workspace locale:" -ForegroundColor Red
    $missing | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    throw "Deploy annullato: $($missing.Count) file non trovati. Esegui git pull o verifica il branch."
}
Write-Host "  OK - tutti i $($AllFiles.Count) file presenti." -ForegroundColor Green

# Preflight SSH
Write-Host "`nPreflight SSH..." -ForegroundColor Cyan
$script:useSession = $false
if ($PuttySession) {
    & $Plink -batch -load $PuttySession "exit" | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $script:useSession = $true
    } else {
        Write-Host "Sessione PuTTY '$PuttySession' non valida: fallback hostkey." -ForegroundColor DarkYellow
    }
}
if (-not $script:useSession) {
    if ($SshPassword) {
        & $Plink -batch -pw $SshPassword -hostkey $HostKey -P $Port $VPS "exit" | Out-Null
    } else {
        & $Plink -batch -hostkey $HostKey -P $Port $VPS "exit" | Out-Null
    }
    if ($LASTEXITCODE -ne 0) {
        throw "plink preflight fallito. Configura backend/config/.ssh-deploy.local.ps1, SGQ_PUTTY_SESSION o Pageant."
    }
}
Write-Host "  OK - connessione SSH." -ForegroundColor Green

# Crea directory remote se necessario
if ($Manifest.ensureRemoteDirs) {
    $mkdirParts = @()
    foreach ($dir in $Manifest.ensureRemoteDirs) {
        $mkdirParts += "mkdir -p ${RemoteBase}/${dir}"
    }
    if ($mkdirParts.Count -gt 0) {
        Write-Host "`nCreazione directory remote..." -ForegroundColor Cyan
        Invoke-Plink ($mkdirParts -join " && ")
    }
}

# Copia per gruppo (ordine manifest = dependency-aware)
Write-Host "`nCopia file sul VPS..." -ForegroundColor Cyan
foreach ($group in $Manifest.groups) {
    Write-Host "[$($group.name)]" -ForegroundColor DarkCyan
    foreach ($rel in $group.files) {
        $remotePath = "$RemoteBase/$($rel -replace '\\', '/')"
        Copy-FileToVps $rel $remotePath
    }
}

Write-Host "`nOK. Riavvio backend sul VPS..." -ForegroundColor Cyan

if ($env:SGQ_SUDO_PASSWORD) {
    Write-Host "  Tentativo systemctl restart con SGQ_SUDO_PASSWORD..." -ForegroundColor DarkGray
    $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($env:SGQ_SUDO_PASSWORD))
    $sudoLine = "echo $b64 | base64 -d | sudo -S systemctl restart sgq-backend.service"
    try {
        Invoke-Plink "bash -lc `"$sudoLine`""
    } catch {
        Write-Host "  systemctl con password non riuscito, proseguo con fallback." -ForegroundColor DarkYellow
    }
}

$remoteCmd = @'
bash -lc '
cd __REMOTE_BASE__
echo deploy_restart_begin
RESTARTED=0
if sudo -n systemctl restart sgq-backend.service 2>/dev/null; then
  echo deploy_systemctl_nopass_ok
  RESTARTED=1
fi
if [ "$RESTARTED" != "1" ]; then
  echo deploy_fallback_fuser_nohup
  fuser -k 3000/tcp 2>/dev/null || true
  sleep 3
  cd __REMOTE_BASE__ || exit 1
  nohup node src/server.js >> __REMOTE_BASE__/app.log 2>&1 &
  sleep 4
fi
OLD_UPTIME=$(curl -sk https://sistemi.fr-busato.it:8443/api/v1/health 2>/dev/null | grep -o "\"uptime\":[0-9.]*" | head -1 || true)
echo deploy_health_uptime $OLD_UPTIME
systemctl --no-pager --full status sgq-backend.service 2>/dev/null | tail -n 15 || true
grep -q normUpload.routes __REMOTE_BASE__/src/server.js && echo deploy_norm_upload_route_ok || echo deploy_norm_upload_route_MISSING
grep -q ncResponsibleOptions __REMOTE_BASE__/src/controllers/nc.controller.js && echo deploy_nc_responsible_ok || echo deploy_nc_responsible_MISSING
tail -n 20 __REMOTE_BASE__/app.log || true
'
'@
$remoteCmd = $remoteCmd.Replace('__REMOTE_BASE__', $RemoteBase)

$remoteCmd = $remoteCmd -replace "`r", ""
Invoke-Plink $remoteCmd

# Health check locale post-deploy
Write-Host "`nVerifica health API..." -ForegroundColor Cyan
Start-Sleep -Seconds 3
try {
    $healthResponse = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 15
    $health = $healthResponse.Content | ConvertFrom-Json
    $status = if ($health.status) { $health.status } elseif ($health.ok) { "ok" } else { "unknown" }
    Write-Host "  OK - health $status (uptime: $($health.uptime))" -ForegroundColor Green
} catch {
    Write-Host "  ATTENZIONE: health check fallito su $HealthUrl" -ForegroundColor Red
    Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Il deploy file e completato; verifica manualmente systemctl status sgq-backend." -ForegroundColor Yellow
    exit 1
}

Write-Host "`nDEPLOY COMPLETATO." -ForegroundColor Green
Write-Host "Smoke opzionale: npm run smoke:deploy (da backend/)" -ForegroundColor DarkGray

# ── Riavvio istanza TEST (opzionale, attivabile con -AlsoRestartTest) ─────────
if ($AlsoRestartTest) {
    Write-Host "`nRiavvio istanza TEST (sgq-backend-test)..." -ForegroundColor Cyan

    $testHealthUrl = "https://sistemi.fr-busato.it:8443/test-api/api/v1/health"

    if ($env:SGQ_SUDO_PASSWORD) {
        $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($env:SGQ_SUDO_PASSWORD))
        $restartTest = "echo $b64 | base64 -d | sudo -S systemctl restart sgq-backend-test.service"
        try {
            Invoke-Plink "bash -lc `"$restartTest && sleep 4 && sudo systemctl status sgq-backend-test --no-pager | tail -5`""
            Write-Host "  sgq-backend-test riavviato." -ForegroundColor Green
        } catch {
            Write-Host "  ATTENZIONE: restart test fallito con SGQ_SUDO_PASSWORD." -ForegroundColor Red
            Write-Host "  Prova manuale: .\backend\scripts\run-on-vps.ps1 -Command `"echo \$b64 | base64 -d | sudo -S systemctl restart sgq-backend-test.service`"" -ForegroundColor Yellow
        }
    } else {
        # Fallback senza password sudo: usa sudo -n (no-password)
        try {
            Invoke-Plink "bash -lc 'sudo -n systemctl restart sgq-backend-test.service && sleep 3 && sudo systemctl status sgq-backend-test --no-pager | tail -5'"
            Write-Host "  sgq-backend-test riavviato (sudo -n)." -ForegroundColor Green
        } catch {
            Write-Host "  ATTENZIONE: restart test fallito (sudo richiede password)." -ForegroundColor Red
            Write-Host "  Imposta SGQ_SUDO_PASSWORD in backend/config/.ssh-deploy.local.ps1" -ForegroundColor Yellow
        }
    }

    # Health check istanza test
    Start-Sleep -Seconds 3
    try {
        $testHealth = Invoke-WebRequest -Uri $testHealthUrl -UseBasicParsing -TimeoutSec 10
        $th = $testHealth.Content | ConvertFrom-Json
        Write-Host "  TEST health: $($th.status) (uptime: $($th.uptime))" -ForegroundColor Green
    } catch {
        Write-Host "  Health test non raggiungibile su $testHealthUrl (normale se porta 8443/test-api non esposta)." -ForegroundColor DarkYellow
    }
}
