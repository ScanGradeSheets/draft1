#!/usr/bin/env python3
import json, sys, datetime

BOARD = "/Users/openclaw/.openclaw/workspace/scan-grade/dist/board_state.json"

def now_utc():
    return datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

def die(msg, code=2):
    print("ERROR:", msg, file=sys.stderr)
    sys.exit(code)

def load_board():
    with open(BOARD, "r", encoding="utf-8") as f:
        return json.load(f)

def save_board(b):
    tmp = BOARD + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(b, f, ensure_ascii=False, indent=2)
        f.write("\n")
    # atomic-ish replace
    import os
    os.replace(tmp, BOARD)

def find_col(b, name):
    for c in b.get("columns", []):
        if (c.get("name") or "").strip() == name:
            return c
    return None

def title_exists(b, title):
    t = title.strip()
    for c in b.get("columns", []):
        for card in c.get("cards", []) or []:
            if (card.get("title") or "").strip() == t:
                return True
    return False

def make_unique(b, title):
    base = title.strip()
    if not title_exists(b, base):
        return base
    i = 2
    while True:
        cand = f"{base} ({i})"
        if not title_exists(b, cand):
            return cand
        i += 1

def main():
    if len(sys.argv) < 2:
        die('usage: board_add_card.py "<title>" [Backlog|Blocked] [notes]', 2)

    title = (sys.argv[1] or "").strip()
    if not title:
        die("empty title")

    col = (sys.argv[2] if len(sys.argv) >= 3 else "Backlog").strip()
    # Guardrails: default to Backlog; allow Blocked only if explicitly asked.
    if col not in ("Backlog", "Blocked"):
        col = "Backlog"

    notes = (sys.argv[3] if len(sys.argv) >= 4 else "").strip()

    b = load_board()
    target = find_col(b, col)
    if not target:
        die(f'column not found: {col}')

    title2 = make_unique(b, title)

    card = {
        "title": title2,
        "notes": notes,
        "created_at_utc": now_utc(),
        "created_by": "hobbes",
    }

    cards = target.get("cards", [])
    if cards is None:
        cards = []
    cards.append(card)
    target["cards"] = cards

    # Touch updated_at (if present in your schema)
    b["updated_at"] = now_utc()

    save_board(b)
    print(f"OK: added card -> {col}: {title2}")

if __name__ == "__main__":
    main()
