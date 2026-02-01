#!/usr/bin/env bash
set -euo pipefail

HTOWN_ROOT="/opt/htown"

if ! git -C "$HTOWN_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  exit 0
fi

if [ -n "$(git -C "$HTOWN_ROOT" status --porcelain)" ]; then
  exit 0
fi

git -C "$HTOWN_ROOT" fetch --all --prune --quiet

if ! git -C "$HTOWN_ROOT" rev-parse --abbrev-ref --symbolic-full-name @{u} >/dev/null 2>&1; then
  exit 0
fi

local_ref="$(git -C "$HTOWN_ROOT" rev-parse HEAD)"
remote_ref="$(git -C "$HTOWN_ROOT" rev-parse @{u})"

if [ "$local_ref" != "$remote_ref" ]; then
  /opt/htown/scripts/update.sh
fi
