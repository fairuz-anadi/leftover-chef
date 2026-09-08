<#
.SYNOPSIS
  One-time: fetch everything needed to build the Android APK.

.DESCRIPTION
  A JDK, the Android SDK and Gradle - about 1 GB, downloaded once, into
  ..\android-toolchain beside the repo rather than inside it. Nothing is added
  to PATH and nothing is installed system-wide; scripts/build-apk.ps1 points at
  this directory itself.

  You do not need Android Studio. You do need internet for this one script, and
  then never again.

  If you only want the app on a phone and not a file to hand around, skip all
  of this: the web app installs to a home screen from the browser with no
  toolchain at all. The APK exists for the case where somebody wants a real
  .apk to sideload.

.PARAMETER Toolchain
  Where to put it. Defaults to ..\android-toolchain beside the repo.

.EXAMPLE
  .\scripts\setup-android.ps1
#>

[CmdletBinding()]
param(
    [string]$Toolchain
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # the progress bar makes downloads crawl

$root = Split-Path -Parent $PSScriptRoot
if (-not $Toolchain) {
    $Toolchain = Join-Path (Split-Path -Parent $root) 'android-toolchain'
}

# Pinned. A build that quietly changes toolchain versions between rehearsal and
# the venue is a build you cannot trust.
$JDK_URL     = 'https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse'
$TOOLS_URL   = 'https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip'
$GRADLE_VER  = '8.11.1'
$GRADLE_URL  = "https://services.gradle.org/distributions/gradle-$GRADLE_VER-all.zip"
$PLATFORM    = 'android-35'
$BUILD_TOOLS = '35.0.0'

function Write-Step($message) { Write-Host "  $message" -ForegroundColor Cyan }
function Write-Ok($message)   { Write-Host "  OK  $message" -ForegroundColor Green }

function Get-File {
    param([string]$Url, [string]$Path, [string]$Label)

    if (Test-Path $Path) {
        Write-Ok "$Label already downloaded"
        return
    }

    Write-Step "Downloading $Label..."
    Invoke-WebRequest -Uri $Url -OutFile $Path -UseBasicParsing -TimeoutSec 1800
    Write-Ok "$Label - $([math]::Round((Get-Item $Path).Length / 1MB, 1)) MB"
}

Write-Host ''
Write-Host 'FridgeMama - Android toolchain' -ForegroundColor White
Write-Host '------------------------------' -ForegroundColor DarkGray
Write-Host "  into $Toolchain" -ForegroundColor DarkGray
Write-Host ''

New-Item -ItemType Directory -Force -Path $Toolchain | Out-Null

# -- 1. JDK -----------------------------------------------------------------
Get-File -Url $JDK_URL -Path "$Toolchain\jdk21.zip" -Label 'JDK 21'
if (-not (Get-ChildItem "$Toolchain\jdk" -Directory -ErrorAction SilentlyContinue)) {
    Write-Step 'Extracting the JDK...'
    Expand-Archive -Path "$Toolchain\jdk21.zip" -DestinationPath "$Toolchain\jdk" -Force
}
$jdk = (Get-ChildItem "$Toolchain\jdk" -Directory | Select-Object -First 1).FullName
Write-Ok "JDK at $jdk"

$env:JAVA_HOME = $jdk
$env:Path = "$jdk\bin;$env:Path"

# -- 2. Android command-line tools ------------------------------------------
Get-File -Url $TOOLS_URL -Path "$Toolchain\cmdline-tools.zip" -Label 'Android command-line tools'

$sdk = Join-Path $Toolchain 'sdk'
$sdkManager = "$sdk\cmdline-tools\latest\bin\sdkmanager.bat"

if (-not (Test-Path $sdkManager)) {
    Write-Step 'Extracting the SDK tools...'
    Expand-Archive -Path "$Toolchain\cmdline-tools.zip" -DestinationPath "$Toolchain\sdk-tmp" -Force
    # sdkmanager insists on living at <sdk>/cmdline-tools/latest/ and will
    # refuse to run from anywhere else.
    New-Item -ItemType Directory -Force -Path "$sdk\cmdline-tools" | Out-Null
    Move-Item "$Toolchain\sdk-tmp\cmdline-tools" "$sdk\cmdline-tools\latest"
    Remove-Item -Recurse -Force "$Toolchain\sdk-tmp" -ErrorAction SilentlyContinue
}

# -- 3. Licences ------------------------------------------------------------
# Google's documented non-interactive route: the SHA-1 of each licence text,
# written where sdkmanager looks. Piping "y" at the prompt does not work
# reliably from a script, and a build that stops for a keystroke is no use
# inside another script.
Write-Step 'Accepting the SDK licences...'
$licences = Join-Path $sdk 'licenses'
New-Item -ItemType Directory -Force -Path $licences | Out-Null

@{
    'android-sdk-license'         = @(
        '8933bad161af4178b1185d1a37fbf41ea5269c55',
        'd56f5187479451eabf01fb78af6dfcb131a6481e',
        '24333f8a63b6825ea9c5514f83c2829b004d1fee'
    )
    'android-sdk-preview-license' = @('84831b9409646a918e30573bab4c9c91346d8abd')
    'android-sdk-arm-dbt-license' = @('859f317696f67ef3d7f30a50a5560e7834b43903')
}.GetEnumerator() | ForEach-Object {
    Set-Content -Path (Join-Path $licences $_.Key) -Value ($_.Value -join "`n") `
        -Encoding ascii -NoNewline
}

# -- 4. SDK packages --------------------------------------------------------
if (Test-Path "$sdk\build-tools\$BUILD_TOOLS") {
    Write-Ok "SDK packages already installed"
} else {
    Write-Step "Installing platform-tools, $PLATFORM and build-tools $BUILD_TOOLS..."
    & $sdkManager --sdk_root="$sdk" 'platform-tools' "platforms;$PLATFORM" "build-tools;$BUILD_TOOLS" | Out-Null
    if (-not (Test-Path "$sdk\build-tools\$BUILD_TOOLS")) { throw 'the SDK packages did not install' }
    Write-Ok 'SDK packages installed'
}

# -- 5. Gradle --------------------------------------------------------------
# The Gradle wrapper downloads its own distribution with a ten-second connect
# timeout that a slow link loses every time. Fetching it here and pointing the
# wrapper at the local file makes the build work offline afterwards, too.
Get-File -Url $GRADLE_URL -Path "$Toolchain\gradle-$GRADLE_VER-all.zip" -Label "Gradle $GRADLE_VER"

$wrapper = Join-Path $root 'client\android\gradle\wrapper\gradle-wrapper.properties'
if (Test-Path $wrapper) {
    $localZip = (Resolve-Path "$Toolchain\gradle-$GRADLE_VER-all.zip").Path
    $uri = ([System.Uri]$localZip).AbsoluteUri -replace ':', '\:'
    (Get-Content $wrapper) `
        -replace '^distributionUrl=.*$', "distributionUrl=$uri" `
        -replace '^networkTimeout=.*$', 'networkTimeout=60000' |
        Set-Content $wrapper -Encoding ascii
    Write-Ok 'Gradle wrapper pointed at the local distribution'
}

# -- 6. Capacitor -----------------------------------------------------------
Write-Step 'Checking Capacitor...'
Push-Location (Join-Path $root 'client')
try {
    if (-not (Test-Path 'node_modules\@capacitor\android')) {
        & npm.cmd install | Out-Null
    }
} finally {
    Pop-Location
}
Write-Ok 'Capacitor ready'

Write-Host ''
Write-Host '  Done. Build the APK with:' -ForegroundColor White
Write-Host '    .\scripts\build-apk.ps1' -ForegroundColor Cyan
Write-Host ''
