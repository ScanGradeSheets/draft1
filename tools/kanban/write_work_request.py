#!/usr/bin/env python3
import json, sys, datetime

# usage:
#   write_work_request.py <path> <read_url> <read_sha> <updated_at> <receipt> [mission_text]
if len(sys.argv) not in (6, 7):
    print("usage: write_work_request.py <path> <read_url> <read_sha> <updated_at> <receipt> [mission_text]", file=sys.stderr)
    sys.exit(2)

path, read_url, read_sha, updated_at, receipt = sys.argv[1:6]
mission_text = sys.argv[6] if len(sys.argv) == 7 else None

j = json.load(open(path, "r", encoding="utf-8"))
j["status"] = "pending"
j["created_at_utc"] = datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
j["read_url"] = read_url
j["read_sha"] = read_sha
j["updated_at"] = updated_at
j["receipt"] = receipt
if mission_text is not None:
    j["mission_text"] = mission_text

open(path, "w", encoding="utf-8").write(json.dumps(j, ensure_ascii=False, indent=2) + "\n")
print("WORK_REQUEST=pending")
