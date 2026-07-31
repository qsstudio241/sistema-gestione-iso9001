# Deploy backend (manifest unico) sul VPS - SOLO istanza TEST (sgq-backend-test)
#
# IMPORTANTE: questo script NON tocca in nessun caso la produzione
# (/var/www/sgq-backend, servizio sgq-backend.service). Copia i file del
# manifest in /var/www/sgq-backend-test e riavvia esclusivamente
# sgq-backend-test.service. Per la produzione usare deploy-controllers-to-vps.ps1.
#
# Esegui da PowerShell nella root del repo:
#   .\backend\scripts\deploy-to-vps-test.ps1
#
# Manifest file list: backend/scripts/deploy-manifest.json (ordine dependency-aware)
#
# --- Autenticazione SSH (ordine consigliato) ---
# 1) backend/config/.ssh-deploy.local.ps1 (gitignored)
# 2) SGQ_PUTTY_SESSION o .putty-session.local
# 3) Chiave SSH + Pageant
# 4) SGQ_SSH_PASSWORD (sconsigliata)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$BackendRoot = Join-Path $ProjectRoot "backend"
$ManifestPath = Join-Path $PSScriptRoot "deploy-manifest.json"
$VPS = "spascarella@sistemi.fr-busato.it"
$Port = "1122"
$RemoteBase = "/var/www/sgq-backend-test"
$RemoteService = "sgq-backend-test.service"
$HostKey = "ssh-ed25519 255 SHA256:X7V82/1Ugdd7QmCJqaAXTn8Pazqv8bRA3mshLlwbsoc"
$HealthUrl = "https://sistemi.fr-busato.it:8443/test-api/api/v1/health"

if (-not (Test-Path -LiteralPath $ManifestPath)) {
    throw "Manifest non trovato: $ManifestPath"
}
$Manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
# Nota: NON leggiamo $Manifest.remoteBase qui, resta fisso su sgq-backend-test per costruzione.

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

Write-Host "=== Deploy SGQ Backend -> VPS (SOLO TEST: $RemoteBase / $RemoteService) ===" -ForegroundColor Cyan
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

# Crea directory remote se necessario (sotto RemoteBase = sgq-backend-test)
if ($Manifest.ensureRemoteDirs) {
    $mkdirParts = @()
    foreach ($dir in $Manifest.ensureRemoteDirs) {
        $mkdirParts += "mkdir -p ${RemoteBase}/${dir}"
    }
    if ($mkdirParts.Count -gt 0) {
        Write-Host "`nCreazione directory remote (test)..." -ForegroundColor Cyan
        Invoke-Plink ($mkdirParts -join " && ")
    }
}

# Copia per gruppo (ordine manifest = dependency-aware)
Write-Host "`nCopia file sul VPS (istanza TEST)..." -ForegroundColor Cyan
foreach ($group in $Manifest.groups) {
    Write-Host "[$($group.name)]" -ForegroundColor DarkCyan
    foreach ($rel in $group.files) {
        $remotePath = "$RemoteBase/$($rel -replace '\\', '/')"
        Copy-FileToVps $rel $remotePath
    }
}

Write-Host "`nOK. Riavvio SOLO $RemoteService sul VPS (produzione NON toccata)..." -ForegroundColor Cyan

# PID prima del restart (per verificare che il riavvio sia realmente avvenuto)
$oldPid = $null
try {
    $pidOut = & $Plink -batch -pw $SshPassword -hostkey $HostKey -P $Port $VPS "systemctl show -p MainPID --value $RemoteService 2>/dev/null"
    $oldPid = ($pidOut | Select-Object -Last 1).Trim()
    Write-Host "  MainPID prima del restart: $oldPid" -ForegroundColor DarkGray
} catch { }

# Stesso pattern robusto di deploy-controllers-to-vps.ps1: prova prima con
# SGQ_SUDO_PASSWORD (se presente), poi sudo -n (passwordless), poi fallback
# fuser+nohup diretto su porta 3001. Tutto scoped su RemoteService/RemoteBase,
# mai su sgq-backend.service/produzione.
$remoteCmd = @'
bash -lc '
cd __REMOTE_BASE__
echo deploy_test_restart_begin
RESTARTED=0
if [ -n "__SUDO_B64__" ]; then
  if echo "__SUDO_B64__" | base64 -d | sudo -S systemctl restart __REMOTE_SERVICE__ 2>/dev/null; then
    echo deploy_test_systemctl_pass_ok
    RESTARTED=1
  fi
fi
if [ "$RESTARTED" != "1" ] && sudo -n systemctl restart __REMOTE_SERVICE__ 2>/dev/null; then
  echo deploy_test_systemctl_nopass_ok
  RESTARTED=1
fi
if [ "$RESTARTED" != "1" ]; then
  echo deploy_test_fallback_fuser_nohup
  fuser -k 3001/tcp 2>/dev/null || true
  sleep 3
  cd __REMOTE_BASE__ || exit 1
  NODE_ENV=test nohup node src/server.js >> __REMOTE_BASE__/app.log 2>&1 &
  sleep 4
fi
sleep 3
systemctl --no-pager --full status __REMOTE_SERVICE__ 2>/dev/null | head -n 12 || true
grep -q userAudit.service __REMOTE_BASE__/src/controllers/admin.controller.js && echo deploy_test_useraudit_require_ok || echo deploy_test_useraudit_require_MISSING
'
'@
$sudoB64 = ""
if ($env:SGQ_SUDO_PASSWORD) { $sudoB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($env:SGQ_SUDO_PASSWORD)) }
$remoteCmd = $remoteCmd.Replace('__REMOTE_BASE__', $RemoteBase).Replace('__REMOTE_SERVICE__', $RemoteService).Replace('__SUDO_B64__', $sudoB64)
$remoteCmd = $remoteCmd -replace "`r", ""
Invoke-Plink $remoteCmd

Start-Sleep -Seconds 2
$newPid = $null
try {
    $pidOut2 = & $Plink -batch -pw $SshPassword -hostkey $HostKey -P $Port $VPS "systemctl show -p MainPID --value $RemoteService 2>/dev/null"
    $newPid = ($pidOut2 | Select-Object -Last 1).Trim()
    Write-Host "  MainPID dopo il restart: $newPid" -ForegroundColor DarkGray
    if ($oldPid -and $newPid -and $oldPid -eq $newPid) {
        Write-Host "  ATTENZIONE: MainPID invariato ($newPid), il servizio potrebbe NON essersi riavviato." -ForegroundColor Red
    } elseif ($newPid -and $newPid -ne '0') {
        Write-Host "  OK - PID cambiato (${oldPid} => ${newPid}), restart confermato." -ForegroundColor Green
    }
} catch { }

# Health check locale post-deploy (istanza TEST)
Write-Host "`nVerifica health API TEST..." -ForegroundColor Cyan
Start-Sleep -Seconds 2
try {
    $healthResponse = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 15
    $health = $healthResponse.Content | ConvertFrom-Json
    $status = if ($health.status) { $health.status } elseif ($health.ok) { "ok" } else { "unknown" }
    Write-Host "  OK - health TEST $status (uptime: $($health.uptime))" -ForegroundColor Green
} catch {
    Write-Host "  ATTENZIONE: health check TEST fallito su $HealthUrl" -ForegroundColor Red
    Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Il deploy file e' completato; verifica journalctl -u $RemoteService per errori di avvio." -ForegroundColor Yellow
    exit 1
}

Write-Host "`nDEPLOY TEST COMPLETATO (produzione non toccata)." -ForegroundColor Green
