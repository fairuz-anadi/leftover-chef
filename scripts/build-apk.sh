#!/usr/bin/env bash
# Build FridgeMama.apk on macOS / Linux
# Wraps the web client in a native Capacitor Android shell and builds a debug APK.

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLIENT_DIR="$DIR/client"
ANDROID_DIR="$CLIENT_DIR/android"
OUTPUT_APK="$DIR/FridgeMama.apk"

KITCHEN_HOST=""
SERVE_AFTER=false

for arg in "$@"; do
  case $arg in
    --kitchen=*) KITCHEN_HOST="${arg#*=}" ;;
    --serve) SERVE_AFTER=true ;;
  esac
done

echo ""
echo "FridgeMama - Android APK Build (macOS/Linux)"
echo "-------------------------------------------"

# 1. Detect Network IP if not supplied
if [ -z "$KITCHEN_HOST" ]; then
  LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || true)
  if [ -n "$LOCAL_IP" ]; then
    KITCHEN_HOST="http://${LOCAL_IP}:8000"
    echo "  OK  Detected kitchen laptop address: $KITCHEN_HOST"
  else
    echo "  --  No local IP detected; app will ask for kitchen address on first launch."
  fi
fi

# 2. Check Java / JDK
if ! command -v java >/dev/null 2>&1; then
  if [ -d "/opt/homebrew/opt/openjdk@17" ]; then
    export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
    export PATH="$JAVA_HOME/bin:$PATH"
  elif [ -d "/Library/Java/JavaVirtualMachines" ] && [ "$(ls -A /Library/Java/JavaVirtualMachines 2>/dev/null)" ]; then
    export JAVA_HOME=$(/usr/libexec/java_home 2>/dev/null || true)
  fi
fi

if ! command -v java >/dev/null 2>&1; then
  echo "  ERROR: Java (JDK 17 or 21) is not installed."
  echo "  To install via Homebrew, run: brew install openjdk@17"
  echo "  Or push to GitHub to use the automated GitHub Actions build!"
  exit 1
fi
echo "  OK  Using Java: $(java -version 2>&1 | head -n 1)"

# 3. Check Android SDK
if [ -z "$ANDROID_HOME" ]; then
  if [ -d "$HOME/Library/Android/sdk" ]; then
    export ANDROID_HOME="$HOME/Library/Android/sdk"
  elif [ -d "/opt/homebrew/share/android-commandlinetools" ]; then
    export ANDROID_HOME="/opt/homebrew/share/android-commandlinetools"
  fi
fi

if [ -z "$ANDROID_HOME" ] || [ ! -d "$ANDROID_HOME" ]; then
  echo "  ERROR: ANDROID_HOME is not set or Android SDK is missing."
  echo "  Please install Android Studio or Android command line tools,"
  echo "  or push to GitHub to have GitHub Actions build the APK in the cloud!"
  exit 1
fi
echo "  OK  Using Android SDK at: $ANDROID_HOME"

# Write local.properties for Gradle
echo "sdk.dir=$ANDROID_HOME" > "$ANDROID_DIR/local.properties"

# 4. Build Vite Client
echo "  Building web client..."
cd "$CLIENT_DIR"
export VITE_KITCHEN_HOST="$KITCHEN_HOST"
npm run build

# 5. Sync Capacitor
echo "  Syncing assets with Capacitor Android..."
npx cap sync android

# 6. Compile APK with Gradle
echo "  Compiling APK via Gradle..."
cd "$ANDROID_DIR"
chmod +x gradlew
./gradlew assembleDebug --no-daemon

# 7. Copy out APK
BUILT_APK="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
if [ -f "$BUILT_APK" ]; then
  cp "$BUILT_APK" "$OUTPUT_APK"
  echo ""
  echo "  SUCCESS! APK generated at:"
  echo "  $OUTPUT_APK"
  echo ""
  if [ "$SERVE_AFTER" = true ] && [ -n "$LOCAL_IP" ]; then
    echo "  Starting local APK download server on port 8080..."
    echo "  Download on phone: http://${LOCAL_IP}:8080/FridgeMama.apk"
    cd "$DIR"
    python3 -m http.server 8080
  fi
else
  echo "  ERROR: Could not locate built APK."
  exit 1
fi
