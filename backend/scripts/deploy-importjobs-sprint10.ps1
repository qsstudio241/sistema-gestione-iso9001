# deploy-importjobs-sprint10.ps1 — copia solo importJobs controller/routes (Sprint 10)
param()
$ErrorActionPreference = "Stop"
$BackendRoot = Split-Path $PSScriptRoot -Parent
$DeployLocalPs1 = Join-Path $BackendRoot "config\.ssh-deploy.local.ps1"
if (Test-Path -LiteralPath $DeployLocalPs1) { . $DeployLocalPs1 }

$Pscp = "C:\Program Files\PuTTY\pscp.exe"
$Port = "1122"
$VPS = "spascarella@www.fr-busato.it"
$RemoteBase = "/var/www/sgq-backend"
$HostKey = "ssh-ed25519 255 SHA256:X7V82/1Ugdd7QmCJqaAXTn8Pazqv8bRA3mshLlwbsoc"
$SshPassword = $env:SGQ_SSH_PASSWORD
$PuttySession = $env:SGQ_PUTTY_SESSION
if ($SshPassword) { $PuttySession = $null }

function Copy-File([string]$rel, [string]$remote) {
    $local = Join-Path $BackendRoot $rel
    Write-Host "  -> $rel => $remote"
    if ($PuttySession) {
        & $Pscp -batch -load $PuttySession $local "${VPS}:${remote}"
    } elseif ($SshPassword) {
        & $Pscp -batch -pw $SshPassword -hostkey $HostKey -P $Port $local "${VPS}:${remote}"
    } else {
        & $Pscp -batch -hostkey $HostKey -P $Port $local "${VPS}:${remote}"
    }
    if ($LASTEXITCODE -ne 0) { throw "pscp fallito per $rel" }
}

Copy-File "src/controllers/importJobs.controller.js" "$RemoteBase/src/controllers/importJobs.controller.js"
Copy-File "src/routes/importJobs.routes.js" "$RemoteBase/src/routes/importJobs.routes.js"

# Riavvio servizio
$Plink = "C:\Program Files\PuTTY\plink.exe"
$sudo_pw = $env:SGQ_SUDO_PASSWORD
if ($sudo_pw) {
    $cmd = "echo '$sudo_pw' | sudo -S systemctl restart sgq-backend.service 2>&1; sleep 2; systemctl status sgq-backend.service --no-pager | head -5"
    & $Plink -batch -pw $SshPassword -hostkey $HostKey -P $Port $VPS $cmd
} else {
    Write-Host "[WARN] SGQ_SUDO_PASSWORD non impostata — riavvio manuale richiesto"
}

Write-Host "DONE Sprint 10 deploy." -ForegroundColor Green
