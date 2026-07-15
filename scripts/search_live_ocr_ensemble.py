#!/usr/bin/env python3
"""Search model/policy ensembles from eval_live_ocr_direct.py dump files.

The direct evaluator can dump every model's probability vector for every crop
variant. This helper recombines those probabilities so selector changes can be
measured before adding runtime cost to the app.
"""

from __future__ import annotations

import argparse
import itertools
import json
from collections import Counter, defaultdict
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
    "gentle-center": ["gentle", "center-safe-slot"],
    "expected-wide": ["expected-slot", "wide-slot"],
    "expected-edge": ["expected-slot", "edge-band-slot"],
    "center-edge": ["center-safe-slot", "edge-band-slot"],
    "box-safe": ["center-safe-slot", "expected-slot", "edge-band-slot"],
    "wide-noside": ["wide-slot", "no-side-erase"],
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dump")
    parser.add_argument("--top-base", type=int, default=36)
    parser.add_argument("--top", type=int, default=40)
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


def mix(a: list[float], b: list[float], weight_a: float) -> list[float]:
    return [a[i] * weight_a + b[i] * (1 - weight_a) for i in range(10)]


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


def confusion(items: list[dict], choices: list[int | None], limit: int = 8) -> list[tuple[str, int]]:
    counts = Counter()
    for item, choice in zip(items, choices):
        if choice != item["expected"]:
            counts[f"{item['expected']}->{choice}"] += 1
    return counts.most_common(limit)


def main() -> int:
    args = parse_args()
    rows = json.loads(Path(args.dump).read_text())
    grouped: dict[tuple, list[dict]] = defaultdict(list)
    for row in rows:
        key = (row["file"], row["index"], row["questionNum"], row["digitIndex"])
        grouped[key].append(row)

    items = []
    candidate_probs: dict[str, list[list[float] | None]] = defaultdict(list)
    variant_names = sorted({name for row in rows for name in (row.get("variants") or {})})
    all_policy_names = dict(POLICIES)
    for name in variant_names:
        all_policy_names[f"variant:{name}"] = [name]

    for key, model_rows in sorted(grouped.items()):
        first = model_rows[0]
        items.append({
            "key": key,
            "expected": first["expected"],
            "manual": first.get("manual"),
            "digitIndex": first.get("digitIndex"),
        })
        by_model = {row["model"]: row for row in model_rows}
        for model, row in by_model.items():
            for policy, names in all_policy_names.items():
                candidate_probs[f"{model}::{policy}"].append(avg_probs(row.get("variants") or {}, names))

    base_results = []
    for name, probs_list in candidate_probs.items():
        choices = [digit(probs) for probs in probs_list]
        base_results.append((score(items, choices), name, choices, probs_list))
    base_results.sort(reverse=True)

    print("base")
    for result, name, choices, _probs in base_results[:args.top]:
        print(result, name, confusion(items, choices))

    bases = base_results[:args.top_base]
    ensemble_results = []
    weights = [i / 20 for i in range(1, 20)]
    for (score_a, name_a, _choices_a, probs_a), (score_b, name_b, _choices_b, probs_b) in itertools.combinations(bases, 2):
        for weight_a in weights:
            mixed_probs = [
                mix(pa, pb, weight_a) if pa is not None and pb is not None else (pa or pb)
                for pa, pb in zip(probs_a, probs_b)
            ]
            choices = [digit(probs) for probs in mixed_probs]
            ensemble_results.append((score(items, choices), f"{weight_a:.2f}*{name_a} + {1-weight_a:.2f}*{name_b}", choices))

    for left in bases[:24]:
        for right in bases[:24]:
            choices = []
            for item, left_probs, right_probs in zip(items, left[3], right[3]):
                probs = right_probs if item.get("digitIndex") == 1 else left_probs
                choices.append(digit(probs))
            ensemble_results.append((score(items, choices), f"slot-split left={left[1]} right={right[1]}", choices))

    for primary in bases[:24]:
        for fallback in bases[:24]:
            if primary[1] == fallback[1]:
                continue
            for max_primary_gap in [0.02, 0.04, 0.06, 0.08, 0.12, 0.18, 0.26, 0.40]:
                for min_fallback_gap in [0.04, 0.08, 0.12, 0.18, 0.26, 0.40, 0.55]:
                    choices = []
                    changed = 0
                    for pa, pb in zip(primary[3], fallback[3]):
                        use_fallback = (
                            pb is not None and
                            gap(pa) <= max_primary_gap and
                            gap(pb) >= min_fallback_gap and
                            digit(pb) != digit(pa)
                        )
                        choices.append(digit(pb if use_fallback else pa))
                        changed += int(use_fallback)
                    ensemble_results.append((
                        score(items, choices),
                        f"fallback {primary[1]} -> {fallback[1]} primaryGap<={max_primary_gap:.2f} fallbackGap>={min_fallback_gap:.2f} changed={changed}",
                        choices,
                    ))

    ensemble_results.sort(reverse=True)
    print("\nensembles")
    for result, label, choices in ensemble_results[:args.top]:
        print(result, label, confusion(items, choices))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
