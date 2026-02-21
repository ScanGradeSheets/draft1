#!/usr/bin/env bash
set -euo pipefail

READ_URL="${1:?missing READ URL}"

REPO="/Users/openclaw/.openclaw/workspace/scan-grade"
TOOLS="$REPO/tools/kanban"
STATE="$TOOLS/state"
LOCKDIR="$STATE/heartbeat.lockdir"
LAST_SHA_FILE="$STATE/last_read_sha.txt"
LAST_UPDATED_FILE="$STATE/last_updated_at.txt"

mkdir -p "$STATE"

# single-instance lock (atomic on macOS)
if ! mkdir "$LOCKDIR" 2>/dev/null; then
  exit 0
fi
cleanup() { rmdir "$LOCKDIR" 2>/dev/null || true; }
trap cleanup EXIT

# Fetch canonical truth
OUT="$("$TOOLS/canonical_fetch.sh" "$READ_URL")"

READ_SHA="$(printf "%s\n" "$OUT" | awk -F= '/^READ_SHA=/{print $2}')"
UPDATED_AT="$(printf "%s\n" "$OUT" | awk -F= '/^UPDATED_AT=/{print $2}')"
RECEIPT="$(printf "%s\n" "$OUT" | awk -F= '/^RECEIPT=/{print $2}')"
FETCH_PATH="$(printf "%s\n" "$OUT" | awk -F= '/^FETCH_PATH=/{print $2}')"

[[ -n "$READ_SHA" && -n "$UPDATED_AT" && -n "$RECEIPT" && -n "$FETCH_PATH" ]] || { echo "ERROR: missing receipt fields" >&2; exit 3; }

# Mission status (deterministic fields)
MS_OUT="$("$TOOLS/mission_status.py" "$FETCH_PATH")"
MISSION_STATUS="$(printf "%s\n" "$MS_OUT" | awk -F= '/^MISSION_STATUS=/{print $2}')"
MISSION_BLOCKED_ON="$(printf "%s\n" "$MS_OUT" | awk -F= '/^MISSION_BLOCKED_ON=/{print $2}')"

# Basic anti-stale memory
LAST_SHA="$(cat "$LAST_SHA_FILE" 2>/dev/null || true)"
LAST_UPDATED="$(cat "$LAST_UPDATED_FILE" 2>/dev/null || true)"

echo "$READ_SHA" > "$LAST_SHA_FILE"
echo "$UPDATED_AT" > "$LAST_UPDATED_FILE"

echo "HEARTBEAT_OK"
echo "READ_URL=$READ_URL"
echo "READ_SHA=$READ_SHA"
echo "UPDATED_AT=$UPDATED_AT"
echo "RECEIPT=$RECEIPT"
echo "MISSION_STATUS=${MISSION_STATUS:-}"
echo "MISSION_BLOCKED_ON=${MISSION_BLOCKED_ON:-}"
echo "CHANGED_SHA=$([ "$READ_SHA" != "$LAST_SHA" ] && echo yes || echo no)"
echo "CHANGED_UPDATED_AT=$([ "$UPDATED_AT" != "$LAST_UPDATED" ] && echo yes || echo no)"

# Deterministic action rules
if [ "${MISSION_STATUS:-}" = "Blocked" ]; then
  echo "ACTION=BLOCKED_NOTIFY: Blocked on ${MISSION_BLOCKED_ON:-unknown}. Need input."
elif [ "${MISSION_STATUS:-}" = "Ready" ] || [ "${MISSION_STATUS:-}" = "InProgress" ]; then
  echo "ACTION=RUN_WORK_LOOP"
  "$TOOLS/run_work_loop.sh" "$READ_URL" "$READ_SHA" "$UPDATED_AT" "$RECEIPT"
fi

