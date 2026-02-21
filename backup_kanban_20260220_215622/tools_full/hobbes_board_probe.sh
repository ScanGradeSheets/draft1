#!/usr/bin/env bash
set -euo pipefail

READ_URL="https://hobbes-mac-mini.tail9a3379.ts.net/board_state.json"
WRITE_URL="https://hobbes-mac-mini.tail9a3379.ts.net/api/board_state"

echo "=== PROBE: READ (canonical via Tailscale) ==="
OUT="$(./tools/fetch_board.sh)"
echo "$OUT" | sed -n '1,3p'

JSON_TMP="/tmp/board_probe.json"
echo "$OUT" | awk '
  /^READ_URL=/ {next}
  /^READ_SHA=/ {next}
  /^UPDATED_AT=/ {next}
  {print}
' > "$JSON_TMP"

echo "MISSION_FROM_FETCH:"
python3 -c 'import json; print(json.load(open("/tmp/board_probe.json","r",encoding="utf-8")).get("current_mission",""))'

echo
echo "=== PROBE: WRITE (Save API) ==="
python3 - <<'PY'
import json, urllib.request, datetime

read_url = "https://hobbes-mac-mini.tail9a3379.ts.net/board_state.json"
write_url = "https://hobbes-mac-mini.tail9a3379.ts.net/api/board_state"

j = json.loads(urllib.request.urlopen(read_url).read().decode("utf-8"))
j["current_mission"] = "HOBBES_PROBE_WRITE_OK"
j["updated_at"] = datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

data = json.dumps(j).encode("utf-8")
req = urllib.request.Request(write_url, data=data, headers={"Content-Type":"application/json"}, method="POST")
with urllib.request.urlopen(req, timeout=10) as resp:
    body = resp.read().decode("utf-8", errors="replace")
    print("WRITE_STATUS:", resp.status)
    print("WRITE_BODY_HEAD:", body[:120])
PY

echo
echo "=== CONFIRM: READ AFTER WRITE (canonical) ==="
curl -sk "$READ_URL" | python3 -c 'import sys,json; j=json.load(sys.stdin); print("current_mission:", j.get("current_mission")); print("updated_at:", j.get("updated_at"))'
