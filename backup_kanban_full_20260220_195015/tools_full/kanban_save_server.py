#!/usr/bin/env python3
import json, os
from http.server import BaseHTTPRequestHandler, HTTPServer

ROOT = "/Users/openclaw/.openclaw/workspace/scan-grade/dist"
BOARD = os.path.join(ROOT, "board_state.json")
print(f"DEBUG: BOARD_PATH={BOARD}")

class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body=b"OK", ctype="text/plain; charset=utf-8"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        if body:
            self.wfile.write(body)

    def do_OPTIONS(self):
        self._send(204, b"")

    def do_POST(self):
        # Only accept writes for board_state
        if self.path not in ("/api/board_state", "/api/board_state.json"):
            return self._send(404, b"Not found")

        try:
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length)
            print(f"DEBUG: received_bytes={len(raw)}")
            print(f"DEBUG: first80={raw[:80]!r}")
            data = json.loads(raw.decode("utf-8"))

            # minimal validation
            if not isinstance(data, dict) or "columns" not in data or not isinstance(data["columns"], list):
                return self._send(400, b"Invalid payload")

            # keep required top-level fields if present
            out = {
                "current_mission": data.get("current_mission", ""),
                "updated_at": data.get("updated_at", ""),
                "columns": data["columns"],
            }

            # SAFETY: refuse saves that would shrink the board (prevents accidental wipes)
            try:
                if os.path.exists(BOARD):
                    cur = json.load(open(BOARD, "r", encoding="utf-8"))
                    cur_cols = cur.get("columns", []) if isinstance(cur, dict) else []
                    new_cols = out.get("columns", []) if isinstance(out, dict) else []
                    if isinstance(cur_cols, list) and isinstance(new_cols, list) and len(new_cols) < len(cur_cols):
                        return self._send(409, b"Refusing shrink-save (stale client)")
            except Exception:
                pass

            tmp = BOARD + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(out, f, ensure_ascii=False, indent=2)
                f.write("\n")
            os.replace(tmp, BOARD)
            import hashlib
            b=open(BOARD,"rb").read()
            print("DEBUG: AFTER_WRITE_SHA256="+hashlib.sha256(b).hexdigest())

            return self._send(200, b"Saved")
        except Exception as e:
            return self._send(500, ("Error: %s" % e).encode("utf-8"))

def main():
    host = "127.0.0.1"
    port = 9002
    httpd = HTTPServer((host, port), Handler)
    print(f"kanban_save_server listening on http://{host}:{port}")
    httpd.serve_forever()

if __name__ == "__main__":
    main()
