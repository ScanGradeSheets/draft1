#!/usr/bin/env bash
set -euo pipefail

READ_URL="https://hobbes-mac-mini.tail9a3379.ts.net/board_state.json"
TMP="/tmp/board_fetch.json"
HDR="/tmp/board_fetch_headers.txt"

# Fetch with headers captured
curl -skD "$HDR" "$READ_URL" -o "$TMP"

# Hard check: file non-empty
if [[ ! -s "$TMP" ]]; then
  echo "ERROR: fetched 0 bytes"
  echo "READ_URL=$READ_URL"
  echo "HEADERS:"
  sed -n '1,20p' "$HDR"
  exit 1
fi

# Hard check: JSON parse + extract updated_at (no stale/local reads)
PYOUT="$(python3 - <<'PY'
import json
p="/tmp/board_fetch.json"
with open(p,"r",encoding="utf-8") as f:
    j=json.load(f)
print(j.get("updated_at",""))
PY
)"

UPDATED_AT="$PYOUT"
if [[ -z "$UPDATED_AT" ]]; then
  echo "ERROR: missing updated_at from fetched JSON"
  echo "READ_URL=$READ_URL"
  echo "HEADERS:"
  sed -n '1,20p' "$HDR"
  echo "BODY_HEAD:"
  head -c 300 "$TMP" | sed -e 's/[[:cntrl:]]//g'
  echo
  exit 1
fi

READ_SHA="$(shasum -a 256 "$TMP" | awk '{print $1}')"

mkdir -p logs/board_snapshots
cp "$TMP" "logs/board_snapshots/${READ_SHA}.json" 2>/dev/null || true

echo "READ_URL=$READ_URL"
echo "READ_SHA=$READ_SHA"
echo "UPDATED_AT=$UPDATED_AT"
cat "$TMP"
