import json
from http.server import SimpleHTTPRequestHandler, HTTPServer
import os

BOARD_FILE = os.path.expanduser("~/.openclaw/workspace/scan-grade/dist/board_state.json")

class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.endswith("/board_state.json"):
            with open(BOARD_FILE, "r", encoding="utf-8") as f:
                data = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(data.encode("utf-8"))
        else:
            super().do_GET()

    def do_OPTIONS(self):
        if self.path.endswith("/api/board_state"):
            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path.endswith("/api/board_state"):
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)

            # Parse JSON body safely
            try:
                payload = json.loads(body.decode("utf-8"))
            except Exception:
                self.send_response(400)
                self.send_header("Content-Type", "text/plain; charset=utf-8")
                self.end_headers()
                self.wfile.write(b"Invalid JSON")
                return

            if not isinstance(payload, dict):
                self.send_response(400)
                self.send_header("Content-Type", "text/plain; charset=utf-8")
                self.end_headers()
                self.wfile.write(b"Invalid payload")
                return

            # Load existing board_state.json (or start fresh)
            try:
                with open(BOARD_FILE, "r", encoding="utf-8") as f:
                    board = json.load(f)
            except Exception:
                board = {}

            # Treat incoming JSON as a PATCH: update top-level keys
            for key, value in payload.items():
                board[key] = value

            # Save merged board back to disk
            with open(BOARD_FILE, "w", encoding="utf-8") as f:
                json.dump(board, f, ensure_ascii=False, indent=2)

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')
        else:
            self.send_response(404)
            self.end_headers()

def run():
    server_address = ("", 9002)
    httpd = HTTPServer(server_address, Handler)
    print("Serving /api/board_state on port 9002")
    httpd.serve_forever()

if __name__ == "__main__":
    run()
