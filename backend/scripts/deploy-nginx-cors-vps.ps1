# Deploy map CORS nginx + site sgq-backend sul VPS (Deploy Preview Netlify)
# Esegui da root repo: .\backend\scripts\deploy-nginx-cors-vps.ps1
#
# Richiede: backend/config/.ssh-deploy.local.ps1 con SGQ_SSH_PASSWORD e SGQ_SUDO_PASSWORD

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "lib\vps-ssh.ps1")
$ctx = Initialize-SgqVpsSsh -RequirePasswordOrSession
if (-not (Test-SgqVpsSession $ctx)) {
    throw "Connessione SSH VPS fallita"
}

$mapLocal = Join-Path $ctx.Roots.BackendRoot "config\nginx\sgq-cors-map.conf"
$siteLocal = Join-Path $ctx.Roots.BackendRoot "config\nginx\sgq-backend.conf"
if (-not (Test-Path -LiteralPath $mapLocal)) { throw "Manca $mapLocal" }
if (-not (Test-Path -LiteralPath $siteLocal)) { throw "Manca $siteLocal" }

Write-Host "=== Deploy nginx CORS (map + site) ===" -ForegroundColor Cyan

Copy-SgqVpsFile -Context $ctx -LocalPath $mapLocal -RemotePath "/tmp/sgq-cors-map.conf"
Copy-SgqVpsFile -Context $ctx -LocalPath $siteLocal -RemotePath "/tmp/sgq-backend.conf"

$sudoPass = $env:SGQ_SUDO_PASSWORD
if (-not $sudoPass) {
    throw "SGQ_SUDO_PASSWORD non impostato in backend/config/.ssh-deploy.local.ps1"
}
$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($sudoPass))

$remote = "echo $b64 | base64 -d | sudo -S cp /tmp/sgq-cors-map.conf /etc/nginx/conf.d/sgq-cors-map.conf && echo $b64 | base64 -d | sudo -S cp /tmp/sgq-backend.conf /etc/nginx/sites-available/sgq-backend && echo $b64 | base64 -d | sudo -S nginx -t && echo $b64 | base64 -d | sudo -S systemctl reload nginx && echo NGINX_CORS_DEPLOY_OK"

Invoke-SgqVps -Context $ctx -RemoteCommand $remote
Write-Host "NGINX CORS deploy completato." -ForegroundColor Green
