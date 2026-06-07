# Verifica accesso VPS da Windows (Cursor desktop).
# Uso: .\backend\scripts\vps-preflight.ps1
# L'agente deve eseguirlo PRIMA di dichiarare "SGQ_SSH_KEY_B64 vuota".

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\vps-ssh.ps1')

Write-Host '=== SGQ VPS preflight (Windows) ===' -ForegroundColor Cyan

$ctx = Initialize-SgqVpsSsh -RequirePasswordOrSession

if (Test-Path -LiteralPath $ctx.DeployLocal) {
    Write-Host '  OK - backend/config/.ssh-deploy.local.ps1 presente' -ForegroundColor Green
} else {
    Write-Host '  MANCA - backend/config/.ssh-deploy.local.ps1' -ForegroundColor Red
    exit 1
}

if ($ctx.SshPassword) {
    Write-Host '  OK - autenticazione: SGQ_SSH_PASSWORD' -ForegroundColor Green
} elseif ($ctx.PuttySession) {
    Write-Host "  OK - autenticazione: sessione PuTTY '$($ctx.PuttySession)'" -ForegroundColor Green
} else {
    Write-Host '  ERRORE - nessuna credenziale SSH locale' -ForegroundColor Red
    exit 1
}

if (-not (Test-SgqVpsSession $ctx)) {
    Write-Host '  ERRORE - plink preflight fallito' -ForegroundColor Red
    exit 1
}
Write-Host '  OK - connessione SSH (plink)' -ForegroundColor Green

$health = Get-SgqVpsHealth
if ($health.Ok -and $health.StatusCode -eq 200) {
    Write-Host "  OK - health API ($($ctx.HealthUrl))" -ForegroundColor Green
} else {
    Write-Host "  ATTENZIONE - health API non raggiungibile: $($health.Error)" -ForegroundColor Yellow
}

Write-Host ''
Write-Host 'VPS_ACCESS_OK — usa run-on-vps.ps1 o deploy-controllers-to-vps.ps1 (non SGQ_SSH_KEY_B64).' -ForegroundColor Green
exit 0
