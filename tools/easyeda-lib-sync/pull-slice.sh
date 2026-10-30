#!/usr/bin/env bash
# Fatia retomável do espelho LCSC (Cloud Agent / cron). Exit 0 = completo; 2 = pausa (retomar).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
mkdir -p data

MAX_MIN="${1:-240}"
NODE=(node --experimental-sqlite)

while true; do
  "${NODE[@]}" tools/easyeda-lib-sync/pull.mjs --max-minutes "$MAX_MIN"
  code=$?
  if [[ "$code" -eq 0 ]]; then break; fi
  if [[ "$code" -ne 2 ]]; then exit "$code"; fi
done

"${NODE[@]}" tools/easyeda-lib-sync/sync.mjs stats
tail -40 data/lib-sync-pull.log 2>/dev/null || true
cat data/lib-sync-status.json 2>/dev/null || true
