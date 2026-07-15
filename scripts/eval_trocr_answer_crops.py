#!/usr/bin/env python3
"""Evaluate a key-blind TrOCR model on ScanGrade whole-answer crops.

This is an offline research script. It never supplies the mathematical answer key
to the recognizer and writes results only under private-evidence by default.
"""

import argparse
import json
import re
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import torch
from PIL import Image, ImageEnhance, ImageOps
from transformers import TrOCRProcessor, VisionEncoderDecoderModel


DEFAULT_TRUTH = Path(
    "private-evidence/truth-labels/"
    "20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json"
)
DEFAULT_OUT = Path("private-evidence/reports/trocr-answer-crops-20260709.json")


def args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--truth", type=Path, default=DEFAULT_TRUTH)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--model", default="microsoft/trocr-base-handwritten")
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--split", choices=("development", "validation", "holdout"))
    parser.add_argument("--mode", choices=("original", "contrast", "tight"), default="original")
    parser.add_argument("--device", choices=("auto", "cpu", "mps"), default="auto")
    return parser.parse_args()


def normalize(value):
    return "".join(re.findall(r"\d", str(value or "")))


def layout_family(layout_id):
    return "row" if re.search(r"sg-g1-lw-0[1-5]-", layout_id or "") else "non-row"


def split_for(entry):
    # Page index is the only durable grouping field in this corpus. Ten-page
    # blocks are kept intact. These are R&D splits, not claimed student splits.
    packet_index = max(0, int(entry.get("pageIndex") or 0) // 10)
    if packet_index >= 7:
        return "holdout"
    if packet_index >= 5:
        return "validation"
    return "development"


def prepare(path, mode):
    image = Image.open(path).convert("RGB")
    if mode == "contrast":
        gray = ImageOps.grayscale(image)
        gray = ImageEnhance.Contrast(gray).enhance(1.8)
        image = Image.merge("RGB", (gray, gray, gray))
    elif mode == "tight":
        # Remove only the known white outer margin; preserve both answer cells.
        bbox = ImageOps.invert(ImageOps.grayscale(image)).point(lambda x: 255 if x > 12 else 0).getbbox()
        if bbox:
            left, top, right, bottom = bbox
            pad = 5
            image = image.crop((max(0, left - pad), max(0, top - pad), min(image.width, right + pad), min(image.height, bottom + pad)))
    return image


def bucket(rows):
    total = len(rows)
    correct = sum(row["correct"] for row in rows)
    return {
        "total": total,
        "correct": correct,
        "exactAccuracyPct": round(100 * correct / total, 1) if total else 0,
    }


def choose_device(requested):
    if requested != "auto":
        return requested
    return "mps" if torch.backends.mps.is_available() else "cpu"


def main():
    opts = args()
    truth = json.loads(opts.truth.read_text())
    entries = [
        entry for entry in truth.get("entries", [])
        if entry.get("cropPath") and entry.get("truthStatus") not in ("needs-label", "unclear")
    ]
    for entry in entries:
        entry["researchSplit"] = split_for(entry)
    if opts.split:
        entries = [entry for entry in entries if entry["researchSplit"] == opts.split]
    if opts.limit:
        entries = entries[: opts.limit]

    device = choose_device(opts.device)
    started = time.time()
    processor = TrOCRProcessor.from_pretrained(opts.model)
    model = VisionEncoderDecoderModel.from_pretrained(opts.model).to(device)
    model.eval()
    load_seconds = round(time.time() - started, 2)

    rows = []
    infer_started = time.time()
    for offset in range(0, len(entries), opts.batch_size):
        batch = entries[offset : offset + opts.batch_size]
        images = [prepare(entry["cropPath"], opts.mode) for entry in batch]
        pixels = processor(images=images, return_tensors="pt").pixel_values.to(device)
        with torch.inference_mode():
            generated = model.generate(pixels, max_new_tokens=8, num_beams=1)
        raw_reads = processor.batch_decode(generated, skip_special_tokens=True)
        for entry, raw in zip(batch, raw_reads):
            read = normalize(raw)
            handwritten_truth = normalize(entry.get("truth"))
            rows.append({
                "captureId": entry.get("captureId"),
                "pageIndex": entry.get("pageIndex"),
                "questionLabel": entry.get("questionLabel"),
                "layoutId": entry.get("layoutId"),
                "layoutFamily": layout_family(entry.get("layoutId")),
                "researchSplit": entry["researchSplit"],
                "truthStatus": entry.get("truthStatus"),
                "cropPath": entry.get("cropPath"),
                "handwrittenTruth": handwritten_truth,
                "answerKey": normalize(entry.get("expected")),
                "appPrediction": normalize(entry.get("appPrediction")),
                "appReview": bool(entry.get("review")),
                "rawModelOutput": raw,
                "modelRead": read,
                "correct": read == handwritten_truth,
            })
        print(f"{min(offset + len(batch), len(entries))}/{len(entries)}", flush=True)

    elapsed = time.time() - infer_started
    by_layout = defaultdict(list)
    by_split = defaultdict(list)
    by_length = defaultdict(list)
    for row in rows:
        by_layout[row["layoutId"]].append(row)
        by_split[row["researchSplit"]].append(row)
        by_length[str(len(row["handwrittenTruth"]))].append(row)

    report = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "model": opts.model,
        "mode": opts.mode,
        "device": device,
        "answerKeyProvidedToModel": False,
        "splitWarning": "Page-block R&D split only; corpus has no durable student or packet identifier.",
        "loadSeconds": load_seconds,
        "inferenceSeconds": round(elapsed, 2),
        "averageMsPerCrop": round(1000 * elapsed / len(rows), 1) if rows else 0,
        "overall": bucket(rows),
        "bySplit": {key: bucket(value) for key, value in sorted(by_split.items())},
        "byLayout": {key: bucket(value) for key, value in sorted(by_layout.items())},
        "byAnswerLength": {key: bucket(value) for key, value in sorted(by_length.items())},
        "rawOutputCounts": Counter(row["rawModelOutput"] for row in rows).most_common(30),
        "rows": rows,
    }
    opts.out.parent.mkdir(parents=True, exist_ok=True)
    opts.out.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({key: report[key] for key in ("overall", "bySplit", "averageMsPerCrop")}, indent=2))
    print(opts.out)


if __name__ == "__main__":
    main()
