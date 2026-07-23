#!/usr/bin/env python3
"""Verify exported scout ONNX parity on the untouched P05 model holdout."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image

from evaluate_v3_slot_crop_metadata_crossfit import (
    prepare_slots,
    slot_count,
    structure,
)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--onnx", type=Path, required=True)
    parser.add_argument(
        "--manifest",
        type=Path,
        default=Path("private-evidence/v3/p05-local-model-holdout-20260717/manifest.json"),
    )
    parser.add_argument(
        "--reference",
        type=Path,
        default=Path("private-evidence/reports/v3-whole-slot-crop-metadata-p05-external-seed79-20260717.json"),
    )
    return parser.parse_args()


def softmax(values):
    values = values - np.max(values)
    exp = np.exp(values)
    return exp / exp.sum()


def decode_whole(length_logits, tens_logits, ones_logits, slots):
    length = softmax(length_logits)
    tens = softmax(tens_logits)
    ones = softmax(ones_logits)
    candidates = [(str(digit), float(length[0] * ones[digit])) for digit in range(10)]
    if slots == 2:
        candidates.extend(
            (f"{left}{right}", float(length[1] * tens[left] * ones[right]))
            for left in range(10)
            for right in range(10)
        )
    candidates.sort(key=lambda item: item[1], reverse=True)
    total = sum(score for _, score in candidates)
    return candidates[0][0], candidates[0][1] / total


def main():
    opts = parse_args()
    entries = json.loads(opts.manifest.read_text())["entries"]
    reference = json.loads(opts.reference.read_text())
    reference_rows = {
        row["uid"]: row
        for fold in reference["folds"]
        for row in fold["heldOutRows"]
    }
    session = ort.InferenceSession(str(opts.onnx), providers=["CPUExecutionProvider"])
    mismatches = []
    max_probability_delta = 0.0
    for entry in entries:
        uid = entry["uid"]
        if uid not in reference_rows:
            continue
        slots, metadata = structure(entry)
        whole, left, right = prepare_slots(
            Image.open(entry.get("recognitionPath") or entry.get("imagePath")),
            slots,
        )
        feeds = {
            "whole": whole.unsqueeze(0).numpy(),
            "left": left.unsqueeze(0).numpy(),
            "right": right.unsqueeze(0).numpy(),
            "metadata": metadata.unsqueeze(0).numpy(),
        }
        length, tens, ones, _, _ = session.run(None, feeds)
        read, probability = decode_whole(length[0], tens[0], ones[0], slot_count(entry))
        expected = reference_rows[uid]
        delta = abs(probability - float(expected["sequenceProbability"]))
        max_probability_delta = max(max_probability_delta, delta)
        if read != expected["read"] or delta > 2e-5:
            mismatches.append({
                "uid": uid,
                "expectedRead": expected["read"],
                "onnxRead": read,
                "expectedProbability": expected["sequenceProbability"],
                "onnxProbability": round(probability, 8),
                "probabilityDelta": round(delta, 8),
            })
    result = {
        "rows": len(reference_rows),
        "readMismatches": sum(item["expectedRead"] != item["onnxRead"] for item in mismatches),
        "parityMismatches": len(mismatches),
        "maxProbabilityDelta": round(max_probability_delta, 8),
        "pass": not mismatches,
        "mismatches": mismatches,
    }
    print(json.dumps(result, indent=2))
    if mismatches:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
