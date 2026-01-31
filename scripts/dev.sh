#!/usr/bin/env bash
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Please install Node.js 20+ and re-run." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required. Please install npm 9+ and re-run." >&2
  exit 1
fi

npm install
npm run dev
