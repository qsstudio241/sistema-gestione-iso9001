# Esegue comandi o script Node sul VPS da Windows (senza SGQ_SSH_KEY_B64).
#
# Esempi (dalla root repo):
#   .\backend\scripts\run-on-vps.ps1 -Command "hostname"
#   .\backend\scripts\run-on-vps.ps1 -Script backend\scripts\check-nc-modules-vps.js
#   .\backend\scripts\run-on-vps.ps1 -LocalFile backend\scripts\diag.js -RemotePath /tmp/diag.js -RemoteCommand "node /tmp/diag.js"

param(
    [string]$Command,
    [string]$Script,
    [string]$LocalFile,
    [string]$RemotePath = '/tmp/sgq-remote-run.js',
    [string]$RemoteCommand,
    [string]$WorkingDirectory = '/var/www/sgq-backend'
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\vps-ssh.ps1')

if (-not $Command -and -not $Script -and -not $LocalFile -and -not $RemoteCommand) {
    throw 'Specificare -Command, -Script, oppure -LocalFile con -RemoteCommand.'
}

$ctx = Initialize-SgqVpsSsh -RequirePasswordOrSession
if (-not (Test-SgqVpsSession $ctx)) {
    throw 'Preflight SSH fallito. Esegui backend/scripts/vps-preflight.ps1 per dettagli.'
}

if ($Script) {
    $localScript = if ([System.IO.Path]::IsPathRooted($Script)) {
        $Script
    } else {
        Join-Path $ctx.Roots.ProjectRoot ($Script -replace '/', '\')
    }
    if (-not (Test-Path -LiteralPath $localScript)) {
        throw "Script locale non trovato: $localScript"
    }
    $remoteName = '/tmp/' + [System.IO.Path]::GetFileName($localScript)
    Copy-SgqVpsFile -Context $ctx -LocalPath $localScript -RemotePath $remoteName
    $Command = "cd $WorkingDirectory && node $remoteName"
}

if ($LocalFile) {
    $localPath = if ([System.IO.Path]::IsPathRooted($LocalFile)) {
        $LocalFile
    } else {
        Join-Path $ctx.Roots.ProjectRoot ($LocalFile -replace '/', '\')
    }
    Copy-SgqVpsFile -Context $ctx -LocalPath $localPath -RemotePath $RemotePath
    if (-not $RemoteCommand) {
        throw 'Con -LocalFile serve anche -RemoteCommand.'
    }
    $Command = $RemoteCommand
}

Write-Host "=== run-on-vps ===" -ForegroundColor Cyan
Write-Host $Command -ForegroundColor DarkGray
Invoke-SgqVps -Context $ctx -RemoteCommand $Command
