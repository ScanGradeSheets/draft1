#!/usr/bin/env python3
"""Score named ScanGrade OCR selector candidates from direct-eval dumps."""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
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
    "low-slot": 0.18,
    "raw-border-slot": 0.12,
    "no-rule-cleanup": 0.96,
    "no-component-cleanup": 0.96,
    "no-side-erase": 0.42,
    "gentle": 0.58,
}

POLICIES = {
    "all-weighted": None,
    "cleanup-quad": ["strict", "edge-clean", "no-rule-cleanup", "no-component-cleanup"],
    "slot-family": ["gentle", "center-safe-slot", "expected-slot", "edge-band-slot", "wide-slot", "no-side-erase"],
    "expected-wide": ["expected-slot", "wide-slot"],
    "expected-edge": ["expected-slot", "edge-band-slot"],
    "center-edge": ["center-safe-slot", "edge-band-slot"],
    "box-safe": ["center-safe-slot", "expected-slot", "edge-band-slot"],
    "wide-noside": ["wide-slot", "no-side-erase"],
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dump", nargs="+")
    parser.add_argument("--show-misses", action="store_true")
    return parser.parse_args()


def avg_probs(variants: dict, names: list[str] | None) -> list[float] | None:
    out = [0.0] * 10
    total = 0.0
    for name, variant in variants.items():
        if names is not None and name not in names:
            continue
        probs = variant.get("probs")
        if not isinstance(probs, list) or len(probs) < 10:
            continue
        weight = WEIGHTS.get(name, 0.90)
        total += weight
        for idx in range(10):
            out[idx] += float(probs[idx]) * weight
    if total <= 0:
        return None
    return [value / total for value in out]


def digit(probs: list[float] | None) -> int | None:
    if probs is None:
        return None
    return max(range(10), key=lambda idx: probs[idx])


def gap(probs: list[float] | None) -> float:
    if not probs:
        return 0.0
    ranked = sorted(probs, reverse=True)
    return ranked[0] - ranked[1] if len(ranked) > 1 else 1.0


def score(items: list[dict], choices: list[int | None]) -> tuple[int, int, int, int]:
    correct = 0
    non_manual_correct = 0
    non_manual_total = 0
    for item, choice in zip(items, choices):
        ok = choice == item["expected"]
        correct += int(ok)
        if not item.get("manual"):
            non_manual_total += 1
            non_manual_correct += int(ok)
    return correct, len(items), non_manual_correct, non_manual_total


def load_dump(paths: list[str]) -> list[dict]:
    rows = []
    for path in paths:
        rows.extend(json.loads(Path(path).read_text()))
    grouped = defaultdict(list)
    for row in rows:
        key = (row["file"], row["index"], row.get("questionNum"), row.get("digitIndex"))
        grouped[key].append(row)

    items = []
    for key, model_rows in sorted(grouped.items()):
        first = model_rows[0]
        by_model = {row["model"]: row for row in model_rows}
        items.append({
            "key": key,
            "file": first["file"],
            "index": first["index"],
            "questionNum": first.get("questionNum"),
            "digitIndex": first.get("digitIndex"),
            "expected": first["expected"],
            "manual": first.get("manual"),
            "models": by_model,
        })
    return items


def probs_for(item: dict, model: str, policy: str) -> list[float] | None:
    row = item["models"].get(model)
    if not row:
        return None
    return avg_probs(row.get("variants") or {}, POLICIES[policy])


def choose_policy(item: dict, model: str, policy: str) -> tuple[int | None, str]:
    probs = probs_for(item, model, policy)
    return digit(probs), f"{model}:{policy}"


def choose_fallback(
    item: dict,
    primary_model: str,
    primary_policy: str,
    fallback_model: str,
    fallback_policy: str,
    max_primary_gap: float,
    min_fallback_gap: float,
) -> tuple[int | None, str]:
    primary = probs_for(item, primary_model, primary_policy)
    fallback = probs_for(item, fallback_model, fallback_policy)
    primary_digit = digit(primary)
    fallback_digit = digit(fallback)
    use_fallback = (
        fallback is not None
        and fallback_digit != primary_digit
        and gap(primary) <= max_primary_gap
        and gap(fallback) >= min_fallback_gap
    )
    if use_fallback:
        return fallback_digit, f"fallback:{fallback_model}:{fallback_policy}"
    return primary_digit, f"primary:{primary_model}:{primary_policy}"


def choose_slot_split(
    item: dict,
    left_model: str,
    left_policy: str,
    right_model: str,
    right_policy: str,
) -> tuple[int | None, str]:
    if item.get("digitIndex") == 1:
        return choose_policy(item, right_model, right_policy)
    return choose_policy(item, left_model, left_policy)


def main() -> int:
    args = parse_args()
    items = load_dump(args.dump)
    candidates = [
        (
            "current-noaug-boxsafe",
            lambda item: choose_policy(item, "worksheet-digit-tony-generalist-noaug-20260601.onnx", "box-safe"),
        ),
        (
            "noaug-lite-allweighted",
            lambda item: choose_policy(item, "worksheet-digit-tony-generalist-noaug-lite-20260601.onnx", "all-weighted"),
        ),
        (
            "noaug-lite-all-to-slot-same-018-012",
            lambda item: choose_fallback(
                item,
                "worksheet-digit-tony-generalist-noaug-lite-20260601.onnx",
                "all-weighted",
                "worksheet-digit-tony-generalist-noaug-lite-20260601.onnx",
                "slot-family",
                0.18,
                0.12,
            ),
        ),
        (
            "noaug-lite-all-to-current-center-018-012",
            lambda item: choose_fallback(
                item,
                "worksheet-digit-tony-generalist-noaug-lite-20260601.onnx",
                "all-weighted",
                "worksheet-digit-tony-generalist-noaug-20260601.onnx",
                "center-edge",
                0.18,
                0.12,
            ),
        ),
        (
            "noaug-lite-all-to-live-center-018-012",
            lambda item: choose_fallback(
                item,
                "worksheet-digit-tony-generalist-noaug-lite-20260601.onnx",
                "all-weighted",
                "worksheet-digit-live-trusted-temp.onnx",
                "center-edge",
                0.18,
                0.12,
            ),
        ),
        (
            "slot-split-current-box-live-expected",
            lambda item: choose_slot_split(
                item,
                "worksheet-digit-tony-generalist-noaug-20260601.onnx",
                "box-safe",
                "worksheet-digit-live-trusted-temp.onnx",
                "expected-edge",
            ),
        ),
        (
            "slot-split-current-center-live-slot",
            lambda item: choose_slot_split(
                item,
                "worksheet-digit-tony-generalist-noaug-20260601.onnx",
                "center-edge",
                "worksheet-digit-live-trusted-temp.onnx",
                "slot-family",
            ),
        ),
    ]

    for label, choose in candidates:
        choices = []
        reasons = []
        for item in items:
            choice, reason = choose(item)
            choices.append(choice)
            reasons.append(reason)
        result = score(items, choices)
        changed = 0
        if label != "current-noaug-boxsafe":
            current = [candidates[0][1](item)[0] for item in items]
            changed = sum(int(a != b) for a, b in zip(choices, current))
        print(f"{label}: {result} changed_vs_current={changed}")
        if args.show_misses:
            for item, choice, reason in zip(items, choices, reasons):
                if choice == item["expected"]:
                    continue
                print(
                    f"  {item['file']} #{item['index']} q={item['questionNum']} "
                    f"d={item['digitIndex']} {item['expected']}->{choice} {reason}"
                )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
