#!/usr/bin/env python3
import json, sys, datetime, os

BOARD = "/Users/openclaw/.openclaw/workspace/scan-grade/dist/board_state.json"

def now_utc():
    return datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

def die(msg, code=2):
    print("ERROR:", msg, file=sys.stderr)
    sys.exit(code)

title = sys.argv[1] if len(sys.argv) > 1 else None
dst_name = sys.argv[2] if len(sys.argv) > 2 else None
if not title or not dst_name:
    die("usage: board_move_card.py <card_title> <dst_column_name>")

if not os.path.exists(BOARD):
    die(f"board file not found: {BOARD}")

j = json.load(open(BOARD, "r", encoding="utf-8"))
cols = j.get("columns") or []
if not cols:
    die("no columns in board_state.json")

# find dst column
dst_idx = None
for i,c in enumerate(cols):
    if (c.get("name") or "").strip() == dst_name:
        dst_idx = i
        break
if dst_idx is None:
    die(f"dst column not found: {dst_name}")

# find card + remove from its current column
card = None
src_name = ""
for c in cols:
    cards = c.get("cards") or []
    for k in range(len(cards)):
        if (cards[k].get("title") or "").strip() == title:
            card = cards.pop(k)
            src_name = (c.get("name") or "").strip()
            break
    if card:
        break

if not card:
    die(f"card not found by exact title: {title}")

# append to dst
cols[dst_idx].setdefault("cards", []).append(card)

# stamp updated_at
j["updated_at"] = now_utc()

tmp = BOARD + ".tmp"
open(tmp, "w", encoding="utf-8").write(json.dumps(j, ensure_ascii=False, indent=2) + "\n")
os.replace(tmp, BOARD)

print("OK_MOVED")
print("TITLE=" + title)
print("FROM=" + src_name)
print("TO=" + dst_name)
print("UPDATED_AT=" + j["updated_at"])
