#!/usr/bin/env bash
# Smoke test para Cloud Agent / Automation — valida start + repo + Node.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
echo "=== LCSC cloud smoke ==="
echo "pwd=$(pwd)"
node --version
test -f tools/easyeda-lib-sync/pull-slice.sh
test -f tools/easyeda-lib-sync/pull.mjs
test -f AGENTS.md
mkdir -p data
node --experimental-sqlite -e "const {DatabaseSync}=require('node:sqlite'); new DatabaseSync(':memory:'); console.log('sqlite ok')"
echo "SMOKE_OK"
