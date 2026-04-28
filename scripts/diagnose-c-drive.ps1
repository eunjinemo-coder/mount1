# C: drive space diagnostic - run as Administrator
# Lists top 20 folders + top 20 files by size

Write-Host "=== C:\ Top 20 folders (this takes 3-5 minutes) ===" -ForegroundColor Cyan
Get-ChildItem "C:\" -Directory -Force -ErrorAction SilentlyContinue | ForEach-Object {
    $sum = 0
    try {
        Get-ChildItem $_.FullName -Recurse -File -Force -ErrorAction SilentlyContinue |
            ForEach-Object { $sum += $_.Length }
    } catch {}
    [PSCustomObject]@{
        Path = $_.FullName
        SizeGB = [math]::Round($sum / 1GB, 2)
    }
} | Sort-Object SizeGB -Descending | Select-Object -First 20 | Format-Table -AutoSize

Write-Host ""
Write-Host "=== Top 10 user-folder subdirectories ===" -ForegroundColor Cyan
Get-ChildItem "$env:USERPROFILE" -Directory -Force -ErrorAction SilentlyContinue | ForEach-Object {
    $sum = 0
    try {
        Get-ChildItem $_.FullName -Recurse -File -Force -ErrorAction SilentlyContinue |
            ForEach-Object { $sum += $_.Length }
    } catch {}
    [PSCustomObject]@{
        Path = $_.FullName
        SizeGB = [math]::Round($sum / 1GB, 2)
    }
} | Sort-Object SizeGB -Descending | Select-Object -First 10 | Format-Table -AutoSize

Write-Host ""
Write-Host "=== Top 10 AppData/Local subdirectories (dev caches usually here) ===" -ForegroundColor Cyan
Get-ChildItem "$env:LOCALAPPDATA" -Directory -Force -ErrorAction SilentlyContinue | ForEach-Object {
    $sum = 0
    try {
        Get-ChildItem $_.FullName -Recurse -File -Force -ErrorAction SilentlyContinue |
            ForEach-Object { $sum += $_.Length }
    } catch {}
    [PSCustomObject]@{
        Path = $_.FullName
        SizeGB = [math]::Round($sum / 1GB, 2)
    }
} | Sort-Object SizeGB -Descending | Select-Object -First 10 | Format-Table -AutoSize

Write-Host ""
Write-Host "=== Quick wins (run as Admin to actually free space) ===" -ForegroundColor Yellow
Write-Host "  1. Hibernation file:"
$hiberfil = "C:\hiberfil.sys"
if (Test-Path $hiberfil) {
    $hSize = [math]::Round((Get-Item $hiberfil -Force).Length / 1GB, 2)
    Write-Host "       hiberfil.sys = $hSize GB  (run: powercfg /hibernate off)" -ForegroundColor Yellow
}

Write-Host "  2. Recycle bin:"
try {
    $shell = New-Object -ComObject Shell.Application
    $bin = $shell.Namespace(10)
    $binSize = 0
    $bin.Items() | ForEach-Object { $binSize += $_.Size }
    $binGB = [math]::Round($binSize / 1GB, 2)
    Write-Host "       Recycle Bin = $binGB GB  (run: Clear-RecycleBin -Force)" -ForegroundColor Yellow
} catch {
    Write-Host "       (size unknown)" -ForegroundColor Yellow
}

Write-Host "  3. Windows.old (previous Windows backup):"
if (Test-Path "C:\Windows.old") {
    Write-Host "       FOUND - usually 10-30 GB. Use 'Disk Cleanup' app -> 'Previous Windows installations'" -ForegroundColor Yellow
} else {
    Write-Host "       Not present" -ForegroundColor Gray
}

Write-Host "  4. Page file (pagefile.sys):"
$pagefile = "C:\pagefile.sys"
if (Test-Path $pagefile) {
    $pSize = [math]::Round((Get-Item $pagefile -Force).Length / 1GB, 2)
    Write-Host "       pagefile.sys = $pSize GB  (system-managed, can be moved to D:\ via System Properties)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan
