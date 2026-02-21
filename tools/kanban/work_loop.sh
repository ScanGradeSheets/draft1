#!/usr/bin/env bash
set -euo pipefail

BASE="/Users/openclaw/.openclaw/workspace/scan-grade"
KAN="$BASE/tools/kanban"
STATE="$KAN/state"

REQ="$STATE/work_request.json"
if [ ! -f "$REQ" ]; then
  echo "No work_request.json — nothing to move."
  exit 0
fi

# 1) Load requested card_id
CARD_ID=$(python3 - "$REQ" << 'PY'
import json, sys
data = json.load(open(sys.argv[1]))
cid = data.get("card_id")
if not cid:
    raise SystemExit("no card_id in work_request.json")
print(cid)
PY
)

echo "Moving card_id=$CARD_ID into In Progress"

# 2) Fetch latest board
curl -sk "https://hobbes-mac-mini.tail9a3379.ts.net/board_state.json" \
  > "$STATE/current_board_for_move.json"

# 2.5) If the card is already in In Progress, do nothing
CURRENT_COL=$(python3 - "$STATE/current_board_for_move.json" "$CARD_ID" << 'PY'
import json, sys
board_path, card_id = sys.argv[1], sys.argv[2]
board = json.load(open(board_path, encoding="utf-8"))

for col in board.get("columns", []):
    name = (col.get("name") or "").strip()
    for c in col.get("cards", []) or []:
        if c.get("id") == card_id:
            print(name)
            sys.exit(0)

print("")
PY
)

if [ "$CURRENT_COL" = "In Progress" ]; then
  echo "Card $CARD_ID already In Progress; skipping move."
  exit 0
fi

# 3) Move the card into In Progress
python3 - "$STATE/current_board_for_move.json" "$STATE/updated_board.json" "$CARD_ID" << 'PY'

board_path, out_path, card_id = sys.argv[1], sys.argv[2], sys.argv[3]
board = json.load(open(board_path))

cols = board.get("columns", [])
card_obj = None

# Remove from any column
for col in cols:
    new_cards = []
    for c in col.get("cards", []):
        if c.get("id") == card_id and card_obj is None:
            card_obj = c
        else:
            new_cards.append(c)
    col["cards"] = new_cards

if card_obj is None:
    raise SystemExit(f"card_id {card_id!r} not found in board")

# Insert at top of In Progress
for col in cols:
    if col.get("name") == "In Progress":
        col.setdefault("cards", [])
        col["cards"].insert(0, card_obj)
        break
else:
    raise SystemExit("No 'In Progress' column found")

board["columns"] = cols
json.dump(board, open(out_path, "w", encoding="utf-8"), indent=2)
PY

# 4) Write updated board back via save API
curl -s -X POST -H "Content-Type: application/json" \
  --data @"$STATE/updated_board.json" \
  http://127.0.0.1:9002/api/board_state > /dev/null

# 5) Log a tiny note
echo "$(date +'%Y-%m-%d %H:%M:%S') moved $CARD_ID -> In Progress" >> "$STATE/work_loop.log"
echo "Done."
