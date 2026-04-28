# E2E smoke test for admin app - login + visit all admin pages + check status
# Usage:  cd C:\dev\MOUNT1 ;  .\scripts\e2e-admin-smoke.ps1
#
# Requires:
#   - admin dev server running on http://localhost:3001
#   - super_admin account: eunjin / Qkqwntpdy1!
#   - Supabase Hook ON  +  0013/0014  applied
#   - 0015 seed applied (for orders/dispatch tests)

param(
    [string]$base = "http://localhost:3001",
    [string]$loginId = "eunjin",
    [string]$password = "Qkqwntpdy1!",
    [string]$role = "super_admin"
)

Write-Host "=== E2E admin smoke test ===" -ForegroundColor Cyan
Write-Host "  base : $base" -ForegroundColor Gray
Write-Host "  user : $loginId / $role" -ForegroundColor Gray
Write-Host ""

# 1. Login (server action POST)
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

Write-Host "[login] POST /login ..." -ForegroundColor Cyan
$loginPayload = @{
    "1_username" = $loginId
    "1_password" = $password
    "1_adminRole" = $role
    "0" = "[`"`$K1`"]"
} | ConvertTo-Json -Compress
# NOTE: Next.js server action is a multipart form with internal IDs that differ across builds.
# Easier path: just verify each page returns expected redirect/200. We use a pre-baked session
# that the user provides via cookie after manual login. For pure smoke (no auth) we hit /login
# and verify each protected page redirects to /login.

# Approach: hit each URL with redirect=manual — public pages return 200, protected return 307 to /login.
$pages = @(
    @{ Path = "/login"             ; Expected = 200 ; Note = "public" }
    @{ Path = "/today"             ; Expected = 307 ; Note = "auth required" }
    @{ Path = "/dispatch"          ; Expected = 307 ; Note = "auth required" }
    @{ Path = "/orders"            ; Expected = 307 ; Note = "auth required" }
    @{ Path = "/technicians"       ; Expected = 307 ; Note = "auth required" }
    @{ Path = "/technicians/new"   ; Expected = 307 ; Note = "super_admin" }
    @{ Path = "/payouts"           ; Expected = 307 ; Note = "auth required" }
    @{ Path = "/coupang"           ; Expected = 307 ; Note = "auth required" }
    @{ Path = "/live"              ; Expected = 307 ; Note = "auth required" }
    @{ Path = "/api/health"        ; Expected = 200 ; Note = "no auth" }
    @{ Path = "/api/payouts/csv"   ; Expected = 307 ; Note = "auth required (middleware redirect)" }
)

$failures = 0
foreach ($p in $pages) {
    try {
        $r = Invoke-WebRequest -Uri ($base + $p.Path) -UseBasicParsing -MaximumRedirection 0 -ErrorAction SilentlyContinue
        $code = $r.StatusCode
    } catch {
        # PS treats 3xx without redirect as exception sometimes
        $code = $_.Exception.Response.StatusCode.value__
    }

    $marker = if ($code -eq $p.Expected) { "PASS" } else { "FAIL" }
    $color = if ($code -eq $p.Expected) { "Green" } else { "Red" }
    Write-Host ("  [{0}] {1,3}  {2,-30} (expected {3} - {4})" -f $marker, $code, $p.Path, $p.Expected, $p.Note) -ForegroundColor $color
    if ($code -ne $p.Expected) { $failures++ }
}

Write-Host ""
if ($failures -eq 0) {
    Write-Host "=== All $($pages.Count) checks PASSED ===" -ForegroundColor Green
} else {
    Write-Host "=== $failures of $($pages.Count) checks FAILED ===" -ForegroundColor Red
    Write-Host "    Common causes:" -ForegroundColor Yellow
    Write-Host "    - admin dev not running on $base" -ForegroundColor Yellow
    Write-Host "    - /login returns 200 but auth pages also 200 -> proxy.ts not enforcing" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Auth API direct check (no UI) ===" -ForegroundColor Cyan
try {
    $authBody = @{ email = "${role}_${loginId}@mountpartners.cloud"; password = $password } | ConvertTo-Json
    $authRes = Invoke-WebRequest -Uri "https://nzphbeookxotdjzishqn.supabase.co/auth/v1/token?grant_type=password" `
        -Method POST `
        -Headers @{ "apikey" = "sb_publishable_hDJSwXJm77ZxRiVug2EZhw_8kAM2SiV"; "Content-Type" = "application/json" } `
        -Body $authBody -UseBasicParsing
    $token = ($authRes.Content | ConvertFrom-Json).access_token
    if ($token) {
        Write-Host "  [PASS] Supabase auth login OK (access_token issued)" -ForegroundColor Green
        # JWT 의 app_metadata 확인
        $payload = $token.Split('.')[1]
        # base64url -> base64
        $payload = $payload.Replace('-','+').Replace('_','/')
        $padding = (4 - $payload.Length % 4) % 4
        $payload = $payload + ('=' * $padding)
        $bytes = [System.Convert]::FromBase64String($payload)
        $json = [System.Text.Encoding]::UTF8.GetString($bytes) | ConvertFrom-Json
        Write-Host ("    user_type   = {0}" -f $json.app_metadata.user_type) -ForegroundColor Gray
        Write-Host ("    admin_role  = {0}" -f $json.app_metadata.admin_role) -ForegroundColor Gray
        Write-Host ("    user_id     = {0}" -f $json.sub) -ForegroundColor Gray

        if ($json.app_metadata.admin_role -ne $role) {
            Write-Host "    [WARN] admin_role mismatch — Hook may be off or admin_users not mapped" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  [FAIL] No access_token in response" -ForegroundColor Red
    }
} catch {
    Write-Host ("  [FAIL] Auth API: {0}" -f $_.Exception.Message) -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan
