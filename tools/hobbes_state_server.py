#!/usr/bin/env python3
import json, os
from http.server import BaseHTTPRequestHandler, HTTPServer
from datetime import datetime, timezone
from pathlib import Path

ROOT = "/Users/openclaw/.openclaw/workspace/scan-grade/dist"
BOARD = os.path.join(ROOT, "board_state.json")
GATEWAY_LOG = os.path.expanduser("~/.openclaw/logs/gateway.log")

print(f"DEBUG: BOARD_PATH={BOARD}")
print(f"DEBUG: GATEWAY_LOG={GATEWAY_LOG}")


def tail_lines(path, max_bytes: int = 65536):
    """Tail up to max_bytes from end of file and return decoded lines."""
    p = Path(path)
    if not p.exists():
        return []
    try:
        size = p.stat().st_size
        with p.open("rb") as f:
            if size > max_bytes:
                f.seek(-max_bytes, os.SEEK_END)
            data = f.read()
        text = data.decode("utf-8", errors="replace")
        return text.splitlines()
    except Exception:
        return []


def parse_ts(line: str):
    """Parse leading ISO8601 timestamp from a gateway.log line."""
    parts = line.split(maxsplit=1)
    if not parts:
        return None
    ts = parts[0]
    if ts.endswith("Z"):
        ts = ts[:-1]
    try:
        dt = datetime.fromisoformat(ts)
        return dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def classify_state(lines):
    """
    Inspect gateway.log lines and determine:

      status: "working" | "idle" | "error"
      last_tick: datetime or None
      last_agent_lines: last 5 "agent/tick" lines
      last_error_lines: last 5 error-ish lines
    """
    now = datetime.now(timezone.utc)

    agent_keywords = ("agent", "tick", "work_loop", "heartbeat")
    error_keywords = ("error", "imsg", "rpc", "pair", "unknown", "failed", "traceback")

    agent_lines = [ln for ln in lines if any(k in ln.lower() for k in agent_keywords)]
    error_lines = [ln for ln in lines if any(k in ln.lower() for k in error_keywords)]

    last_tick = parse_ts(agent_lines[-1]) if agent_lines else None
    last_error = parse_ts(error_lines[-1]) if error_lines else None

    status = "idle"
    WORKING_THRESHOLD = 20  # seconds
    ERROR_WINDOW = 60       # seconds

    if last_tick is not None:
        if (now - last_tick).total_seconds() <= WORKING_THRESHOLD:
            status = "working"

    if last_error is not None:
        if (now - last_error).total_seconds() <= ERROR_WINDOW:
            status = "error"

    return status, last_tick, agent_lines[-5:], error_lines[-5:]


def load_board():
    """Load board_state.json, falling back to minimal structure."""
    try:
        with open(BOARD, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"current_mission": "", "updated_at": "", "columns": []}


def guess_lane(board: dict):
    """
    Guess the column Hobbes is "working" in.

    Heuristic:
      - prefer first non-empty column among: inprogress, review, todo, backlog
      - otherwise first column that has cards
    """
    cols = board.get("columns", []) if isinstance(board, dict) else []
    if not cols:
        return None

    by_id = {c.get("id"): c for c in cols if isinstance(c, dict)}

    priority = ["inprogress", "review", "todo", "backlog"]
    for cid in priority:
        col = by_id.get(cid)
        if col and col.get("cards"):
            return col.get("name") or col.get("id")

    for col in cols:
        if col.get("cards"):
            return col.get("name") or col.get("id")

    return None


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body=b"OK", ctype="text/plain; charset=utf-8"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        if body:
            self.wfile.write(body)

    def _send_json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send(204, b"")

    def do_GET(self):
        if self.path.startswith("/api/hobbes_state"):
            lines = tail_lines(GATEWAY_LOG)
            status, last_tick, last_agent_lines, last_error_lines = classify_state(lines)
            board = load_board()
            mission = board.get("current_mission", "")
            lane = guess_lane(board)

            payload = {
                "status": status,  # "working" | "idle" | "error"
                "current_mission": mission,
                "current_lane_guess": lane,
                "last_tick": last_tick.isoformat() if last_tick else None,
                "last_agent_lines": last_agent_lines,
                "last_error_lines": last_error_lines,
                "gateway_log_path": GATEWAY_LOG,
                "board_path": BOARD,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }
            return self._send_json(200, payload)

        return self._send(404, b"Not found")


def main():
    host = "127.0.0.1"
    port = 9003
    httpd = HTTPServer((host, port), Handler)
    print(f"hobbes_state_server listening on http://{host}:{port}")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
