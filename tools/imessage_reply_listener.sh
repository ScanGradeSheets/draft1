#!/usr/bin/env bash
set -euo pipefail
umask 077

REPO="/Users/openclaw/.openclaw/workspace/scan-grade"
LOGDIR="$REPO/logs"
STATEDIR="$REPO/.state"
mkdir -p "$LOGDIR" "$STATEDIR"
LOG="$LOGDIR/imessage_listener.log"

# Allowed recipient
CONF="$REPO/tools/imessage_to.conf"
ALLOWED="$(tr -d '[:space:]' < "$CONF" 2>/dev/null || true)"
[ -n "${ALLOWED:-}" ] || exit 0

TS="$(date +"%Y-%m-%d %H:%M:%S")"

# Read latest inbound iMessage via imsg (you already have imsg rpc running)
# We fetch the most recent message row for the allowed sender.
ROW="$(imsg list --db /Users/openclaw/Library/Messages/chat.db --from "$ALLOWED" --limit 1 2>/dev/null || true)"

CMD="$(echo "$ROW" | tail -n 1 | tr -d '\r' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"

echo "[$TS] inbound text='${CMD:-<empty>}'" >> "$LOG"
[ -n "${CMD:-}" ] || exit 0

# Normalize
CMD_UP="$(printf "%s" "$CMD" | tr '[:lower:]' '[:upper:]')"

send_msg () {
  openclaw message send --channel imessage --target "$ALLOWED" --message "$1" >/dev/null
}

if [ "$CMD_UP" = "DETAILS" ]; then
  SAFE_OUT="$(cat "$STATEDIR/last_safe_result.txt" 2>/dev/null || echo "No SAFE run recorded yet.")"
  MSG="ScanGrade DETAILS:
$SAFE_OUT

Logs:
- SAFE: logs/build_apply_safe_*.log
- Morning: logs/morning_cron.log"
  send_msg "$MSG"
  echo "[$TS] sent DETAILS" >> "$LOG"
  exit 0
fi

if [ "$CMD_UP" = "BUILD: APPLY SAFE" ] || [ "$CMD_UP" = "BUILD APPLY SAFE" ]; then
  set +e
  tools/build_apply_safe.sh
  CODE=$?
  set -e
  OUT="$(cat "$STATEDIR/last_safe_result.txt" 2>/dev/null || true)"
  send_msg "✅ BUILD: APPLY SAFE finished (code=$CODE).
$OUT"
  echo "[$TS] ran BUILD APPLY SAFE" >> "$LOG"
  exit 0
fi

if [ "$CMD_UP" = "BUILD: CRITICAL" ] || [ "$CMD_UP" = "BUILD CRITICAL" ]; then
  echo "[$TS] CRITICAL requested" >> "$LOG"
  send_msg "⚠️ BUILD: CRITICAL acknowledged.
I won’t run risky changes automatically. Tell me what you want changed, or we can wire a CRITICAL workflow next."
  exit 0
fi

echo "[$TS] ignored" >> "$LOG"
exit 0
