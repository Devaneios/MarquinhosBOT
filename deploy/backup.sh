#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/marquinhos/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-marquinhos-postgres}"
POSTGRES_USER="${POSTGRES_USER:-marquinhos}"
POSTGRES_DB="${POSTGRES_DB:-marquinhos}"

install -d -m 700 "$BACKUP_DIR"
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
dump="$BACKUP_DIR/marquinhos-postgres-$timestamp.dump"

if ! docker inspect "$POSTGRES_CONTAINER" >/dev/null 2>&1; then
  echo "Postgres container '$POSTGRES_CONTAINER' not found" >&2
  exit 1
fi

if ! docker exec "$POSTGRES_CONTAINER" \
      pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom > "$dump.partial" \
   || [[ ! -s "$dump.partial" ]] \
   || ! docker exec -i "$POSTGRES_CONTAINER" pg_restore --list < "$dump.partial" >/dev/null; then
  rm -f "$dump.partial"
  echo "Postgres backup failed verification" >&2
  exit 1
fi

mv "$dump.partial" "$dump"
chmod 600 "$dump"
echo "Verified Postgres backup: $dump"

if [[ -n "${BACKUP_REMOTE_DEST:-}" ]]; then
  if command -v rclone >/dev/null 2>&1; then
    rclone copy "$dump" "$BACKUP_REMOTE_DEST"
    echo "Synced backup via rclone to $BACKUP_REMOTE_DEST"
  elif command -v rsync >/dev/null 2>&1; then
    rsync -az "$dump" "$BACKUP_REMOTE_DEST"
    echo "Synced backup via rsync to $BACKUP_REMOTE_DEST"
  else
    echo "BACKUP_REMOTE_DEST is set but neither rclone nor rsync is installed" >&2
    exit 1
  fi
fi

find "$BACKUP_DIR" -maxdepth 1 -type f \
  -name 'marquinhos-postgres-*.dump' \
  -mtime +"$RETENTION_DAYS" -delete
