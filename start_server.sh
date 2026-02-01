#!/usr/bin/env bash
set -e

mkdir -p logs
DATE=$(date +%F)

npm run dev -w apps/admin-api > "logs/admin-api-$DATE.log" 2>&1 &
API_PID=$!

for i in {1..120}; do
  if curl -sf http://localhost:8080/health >/dev/null; then
    break
  fi
  sleep 0.5
done

if curl -sf http://localhost:8080/health >/dev/null; then
  if command -v open >/dev/null; then
    open "http://localhost:8080/docs"
  elif command -v xdg-open >/dev/null; then
    xdg-open "http://localhost:8080/docs"
  fi
fi

wait $API_PID
