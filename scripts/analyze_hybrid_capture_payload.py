#!/usr/bin/env python3
"""Estimate Hybrid V2 evidence payload size from private saved captures."""

import argparse
import io
import json
import statistics
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, UnidentifiedImageError


def percentile(values, fraction):
    ordered = sorted(values)
    return ordered[round((len(ordered) - 1) * fraction)]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("private-evidence/debug-scans"))
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()

    rows = []
    invalid = 0
    placeholders = 0
    for path in args.root.rglob("captured.png"):
        try:
            image = Image.open(path).convert("RGB")
        except (UnidentifiedImageError, OSError):
            invalid += 1
            continue
        if image.width < 100 or image.height < 100:
            placeholders += 1
            continue
        encoded = io.BytesIO()
        image.save(encoded, format="JPEG", quality=92)
        rows.append({
            "width": image.width,
            "height": image.height,
            "pngBytes": path.stat().st_size,
            "jpeg92Bytes": len(encoded.getvalue()),
            "canvasRgbaBytes": image.width * image.height * 4,
        })

    if not rows:
        raise SystemExit("No readable non-placeholder captures found")

    jpeg = [row["jpeg92Bytes"] for row in rows]
    canvas = [row["canvasRgbaBytes"] for row in rows]
    report = {
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "sourceRoot": str(args.root),
        "method": "Re-encode saved selected PNG captures as RGB JPEG quality 92; excludes images under 100 px",
        "limitations": [
            "Saved selected captures are proxies, not the new burst frames.",
            "Browser canvas/GPU overhead and JavaScript string representation are not measured.",
            "Encoding time and peak memory must be measured on target devices during prospective capture.",
        ],
        "captureCount": len(rows),
        "invalidCount": invalid,
        "placeholderCount": placeholders,
        "dimensions": {
            "widthMin": min(row["width"] for row in rows),
            "widthMax": max(row["width"] for row in rows),
            "heightMin": min(row["height"] for row in rows),
            "heightMax": max(row["height"] for row in rows),
        },
        "jpeg92Bytes": {
            "median": round(statistics.median(jpeg)),
            "p90": percentile(jpeg, 0.9),
            "max": max(jpeg),
        },
        "threeFrameBase64EstimatedBytes": {
            "median": round(statistics.median(jpeg) * 4),
            "p90": percentile(jpeg, 0.9) * 4,
        },
        "threeCanvasRgbaEstimatedBytes": {
            "median": round(statistics.median(canvas) * 3),
            "p90": percentile(canvas, 0.9) * 3,
        },
    }

    output = json.dumps(report, indent=2) + "\n"
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(output)
    print(output, end="")


if __name__ == "__main__":
    main()
