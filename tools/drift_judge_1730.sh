#!/usr/bin/env bash
set -euo pipefail
umask 077

REPO="/Users/openclaw/.openclaw/workspace/scan-grade"
cd "$REPO"

LOGDIR="$REPO/logs"
mkdir -p "$LOGDIR"
LOG="$LOGDIR/drift_1730.log"

: "${SEND_IMESSAGE:=1}"

# Recipient
CONF="$REPO/tools/imessage_to.conf"
IMESSAGE_TO="${IMESSAGE_TO:-}"
if [ -z "${IMESSAGE_TO:-}" ] && [ -r "$CONF" ]; then
  IMESSAGE_TO="$(tr -d '[:space:]' < "$CONF")"
fi

TS="$(date +"%Y-%m-%d %H:%M:%S")"

GOALS_MD="$(cat "$REPO/GOALS.md" 2>/dev/null || echo "GOALS.md missing")"

ACTIVITY_SUMMARY="$(
  (
    echo "BRANCH: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
    echo
    echo "LAST 3 COMMITS:"
    git log -3 --pretty=format:'- %h %s' 2>/dev/null || true
    echo
    echo
    echo "CHANGED FILES:"
    git status --porcelain 2>/dev/null | sed 's/^/  /' | head -n 60 || true
  ) 2>/dev/null
)"

export GOALS_MD ACTIVITY_SUMMARY

PROMPT="$(python3 - <<'PY'
import os
goals = os.environ.get("GOALS_MD","")
activity = os.environ.get("ACTIVITY_SUMMARY","")
prompt = f"""You are Hobbes.

You must judge drift against the ScanGrade Constitution + TPT rules.

===GOALS.md===
{goals}
===END GOALS.md===

===TODAY_ACTIVITY===
{activity}
===END TODAY_ACTIVITY===

Output EXACTLY 3 lines:
STATUS: ON_TRACK or DRIFTING
WHY: <one sentence>
NEXT: <one concrete next step Tony should do tomorrow that reduces teacher friction>
"""
print(prompt)
PY
)"

JSON="$(mktemp)"
if ! openclaw agent --agent main --message "$PROMPT" --timeout 180 --json > "$JSON"; then
  echo "[$TS] agent failed" >> "$LOG"
  rm -f "$JSON"
  exit 0
fi

OUT="$(python3 -c "import json,sys; d=json.load(open(sys.argv[1],'r',encoding='utf-8')); p=d.get('result',{}).get('payloads',[]); print(((p[0].get('text','') if p else '').strip()))" "$JSON")"
rm -f "$JSON"

if [ -z "${OUT:-}" ]; then
  echo "[$TS] agent output empty" >> "$LOG"
  exit 0
fi

printf "\n-----\n[%s] OUT:\n%s\n-----\n" "$TS" "$OUT" >> "$LOG"

MSG="ScanGrade 5:30 drift check ($TS)

$OUT"

if [ "$SEND_IMESSAGE" = "1" ] && [ -n "${IMESSAGE_TO:-}" ]; then
  openclaw message send --channel imessage --target "$IMESSAGE_TO" --message "$MSG" >/dev/null || true
fi

echo "[$TS] sent drift check" >> "$LOG"
