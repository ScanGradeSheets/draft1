#!/usr/bin/env bash
set -euo pipefail
cd /Users/openclaw/.openclaw/workspace/scan-grade

# Default: scheduled runs send, but allow override from caller
: "${SEND_IMESSAGE:=1}"
export SEND_IMESSAGE

bash tools/morning_hobbes_summary.sh >> logs/morning_launchagent.log 2>&1
