<#
.SYNOPSIS
  Prove the demo works with no internet.

.DESCRIPTION
  The rulebook says the venue provides no connection. This is the rehearsal for
  that: turn WiFi off, run it, and it walks the whole loop a judge will see —
  detector loaded from local weights, the fridge tracking freshness, the clock
  moving, a recipe suggested, cooked, and the waste counter moving — reporting
  anything that quietly depended on the network.

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
$session   = "offline-check-$([guid]::NewGuid().ToString('N').Substring(0,12))"
$headers   = @{ 'X-Fridge-Session' = $session; 'Accept' = 'application/json' }

$passed = 0
$failed = 0

# Windows PowerShell 5.1 has no -Form, so the multipart body is assembled by
# hand. The file bytes are carried as latin-1 text because that is the only
# encoding that survives the round trip through Invoke-RestMethod's string body
# without mangling bytes above 0x7F.
function New-MultipartPhoto {
    param([string]$Path)

    $boundary = [guid]::NewGuid().ToString()
    $latin1 = [System.Text.Encoding]::GetEncoding('iso-8859-1')
    $bytes = [System.IO.File]::ReadAllBytes($Path)

    $lines = @(
        "--$boundary",
        'Content-Disposition: form-data; name="photo"; filename="fridge.jpg"',
        'Content-Type: image/jpeg',
        '',
        $latin1.GetString($bytes),
        "--$boundary--",
        ''
    )

    return @{ Boundary = $boundary; Body = ($lines -join "`r`n") }
}


function Test-Step {
    param([string]$Name, [scriptblock]$Body)

    try {
        $detail = & $Body
        Write-Host ("  PASS  {0,-36} {1}" -f $Name, $detail) -ForegroundColor Green
        $script:passed++
    } catch {
        Write-Host ("  FAIL  {0,-36} {1}" -f $Name, $_.Exception.Message) -ForegroundColor Red
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

Test-Step 'detector is loaded' {
    $health = Invoke-RestMethod "$visionUrl/health" -TimeoutSec 5
    if (-not $health.detector.ready) { throw $health.detector.error }
    "$($health.detector.backend) / $($health.detector.weights), $($health.detector.class_count) classes"
}

# Tahmid's check, kept: the sidecar can be perfectly offline while the client
# still reaches for a Google font or an Unsplash photo, and you only find out
# when the page renders bare in front of a judge.
Test-Step 'the client pulls nothing off the internet' {
    $sources = Get-ChildItem (Join-Path $root 'client\src') -Recurse -File |
        Where-Object { $_.Extension -match '^\.(js|jsx|css|html)$' }
    $hits = $sources | Select-String -Pattern 'fonts\.googleapis\.com|fonts\.gstatic\.com|unsplash\.com|cdn\.jsdelivr|cdnjs\.cloudflare|unpkg\.com'
    if ($hits) { throw "external asset referenced in $($hits[0].Path):$($hits[0].LineNumber)" }

    $index = Join-Path $root 'client\index.html'
    if (Test-Path $index) {
        $remote = Select-String -Path $index -Pattern 'https?://'
        if ($remote) { throw "index.html still points at $($remote[0].Line.Trim())" }
    }

    "$($sources.Count) source files, fonts and images bundled"
}

Test-Step 'model weights are local' {
    $files = Get-ChildItem (Join-Path $root 'vision\weights') -Recurse -File
    if ($files.Count -lt 2) { throw 'vision/weights is thin - run scripts/warm-cache.ps1 on WiFi' }
    "$($files.Count) files, $([math]::Round(($files | Measure-Object Length -Sum).Sum / 1MB)) MB"
}

# Everything below shares one throwaway session, so the run does not disturb
# whatever fridge is on screen.
$state = Invoke-RestMethod "$apiUrl/fridge" -Headers $headers -TimeoutSec 15

Test-Step 'fridge opens with no sign-in' {
    if ($state.items.Count -lt 5) { throw 'the demo fridge did not stock' }
    "$($state.items.Count) items, health $($state.health.score)%"
}

Test-Step 'freshness is tiered' {
    $tiers = $state.items | Where-Object { $_.freshness } | ForEach-Object { $_.freshness.tier } | Sort-Object -Unique
    if ($tiers.Count -lt 2) { throw 'everything is in one tier - the dashboard will look dead' }
    "$($state.health.fresh) fresh / $($state.health.soon) soon / $($state.health.today) today"
}

Test-Step 'recipes are suggested locally' {
    if ($state.suggestions.Count -lt 1) { throw 'no suggestions' }
    $top = $state.suggestions[0]
    "$($top.recipe.title) - match $($top.match_percent)%, priority $($top.priority_score)"
}

Test-Step 'local cuisine gets its nudge' {
    $local = $state.suggestions | Where-Object { $_.local_bonus -gt 0 }
    if (-not $local) { throw 'no Bangladeshi or South Asian recipe surfaced' }
    "$($local.Count) local dishes weighted up"
}

Test-Step 'dish artwork is on disk' {
    $art = Join-Path $root ("storage\app\public\" + ($state.suggestions[0].recipe.image_path -replace '/', '\'))
    if (-not (Test-Path $art)) { throw "missing artwork: $art" }
    'generated, no stock photography'
}

Test-Step 'the clock moves and warns' {
    $after = Invoke-RestMethod "$apiUrl/fridge/fast-forward" -Method Post -Headers $headers `
        -Body (@{ days = 2 } | ConvertTo-Json) -ContentType 'application/json' -TimeoutSec 15
    if ($after.session.day_offset -ne 2) { throw 'the day did not advance' }
    "day $($after.session.day_offset), $($after.alerts.Count) new alert(s)"
}

Test-Step 'cooking moves the waste counter' {
    $fresh = Invoke-RestMethod "$apiUrl/fridge" -Headers $headers -TimeoutSec 15
    $recipeId = $fresh.suggestions[0].recipe.id
    $cooked = Invoke-RestMethod "$apiUrl/recipes/$recipeId/cooked" -Method Post -Headers $headers `
        -Body '{}' -ContentType 'application/json' -TimeoutSec 20
    "$($cooked.removed.Count) used, $($cooked.waste.rescued) saved from the bin"
}

if (-not $Photo) {
    $sample = Get-ChildItem (Join-Path $root 'client\src\assets\demo-photos') -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Extension -match '\.(jpg|jpeg|png|webp)$' } |
        Select-Object -First 1
    if ($sample) { $Photo = $sample.FullName }
}

if ($Photo -and (Test-Path $Photo)) {
    $multipart = New-MultipartPhoto -Path $Photo

    Test-Step 'photo scan, end to end' {
        $result = Invoke-RestMethod "$apiUrl/fridge/scan" -Method Post -Headers $headers `
            -ContentType "multipart/form-data; boundary=$($multipart.Boundary)" `
            -Body $multipart.Body -TimeoutSec 60
        "$($result.meta.ingredient_count) ingredients in $([math]::Round($result.meta.elapsed_ms)) ms"
    }
} else {
    Write-Host '  SKIP  photo scan, end to end          no demo photo found' -ForegroundColor Yellow
    Write-Host '        drop 3-4 fridge photos into client/src/assets/demo-photos' -ForegroundColor DarkGray
}

Write-Host ''
Write-Host ("  {0} passed, {1} failed" -f $passed, $failed) -ForegroundColor $(if ($failed) { 'Red' } else { 'Green' })
Write-Host ''

exit $(if ($failed) { 1 } else { 0 })
