#!/usr/bin/env bash
set -euo pipefail

TOOLS="/Users/openclaw/.openclaw/workspace/scan-grade/tools/kanban"
STATE="$TOOLS/state"
WR="$STATE/work_request.json"
PROMPT="$STATE/gemini_prompt.txt"
OUT="$STATE/brain_output.txt"

[ -f "$WR" ] || exit 0
[ -f "$PROMPT" ] || exit 0

STATUS="$(python3 -c 'import json; print((json.load(open("'"$WR"'","r",encoding="utf-8")).get("status") or "").strip())' 2>/dev/null || true)"
[ "$STATUS" = "claimed" ] || exit 0

READ_URL="$(python3 -c 'import json; print(json.load(open("'"$WR"'","r",encoding="utf-8"))["read_url"])')"
READ_SHA="$(python3 -c 'import json; print(json.load(open("'"$WR"'","r",encoding="utf-8"))["read_sha"])')"
UPDATED_AT="$(python3 -c 'import json; print(json.load(open("'"$WR"'","r",encoding="utf-8"))["updated_at"])')"
RECEIPT="$(python3 -c 'import json; print(json.load(open("'"$WR"'","r",encoding="utf-8"))["receipt"])')"

STAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
{
  echo "STAMP_UTC=$STAMP"
  echo "BRAIN=STUB"
  echo "SHORT_PLAN=Replace with Gemini output"
  echo "EXACT_COMMANDS=Replace with Gemini output"
  echo "DONE_CRITERIA=Replace with Gemini output"
  echo "READ_URL=$READ_URL"
  echo "READ_SHA=$READ_SHA"
  echo "UPDATED_AT=$UPDATED_AT"
  echo "RECEIPT=$RECEIPT"
} > "$OUT"

echo "BRAIN_TICK_OK"
echo "WROTE=$OUT"
