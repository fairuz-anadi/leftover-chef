#!/usr/bin/env bash
# Stop everything start-demo.sh started.
# Kills whatever is listening on the three demo ports (5173, 8000, 8001).

ports=(5173 8000 8001)
names=("client" "api" "vision")

echo ""
for i in "${!ports[@]}"; do
  port="${ports[$i]}"
  name="${names[$i]}"
  pids=$(lsof -ti ":$port" -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "$pids" ]; then
    for pid in $pids; do
      kill "$pid" 2>/dev/null || true
      echo "  stopped $name (:$port) - PID $pid"
    done
  else
    echo "  $name (:$port) was not running"
  fi
done
echo ""
