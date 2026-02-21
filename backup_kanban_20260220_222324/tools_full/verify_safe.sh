#!/usr/bin/env bash
set -euo pipefail

REPO="/Users/openclaw/.openclaw/workspace/scan-grade"
cd "$REPO"

LOGDIR="$REPO/logs"
mkdir -p "$LOGDIR"

TS="$(date +"%Y-%m-%d_%H-%M-%S")"
LOG="$LOGDIR/verify_safe_$TS.log"

echo "[verify] start $TS" | tee -a "$LOG"

# Helper: run npm script if it exists
has_script () {
  node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts['$1'] ? 0 : 1)"
}

run_if () {
  local s="$1"
  if has_script "$s"; then
    echo "[verify] npm run $s" | tee -a "$LOG"
    npm run "$s" 2>&1 | tee -a "$LOG"
  else
    echo "[verify] (skip) no script: $s" | tee -a "$LOG"
  fi
}

# Install deps if needed
if [ ! -d node_modules ]; then
  echo "[verify] node_modules missing → npm install" | tee -a "$LOG"
  npm install 2>&1 | tee -a "$LOG"
fi

run_if lint
run_if typecheck
run_if test
run_if build

echo "[verify] OK" | tee -a "$LOG"
