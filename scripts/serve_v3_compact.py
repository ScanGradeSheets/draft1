#!/usr/bin/env python3
"""Key-blind ONNX service for the compact V3 continuous-answer model."""

import base64
import io
import json
import os
import ssl
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

import numpy as np
import onnxruntime as ort
from PIL import Image

HEIGHT, WIDTH = 64, 192
FORBIDDEN = {"answerkey", "answer_key", "expected", "expectedanswer", "mathematicalanswer", "canonicaldigits"}


def contains_key_leak(value):
    if isinstance(value, dict):
        return any(str(key).replace("-", "").replace("_", "").lower() in FORBIDDEN or contains_key_leak(item) for key, item in value.items())
    if isinstance(value, list):
        return any(contains_key_leak(item) for item in value)
    return False


def decode_image(data_url):
    encoded = data_url.split(",", 1)[1] if "," in data_url else data_url
    raw = base64.b64decode(encoded, validate=True)
    if len(raw) > 3_000_000:
        raise ValueError("image exceeds 3 MB")
    image = Image.open(io.BytesIO(raw)).convert("L")
    scale = min(WIDTH / image.width, HEIGHT / image.height)
    resized = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), Image.Resampling.BILINEAR)
    canvas = Image.new("L", (WIDTH, HEIGHT), 255)
    canvas.paste(resized, ((WIDTH - resized.width) // 2, (HEIGHT - resized.height) // 2))
    values = 1.0 - np.asarray(canvas, dtype=np.float32) / 255.0
    return values[None, None, :, :]


def softmax(values):
    values = values - np.max(values, axis=-1, keepdims=True)
    exp = np.exp(values)
    return exp / exp.sum(axis=-1, keepdims=True)


class Recognizer:
    def __init__(self, model_path):
        self.path = model_path
        self.session = ort.InferenceSession(model_path, providers=["CPUExecutionProvider"])
        self.input_name = self.session.get_inputs()[0].name
        self.lock = threading.Lock()

    def run(self, items):
        batch = np.concatenate([decode_image(item["continuousImageDataUrl"]) for item in items], axis=0)
        with self.lock:
            length_logits, tens_logits, ones_logits = self.session.run(None, {self.input_name: batch})
        length_probs, tens_probs, ones_probs = map(softmax, (length_logits, tens_logits, ones_logits))
        results = []
        for index, item in enumerate(items):
            length = int(length_probs[index].argmax()) + 1
            ones = int(ones_probs[index].argmax())
            probabilities = [float(length_probs[index, length - 1]), float(ones_probs[index, ones])]
            if length == 2:
                tens = int(tens_probs[index].argmax())
                read = f"{tens}{ones}"
                probabilities.append(float(tens_probs[index, tens]))
            else:
                read = str(ones)
            candidates = []
            for digit in range(10):
                components = [float(length_probs[index, 0]), float(ones_probs[index, digit])]
                candidates.append({
                    "read": str(digit),
                    "jointProbability": components[0] * components[1],
                    "minComponentProbability": min(components),
                })
            for left in range(10):
                for right in range(10):
                    components = [
                        float(length_probs[index, 1]),
                        float(tens_probs[index, left]),
                        float(ones_probs[index, right]),
                    ]
                    candidates.append({
                        "read": f"{left}{right}",
                        "jointProbability": components[0] * components[1] * components[2],
                        "minComponentProbability": min(components),
                    })
            candidates.sort(key=lambda row: (row["jointProbability"], row["minComponentProbability"]), reverse=True)
            results.append({
                "id": item.get("id"), "questionNum": item.get("questionNum"), "read": read,
                "frameIndex": item.get("frameIndex"),
                "meanComponentProbability": sum(probabilities) / len(probabilities),
                "minComponentProbability": min(probabilities),
                "topCandidates": [{
                    **candidate,
                    "jointProbability": round(candidate["jointProbability"], 8),
                    "minComponentProbability": round(candidate["minComponentProbability"], 6),
                } for candidate in candidates[:5]],
                "model": "scangrade-v3-compact-continuous", "keyBlind": True,
            })
        return results


MODEL = os.environ.get("SCANGRADE_V3_COMPACT_MODEL", "private-evidence/models/v3-sequence-live/model.onnx")
RECOGNIZER = Recognizer(MODEL)
ALLOWED = {item.strip() for item in os.environ.get("SCANGRADE_V3_ALLOWED_ORIGINS", "").split(",") if item.strip()}
TOKEN = os.environ.get("SCANGRADE_V3_TOKEN", "")


class Handler(BaseHTTPRequestHandler):
    def origin_allowed(self):
        origin = self.headers.get("Origin", "")
        return not origin or not ALLOWED or origin in ALLOWED

    def authorized(self):
        return not TOKEN or self.headers.get("Authorization", "") == f"Bearer {TOKEN}"

    def cors(self):
        origin = self.headers.get("Origin", "")
        if origin and (not ALLOWED or origin in ALLOWED):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")

    def response(self, status, payload):
        data = json.dumps(payload).encode()
        self.send_response(status)
        self.cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        if not self.origin_allowed():
            return self.response(403, {"ok": False, "error": "origin not allowed"})
        self.send_response(204)
        self.cors()
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.end_headers()

    def do_GET(self):
        if urlsplit(self.path).path == "/health":
            self.response(200, {"ok": True, "model": "scangrade-v3-compact-continuous", "modelPath": MODEL})
        else:
            self.response(404, {"ok": False, "error": "not found"})

    def do_POST(self):
        if urlsplit(self.path).path != "/v3/recognize":
            return self.response(404, {"ok": False, "error": "not found"})
        if not self.origin_allowed():
            return self.response(403, {"ok": False, "error": "origin not allowed"})
        if not self.authorized():
            return self.response(401, {"ok": False, "error": "unauthorized"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 30_000_000:
                return self.response(413, {"ok": False, "error": "invalid request size"})
            payload = json.loads(self.rfile.read(length))
            if contains_key_leak(payload):
                return self.response(400, {"ok": False, "error": "answer-key fields are forbidden"})
            items = payload.get("items", [])
            if not isinstance(items, list) or not 1 <= len(items) <= 64:
                return self.response(400, {"ok": False, "error": "items must contain 1-64 answers"})
            if any(not item.get("continuousImageDataUrl") for item in items):
                return self.response(400, {"ok": False, "error": "continuousImageDataUrl is required"})
            self.response(200, {"ok": True, "results": RECOGNIZER.run(items)})
        except Exception as error:
            self.response(500, {"ok": False, "error": str(error)})

    def log_message(self, format, *args):
        print(f"[v3-compact] {self.address_string()} {format % args}")


if __name__ == "__main__":
    host = os.environ.get("SCANGRADE_V3_HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", os.environ.get("SCANGRADE_V3_PORT", "8767")))
    server = ThreadingHTTPServer((host, port), Handler)
    tls_cert = os.environ.get("SCANGRADE_V3_TLS_CERT", "")
    tls_key = os.environ.get("SCANGRADE_V3_TLS_KEY", tls_cert)
    protocol = "http"
    if tls_cert:
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(tls_cert, tls_key)
        server.socket = context.wrap_socket(server.socket, server_side=True)
        protocol = "https"
    print(f"V3 compact recognizer listening on {protocol}://{host}:{port}; model={MODEL}")
    server.serve_forever()
