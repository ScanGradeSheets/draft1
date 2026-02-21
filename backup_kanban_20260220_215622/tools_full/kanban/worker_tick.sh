#!/usr/bin/env bash
set -euo pipefail

TOOLS="/Users/openclaw/.openclaw/workspace/scan-grade/tools/kanban"
STATE="$TOOLS/state"
WR="$STATE/work_request.json"
MS="$STATE/mission_state.json"

[ -f "$WR" ] || exit 0

STATUS="$(python3 -c 'import json; print((json.load(open("'"$WR"'","r",encoding="utf-8")).get("status") or "").strip())' 2>/dev/null || true)"
[ "$STATUS" = "pending" ] || exit 0

# Claim (idempotent)
"$TOOLS/claim_work_request.py" "$WR" >/tmp/claim_out.txt 2>&1 || true
if ! grep -q "WORK_REQUEST=claimed" /tmp/claim_out.txt; then
  exit 0
fi

# Build Gemini prompt artifact (brain consumes this)
"$TOOLS/build_gemini_prompt.py" "$WR" "$STATE/gemini_prompt.txt" >/dev/null
echo "GEMINI_PROMPT_WRITTEN=$STATE/gemini_prompt.txt"

# Mark mission InProgress (deterministic)
python3 - <<'PY'
import json
p="/Users/openclaw/.openclaw/workspace/scan-grade/tools/kanban/state/mission_state.json"
try: j=json.load(open(p,"r",encoding="utf-8"))
except Exception: j={}
j["mission_status"]="InProgress"
j.setdefault("mission_blocked_on","")
j.setdefault("mission_done_note","")
open(p,"w",encoding="utf-8").write(json.dumps(j, ensure_ascii=False, indent=2)+"\n")
print("MISSION_STATUS_SET=InProgress")
PY

# Hand-off point: brain runner should read gemini_prompt.txt, perform work, and then write results.
echo "WORKER_DISPATCHED"
exit 0
