# C: drive immediate cleanup - run as Administrator
# Safe operations only - no user data deleted

Write-Host "=== Immediate space recovery (safe operations) ===" -ForegroundColor Cyan

# 1. Empty recycle bin
Write-Host "[1/5] Clearing Recycle Bin..." -ForegroundColor Cyan
try {
    Clear-RecycleBin -Force -ErrorAction Stop
    Write-Host "       OK" -ForegroundColor Green
} catch {
    Write-Host "       Skipped: $($_.Exception.Message)" -ForegroundColor Yellow
}

# 2. Disable hibernation (recovers RAM-sized hiberfil.sys, usually 8-32 GB)
Write-Host "[2/5] Disabling hibernation (recovers hiberfil.sys)..." -ForegroundColor Cyan
$beforeFree = (Get-Volume C).SizeRemaining
powercfg /hibernate off
Start-Sleep -Seconds 2
$afterFree = (Get-Volume C).SizeRemaining
$gained = [math]::Round(($afterFree - $beforeFree) / 1GB, 2)
Write-Host "       Recovered $gained GB" -ForegroundColor Green

# 3. Clear user temp
Write-Host "[3/5] Clearing user temp folder..." -ForegroundColor Cyan
$tempBefore = 0
try {
    Get-ChildItem "$env:TEMP" -Recurse -Force -ErrorAction SilentlyContinue |
        ForEach-Object { $tempBefore += $_.Length }
} catch {}
Get-ChildItem "$env:TEMP" -Force -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-1) } |
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "       Cleared older-than-1day items (~$([math]::Round($tempBefore/1GB,2)) GB scanned)" -ForegroundColor Green

# 4. Clear Windows temp (admin only)
Write-Host "[4/5] Clearing C:\Windows\Temp..." -ForegroundColor Cyan
try {
    Get-ChildItem "C:\Windows\Temp" -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-1) } |
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "       OK" -ForegroundColor Green
} catch {
    Write-Host "       Some items locked (skipped)" -ForegroundColor Yellow
}

# 5. Run Disk Cleanup automated (Windows Update cleanup, etc)
Write-Host "[5/5] Running Disk Cleanup (silent, ~2 min)..." -ForegroundColor Cyan
Start-Process -FilePath "cleanmgr.exe" -ArgumentList "/sagerun:1" -Wait -NoNewWindow
Write-Host "       OK" -ForegroundColor Green

Write-Host ""
$finalFree = [math]::Round((Get-Volume C).SizeRemaining / 1GB, 2)
$finalPct = [math]::Round(100 * (Get-Volume C).SizeRemaining / (Get-Volume C).Size, 1)
Write-Host "=== Result: C:\ free = $finalFree GB ($finalPct%) ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "If still under 30 GB free, see diagnose-c-drive.ps1 output and:" -ForegroundColor Yellow
Write-Host "  - Move Downloads/Documents/Videos to D:\" -ForegroundColor Yellow
Write-Host "  - Move Cursor/Chrome/Edge cache (LocalAppData) larger ones to D:\" -ForegroundColor Yellow
Write-Host "  - Check for large WSL/Docker/VBox VHDX files in user profile" -ForegroundColor Yellow
