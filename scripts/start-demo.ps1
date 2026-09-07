<#
.SYNOPSIS
  Bring the whole Leftover Chef demo up with one command.

.DESCRIPTION
  Starts the three processes the demo needs — the vision sidecar, the Laravel
  API and the Vite client — each in its own window, waits until they actually
  answer, and opens the browser on the fridge screen.

  This exists because there is no version of "type three commands with a judge
  standing at your desk" that goes well.

  Everything binds to localhost. Nothing here needs the internet once the model
  weights are in vision/weights (see scripts/warm-cache.ps1).

.PARAMETER SkipVision
  Start the API and client only. Use this if the detector is misbehaving and
  you want to fall back to typing ingredients — the rest of the app is fine
  without it.

.PARAMETER NoBrowser
  Do not open a browser window.

.EXAMPLE
  .\scripts\start-demo.ps1
#>

[CmdletBinding()]
param(
    [switch]$SkipVision,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'

$root       = Split-Path -Parent $PSScriptRoot
$visionDir  = Join-Path $root 'vision'
$clientDir  = Join-Path $root 'client'
$venvPython = Join-Path $visionDir '.venv\Scripts\python.exe'

$apiUrl     = 'http://127.0.0.1:8000'
$clientUrl  = 'http://localhost:5173'
$visionUrl  = 'http://127.0.0.1:8001'

function Write-Step($message) { Write-Host "  $message" -ForegroundColor Cyan }
function Write-Ok($message)   { Write-Host "  OK  $message" -ForegroundColor Green }
function Write-Warn($message) { Write-Host "  --  $message" -ForegroundColor Yellow }

function Start-InWindow {
    param([string]$Title, [string]$WorkingDirectory, [string]$Command)

    Start-Process powershell.exe `
        -WorkingDirectory $WorkingDirectory `
        -ArgumentList '-NoExit', '-Command', "`$Host.UI.RawUI.WindowTitle='$Title'; $Command" `
        -WindowStyle Minimized
}

# Poll rather than sleep a fixed amount: a cold YOLO load is a few seconds on a
# warm laptop and noticeably longer on a cold one, and guessing gets it wrong
# in exactly the direction that hurts.
function Wait-ForUrl {
    param([string]$Url, [int]$TimeoutSeconds = 90, [string]$Label = 'service')

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

    while ((Get-Date) -lt $deadline) {
        try {
            Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3 | Out-Null
            return $true
        } catch {
            Start-Sleep -Milliseconds 700
        }
    }

    Write-Warn "$Label did not answer within $TimeoutSeconds seconds ($Url)"
    return $false
}

Write-Host ''
Write-Host 'Leftover Chef - starting demo' -ForegroundColor White
Write-Host '-----------------------------' -ForegroundColor DarkGray

# -- 1. Vision sidecar ------------------------------------------------------
if (-not $SkipVision) {
    if (-not (Test-Path $venvPython)) {
        Write-Warn 'vision/.venv is missing - run scripts/setup.ps1 first. Continuing without the detector.'
    } else {
        Write-Step 'Starting the vision sidecar on :8001 (loading model weights)...'
        Start-InWindow -Title 'Leftover Chef - vision' -WorkingDirectory $visionDir -Command "& '$venvPython' app.py"

        if (Wait-ForUrl -Url "$visionUrl/health" -TimeoutSeconds 120 -Label 'vision sidecar') {
            $health = Invoke-RestMethod -Uri "$visionUrl/health" -TimeoutSec 5
            if ($health.detector.ready) {
                Write-Ok "detector ready - $($health.detector.backend) / $($health.detector.weights), $($health.detector.class_count) classes"
            } else {
                Write-Warn "sidecar is up but has no model: $($health.detector.error)"
            }
        }
    }
} else {
    Write-Warn 'Skipping the vision sidecar (--SkipVision)'
}

# -- 2. Laravel API ---------------------------------------------------------
Write-Step 'Starting the API on :8000...'
Start-InWindow -Title 'Leftover Chef - api' -WorkingDirectory $root -Command 'php artisan serve --host=127.0.0.1 --port=8000'

if (Wait-ForUrl -Url "$apiUrl/api/categories" -TimeoutSeconds 45 -Label 'API') {
    Write-Ok 'API ready'
}

# -- 3. Vite client ---------------------------------------------------------
Write-Step 'Starting the client on :5173...'
Start-InWindow -Title 'Leftover Chef - client' -WorkingDirectory $clientDir -Command 'npm run dev'

if (Wait-ForUrl -Url $clientUrl -TimeoutSeconds 60 -Label 'client') {
    Write-Ok 'Client ready'
}

Write-Host ''
Write-Host '  Fridge screen : ' -NoNewline; Write-Host "$clientUrl/fridge" -ForegroundColor White
Write-Host '  Demo login    : demo@leftoverchef.test / DemoPass123!' -ForegroundColor DarkGray
Write-Host '  Stop it all   : .\scripts\stop-demo.ps1' -ForegroundColor DarkGray
Write-Host ''

if (-not $NoBrowser) {
    Start-Process "$clientUrl/fridge"
}
