#!/usr/bin/env bash
set -euo pipefail

TOOLS="/Users/openclaw/.openclaw/workspace/scan-grade/tools/kanban"
STATE="$TOOLS/state"
WR="$STATE/work_request.json"
MS="$STATE/mission_state.json"
OUT="$STATE/brain_output.txt"

[ -f "$WR" ] || exit 0
[ -f "$OUT" ] || exit 0

STATUS="$(python3 -c 'import json; print((json.load(open("'"$WR"'","r",encoding="utf-8")).get("status") or "").strip())' 2>/dev/null || true)"
[ "$STATUS" = "claimed" ] || exit 0

STAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

# ---- Require brain_output structure ----
need() { grep -q "^$1=" "$OUT"; }

if ! need "SHORT_PLAN" || ! need "EXACT_COMMANDS" || ! need "DONE_CRITERIA"; then
  python3 - <<PY
import json
p="$MS"
try: j=json.load(open(p,"r",encoding="utf-8"))
except Exception: j={}
j["mission_status"]="Blocked"
j["mission_blocked_on"]="Missing required fields in brain_output.txt (need SHORT_PLAN/EXACT_COMMANDS/DONE_CRITERIA)"
j["mission_done_note"]=""
open(p,"w",encoding="utf-8").write(json.dumps(j, ensure_ascii=False, indent=2)+"\n")
print("MISSION_STATUS_SET=Blocked")
PY
  python3 - <<PY
import json
p="$WR"
j=json.load(open(p,"r",encoding="utf-8"))
j["status"]="blocked"
j["blocked_at_utc"]="$STAMP"
j.pop("done_at_utc", None)
open(p,"w",encoding="utf-8").write(json.dumps(j, ensure_ascii=False, indent=2)+"\n")
print("WORK_REQUEST=blocked")
PY
  echo "FINALIZE_REFUSED missing_fields"
  exit 0
fi

# ---- Require canonical receipt lines ----
REQ1="$(grep -m1 '^READ_URL=' "$OUT" 2>/dev/null || true)"
REQ2="$(grep -m1 '^READ_SHA=' "$OUT" 2>/dev/null || true)"
REQ3="$(grep -m1 '^UPDATED_AT=' "$OUT" 2>/dev/null || true)"
REQ4="$(grep -m1 '^RECEIPT=' "$OUT" 2>/dev/null || true)"

if [ -z "$REQ1" ] || [ -z "$REQ2" ] || [ -z "$REQ3" ] || [ -z "$REQ4" ]; then
  python3 - <<PY
import json
p="$MS"
try: j=json.load(open(p,"r",encoding="utf-8"))
except Exception: j={}
j["mission_status"]="Blocked"
j["mission_blocked_on"]="Missing canonical receipt lines in brain_output.txt (must include READ_URL/READ_SHA/UPDATED_AT/RECEIPT)"
j["mission_done_note"]=""
open(p,"w",encoding="utf-8").write(json.dumps(j, ensure_ascii=False, indent=2)+"\n")
print("MISSION_STATUS_SET=Blocked")
PY
  python3 - <<PY
import json
p="$WR"
j=json.load(open(p,"r",encoding="utf-8"))
j["status"]="blocked"
j["blocked_at_utc"]="$STAMP"
j.pop("done_at_utc", None)
open(p,"w",encoding="utf-8").write(json.dumps(j, ensure_ascii=False, indent=2)+"\n")
print("WORK_REQUEST=blocked")
PY
  echo "FINALIZE_REFUSED missing_receipt"
  exit 0
fi

# ---- Optional card move ----
CARD_TITLE="$(awk -F= '/^WORK_CARD_TITLE=/{sub(/^WORK_CARD_TITLE=/,""); print; exit}' "$OUT" 2>/dev/null || true)"
MOVE_TO="$(awk -F= '/^MOVE_TO=/{sub(/^MOVE_TO=/,""); print; exit}' "$OUT" 2>/dev/null || true)"

# ---- Optional: brain can request adding a new Backlog card ----
ADD_CARD_TITLE="$(awk -F= '/^ADD_CARD_TITLE=/{sub(/^ADD_CARD_TITLE=/,""); print; exit}' "$OUT" 2>/dev/null || true)"
ADD_CARD_NOTES="$(awk -F= '/^ADD_CARD_NOTES=/{sub(/^ADD_CARD_NOTES=/,""); print; exit}' "$OUT" 2>/dev/null || true)"

# Safety: only ever add to Backlog; never ping Tony for this.
if [ -n "${ADD_CARD_TITLE:-}" ]; then
  "$TOOLS/board_add_card.py" "$ADD_CARD_TITLE" "Backlog" "${ADD_CARD_NOTES:-}" >/tmp/board_add_out.txt 2>&1 || true
  echo "ADD_CARD_ATTEMPTED title=$ADD_CARD_TITLE"
  tail -n 1 /tmp/board_add_out.txt 2>/dev/null || true
fi


# Allowed columns (Ready is hidden but exists; we won't move *to* Ready)
case "${MOVE_TO:-}" in
  "" ) MOVE_TO="" ;;
  Backlog|InProgress|Blocked|Review|Done) : ;;
  Ready) MOVE_TO="Review" ;; # never move to Ready
  * )
    MOVE_TO="Blocked"
    ;;
esac

if [ -n "${CARD_TITLE:-}" ] && [ -n "${MOVE_TO:-}" ] && [ "${MOVE_TO:-}" != "Blocked" ]; then
  # Try move; if fails, treat as blocked.
  if ! "$TOOLS/board_move_card.py" "$CARD_TITLE" "$MOVE_TO" >/tmp/board_move_out.txt 2>&1; then
    python3 - <<PY
import json
p="$MS"
try: j=json.load(open(p,"r",encoding="utf-8"))
except Exception: j={}
j["mission_status"]="Blocked"
j["mission_blocked_on"]="Card move failed: " + open("/tmp/board_move_out.txt","r",encoding="utf-8",errors="replace").read().strip()
j["mission_done_note"]=""
open(p,"w",encoding="utf-8").write(json.dumps(j, ensure_ascii=False, indent=2)+"\n")
print("MISSION_STATUS_SET=Blocked")
PY
    python3 - <<PY
import json
p="$WR"
j=json.load(open(p,"r",encoding="utf-8"))
j["status"]="blocked"
j["blocked_at_utc"]="$STAMP"
j.pop("done_at_utc", None)
open(p,"w",encoding="utf-8").write(json.dumps(j, ensure_ascii=False, indent=2)+"\n")
print("WORK_REQUEST=blocked")
PY
    # Notify only if we have a target
    if [ -n "${IMESSAGE_TO:-}" ]; then
      openclaw message send --channel imessage --target "${IMESSAGE_TO}" --message "KANBAN: Blocked | ${CARD_TITLE} | move failed (see brain_output.txt)" >/dev/null 2>&1 || true
      echo "NOTIFY_SENT=Blocked"
    fi
    echo "FINALIZE_REFUSED move_failed"
    exit 0
  fi
fi

# ---- Mission state follows MOVE_TO (or stays InProgress if no move) ----
python3 - <<PY
import json
p="$MS"
try: j=json.load(open(p,"r",encoding="utf-8"))
except Exception: j={}
move_to="${MOVE_TO:-}"

if move_to == "Blocked":
    j["mission_status"]="Blocked"
    j["mission_blocked_on"]=j.get("mission_blocked_on") or "Blocked (see brain_output.txt)"
    j["mission_done_note"]=""
elif move_to == "Review":
    j["mission_status"]="Review"
    j["mission_blocked_on"]=""
    j["mission_done_note"]="Ready for review. See brain_output.txt."
elif move_to == "Done":
    j["mission_status"]="Done"
    j["mission_blocked_on"]=""
    j["mission_done_note"]="Completed. See brain_output.txt for details."
else:
    j["mission_status"]="InProgress"
    j["mission_blocked_on"]=""
    j["mission_done_note"]="Working..."

open(p,"w",encoding="utf-8").write(json.dumps(j, ensure_ascii=False, indent=2)+"\n")
print("MISSION_STATUS_SET="+j["mission_status"])
PY

# ---- Notify Tony only when Review or Blocked ----
if [ -n "${IMESSAGE_TO:-}" ] && { [ "${MOVE_TO:-}" = "Blocked" ] || [ "${MOVE_TO:-}" = "Review" ]; }; then
  openclaw message send --channel imessage --target "${IMESSAGE_TO}" --message "KANBAN: ${MOVE_TO} | ${CARD_TITLE:-<no card>} | See board + brain_output.txt" >/dev/null 2>&1 || true
  echo "NOTIFY_SENT=${MOVE_TO}"
fi

# ---- Close work request: blocked iff MOVE_TO=Blocked, else done ----
python3 - <<PY
import json
p="$WR"
j=json.load(open(p,"r",encoding="utf-8"))
move_to="${MOVE_TO:-}"

if move_to == "Blocked":
    j["status"]="blocked"
    j["blocked_at_utc"]="$STAMP"
    j.pop("done_at_utc", None)
    print("WORK_REQUEST=blocked")
else:
    j["status"]="done"
    j["done_at_utc"]="$STAMP"
    j.pop("blocked_at_utc", None)
    print("WORK_REQUEST=done")

open(p,"w",encoding="utf-8").write(json.dumps(j, ensure_ascii=False, indent=2)+"\n")
PY

echo "FINALIZE_OK"
