<#
.SYNOPSIS
  Prove the demo works with no internet.

.DESCRIPTION
  The rulebook says the venue provides no connection. This script is the
  rehearsal for that: turn WiFi off, run it, and it walks the whole path a
  judge will see — detector loaded from local weights, API answering, a real
  photo scanned, ingredients resolved, recipes ranked — and reports anything
  that quietly depended on the network.

  Start the stack first (scripts/start-demo.ps1), then disconnect, then run
  this. Anything it flags, fix or cut before exhibition day.

.PARAMETER Photo
  A fridge photo to scan. Defaults to the first file in
  client/src/assets/demo-photos.
#>

[CmdletBinding()]
param(
    [string]$Photo
)

$ErrorActionPreference = 'Stop'

$root      = Split-Path -Parent $PSScriptRoot
$apiUrl    = 'http://127.0.0.1:8000/api'
$visionUrl = 'http://127.0.0.1:8001'

$passed = 0
$failed = 0

function Test-Step {
    param([string]$Name, [scriptblock]$Body)

    try {
        $detail = & $Body
        Write-Host ("  PASS  {0,-34} {1}" -f $Name, $detail) -ForegroundColor Green
        $script:passed++
    } catch {
        Write-Host ("  FAIL  {0,-34} {1}" -f $Name, $_.Exception.Message) -ForegroundColor Red
        $script:failed++
    }
}

Write-Host ''
Write-Host 'Leftover Chef - offline rehearsal' -ForegroundColor White
Write-Host '---------------------------------' -ForegroundColor DarkGray

$online = Test-Connection -ComputerName '1.1.1.1' -Count 1 -Quiet -ErrorAction SilentlyContinue
if ($online) {
    Write-Host '  NOTE  this machine still has internet - turn WiFi off for a real test' -ForegroundColor Yellow
} else {
    Write-Host '  network is down - this is the real test' -ForegroundColor DarkGray
}
Write-Host ''

Test-Step 'vision sidecar is up' {
    $health = Invoke-RestMethod "$visionUrl/health" -TimeoutSec 5
    if (-not $health.detector.ready) { throw $health.detector.error }
    "$($health.detector.backend) / $($health.detector.weights), $($health.detector.class_count) classes"
}

Test-Step 'model weights are local' {
    $files = Get-ChildItem (Join-Path $root 'vision\weights') -Recurse -File
    if ($files.Count -lt 2) { throw 'vision/weights is thin - run scripts/warm-cache.ps1 on WiFi' }
    "$($files.Count) files, $([math]::Round(($files | Measure-Object Length -Sum).Sum / 1MB)) MB"
}

Test-Step 'API is up' {
    $categories = Invoke-RestMethod "$apiUrl/categories" -TimeoutSec 5
    "$($categories.data.Count) categories"
}

Test-Step 'recipe library is seeded' {
    $recipes = Invoke-RestMethod "$apiUrl/recipes" -TimeoutSec 10
    if ($recipes.data.Count -lt 1) { throw 'no recipes - run php artisan db:seed' }
    "$($recipes.data.Count) recipes on page 1"
}

Test-Step 'frontend builds without network assets' {
    $clientDir = Join-Path $root 'client'
    $sourceFiles = Get-ChildItem (Join-Path $clientDir 'src') -Recurse -File |
        Where-Object { $_.Extension -match '\.(js|jsx|css|html)$' }
    $external = $sourceFiles | Select-String -Pattern 'fonts\.googleapis\.com|images\.unsplash\.com|source\.unsplash\.com'
    if ($external) { throw "external asset reference in $($external[0].Path)" }

    Push-Location $clientDir
    try {
        & npm.cmd run build --silent | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'client build failed' }
    } finally {
        Pop-Location
    }

    'bundled fonts and images only'
}

Test-Step 'ingredient search ranks recipes' {
    $body = @{ ingredients = @('onion', 'garlic', 'tomato', 'egg', 'rice') } | ConvertTo-Json
    $result = Invoke-RestMethod "$apiUrl/pantry/search" -Method Post -Body $body -ContentType 'application/json' -TimeoutSec 15
    if ($result.data.Count -lt 1) { throw 'no matches' }
    "$($result.data.Count) matches, $($result.meta.cook_now) cookable now"
}

Test-Step 'alias table resolves detector names' {
    # "capsicum" only reaches Bell Pepper through the alias table. If this one
    # fails, every scan silently loses ingredients.
    $body = @{ ingredients = @('capsicum', 'jeera', 'tin of tomatoes') } | ConvertTo-Json
    $result = Invoke-RestMethod "$apiUrl/pantry/search" -Method Post -Body $body -ContentType 'application/json' -TimeoutSec 15
    if ($result.meta.ingredient_count -lt 3) { throw "only $($result.meta.ingredient_count)/3 names resolved" }
    '3/3 resolved'
}

if (-not $Photo) {
    $sample = Get-ChildItem (Join-Path $root 'client\src\assets\demo-photos') -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Extension -match '\.(jpg|jpeg|png|webp)$' } |
        Select-Object -First 1
    if ($sample) { $Photo = $sample.FullName }
}

if ($Photo -and (Test-Path $Photo)) {
    Test-Step 'photo scan end to end' {
        $json = & curl.exe --silent --show-error --fail --max-time 60 -F "photo=@$Photo" "$apiUrl/pantry/scan"
        if ($LASTEXITCODE -ne 0) { throw 'photo upload failed' }
        $result = $json | ConvertFrom-Json
        "$($result.meta.ingredient_count) ingredients in $([math]::Round($result.meta.elapsed_ms)) ms"
    }
} else {
    Write-Host '  SKIP  photo scan end to end                 no demo photo found' -ForegroundColor Yellow
    Write-Host '        drop 3-4 fridge photos into client/src/assets/demo-photos' -ForegroundColor DarkGray
}

Write-Host ''
Write-Host ("  {0} passed, {1} failed" -f $passed, $failed) -ForegroundColor $(if ($failed) { 'Red' } else { 'Green' })
Write-Host ''

exit $(if ($failed) { 1 } else { 0 })
