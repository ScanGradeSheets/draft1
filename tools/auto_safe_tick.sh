#!/usr/bin/env bash
set -euo pipefail
umask 077

REPO="/Users/openclaw/.openclaw/workspace/scan-grade"
cd "$REPO"

STATEDIR="$REPO/.state"
mkdir -p "$STATEDIR"
RESULT="$STATEDIR/last_safe_result.txt"

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
    MSG="✅ ScanGrade SAFE applied.
$OUT

If you want details: reply DETAILS"
    ;;
  SAFE_BLOCKED_FORBIDDEN_PATHS*)
    MSG="⛔️ ScanGrade SAFE blocked (unsafe paths touched).
$OUT

Reply with: DETAILS | BUILD: APPLY SAFE | BUILD: CRITICAL"
    ;;
  *)
    MSG="⚠️ ScanGrade SAFE failed (code=$CODE).
$OUT

Reply with: DETAILS | BUILD: APPLY SAFE | BUILD: CRITICAL"
    ;;
esac

openclaw message send --channel imessage --target "$TO" --message "$MSG" >/dev/null
