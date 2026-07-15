#!/usr/bin/env python3
"""Local CORS bridge to the tailnet-only model routes for saved-page replay.

This test utility contains no token and never accepts answer-key fields. It is
bound to loopback and forwards only the two explicit recognition paths.
"""

from __future__ import annotations

import argparse
import json
import ssl
import threading
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


REMOTE_ORIGIN = "https://hobbes-mac-mini.tail9a3379.ts.net"


def handler(remote_prefix: str, allowed_path: str):
    class Handler(BaseHTTPRequestHandler):
        def headers_for(self, status: int, length: int):
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin", "*"))
            self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
            self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
            self.send_header("Content-Length", str(length))
            self.end_headers()

        def do_OPTIONS(self):
            self.headers_for(204, 0)

        def forward(self):
            if self.path.split("?", 1)[0] not in {allowed_path, "/health"}:
                payload = b'{"error":"path not allowed"}'
                self.headers_for(404, len(payload))
                self.wfile.write(payload)
                return
            length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(length) if length else None
            suffix = "/health" if self.path.startswith("/health") else allowed_path
            request = urllib.request.Request(
                f"{REMOTE_ORIGIN}{remote_prefix}{suffix}",
                data=body,
                method=self.command,
                headers={"Content-Type": "application/json", "Origin": REMOTE_ORIGIN},
            )
            try:
                with urllib.request.urlopen(request, timeout=90, context=ssl.create_default_context()) as response:
                    payload, status = response.read(), response.status
            except urllib.error.HTTPError as error:
                payload, status = error.read(), error.code
            except Exception as error:
                payload, status = json.dumps({"error": str(error)}).encode(), 502
            self.headers_for(status, len(payload))
            self.wfile.write(payload)

        do_GET = forward
        do_POST = forward

        def log_message(self, format_string, *values):
            print(f"[{self.server.server_port}] {format_string % values}", flush=True)

    return Handler


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--large-port", type=int, default=8768)
    parser.add_argument("--compact-port", type=int, default=8769)
    parser.add_argument("--tls-cert")
    parser.add_argument("--tls-key")
    args = parser.parse_args()
    servers = [
        ThreadingHTTPServer((args.host, args.large_port), handler("/review-model", "/recognize")),
        ThreadingHTTPServer((args.host, args.compact_port), handler("/v3-compact", "/v3/recognize")),
    ]
    if bool(args.tls_cert) != bool(args.tls_key):
        parser.error("--tls-cert and --tls-key must be supplied together")
    if args.tls_cert:
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(args.tls_cert, args.tls_key)
        for server in servers:
            server.socket = context.wrap_socket(server.socket, server_side=True)
    for server in servers:
        threading.Thread(target=server.serve_forever, daemon=True).start()
    scheme = "https" if args.tls_cert else "http"
    print(
        f"tailnet replay bridges listening on {scheme}://{args.host}:{args.large_port} "
        f"and :{args.compact_port}",
        flush=True,
    )
    threading.Event().wait()


if __name__ == "__main__":
    main()
