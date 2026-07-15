#!/usr/bin/env python3
"""Train/evaluate an offline per-item preprocessing-variant selector.

This script is intentionally an evaluation lab, not production code. It uses
the saved classroom truth labels and replay/debug bundles to answer one
question: can confidence + tensor-quality features choose better digit variants
than the current app selector without overfitting?
"""

from __future__ import annotations

import argparse
import json
import math
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ROWS = PROJECT_ROOT / "private-evidence/reports/digit-failure-dataset-20260705-current/digit-rows.json"
DEFAULT_OUT = PROJECT_ROOT / "private-evidence/reports/digit-variant-selector-20260705/summary.json"
ALLOWED_LABEL_SOURCES = {"direct-length-match", "inferred-from-app-slot-underscores"}


@dataclass
class Candidate:
    name: str
    digit: int | None
    confidence: float
    top_gap: float
    quality: dict[str, float | bool | str | None]
    features: dict[str, float | str | bool | None]
    correct: bool


@dataclass
class Item:
    row: dict[str, Any]
    truth: int
    candidates: list[Candidate]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rows", default=str(DEFAULT_ROWS))
    parser.add_argument("--out", default=str(DEFAULT_OUT))
    parser.add_argument("--use-answer-key-context", action="store_true")
    parser.add_argument("--layout-features", action="store_true")
    parser.add_argument("--seed", type=int, default=113)
    return parser.parse_args()


def read_json(path: Path) -> Any:
    return json.loads(path.read_text())


def project_path(path: str | Path) -> Path:
    p = Path(path)
    return p if p.is_absolute() else PROJECT_ROOT / p


def number(value: Any, default: float = 0.0) -> float:
    try:
        out = float(value)
    except (TypeError, ValueError):
        return default
    return out if math.isfinite(out) else default


def normalize_digit(value: Any) -> int | None:
    try:
        digit = int(value)
    except (TypeError, ValueError):
        return None
    return digit if 0 <= digit <= 9 else None


def top_gap(top_k: list[dict[str, Any]] | None, confidence: float) -> float:
    if not top_k or len(top_k) < 2:
        return confidence
    first = number(top_k[0].get("confidence"))
    second = number(top_k[1].get("confidence"))
    return max(0.0, first - second)


def tensor_quality(tensor: list[float] | None, variant_name: str) -> dict[str, float | bool | str | None]:
    values = tensor if isinstance(tensor, list) else []
    ink_pixels = 0
    min_x = 28
    min_y = 28
    max_x = -1
    max_y = -1
    row_counts = [0] * 28
    col_counts = [0] * 28
    edge_ink_pixels = 0
    for index, raw in enumerate(values[: 28 * 28]):
        value = number(raw)
        if value <= 0.16:
            continue
        y = index // 28
        x = index - y * 28
        ink_pixels += 1
        row_counts[y] += 1
        col_counts[x] += 1
        if x <= 1 or x >= 26 or y <= 1 or y >= 26:
            edge_ink_pixels += 1
        min_x = min(min_x, x)
        min_y = min(min_y, y)
        max_x = max(max_x, x)
        max_y = max(max_y, y)

    ink_w = max_x - min_x + 1 if max_x >= min_x else 0
    ink_h = max_y - min_y + 1 if max_y >= min_y else 0
    density = ink_pixels / (ink_w * ink_h) if ink_w > 0 and ink_h > 0 else 0.0
    max_row_count = max(row_counts) if row_counts else 0
    max_col_count = max(col_counts) if col_counts else 0
    edge_ink_ratio = edge_ink_pixels / ink_pixels if ink_pixels else 0.0
    horizontal_artifact_likely = (
        ink_pixels >= 8
        and ink_w >= 11
        and (ink_h <= 6 or max_row_count >= max(9, round(ink_pixels * 0.42)))
    )
    vertical_edge_artifact_likely = (
        ink_pixels >= 10
        and ink_pixels <= 90
        and ink_w <= 7
        and ink_h >= 12
        and density <= 0.72
        and edge_ink_ratio >= 0.30
    )
    edge_artifact_likely = (
        ink_pixels >= 8
        and edge_ink_ratio >= 0.48
        and (ink_w <= 8 or ink_h <= 8 or density <= 0.46)
    )
    line_artifact_likely = horizontal_artifact_likely or vertical_edge_artifact_likely or edge_artifact_likely
    ok = ink_pixels >= 14 and ink_w >= 3 and ink_h >= 8 and not horizontal_artifact_likely and not edge_artifact_likely
    quality_score = 0.0
    if ok:
        quality_score += 1000.0
    if not line_artifact_likely:
        quality_score += 220.0
    if horizontal_artifact_likely:
        quality_score -= 220.0
    if edge_artifact_likely:
        quality_score -= 160.0
    if vertical_edge_artifact_likely:
        quality_score -= 120.0
    quality_score += min(ink_pixels, 120)
    quality_score += min(ink_w, 20) * 4
    quality_score += min(ink_h, 24) * 4
    quality_score -= round(edge_ink_ratio * 90)

    return {
        "variantName": variant_name,
        "inkPixels": float(ink_pixels),
        "inkW": float(ink_w),
        "inkH": float(ink_h),
        "density": float(density),
        "maxRowCount": float(max_row_count),
        "maxColCount": float(max_col_count),
        "edgeInkRatio": float(edge_ink_ratio),
        "horizontalArtifactLikely": horizontal_artifact_likely,
        "verticalEdgeArtifactLikely": vertical_edge_artifact_likely,
        "edgeArtifactLikely": edge_artifact_likely,
        "lineArtifactLikely": line_artifact_likely,
        "ok": ok,
        "qualityScore": float(quality_score),
    }


def unwrap_debug(raw: dict[str, Any]) -> dict[str, Any]:
    return raw.get("debug") if isinstance(raw.get("debug"), dict) else raw


def row_allowed(row: dict[str, Any]) -> bool:
    return (
        row.get("truthDigit") is not None
        and row.get("truthSlotSource") in ALLOWED_LABEL_SOURCES
        and row.get("split") in {"calibration", "validation", "holdout"}
    )


def expected_slot_digit(row: dict[str, Any]) -> int | None:
    expected = "".join(char for char in str(row.get("expected") or "") if char.isdigit())
    index = int(row.get("digitIndex") or 0)
    if index < 0 or index >= len(expected):
        return None
    return normalize_digit(expected[index])


def one_hot(value: Any, prefix: str) -> str:
    text = str(value if value is not None else "none")
    return f"{prefix}={text}"


def candidate_vote_features(candidate: dict[str, Any], digit_counts: Counter[int], total: int) -> tuple[float, float]:
    digit = normalize_digit(candidate.get("digit"))
    if digit is None or total <= 0:
        return 0.0, 0.0
    share = digit_counts[digit] / total
    runner = 0
    for other_digit, count in digit_counts.items():
        if other_digit != digit:
            runner = max(runner, count)
    return share, share - (runner / total if total else 0.0)


def build_features(
    row: dict[str, Any],
    name: str,
    variant: dict[str, Any],
    quality: dict[str, float | bool | str | None],
    digit_counts: Counter[int],
    variant_total: int,
    use_answer_key_context: bool,
    layout_features: bool,
) -> dict[str, float | str | bool | None]:
    digit = normalize_digit(variant.get("digit"))
    confidence = number(variant.get("confidence"))
    gap = number(variant.get("topGap"), top_gap(variant.get("topK"), confidence))
    vote_share, vote_margin = candidate_vote_features(variant, digit_counts, variant_total)
    current_digit = normalize_digit(row.get("detailDigit"))
    exp_digit = expected_slot_digit(row)
    features: dict[str, float | str | bool | None] = {
        "bias": 1.0,
        "confidence": confidence,
        "topGap": gap,
        "confidenceSq": confidence * confidence,
        "topGapSq": gap * gap,
        "voteShare": vote_share,
        "voteMargin": vote_margin,
        "isCurrent": name == "__current__",
        "sameAsCurrentDigit": digit is not None and current_digit is not None and digit == current_digit,
        "currentWasReview": bool(row.get("detailReviewNeeded")),
        "groupWasReview": bool(row.get("groupReview")),
        "family": str(row.get("family") or "unknown"),
        "slotName": str(row.get("slotName") or "unknown"),
        "variantName": name,
        "candidateDigit": str(digit if digit is not None else "none"),
        "currentDigit": str(current_digit if current_digit is not None else "none"),
        "reviewReason": str(row.get("preprocessReviewReason") or row.get("robustOverride") or "none"),
        "inkPixels": number(quality.get("inkPixels")) / 140.0,
        "inkW": number(quality.get("inkW")) / 28.0,
        "inkH": number(quality.get("inkH")) / 28.0,
        "density": number(quality.get("density")),
        "maxRowCount": number(quality.get("maxRowCount")) / 28.0,
        "maxColCount": number(quality.get("maxColCount")) / 28.0,
        "edgeInkRatio": number(quality.get("edgeInkRatio")),
        "qualityScore": number(quality.get("qualityScore")) / 1400.0,
        "qualityOk": bool(quality.get("ok")),
        "lineArtifactLikely": bool(quality.get("lineArtifactLikely")),
        "horizontalArtifactLikely": bool(quality.get("horizontalArtifactLikely")),
        "verticalEdgeArtifactLikely": bool(quality.get("verticalEdgeArtifactLikely")),
        "edgeArtifactLikely": bool(quality.get("edgeArtifactLikely")),
    }
    if use_answer_key_context:
        features["expectedSlotDigit"] = str(exp_digit if exp_digit is not None else "none")
        features["sameAsExpectedSlotDigit"] = digit is not None and exp_digit is not None and digit == exp_digit
        features["expectedLeadingOne"] = exp_digit == 1 and int(row.get("digitIndex") or 0) == 0
    if layout_features:
        features["layoutId"] = str(row.get("layoutId") or "unknown")
    return features


def collect_items(
    rows: list[dict[str, Any]],
    use_answer_key_context: bool,
    layout_features: bool,
) -> tuple[list[Item], dict[str, Any]]:
    debug_cache: dict[str, dict[str, Any]] = {}
    replay_cache: dict[str, dict[str, Any]] = {}
    items: list[Item] = []
    skipped: Counter[str] = Counter()

    for row in rows:
        if not row_allowed(row):
            continue
        debug_path = row.get("debugPath")
        replay_file = row.get("replayFile")
        if not debug_path or not replay_file:
            skipped["missing-path"] += 1
            continue
        if debug_path not in debug_cache:
            debug_cache[debug_path] = unwrap_debug(read_json(project_path(debug_path)))
        if replay_file not in replay_cache:
            replay_cache[replay_file] = read_json(project_path(replay_file))
        debug = debug_cache[debug_path]
        replay = replay_cache[replay_file]
        detail_id = int(row.get("detailId", -999))
        tensor_row = next((item for item in debug.get("tensors", []) if int(item.get("id", -1)) == detail_id), None)
        detail = next((item for item in replay.get("predictionDetails", []) if int(item.get("id", -1)) == detail_id), None)
        if not tensor_row or not detail:
            skipped["missing-detail"] += 1
            continue

        tensor_by_name: dict[str, list[float]] = {}
        if isinstance(tensor_row.get("tensor"), list) and len(tensor_row["tensor"]) == 784:
            tensor_by_name["base"] = tensor_row["tensor"]
        for variant in tensor_row.get("tensorVariants") or []:
            if isinstance(variant.get("tensor"), list) and len(variant["tensor"]) == 784:
                tensor_by_name[str(variant.get("name") or f"variant-{len(tensor_by_name)}")] = variant["tensor"]

        variants = []
        current_variant = {
            "name": "__current__",
            "digit": row.get("detailDigit"),
            "confidence": row.get("detailConfidence"),
            "topGap": row.get("detailTopGap"),
            "topK": [],
        }
        variants.append(current_variant)
        for variant in detail.get("preprocessVariants") or []:
            if normalize_digit(variant.get("digit")) is None:
                continue
            variants.append({**variant, "name": str(variant.get("name") or f"variant-{len(variants)}")})

        if len(variants) <= 1:
            skipped["no-variants"] += 1
            continue

        digit_counts: Counter[int] = Counter()
        for variant in variants:
            digit = normalize_digit(variant.get("digit"))
            if digit is not None:
                digit_counts[digit] += 1
        variant_total = sum(digit_counts.values())
        truth = int(row["truthDigit"])
        candidates: list[Candidate] = []
        for variant in variants:
            name = str(variant.get("name") or "variant")
            digit = normalize_digit(variant.get("digit"))
            tensor_name = "base" if name == "__current__" else name
            quality = tensor_quality(tensor_by_name.get(tensor_name) or tensor_by_name.get("base"), tensor_name)
            features = build_features(
                row,
                name,
                variant,
                quality,
                digit_counts,
                variant_total,
                use_answer_key_context,
                layout_features,
            )
            candidates.append(
                Candidate(
                    name=name,
                    digit=digit,
                    confidence=number(variant.get("confidence")),
                    top_gap=number(variant.get("topGap"), top_gap(variant.get("topK"), number(variant.get("confidence")))),
                    quality=quality,
                    features=features,
                    correct=digit == truth,
                )
            )
        items.append(Item(row=row, truth=truth, candidates=candidates))

    return items, {
        "skipped": dict(skipped),
        "debugFileCount": len(debug_cache),
        "replayFileCount": len(replay_cache),
    }


def split_items(items: list[Item]) -> dict[str, list[Item]]:
    out: dict[str, list[Item]] = {"calibration": [], "validation": [], "holdout": []}
    for item in items:
        split = str(item.row.get("split"))
        if split in out:
            out[split].append(item)
    return out


def feature_keys(train_items: list[Item], min_count: int = 4) -> tuple[list[str], list[str]]:
    numeric: set[str] = set()
    categorical_counts: Counter[str] = Counter()
    for item in train_items:
        for candidate in item.candidates:
            for key, value in candidate.features.items():
                if isinstance(value, (int, float, bool)):
                    numeric.add(key)
                else:
                    categorical_counts[one_hot(value, key)] += 1
    categorical = [key for key, count in categorical_counts.items() if count >= min_count]
    return sorted(numeric), sorted(categorical)


def vectorize_candidates(
    items: list[Item],
    numeric_keys: list[str],
    categorical_keys: list[str],
    mean: np.ndarray | None = None,
    std: np.ndarray | None = None,
) -> tuple[np.ndarray, np.ndarray, list[tuple[int, int]], np.ndarray, np.ndarray]:
    categorical_index = {key: i for i, key in enumerate(categorical_keys)}
    rows: list[np.ndarray] = []
    labels: list[int] = []
    refs: list[tuple[int, int]] = []
    for item_index, item in enumerate(items):
        for candidate_index, candidate in enumerate(item.candidates):
            nums = []
            for key in numeric_keys:
                value = candidate.features.get(key, 0.0)
                nums.append(1.0 if value is True else 0.0 if value is False else number(value))
            cats = np.zeros(len(categorical_keys), dtype=np.float32)
            for key, value in candidate.features.items():
                if isinstance(value, (int, float, bool)):
                    continue
                hot = one_hot(value, key)
                idx = categorical_index.get(hot)
                if idx is not None:
                    cats[idx] = 1.0
            rows.append(np.concatenate([np.asarray(nums, dtype=np.float32), cats]))
            labels.append(1 if candidate.correct else 0)
            refs.append((item_index, candidate_index))
    x = np.stack(rows).astype(np.float32)
    y = np.asarray(labels, dtype=np.float32)
    numeric_count = len(numeric_keys)
    if mean is None:
        mean = np.zeros(x.shape[1], dtype=np.float32)
        std = np.ones(x.shape[1], dtype=np.float32)
        if numeric_count:
            mean[:numeric_count] = np.mean(x[:, :numeric_count], axis=0)
            std[:numeric_count] = np.std(x[:, :numeric_count], axis=0)
            std[:numeric_count] = np.where(std[:numeric_count] < 1e-6, 1.0, std[:numeric_count])
    x = (x - mean) / std
    return x, y, refs, mean, std


def sigmoid(values: np.ndarray) -> np.ndarray:
    values = np.clip(values, -40.0, 40.0)
    return 1.0 / (1.0 + np.exp(-values))


def train_logistic(
    x: np.ndarray,
    y: np.ndarray,
    seed: int,
    l2: float,
    epochs: int = 900,
    lr: float = 0.08,
) -> np.ndarray:
    rng = np.random.default_rng(seed)
    weights = rng.normal(0.0, 0.02, size=x.shape[1]).astype(np.float32)
    pos = max(1, int(np.sum(y == 1)))
    neg = max(1, int(np.sum(y == 0)))
    sample_weights = np.where(y == 1, (pos + neg) / (2 * pos), (pos + neg) / (2 * neg)).astype(np.float32)
    for epoch in range(epochs):
        pred = sigmoid(x @ weights)
        error = (pred - y) * sample_weights
        grad = (x.T @ error) / max(1, x.shape[0]) + l2 * weights
        step = lr * (0.5 + 0.5 * (1.0 - epoch / max(1, epochs)))
        weights -= step * grad
    return weights


def candidate_scores(x: np.ndarray, weights: np.ndarray) -> np.ndarray:
    return sigmoid(x @ weights)


def candidate_current_index(item: Item) -> int:
    for index, candidate in enumerate(item.candidates):
        if candidate.name == "__current__":
            return index
    return 0


def choose_candidate(
    item: Item,
    scores: list[float],
    strategy: str,
    min_delta: float = 0.0,
    min_alt_score: float = 0.0,
    min_alt_conf: float = 0.0,
    min_alt_gap: float = 0.0,
) -> int:
    current_index = candidate_current_index(item)
    if strategy == "current":
        return current_index
    if strategy == "best-confidence":
        return max(range(len(item.candidates)), key=lambda i: item.candidates[i].confidence)
    if strategy == "model":
        return max(range(len(item.candidates)), key=lambda i: scores[i])
    if strategy != "gated":
        raise ValueError(f"Unknown strategy {strategy}")

    best_index = max(range(len(item.candidates)), key=lambda i: scores[i])
    if best_index == current_index:
        return current_index
    best = item.candidates[best_index]
    if scores[best_index] - scores[current_index] < min_delta:
        return current_index
    if scores[best_index] < min_alt_score:
        return current_index
    if best.confidence < min_alt_conf:
        return current_index
    if best.top_gap < min_alt_gap:
        return current_index
    return best_index


def score_items(
    items: list[Item],
    scores_by_item: list[list[float]],
    strategy: str,
    params: dict[str, float] | None = None,
) -> dict[str, Any]:
    params = params or {}
    correct = 0
    switched = 0
    switched_correct = 0
    switched_wrong = 0
    rescued = 0
    harmed = 0
    current_correct = 0
    oracle_correct = 0
    by_family: dict[str, list[int]] = defaultdict(lambda: [0, 0, 0, 0])
    by_layout: dict[str, list[int]] = defaultdict(lambda: [0, 0, 0, 0])
    by_slot: dict[str, list[int]] = defaultdict(lambda: [0, 0, 0, 0])
    picks: Counter[str] = Counter()
    confusions: Counter[str] = Counter()
    examples: list[dict[str, Any]] = []
    for item, scores in zip(items, scores_by_item):
        current_index = candidate_current_index(item)
        current = item.candidates[current_index]
        chosen_index = choose_candidate(
            item,
            scores,
            strategy,
            min_delta=params.get("min_delta", 0.0),
            min_alt_score=params.get("min_alt_score", 0.0),
            min_alt_conf=params.get("min_alt_conf", 0.0),
            min_alt_gap=params.get("min_alt_gap", 0.0),
        )
        chosen = item.candidates[chosen_index]
        current_ok = current.correct
        chosen_ok = chosen.correct
        oracle_ok = any(candidate.correct for candidate in item.candidates)
        current_correct += int(current_ok)
        oracle_correct += int(oracle_ok)
        correct += int(chosen_ok)
        if not chosen_ok:
            confusions[f"{item.truth}->{chosen.digit}"] += 1
        if chosen_index != current_index:
            switched += 1
            switched_correct += int(chosen_ok)
            switched_wrong += int(not chosen_ok)
            rescued += int(chosen_ok and not current_ok)
            harmed += int(current_ok and not chosen_ok)
            if len(examples) < 30:
                examples.append({
                    "captureId": item.row.get("captureId"),
                    "layoutId": item.row.get("layoutId"),
                    "slotName": item.row.get("slotName"),
                    "questionLabel": item.row.get("questionLabel"),
                    "truth": item.truth,
                    "current": {
                        "name": current.name,
                        "digit": current.digit,
                        "score": round(scores[current_index], 4),
                        "confidence": round(current.confidence, 4),
                        "correct": current_ok,
                    },
                    "chosen": {
                        "name": chosen.name,
                        "digit": chosen.digit,
                        "score": round(scores[chosen_index], 4),
                        "confidence": round(chosen.confidence, 4),
                        "correct": chosen_ok,
                    },
                })
        picks[chosen.name] += 1
        for bucket, key in [
            (by_family, item.row.get("family")),
            (by_layout, item.row.get("layoutId")),
            (by_slot, item.row.get("slotName")),
        ]:
            values = bucket[str(key)]
            values[0] += int(chosen_ok)
            values[1] += 1
            values[2] += int(current_ok)
            values[3] += int(oracle_ok)

    total = max(1, len(items))
    def pct(value: int, denom: int = total) -> float:
        return round(value / max(1, denom) * 100, 1)

    def bucket_report(bucket: dict[str, list[int]]) -> dict[str, Any]:
        return {
            key: {
                "selector": {"correct": vals[0], "total": vals[1], "accuracyPct": pct(vals[0], vals[1])},
                "current": {"correct": vals[2], "total": vals[1], "accuracyPct": pct(vals[2], vals[1])},
                "oracle": {"correct": vals[3], "total": vals[1], "accuracyPct": pct(vals[3], vals[1])},
            }
            for key, vals in sorted(bucket.items())
        }

    return {
        "strategy": strategy,
        "params": params,
        "total": len(items),
        "selector": {"correct": correct, "accuracyPct": pct(correct)},
        "current": {"correct": current_correct, "accuracyPct": pct(current_correct)},
        "oracle": {"correct": oracle_correct, "accuracyPct": pct(oracle_correct)},
        "switched": switched,
        "switchedCorrect": switched_correct,
        "switchedWrong": switched_wrong,
        "rescued": rescued,
        "harmed": harmed,
        "netRescue": rescued - harmed,
        "switchAccuracyPct": pct(switched_correct, switched) if switched else 0.0,
        "byFamily": bucket_report(by_family),
        "byLayout": bucket_report(by_layout),
        "bySlot": bucket_report(by_slot),
        "picks": [{"name": name, "count": count} for name, count in picks.most_common(20)],
        "confusions": [{"pair": pair, "count": count} for pair, count in confusions.most_common(20)],
        "examples": examples,
    }


def scores_grouped(items: list[Item], refs: list[tuple[int, int]], scores: np.ndarray) -> list[list[float]]:
    grouped = [[0.0 for _ in item.candidates] for item in items]
    for (item_index, candidate_index), score in zip(refs, scores):
        grouped[item_index][candidate_index] = float(score)
    return grouped


def tune_gated(validation_items: list[Item], validation_scores: list[list[float]]) -> tuple[dict[str, float], dict[str, Any]]:
    best_params: dict[str, float] = {}
    best_report: dict[str, Any] | None = None
    for min_delta in [0.00, 0.03, 0.06, 0.10, 0.14, 0.18, 0.22, 0.28, 0.34]:
        for min_alt_score in [0.00, 0.45, 0.52, 0.58, 0.64, 0.70, 0.76]:
            for min_alt_conf in [0.00, 0.70, 0.82, 0.90, 0.95, 0.98]:
                for min_alt_gap in [0.00, 0.20, 0.45, 0.70, 0.88]:
                    params = {
                        "min_delta": min_delta,
                        "min_alt_score": min_alt_score,
                        "min_alt_conf": min_alt_conf,
                        "min_alt_gap": min_alt_gap,
                    }
                    report = score_items(validation_items, validation_scores, "gated", params)
                    if best_report is None:
                        best_report = report
                        best_params = params
                        continue
                    # Prioritize validation accuracy, then fewer harmful switches, then more rescues.
                    key = (
                        report["selector"]["correct"],
                        -report["harmed"],
                        report["rescued"],
                        -report["switched"],
                    )
                    best_key = (
                        best_report["selector"]["correct"],
                        -best_report["harmed"],
                        best_report["rescued"],
                        -best_report["switched"],
                    )
                    if key > best_key:
                        best_report = report
                        best_params = params
    assert best_report is not None
    return best_params, best_report


def train_and_score(items: list[Item], seed: int) -> dict[str, Any]:
    splits = split_items(items)
    train_items = splits["calibration"]
    val_items = splits["validation"]
    holdout_items = splits["holdout"]
    numeric_keys, categorical_keys = feature_keys(train_items)
    x_train, y_train, train_refs, mean, std = vectorize_candidates(train_items, numeric_keys, categorical_keys)
    x_val, _y_val, val_refs, _mean, _std = vectorize_candidates(val_items, numeric_keys, categorical_keys, mean, std)
    x_hold, _y_hold, hold_refs, _mean, _std = vectorize_candidates(holdout_items, numeric_keys, categorical_keys, mean, std)

    model_reports = []
    best = None
    for l2 in [0.0, 0.0003, 0.001, 0.003, 0.01, 0.03, 0.10]:
        weights = train_logistic(x_train, y_train, seed=seed, l2=l2)
        val_scores = scores_grouped(val_items, val_refs, candidate_scores(x_val, weights))
        model_report = score_items(val_items, val_scores, "model")
        model_reports.append({"l2": l2, "validation": model_report})
        key = (
            model_report["selector"]["correct"],
            -model_report["harmed"],
            model_report["rescued"],
        )
        if best is None or key > best[0]:
            best = (key, l2, weights)
    assert best is not None
    selected_l2 = best[1]
    weights = best[2]
    train_scores = scores_grouped(train_items, train_refs, candidate_scores(x_train, weights))
    val_scores = scores_grouped(val_items, val_refs, candidate_scores(x_val, weights))
    hold_scores = scores_grouped(holdout_items, hold_refs, candidate_scores(x_hold, weights))

    gated_params, gated_validation = tune_gated(val_items, val_scores)

    return {
        "featureCounts": {"numeric": len(numeric_keys), "categorical": len(categorical_keys)},
        "selectedL2": selected_l2,
        "candidateRows": {
            "calibration": int(x_train.shape[0]),
            "validation": int(x_val.shape[0]),
            "holdout": int(x_hold.shape[0]),
        },
        "baselines": {
            "calibration": {
                "current": score_items(train_items, train_scores, "current"),
                "bestConfidence": score_items(train_items, train_scores, "best-confidence"),
            },
            "validation": {
                "current": score_items(val_items, val_scores, "current"),
                "bestConfidence": score_items(val_items, val_scores, "best-confidence"),
            },
            "holdout": {
                "current": score_items(holdout_items, hold_scores, "current"),
                "bestConfidence": score_items(holdout_items, hold_scores, "best-confidence"),
            },
        },
        "modelSelector": {
            "calibration": score_items(train_items, train_scores, "model"),
            "validation": score_items(val_items, val_scores, "model"),
            "holdout": score_items(holdout_items, hold_scores, "model"),
            "validationByL2": model_reports,
        },
        "gatedSelector": {
            "params": gated_params,
            "calibration": score_items(train_items, train_scores, "gated", gated_params),
            "validation": gated_validation,
            "holdout": score_items(holdout_items, hold_scores, "gated", gated_params),
        },
    }


def main() -> None:
    args = parse_args()
    rows = read_json(Path(args.rows))
    items, collect_summary = collect_items(
        rows,
        use_answer_key_context=args.use_answer_key_context,
        layout_features=args.layout_features,
    )
    result = train_and_score(items, seed=args.seed)
    report = {
        "generatedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "rows": str(Path(args.rows)),
        "useAnswerKeyContext": bool(args.use_answer_key_context),
        "layoutFeatures": bool(args.layout_features),
        "itemCount": len(items),
        **collect_summary,
        **result,
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2))
    summary = {
        "out": str(out),
        "itemCount": len(items),
        "useAnswerKeyContext": report["useAnswerKeyContext"],
        "layoutFeatures": report["layoutFeatures"],
        "selectedL2": report["selectedL2"],
        "currentValidation": report["baselines"]["validation"]["current"]["selector"],
        "modelValidation": report["modelSelector"]["validation"]["selector"],
        "gatedValidation": report["gatedSelector"]["validation"]["selector"],
        "currentHoldout": report["baselines"]["holdout"]["current"]["selector"],
        "modelHoldout": report["modelSelector"]["holdout"]["selector"],
        "gatedHoldout": report["gatedSelector"]["holdout"]["selector"],
        "gatedParams": report["gatedSelector"]["params"],
    }
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
