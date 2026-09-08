<#
.SYNOPSIS
  Build FridgeMama.apk — the installable Android app.

.DESCRIPTION
  Wraps the same web client in a native shell with Capacitor and hands back a
  single .apk you can sideload onto any Android phone, including a judge's.

  The APK carries the screens, not the fridge. The detector, the recipes and
  the shelf all still live on the laptop — so the app has to be told where the
  laptop is. That address is baked in at build time (so the APK you hand
  somebody already knows) and is still editable inside the app (because the
  address changes the moment you switch to a different hotspot).

  Run scripts/setup-android.ps1 once first. It fetches the JDK, the Android
  SDK and Gradle into ..\android-toolchain, outside this repo.

.PARAMETER Kitchen
  The laptop's address to bake in, e.g. 192.168.0.203. Detected from this
  machine's network if omitted.

.PARAMETER Toolchain
  Where setup-android.ps1 put the JDK and SDK. Defaults to ..\android-toolchain
  beside the repo.

.EXAMPLE
  .\scripts\build-apk.ps1
  .\scripts\build-apk.ps1 -Kitchen 192.168.43.1
#>

[CmdletBinding()]
param(
    [string]$Kitchen,
    [string]$Toolchain
)

$ErrorActionPreference = 'Stop'

$root      = Split-Path -Parent $PSScriptRoot
$clientDir = Join-Path $root 'client'
$androidDir = Join-Path $clientDir 'android'

if (-not $Toolchain) {
    $Toolchain = Join-Path (Split-Path -Parent $root) 'android-toolchain'
}

function Write-Step($message) { Write-Host "  $message" -ForegroundColor Cyan }
function Write-Ok($message)   { Write-Host "  OK  $message" -ForegroundColor Green }
function Write-Warn($message) { Write-Host "  --  $message" -ForegroundColor Yellow }

Write-Host ''
Write-Host 'FridgeMama - building the APK' -ForegroundColor White
Write-Host '-----------------------------' -ForegroundColor DarkGray

# -- 1. The toolchain -------------------------------------------------------
$jdk = Get-ChildItem (Join-Path $Toolchain 'jdk') -Directory -ErrorAction SilentlyContinue |
    Select-Object -First 1

if (-not $jdk) {
    throw "No JDK under $Toolchain\jdk - run .\scripts\setup-android.ps1 first."
}

$sdk = Join-Path $Toolchain 'sdk'
if (-not (Test-Path (Join-Path $sdk 'platform-tools'))) {
    throw "No Android SDK under $sdk - run .\scripts\setup-android.ps1 first."
}

$env:JAVA_HOME       = $jdk.FullName
$env:ANDROID_HOME    = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$env:Path            = "$($jdk.FullName)\bin;$env:Path"

# Gradle resolves the SDK from here rather than the environment, and this file
# is one machine's absolute path, so it is written rather than committed.
#
# Forward slashes on purpose. This is a Java .properties file, in which a
# backslash is an escape character: "D:\Project\..." reads back mangled and
# Gradle fails with a message about volume label syntax that names nothing
# useful and points at no file.
Set-Content -Path (Join-Path $androidDir 'local.properties') `
    -Value "sdk.dir=$($sdk -replace '\\', '/')" -Encoding ascii

Write-Ok "JDK $($jdk.Name)"

# Gradle's wrapper fetches its own 210 MB distribution with a timeout that a
# normal connection loses, so point it at the copy setup-android.ps1 already
# downloaded. This edits a tracked file; the change is one machine's absolute
# path and is not meant to be committed.
$gradleZip = Get-ChildItem $Toolchain -Filter 'gradle-*-all.zip' -File -ErrorAction SilentlyContinue |
    Select-Object -First 1

if ($gradleZip) {
    $wrapperProps = Join-Path $androidDir 'gradle\wrapper\gradle-wrapper.properties'
    $uri = ([System.Uri]$gradleZip.FullName).AbsoluteUri -replace ':', '\:'
    (Get-Content $wrapperProps) -replace '^distributionUrl=.*$', "distributionUrl=$uri" |
        Set-Content $wrapperProps -Encoding ascii
    Write-Ok "Gradle from $($gradleZip.Name)"
}

# -- 2. Which laptop is this app going to talk to? --------------------------
if (-not $Kitchen) {
    # Loopback is no use to a phone, and link-local means Windows gave up on
    # DHCP - baking either in would produce an APK that cannot work.
    $Kitchen = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object {
            $_.IPAddress -notmatch '^(127\.|169\.254\.)' -and $_.AddressState -eq 'Preferred'
        } |
        Sort-Object -Property InterfaceMetric |
        Select-Object -First 1).IPAddress
}

if (-not $Kitchen) {
    Write-Warn 'No network address found. Building anyway - the app will ask for one on first run.'
    $kitchenUrl = ''
} else {
    $kitchenUrl = if ($Kitchen -match '^https?://') { $Kitchen } else { "http://${Kitchen}:8000" }
    Write-Ok "kitchen baked in: $kitchenUrl"
}

# -- 3. Build the web app ---------------------------------------------------
Write-Step 'Building the client...'
Push-Location $clientDir
try {
    $env:VITE_KITCHEN_HOST = $kitchenUrl
    & npm.cmd run build | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'the client build failed - run npm run build in client/ to see why' }

    Write-Step 'Copying it into the Android project...'
    & npx.cmd cap sync android | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'cap sync failed' }
} finally {
    Pop-Location
}
Write-Ok 'Client built and synced'

# -- 4. Gradle --------------------------------------------------------------
Write-Step 'Compiling the APK (first run is slow)...'
Push-Location $androidDir
try {
    # No 2>&1 here. In Windows PowerShell 5.1 redirecting a native command's
    # stderr wraps every line in an ErrorRecord, so javac's routine
    # "Note: some input files use unchecked operations" becomes a terminating
    # error and kills a build that actually succeeded. Gradle's own output is
    # already on the console; the exit code is the thing to trust.
    $log = Join-Path $env:TEMP 'fridgemama-gradle.log'
    & .\gradlew.bat assembleDebug --no-daemon --console=plain | Tee-Object -FilePath $log | Out-Null

    if ($LASTEXITCODE -ne 0) {
        Get-Content $log -Tail 40 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
        throw "the Gradle build failed - full log at $log"
    }
} finally {
    Pop-Location
}

# -- 5. Hand it over --------------------------------------------------------
$built = Join-Path $androidDir 'app\build\outputs\apk\debug\app-debug.apk'
if (-not (Test-Path $built)) { throw "Gradle reported success but there is no APK at $built" }

$apk = Join-Path $root 'FridgeMama.apk'
Copy-Item $built $apk -Force
$sizeMb = [math]::Round((Get-Item $apk).Length / 1MB, 1)

Write-Host ''
Write-Ok "FridgeMama.apk - $sizeMb MB"
Write-Host ''
Write-Host '  It is at    : ' -NoNewline; Write-Host $apk -ForegroundColor White
Write-Host '  Talks to    : ' -NoNewline; Write-Host $(if ($kitchenUrl) { $kitchenUrl } else { '(asks on first run)' }) -ForegroundColor White
Write-Host ''
Write-Host '  To install: copy it to the phone and open it. Android will ask to' -ForegroundColor DarkGray
Write-Host '  allow installing from this source - that is the sideload warning,' -ForegroundColor DarkGray
Write-Host '  and it is expected for an app that is not from the Play Store.' -ForegroundColor DarkGray
Write-Host ''
Write-Host '  The laptop must be running scripts/start-demo.ps1 and on the same' -ForegroundColor DarkGray
Write-Host '  WiFi. The APK is the screens; the laptop is the fridge.' -ForegroundColor DarkGray
Write-Host ''
