#!/usr/bin/env python3
"""Serve the key-blind ScanGrade whole-answer recognizer.

This service is optional: clients must keep the existing OCR result when it is
offline or times out. It never accepts or receives the mathematical answer key.
"""

import argparse
import base64
import io
import json
import os
import re
import ssl
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

import torch
from PIL import Image
from peft import PeftModel
from transformers import TrOCRProcessor, VisionEncoderDecoderModel


DEFAULT_ADAPTER = Path(os.environ.get(
    "SCANGRADE_REVIEW_ADAPTER",
    "private-evidence/models/trocr-lora-calibrated-2epoch-20260709",
))


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8766")))
    parser.add_argument("--base-model", default=os.environ.get(
        "SCANGRADE_REVIEW_BASE_MODEL",
        "microsoft/trocr-base-handwritten",
    ))
    parser.add_argument("--adapter", type=Path, default=DEFAULT_ADAPTER)
    parser.add_argument("--device", choices=("auto", "cpu", "mps"), default="auto")
    parser.add_argument("--max-items", type=int, default=32)
    compression = parser.add_mutually_exclusive_group()
    compression.add_argument(
        "--dynamic-int8",
        action="store_true",
        help="Experimental CPU-only dynamic int8 quantization after merging the private adapter.",
    )
    compression.add_argument("--float16", action="store_true", help="Experimental CPU float16 weights and inputs.")
    compression.add_argument("--bfloat16", action="store_true", help="Experimental CPU bfloat16 weights and inputs.")
    parser.add_argument(
        "--offline",
        action="store_true",
        default=os.environ.get("SCANGRADE_REVIEW_OFFLINE", "").lower() in {"1", "true", "yes"},
        help="Use only already-cached base-model files; never contact the model registry",
    )
    return parser.parse_args()


def normalize(value):
    return "".join(re.findall(r"\d", str(value or "")))


def choose_device(requested):
    if requested != "auto":
        return requested
    return "mps" if torch.backends.mps.is_available() else "cpu"


def decode_image(data_url):
    if not isinstance(data_url, str) or not data_url:
        raise ValueError("imageDataUrl is required")
    encoded = data_url.split(",", 1)[1] if "," in data_url else data_url
    raw = base64.b64decode(encoded, validate=True)
    if len(raw) > 3_000_000:
        raise ValueError("image exceeds 3 MB")
    return Image.open(io.BytesIO(raw)).convert("RGB")


def visible_token_probabilities(tokenizer, token_ids, probabilities):
    """Return confidence only for tokens that contribute visible answer text.

    Generation also emits control tokens such as EOS. Their probability says
    how certain the decoder is that the answer has ended; it is not evidence
    about which handwritten digits were read and must not lower digit confidence.
    """
    special_ids = set(tokenizer.all_special_ids)
    visible = []
    for token_id, probability in zip(token_ids, probabilities):
        if int(token_id) in special_ids:
            continue
        if not normalize(tokenizer.decode([int(token_id)], skip_special_tokens=True)):
            continue
        visible.append(float(probability))
    return visible


class Recognizer:
    def __init__(self, base_model, adapter, device, offline=False, dynamic_int8=False, float16=False, bfloat16=False):
        started = time.time()
        self.device = device
        self.offline = offline
        self.processor = TrOCRProcessor.from_pretrained(
            base_model,
            local_files_only=offline,
            use_fast=False,
        )
        base = VisionEncoderDecoderModel.from_pretrained(base_model, local_files_only=offline)
        adapted = PeftModel.from_pretrained(base, str(adapter)).to(device)
        self.quantization = "none"
        self.input_dtype = torch.float32
        if dynamic_int8:
            if device != "cpu":
                raise ValueError("dynamic int8 quantization requires --device cpu")
            if not torch.backends.quantized.supported_engines:
                raise RuntimeError("this PyTorch runtime has no quantized CPU engine")
            if torch.backends.quantized.engine == "none":
                torch.backends.quantized.engine = torch.backends.quantized.supported_engines[0]
            merged = adapted.merge_and_unload()
            self.model = torch.ao.quantization.quantize_dynamic(
                merged,
                {torch.nn.Linear},
                dtype=torch.qint8,
            )
            self.quantization = "dynamic-int8-linear"
        elif float16:
            self.model = adapted.to(dtype=torch.float16)
            self.input_dtype = torch.float16
            self.quantization = "float16"
        elif bfloat16:
            self.model = adapted.to(dtype=torch.bfloat16)
            self.input_dtype = torch.bfloat16
            self.quantization = "bfloat16"
        else:
            self.model = adapted
        self.model.eval()
        self.load_seconds = round(time.time() - started, 2)
        self.base_model = base_model
        self.adapter = str(adapter)
        self.lock = threading.Lock()

    def recognize(self, items):
        images = [decode_image(item.get("imageDataUrl")) for item in items]
        pixels = self.processor(images=images, return_tensors="pt").pixel_values.to(
            device=self.device,
            dtype=self.input_dtype,
        )
        started = time.time()
        with self.lock, torch.inference_mode():
            generated = self.model.generate(
                pixels,
                max_new_tokens=8,
                num_beams=1,
                return_dict_in_generate=True,
                output_scores=True,
            )
        raw_reads = self.processor.batch_decode(generated.sequences, skip_special_tokens=True)
        step_probabilities = []
        for step, scores in enumerate(generated.scores):
            chosen = generated.sequences[:, step + 1]
            step_probabilities.append(
                torch.softmax(scores.float(), dim=-1).gather(1, chosen[:, None]).squeeze(1).cpu()
            )
        matrix = torch.stack(step_probabilities, dim=1) if step_probabilities else torch.empty((len(items), 0))
        results = []
        for index, (item, raw) in enumerate(zip(items, raw_reads)):
            generation_probabilities = matrix[index].tolist()
            emitted_token_ids = generated.sequences[index, 1:1 + len(generation_probabilities)].tolist()
            probabilities = visible_token_probabilities(
                self.processor.tokenizer,
                emitted_token_ids,
                generation_probabilities,
            )
            results.append({
                "id": item.get("id"),
                "questionNum": item.get("questionNum"),
                "frameIndex": item.get("frameIndex"),
                "read": normalize(raw),
                "rawRead": raw,
                "meanTokenProbability": round(sum(probabilities) / len(probabilities), 6) if probabilities else 0,
                "minTokenProbability": round(min(probabilities), 6) if probabilities else 0,
                "confidenceTokenCount": len(probabilities),
                "generationMinProbability": round(min(generation_probabilities), 6) if generation_probabilities else 0,
                "confidenceScope": "visible-answer-tokens-only",
            })
        return results, round(1000 * (time.time() - started), 1)


def handler_for(recognizer, token, max_items, allowed_origins):
    route_prefix = os.environ.get("SCANGRADE_REVIEW_ROUTE_PREFIX", "").strip()
    if route_prefix and not route_prefix.startswith("/"):
        route_prefix = f"/{route_prefix}"
    route_prefix = route_prefix.rstrip("/")

    class Handler(BaseHTTPRequestHandler):
        server_version = "ScanGradeReview/0.1"

        def _path(self):
            path = urlsplit(self.path).path
            if route_prefix and path.startswith(f"{route_prefix}/"):
                return path[len(route_prefix):]
            if route_prefix and path == route_prefix:
                return "/"
            return path

        def _headers(self, status=200):
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            request_origin = self.headers.get("Origin", "")
            if not allowed_origins:
                self.send_header("Access-Control-Allow-Origin", "*")
            elif request_origin in allowed_origins:
                self.send_header("Access-Control-Allow-Origin", request_origin)
                self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.end_headers()

        def _json(self, value, status=200):
            self._headers(status)
            self.wfile.write(json.dumps(value).encode("utf-8"))

        def do_OPTIONS(self):
            request_origin = self.headers.get("Origin", "")
            if allowed_origins and request_origin not in allowed_origins:
                self._json({"error": "origin not allowed"}, 403)
                return
            self._headers(204)

        def do_GET(self):
            if self._path() != "/health":
                self._json({"error": "not found"}, 404)
                return
            self._json({
                "ok": True,
                "device": recognizer.device,
                "loadSeconds": recognizer.load_seconds,
                "baseModel": recognizer.base_model,
                "adapterLoaded": True,
                "offline": recognizer.offline,
                "quantization": recognizer.quantization,
                "answerKeyAccepted": False,
            })

        def do_POST(self):
            if self._path() != "/recognize":
                self._json({"error": "not found"}, 404)
                return
            authorization_valid = bool(token) and self.headers.get("Authorization") == f"Bearer {token}"
            request_origin = self.headers.get("Origin", "")
            if allowed_origins and request_origin not in allowed_origins and not authorization_valid:
                self._json({"error": "origin not allowed"}, 403)
                return
            if token and not authorization_valid:
                self._json({"error": "unauthorized"}, 401)
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if length <= 0 or length > 20_000_000:
                    raise ValueError("invalid request size")
                payload = json.loads(self.rfile.read(length))
                if "answerKey" in payload or "expected" in payload:
                    raise ValueError("answer-key fields are not accepted")
                items = payload.get("items")
                if not isinstance(items, list) or not 1 <= len(items) <= max_items:
                    raise ValueError(f"items must contain 1-{max_items} images")
                results, inference_ms = recognizer.recognize(items)
                self._json({"results": results, "inferenceMs": inference_ms, "answerKeyUsed": False})
            except (ValueError, json.JSONDecodeError, base64.binascii.Error) as error:
                self._json({"error": str(error)}, 400)
            except Exception as error:
                self._json({"error": f"recognition failed: {error}"}, 500)

        def log_message(self, format_string, *values):
            print(f"{self.address_string()} - {format_string % values}", flush=True)

    return Handler


def main():
    opts = parse_args()
    token = os.environ.get("SCANGRADE_REVIEW_TOKEN", "")
    allowed_origins = {
        value.strip()
        for value in os.environ.get("SCANGRADE_REVIEW_ALLOWED_ORIGINS", "").split(",")
        if value.strip()
    }
    recognizer = Recognizer(
        opts.base_model,
        opts.adapter,
        choose_device(opts.device),
        opts.offline,
        dynamic_int8=opts.dynamic_int8,
        float16=opts.float16,
        bfloat16=opts.bfloat16,
    )
    server = ThreadingHTTPServer(
        (opts.host, opts.port),
        handler_for(recognizer, token, opts.max_items, allowed_origins),
    )
    tls_cert = os.environ.get("SCANGRADE_REVIEW_TLS_CERT", "")
    tls_key = os.environ.get("SCANGRADE_REVIEW_TLS_KEY", tls_cert)
    protocol = "http"
    if tls_cert:
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(tls_cert, tls_key)
        server.socket = context.wrap_socket(server.socket, server_side=True)
        protocol = "https"
    print(json.dumps({
        "listening": f"{protocol}://{opts.host}:{opts.port}",
        "device": recognizer.device,
        "loadSeconds": recognizer.load_seconds,
        "tokenRequired": bool(token),
        "allowedOriginCount": len(allowed_origins),
        "offline": recognizer.offline,
        "quantization": recognizer.quantization,
        "answerKeyAccepted": False,
    }), flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
