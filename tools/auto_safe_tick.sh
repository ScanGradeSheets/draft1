#!/usr/bin/env bash
set -euo pipefail
umask 077

REPO="/Users/openclaw/.openclaw/workspace/scan-grade"
cd "$REPO"

STATEDIR="$REPO/.state"
mkdir -p "$STATEDIR"
RESULT="$STATEDIR/last_safe_result.txt"
TODAY="$(date +%Y-%m-%d)"
LAST_DAY_FILE="$STATEDIR/last_safe_commit_day.txt"
LAST_DAY="$(cat "$LAST_DAY_FILE" 2>/dev/null || true)"

# Master notifications toggle (default: on)
NOTIFY_FILE="$STATEDIR/notifications_enabled.txt"
NOTIFY="$(cat "$NOTIFY_FILE" 2>/dev/null || echo "on")"
if [ "$NOTIFY" != "on" ]; then
  exit 0
fi

# Recipient (reuse your conf file)
TO=""
CONF="$REPO/tools/imessage_to.conf"
if [ -r "$CONF" ]; then
  TO="$(tr -d '[:space:]' < "$CONF")"
fi
if [ -z "${TO:-}" ]; then
  exit 0
fi

# Run SAFE
set +e
tools/build_apply_safe.sh
CODE=$?
set -e

OUT="$(cat "$RESULT" 2>/dev/null || true)"

# Text only on meaningful outcomes
case "$OUT" in
  SAFE_OK_NO_CHANGES*)
    # stay quiet
    exit 0
    ;;

  SAFE_OK_COMMITTED*)
    # Only text the first commit of the day (prevents spam)
    if [ "$LAST_DAY" = "$TODAY" ]; then
      exit 0
    fi
    echo "$TODAY" > "$LAST_DAY_FILE"

    MSG="✅ ScanGrade SAFE update (first change today).
$OUT

Reply: DETAILS"
    ;;

  SAFE_BLOCKED_FORBIDDEN_PATHS*)
    MSG="⛔️ ScanGrade SAFE blocked (unsafe paths touched).
$OUT

Reply: DETAILS | BUILD: APPLY SAFE | BUILD: CRITICAL"
    ;;

  *)
    MSG="⚠️ ScanGrade SAFE failed (code=$CODE).
$OUT

Reply: DETAILS | BUILD: APPLY SAFE | BUILD: CRITICAL"
    ;;
esac

openclaw message send --channel imessage --target "$TO" --message "$MSG" >/dev/null
