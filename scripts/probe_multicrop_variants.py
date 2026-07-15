#!/usr/bin/env python3
"""Key-blind spatial-stability probe for one continuous answer crop."""

import argparse
import base64
import io
import json
import urllib.request
from pathlib import Path

from PIL import Image, ImageOps


def args():
    parser = argparse.ArgumentParser()
    parser.add_argument("image", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--large-url", default="http://127.0.0.1:8768/recognize")
    parser.add_argument("--compact-url", default="http://127.0.0.1:8769/v3/recognize")
    return parser.parse_args()


def encode(image):
    buffer = io.BytesIO()
    image.save(buffer, "PNG")
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode()


def variants(image):
    image = image.convert("RGB")
    width, height = image.size
    result = [("original", image)]
    for fraction in (0.02, 0.04, 0.07):
        dx, dy = max(1, round(width * fraction)), max(1, round(height * fraction))
        result.append((f"trim-{fraction:.2f}", image.crop((dx, dy, width - dx, height - dy))))
        result.append((f"pad-{fraction:.2f}", ImageOps.expand(image, border=(dx, dy), fill="white")))
    dx, dy = max(1, round(width * 0.04)), max(1, round(height * 0.04))
    result.extend([
        ("shift-left", image.crop((0, dy, width - 2 * dx, height - dy))),
        ("shift-right", image.crop((2 * dx, dy, width, height - dy))),
        ("shift-up", image.crop((dx, 0, width - dx, height - 2 * dy))),
        ("shift-down", image.crop((dx, 2 * dy, width - dx, height))),
    ])
    return result


def post(url, payload):
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        return json.loads(response.read())


def main():
    options = args()
    prepared = variants(Image.open(options.image))
    large = post(options.large_url, {"items": [
        {"id": name, "questionNum": 1, "imageDataUrl": encode(image)} for name, image in prepared
    ]})
    compact = post(options.compact_url, {"items": [
        {"id": name, "questionNum": 1, "continuousImageDataUrl": encode(image)} for name, image in prepared
    ]})
    large_by_id = {row["id"]: row for row in large.get("results", [])}
    compact_by_id = {row["id"]: row for row in compact.get("results", [])}
    rows = []
    for name, image in prepared:
        rows.append({
            "variant": name,
            "width": image.width,
            "height": image.height,
            "large": large_by_id.get(name),
            "compact": compact_by_id.get(name),
        })
    result = {
        "schemaVersion": 1,
        "image": str(options.image),
        "answerKeyProvidedToModels": False,
        "variantCount": len(rows),
        "largeDistinctReads": sorted({row["large"].get("read") for row in rows if row["large"]}),
        "compactDistinctReads": sorted({row["compact"].get("read") for row in rows if row["compact"]}),
        "rows": rows,
    }
    options.out.parent.mkdir(parents=True, exist_ok=True)
    options.out.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
