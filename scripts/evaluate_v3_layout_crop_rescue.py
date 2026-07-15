#!/usr/bin/env python3
"""Evaluate key-blind layout-anchored, multi-frame crops for the local whole-answer model.

This is an isolated review-choice experiment. It never receives an answer key and
does not change automatic grading. Handwritten truth is loaded only after model
inference to score whether a teacher-review candidate list contains the writing.
"""

from __future__ import annotations

import argparse
import json
import math
from collections import defaultdict
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageDraw

from evaluate_v3_local_candidates import ExistingWholeAnswerNet, prepare


ROOT = Path(__file__).resolve().parents[1]
HEIGHT, WIDTH = 64, 192


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=ROOT / "private-evidence/v3/four-packet-sequence-20260714/manifest.json")
    parser.add_argument("--model", type=Path, default=ROOT / "private-evidence/models/v3-sequence-live/model.pt")
    parser.add_argument("--out", type=Path, default=ROOT / "private-evidence/reports/v3-layout-crop-rescue-20260714.json")
    parser.add_argument("--crop-out", type=Path, default=ROOT / "private-evidence/reports/v3-layout-crop-rescue-20260714")
    return parser.parse_args()


def resolved(path: Path) -> Path:
    return path if path.is_absolute() else ROOT / path


def walk_debug():
    rows = []
    for date in ("2026-07-13", "2026-07-14"):
        root = ROOT / "private-evidence/debug-scans" / date
        for debug_path in root.rglob("debug.json"):
            try:
                wrapper = json.loads(debug_path.read_text())
            except (OSError, json.JSONDecodeError):
                continue
            debug = wrapper.get("debug", wrapper)
            warped = debug_path.parent / "warped.png"
            if warped.exists() and debug.get("scanSessionId") and debug.get("layoutId"):
                rows.append({"debugPath": debug_path, "warpedPath": warped, "debug": debug})
    return rows


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
    margin = min(rect[3] for rect in rects) * .08
    return (max(0, math.floor(x0 - margin)), max(0, math.floor(y0 - margin)),
            min(width, math.ceil(x1 + margin)), min(height, math.ceil(y1 + margin))), rects


def recognition_view(image, raw_rect, rects):
    """Erase only known printed frame bands, retaining extended pencil strokes."""
    view = image.crop(raw_rect).convert("L")
    values = np.asarray(view)
    dark = values < 145
    draw = ImageDraw.Draw(view)
    left, top = raw_rect[0], raw_rect[1]
    slot_height = min(rect[3] for rect in rects)
    thickness = max(3, round(slot_height * .026))
    x0 = min(rect[0] for rect in rects)
    y0 = min(rect[1] for rect in rects)
    x1 = max(rect[0] + rect[2] for rect in rects)
    y1 = max(rect[1] + rect[3] for rect in rects)

    def strongest_row(expected):
        start, end = max(0, expected - 16), min(view.height, expected + 17)
        return max(range(start, end), key=lambda row: float(dark[row, :].mean())) if end > start else expected

    def strongest_col(expected):
        start, end = max(0, expected - 16), min(view.width, expected + 17)
        return max(range(start, end), key=lambda col: float(dark[:, col].mean())) if end > start else expected

    local_x0 = strongest_col(round(x0 - left))
    local_x1 = strongest_col(round(x1 - left))
    local_y0 = strongest_row(round(y0 - top))
    local_y1 = strongest_row(round(y1 - top))
    draw.rectangle((local_x0 - thickness, local_y0 - thickness, local_x1 + thickness, local_y0 + thickness), fill=255)
    draw.rectangle((local_x0 - thickness, local_y1 - thickness, local_x1 + thickness, local_y1 + thickness), fill=255)
    draw.rectangle((local_x0 - thickness, local_y0 - thickness, local_x0 + thickness, local_y1 + thickness), fill=255)
    draw.rectangle((local_x1 - thickness, local_y0 - thickness, local_x1 + thickness, local_y1 + thickness), fill=255)
    segment = round((local_y1 - local_y0) * .30)
    for rect in rects[:-1]:
        boundary = strongest_col(round(rect[0] + rect[2] - left))
        draw.rectangle((boundary - thickness, local_y0, boundary + thickness, local_y0 + segment), fill=255)
        draw.rectangle((boundary - thickness, local_y1 - segment, boundary + thickness, local_y1), fill=255)
    return view


def ink_occupancy(image, slot_count):
    values = np.asarray(image.convert("L"), dtype=np.float32)
    p05, p95 = np.quantile(values, [.05, .95])
    threshold = p95 - max(18, (p95 - p05) * .28)
    h, w = values.shape
    # Avoid the printed outer frame and divider endpoints. The central vertical
    # band still retains digits that touch or cross the lower box line.
    y0, y1 = round(h * .14), round(h * .86)
    x0, x1 = round(w * .10), round(w * .90)
    central = values[y0:y1, x0:x1] < threshold
    if slot_count <= 1:
        return {"threshold": round(float(threshold), 2), "total": int(central.sum()), "slots": [int(central.sum())], "sideImbalance": None}
    parts = np.array_split(central, slot_count, axis=1)
    slots = [int(part.sum()) for part in parts]
    side_imbalance = abs(slots[0] - slots[1]) / max(1, slots[0] + slots[1]) if slot_count == 2 else None
    return {"threshold": round(float(threshold), 2), "total": int(central.sum()), "slots": slots,
            "sideImbalance": round(side_imbalance, 4) if side_imbalance is not None else None}


def distributions(model, image_path=None, image=None):
    if image is not None:
        scale = min(WIDTH / image.width, HEIGHT / image.height)
        resized = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), Image.Resampling.BILINEAR)
        canvas = Image.new("L", (WIDTH, HEIGHT), 255)
        canvas.paste(resized, ((WIDTH - resized.width) // 2, (HEIGHT - resized.height) // 2))
        tensor = torch.from_numpy((1 - np.asarray(canvas, dtype=np.float32) / 255).astype(np.float32)).unsqueeze(0)
    else:
        tensor = prepare(image_path)
    with torch.inference_mode():
        return [head.softmax(-1)[0].numpy() for head in model(tensor.unsqueeze(0))]


def candidates(dist, limit=100):
    length, tens, ones = dist
    rows = []
    for digit in range(10):
        rows.append({"read": str(digit), "score": float(length[0] * ones[digit]), "length": 1})
    for left in range(1, 10):
        for right in range(10):
            rows.append({"read": f"{left}{right}", "score": float(length[1] * tens[left] * ones[right]), "length": 2})
    rows.sort(key=lambda row: row["score"], reverse=True)
    return [{**row, "score": round(row["score"], 8)} for row in rows[:limit]]


def averaged(distributions):
    # Probability averaging is deliberately key-blind and gives each retained
    # captured frame equal weight.
    return [np.mean(np.stack([dist[head] for dist in distributions]), axis=0) for head in range(3)]


def dedupe(reads):
    output = []
    for read in reads:
        if read not in output:
            output.append(read)
    return output


def summarize(rows, field):
    by_split = {}
    for split in ("development", "validation", "holdout"):
        selected = [row for row in rows if row["split"] == split]
        by_split[split] = {"total": len(selected), "truthAvailable": sum(row["truth"] in row[field] for row in selected)}
    return {"total": len(rows), "truthAvailable": sum(row["truth"] in row[field] for row in rows), "bySplit": by_split}


def main():
    opts = parse_args()
    manifest = json.loads(resolved(opts.manifest).read_text())
    debug_rows = walk_debug()
    pages = defaultdict(list)
    for row in debug_rows:
        debug = row["debug"]
        pages[(debug.get("scanSessionId"), debug.get("layoutId"))].append(row)

    model = ExistingWholeAnswerNet()
    checkpoint = torch.load(resolved(opts.model), map_location="cpu", weights_only=False)
    model.load_state_dict(checkpoint.get("state_dict", checkpoint))
    model.eval()
    opts.crop_out.mkdir(parents=True, exist_ok=True)
    layouts = {}
    rows = []
    for entry in manifest["entries"]:
        layout_id = entry["layoutId"]
        layout = layouts.setdefault(layout_id, json.loads((ROOT / "layouts" / f"{layout_id}.json").read_text()))
        group = next(item for item in layout.get("question_groups", []) if int(item.get("question_num", -1)) == int(entry["questionNum"]))
        frame_rows = pages.get((entry["captureId"], layout_id), [])
        if not frame_rows:
            raise RuntimeError(f"no retained warped frames for {entry['uid']}")
        baseline_dist = distributions(model, image_path=resolved(Path(entry["recognitionPath"])))
        baseline_candidates = candidates(baseline_dist)
        frame_distributions = []
        occupancy = []
        crop_paths = []
        for frame_index, frame in enumerate(sorted(frame_rows, key=lambda row: str(row["debugPath"]))):
            page = Image.open(frame["warpedPath"]).convert("RGB")
            geometry = zone_rect(group, layout, *page.size)
            if not geometry:
                continue
            rect, slot_rects = geometry
            crop = recognition_view(page, rect, slot_rects)
            frame_distributions.append(distributions(model, image=crop))
            occupancy.append(ink_occupancy(crop, len(group.get("digit_box_ids", []))))
            relative = Path(entry["packetId"]) / layout_id / f"q{int(entry['questionNum']):02d}-f{frame_index + 1}.png"
            destination = opts.crop_out / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            crop.save(destination, optimize=True)
            crop_paths.append(str(destination.relative_to(ROOT)))
        layout_candidates = candidates(averaged(frame_distributions))
        baseline_top3 = [row["read"] for row in baseline_candidates[:3]]
        layout_top3 = [row["read"] for row in layout_candidates[:3]]
        baseline2_layout1 = dedupe(baseline_top3[:2] + layout_top3[:1])[:3]
        baseline1_layout2 = dedupe(baseline_top3[:1] + layout_top3[:2])[:3]
        merged_top3 = dedupe([row["read"] for row in sorted(
            [{**row, "source": "baseline"} for row in baseline_candidates[:5]] +
            [{**row, "source": "layout"} for row in layout_candidates[:5]],
            key=lambda row: row["score"], reverse=True)])[:3]
        best_single = next(row["read"] for row in layout_candidates if row["length"] == 1)
        length_rescue = dedupe(layout_top3 + [best_single])[:4]
        rows.append({
            "uid": entry["uid"], "packetId": entry["packetId"], "layoutId": layout_id,
            "layoutFamily": entry["layoutFamily"], "questionNum": entry["questionNum"],
            "split": entry["split"], "truth": str(entry["truth"]), "frameCount": len(frame_distributions),
            "baselineTop3": baseline_top3, "layoutTop3": layout_top3,
            "baseline2Layout1": baseline2_layout1, "baseline1Layout2": baseline1_layout2,
            "mergedTop3": merged_top3, "lengthRescueTop4": length_rescue,
            "bestLayoutSingle": best_single, "layoutTop5": [row["read"] for row in layout_candidates[:5]],
            "occupancy": occupancy, "cropPaths": crop_paths,
        })

    fields = ["baselineTop3", "layoutTop3", "baseline2Layout1", "baseline1Layout2", "mergedTop3", "lengthRescueTop4", "layoutTop5"]
    report = {
        "schemaVersion": 1,
        "status": "isolated review-choice experiment; not deployed",
        "answerKeyProvidedToModel": False,
        "answerKeyUsedAsTruth": False,
        "automaticRecognitionPolicyChanged": False,
        "manifest": str(opts.manifest), "model": str(opts.model),
        "summaries": {field: summarize(rows, field) for field in fields},
        "rows": rows,
    }
    opts.out.parent.mkdir(parents=True, exist_ok=True)
    opts.out.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"destination": str(opts.out), "summaries": report["summaries"]}, indent=2))


if __name__ == "__main__":
    main()
