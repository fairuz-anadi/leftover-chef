#!/usr/bin/env bash
# Bring the whole Leftover Chef demo up with one command on macOS / Linux.
# Starts the vision sidecar, Laravel API, and Vite client in the background,
# waits for them to answer, and opens the browser.

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VISION_DIR="$DIR/vision"
CLIENT_DIR="$DIR/client"
VENV_PYTHON="$VISION_DIR/.venv/bin/python"

API_URL="http://127.0.0.1:8000"
CLIENT_URL="http://localhost:5173"
VISION_URL="http://127.0.0.1:8001"

LOG_DIR="$DIR/storage/logs"
mkdir -p "$LOG_DIR"

SKIP_VISION=false
NO_BROWSER=false

for arg in "$@"; do
  case $arg in
    --skip-vision) SKIP_VISION=true ;;
    --no-browser)  NO_BROWSER=true ;;
  esac
done

echo ""
echo "Leftover Chef - starting demo"
echo "-----------------------------"

is_port_in_use() {
  lsof -i ":$1" -sTCP:LISTEN >/dev/null 2>&1
}

wait_for_url() {
  local url="$1"
  local timeout="${2:-90}"
  local label="${3:-service}"
  local start_time=$(date +%s)

  while true; do
    if curl -s -f -o /dev/null "$url"; then
      return 0
    fi
    local now=$(date +%s)
    if [ $((now - start_time)) -ge "$timeout" ]; then
      echo "  --  $label did not answer within $timeout seconds ($url)"
      return 1
    fi
    sleep 0.7
  done
}

# 1. Vision sidecar (:8001)
if [ "$SKIP_VISION" = false ]; then
  if is_port_in_use 8001; then
    echo "  OK  vision sidecar is already running on :8001"
  elif [ ! -f "$VENV_PYTHON" ]; then
    echo "  --  vision/.venv is missing - run scripts/setup.sh first. Continuing without detector."
  else
    echo "  Starting the vision sidecar on :8001..."
    (cd "$VISION_DIR" && "$VENV_PYTHON" app.py > "$LOG_DIR/vision.log" 2>&1) &
    if wait_for_url "$VISION_URL/health" 120 "vision sidecar"; then
      echo "  OK  vision sidecar ready"
    fi
  fi
else
  echo "  --  Skipping vision sidecar (--skip-vision)"
fi

# 2. Laravel API (:8000)
if is_port_in_use 8000; then
  echo "  OK  Laravel API is already running on :8000"
else
  echo "  Starting the API on :8000..."
  (cd "$DIR" && php -d upload_max_filesize=32M -d post_max_size=32M -d memory_limit=256M artisan serve --host=0.0.0.0 --port=8000 > "$LOG_DIR/api.log" 2>&1) &
  if wait_for_url "$API_URL/api/fridge" 45 "API"; then
    echo "  OK  API ready"
  fi
fi

# 3. Vite client (:5173)
if is_port_in_use 5173; then
  echo "  OK  Vite client is already running on :5173"
else
  echo "  Starting the client on :5173..."
  (cd "$CLIENT_DIR" && npm run dev > "$LOG_DIR/client.log" 2>&1) &
  if wait_for_url "$CLIENT_URL" 60 "client"; then
    echo "  OK  Client ready"
  fi
fi

LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || true)

echo ""
echo "  Open on Laptop: $CLIENT_URL"
if [ -n "$LOCAL_IP" ]; then
  echo "  On your phone : http://${LOCAL_IP}:5173 (Instant Web App / PWA)"
  echo "  Phone APK host: ${LOCAL_IP} (type this in the Android APK)"
fi
echo "  No login - the fridge belongs to the browser session."
echo "  Stop it all   : ./scripts/stop-demo.sh"
echo ""

if [ "$NO_BROWSER" = false ]; then
  if command -v open >/dev/null 2>&1; then
    open "$CLIENT_URL"
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$CLIENT_URL"
  fi
fi
