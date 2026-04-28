# Move Downloads (26 GB) from C:\ to D:\ + junction back to C:\
# - Existing C:\Users\<u>\Downloads contents preserved (moved, not deleted)
# - Apps that read C:\Users\<u>\Downloads continue to work via junction

$src = "$env:USERPROFILE\Downloads"
$dst = "D:\Users\$env:USERNAME\Downloads"

Write-Host "Source: $src" -ForegroundColor Cyan
Write-Host "Target: $dst" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $src)) {
    Write-Host "Source does not exist - nothing to do." -ForegroundColor Yellow
    return
}

# Check if src is already a junction (rerun safety)
$srcItem = Get-Item $src -Force
if ($srcItem.Attributes.ToString() -like "*ReparsePoint*") {
    Write-Host "Source already a junction - nothing to do (already migrated)." -ForegroundColor Yellow
    return
}

# Create target parent
New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null

# Move all files (robocopy /MOVE)
Write-Host "Moving files via robocopy /MOVE (this takes 10-20 min for 26GB)..." -ForegroundColor Cyan
robocopy $src $dst /E /MOVE /XJ /R:1 /W:1 /MT:8 /NFL /NDL /NP

# Check exit code (robocopy 0-7 are success-ish)
$rc = $LASTEXITCODE
Write-Host "  robocopy exit code: $rc" -ForegroundColor Gray

if ($rc -ge 8) {
    Write-Host "robocopy reported errors (rc >= 8). Aborting before junction creation." -ForegroundColor Red
    return
}

# Remove now-empty source dir if still exists (robocopy /MOVE should have removed)
if (Test-Path $src) {
    if ((Get-ChildItem $src -Force -ErrorAction SilentlyContinue).Count -eq 0) {
        Remove-Item $src -Force -Recurse
    } else {
        Write-Host "Source not empty - some files may not have moved. Manual review needed." -ForegroundColor Yellow
        return
    }
}

# Create junction
New-Item -ItemType Junction -Path $src -Target $dst | Out-Null

Write-Host ""
Write-Host "Done. $src -> junction -> $dst" -ForegroundColor Green
Write-Host "All apps that wrote to C:\Users\$env:USERNAME\Downloads now write to D:\ transparently." -ForegroundColor Green
