#!/usr/bin/env python3
"""Build key-blind V3 question crops directly from saved canonical warped pages."""

import argparse
import hashlib
import json
from pathlib import Path
from statistics import mean, pstdev

import numpy as np
from PIL import Image, ImageDraw, ImageStat

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_TRUTH = ROOT / "private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json"
DEFAULT_OUT = ROOT / "private-evidence/v3/continuous-answer-zones"


def args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--truth", type=Path, default=DEFAULT_TRUTH)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--overwrite", action="store_true")
    return parser.parse_args()


def split_for(entry):
    page = int(entry.get("pageIndex", -1))
    if page >= 70:
        return "holdout"
    if page >= 50:
        return "validation"
    return "development"


def box_rect(box, layout, width, height):
    if layout.get("page", {}).get("units") == "normalized":
        return ((box["x"] - box["width"]) * width, (box["y"] - box["height"]) * height,
                box["width"] * width, box["height"] * height)
    sx = width / layout["page"]["width_mm"]
    sy = height / layout["page"]["height_mm"]
    w, h = box["width"] * sx, box["height"] * sy
    return box["cx"] * sx - w / 2, box["cy"] * sy - h / 2, w, h


def zone_rect(group, layout, width, height):
    by_id = {box["id"]: box for box in layout.get("boxes", [])}
    rects = [box_rect(by_id[item], layout, width, height) for item in group.get("digit_box_ids", []) if item in by_id]
    if not rects:
        return None
    x0 = min(rect[0] for rect in rects)
    y0 = min(rect[1] for rect in rects)
    x1 = max(rect[0] + rect[2] for rect in rects)
    y1 = max(rect[1] + rect[3] for rect in rects)
    margin = min(rect[3] for rect in rects) * 0.08
    return (max(0, int(x0 - margin)), max(0, int(y0 - margin)),
            min(width, int(x1 + margin + 0.999)), min(height, int(y1 + margin + 0.999)))


def recognition_view(image, group, layout, raw_rect):
    """Continuous derived view: suppress known frame ink without stitching slots."""
    by_id = {box["id"]: box for box in layout.get("boxes", [])}
    rects = [box_rect(by_id[item], layout, *image.size) for item in group.get("digit_box_ids", []) if item in by_id]
    x0 = min(rect[0] for rect in rects)
    y0 = min(rect[1] for rect in rects)
    x1 = max(rect[0] + rect[2] for rect in rects)
    y1 = max(rect[1] + rect[3] for rect in rects)
    slot_height = min(rect[3] for rect in rects)
    view = image.crop(raw_rect).convert("L")
    draw = ImageDraw.Draw(view)
    left, top = raw_rect[0], raw_rect[1]
    thickness = max(3, round(slot_height * .026))
    values = np.asarray(view)
    dark = values < 145

    def strongest_row(expected):
        start, end = max(0, expected - 16), min(view.height, expected + 17)
        return max(range(start, end), key=lambda row: float(dark[row, :].mean())) if end > start else expected

    def strongest_col(expected):
        start, end = max(0, expected - 16), min(view.width, expected + 17)
        return max(range(start, end), key=lambda col: float(dark[:, col].mean())) if end > start else expected

    # Remove the known outer printed frame while retaining the surrounding
    # pixels in which a child's stroke may extend beyond that frame.
    local_x0 = strongest_col(round(x0 - left))
    local_x1 = strongest_col(round(x1 - left))
    local_y0 = strongest_row(round(y0 - top))
    local_y1 = strongest_row(round(y1 - top))
    draw.rectangle((local_x0 - thickness, local_y0 - thickness, local_x1 + thickness, local_y0 + thickness), fill=255)
    draw.rectangle((local_x0 - thickness, local_y1 - thickness, local_x1 + thickness, local_y1 + thickness), fill=255)
    draw.rectangle((local_x0 - thickness, local_y0 - thickness, local_x0 + thickness, local_y1 + thickness), fill=255)
    draw.rectangle((local_x1 - thickness, local_y0 - thickness, local_x1 + thickness, local_y1 + thickness), fill=255)
    # Open dividers are printed near the top and bottom. Remove only those
    # narrow known bands; preserve the central handwriting area and the raw crop.
    boundaries = sorted({strongest_col(round(rect[0] + rect[2] - left)) for rect in rects[:-1]})
    segment = round((local_y1 - local_y0) * .30)
    for boundary in boundaries:
        draw.rectangle((boundary - thickness, local_y0, boundary + thickness, local_y0 + segment), fill=255)
        draw.rectangle((boundary - thickness, local_y1 - segment, boundary + thickness, local_y1), fill=255)
    return view, raw_rect


def quality(image):
    gray = image.convert("L")
    values = list(gray.get_flattened_data())
    ordered = sorted(values)
    q = lambda p: ordered[round((len(ordered) - 1) * p)]
    width, height = gray.size
    edge = []
    pixels = gray.load()
    for y in range(height):
        for x in range(width):
            if x + 1 < width:
                edge.append(abs(pixels[x, y] - pixels[x + 1, y]))
            if y + 1 < height:
                edge.append(abs(pixels[x, y] - pixels[x, y + 1]))
    tile_means = []
    for ty in range(2):
        for tx in range(3):
            tile = gray.crop((tx * width // 3, ty * height // 2, (tx + 1) * width // 3, (ty + 1) * height // 2))
            tile_means.append(ImageStat.Stat(tile).mean[0])
    p05, p50, p95 = q(.05), q(.50), q(.95)
    threshold = p95 - max(12, (p95 - p05) * .22)
    return {
        "width": width, "height": height, "mean": round(mean(values), 3),
        "standardDeviation": round(pstdev(values), 3), "p05": p05, "p50": p50, "p95": p95,
        "contrastRange": p95 - p05,
        "darkClipFraction": sum(value <= 8 for value in values) / len(values),
        "lightClipFraction": sum(value >= 247 for value in values) / len(values),
        "estimatedInkFraction": sum(value < threshold for value in values) / len(values),
        "meanEdgeMagnitude": mean(edge) if edge else 0,
        "illuminationRange": max(tile_means) - min(tile_means),
    }


def main():
    opts = args()
    source = json.loads(opts.truth.read_text())
    entries = source.get("entries", [])
    opts.out.mkdir(parents=True, exist_ok=True)
    rows = []
    layout_cache = {}
    page_cache = {}
    for entry in entries:
        if entry.get("truthStatus") in ("needs-label", "unclear"):
            continue
        layout_id = entry.get("layoutId")
        layout_path = ROOT / "layouts" / f"{layout_id}.json"
        if not layout_path.exists():
            continue
        layout = layout_cache.setdefault(layout_id, json.loads(layout_path.read_text()))
        debug_path = ROOT / entry["debugPath"] if not Path(entry["debugPath"]).is_absolute() else Path(entry["debugPath"])
        warped_path = debug_path.parent / "warped.png"
        if not warped_path.exists():
            continue
        image = page_cache.setdefault(str(warped_path), Image.open(warped_path).convert("RGB"))
        group = next((item for item in layout.get("question_groups", []) if int(item.get("question_num", -1)) == int(entry["questionNum"])), None)
        rect = zone_rect(group or {}, layout, *image.size)
        if not rect:
            continue
        crop = image.crop(rect).convert("L")
        normalized, normalized_rect = recognition_view(image, group, layout, rect)
        relative = Path(split_for(entry)) / entry["captureId"] / f"q{int(entry['questionNum']):02d}.png"
        destination = opts.out / relative
        normalized_destination = destination.with_name(destination.stem + "-recognition.png")
        destination.parent.mkdir(parents=True, exist_ok=True)
        if opts.overwrite or not destination.exists():
            crop.save(destination, format="PNG", optimize=True)
        if opts.overwrite or not normalized_destination.exists():
            normalized.save(normalized_destination, format="PNG", optimize=True)
        digest = hashlib.sha256(destination.read_bytes()).hexdigest()
        rows.append({
            "schemaVersion": 1,
            "uid": entry.get("uid"),
            "captureId": entry["captureId"],
            "pageIndex": entry.get("pageIndex"),
            "layoutId": layout_id,
            "questionNum": entry["questionNum"],
            "split": split_for(entry),
            "truth": str(entry.get("truth", "")),
            "truthStatus": entry.get("truthStatus"),
            "imagePath": str(destination.relative_to(ROOT)),
            "recognitionPath": str(normalized_destination.relative_to(ROOT)),
            "sourceWarpedPath": str(warped_path.relative_to(ROOT)),
            "source": "canonical-warp-continuous-grayscale",
            "rect": {"x": rect[0], "y": rect[1], "w": rect[2] - rect[0], "h": rect[3] - rect[1]},
            "recognitionRect": {"x": normalized_rect[0], "y": normalized_rect[1], "w": normalized_rect[2] - normalized_rect[0], "h": normalized_rect[3] - normalized_rect[1]},
            "sha256": digest,
            "quality": quality(crop),
        })
    hashes = {}
    for row in rows:
        hashes.setdefault(row["sha256"], []).append(row["uid"])
    manifest = {
        "schemaVersion": 1,
        "sourceTruth": str(opts.truth.relative_to(ROOT)),
        "keyBlindImageExtraction": True,
        "splitWarning": "Historical page-block R&D split only; no durable student/packet IDs exist. Prospective packet holdouts remain decisive.",
        "counts": {name: sum(row["split"] == name for row in rows) for name in ("development", "validation", "holdout")},
        "exactDuplicateGroups": [uids for uids in hashes.values() if len(uids) > 1],
        "entries": rows,
    }
    (opts.out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps({"manifest": str(opts.out / 'manifest.json'), "counts": manifest["counts"], "duplicates": len(manifest["exactDuplicateGroups"])}, indent=2))


if __name__ == "__main__":
    main()
