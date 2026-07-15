#!/usr/bin/env python3
"""Join live-replay V3 zone exports to handwritten truth without using answer keys."""

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_TRUTH = ROOT / "private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json"
DEFAULT_DIRS = [
    ROOT / "private-evidence/reports/v3-live-continuous-zones-20260713",
    ROOT / "private-evidence/reports/v3-live-continuous-zones-20260713-part2",
]
DEFAULT_OUT = ROOT / "private-evidence/v3/live-continuous-answer-zones-manifest.json"


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--truth", type=Path, default=DEFAULT_TRUTH)
    parser.add_argument("--zone-dir", type=Path, action="append", dest="zone_dirs")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    return parser.parse_args()


def split_for(entry):
    page = int(entry.get("pageIndex", -1))
    return "holdout" if page >= 70 else "validation" if page >= 50 else "development"


def quality(path):
    values = np.asarray(Image.open(path).convert("L"), dtype=np.float32)
    p05, p50, p95 = np.quantile(values, (.05, .5, .95), method="nearest")
    dx = np.abs(np.diff(values, axis=1)).mean() if values.shape[1] > 1 else 0
    dy = np.abs(np.diff(values, axis=0)).mean() if values.shape[0] > 1 else 0
    return {
        "width": int(values.shape[1]), "height": int(values.shape[0]), "mean": round(float(values.mean()), 3),
        "standardDeviation": round(float(values.std()), 3), "p05": int(p05), "p50": int(p50), "p95": int(p95),
        "contrastRange": int(p95 - p05), "meanEdgeMagnitude": round(float((dx + dy) / 2), 4),
        "darkClipFraction": float((values <= 8).mean()), "lightClipFraction": float((values >= 247).mean()),
    }


def main():
    opts = parse_args()
    zone_dirs = opts.zone_dirs or DEFAULT_DIRS
    truth = json.loads(opts.truth.read_text())
    by_key = {(entry["captureId"], int(entry["questionNum"])): entry for entry in truth.get("entries", [])}
    rects = {}
    files = {}
    for directory in zone_dirs:
        for metadata in directory.glob("*-v3-zones.json"):
            capture_id = metadata.name.removesuffix("-v3-zones.json")
            for zone in json.loads(metadata.read_text()):
                rects[(capture_id, int(zone["questionNum"]))] = zone.get("rect")
        for image in directory.glob("*-v3-q*.png"):
            stem, question = image.stem.rsplit("-v3-q", 1)
            files[(stem, int(question))] = image
    rows = []
    for key, entry in by_key.items():
        image = files.get(key)
        if not image or entry.get("truthStatus") in ("needs-label", "unclear"):
            continue
        digest = hashlib.sha256(image.read_bytes()).hexdigest()
        rows.append({
            "schemaVersion": 1, "uid": entry.get("uid"), "captureId": entry["captureId"],
            "pageIndex": entry.get("pageIndex"), "layoutId": entry.get("layoutId"), "questionNum": entry["questionNum"],
            "split": split_for(entry), "truth": str(entry.get("truth", "")), "truthStatus": entry.get("truthStatus"),
            "imagePath": str(image.relative_to(ROOT)), "source": "live-refined-canonical-warp-continuous-grayscale",
            "rect": rects.get(key), "sha256": digest, "quality": quality(image),
        })
    hashes = {}
    for row in rows:
        hashes.setdefault(row["sha256"], []).append(row["uid"])
    report = {
        "schemaVersion": 1, "sourceTruth": str(opts.truth.relative_to(ROOT)), "keyBlindImageExtraction": True,
        "splitWarning": "Historical page-block R&D split only; no durable student/packet IDs exist. Prospective packet holdouts remain decisive.",
        "counts": {name: sum(row["split"] == name for row in rows) for name in ("development", "validation", "holdout")},
        "missingTruthEntries": len(by_key) - len(rows), "exactDuplicateGroups": [uids for uids in hashes.values() if len(uids) > 1],
        "entries": rows,
    }
    opts.out.parent.mkdir(parents=True, exist_ok=True)
    opts.out.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"out": str(opts.out), "counts": report["counts"], "missing": report["missingTruthEntries"], "duplicates": len(report["exactDuplicateGroups"])}, indent=2))


if __name__ == "__main__":
    main()
