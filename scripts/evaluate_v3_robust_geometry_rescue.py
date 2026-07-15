#!/usr/bin/env python3
"""Test key-blind robust answer-zone geometry repair with the local 64x192 model.

The current per-question zone centers are compared with the worksheet metadata.
An affine page map is fitted from the mutually consistent zones. A clear spatial
outlier is re-cropped from the retained grayscale page at the position predicted
by the other answers. Truth is consulted only after inference for evaluation.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import itertools
import json
import math
import re
from collections import defaultdict
from pathlib import Path

import numpy as np
import onnxruntime as ort
import torch
from PIL import Image

from evaluate_v3_local_candidates import ExistingWholeAnswerNet
from evaluate_v3_layout_crop_rescue import candidates, distributions


ROOT = Path(__file__).resolve().parents[1]


def args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=ROOT / "private-evidence/v3/four-packet-sequence-20260714/manifest.json")
    parser.add_argument("--model", type=Path, default=ROOT / "private-evidence/models/v3-sequence-live/model.pt")
    parser.add_argument("--out", type=Path, default=ROOT / "private-evidence/reports/v3-robust-geometry-rescue-20260714.json")
    parser.add_argument("--crop-out", type=Path, default=ROOT / "private-evidence/reports/v3-robust-geometry-rescue-20260714")
    return parser.parse_args()


def resolve(path):
    path = Path(path)
    return path if path.is_absolute() else ROOT / path


def decode_png(data_url):
    match = re.match(r"^data:image/png;base64,(.+)$", data_url or "", re.S)
    return base64.b64decode(match.group(1)) if match else None


def find_debug_pages():
    output = []
    for date in ("2026-07-13", "2026-07-14"):
        for file in (ROOT / "private-evidence/debug-scans" / date).rglob("debug.json"):
            try:
                wrapper = json.loads(file.read_text())
            except (OSError, json.JSONDecodeError):
                continue
            debug = wrapper.get("debug", wrapper)
            # `warped.png` in these debug bundles is the marked/annotated view;
            # its white review rectangles can cover the very handwriting being
            # rescued. `captured.png` is the retained clean page at the same
            # dimensions and coordinate system for this corpus.
            source = file.parent / "captured.png"
            coordinate_reference = file.parent / "warped.png"
            if source.exists() and coordinate_reference.exists() and debug.get("scanSessionId") and debug.get("layoutId") and debug.get("v3AnswerZones"):
                output.append({"file": file, "source": source, "coordinateReference": coordinate_reference, "debug": debug})
    return output


def box_rect(box, layout, width, height):
    if layout.get("page", {}).get("units") == "normalized":
        return np.array([(box["x"] - box["width"]) * width, (box["y"] - box["height"]) * height,
                         box["width"] * width, box["height"] * height], dtype=np.float64)
    sx, sy = width / layout["page"]["width_mm"], height / layout["page"]["height_mm"]
    w, h = box["width"] * sx, box["height"] * sy
    return np.array([box["cx"] * sx - w / 2, box["cy"] * sy - h / 2, w, h], dtype=np.float64)


def expected_zone(group, layout, width, height):
    by_id = {box["id"]: box for box in layout.get("boxes", [])}
    rects = [box_rect(by_id[item], layout, width, height) for item in group.get("digit_box_ids", []) if item in by_id]
    x0, y0 = min(r[0] for r in rects), min(r[1] for r in rects)
    x1, y1 = max(r[0] + r[2] for r in rects), max(r[1] + r[3] for r in rects)
    margin = min(r[3] for r in rects) * .08
    return np.array([x0 - margin, y0 - margin, x1 + margin, y1 + margin], dtype=np.float64)


def expected_slots(group, layout, width, height):
    by_id = {box["id"]: box for box in layout.get("boxes", [])}
    return [box_rect(by_id[item], layout, width, height) for item in group.get("digit_box_ids", []) if item in by_id]


def center(rect):
    return np.array([(rect[0] + rect[2]) / 2, (rect[1] + rect[3]) / 2], dtype=np.float64)


def fit_affine(source, target):
    design = np.column_stack([np.ones(len(source)), source])
    coefficients, *_ = np.linalg.lstsq(design, target, rcond=None)
    return coefficients


def apply_affine(coefficients, points):
    design = np.column_stack([np.ones(len(points)), points])
    return design @ coefficients


def robust_affine(source, target, page_diagonal):
    threshold = max(24.0, page_diagonal * .022)
    best = None
    for indexes in itertools.combinations(range(len(source)), 3):
        sample = list(indexes)
        if abs(np.linalg.det(np.column_stack([np.ones(3), source[sample]]))) < 1e-6:
            continue
        coefficients = fit_affine(source[sample], target[sample])
        residuals = np.linalg.norm(apply_affine(coefficients, source) - target, axis=1)
        inliers = residuals <= threshold
        score = (int(inliers.sum()), -float(np.median(residuals[inliers])) if inliers.any() else -math.inf)
        if best is None or score > best[0]:
            best = (score, inliers)
    if best is None:
        return fit_affine(source, target), np.ones(len(source), dtype=bool), threshold
    coefficients = fit_affine(source[best[1]], target[best[1]])
    residuals = np.linalg.norm(apply_affine(coefficients, source) - target, axis=1)
    inliers = residuals <= threshold
    return fit_affine(source[inliers], target[inliers]), inliers, threshold


def transformed_rect(coefficients, rect, width, height):
    x0, y0, x1, y1 = rect
    corners = apply_affine(coefficients, np.array([[x0, y0], [x1, y0], [x0, y1], [x1, y1]]))
    low, high = corners.min(axis=0), corners.max(axis=0)
    return (max(0, math.floor(low[0])), max(0, math.floor(low[1])),
            min(width, math.ceil(high[0])), min(height, math.ceil(high[1])))


def digit_tensor(image, dark_floor):
    values = np.asarray(image.convert("L"), dtype=np.float32)
    background = float(np.quantile(values, .90))
    ink = np.clip((background - values) / 70.0, 0, 1)
    # Printed frames/equation text are substantially darker than pencil in this
    # corpus. Suppress their cores while retaining antialiased pencil strokes.
    ink[values < dark_floor] = 0
    ys, xs = np.where(ink > .12)
    if len(xs):
        ink = ink[max(0, int(ys.min()) - 2):min(ink.shape[0], int(ys.max()) + 3),
                  max(0, int(xs.min()) - 2):min(ink.shape[1], int(xs.max()) + 3)]
    source = Image.fromarray(np.uint8(ink * 255))
    scale = min(20 / source.width, 20 / source.height)
    source = source.resize((max(1, round(source.width * scale)), max(1, round(source.height * scale))), Image.Resampling.BILINEAR)
    canvas = Image.new("L", (28, 28))
    canvas.paste(source, ((28 - source.width) // 2, (28 - source.height) // 2))
    return np.asarray(canvas, dtype=np.float32)[None, None] / 255.0


def digit_candidates(image, session, limit=5):
    input_name = session.get_inputs()[0].name
    probabilities = []
    for dark_floor in (10, 20, 30, 40, 50, 60, 70, 80):
        logits = session.run(None, {input_name: digit_tensor(image, dark_floor)})[0][0]
        values = np.exp(logits - logits.max())
        probabilities.append(values / values.sum())
    # Max pooling preserves genuinely different pencil/print separations as
    # review alternatives. It is not used as automatic confidence.
    pooled = np.max(np.stack(probabilities), axis=0)
    order = np.argsort(pooled)[::-1]
    return [{"digit": int(index), "score": float(pooled[index])} for index in order[:limit]]


def answer_digit_candidates(slot_images, sessions, limit=5):
    per_slot = [digit_candidates(image, sessions[min(index, len(sessions) - 1)]) for index, image in enumerate(slot_images)]
    rows = [{"read": "", "score": 1.0}]
    for slot in per_slot:
        rows = [{"read": row["read"] + str(candidate["digit"]), "score": row["score"] * candidate["score"]}
                for row in rows for candidate in slot]
    rows.sort(key=lambda row: row["score"], reverse=True)
    # A single digit can be written in either cell on the open-divider sheets.
    # Use medium-tone (pencil-like) occupancy to choose one structurally plausible
    # single-slot lane; this does not use the mathematical answer key.
    if len(per_slot) == 2:
        occupancies = []
        for image in slot_images:
            values = np.asarray(image.convert("L"), dtype=np.float32)
            background = float(np.quantile(values, .90))
            occupancies.append(int(((values >= 20) & (values < background - 15)).sum()))
        dominant = int(np.argmax(occupancies))
        rows.extend({"read": str(candidate["digit"]), "score": candidate["score"] * .98} for candidate in per_slot[dominant])
        rows.sort(key=lambda row: row["score"], reverse=True)
    output = []
    for row in rows:
        if row["read"] not in [item["read"] for item in output]:
            output.append({"read": row["read"], "score": round(row["score"], 8)})
        if len(output) >= limit:
            break
    return output


def choose_page(candidates_for_page, entries):
    """Match the exact debug version used to create the saved manifest crops."""
    expected = {int(entry["questionNum"]): hashlib.sha256(resolve(entry["imagePath"]).read_bytes()).hexdigest() for entry in entries}
    scored = []
    for candidate in candidates_for_page:
        matched = 0
        for zone in candidate["debug"].get("v3AnswerZones", []):
            raw = decode_png(zone.get("imageDataUrl"))
            if raw and hashlib.sha256(raw).hexdigest() == expected.get(int(zone["questionNum"])):
                matched += 1
        scored.append((matched, candidate))
    scored.sort(key=lambda item: item[0], reverse=True)
    if not scored or scored[0][0] == 0:
        raise RuntimeError(f"could not match debug page for {entries[0]['packetId']} {entries[0]['layoutId']}")
    return scored[0][1], scored[0][0]


def summarize(rows, field):
    result = {"total": len(rows), "truthAvailable": sum(row["truth"] in row[field] for row in rows)}
    result["bySplit"] = {}
    for split in ("development", "validation", "holdout"):
        selected = [row for row in rows if row["split"] == split]
        result["bySplit"][split] = {"total": len(selected), "truthAvailable": sum(row["truth"] in row[field] for row in selected)}
    return result


def main():
    opts = args()
    manifest = json.loads(resolve(opts.manifest).read_text())
    entries_by_page = defaultdict(list)
    for entry in manifest["entries"]:
        entries_by_page[(entry["captureId"], entry["layoutId"])].append(entry)
    debug_by_page = defaultdict(list)
    for page in find_debug_pages():
        debug_by_page[(page["debug"].get("scanSessionId"), page["debug"].get("layoutId"))].append(page)

    model = ExistingWholeAnswerNet()
    checkpoint = torch.load(resolve(opts.model), map_location="cpu", weights_only=False)
    model.load_state_dict(checkpoint.get("state_dict", checkpoint))
    model.eval()
    digit_sessions = [
        ort.InferenceSession(str(ROOT / "public/models/worksheet-digit-tony-generalist-noaug-20260601.onnx"), providers=["CPUExecutionProvider"]),
        ort.InferenceSession(str(ROOT / "public/models/worksheet-digit-live-trusted-temp.onnx"), providers=["CPUExecutionProvider"]),
    ]
    opts.crop_out.mkdir(parents=True, exist_ok=True)
    layouts = {}
    rows = []
    page_reports = []
    for page_key, entries in sorted(entries_by_page.items()):
        page, hash_matches = choose_page(debug_by_page.get(page_key, []), entries)
        image = Image.open(page["source"]).convert("L")
        reference = Image.open(page["coordinateReference"])
        width, height = reference.size
        source_width, source_height = image.size
        layout_id = entries[0]["layoutId"]
        layout = layouts.setdefault(layout_id, json.loads((ROOT / "layouts" / f"{layout_id}.json").read_text()))
        groups = {int(group["question_num"]): group for group in layout.get("question_groups", [])}
        zones = {int(zone["questionNum"]): zone for zone in page["debug"]["v3AnswerZones"]}
        questions = sorted(int(entry["questionNum"]) for entry in entries)
        expected_rects = [expected_zone(groups[q], layout, width, height) for q in questions]
        expected_centers = np.array([center(rect) for rect in expected_rects])
        observed_rects = [np.array([zones[q]["rect"]["x"], zones[q]["rect"]["y"],
                                    zones[q]["rect"]["x"] + zones[q]["rect"]["w"],
                                    zones[q]["rect"]["y"] + zones[q]["rect"]["h"]], dtype=np.float64) for q in questions]
        observed_centers = np.array([center(rect) for rect in observed_rects])
        coefficients, inliers, threshold = robust_affine(expected_centers, observed_centers, math.hypot(width, height))
        predicted_centers = apply_affine(coefficients, expected_centers)
        residuals = np.linalg.norm(predicted_centers - observed_centers, axis=1)
        page_reports.append({
            "packetId": entries[0]["packetId"], "layoutId": layout_id, "debugPath": str(page["file"].relative_to(ROOT)),
            "matchedZoneHashes": hash_matches, "threshold": round(threshold, 2), "inlierCount": int(inliers.sum()),
            "residuals": {str(q): round(float(residuals[i]), 2) for i, q in enumerate(questions)},
        })
        entry_by_question = {int(entry["questionNum"]): entry for entry in entries}
        for index, question in enumerate(questions):
            entry = entry_by_question[question]
            baseline = candidates(distributions(model, image_path=resolve(entry["recognitionPath"])))
            predicted_rect = transformed_rect(coefficients, expected_rects[index], width, height)
            source_rect = (
                round(predicted_rect[0] * source_width / width), round(predicted_rect[1] * source_height / height),
                round(predicted_rect[2] * source_width / width), round(predicted_rect[3] * source_height / height),
            )
            repaired_crop = image.crop(source_rect)
            repaired = candidates(distributions(model, image=repaired_crop))
            slot_images = []
            slot_source_rects = []
            for slot in expected_slots(groups[question], layout, width, height):
                slot_xyxy = np.array([slot[0], slot[1], slot[0] + slot[2], slot[1] + slot[3]])
                slot_reference_rect = transformed_rect(coefficients, slot_xyxy, width, height)
                slot_source_rect = (
                    round(slot_reference_rect[0] * source_width / width), round(slot_reference_rect[1] * source_height / height),
                    round(slot_reference_rect[2] * source_width / width), round(slot_reference_rect[3] * source_height / height),
                )
                slot_source_rects.append(list(slot_source_rect))
                slot_images.append(image.crop(slot_source_rect))
            large_digit = answer_digit_candidates(slot_images, digit_sessions)
            is_outlier = bool((not bool(inliers[index])) and residuals[index] > threshold)
            selected = repaired if is_outlier else baseline
            destination = opts.crop_out / entry["packetId"] / layout_id / f"q{question:02d}.png"
            destination.parent.mkdir(parents=True, exist_ok=True)
            repaired_crop.save(destination, optimize=True)
            rows.append({
                "uid": entry["uid"], "packetId": entry["packetId"], "layoutId": layout_id,
                "layoutFamily": entry["layoutFamily"], "questionNum": question, "split": entry["split"], "truth": str(entry["truth"]),
                "geometryResidual": round(float(residuals[index]), 2), "geometryThreshold": round(threshold, 2),
                "geometryOutlier": is_outlier, "currentRect": [round(float(value), 2) for value in observed_rects[index]],
                "predictedRect": list(predicted_rect), "sourceRect": list(source_rect), "baselineTop3": [row["read"] for row in baseline[:3]],
                "repairedTop3": [row["read"] for row in repaired[:3]], "selectedTop3": [row["read"] for row in selected[:3]],
                "repairedTop5": [row["read"] for row in repaired[:5]],
                "largeGrayscaleDigitTop3": [row["read"] for row in large_digit[:3]],
                "largeGrayscaleDigitTop5": [row["read"] for row in large_digit[:5]],
                "slotSourceRects": slot_source_rects, "cropPath": str(destination.relative_to(ROOT)),
            })
    fields = ("baselineTop3", "repairedTop3", "selectedTop3", "repairedTop5", "largeGrayscaleDigitTop3", "largeGrayscaleDigitTop5")
    report = {
        "schemaVersion": 1, "status": "isolated geometry and local review-choice experiment; not deployed",
        "answerKeyProvidedToModel": False, "answerKeyUsedAsTruth": False, "automaticRecognitionPolicyChanged": False,
        "summaries": {field: summarize(rows, field) for field in fields},
        "geometryOutliers": int(sum(row["geometryOutlier"] for row in rows)), "pages": page_reports, "rows": rows,
    }
    opts.out.parent.mkdir(parents=True, exist_ok=True)
    opts.out.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"destination": str(opts.out), "geometryOutliers": report["geometryOutliers"], "summaries": report["summaries"]}, indent=2))


if __name__ == "__main__":
    main()
