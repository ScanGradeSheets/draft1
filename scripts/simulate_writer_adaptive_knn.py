#!/usr/bin/env python3
"""Simulate key-blind within-packet writer adaptation from saved digit crops.

Prototype labels come either from already-automatic app reads (deployable shadow
lane) or from other truth-labelled answers (teacher-confirmed upper bound). The
target answer is always excluded. No mathematical answer key is used.
"""

import base64
import io
import json
import math
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PACKETS = ("P08", "P03", "P09", "P02")
LAYOUTS = tuple(
    f"sg-g1-lw-{index:02d}-{name}" for index, name in enumerate((
        "add-1digit", "add-2digit", "sub-1digit", "sub-2digit", "mixed-20",
        "ten-frames", "dot-collections", "number-bonds", "number-patterns", "place-value-50",
    ), 1)
)
P02_DOT = "2026-07-14_03-52-45-221-sg-g1-lw-07-dot-collections-39ec2eb4"
TRUTH_FILES = (
    "private-evidence/hybrid-v2-prospective/handwritten-truth-development.json",
    "private-evidence/hybrid-v2-prospective/handwritten-truth-p03-p09-primary.json",
    "private-evidence/hybrid-v2-prospective/handwritten-truth-p02-verified.json",
)


def load_truth():
    rows = []
    for relative in TRUTH_FILES:
        rows.extend(json.loads((ROOT / relative).read_text())["labels"])
    return {(row["packetId"], row["layoutId"], int(row["questionNum"])): row for row in rows}


def debug_files():
    for date in ("2026-07-13", "2026-07-14"):
        yield from (ROOT / "private-evidence/debug-scans" / date).rglob("debug.json")


def canonical_pages():
    versions = []
    for file in debug_files():
        try:
            wrapper = json.loads(file.read_text())
            debug = wrapper.get("debug", wrapper)
        except Exception:
            continue
        if debug.get("packetId") in PACKETS and debug.get("layoutId") in LAYOUTS:
            versions.append({"file": file, "dir": file.parent, "debug": debug})
    pages = []
    for packet in PACKETS:
        for layout in LAYOUTS:
            sessions = defaultdict(list)
            for row in versions:
                if row["debug"].get("packetId") == packet and row["debug"].get("layoutId") == layout:
                    sessions[row["debug"].get("scanSessionId") or row["dir"].name].append(row)
            eligible = [rows for rows in sessions.values() if any(
                row["debug"].get("answerGroups") and (row["dir"] / "captured.png").exists() for row in rows
            )]
            if packet == "P02" and layout == "sg-g1-lw-07-dot-collections":
                eligible = [rows for rows in eligible if any(row["dir"].name == P02_DOT for row in rows)]
            if len(eligible) != 1:
                raise RuntimeError(f"{packet}|{layout}: expected one session, got {len(eligible)}")
            pages.append(max(eligible[0], key=lambda row: len(row["debug"].get("modelInputDataUrls") or [])))
    return pages


def image_feature(data_url, size=32):
    raw = base64.b64decode(data_url.split(",", 1)[1])
    image = Image.open(io.BytesIO(raw)).convert("L").resize((size, size), Image.Resampling.BILINEAR)
    values = np.asarray(image, dtype=np.float32) / 255.0
    # Normalize polarity so ink is high, then normalize energy.
    if values.mean() > 0.5:
        values = 1.0 - values
    values = np.maximum(0, values - np.percentile(values, 20))
    norm = float(np.linalg.norm(values))
    return values / norm if norm > 1e-6 else values


def shifted_distance(left, right):
    best = math.inf
    for dy in (-2, -1, 0, 1, 2):
        for dx in (-2, -1, 0, 1, 2):
            shifted = np.roll(right, (dy, dx), axis=(0, 1))
            if dy > 0:
                shifted[:dy, :] = 0
            elif dy < 0:
                shifted[dy:, :] = 0
            if dx > 0:
                shifted[:, :dx] = 0
            elif dx < 0:
                shifted[:, dx:] = 0
            best = min(best, float(np.mean((left - shifted) ** 2)))
    return best


def make_answers():
    truth = load_truth()
    answers = []
    for page in canonical_pages():
        debug = page["debug"]
        crops = debug.get("modelInputDataUrls") or []
        for group in debug.get("answerGroups") or []:
            question = int(group["questionNum"])
            label = truth[(debug["packetId"], debug["layoutId"], question)]
            if label["truthState"] != "value":
                continue
            ids = [int(value) for value in group.get("digitBoxIds") or []]
            handwritten = str(label["handwrittenTruth"])
            app_read = re.sub(r"\D", "", str(group.get("answerText") or ""))
            if len(ids) != len(handwritten) or any(index >= len(crops) for index in ids):
                continue
            answers.append({
                "packet": debug["packetId"], "layout": debug["layoutId"], "question": question,
                "truth": handwritten, "appRead": app_read,
                "automatic": not bool(group.get("reviewNeeded")) and group.get("status") != "review",
                "features": [image_feature(crops[index]) for index in ids],
            })
    return answers


def predict(target, prototypes):
    output = []
    ratios, distances = [], []
    for feature in target["features"]:
        by_digit = defaultdict(list)
        for row in prototypes:
            by_digit[row["digit"]].append(shifted_distance(feature, row["feature"]))
        if len(by_digit) < 2:
            return None
        ranked = sorted((min(values), digit) for digit, values in by_digit.items())
        best_distance, best_digit = ranked[0]
        second_distance = ranked[1][0]
        output.append(best_digit)
        distances.append(best_distance)
        ratios.append(second_distance / max(best_distance, 1e-9))
    return {"read": "".join(output), "minRatio": min(ratios), "maxDistance": max(distances)}


def simulate(answers, mode):
    rows = []
    for target in answers:
        if target["automatic"]:
            continue
        prototypes = []
        for source in answers:
            if source["packet"] != target["packet"] or source is target:
                continue
            if mode == "automatic" and not source["automatic"]:
                continue
            label = source["appRead"] if mode == "automatic" else source["truth"]
            if len(label) != len(source["features"]):
                continue
            for digit, feature in zip(label, source["features"]):
                prototypes.append({"digit": digit, "feature": feature})
        result = predict(target, prototypes)
        if result:
            rows.append({
                "packet": target["packet"], "layout": target["layout"], "question": target["question"],
                "truth": target["truth"], "appRead": target["appRead"], "mode": mode, **result,
                "correct": result["read"] == target["truth"], "prototypeDigits": len(prototypes),
            })
    return rows


def choose_gate(rows):
    development = [row for row in rows if row["packet"] in ("P08", "P03")]
    candidates = []
    for ratio in (1.0, 1.02, 1.05, 1.1, 1.15, 1.2, 1.3, 1.5, 2.0, 3.0):
        for distance in (0.0002, 0.0004, 0.0006, 0.0008, 0.001, 0.0015, 0.002, 0.003, 0.005, 0.01):
            accepted = [row for row in development if row["minRatio"] >= ratio and row["maxDistance"] <= distance]
            wrong = sum(not row["correct"] for row in accepted)
            candidates.append((wrong, -len(accepted), -ratio, distance, ratio))
    zero_error = [item for item in candidates if item[0] == 0]
    selected = min(zero_error or candidates)
    return {"minRatio": selected[4], "maxDistance": selected[3]}


def summarize(rows, gate):
    accepted = [row for row in rows if row["minRatio"] >= gate["minRatio"] and row["maxDistance"] <= gate["maxDistance"]]
    return {
        "eligibleReviews": len(rows), "accepted": len(accepted),
        "correct": sum(row["correct"] for row in accepted),
        "wrong": sum(not row["correct"] for row in accepted),
        "rawNearestCorrect": sum(row["correct"] for row in rows),
    }


def main():
    answers = make_answers()
    lanes = {}
    all_rows = []
    for mode in ("automatic", "teacher-confirmed-upper-bound"):
        rows = simulate(answers, "automatic" if mode == "automatic" else "confirmed")
        gate = choose_gate(rows)
        lanes[mode] = {
            "gateSelectedOn": ["P08", "P03"], "gate": gate,
            "development": summarize([row for row in rows if row["packet"] in ("P08", "P03")], gate),
            "validationP09": summarize([row for row in rows if row["packet"] == "P09"], gate),
            "auditP02": summarize([row for row in rows if row["packet"] == "P02"], gate),
        }
        all_rows.extend(rows)
    report = {
        "schemaVersion": 1, "generatedAt": datetime.now(timezone.utc).isoformat(),
        "answerKeyUsed": False,
        "method": "Within-packet nearest handwritten-digit prototypes with shift-tolerant image distance; target answer excluded.",
        "caveats": [
            "Automatic mode labels prototypes from existing non-review app reads, not from the mathematical key.",
            "Teacher-confirmed mode is an upper bound that assumes other answers were explicitly confirmed.",
            "Small packet counts and repeated worksheet answers limit digit-class coverage; this is shadow-lane evidence only.",
        ],
        "mappedAnswers": len(answers), "lanes": lanes, "rows": all_rows,
    }
    destination = ROOT / "private-evidence/reports/v3-writer-adaptive-knn-20260714.json"
    destination.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"destination": str(destination.relative_to(ROOT)), "mappedAnswers": len(answers), "lanes": lanes}, indent=2))


if __name__ == "__main__":
    main()
