# activate-nc-notifications-vps.ps1
# Attiva rubrica referenti NC + migration 073/074 + import referenti + redeploy backend.
# Esegui dalla root repo:  powershell -File backend/scripts/activate-nc-notifications-vps.ps1
#
# Prerequisiti: backend/config/.ssh-deploy.local.ps1 (gitignored) con SGQ_SSH_PASSWORD
#               e opzionale SGQ_SUDO_PASSWORD per systemctl restart.

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$BackendRoot = Join-Path $ProjectRoot "backend"
$RepoDbMigrations = Join-Path $ProjectRoot "database\migrations"
$VPS = "spascarella@sistemi.fr-busato.it"
$Port = "1122"
$RemoteBase = "/var/www/sgq-backend"
$HostKey = "ssh-ed25519 255 SHA256:X7V82/1Ugdd7QmCJqaAXTn8Pazqv8bRA3mshLlwbsoc"

$DeployLocalPs1 = Join-Path $BackendRoot "config\.ssh-deploy.local.ps1"
if (Test-Path -LiteralPath $DeployLocalPs1) { . $DeployLocalPs1 }

$SshPassword = $env:SGQ_SSH_PASSWORD
if (-not $SshPassword) {
    throw "Imposta SGQ_SSH_PASSWORD in backend/config/.ssh-deploy.local.ps1"
}

$Pscp = "C:\Program Files\PuTTY\pscp.exe"
$Plink = "C:\Program Files\PuTTY\plink.exe"

function Copy-ToVps([string]$LocalPath, [string]$RemotePath) {
    if (-not (Test-Path $LocalPath)) { throw "File locale mancante: $LocalPath" }
    Write-Host "  -> $RemotePath" -ForegroundColor Gray
    & $Pscp -batch -pw $SshPassword -hostkey $HostKey -P $Port $LocalPath "${VPS}:${RemotePath}"
    if ($LASTEXITCODE -ne 0) { throw "pscp fallito: $LocalPath" }
}

function Invoke-Vps([string]$Cmd) {
    & $Plink -batch -pw $SshPassword -hostkey $HostKey -P $Port $VPS $Cmd
    if ($LASTEXITCODE -ne 0) { throw "plink fallito (exit $LASTEXITCODE): $Cmd" }
}

Write-Host "=== Attivazione NC rubrica + notifiche VPS ===" -ForegroundColor Cyan

Write-Host "`n[1/6] Verifica env alert/SMTP..." -ForegroundColor Cyan
Invoke-Vps "grep -E '^(ALERT_ENABLED|NC_ALERT_ENABLED|SMTP_HOST)=' $RemoteBase/.env || true"

Write-Host "`n[2/6] Copia file backend NC..." -ForegroundColor Cyan
$files = @(
    @("$BackendRoot\src\controllers\notificationContacts.controller.js", "$RemoteBase/src/controllers/notificationContacts.controller.js"),
    @("$BackendRoot\src\routes\notifications.routes.js", "$RemoteBase/src/routes/notifications.routes.js"),
    @("$BackendRoot\src\services\ncAlertEscalation.service.js", "$RemoteBase/src/services/ncAlertEscalation.service.js"),
    @("$BackendRoot\src\services\alertScheduler.js", "$RemoteBase/src/services/alertScheduler.js"),
    @("$BackendRoot\src\services\alertSchedulerHelpers.js", "$RemoteBase/src/services/alertSchedulerHelpers.js"),
    @("$BackendRoot\src\services\alertMail.service.js", "$RemoteBase/src/services/alertMail.service.js"),
    @("$BackendRoot\src\utils\importNotificationContactsHelpers.js", "$RemoteBase/src/utils/importNotificationContactsHelpers.js"),
    @("$BackendRoot\scripts\import-notification-contacts-from-nc.js", "$RemoteBase/scripts/import-notification-contacts-from-nc.js"),
    @("$BackendRoot\scripts\run-migration-nc-contacts-073-vps.js", "$RemoteBase/scripts/run-migration-nc-contacts-073-vps.js"),
    @("$BackendRoot\scripts\run-migration-nc-contacts-074-vps.js", "$RemoteBase/scripts/run-migration-nc-contacts-074-vps.js"),
    @("$RepoDbMigrations\073_notification_contacts.sql", "/tmp/073_notification_contacts.sql"),
    @("$RepoDbMigrations\074_nc_notification_contacts.sql", "/tmp/074_nc_notification_contacts.sql")
)
foreach ($pair in $files) { Copy-ToVps $pair[0] $pair[1] }

Write-Host "`n[3/6] Migration NC 073..." -ForegroundColor Cyan
Invoke-Vps "cd $RemoteBase && node scripts/run-migration-nc-contacts-073-vps.js"

Write-Host "`n[4/6] Migration NC 074..." -ForegroundColor Cyan
Invoke-Vps "cd $RemoteBase && node scripts/run-migration-nc-contacts-074-vps.js"

Write-Host "`n[5/6] Import referenti (dry-run)..." -ForegroundColor Cyan
Invoke-Vps "cd $RemoteBase && node scripts/import-notification-contacts-from-nc.js --dry-run"

Write-Host "`n[5b/6] Import referenti (reale)..." -ForegroundColor Cyan
Invoke-Vps "cd $RemoteBase && node scripts/import-notification-contacts-from-nc.js"

Write-Host "`n[6/6] Restart backend..." -ForegroundColor Cyan
if ($env:SGQ_SUDO_PASSWORD) {
    $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($env:SGQ_SUDO_PASSWORD))
    Invoke-Vps "echo $b64 | base64 -d | sudo -S systemctl restart sgq-backend.service"
} else {
    Invoke-Vps "sudo -n systemctl restart sgq-backend.service 2>/dev/null || (fuser -k 3000/tcp; sleep 2; cd $RemoteBase && nohup node src/server.js >> app.log 2>&1 &)"
}
Start-Sleep -Seconds 4
Invoke-Vps "curl -s -o /dev/null -w 'health_http=%{http_code}\n' http://127.0.0.1:3000/api/v1/health || true"

Write-Host "`n=== COMPLETATO ===" -ForegroundColor Green
Write-Host "Verifica: GET https://sistemi.fr-busato.it:8443/api/v1/health"
Write-Host "In app: Il mio Studio -> Notifiche (rubrica referenti)"
