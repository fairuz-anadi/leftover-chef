<#
.SYNOPSIS
  Pull every model file into vision/weights so the venue never needs internet.

.DESCRIPTION
  Loads both detector backends once. Each load downloads what it is missing and
  leaves it in vision/weights — the YOLO-World checkpoint, the COCO fallback,
  and the ~350 MB CLIP text encoder that YOLO-World needs to turn the prompt
  list into embeddings.

  Run this at home, on WiFi, the day before. Then run scripts/offline-check.ps1
  with the network off to prove it worked.
#>

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$root       = Split-Path -Parent $PSScriptRoot
$visionDir  = Join-Path $root 'vision'
$venvPython = Join-Path $visionDir '.venv\Scripts\python.exe'
$weightsDir = Join-Path $visionDir 'weights'

if (-not (Test-Path $venvPython)) {
    throw "vision/.venv is missing - run scripts/setup.ps1 first."
}

Write-Host ''
Write-Host 'Warming the model cache (needs internet the first time)' -ForegroundColor Cyan

foreach ($backend in @('world', 'coco')) {
    Write-Host "  loading $backend ..." -ForegroundColor DarkGray

    $env:LC_BACKEND = $backend
    & $venvPython -c "from detector import Detector; d = Detector(); d.load(); print('   ', d.describe())" 2>&1 |
        Select-String -Pattern "ready|error" |
        ForEach-Object { Write-Host "  $_" }
}

Remove-Item Env:\LC_BACKEND -ErrorAction SilentlyContinue

Write-Host ''
Write-Host 'Cached in vision/weights:' -ForegroundColor Green

Get-ChildItem -Path $weightsDir -Recurse -File | ForEach-Object {
    '{0,10:N1} MB  {1}' -f ($_.Length / 1MB), $_.Name
} | Write-Host

Write-Host ''
