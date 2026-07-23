#!/bin/sh
# Liveness watchdog. systemd's Restart=always only reacts to the process
# *exiting* - it cannot see a process that is still running but has stopped
# serving (a deadlock, a wedged event loop). This closes that gap: if
# /health stops answering while systemd still believes the unit is up, the
# unit gets restarted.
#
# Runs every minute from tici-taca-toey-watchdog.timer, as the `tici` user,
# using the same one-command sudo rule the deployer already has.
#
# Two consecutive failures are required before acting, so an ordinary
# deploy restart (~2s) never trips it.
set -eu

HEALTH="${TTT_HEALTH:-http://127.0.0.1:8080/health}"
SERVICE="${TTT_SERVICE:-tici-taca-toey}"
STATE="${TTT_WATCHDOG_STATE:-/run/tici-taca-toey-watchdog/failures}"
THRESHOLD="${TTT_WATCHDOG_THRESHOLD:-2}"

mkdir -p "$(dirname "$STATE")"

# Only judge a unit systemd currently believes is running. If it is
# activating, restarting, or stopped, Restart=always already owns the
# problem and stepping in would just fight it.
if [ "$(systemctl is-active "$SERVICE" 2>/dev/null || true)" != "active" ]; then
  echo 0 > "$STATE"
  exit 0
fi

if curl -fsS --max-time 5 "$HEALTH" >/dev/null 2>&1; then
  # Healthy: clear any accumulated strikes.
  echo 0 > "$STATE"
  exit 0
fi

failures=$(( $(cat "$STATE" 2>/dev/null || echo 0) + 1 ))
echo "$failures" > "$STATE"
echo "[watchdog] $HEALTH did not answer ($failures/$THRESHOLD)"

if [ "$failures" -ge "$THRESHOLD" ]; then
  echo "[watchdog] restarting $SERVICE - up but not serving"
  echo 0 > "$STATE"
  sudo systemctl restart "$SERVICE"
fi
