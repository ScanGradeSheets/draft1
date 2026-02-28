#!/usr/bin/env bash
set -euo pipefail

BASE="/Users/openclaw/.openclaw/workspace/scan-grade"
KAN="$BASE/tools/kanban"
STATE="$KAN/state"

REQ="$STATE/work_request.json"

# If there's no work_request, nothing to finalize
if [ ! -f "$REQ" ]; then
  echo "No work_request.json — nothing to finalize."
  exit 0
fi

# 1) Read card_id from work_request.json
CARD_ID=$(python3 - "$REQ" << 'PY'
import json, sys
data = json.load(open(sys.argv[1], "r", encoding="utf-8"))
cid = data.get("card_id")
if not cid:
    raise SystemExit("no card_id in work_request.json")
print(cid)
PY
)

echo "Finalizing card_id=$CARD_ID (non-destructive: logging only, no column moves)"

: << 'NO_BOARD_MUTATION'
# 2) Fetch latest canonical board
curl -sk "https://hobbes-mac-mini.tail9a3379.ts.net/board_state.json" \
  > "$STATE/current_board_for_finalize.json"

# 3) Move the card into the Review column
python3 - "$STATE/current_board_for_finalize.json" "$STATE/updated_board_finalize.json" "$CARD_ID" << 'PY'
import json, sys

board_path, out_path, card_id = sys.argv[1], sys.argv[2], sys.argv[3]
board = json.load(open(board_path, "r", encoding="utf-8"))
cols = board.get("columns", []) or []
card_obj = None

# Remove the card from any column
for col in cols:
    new_cards = []
    for c in col.get("cards", []) or []:
        if c.get("id") == card_id and card_obj is None:
            card_obj = c
        else:
            new_cards.append(c)
    col["cards"] = new_cards

if card_obj is None:
    raise SystemExit(f"card_id {card_id!r} not found in board")

# Insert at top of Review column
for col in cols:
    if (col.get("name") or "").strip() == "Review":
        col.setdefault("cards", [])
        col["cards"].insert(0, card_obj)
        break
else:
    # If there is no Review column yet, create one
    cols.append({
        "id": "review-auto",
        "name": "Review",
        "cards": [card_obj],
    })

board["columns"] = cols
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(board, f, indent=2)
PY

# 4) Write updated board back via save API
curl -s -X POST -H "Content-Type: application/json" \
  --data @"$STATE/updated_board_finalize.json" \
  http://127.0.0.1:9002/api/board_state > /dev/null
NO_BOARD_MUTATION

# 5) Mark work_request as done so worker_tick won't keep re-claiming it
python3 - "$REQ" << 'PY'
import json, sys
p = sys.argv[1]
data = json.load(open(p, "r", encoding="utf-8"))
data["status"] = "done"
with open(p, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)
PY
echo "WORK_REQUEST=done"

# 6) Set mission_status back to Idle
python3 - << 'PY'
import json, os

p = "/Users/openclaw/.openclaw/workspace/scan-grade/tools/kanban/state/mission_state.json"
try:
    j = json.load(open(p, "r", encoding="utf-8"))
except Exception:
    j = {}

j["mission_status"] = "Idle"
j.setdefault("mission_blocked_on", "")
j.setdefault("mission_done_note", "")

with open(p, "w", encoding="utf-8") as f:
    json.dump(j, f, indent=2)

print("MISSION_STATUS_SET=Idle")
PY

echo "Finalize tick complete."
