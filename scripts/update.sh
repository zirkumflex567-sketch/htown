#!/usr/bin/env bash
set -euo pipefail

LOCK_FILE="/tmp/htown-update.lock"
LOG_DIR="/opt/htown/logs"
LOG_FILE="$LOG_DIR/update.log"
STATUS_FILE="$LOG_DIR/update-status.json"
HTOWN_ROOT="/opt/htown"

mkdir -p "$LOG_DIR"

now_utc() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

write_status() {
  local status="$1"
  local message="${2:-}"
  local started_at="${3:-}"
  local finished_at="${4:-}"
  local commit="${5:-}"
  STATUS="$status" MESSAGE="$message" STARTED_AT="$started_at" FINISHED_AT="$finished_at" COMMIT="$commit" \
    python3 - "$STATUS_FILE" <<'PY'
import json, os, sys
status_file = sys.argv[1]
status = os.environ.get("STATUS", "unknown")
message = os.environ.get("MESSAGE") or None
started_at = os.environ.get("STARTED_AT") or None
finished_at = os.environ.get("FINISHED_AT") or None
commit = os.environ.get("COMMIT") or None
payload = {"status": status}
if started_at:
    payload["startedAt"] = started_at
if finished_at:
    payload["finishedAt"] = finished_at
if message:
    payload["message"] = message
if commit:
    payload["commit"] = commit
with open(status_file, "w", encoding="utf-8") as f:
    json.dump(payload, f)
PY
}

log() {
  echo "[$(now_utc)] $*" | tee -a "$LOG_FILE"
}

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  write_status "blocked" "Update already running" "$(now_utc)"
  exit 1
fi

start_ts="$(now_utc)"
commit_before=""
if command -v git >/dev/null 2>&1; then
  commit_before="$(git -C "$HTOWN_ROOT" rev-parse HEAD 2>/dev/null || true)"
fi

write_status "running" "Update started" "$start_ts" "" "$commit_before"

finish() {
  local rc=$?
  local finish_ts
  finish_ts="$(now_utc)"
  local commit_after
  commit_after="$(git -C "$HTOWN_ROOT" rev-parse HEAD 2>/dev/null || true)"
  if [ "$rc" -eq 0 ]; then
    write_status "success" "Update completed" "$start_ts" "$finish_ts" "$commit_after"
  else
    write_status "failed" "Update failed (rc=$rc)" "$start_ts" "$finish_ts" "$commit_after"
  fi
}
trap finish EXIT

log "Starting update in $HTOWN_ROOT"

if ! git -C "$HTOWN_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  log "Not a git repository: $HTOWN_ROOT"
  exit 1
fi

if [ -n "$(git -C "$HTOWN_ROOT" status --porcelain)" ]; then
  log "Working tree dirty. Aborting update."
  exit 1
fi

log "Fetching remote changes"
git -C "$HTOWN_ROOT" fetch --all --prune

if git -C "$HTOWN_ROOT" rev-parse --abbrev-ref --symbolic-full-name @{u} >/dev/null 2>&1; then
  log "Pulling latest changes"
  git -C "$HTOWN_ROOT" pull --ff-only
else
  log "No upstream configured. Skipping pull."
fi

log "Installing dependencies"
/usr/bin/pnpm -C "$HTOWN_ROOT" install

CLIENT_URL=""
if [ -f /etc/htown.env ]; then
  CLIENT_URL=$(awk -F= '$1=="CLIENT_URL"{print $2}' /etc/htown.env)
fi
if [ -z "$CLIENT_URL" ]; then
  CLIENT_URL="https://h-town.duckdns.org"
fi

log "Building admin web"
VITE_ADMIN_API_URL="${CLIENT_URL}/admin-api" /usr/bin/pnpm -C "$HTOWN_ROOT/apps/admin-web" build --base=/admin/

log "Building client"
VITE_SERVER_URL="$CLIENT_URL" /usr/bin/pnpm -C "$HTOWN_ROOT/client" build

log "Restarting services"
systemctl restart htown-admin htown

log "Update completed"
