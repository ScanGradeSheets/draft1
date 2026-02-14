#!/usr/bin/env bash
set -euo pipefail
cd /Users/openclaw/.openclaw/workspace/scan-grade

SEND_IMESSAGE=1 bash tools/auto_safe_tick.sh >> logs/safe_tick_midday_launchagent.log 2>&1
