#!/usr/bin/env python3
import json, sys, datetime, subprocess

if len(sys.argv) != 3:
    print("usage: build_gemini_prompt.py <work_request.json> <out_path>", file=sys.stderr)
    sys.exit(2)

wr_path, out_path = sys.argv[1], sys.argv[2]

wr = json.load(open(wr_path, "r", encoding="utf-8"))

read_url   = wr.get("read_url","")
read_sha   = wr.get("read_sha","")
updated_at = wr.get("updated_at","")
receipt    = wr.get("receipt","")
mission_text = (wr.get("mission_text") or "").strip()

timestamp = datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

prompt = f"""YOU ARE HOBBES (DEV MODE). LOCAL-FIRST. DETERMINISTIC.
NON-NEGOTIABLE CANONICAL RECEIPT:
READ_URL={read_url}
READ_SHA={read_sha}
UPDATED_AT={updated_at}
RECEIPT={receipt}
MISSION_TEXT={mission_text}

HARD RULES:
- You MUST re-fetch canonical board via READ_URL before any plan or summary.
- Any summary MUST include READ_URL, READ_SHA, UPDATED_AT, RECEIPT.
- Work only on dev/hobbes-YYYYMMDD-* branch.
- Never merge to main. Never touch safety-critical configs.
- If blocked, output exactly: BLOCKED: <reason> | NEED: <input>

TASK:
Using MISSION_TEXT (frozen above) as the mission, do the next concrete DEV step.
Move ONE card forward only when real progress is made. NEVER use the Ready column.
Do NOT ask Tony for approval unless Blocked or something is Ready for Review. Prefer autonomous progress.

Output EXACTLY these keys (one per line):
WORK_CARD_TITLE=<must match a title from BOARD_NOW exactly>
MOVE_TO=<one of: InProgress | Review | Blocked | Done>

SHORT_PLAN=<max 6 bullets separated by " | ">
EXACT_COMMANDS=<only if needed; separated by " ; ">
DONE_CRITERIA=<2-4 verify steps separated by " | ">
ADD_CARD_TITLE=<optional; if you discover a missing prerequisite, write the new backlog card title>
ADD_CARD_NOTES=<optional; one line: why it’s needed + next action>
If you discover a missing prerequisite, emit ADD_CARD_TITLE/ADD_CARD_NOTES and keep MOVE_TO=InProgress. Do NOT message Tony for this.

Then include the receipt lines again at the end:
READ_URL=...
READ_SHA=...
UPDATED_AT=...
RECEIPT=...

TIMESTAMP_UTC={timestamp}
"""

# ---- BOARD SNAPSHOT (canonical via curl -sk) ----
board_lines = []
try:
    raw = subprocess.check_output(["curl", "-sk", read_url], timeout=15)
    board = json.loads(raw.decode("utf-8", errors="replace"))
    cols = board.get("columns", []) or []

    board_lines.append("")
    board_lines.append("BOARD_NOW (canonical titles; use EXACTLY for moves):")

    for c in cols:
        name = (c.get("name") or "").strip()
        cards = c.get("cards") or []
        if not name:
            continue
        board_lines.append(f"== {name} ({len(cards)}) ==")
        for card in cards:
            title = (card.get("title") or "").strip()
            if title:
                board_lines.append(f"- {title}")

except Exception:
    board_lines.append("")
    board_lines.append("BOARD_NOW=ERROR (could not fetch)")

prompt = prompt + "\n" + "\n".join(board_lines) + "\n"

open(out_path, "w", encoding="utf-8").write(prompt)
print("OK: wrote gemini prompt -> " + out_path)
