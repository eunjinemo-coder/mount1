# Admin dev warm-up - force first-compile for all pages
# Usage:  cd C:\dev\MOUNT1 ;  .\scripts\warm-admin.ps1

$base = "http://localhost:3001"
$pages = @(
    "/login",
    "/today",
    "/dispatch",
    "/orders",
    "/technicians",
    "/technicians/new",
    "/payouts",
    "/coupang",
    "/live",
    "/api/health"
)

Write-Host "[warm-up] start - $($pages.Count) pages on $base" -ForegroundColor Cyan

foreach ($path in $pages) {
    $start = Get-Date
    try {
        $response = Invoke-WebRequest -Uri "$base$path" -UseBasicParsing -MaximumRedirection 5 -TimeoutSec 60 -ErrorAction Stop
        $elapsed = ((Get-Date) - $start).TotalMilliseconds
        Write-Host ("  [{0,4} {1,5}ms] {2}" -f $response.StatusCode, [int]$elapsed, $path) -ForegroundColor Green
    }
    catch {
        $elapsed = ((Get-Date) - $start).TotalMilliseconds
        Write-Host ("  [FAIL {0,4}ms] {1} - {2}" -f [int]$elapsed, $path, $_.Exception.Message) -ForegroundColor Yellow
    }
}

Write-Host "[warm-up] done. all pages cached - browser navigation should be near-instant." -ForegroundColor Cyan
