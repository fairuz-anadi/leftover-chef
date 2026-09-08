<#
.SYNOPSIS
  One-time setup: dependencies, database, model weights.

.DESCRIPTION
  Run this once on a fresh clone, with internet. After it finishes the machine
  never needs the network again — that is the whole point, since the exhibition
  venue does not provide one.

  Safe to re-run; every step is idempotent.

.PARAMETER SkipVision
  Skip the Python side. Useful if you only want the web app up.

.PARAMETER Fresh
  Drop and rebuild the SQLite database from the seeders.

.EXAMPLE
  .\scripts\setup.ps1
#>

[CmdletBinding()]
param(
    [switch]$SkipVision,
    [switch]$Fresh
)

$ErrorActionPreference = 'Stop'

$root      = Split-Path -Parent $PSScriptRoot
$visionDir = Join-Path $root 'vision'
$clientDir = Join-Path $root 'client'
$venv      = Join-Path $visionDir '.venv'
$venvPython = Join-Path $venv 'Scripts\python.exe'

function Write-Step($message) { Write-Host "`n> $message" -ForegroundColor Cyan }

function Assert-Command($name, $hint) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        throw "$name is not on PATH. $hint"
    }
}

Write-Host ''
Write-Host 'FridgeMama - setup' -ForegroundColor White
Write-Host '---------------------' -ForegroundColor DarkGray

Assert-Command 'php'      'Install PHP 8.2+ and reopen the terminal.'
Assert-Command 'composer' 'Install Composer from getcomposer.org.'
Assert-Command 'npm'      'Install Node 20+ from nodejs.org.'

# -- PHP --------------------------------------------------------------------
Write-Step 'Installing PHP dependencies'
Push-Location $root
composer install --no-interaction --prefer-dist
if ($LASTEXITCODE -ne 0) { throw 'composer install failed' }

if (-not (Test-Path (Join-Path $root '.env'))) {
    Copy-Item (Join-Path $root '.env.example') (Join-Path $root '.env')
    Write-Host '  .env created from .env.example' -ForegroundColor DarkGray
}

if (-not (Select-String -Path (Join-Path $root '.env') -Pattern '^APP_KEY=base64:' -Quiet)) {
    php artisan key:generate
}

# -- Database ---------------------------------------------------------------
Write-Step 'Preparing the database'
$sqlite = Join-Path $root 'database\database.sqlite'
if (-not (Test-Path $sqlite)) { New-Item -ItemType File -Path $sqlite | Out-Null }

if ($Fresh) {
    php artisan migrate:fresh --seed --force
} else {
    php artisan migrate --force
    php artisan db:seed --force
}
if ($LASTEXITCODE -ne 0) { throw 'migrations failed' }
Pop-Location

# -- Client -----------------------------------------------------------------
Write-Step 'Installing client dependencies'
Push-Location $clientDir
npm install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'npm install failed' }
Pop-Location

# -- Vision -----------------------------------------------------------------
if (-not $SkipVision) {
    Assert-Command 'python' 'Install Python 3.10+ from python.org and tick "Add to PATH".'

    Write-Step 'Creating the vision virtualenv'
    if (-not (Test-Path $venvPython)) {
        # --system-site-packages so an existing torch install gets reused
        # instead of pulling another couple of gigabytes.
        python -m venv $venv --system-site-packages
    }

    Write-Step 'Installing vision dependencies (this one takes a while)'
    & $venvPython -m pip install --upgrade pip --quiet
    & $venvPython -m pip install -r (Join-Path $visionDir 'requirements.txt')
    if ($LASTEXITCODE -ne 0) { throw 'pip install failed' }

    Write-Step 'Downloading model weights into vision/weights'
    & (Join-Path $PSScriptRoot 'warm-cache.ps1')
}

Write-Host ''
Write-Host 'Setup done. Start everything with:' -ForegroundColor Green
Write-Host '  .\scripts\start-demo.ps1' -ForegroundColor White
Write-Host ''
