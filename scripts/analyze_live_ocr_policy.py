#!/usr/bin/env python3
"""Search OCR variant selector policies against dumped live OCR items."""

from __future__ import annotations

import collections
import glob
import json
import os
import sys


DEFAULT_ITEMS = "/tmp/scangrade-current-items-answerkey.json"
DEFAULT_DEBUG_GLOB = "/Users/openclaw/Desktop/2/scangrade-live-ocr-debug-*.json"


def top_gap(variant: dict) -> float:
    top_k = variant.get("topK") or []
    if len(top_k) < 2:
        return 1.0
    return float(top_k[0].get("confidence") or 0) - float(top_k[1].get("confidence") or 0)


def variant(item: dict, name: str) -> dict | None:
    for candidate in item.get("variantPreds") or []:
        if candidate.get("name") == name:
            return candidate
    return None


def average_digit(item: dict, names: list[str]) -> int | None:
    probs = [0.0] * 10
    total = 0
    for name in names:
        candidate = variant(item, name)
        if not candidate:
            continue
        total += 1
        for idx, probability in enumerate(candidate.get("probs") or []):
            if idx < 10:
                probs[idx] += float(probability or 0)
    if not total:
        return None
    return max(range(10), key=lambda digit: probs[digit] / total)


def agreement_digit(item: dict, names: list[str], min_confidence: float, min_gap: float) -> int | None:
    variants = [variant(item, name) for name in names]
    if any(candidate is None for candidate in variants):
        return None
    digit = int(variants[0]["digit"])
    for candidate in variants:
        if int(candidate["digit"]) != digit:
            return None
        if float(candidate.get("confidence") or 0) < min_confidence:
            return None
        if top_gap(candidate) < min_gap:
            return None
    return digit


def majority_digit(
    item: dict,
    names: list[str],
    min_confidence: float,
    min_gap: float,
    min_count: int,
) -> int | None:
    by_digit: dict[int, list[dict]] = collections.defaultdict(list)
    for name in names:
        candidate = variant(item, name)
        if not candidate:
            continue
        if float(candidate.get("confidence") or 0) < min_confidence:
            continue
        if top_gap(candidate) < min_gap:
            continue
        by_digit[int(candidate["digit"])].append(candidate)

    best: tuple[tuple[int, float, float], int] | None = None
    for digit, variants in by_digit.items():
        if len(variants) < min_count:
            continue
        score = (
            len(variants),
            sum(float(candidate.get("confidence") or 0) for candidate in variants),
            sum(top_gap(candidate) for candidate in variants),
        )
        if best is None or score > best[0]:
            best = (score, digit)
    return best[1] if best else None


def score(items: list[dict], predictions: list[int]) -> tuple[int, int, int, int]:
    key = sum(int(prediction == item["expected"]) for item, prediction in zip(items, predictions))
    saved = sum(int(prediction == item["saved"]) for item, prediction in zip(items, predictions))
    non_manual = [
        (item, prediction)
        for item, prediction in zip(items, predictions)
        if not item.get("manual")
    ]
    key_non_manual = sum(int(prediction == item["expected"]) for item, prediction in non_manual)
    saved_non_manual = sum(int(prediction == item["saved"]) for item, prediction in non_manual)
    return key, saved, key_non_manual, saved_non_manual


def main() -> int:
    items_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_ITEMS
    debug_glob = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_DEBUG_GLOB

    with open(items_path, "r", encoding="utf-8") as handle:
        items = json.load(handle)

    saved = {}
    for file_path in glob.glob(debug_glob):
        with open(file_path, "r", encoding="utf-8") as handle:
            debug = json.load(handle)
        file_name = os.path.basename(file_path)
        for index, prediction in enumerate(debug.get("predictions") or [], 1):
            saved[(file_name, index)] = (
                prediction.get("digit"),
                bool(prediction.get("manualCorrected") or "originalDigit" in prediction),
            )

    for item in items:
        item["saved"], item["manual"] = saved.get((item["file"], item["index"]), (None, False))

    base_predictions = [int(item["production"]) for item in items]
    print("base", score(items, base_predictions))

    slot_names = [
        "gentle",
        "center-safe-slot",
        "expected-slot",
        "edge-band-slot",
        "wide-slot",
        "no-side-erase",
    ]
    groups = [
        ["gentle", "center-safe-slot"],
        ["center-safe-slot", "edge-band-slot"],
        ["expected-slot", "edge-band-slot"],
        ["expected-slot", "wide-slot"],
        ["wide-slot", "no-side-erase"],
        ["expected-slot", "no-side-erase"],
        ["gentle", "center-safe-slot", "edge-band-slot"],
        ["center-safe-slot", "expected-slot", "edge-band-slot"],
        ["expected-slot", "edge-band-slot", "wide-slot", "no-side-erase"],
        ["gentle", "center-safe-slot", "expected-slot", "edge-band-slot", "wide-slot", "no-side-erase"],
    ]

    candidates = []
    for names in groups:
        for slot in [None, 0, 1]:
            candidates.append((
                f"avg {names} slot={slot}",
                lambda item, names=names, slot=slot: (
                    average_digit(item, names)
                    if slot is None or item.get("digitIndex") == slot
                    else None
                ),
            ))
            for min_confidence in [0.3, 0.4, 0.46, 0.5, 0.56, 0.6, 0.7, 0.8]:
                for min_gap in [0, 0.05, 0.1, 0.18, 0.3, 0.45, 0.6]:
                    candidates.append((
                        f"agree {names} c={min_confidence} g={min_gap} slot={slot}",
                        lambda item, names=names, min_confidence=min_confidence, min_gap=min_gap, slot=slot: (
                            agreement_digit(item, names, min_confidence, min_gap)
                            if slot is None or item.get("digitIndex") == slot
                            else None
                        ),
                    ))

    for slot in [None, 0, 1]:
        for min_confidence in [0.3, 0.4, 0.5, 0.56, 0.6, 0.7, 0.8]:
            for min_gap in [0, 0.05, 0.1, 0.18, 0.3, 0.45, 0.6]:
                for min_count in [3, 4, 5]:
                    candidates.append((
                        f"majority c={min_confidence} g={min_gap} n={min_count} slot={slot}",
                        lambda item, min_confidence=min_confidence, min_gap=min_gap, min_count=min_count, slot=slot: (
                            majority_digit(item, slot_names, min_confidence, min_gap, min_count)
                            if slot is None or item.get("digitIndex") == slot
                            else None
                        ),
                    ))

    ranked = []
    for name, choose in candidates:
        predictions = []
        for item, base in zip(items, base_predictions):
            candidate = choose(item)
            predictions.append(base if candidate is None else int(candidate))
        ranked.append((score(items, predictions), name))

    print("top simple")
    for result, name in sorted(ranked, reverse=True)[:30]:
        print(result, name)

    predictions = base_predictions[:]
    selected = []
    for _ in range(8):
        current_score = score(items, predictions)
        best = None
        for name, choose in candidates:
            next_predictions = []
            changed = 0
            for item, previous in zip(items, predictions):
                candidate = choose(item)
                value = previous if candidate is None else int(candidate)
                changed += int(value != previous)
                next_predictions.append(value)
            next_score = score(items, next_predictions)
            if next_score <= current_score:
                continue
            if best is None or next_score > best[0]:
                best = (next_score, name, next_predictions, changed)
        if best is None:
            break
        selected.append((best[1], best[0], best[3]))
        predictions = best[2]

    print("greedy selected")
    for entry in selected:
        print(entry)
    print("final", score(items, predictions))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
