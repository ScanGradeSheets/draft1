#!/usr/bin/env python3
import json, os

STATE = "/Users/openclaw/.openclaw/workspace/scan-grade/tools/kanban/state/mission_state.json"

# defaults if file missing/corrupt
mission_status = "Idle"
blocked_on = ""
done_note = ""

try:
    if os.path.exists(STATE):
        j = json.load(open(STATE, "r", encoding="utf-8"))
        mission_status = (j.get("mission_status") or "Idle").strip()
        blocked_on = (j.get("mission_blocked_on") or "").strip()
        done_note = (j.get("mission_done_note") or "").strip()
except Exception:
    pass

print(f"MISSION_STATUS={mission_status}")
print(f"MISSION_BLOCKED_ON={blocked_on}")
print(f"MISSION_DONE_NOTE={done_note}")
