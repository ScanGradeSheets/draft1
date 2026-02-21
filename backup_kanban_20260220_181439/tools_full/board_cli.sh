#!/usr/bin/env bash
set -euo pipefail

READ_URL="https://hobbes-mac-mini.tail9a3379.ts.net/board_state.json"
WRITE_URL="https://hobbes-mac-mini.tail9a3379.ts.net/api/board_state"

cmd="${1:-}"
shift || true

case "$cmd" in
  read)
    curl -sk "$READ_URL"
    ;;

  mission-set)
    NEW="${1:-}"
    if [[ -z "$NEW" ]]; then
      echo "usage: board_cli.sh mission-set \"text\"" >&2
      exit 2
    fi

    python3 - "$READ_URL" "$WRITE_URL" "$NEW" <<'PY2'
import json, urllib.request, datetime, sys
read_url, write_url, new_mission = sys.argv[1], sys.argv[2], sys.argv[3]
j = json.loads(urllib.request.urlopen(read_url).read().decode("utf-8"))
j["current_mission"] = new_mission
j["updated_at"] = datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
data = json.dumps(j).encode("utf-8")
req = urllib.request.Request(write_url, data=data, headers={"Content-Type":"application/json"}, method="POST")
with urllib.request.urlopen(req, timeout=10) as r:
    print("WRITE_STATUS", r.status)
print("OK")
PY2
    ;;

  card-add)
    COL="${1:-}"
    TITLE="${2:-}"
    NOTES="${3:-}"
    if [[ -z "$COL" || -z "$TITLE" ]]; then
      echo "usage: board_cli.sh card-add \"Column Name\" \"Title\" \"Notes(optional)\"" >&2
      exit 2
    fi

    python3 - "$READ_URL" "$WRITE_URL" "$COL" "$TITLE" "${NOTES:-}" <<'PY2'
import json, urllib.request, datetime, sys
read_url, write_url = sys.argv[1], sys.argv[2]
col_name, title = sys.argv[3], sys.argv[4]
notes = sys.argv[5] if len(sys.argv) > 5 else ""

j = json.loads(urllib.request.urlopen(read_url).read().decode("utf-8"))
cols = j.get("columns", [])
target = None
for c in cols:
    if c.get("name") == col_name:
        target = c
        break
if target is None:
    raise SystemExit("NO_SUCH_COLUMN:" + col_name)

cards = target.get("cards") or []
cards.append({"title": title, "notes": notes})
target["cards"] = cards

j["updated_at"] = datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
data = json.dumps(j).encode("utf-8")
req = urllib.request.Request(write_url, data=data, headers={"Content-Type":"application/json"}, method="POST")
with urllib.request.urlopen(req, timeout=10) as r:
    print("WRITE_STATUS", r.status)
print("OK")
PY2
    ;;

  rebuild-mvp)
    # Rebuild board to MVP structure WITHOUT changing canonical column schema.
    # Keeps existing columns (including Ready/Blocked) to avoid server-side 409 conflicts.
    python3 - "$READ_URL" "$WRITE_URL" <<'PY2'
import json, urllib.request, datetime, sys

read_url, write_url = sys.argv[1], sys.argv[2]

# Read canonical
j = json.loads(urllib.request.urlopen(read_url).read().decode("utf-8"))
existing_cols = j.get("columns", []) or []

# Keep existing canonical columns/order, but wipe cards everywhere
cols = []
for c in existing_cols:
    name = c.get("name") or ""
    cols.append({"name": name, "cards": []})

def ensure_col(name):
    for c in cols:
        if c.get("name") == name:
            return c
    c = {"name": name, "cards": []}
    cols.append(c)
    return c

# Ensure core columns exist (and keep any others that already exist)
for name in ["Backlog","Ready","InProgress","Blocked","Review","Done"]:
    ensure_col(name)

def add(col, title, notes=""):
    c = ensure_col(col)
    c["cards"].append({"title": title, "notes": notes})

# === REAL WORK CARDS ===

# Backlog
add("Backlog", "Worksheet v1 spec: layout + QR placement",
    "Decide page size, margins, student name/date area, QR location, question block layout. Output: 1-page spec + sample PDF/PNG.")
add("Backlog", "Digits-only normalization + blank detection (scoring)",
    "Implement normalizeAnswer(raw, mode='digits'): trim, remove spaces, keep digits only. Treat empty as blank. Add tests for null/undefined.")
add("Backlog", "End-to-end MVP success criteria",
    "Define: photo → QR → extract answers → normalize → score → export. Decide pass/fail + acceptance tests.")
add("Backlog", "QR payload + worksheet ID standard",
    "Lock QR contents: worksheet_id + version + schema. Keep stable for matching scans to answer keys.")

# InProgress
add("InProgress", "Kanban stability: canonical read/write + UI sync",
    "Board_state.json is canonical. UI reads canonical first. Verify moves + clicks + saves don’t break write path.")

# Review
add("Review", "UI: move cards + click details + feedback persists to notes",
    "Add move control + modal works. Feedback must persist into card.notes in board_state.json (not just console.log).")

# Done
add("Done", "CLI read/write proof (board_cli.sh)",
    "Confirmed: mission-set/card-add/rebuild-mvp write HTTP 200 and read back.")

j["current_mission"] = j.get("current_mission") or "Ship ScanGrade MVP: one clean worksheet + scoring pipeline that WORKS end-to-end."
j["columns"] = cols
j["updated_at"] = datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

data = json.dumps(j).encode("utf-8")
req = urllib.request.Request(write_url, data=data, headers={"Content-Type":"application/json"}, method="POST")
with urllib.request.urlopen(req, timeout=10) as r:
    print("WRITE_STATUS", r.status)
print("OK")

PY2
    ;;

  *)
    echo "commands:"
    echo "  read"
    echo "  mission-set \"text\""
    echo "  card-add \"Column Name\" \"Title\" \"Notes\""
    exit 2
    ;;
esac
