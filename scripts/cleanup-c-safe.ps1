# Safe automated cleanup - all reversible / regenerated
# Run as Administrator

$beforeFreeGB = [math]::Round((Get-Volume C).SizeRemaining / 1GB, 2)
Write-Host "=== Before: C:\ free = $beforeFreeGB GB ===" -ForegroundColor Cyan
Write-Host ""

function Show-Step($n, $title) {
    Write-Host "[$n] $title" -ForegroundColor Cyan
}

# 1. npm cache
Show-Step 1 "Clearing npm cache..."
try {
    & npm cache clean --force 2>$null
    Write-Host "       OK" -ForegroundColor Green
} catch { Write-Host "       skipped (npm not in PATH)" -ForegroundColor Yellow }

# 2. pnpm cache prune
Show-Step 2 "Pruning pnpm store (unreferenced packages)..."
try {
    & pnpm store prune 2>$null
    Write-Host "       OK" -ForegroundColor Green
} catch { Write-Host "       skipped" -ForegroundColor Yellow }

# 3. pip cache
Show-Step 3 "Clearing pip cache..."
try {
    & pip cache purge 2>$null
    Write-Host "       OK" -ForegroundColor Green
} catch { Write-Host "       skipped (pip not in PATH)" -ForegroundColor Yellow }

# 4. uv cache
Show-Step 4 "Clearing uv cache..."
try {
    & uv cache clean 2>$null
    Write-Host "       OK" -ForegroundColor Green
} catch { Write-Host "       skipped (uv not in PATH)" -ForegroundColor Yellow }

# 5. Chrome cache
Show-Step 5 "Clearing Chrome cache..."
$chromeCache = "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Cache"
if (Test-Path $chromeCache) {
    Get-ChildItem $chromeCache -Recurse -Force -ErrorAction SilentlyContinue |
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "       OK" -ForegroundColor Green
} else { Write-Host "       (not present)" -ForegroundColor Gray }

# 6. Edge cache
Show-Step 6 "Clearing Edge cache..."
$edgeCache = "$env:LOCALAPPDATA\Microsoft\Edge\User Data\Default\Cache"
if (Test-Path $edgeCache) {
    Get-ChildItem $edgeCache -Recurse -Force -ErrorAction SilentlyContinue |
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "       OK" -ForegroundColor Green
} else { Write-Host "       (not present)" -ForegroundColor Gray }

# 7. Hibernation off (if not already)
Show-Step 7 "Disabling hibernation (recovers RAM-sized hiberfil.sys)..."
& powercfg /hibernate off
Write-Host "       OK" -ForegroundColor Green

# 8. Recycle Bin
Show-Step 8 "Emptying Recycle Bin..."
try {
    Clear-RecycleBin -Force -ErrorAction Stop
    Write-Host "       OK" -ForegroundColor Green
} catch { Write-Host "       skipped" -ForegroundColor Yellow }

# 9. User temp older than 1 day
Show-Step 9 "Clearing user temp (>1 day old)..."
Get-ChildItem "$env:TEMP" -Force -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-1) } |
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "       OK" -ForegroundColor Green

# 10. Windows temp older than 1 day
Show-Step 10 "Clearing C:\Windows\Temp..."
Get-ChildItem "C:\Windows\Temp" -Force -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-1) } |
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "       OK" -ForegroundColor Green

Write-Host ""
$afterFreeGB = [math]::Round((Get-Volume C).SizeRemaining / 1GB, 2)
$gainGB = [math]::Round($afterFreeGB - $beforeFreeGB, 2)
Write-Host "=== After: C:\ free = $afterFreeGB GB  (gained $gainGB GB) ===" -ForegroundColor Cyan
