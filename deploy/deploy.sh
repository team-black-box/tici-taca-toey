#!/bin/sh
# Pull-based release deployer. A systemd timer runs this every few minutes;
# it checks GitHub for a newer published release, installs the prebuilt
# artifact, and swaps a symlink. Nothing inbound is ever needed - the box
# keeps only 80/443 open and SSH stays on the tailnet.
#
# Install once during provisioning (it is deliberately NOT self-updating):
#   curl -fsSL https://raw.githubusercontent.com/<repo>/main/deploy/deploy.sh \
#     -o /opt/tici-taca-toey/deploy.sh && chmod +x /opt/tici-taca-toey/deploy.sh
#
# Layout it maintains:
#   /opt/tici-taca-toey/releases/<tag>/   one extracted artifact per release
#   /opt/tici-taca-toey/current           symlink -> the live release
#   /opt/tici-taca-toey/data/             sqlite + TTN log, never touched
#
# Rollback is a symlink away:
#   ln -sfn /opt/tici-taca-toey/releases/<older-tag> /opt/tici-taca-toey/cur.new
#   mv -Tf /opt/tici-taca-toey/cur.new /opt/tici-taca-toey/current
#   sudo systemctl restart tici-taca-toey
set -eu

REPO="${TTT_REPO:-team-black-box/tici-taca-toey}"
ROOT="${TTT_ROOT:-/opt/tici-taca-toey}"
SERVICE="${TTT_SERVICE:-tici-taca-toey}"
HEALTH="${TTT_HEALTH:-http://127.0.0.1:8080/health}"
ASSET=tici-taca-toey.tar.gz
KEEP_RELEASES=5

log() {
  echo "[deploy] $*"
}

# The /releases/latest URL redirects to /releases/tag/<tag>, so reading the
# effective URL gives us the version with no API token and no rate limit.
latest=$(curl -fsSLI -o /dev/null -w '%{url_effective}' \
  "https://github.com/$REPO/releases/latest" | sed 's|.*/tag/||')
if [ -z "$latest" ] || [ "$latest" = "releases" ]; then
  log "could not determine the latest release; leaving the box alone"
  exit 0
fi

previous=""
if [ -L "$ROOT/current" ]; then
  previous=$(basename "$(readlink -f "$ROOT/current")")
fi
if [ "$latest" = "$previous" ]; then
  exit 0
fi

log "installing $latest (current: ${previous:-none})"
tmp=$(mktemp -d)
# shellcheck disable=SC2064
trap "rm -rf '$tmp'" EXIT

curl -fsSL -o "$tmp/$ASSET" \
  "https://github.com/$REPO/releases/latest/download/$ASSET"
curl -fsSL -o "$tmp/$ASSET.sha256" \
  "https://github.com/$REPO/releases/latest/download/$ASSET.sha256"

# A truncated download must never become a deployed release.
expected=$(cut -d' ' -f1 "$tmp/$ASSET.sha256")
actual=$(sha256sum "$tmp/$ASSET" | cut -d' ' -f1)
if [ "$expected" != "$actual" ]; then
  log "checksum mismatch - refusing to deploy"
  exit 1
fi

rm -rf "${ROOT:?}/releases/$latest"
mkdir -p "$ROOT/releases/$latest"
tar -xzf "$tmp/$ASSET" -C "$ROOT/releases/$latest"

swap_to() {
  ln -sfn "$ROOT/releases/$1" "$ROOT/current.new"
  mv -Tf "$ROOT/current.new" "$ROOT/current"
  sudo systemctl restart "$SERVICE"
}

swap_to "$latest"

# Verify the new release actually came up; roll back if it did not.
healthy=0
attempt=0
while [ "$attempt" -lt 15 ]; do
  if curl -fsS --max-time 2 "$HEALTH" >/dev/null 2>&1; then
    healthy=1
    break
  fi
  attempt=$((attempt + 1))
  sleep 1
done

if [ "$healthy" -ne 1 ]; then
  if [ -n "$previous" ] && [ -d "$ROOT/releases/$previous" ]; then
    log "$latest failed its health check - rolling back to $previous"
    swap_to "$previous"
  else
    log "$latest failed its health check and there is nothing to roll back to"
  fi
  exit 1
fi

# Keep a handful of releases so rollback stays instant.
ls -1dt "$ROOT"/releases/*/ 2>/dev/null \
  | tail -n +$((KEEP_RELEASES + 1)) \
  | xargs -r rm -rf

log "$latest is live"
