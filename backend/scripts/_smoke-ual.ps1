$ErrorActionPreference = "Stop"
$BaseUrl = "https://www.fr-busato.it:8443/test-api/api/v1"
$Email = $env:SGQ_APP_EMAIL
$Password = $env:SGQ_APP_PASSWORD
if (-not $Email -or -not $Password) { throw "SGQ_APP_EMAIL / SGQ_APP_PASSWORD non impostate" }

function Get-JsonLine([string[]]$lines) {
    # Il logger Winston scrive righe extra su stdout (connessione DB, ecc.):
    # prendiamo solo l'ultima riga che sembra JSON valido.
    $jsonLines = $lines | Where-Object { $_ -match '^\s*[\{\[]' }
    return ($jsonLines | Select-Object -Last 1)
}

$results = @()
function Add-Result([string]$name, [bool]$ok, [string]$detail) {
    $script:results += [PSCustomObject]@{ Test = $name; Ok = $ok; Detail = $detail }
    $color = if ($ok) { "Green" } else { "Red" }
    Write-Host ("[{0}] {1} - {2}" -f $(if ($ok) {"OK"} else {"FAIL"}), $name, $detail) -ForegroundColor $color
}

Write-Host "=== 0. LOGIN ===" -ForegroundColor Cyan
$loginBody = @{ email = $Email; password = $Password } | ConvertTo-Json
try {
    $loginResp = Invoke-RestMethod -Uri "$BaseUrl/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    $token = $loginResp.token
    Add-Result "LOGIN" $true ("role={0} org={1} user_id={2}" -f $loginResp.user.role, $loginResp.user.organization_id, $loginResp.user.user_id)
} catch {
    Add-Result "LOGIN" $false $_.Exception.Message
    throw "Login fallito, impossibile proseguire"
}
$headers = @{ Authorization = "Bearer $token" }

# ============ UAL-1: company-access ============
Write-Host "`n=== UAL-1: company-access ===" -ForegroundColor Cyan
$targetUserId = 2022   # viewer.azienda11@alproject.sgq.local (org 1001)
$targetCompanyId = 48  # "Smoke Ingest Test SRL" (org 1001, fixture di test gia' presente)

try {
    $usersResp = Invoke-RestMethod -Uri "$BaseUrl/admin/users" -Headers $headers -Method Get
    $hasPendingField = $null -ne ($usersResp.data | Get-Member -Name pending_activation -ErrorAction SilentlyContinue)
    Add-Result "UAL1_LIST_USERS_PENDING_FIELD" $hasPendingField ("count={0}" -f $usersResp.data.Count)
} catch {
    Add-Result "UAL1_LIST_USERS_PENDING_FIELD" $false $_.Exception.Message
}

try {
    $before = Invoke-RestMethod -Uri "$BaseUrl/admin/users/$targetUserId/company-access" -Headers $headers -Method Get
    Add-Result "UAL1_GET_BASELINE" $true ("entries={0}" -f $before.data.Count)
} catch {
    Add-Result "UAL1_GET_BASELINE" $false $_.Exception.Message
}

try {
    $addBody = @{ company_id = $targetCompanyId; permission = "read" } | ConvertTo-Json
    $addResp = Invoke-RestMethod -Uri "$BaseUrl/admin/users/$targetUserId/company-access" -Headers $headers -Method Post -Body $addBody -ContentType "application/json"
    Add-Result "UAL1_POST_ADD" $addResp.success ("permission={0}" -f $addResp.data.permission)
} catch {
    Add-Result "UAL1_POST_ADD" $false $_.Exception.Message
}

try {
    $after = Invoke-RestMethod -Uri "$BaseUrl/admin/users/$targetUserId/company-access" -Headers $headers -Method Get
    $found = $after.data | Where-Object { $_.company_id -eq $targetCompanyId }
    Add-Result "UAL1_GET_AFTER_ADD" ($null -ne $found) ("found permission={0}" -f $found.permission)
} catch {
    Add-Result "UAL1_GET_AFTER_ADD" $false $_.Exception.Message
}

try {
    $delResp = Invoke-RestMethod -Uri "$BaseUrl/admin/users/$targetUserId/company-access/$targetCompanyId" -Headers $headers -Method Delete
    Add-Result "UAL1_DELETE_CLEANUP" $delResp.success "rimosso"
} catch {
    Add-Result "UAL1_DELETE_CLEANUP" $false $_.Exception.Message
}

try {
    $afterDel = Invoke-RestMethod -Uri "$BaseUrl/admin/users/$targetUserId/company-access" -Headers $headers -Method Get
    $stillThere = $afterDel.data | Where-Object { $_.company_id -eq $targetCompanyId }
    Add-Result "UAL1_VERIFY_CLEANUP" ($null -eq $stillThere) ("residual entries={0}" -f $afterDel.data.Count)
} catch {
    Add-Result "UAL1_VERIFY_CLEANUP" $false $_.Exception.Message
}

# ============ UAL-2: audit trail ============
Write-Host "`n=== UAL-2: audit trail ===" -ForegroundColor Cyan
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$ual2Email = "smoke-ual2-$ts@example.invalid"
$ual2UserId = $null
try {
    $createBody = @{ email = $ual2Email; password = "TestPass123!"; full_name = "Smoke UAL2 Test"; role = "auditor" } | ConvertTo-Json
    $createResp = Invoke-RestMethod -Uri "$BaseUrl/admin/users" -Headers $headers -Method Post -Body $createBody -ContentType "application/json"
    $ual2UserId = $createResp.data.user_id
    Add-Result "UAL2_CREATE_USER" $createResp.success ("user_id={0} pending_activation={1}" -f $ual2UserId, $createResp.data.pending_activation)
} catch {
    Add-Result "UAL2_CREATE_USER" $false $_.Exception.Message
}

if ($ual2UserId) {
    try {
        $patchBody = @{ full_name = "Smoke UAL2 Test Updated" } | ConvertTo-Json
        $patchResp = Invoke-RestMethod -Uri "$BaseUrl/admin/users/$ual2UserId" -Headers $headers -Method Patch -Body $patchBody -ContentType "application/json"
        Add-Result "UAL2_PATCH_USER" $patchResp.success "full_name aggiornato"
    } catch {
        Add-Result "UAL2_PATCH_USER" $false $_.Exception.Message
    }

    try {
        $auditResp = Invoke-RestMethod -Uri "$BaseUrl/admin/users/$ual2UserId/audit-log" -Headers $headers -Method Get
        $actions = $auditResp.data | ForEach-Object { $_.action_type }
        $hasCreated = $actions -contains "user_created"
        $hasUpdated = $actions -contains "profile_updated"
        Add-Result "UAL2_AUDIT_LOG" ($hasCreated -and $hasUpdated) ("actions=[{0}]" -f ($actions -join ","))
    } catch {
        Add-Result "UAL2_AUDIT_LOG" $false $_.Exception.Message
    }
}

# ============ UAL-3: invito email ============
Write-Host "`n=== UAL-3: invito email ===" -ForegroundColor Cyan
$ual3Email = "smoke-ual3-$ts@example.invalid"
$ual3UserId = $null
try {
    $inviteBody = @{ email = $ual3Email; full_name = "Smoke UAL3 Test"; role = "auditor"; send_invite = $true } | ConvertTo-Json
    $inviteResp = Invoke-RestMethod -Uri "$BaseUrl/admin/users" -Headers $headers -Method Post -Body $inviteBody -ContentType "application/json"
    $ual3UserId = $inviteResp.data.user_id
    Add-Result "UAL3_CREATE_INVITE_USER" ($inviteResp.data.pending_activation -eq $true) ("user_id={0} pending_activation={1}" -f $ual3UserId, $inviteResp.data.pending_activation)
} catch {
    Add-Result "UAL3_CREATE_INVITE_USER" $false $_.Exception.Message
}

try {
    $fakeCheck = Invoke-RestMethod -Uri "$BaseUrl/auth/accept-invite/0000000000000000000000000000000000000000000000000000000000000000" -Method Get
    Add-Result "UAL3_FAKE_TOKEN_REJECTED" $false ("risposta 200 inattesa: {0}" -f ($fakeCheck | ConvertTo-Json -Compress))
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    Add-Result "UAL3_FAKE_TOKEN_REJECTED" ($status -eq 400 -or $status -eq 404) ("status=$status (atteso 400/404 per token inventato)")
}

if ($ual3UserId) {
    $orgId = $loginResp.user.organization_id
    $genOut = node "$PSScriptRoot\_smoke-token-helper.js" generate $ual3UserId $orgId invite
    $genJson = Get-JsonLine $genOut | ConvertFrom-Json
    $realInviteToken = $genJson.rawToken

    try {
        $checkResp = Invoke-RestMethod -Uri "$BaseUrl/auth/accept-invite/$realInviteToken" -Method Get
        Add-Result "UAL3_REAL_TOKEN_CHECK" $checkResp.success ("email={0}" -f $checkResp.data.email)
    } catch {
        Add-Result "UAL3_REAL_TOKEN_CHECK" $false $_.Exception.Message
    }

    try {
        $acceptBody = @{ token = $realInviteToken; password = "InvitePass123!" } | ConvertTo-Json
        $acceptResp = Invoke-RestMethod -Uri "$BaseUrl/auth/accept-invite" -Method Post -Body $acceptBody -ContentType "application/json"
        Add-Result "UAL3_ACCEPT_INVITE" $acceptResp.success "password impostata, account attivato"
    } catch {
        Add-Result "UAL3_ACCEPT_INVITE" $false $_.Exception.Message
    }

    try {
        $ual3LoginBody = @{ email = $ual3Email; password = "InvitePass123!" } | ConvertTo-Json
        $ual3Login = Invoke-RestMethod -Uri "$BaseUrl/auth/login" -Method Post -Body $ual3LoginBody -ContentType "application/json"
        Add-Result "UAL3_LOGIN_AFTER_ACCEPT" ($null -ne $ual3Login.token) "login riuscito con la password impostata"
    } catch {
        Add-Result "UAL3_LOGIN_AFTER_ACCEPT" $false $_.Exception.Message
    }

    try {
        $auditResp3 = Invoke-RestMethod -Uri "$BaseUrl/admin/users/$ual3UserId/audit-log" -Headers $headers -Method Get
        $actions3 = $auditResp3.data | ForEach-Object { $_.action_type }
        Add-Result "UAL3_AUDIT_LOG" (($actions3 -contains "invite_sent") -and ($actions3 -contains "invite_accepted")) ("actions=[{0}]" -f ($actions3 -join ","))
    } catch {
        Add-Result "UAL3_AUDIT_LOG" $false $_.Exception.Message
    }
}

# ============ UAL-4: reset password self-service ============
Write-Host "`n=== UAL-4: reset password ===" -ForegroundColor Cyan
$fakeEmail = "doesnotexist-$ts@example.invalid"
try {
    $r1 = Invoke-WebRequest -Uri "$BaseUrl/auth/forgot-password" -Method Post -Body (@{ email = $ual2Email } | ConvertTo-Json) -ContentType "application/json" -UseBasicParsing
    $r2 = Invoke-WebRequest -Uri "$BaseUrl/auth/forgot-password" -Method Post -Body (@{ email = $fakeEmail } | ConvertTo-Json) -ContentType "application/json" -UseBasicParsing
    $identical = ($r1.StatusCode -eq $r2.StatusCode) -and ($r1.Content -eq $r2.Content)
    Add-Result "UAL4_ANTI_ENUMERATION" $identical ("status1={0} status2={1} body1={2} body2={3}" -f $r1.StatusCode, $r2.StatusCode, $r1.Content, $r2.Content)
} catch {
    Add-Result "UAL4_ANTI_ENUMERATION" $false $_.Exception.Message
}

if ($ual2UserId) {
    $tokenQueryOut = node "$PSScriptRoot\_smoke-token-helper.js" query $ual2UserId reset
    $tokenRows = Get-JsonLine $tokenQueryOut | ConvertFrom-Json
    Add-Result "UAL4_RESET_TOKEN_CREATED" ($tokenRows.Count -ge 1) ("righe trovate={0}" -f $tokenRows.Count)

    $orgId2 = $loginResp.user.organization_id
    $genOut2 = node "$PSScriptRoot\_smoke-token-helper.js" generate $ual2UserId $orgId2 reset
    $genJson2 = Get-JsonLine $genOut2 | ConvertFrom-Json
    $realResetToken = $genJson2.rawToken

    try {
        $resetCheck = Invoke-RestMethod -Uri "$BaseUrl/auth/reset-password/$realResetToken" -Method Get
        Add-Result "UAL4_REAL_TOKEN_CHECK" $resetCheck.success ("email={0}" -f $resetCheck.data.email)
    } catch {
        Add-Result "UAL4_REAL_TOKEN_CHECK" $false $_.Exception.Message
    }

    try {
        $resetBody = @{ token = $realResetToken; newPassword = "ResetPass789!" } | ConvertTo-Json
        $resetResp = Invoke-RestMethod -Uri "$BaseUrl/auth/reset-password" -Method Post -Body $resetBody -ContentType "application/json"
        Add-Result "UAL4_RESET_PASSWORD" $resetResp.success "nuova password impostata"
    } catch {
        Add-Result "UAL4_RESET_PASSWORD" $false $_.Exception.Message
    }

    try {
        $ual2LoginBody = @{ email = $ual2Email; password = "ResetPass789!" } | ConvertTo-Json
        $ual2Login = Invoke-RestMethod -Uri "$BaseUrl/auth/login" -Method Post -Body $ual2LoginBody -ContentType "application/json"
        Add-Result "UAL4_LOGIN_AFTER_RESET" ($null -ne $ual2Login.token) "login riuscito con la nuova password"
    } catch {
        Add-Result "UAL4_LOGIN_AFTER_RESET" $false $_.Exception.Message
    }

    try {
        $fakeReset = node "$PSScriptRoot\_smoke-token-helper.js" query $ual2UserId reset
        $auditResp4 = Invoke-RestMethod -Uri "$BaseUrl/admin/users/$ual2UserId/audit-log" -Headers $headers -Method Get
        $actions4 = $auditResp4.data | ForEach-Object { $_.action_type }
        Add-Result "UAL4_AUDIT_LOG" (($actions4 -contains "password_reset_requested") -and ($actions4 -contains "password_reset_completed")) ("actions=[{0}]" -f ($actions4 -join ","))
    } catch {
        Add-Result "UAL4_AUDIT_LOG" $false $_.Exception.Message
    }
}

# ============ CLEANUP: disattiva utenti fixture (soft-delete, mai hard delete) ============
Write-Host "`n=== CLEANUP ===" -ForegroundColor Cyan
foreach ($uid in @($ual2UserId, $ual3UserId)) {
    if ($uid) {
        try {
            $deact = Invoke-RestMethod -Uri "$BaseUrl/admin/users/$uid" -Headers $headers -Method Delete
            Add-Result "CLEANUP_DEACTIVATE_$uid" $deact.success "utente fixture disattivato (soft-delete)"
        } catch {
            Add-Result "CLEANUP_DEACTIVATE_$uid" $false $_.Exception.Message
        }
    }
}

Write-Host "`n=== RIEPILOGO ===" -ForegroundColor Cyan
$results | Format-Table -AutoSize | Out-String | Write-Host
$failCount = ($results | Where-Object { -not $_.Ok }).Count
Write-Host ("Totale test: {0}, falliti: {1}" -f $results.Count, $failCount) -ForegroundColor $(if ($failCount -eq 0) { "Green" } else { "Red" })
Write-Host ("UAL2_USER_ID={0} UAL3_USER_ID={1}" -f $ual2UserId, $ual3UserId)
