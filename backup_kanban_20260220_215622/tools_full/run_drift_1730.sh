#!/usr/bin/env bash
set -euo pipefail
cd /Users/openclaw/.openclaw/workspace/scan-grade

SEND_IMESSAGE=1 bash tools/drift_judge_1730.sh >> logs/drift_launchagent.log 2>&1
