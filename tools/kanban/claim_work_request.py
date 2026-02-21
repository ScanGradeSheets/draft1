#!/usr/bin/env python3
import json, sys, datetime

path = sys.argv[1] if len(sys.argv) > 1 else None
if not path:
    print("usage: claim_work_request.py <path>", file=sys.stderr)
    sys.exit(2)

j = json.load(open(path, "r", encoding="utf-8"))
if j.get("status") != "pending":
    print("NOOP: status=" + str(j.get("status")))
    sys.exit(0)

j["status"] = "claimed"
j["claimed_at_utc"] = datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
j.pop("done_at_utc", None)
j.pop("blocked_at_utc", None)
open(path, "w", encoding="utf-8").write(json.dumps(j, ensure_ascii=False, indent=2) + "\n")
print("WORK_REQUEST=claimed")
