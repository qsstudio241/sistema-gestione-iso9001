# Deploy backend (controllers + routes + server.js + servizi correlati) sul VPS
#
# IMPORTANTE: /var/www/sgq-backend sul VPS e' una COPIA di file (deploy), non un repository Git.
# Dopo `git push` su GitHub, Netlify aggiorna il frontend; il backend si aggiorna solo eseguendo questo script
# (o copiando manualmente gli stessi file) + restart sgq-backend.
#
# Esegui da PowerShell nella root del repo.
# Usa PuTTY (pscp/plink) in modalita' -batch per evitare prompt interattivi.
# Nota: la prima volta potrebbe essere necessario accettare la host key manualmente (una sola volta),
# poi -batch funzionera' senza blocchi.
#
# --- Autenticazione SSH (ordine consigliato, best practice) ---
# 1) File backend/config/.ssh-deploy.local.ps1 (gitignored; vedi .ssh-deploy.local.ps1.example) — imposta $env:SGQ_* senza chat/repo.
# 2) Variabile SGQ_PUTTY_SESSION o file .putty-session.local — sessione PuTTY salvata + Pageant/chiave.
# 3) Chiave SSH + Pageant senza sessione dedicata (plink/pscp -hostkey, nessun -pw).
# 4) Solo se inevitabile: SGQ_SSH_PASSWORD (compare in history processi; ruotare se esposta).
# Se SGQ_SSH_PASSWORD e' valorizzata, la sessione PuTTY viene ignorata per evitare batch falliti con sessioni obsolete.

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$BackendRoot = Join-Path $ProjectRoot "backend"
$VPS = "spascarella@www.fr-busato.it"
$Port = "1122"
$RemoteBase = "/var/www/sgq-backend"
$HostKey = "ssh-ed25519 255 SHA256:X7V82/1Ugdd7QmCJqaAXTn8Pazqv8bRA3mshLlwbsoc"

$DeployLocalPs1 = Join-Path $BackendRoot "config\.ssh-deploy.local.ps1"
if (Test-Path -LiteralPath $DeployLocalPs1) {
    try {
        . $DeployLocalPs1
        Write-Host "Caricato: backend/config/.ssh-deploy.local.ps1 (gitignored)" -ForegroundColor DarkGray
    } catch {
        throw "Errore eseguendo backend/config/.ssh-deploy.local.ps1: $_"
    }
}

$PuttySession = $env:SGQ_PUTTY_SESSION  # opzionale: nome sessione PuTTY salvata (consigliato)
$SshPassword = $env:SGQ_SSH_PASSWORD    # opzionale: password SSH (sconsigliata; evita prompt in batch)

# Opzionale: file locale gitignored — una sola riga = nome sessione PuTTY (stesso valore di SGQ_PUTTY_SESSION)
$PuttySessionFile = Join-Path $BackendRoot "config\.putty-session.local"
if (-not $PuttySession -and (Test-Path $PuttySessionFile)) {
    $PuttySession = (Get-Content -LiteralPath $PuttySessionFile -Raw).Trim()
    if ($PuttySession) {
        Write-Host "Sessione PuTTY da backend/config/.putty-session.local" -ForegroundColor DarkGray
    }
}

if ($SshPassword) {
    if ($PuttySession) {
        Write-Host "SGQ_SSH_PASSWORD attiva: sessione PuTTY '$PuttySession' ignorata (deploy via hostkey + -pw)." -ForegroundColor DarkYellow
    }
    $PuttySession = $null
}

$Pscp = "C:\Program Files\PuTTY\pscp.exe"
$Plink = "C:\Program Files\PuTTY\plink.exe"

if (-not (Test-Path $Pscp)) {
    throw "pscp.exe non trovato in: $Pscp"
}
if (-not (Test-Path $Plink)) {
    throw "plink.exe non trovato in: $Plink"
}

function Copy-FileToVps([string]$LocalRelPath, [string]$RemoteAbsPath) {
    $local = Join-Path $BackendRoot $LocalRelPath
    if (-not (Test-Path $local)) { throw "File locale non trovato: $local" }

    Write-Host "  -> Copia: $LocalRelPath  =>  $RemoteAbsPath" -ForegroundColor Gray
    if ($PuttySession) {
        & $Pscp -batch -load $PuttySession $local "$VPS`:$RemoteAbsPath"
    } else {
        if ($SshPassword) {
            & $Pscp -batch -pw $SshPassword -hostkey $HostKey -P $Port $local "$VPS`:$RemoteAbsPath"
        } else {
            & $Pscp -batch -hostkey $HostKey -P $Port $local "$VPS`:$RemoteAbsPath"
        }
    }
    if ($LASTEXITCODE -ne 0) { throw "pscp fallito per $LocalRelPath (exit $LASTEXITCODE)" }
}

Write-Host "Copia backend su VPS (porta $Port)..." -ForegroundColor Cyan
Set-Location $BackendRoot

# Preflight: assicura che la host key sia in cache per evitare prompt.
# Se e' la prima connessione e chiede "store key in cache (y/n)?", rispondiamo "y".
# Se invece chiede la password (autenticazione non a chiave), il deploy non puo' proseguire in modo non interattivo.
Write-Host "Preflight SSH (verifica host key)..." -ForegroundColor Cyan
$useSession = $false
if ($PuttySession) {
    & $Plink -batch -load $PuttySession "exit" | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $useSession = $true
    } else {
        Write-Host "⚠ Sessione PuTTY '$PuttySession' non valida o non trovata: fallback su hostkey." -ForegroundColor DarkYellow
        $useSession = $false
    }
}
if (-not $useSession) {
    if ($SshPassword) {
        & $Plink -batch -pw $SshPassword -hostkey $HostKey -P $Port $VPS "exit" | Out-Null
    } else {
        & $Plink -batch -hostkey $HostKey -P $Port $VPS "exit" | Out-Null
    }
    if ($LASTEXITCODE -ne 0) {
        throw "plink preflight fallito (exit $LASTEXITCODE). Serve autenticazione non-interattiva: backend/config/.ssh-deploy.local.ps1 (vedi .example), oppure SGQ_PUTTY_SESSION / .putty-session.local, oppure Pageant/chiave SSH."
    }
}

# Controllers
Copy-FileToVps "src/controllers/audit.controller.js" "$RemoteBase/src/controllers/audit.controller.js"
Copy-FileToVps "src/controllers/sync.controller.js" "$RemoteBase/src/controllers/sync.controller.js"
Copy-FileToVps "src/controllers/customChecklist.controller.js" "$RemoteBase/src/controllers/customChecklist.controller.js"
Copy-FileToVps "src/controllers/admin.controller.js" "$RemoteBase/src/controllers/admin.controller.js"
Copy-FileToVps "src/controllers/auditorOrg.controller.js" "$RemoteBase/src/controllers/auditorOrg.controller.js"
Copy-FileToVps "src/controllers/organization.controller.js" "$RemoteBase/src/controllers/organization.controller.js"
Copy-FileToVps "src/controllers/auth.controller.js" "$RemoteBase/src/controllers/auth.controller.js"

# Routes (necessarie per esporre gli endpoint custom-checklist-responses)
Copy-FileToVps "src/routes/audit.routes.js" "$RemoteBase/src/routes/audit.routes.js"
Copy-FileToVps "src/routes/customChecklist.routes.js" "$RemoteBase/src/routes/customChecklist.routes.js"
Copy-FileToVps "src/routes/admin.routes.js" "$RemoteBase/src/routes/admin.routes.js"
Copy-FileToVps "src/routes/organization.routes.js" "$RemoteBase/src/routes/organization.routes.js"

# Entry point server (include customChecklistRoutes)
Copy-FileToVps "src/server.js" "$RemoteBase/src/server.js"

# Services richiesti dai controller (evita crash MODULE_NOT_FOUND su VPS)
Copy-FileToVps "src/services/auditMaintenance.service.js" "$RemoteBase/src/services/auditMaintenance.service.js"
Copy-FileToVps "src/services/auditListRbac.service.js" "$RemoteBase/src/services/auditListRbac.service.js"
Copy-FileToVps "src/services/auditLock.service.js" "$RemoteBase/src/services/auditLock.service.js"
Copy-FileToVps "src/services/auditNumberAllocation.service.js" "$RemoteBase/src/services/auditNumberAllocation.service.js"
Copy-FileToVps "src/services/customChecklist.service.js" "$RemoteBase/src/services/customChecklist.service.js"
Copy-FileToVps "src/services/reportTemplate.service.js" "$RemoteBase/src/services/reportTemplate.service.js"

Write-Host "OK. Riavvio backend sul VPS..." -ForegroundColor Cyan

# Opzionale: $env:SGQ_SUDO_PASSWORD — restart systemd prima del blocco bash (evita quoting annidato).
# Mai committare password. Se non impostata, si usa sudo -n poi fallback fuser+nohup.
if ($env:SGQ_SUDO_PASSWORD) {
    Write-Host "  Tentativo systemctl restart con SGQ_SUDO_PASSWORD..." -ForegroundColor DarkGray
    $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($env:SGQ_SUDO_PASSWORD))
    $sudoLine = "echo $b64 | base64 -d | sudo -S systemctl restart sgq-backend.service"
    if ($PuttySession -and $useSession) {
        & $Plink -batch -load $PuttySession "bash -lc `"$sudoLine`""
    } elseif ($SshPassword) {
        & $Plink -batch -pw $SshPassword -hostkey $HostKey -P $Port $VPS "bash -lc `"$sudoLine`""
    } else {
        & $Plink -batch -hostkey $HostKey -P $Port $VPS "bash -lc `"$sudoLine`""
    }
    Write-Host "  (esito systemctl con password: exit $LASTEXITCODE)" -ForegroundColor DarkGray
}

# Ordine nel remoto: (1) sudo -n NOPASSWD, (2) fallback DEPLOY_CHECKLIST_RELEASE.md (fuser + nohup)
$remoteCmd = @"
bash -lc '
cd $RemoteBase
echo deploy_restart_begin
RESTARTED=0
if sudo -n systemctl restart sgq-backend.service 2>/dev/null; then
  echo deploy_systemctl_nopass_ok
  RESTARTED=1
fi
if [ "`$RESTARTED" != "1" ]; then
  echo deploy_fallback_fuser_nohup
  fuser -k 3000/tcp 2>/dev/null || true
  sleep 3
  cd $RemoteBase || exit 1
  nohup node src/server.js >> $RemoteBase/app.log 2>&1 &
  sleep 4
fi
systemctl --no-pager --full status sgq-backend.service 2>/dev/null | tail -n 40 || true
echo deploy_routes_preview_custom_checklist
sed -n '1,20p' $RemoteBase/src/routes/customChecklist.routes.js || true
echo deploy_server_organization_mount
grep -n -e organizationRoutes -e /organizations $RemoteBase/src/server.js 2>/dev/null | head -n 12 || true
tail -n 25 $RemoteBase/app.log || true
'
"@

# Windows usa CRLF: rimuoviamo i '\r' per evitare errori su bash remoto.
$remoteCmd = $remoteCmd -replace "`r", ""

if ($PuttySession) {
    if ($useSession) {
        & $Plink -batch -load $PuttySession $remoteCmd
    } else {
        if ($SshPassword) {
            & $Plink -batch -pw $SshPassword -hostkey $HostKey -P $Port $VPS $remoteCmd
        } else {
            & $Plink -batch -hostkey $HostKey -P $Port $VPS $remoteCmd
        }
    }
} else {
    if ($SshPassword) {
        & $Plink -batch -pw $SshPassword -hostkey $HostKey -P $Port $VPS $remoteCmd
    } else {
        & $Plink -batch -hostkey $HostKey -P $Port $VPS $remoteCmd
    }
}
if ($LASTEXITCODE -ne 0) { throw "plink (restart) fallito (exit $LASTEXITCODE)" }

Write-Host "DONE. Verifica ora: GET /api/v1/health e salva risposte checklist custom." -ForegroundColor Green
