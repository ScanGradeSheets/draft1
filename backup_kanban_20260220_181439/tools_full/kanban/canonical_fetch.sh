#!/usr/bin/env bash
set -euo pipefail

READ_URL="${1:?missing READ URL}"

# macOS-safe mktemp
TMP="$(mktemp -t board_state).json"

# Fetch canonical bytes (ONLY source of truth)
curl -fsSL "$READ_URL" -o "$TMP"

# SHA from fetched bytes
READ_SHA="$(shasum -a 256 "$TMP" | awk '{print $1}')"

# Validate JSON + extract updated_at
UPDATED_AT="$(python3 - <<PY
import json
p="$TMP"
j=json.load(open(p,"r",encoding="utf-8"))
print(j.get("updated_at",""))
PY
)"

[ -n "$UPDATED_AT" ] || { echo "ERROR: missing updated_at in fetched JSON" >&2; exit 2; }

echo "READ_URL=$READ_URL"
echo "FETCH_PATH=$TMP"
echo "READ_SHA=$READ_SHA"
echo "UPDATED_AT=$UPDATED_AT"
echo "RECEIPT=KANBAN_CANONICAL_FETCH_V1"
