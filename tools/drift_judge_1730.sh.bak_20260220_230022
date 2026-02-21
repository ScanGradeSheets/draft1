#!/usr/bin/env bash
set -euo pipefail
umask 077

REPO="/Users/openclaw/.openclaw/workspace/scan-grade"
cd "$REPO"

# Master notifications toggle (default: on)
NOTIFY_FILE="$REPO/.state/notifications_enabled.txt"
NOTIFY="$(cat "$NOTIFY_FILE" 2>/dev/null || echo "on")"
if [ "$NOTIFY" != "on" ]; then
  SEND_IMESSAGE=0
fi

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

RULES:
- Output plain text only. No code. No markdown. No backticks. No quotes. No bullet points.
- Do NOT mention tools, sessions, memory, or file paths.
- Output MUST be exactly 3 lines. Nothing before, nothing after.
- If you are about to output anything other than the 3 lines, STOP and output the 3 lines anyway.

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

OUT="$(python3 - "$JSON" <<'PY'
import json, sys, re
p=sys.argv[1]
d=json.load(open(p,'r',encoding='utf-8'))
payloads=d.get("result",{}).get("payloads",[])
text=(payloads[0].get("text","") if payloads else "").strip()

def pick(prefix):
    m=re.search(rf"^{prefix}:\s*(.+)$", text, re.M)
    return (m.group(1).strip() if m else "")

status=pick("STATUS") or "DRIFTING"
why=pick("WHY") or "Drift output format failed (agent returned extra text)."
nxt=pick("NEXT") or "Tighten drift prompt + add strict format enforcement."

print(f"STATUS: {status}")
print(f"WHY: {why}")
print(f"NEXT: {nxt}")
PY
)"

rm -f "$JSON"

if [ -z "${OUT:-}" ]; then
  echo "[$TS] agent output empty" >> "$LOG"
  exit 0
fi

# If the agent didn't follow the "3 lines" format, fall back to a safe summary
if ! printf "%s\n" "$OUT" | grep -q '^STATUS:'; then
  echo "[$TS] WARN: drift output not in STATUS/WHY/NEXT format" >> "$LOG"
  OUT="STATUS: DRIFTING
WHY: Drift output format failed (agent returned extra text).
NEXT: Tighten drift prompt + add strict format enforcement."
fi

printf "\n-----\n[%s] OUT:\n%s\n-----\n" "$TS" "$OUT" >> "$LOG"

# Make a short text: STATUS/WHY/NEXT only
STATUS="$(printf "%s\n" "$OUT" | sed -n 's/^STATUS:[[:space:]]*//p' | head -n 1)"
WHY="$(printf "%s\n" "$OUT" | sed -n 's/^WHY:[[:space:]]*//p' | head -n 1)"
NEXT="$(printf "%s\n" "$OUT" | sed -n 's/^NEXT:[[:space:]]*//p' | head -n 1)"

# Fallback if parsing fails
if [ -z "${STATUS:-}" ]; then STATUS="(no status)"; fi
if [ -z "${WHY:-}" ]; then WHY="(no why)"; fi
if [ -z "${NEXT:-}" ]; then NEXT="(no next)"; fi

MSG="ScanGrade 5:30 check ($TS)
Status: $STATUS
Why: $WHY
Next: $NEXT

Reply: DETAILS"

if [ "${SEND_IMESSAGE:-0}" = "1" ]; then
  if [ -n "${IMESSAGE_TO:-}" ]; then
    openclaw message send --channel imessage --target "$IMESSAGE_TO" --message "$MSG" >/dev/null || true
    :
  else
    echo "[$TS] IMESSAGE_TO missing; not sending" >> "$LOG"
  fi
fi

echo "[$TS] sent drift check" >> "$LOG"
