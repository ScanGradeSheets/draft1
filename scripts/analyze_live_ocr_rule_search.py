#!/usr/bin/env python3
"""Search small OCR selector rules across live replay dumps.

This intentionally works from replay dump JSON plus the original exported debug
JSONs, so it can compare both answer-key grading and saved/manual OCR labels.
"""

from __future__ import annotations

import glob
import json
import os
from collections.abc import Callable


NEW_ITEMS = os.environ.get("SG_RULE_NEW_ITEMS", "/tmp/scangrade-grid-expected-wide2-answerkey.json")
NEW_DEBUG_GLOB = os.environ.get("SG_RULE_NEW_DEBUG_GLOB", "/Users/openclaw/Desktop/2/scangrade-live-ocr-debug-*.json")
OLD_ITEMS = os.environ.get("SG_RULE_OLD_ITEMS", "/tmp/scangrade-grid-expected-wide2-old-answerkey.json")
OLD_DEBUG_GLOB = os.environ.get("SG_RULE_OLD_DEBUG_GLOB", "/Users/openclaw/Desktop/New Jsons/scangrade-live-ocr-debug-*.json")


def load_items(items_path: str, debug_glob: str) -> list[dict]:
    with open(items_path, "r", encoding="utf-8") as handle:
        items = json.load(handle)

    saved: dict[tuple[str, int], tuple[int | None, bool]] = {}
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
        item["batch"] = items_path
    return items


def variant(item: dict, name: str) -> dict | None:
    return next((candidate for candidate in item.get("variantPreds") or [] if candidate.get("name") == name), None)


def top_gap(candidate: dict | None) -> float:
    if not candidate:
        return 0.0
    top_k = candidate.get("topK") or []
    if len(top_k) < 2:
        return 1.0
    return float(top_k[0].get("confidence") or 0) - float(top_k[1].get("confidence") or 0)


def average_digit(item: dict, names: list[str]) -> int | None:
    probs = [0.0] * 10
    total = 0
    for name in names:
        candidate = variant(item, name)
        if not candidate:
            continue
        total += 1
        for index, probability in enumerate(candidate.get("probs") or []):
            if index < 10:
                probs[index] += float(probability or 0)
    if not total:
        return None
    return max(range(10), key=lambda digit: probs[digit] / total)


def score(items: list[dict], predictions: list[int]) -> tuple[int, int, int, int]:
    key = sum(int(prediction == item["expected"]) for item, prediction in zip(items, predictions))
    saved = sum(int(prediction == item.get("saved")) for item, prediction in zip(items, predictions))
    non_manual = [
        (item, prediction)
        for item, prediction in zip(items, predictions)
        if not item.get("manual")
    ]
    key_non_manual = sum(int(prediction == item["expected"]) for item, prediction in non_manual)
    saved_non_manual = sum(int(prediction == item.get("saved")) for item, prediction in non_manual)
    return key, saved, key_non_manual, saved_non_manual


def agreement_rule(
    names: list[str],
    min_confidence: float,
    min_gap: float,
    slot: int | None,
    override_only: bool,
    allow_one: bool,
) -> Callable[[dict], int | None]:
    def choose(item: dict) -> int | None:
        if slot is not None and item.get("digitIndex") != slot:
            return None
        candidates = [variant(item, name) for name in names]
        if any(candidate is None for candidate in candidates):
            return None
        digit = int(candidates[0]["digit"])
        if not allow_one and digit == 1:
            return None
        if override_only and digit == item["production"]:
            return None
        for candidate in candidates:
            if int(candidate["digit"]) != digit:
                return None
            if float(candidate.get("confidence") or 0) < min_confidence:
                return None
            if top_gap(candidate) < min_gap:
                return None
        return digit

    return choose


def average_rule(names: list[str], slot: int | None) -> Callable[[dict], int | None]:
    def choose(item: dict) -> int | None:
        if slot is not None and item.get("digitIndex") != slot:
            return None
        return average_digit(item, names)

    return choose


def main() -> int:
    new_items = load_items(NEW_ITEMS, NEW_DEBUG_GLOB)
    old_items = load_items(OLD_ITEMS, OLD_DEBUG_GLOB)
    all_items = new_items + old_items
    base_predictions = [int(item["production"]) for item in all_items]
    split = len(new_items)

    print("base all", score(all_items, base_predictions))
    print("base new", score(new_items, base_predictions[:split]))
    print("base old", score(old_items, base_predictions[split:]))

    cleanup = ["strict", "edge-clean", "no-rule-cleanup", "no-component-cleanup"]
    slot_family = ["gentle", "center-safe-slot", "expected-slot", "edge-band-slot", "wide-slot", "no-side-erase"]
    slot_family_with_low = [
        "gentle",
        "center-safe-slot",
        "expected-slot",
        "edge-band-slot",
        "low-slot",
        "wide-slot",
        "no-side-erase",
    ]
    groups = [
        cleanup,
        ["strict", "edge-clean"],
        ["strict", "no-component-cleanup"],
        ["edge-clean", "no-component-cleanup"],
        ["gentle", "center-safe-slot"],
        ["expected-slot", "wide-slot"],
        ["center-safe-slot", "edge-band-slot"],
        ["low-slot"],
        ["edge-band-slot", "low-slot"],
        ["expected-slot", "low-slot"],
        slot_family,
        slot_family_with_low,
        cleanup + slot_family_with_low,
    ]

    candidates: list[tuple[str, Callable[[dict], int | None]]] = []
    for slot in [None, 0, 1]:
        for names in groups:
            label = "+".join(names)
            candidates.append((f"avg {label} slot={slot}", average_rule(names, slot)))
            for min_confidence in [0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85]:
                for min_gap in [0, 0.05, 0.1, 0.18, 0.25, 0.35, 0.5, 0.65]:
                    candidates.append((
                        f"agree {label} c={min_confidence} g={min_gap} slot={slot}",
                        agreement_rule(names, min_confidence, min_gap, slot, False, True),
                    ))
                    for allow_one in [False, True]:
                        candidates.append((
                            f"override {label} allow1={allow_one} c={min_confidence} g={min_gap} slot={slot}",
                            agreement_rule(names, min_confidence, min_gap, slot, True, allow_one),
                        ))

    ranked = []
    for name, choose in candidates:
        predictions = []
        changed = 0
        for item, base in zip(all_items, base_predictions):
            candidate = choose(item)
            value = base if candidate is None else int(candidate)
            changed += int(value != base)
            predictions.append(value)
        all_score = score(all_items, predictions)
        new_score = score(new_items, predictions[:split])
        old_score = score(old_items, predictions[split:])
        if new_score[1] >= 165 and new_score[0] >= 148:
            ranked.append((all_score, new_score, old_score, changed, name))

    for all_score, new_score, old_score, changed, name in sorted(ranked, reverse=True)[:80]:
        print({
            "all": all_score,
            "new": new_score,
            "old": old_score,
            "changed": changed,
            "rule": name,
        })

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
