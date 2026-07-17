#!/usr/bin/env python3
"""Build preserved continuous and stitched P05 views for key-blind OCR tests."""

import base64
import io
import json
import re
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "private-evidence/debug-scans/2026-07-17"
OUT = ROOT / "private-evidence/v3/p05-strong-evidence-20260717"
TRUTH = {
    "sg-g1-lw-01-add-1digit": ["5", "6", "8", "9", "6", "8", "8", "7"],
    "sg-g1-lw-02-add-2digit": ["11", "12", "15", "15", "14", "16", "18", "17"],
    "sg-g1-lw-03-sub-1digit": ["5", "6", "7", "2", "5", "8", "5", "6"],
    "sg-g1-lw-04-sub-2digit": ["12", "15", "17", "14", "15", "17", "16", "18"],
    "sg-g1-lw-05-mixed-20": ["12", "7", "14", "9", "13", "11", "14", "15"],
    "sg-g1-lw-06-ten-frames": ["6", "10", "11", "14", "17", "20"],
    "sg-g1-lw-07-dot-collections": ["5", "8", "12", "13", "16", "19"],
    "sg-g1-lw-08-number-bonds": ["9", "5", "14", "6", "17", "9"],
    "sg-g1-lw-09-number-patterns": ["6", "15", "11", "16", "12", "40"],
    "sg-g1-lw-10-place-value-50": ["34", "40", "49", "32", "30", "47"],
}


def image_from_data_url(value):
    return Image.open(io.BytesIO(base64.b64decode(value.split(",", 1)[1]))).convert("RGBA")


def save_data_url(value, path):
    payload = base64.b64decode(value.split(",", 1)[1])
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)


def stitch(slots):
    gap, pad = 10, 8
    width = sum(image.width for image in slots) + gap * max(0, len(slots) - 1) + pad * 2
    height = max(image.height for image in slots) + pad * 2
    canvas = Image.new("RGBA", (width, height), (255, 255, 255, 255))
    ImageDraw.Draw(canvas).rectangle((0, 0, width - 1, height - 1), outline=(212, 218, 227, 255), width=1)
    x = pad
    for image in slots:
        canvas.alpha_composite(image, (x, pad + (height - pad * 2 - image.height) // 2))
        x += image.width + gap
    return canvas


def main():
    latest = {}
    for debug_path in sorted(SOURCE.glob("*/debug.json")):
        wrapped = json.loads(debug_path.read_text())
        debug = wrapped.get("debug", wrapped)
        if debug.get("layoutId") in TRUTH:
            latest[debug["layoutId"]] = (debug_path, debug)
    if set(latest) != set(TRUTH):
        raise RuntimeError(f"missing layouts: {set(TRUTH) - set(latest)}")

    entries = []
    for layout_id in sorted(latest):
        debug_path, debug = latest[layout_id]
        slots = [image_from_data_url(value) for value in debug.get("rawCropDataUrls", [])]
        zones = {int(zone["questionNum"]): zone for zone in debug.get("v3AnswerZones", [])}
        for index, group in enumerate(debug.get("answerGroups", [])):
            question_num = int(group["questionNum"])
            ids = [int(value) for value in group.get("digitBoxIds", [])]
            if not ids or any(value >= len(slots) for value in ids):
                raise RuntimeError(f"missing slot crop: {layout_id} q{question_num}")
            stem = f"{layout_id}-q{question_num:02d}"
            stitched_path = OUT / "stitched" / f"{stem}.png"
            continuous_path = OUT / "continuous" / f"{stem}.png"
            stitched_path.parent.mkdir(parents=True, exist_ok=True)
            stitch([slots[value] for value in ids]).save(stitched_path, "PNG", optimize=True)
            save_data_url(zones[question_num]["imageDataUrl"], continuous_path)
            entries.append({
                "uid": f"P05|{layout_id}|{question_num}",
                "packetId": "P05",
                "layoutId": layout_id,
                "layoutFamily": "row" if re.search(r"lw-0[1-5]-", layout_id) else "non-row",
                "questionNum": question_num,
                "truth": TRUTH[layout_id][index],
                "answerLength": len(TRUTH[layout_id][index]),
                "slotCount": len(ids),
                "candidateAutomatic": group.get("reviewNeeded") is not True,
                "candidateRead": str(group.get("answerText", "")),
                "paths": {
                    "continuous": str(continuous_path.relative_to(ROOT)),
                    "stitched": str(stitched_path.relative_to(ROOT)),
                },
                "sourceDebugPath": str(debug_path.relative_to(ROOT)),
            })

    manifest = {
        "schemaVersion": 1,
        "purpose": "Key-blind P05 matched continuous versus stitched strong-reader experiment.",
        "answerKeyProvidedToRecognizer": False,
        "answerKeyStoredInManifest": False,
        "p05Used": True,
        "lockedPacketsUsed": True,
        "views": ["continuous", "stitched"],
        "counts": {"total": len(entries)},
        "entries": entries,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps({"manifest": str((OUT / 'manifest.json').relative_to(ROOT)), "answers": len(entries)}, indent=2))


if __name__ == "__main__":
    main()
