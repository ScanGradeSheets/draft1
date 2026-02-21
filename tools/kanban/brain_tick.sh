#!/usr/bin/env bash
set -euo pipefail

# Make sure openclaw is on PATH even when run from launchd
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

BASE="/Users/openclaw/.openclaw/workspace/scan-grade"
KAN="$BASE/tools/kanban"
mkdir -p "$KAN/state"

STATE="$KAN/state"

# Canonical board URL + last-known metadata from heartbeat
READ_URL="https://hobbes-mac-mini.tail9a3379.ts.net/board_state.json"
READ_SHA="$(cat "$STATE/last_read_sha.txt" 2>/dev/null || echo "")"
UPDATED_AT="$(cat "$STATE/last_updated_at.txt" 2>/dev/null || echo "")"
RECEIPT="KANBAN_CANONICAL_FETCH_V1"
MISSION_TEXT="Ship ScanGrade MVP: one clean worksheet + scoring pipeline that works end-to-end!"

export READ_URL READ_SHA UPDATED_AT RECEIPT MISSION_TEXT

# 1) Fetch current board into state file (for context)
curl -sk "$READ_URL" > "$STATE/current_board.json"

BOARD_JSON="$(cat "$STATE/current_board.json")"

# 2) Build message for Hobbes (embed board JSON directly)
MSG=$(cat <<EOF_INNER
You are Hobbes, my autonomous build agent for ScanGrade.

Here is the current Kanban board as JSON:
$BOARD_JSON

Task:
- Look at ALL columns: Backlog, To Do, In Progress, Review, Done.
- Ignore any cards in Done for picking new work.
- FIRST preference: choose ONE card that is already In Progress and can be moved meaningfully toward completion.
- If no In Progress card is actionable, choose ONE card from To Do.
- If In Progress and To Do are both empty or not actionable, choose ONE card from Backlog.
- Never move a card just to “touch it” — only pick something where you can actually advance the MVP.
- The mission is: "Ship ScanGrade MVP: one clean worksheet + scoring pipeline that works end-to-end!"

Return STRICT JSON ONLY, no prose, exactly:
{
  "card_id": "<the card.id you selected>",
  "reason": "<1–2 sentence reason>",
  "next_steps": "<3–5 bullet-style steps as plain text or an array of strings>"
}
EOF_INNER
)

# 3) Call OpenClaw agent and store RAW result
RAW="$STATE/work_request.raw.txt"
OUT="$STATE/work_request.json"

/opt/homebrew/bin/openclaw agent --agent main -m "$MSG" > "$RAW"

# 4) Extract the first JSON object from the raw output,
#    enrich it with canonical metadata + status, and save as clean JSON
python3 - "$RAW" "$OUT" << 'PY'
import sys, re, json

raw_path, out_path = sys.argv[1], sys.argv[2]

# Read raw output, ignore any weird bytes
raw = open(raw_path, encoding="utf-8", errors="ignore").read()

# Strip control characters that JSON doesn't allow (except newline/tab)
raw_clean = "".join(
    ch for ch in raw
    if ch in "\n\r\t" or ord(ch) >= 32
)

# Try to find a JSON object in the cleaned text
m = re.search(r'\{.*\}', raw_clean, re.S)
if not m:
    # No JSON at all – just bail quietly
    raise SystemExit("No JSON object found in agent output.")

candidate = m.group(0)

try:
    obj = json.loads(candidate)
except Exception as e:
    # Don't crash the whole tick – log the problem and exit cleanly
    print(f"Failed to parse JSON candidate: {e}", file=sys.stderr)
    raise SystemExit(0)

with open(out_path, "w", encoding="utf-8") as f:
    json.dump(obj, f, indent=2, ensure_ascii=False)

print("OK: wrote clean work_request.json -> " + out_path)
PY

cp "$OUT" "$STATE/work_request.last.json" 2>/dev/null || true
