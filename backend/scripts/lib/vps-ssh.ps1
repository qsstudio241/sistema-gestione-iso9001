# Modulo condiviso SSH VPS (Windows + PuTTY).
# Dot-source: . (Join-Path $PSScriptRoot 'lib\vps-ssh.ps1')
# Non eseguire direttamente.

$script:SgqVpsHost = 'spascarella@www.fr-busato.it'
$script:SgqVpsPort = '1122'
$script:SgqVpsHostKey = 'ssh-ed25519 255 SHA256:X7V82/1Ugdd7QmCJqaAXTn8Pazqv8bRA3mshLlwbsoc'
$script:SgqVpsRemoteBase = '/var/www/sgq-backend'
$script:SgqVpsHealthUrl = 'https://www.fr-busato.it:8443/api/v1/health'

function Get-SgqProjectRoots {
    $scriptsRoot = if ($PSScriptRoot -match 'scripts\\lib$') {
        Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
    } elseif ($PSScriptRoot -match 'scripts$') {
        Split-Path $PSScriptRoot -Parent
    } else {
        throw 'vps-ssh.ps1: percorso script non riconosciuto'
    }
    $projectRoot = Split-Path $scriptsRoot -Parent
    [PSCustomObject]@{
        ProjectRoot = $projectRoot
        BackendRoot = $scriptsRoot
    }
}

function Initialize-SgqVpsSsh {
    param(
        [switch]$RequirePasswordOrSession
    )

    $roots = Get-SgqProjectRoots
    $deployLocal = Join-Path $roots.BackendRoot 'config\.ssh-deploy.local.ps1'
    if (Test-Path -LiteralPath $deployLocal) {
        try {
            . $deployLocal
        } catch {
            throw "Errore eseguendo backend/config/.ssh-deploy.local.ps1: $_"
        }
    }

    $puttySession = $env:SGQ_PUTTY_SESSION
    $sshPassword = $env:SGQ_SSH_PASSWORD
    $puttySessionFile = Join-Path $roots.BackendRoot 'config\.putty-session.local'
    if (-not $puttySession -and (Test-Path -LiteralPath $puttySessionFile)) {
        $puttySession = (Get-Content -LiteralPath $puttySessionFile -Raw).Trim()
    }
    if ($sshPassword) { $puttySession = $null }

    $pscp = 'C:\Program Files\PuTTY\pscp.exe'
    $plink = 'C:\Program Files\PuTTY\plink.exe'
    if (-not (Test-Path -LiteralPath $pscp)) { throw "pscp.exe non trovato: $pscp" }
    if (-not (Test-Path -LiteralPath $plink)) { throw "plink.exe non trovato: $plink" }

    if ($RequirePasswordOrSession -and -not $sshPassword -and -not $puttySession) {
        throw @"
Accesso VPS non configurato su Windows.
Crea backend/config/.ssh-deploy.local.ps1 (da .ssh-deploy.local.ps1.example) con SGQ_SSH_PASSWORD o SGQ_PUTTY_SESSION.
SGQ_SSH_KEY_B64 e' solo per Cloud Agent — non usarla sul terminale locale.
"@
    }

    [PSCustomObject]@{
        Roots         = $roots
        DeployLocal   = $deployLocal
        Plink         = $plink
        Pscp          = $pscp
        PuttySession  = $puttySession
        SshPassword   = $sshPassword
        UseSession    = $false
        Host          = $script:SgqVpsHost
        Port          = $script:SgqVpsPort
        HostKey       = $script:SgqVpsHostKey
        RemoteBase    = $script:SgqVpsRemoteBase
        HealthUrl     = $script:SgqVpsHealthUrl
    }
}

function Test-SgqVpsSession {
    param($Context)

    if ($Context.PuttySession) {
        & $Context.Plink -batch -load $Context.PuttySession 'exit' | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $Context.UseSession = $true
            return $true
        }
    }

    if ($Context.SshPassword) {
        & $Context.Plink -batch -pw $Context.SshPassword -hostkey $Context.HostKey -P $Context.Port $Context.Host 'exit' | Out-Null
    } else {
        & $Context.Plink -batch -hostkey $Context.HostKey -P $Context.Port $Context.Host 'exit' | Out-Null
    }
    if ($LASTEXITCODE -ne 0) { return $false }
    $Context.UseSession = $false
    return $true
}

function Invoke-SgqVps {
    param(
        [Parameter(Mandatory)]
        $Context,
        [Parameter(Mandatory)]
        [string]$RemoteCommand
    )

    if ($Context.UseSession) {
        & $Context.Plink -batch -load $Context.PuttySession $RemoteCommand
    } elseif ($Context.SshPassword) {
        & $Context.Plink -batch -pw $Context.SshPassword -hostkey $Context.HostKey -P $Context.Port $Context.Host $RemoteCommand
    } else {
        & $Context.Plink -batch -hostkey $Context.HostKey -P $Context.Port $Context.Host $RemoteCommand
    }
    if ($LASTEXITCODE -ne 0) {
        throw "plink fallito (exit $LASTEXITCODE): $RemoteCommand"
    }
}

function Copy-SgqVpsFile {
    param(
        [Parameter(Mandatory)]
        $Context,
        [Parameter(Mandatory)]
        [string]$LocalPath,
        [Parameter(Mandatory)]
        [string]$RemotePath
    )

    if (-not (Test-Path -LiteralPath $LocalPath)) {
        throw "File locale non trovato: $LocalPath"
    }

    $target = "$($Context.Host):${RemotePath}"
    if ($Context.UseSession) {
        & $Context.Pscp -batch -load $Context.PuttySession $LocalPath $target
    } elseif ($Context.SshPassword) {
        & $Context.Pscp -batch -pw $Context.SshPassword -hostkey $Context.HostKey -P $Context.Port $LocalPath $target
    } else {
        & $Context.Pscp -batch -hostkey $Context.HostKey -P $Context.Port $LocalPath $target
    }
    if ($LASTEXITCODE -ne 0) {
        throw "pscp fallito per $LocalPath (exit $LASTEXITCODE)"
    }
}

function Get-SgqVpsHealth {
    param(
        [string]$HealthUrl = $script:SgqVpsHealthUrl
    )

    try {
        $response = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 15
        return [PSCustomObject]@{
            Ok = $true
            StatusCode = $response.StatusCode
            Body = $response.Content
        }
    } catch {
        return [PSCustomObject]@{
            Ok = $false
            StatusCode = $null
            Body = $null
            Error = $_.Exception.Message
        }
    }
}
