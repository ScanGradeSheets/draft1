#!/usr/bin/env bash
set -euo pipefail
cd /Users/openclaw/.openclaw/workspace/scan-grade

# Allow sending for the scheduled run
export SEND_IMESSAGE=1

SEND_IMESSAGE=1 bash tools/morning_hobbes_summary.sh >> logs/morning_launchagent.log 2>&1
