#!/usr/bin/env python3
import json
import os
import tempfile
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from datetime import datetime

# Path to the canonical board_state.json
ROOT = Path(__file__).resolve().parent.parent
BOARD_PATH = ROOT / "dist" / "board_state.json"


def load_board():
    if BOARD_PATH.exists():
        with BOARD_PATH.open("r", encoding="utf-8") as f:
            try:
                return json.load(f)
            except Exception:
                return {}
    return {}


def atomic_write_board(data):
    BOARD_PATH.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(
        dir=str(BOARD_PATH.parent),
        prefix="board_state.",
        suffix=".tmp",
    )
    with os.fdopen(fd, "w", encoding="utf-8") as tmp_file:
        json.dump(data, tmp_file, ensure_ascii=False, indent=2)
        tmp_file.flush()
        os.fsync(tmp_file.fileno())
    os.replace(tmp_path, BOARD_PATH)


class BoardHandler(BaseHTTPRequestHandler):
    def _set_headers(self, status=200, content_type="application/json"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_OPTIONS(self):
        # CORS preflight
        if self.path == "/api/board_state":
            self._set_headers(200)
        else:
            self._set_headers(404)

    def do_POST(self):
        if self.path != "/api/board_state":
            self._set_headers(404)
            self.wfile.write(b'{"error":"unknown path"}')
            return

        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length > 0 else b"{}"

        try:
            incoming = json.loads(body.decode("utf-8"))
        except Exception:
            self._set_headers(400)
            self.wfile.write(b'{"error":"invalid json"}')
            return

        existing = load_board()
        if not isinstance(existing, dict):
            existing = {}

        # ── Merge: incoming is authoritative for columns & current_mission
        # Columns: REPLACE completely so deletes actually persist
        if "columns" in incoming and isinstance(incoming["columns"], list):
            existing["columns"] = incoming["columns"]

        # current_mission: overwrite if present
        if "current_mission" in incoming:
            existing["current_mission"] = incoming["current_mission"]

        # updated_at: either take incoming or set now
        if "updated_at" in incoming:
            existing["updated_at"] = incoming["updated_at"]
        else:
            existing["updated_at"] = datetime.utcnow().isoformat() + "Z"

        # Write back to disk atomically
        atomic_write_board(existing)

        self._set_headers(200)
        self.wfile.write(
            json.dumps(
                {
                    "status": "ok",
                    "updated_at": existing.get("updated_at"),
                }
            ).encode("utf-8")
        )

    def log_message(self, format, *args):
        # Keep logs quiet; Python's simple server already logs to stdout
        return


def run_server():
    addr = ("0.0.0.0", 9002)
    httpd = HTTPServer(addr, BoardHandler)
    print(f"Serving /api/board_state on port {addr[1]}")
    httpd.serve_forever()


if __name__ == "__main__":
    run_server()
