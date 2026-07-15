#!/usr/bin/env python3
"""Search small selector policies from eval_live_ocr_direct.py dumps.

The dump contains per-variant full probability vectors for one model. This
helper tries lightweight switches between all-variant, box-safe, and slot-family
averages so selector tweaks can be measured before changing app code.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path


WEIGHTS = {
    "base": 0.90,
    "strict": 1.08,
    "edge-clean": 1.00,
    "line-masked-slot": 0.35,
    "center-safe-slot": 1.05,
    "expected-slot": 1.02,
    "edge-band-slot": 1.04,
    "wide-slot": 0.58,
    "no-rule-cleanup": 0.96,
    "no-component-cleanup": 0.96,
    "no-side-erase": 0.42,
    "gentle": 0.58,
}

BOX = ["center-safe-slot", "expected-slot", "edge-band-slot"]
SLOT = ["gentle", "center-safe-slot", "expected-slot", "edge-band-slot", "wide-slot", "no-side-erase"]
CLEANUP = ["strict", "edge-clean", "no-rule-cleanup", "no-component-cleanup"]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dumps", nargs="+")
    return parser.parse_args()


def top_gap(probs: list[float]) -> float:
    ranked = sorted(probs, reverse=True)
    return ranked[0] - ranked[1] if len(ranked) > 1 else 1.0


def average_probs(item: dict, names: list[str] | None = None) -> list[float] | None:
    probs = [0.0] * 10
    total = 0.0
    for name, variant in (item.get("variants") or {}).items():
        if names is not None and name not in names:
            continue
        values = variant.get("probs")
        if not isinstance(values, list) or len(values) < 10:
            continue
        weight = WEIGHTS.get(name, 0.90)
        total += weight
        for idx in range(10):
            probs[idx] += float(values[idx]) * weight
    if total <= 0:
        return None
    return [value / total for value in probs]


def digit(probs: list[float] | None) -> int | None:
    if probs is None:
        return None
    return max(range(10), key=lambda idx: probs[idx])


def item_features(item: dict) -> dict:
    all_probs = average_probs(item)
    box_probs = average_probs(item, BOX)
    slot_probs = average_probs(item, SLOT)
    cleanup_probs = average_probs(item, CLEANUP)
    variants = item.get("variants") or {}
    box_digits = [digit(variants.get(name, {}).get("probs")) for name in BOX if variants.get(name, {}).get("probs")]
    slot_digits = [digit(variants.get(name, {}).get("probs")) for name in SLOT if variants.get(name, {}).get("probs")]
    cleanup_digits = [digit(variants.get(name, {}).get("probs")) for name in CLEANUP if variants.get(name, {}).get("probs")]
    return {
        "all_probs": all_probs,
        "box_probs": box_probs,
        "slot_probs": slot_probs,
        "cleanup_probs": cleanup_probs,
        "all_digit": digit(all_probs),
        "box_digit": digit(box_probs),
        "slot_digit": digit(slot_probs),
        "cleanup_digit": digit(cleanup_probs),
        "all_gap": top_gap(all_probs) if all_probs else 0.0,
        "box_gap": top_gap(box_probs) if box_probs else 0.0,
        "slot_gap": top_gap(slot_probs) if slot_probs else 0.0,
        "cleanup_gap": top_gap(cleanup_probs) if cleanup_probs else 0.0,
        "box_agree": max(Counter(box_digits).values(), default=0),
        "slot_agree": max(Counter(slot_digits).values(), default=0),
        "cleanup_agree": max(Counter(cleanup_digits).values(), default=0),
        "box_digits": box_digits,
        "slot_digits": slot_digits,
        "cleanup_digits": cleanup_digits,
    }


def score(items: list[dict], predictions: list[int | None]) -> tuple[int, int, int, int]:
    correct = sum(int(pred == item["expected"]) for item, pred in zip(items, predictions))
    non_manual = [(item, pred) for item, pred in zip(items, predictions) if not item.get("manual")]
    non_manual_correct = sum(int(pred == item["expected"]) for item, pred in non_manual)
    return correct, len(items), non_manual_correct, len(non_manual)


def split_scores(groups: list[tuple[str, list[dict]]], predictions: list[int | None]) -> list[tuple[str, tuple[int, int, int, int]]]:
    out = []
    cursor = 0
    for name, items in groups:
        part = predictions[cursor:cursor + len(items)]
        out.append((name, score(items, part)))
        cursor += len(items)
    return out


def main() -> int:
    args = parse_args()
    groups = [(Path(path).name, json.loads(Path(path).read_text())) for path in args.dumps]
    items = [item for _name, group in groups for item in group]
    features = [item_features(item) for item in items]

    base_all = [feature["all_digit"] for feature in features]
    base_box = [feature["box_digit"] if feature["box_digit"] is not None else feature["all_digit"] for feature in features]
    print("all", score(items, base_all), split_scores(groups, base_all))
    print("box", score(items, base_box), split_scores(groups, base_box))

    candidates: list[tuple[tuple[int, int, int, int], int, str, list[int | None]]] = []
    gaps = [0.00, 0.02, 0.04, 0.06, 0.08, 0.10, 0.14, 0.18, 0.24, 0.32, 0.45]
    for slot in [None, 0, 1]:
        for min_box_agree in [1, 2, 3]:
            for min_box_gap in gaps:
                for max_all_gap in [0.05, 0.08, 0.12, 0.18, 0.26, 0.40, 0.70, 1.0]:
                    for require_cleanup_not_stronger in [False, True]:
                        preds = []
                        changed = 0
                        for item, feature, base in zip(items, features, base_all):
                            value = base
                            use_box = (
                                feature["box_digit"] is not None
                                and feature["box_digit"] != base
                                and (slot is None or item.get("digitIndex") == slot)
                                and feature["box_agree"] >= min_box_agree
                                and feature["box_gap"] >= min_box_gap
                                and feature["all_gap"] <= max_all_gap
                            )
                            if require_cleanup_not_stronger and use_box:
                                use_box = not (
                                    feature["cleanup_digit"] == base
                                    and feature["cleanup_gap"] >= feature["box_gap"] + 0.08
                                    and feature["cleanup_agree"] >= 3
                                )
                            if use_box:
                                value = feature["box_digit"]
                            changed += int(value != base)
                            preds.append(value)
                        candidates.append((
                            score(items, preds),
                            changed,
                            f"box switch slot={slot} agree>={min_box_agree} boxGap>={min_box_gap:.2f} allGap<={max_all_gap:.2f} cleanupGuard={require_cleanup_not_stronger}",
                            preds,
                        ))

    for result, changed, label, preds in sorted(candidates, reverse=True)[:40]:
        print(result, "changed", changed, label, split_scores(groups, preds))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
