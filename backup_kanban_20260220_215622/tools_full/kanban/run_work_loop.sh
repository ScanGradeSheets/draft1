#!/usr/bin/env bash
set -euo pipefail

READ_URL="${1:?missing READ URL}"
READ_SHA="${2:?missing READ_SHA}"
UPDATED_AT="${3:?missing UPDATED_AT}"
RECEIPT="${4:?missing RECEIPT}"

STATE="/Users/openclaw/.openclaw/workspace/scan-grade/tools/kanban/state"
mkdir -p "$STATE"

WR="$STATE/work_request.json"

# Guard: if a work request is already pending/claimed, do nothing
if [ -f "$WR" ]; then
  STATUS="$(python3 -c 'import json; print((json.load(open("'"$WR"'","r",encoding="utf-8")).get("status") or "").strip())' 2>/dev/null || true)"
  if [ "$STATUS" = "pending" ] || [ "$STATUS" = "claimed" ]; then
    echo "WORK_LOOP_SKIPPED_INFLIGHT status=$STATUS"
    exit 0
  fi
fi

# Debounce: don't run more than once every 30 minutes
DEBOUNCE_SEC=1800
LAST_TS_FILE="$STATE/last_work_loop_epoch.txt"
NOW="$(date +%s)"
LAST="$(cat "$LAST_TS_FILE" 2>/dev/null || echo 0)"

if [ $((NOW - LAST)) -lt "$DEBOUNCE_SEC" ]; then
  echo "WORK_LOOP_SKIPPED_DEBOUNCE"
  exit 0
fi
echo "$NOW" > "$LAST_TS_FILE"

STAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
cat > "$STATE/last_work_request.txt" <<EOF
STAMP_UTC=$STAMP
READ_URL=$READ_URL
READ_SHA=$READ_SHA
UPDATED_AT=$UPDATED_AT
RECEIPT=$RECEIPT
WORK_LOOP=DISPATCH_V3
EOF

# Capture mission text at dispatch time (canonical)
MISSION_TEXT="$(curl -fsS "$READ_URL" | python3 -c 'import sys,json; j=json.load(sys.stdin); print((j.get("current_mission") or "").strip())')"

# Create the work request (pending) with frozen mission_text
"/Users/openclaw/.openclaw/workspace/scan-grade/tools/kanban/write_work_request.py" \
  "$WR" \
  "$READ_URL" "$READ_SHA" "$UPDATED_AT" "$RECEIPT" \
  "$MISSION_TEXT" >/dev/null

echo "WORK_REQUEST_CREATED=pending"
echo "MISSION_TEXT_WRITTEN"
echo "WORK_LOOP_OK"
echo "WROTE=$STATE/last_work_request.txt"
