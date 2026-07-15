#!/usr/bin/env python3
"""Key-blind P08 row-crop experiment against the local whole-answer model.

This is a research-only evaluator. It never changes live OCR behavior. It
compares the already-frozen fresh answer zones with conservative ways of
removing the printed answer-box frame, then scores reads against separately
stored handwritten truth (never the mathematical answer key).
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
ROWS = ROOT / "private-evidence/reports/v3-p08-row-fresh-zone-both-models/rows.json"
ZONES = ROOT / "private-evidence/reports/v3-p08-row-fresh-zone-both-models/debug"
TRUTH = ROOT / "private-evidence/hybrid-v2-prospective/handwritten-truth-development.json"
DEFAULT_OUT = ROOT / "private-evidence/reports/v3-p08-row-crop-variant-audit.json"


def data_url(image: Image.Image) -> str:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")


def strongest(values: np.ndarray, lo: int, hi: int) -> int | None:
    if hi <= lo:
        return None
    relative = int(np.argmax(values[lo:hi]))
    return lo + relative


def frame_lines(image: Image.Image) -> dict[str, int | None]:
    gray = np.asarray(image.convert("L"))
    height, width = gray.shape
    # Printed frames are much darker and much straighter than pencil strokes.
    ink = gray < 105
    rows = ink.sum(axis=1)
    cols = ink.sum(axis=0)
    top = strongest(rows, 0, max(1, int(height * .28)))
    bottom = strongest(rows, min(height - 1, int(height * .72)), height)
    left = strongest(cols, 0, max(1, int(width * .22)))
    right = strongest(cols, min(width - 1, int(width * .78)), width)
    center = strongest(cols, int(width * .38), max(int(width * .38) + 1, int(width * .62)))

    def valid(index: int | None, projection: np.ndarray, minimum: float) -> int | None:
        return index if index is not None and projection[index] >= minimum else None

    return {
        "top": valid(top, rows, width * .38),
        "bottom": valid(bottom, rows, width * .38),
        "left": valid(left, cols, height * .38),
        "right": valid(right, cols, height * .38),
        "center": valid(center, cols, height * .20),
    }


def erase_lines(image: Image.Image, radius: int, center: bool) -> Image.Image:
    result = image.convert("RGB").copy()
    draw = ImageDraw.Draw(result)
    width, height = result.size
    lines = frame_lines(result)
    for name in ("top", "bottom"):
        y = lines[name]
        if y is not None:
            draw.rectangle((0, max(0, y - radius), width, min(height, y + radius)), fill="white")
    for name in ("left", "right"):
        x = lines[name]
        if x is not None:
            draw.rectangle((max(0, x - radius), 0, min(width, x + radius), height), fill="white")
    if center and lines["center"] is not None:
        x = int(lines["center"])
        draw.rectangle((max(0, x - radius), 0, min(width, x + radius), int(height * .32)), fill="white")
        draw.rectangle((max(0, x - radius), int(height * .68), min(width, x + radius), height), fill="white")
    return result


def crop_inside_frame(image: Image.Image, padding: int) -> Image.Image:
    lines = frame_lines(image)
    width, height = image.size
    left = (lines["left"] + padding) if lines["left"] is not None else 0
    right = (lines["right"] - padding) if lines["right"] is not None else width
    top = (lines["top"] + padding) if lines["top"] is not None else 0
    bottom = (lines["bottom"] - padding) if lines["bottom"] is not None else height
    if right - left < width * .45 or bottom - top < height * .45:
        return image.copy()
    return image.crop((left, top, right, bottom))


def best_slanted_line(
    ink: np.ndarray,
    orientation: str,
    intercept_low: int,
    intercept_high: int,
    position_low: int,
    position_high: int,
) -> tuple[float, float, float] | None:
    height, width = ink.shape
    length = width if orientation == "horizontal" else height
    positions = np.arange(position_low, position_high)
    if not len(positions):
        return None
    best = None
    for slope in np.linspace(-.16, .16, 65):
        for intercept in range(intercept_low, intercept_high + 1):
            other = np.rint(slope * positions + intercept).astype(int)
            if orientation == "horizontal":
                valid = (other >= 0) & (other < height)
                score = float(ink[other[valid], positions[valid]].mean()) if valid.any() else 0
            else:
                valid = (other >= 0) & (other < width)
                score = float(ink[positions[valid], other[valid]].mean()) if valid.any() else 0
            if best is None or score > best[2]:
                best = (float(slope), float(intercept), score)
    return best if best and best[2] >= .42 else None


def hough_frame_lines(image: Image.Image) -> dict[str, tuple[float, float, float] | None]:
    gray = np.asarray(image.convert("L"))
    height, width = gray.shape
    ink = gray < 105
    return {
        "top": best_slanted_line(ink, "horizontal", 0, int(height * .28), 0, width),
        "bottom": best_slanted_line(ink, "horizontal", int(height * .70), height - 1, 0, width),
        "left": best_slanted_line(ink, "vertical", 0, int(width * .24), 0, height),
        "right": best_slanted_line(ink, "vertical", int(width * .76), width - 1, 0, height),
        "center_top": best_slanted_line(
            ink, "vertical", int(width * .36), int(width * .64), 0, int(height * .38)
        ),
        "center_bottom": best_slanted_line(
            ink, "vertical", int(width * .36), int(width * .64), int(height * .62), height
        ),
    }


def erase_hough_lines(image: Image.Image, radius: int, center: bool) -> Image.Image:
    result = image.convert("RGB").copy()
    draw = ImageDraw.Draw(result)
    width, height = result.size
    lines = hough_frame_lines(result)
    for name in ("top", "bottom"):
        line = lines[name]
        if line:
            slope, intercept, _ = line
            draw.line((0, intercept, width - 1, slope * (width - 1) + intercept), fill="white", width=radius * 2 + 1)
    for name in ("left", "right"):
        line = lines[name]
        if line:
            slope, intercept, _ = line
            draw.line((intercept, 0, slope * (height - 1) + intercept, height - 1), fill="white", width=radius * 2 + 1)
    if center:
        for name, y0, y1 in (
            ("center_top", 0, int(height * .38)),
            ("center_bottom", int(height * .62), height - 1),
        ):
            line = lines[name]
            if line:
                slope, intercept, _ = line
                draw.line((slope * y0 + intercept, y0, slope * y1 + intercept, y1), fill="white", width=radius * 2 + 1)
    return result


def recognize(url: str, origin: str, items: list[dict]) -> list[dict]:
    output: list[dict] = []
    for start in range(0, len(items), 24):
        batch = items[start:start + 24]
        request = urllib.request.Request(
            url.rstrip("/") + "/recognize",
            data=json.dumps({"items": batch}).encode("utf-8"),
            headers={"Content-Type": "application/json", "Origin": origin},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=120) as response:
            payload = json.load(response)
        if payload.get("answerKeyUsed") is not False:
            raise RuntimeError("Recognizer did not confirm key-blind inference")
        output.extend(payload["results"])
    return output


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8766")
    parser.add_argument("--origin", default="https://localhost:5174")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--images-out", type=Path)
    args = parser.parse_args()

    rows = json.loads(ROWS.read_text())
    truth_doc = json.loads(TRUTH.read_text())
    truth = {
        (row["layoutId"], int(row["questionNum"])): row["handwrittenTruth"]
        for row in truth_doc["labels"]
        if row.get("packetId") == "P08" and row.get("truthState") == "value"
    }
    capture_by_layout = {row["layoutId"]: row["id"].removesuffix("-captured") for row in rows}
    variants = {
        "original": lambda image: image.copy(),
        "erase_outer_r1": lambda image: erase_lines(image, 1, False),
        "erase_outer_r2": lambda image: erase_lines(image, 2, False),
        "erase_all_r1": lambda image: erase_lines(image, 1, True),
        "erase_all_r2": lambda image: erase_lines(image, 2, True),
        "crop_inside_p1": lambda image: crop_inside_frame(image, 1),
        "crop_inside_p3": lambda image: crop_inside_frame(image, 3),
        "hough_outer_r1": lambda image: erase_hough_lines(image, 1, False),
        "hough_outer_r2": lambda image: erase_hough_lines(image, 2, False),
        "hough_all_r1": lambda image: erase_hough_lines(image, 1, True),
    }

    items = []
    metadata = {}
    for layout_id, capture_id in capture_by_layout.items():
        for question_num in range(1, 9):
            source = ZONES / f"{capture_id}-captured" / f"v3-zone-q{question_num}.png"
            image = Image.open(source).convert("RGB")
            for variant, transform in variants.items():
                transformed = transform(image)
                item_id = f"{layout_id}|q{question_num}|{variant}"
                items.append({
                    "id": item_id,
                    "questionNum": question_num,
                    "imageDataUrl": data_url(transformed),
                })
                metadata[item_id] = {
                    "layoutId": layout_id,
                    "questionNum": question_num,
                    "variant": variant,
                    "truth": truth[(layout_id, question_num)],
                    "source": str(source.relative_to(ROOT)),
                    "frameLines": frame_lines(image),
                }
                if args.images_out:
                    destination = args.images_out / variant / capture_id / source.name
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    transformed.save(destination)

    reads = recognize(args.url, args.origin, items)
    result_rows = []
    for read in reads:
        row = {**metadata[read["id"]], **read}
        row["correct"] = str(row.get("read") or "") == row["truth"]
        result_rows.append(row)

    summary = {}
    for variant in variants:
        subset = [row for row in result_rows if row["variant"] == variant]
        summary[variant] = {
            "correct": sum(bool(row["correct"]) for row in subset),
            "total": len(subset),
            "meanMinTokenProbability": round(
                sum(float(row.get("minTokenProbability") or 0) for row in subset) / len(subset), 6
            ),
            "errors": [
                {
                    "layoutId": row["layoutId"],
                    "questionNum": row["questionNum"],
                    "truth": row["truth"],
                    "read": row.get("read"),
                    "minTokenProbability": row.get("minTokenProbability"),
                }
                for row in subset if not row["correct"]
            ],
        }

    report = {
        "schemaVersion": 1,
        "purpose": "Research-only row answer-crop fidelity audit; no live behavior changed.",
        "answerKeyUsed": False,
        "truthSource": str(TRUTH.relative_to(ROOT)),
        "truthQaStatus": "primary-labelled; independent verification pending",
        "recognizerUrl": args.url,
        "summary": summary,
        "rows": result_rows,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
