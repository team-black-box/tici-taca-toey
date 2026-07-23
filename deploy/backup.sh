#!/bin/sh
# Nightly backup of the game data: a consistent sqlite snapshot (safe under
# WAL) plus the TTN corpus, kept for 14 days. The data directory sits outside
# the release folders, so deploys and rollbacks never touch it.
# Cron line:  15 2 * * * /opt/tici-taca-toey/deploy/backup.sh
set -eu

DATA=/opt/tici-taca-toey/data
DEST=/var/backups/tici-taca-toey
STAMP=$(date +%Y%m%d-%H%M)

mkdir -p "$DEST"
if [ -f "$DATA/tici-taca-toey.db" ]; then
  sqlite3 "$DATA/tici-taca-toey.db" ".backup '$DEST/db-$STAMP.sqlite'"
fi
if [ -f "$DATA/games.ttn" ]; then
  cp "$DATA/games.ttn" "$DEST/games-$STAMP.ttn"
fi
find "$DEST" -type f -mtime +14 -delete
