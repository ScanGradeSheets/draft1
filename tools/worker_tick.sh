#!/usr/bin/env bash
set -euo pipefail

BASE="/Users/openclaw/.openclaw/workspace/scan-grade/tools/kanban"

bash "$BASE/brain_tick.sh"
bash "$BASE/work_loop.sh"
bash "$BASE/finalize_tick.sh"
