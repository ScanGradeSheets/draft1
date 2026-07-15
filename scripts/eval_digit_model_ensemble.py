#!/usr/bin/env python3
"""Evaluate a multi-model digit ensemble against handwritten-truth labels.

This is an offline lab script. It intentionally does not change production
OCR behavior; it measures whether multiple existing ONNX digit models can pick
better candidates than the current app selector without using the answer key
as ground truth.
"""

from __future__ import annotations

import argparse
import datetime
import json
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

from eval_digit_variant_selector import (
    Candidate,
    Item,
    candidate_scores,
    expected_slot_digit,
    feature_keys,
    normalize_digit,
    number,
    one_hot,
    project_path,
    score_items,
    scores_grouped,
    split_items,
    tensor_quality,
    top_gap,
    train_logistic,
    vectorize_candidates,
)
from eval_handwritten_truth_digit_models import load_session, model_probs


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ROWS = PROJECT_ROOT / "private-evidence/reports/digit-failure-dataset-20260705-current/digit-rows.json"
DEFAULT_OUT = PROJECT_ROOT / "private-evidence/reports/digit-model-ensemble-20260705/no-key/summary.json"
ALLOWED_LABEL_SOURCES = {"direct-length-match", "inferred-from-app-slot-underscores"}
DEFAULT_MODELS = [
    "public/models/worksheet-digit-tony-generalist-noaug-20260601.onnx",
    "public/models/worksheet-digit-live-trusted-temp.onnx",
    "public/models/worksheet-digit-generalist.onnx",
    "public/models/worksheet-digit-tony-generalist-aug-strong-20260601.onnx",
    "public/models/worksheet-digit-tony-generalist-noaug-lite-20260601.onnx",
    "public/models/worksheet-digit-generalist-final.onnx",
    "public/models/worksheet-digit-live-manual-temp.onnx",
    "public/models/worksheet-digit-tony-generalist-extra-20260601.onnx",
    "public/models/worksheet-digit-tony-generalist-aug-strong-noaug-touch-20260601.onnx",
    "public/models/worksheet-digit-sg3-finetune-local-v2.onnx",
]


@dataclass
class RawCandidate:
    name: str
    source: str
    model_name: str
    variant_name: str
    digit: int | None
    confidence: float
    top_gap: float
    quality: dict[str, float | bool | str | None]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rows", default=str(DEFAULT_ROWS))
    parser.add_argument("--out", default=str(DEFAULT_OUT))
    parser.add_argument("--model", action="append", default=[])
    parser.add_argument("--use-answer-key-context", action="store_true")
    parser.add_argument("--layout-features", action="store_true")
    parser.add_argument("--seed", type=int, default=311)
    return parser.parse_args()


def read_json(path: Path) -> Any:
    return json.loads(path.read_text())


def unwrap_debug(raw: dict[str, Any]) -> dict[str, Any]:
    return raw.get("debug") if isinstance(raw.get("debug"), dict) else raw


def row_allowed(row: dict[str, Any]) -> bool:
    return (
        row.get("truthDigit") is not None
        and row.get("truthSlotSource") in ALLOWED_LABEL_SOURCES
        and row.get("split") in {"calibration", "validation", "holdout"}
    )


def classify_probs(probs: np.ndarray) -> tuple[int, float, float]:
    ranked = np.sort(probs)[::-1]
    digit = int(np.argmax(probs))
    confidence = float(np.max(probs))
    gap = float(ranked[0] - ranked[1]) if len(ranked) > 1 else confidence
    return digit, confidence, gap


def model_alias(path: Path) -> str:
    return path.name.replace("worksheet-digit-", "").replace(".onnx", "")


def model_family(alias: str) -> str:
    if alias == "__current__":
        return "current-app"
    if "sg3-finetune" in alias:
        return "sg3-finetune"
    if "live" in alias:
        return "live"
    if "aug-strong" in alias:
        return "aug-strong"
    if "generalist" in alias:
        return "generalist"
    if "cnn" in alias:
        return "cnn"
    return "other"


def build_candidate_features(
    row: dict[str, Any],
    raw: RawCandidate,
    digit_counts: Counter[int],
    model_digit_counts: Counter[str],
    variant_digit_counts: Counter[str],
    total_candidates: int,
    same_digit_best_conf: float,
    max_conf: float,
    use_answer_key_context: bool,
    layout_features: bool,
) -> dict[str, float | str | bool | None]:
    digit = raw.digit
    current_digit = normalize_digit(row.get("detailDigit"))
    exp_digit = expected_slot_digit(row)
    vote_share = digit_counts[digit] / total_candidates if digit is not None and total_candidates else 0.0
    runner = 0
    for other_digit, count in digit_counts.items():
        if other_digit != digit:
            runner = max(runner, count)
    vote_margin = vote_share - (runner / total_candidates if total_candidates else 0.0)
    model_vote_share = model_digit_counts[f"{raw.model_name}:{digit}"] / total_candidates if digit is not None and total_candidates else 0.0
    variant_vote_share = variant_digit_counts[f"{raw.variant_name}:{digit}"] / total_candidates if digit is not None and total_candidates else 0.0
    features: dict[str, float | str | bool | None] = {
        "bias": 1.0,
        "source": raw.source,
        "modelName": raw.model_name,
        "modelFamily": model_family(raw.model_name),
        "variantName": raw.variant_name,
        "candidateDigit": str(digit if digit is not None else "none"),
        "currentDigit": str(current_digit if current_digit is not None else "none"),
        "confidence": raw.confidence,
        "topGap": raw.top_gap,
        "confidenceSq": raw.confidence * raw.confidence,
        "topGapSq": raw.top_gap * raw.top_gap,
        "confidenceVsMax": raw.confidence - max_conf,
        "sameDigitBestConfidence": same_digit_best_conf,
        "voteShare": vote_share,
        "voteMargin": vote_margin,
        "modelVoteShare": model_vote_share,
        "variantVoteShare": variant_vote_share,
        "isCurrent": raw.source == "current",
        "sameAsCurrentDigit": digit is not None and current_digit is not None and digit == current_digit,
        "currentWasReview": bool(row.get("detailReviewNeeded")),
        "groupWasReview": bool(row.get("groupReview")),
        "family": str(row.get("family") or "unknown"),
        "slotName": str(row.get("slotName") or "unknown"),
        "slotCount": float(number(row.get("slotCount"))),
        "digitIndex": float(number(row.get("digitIndex"))),
        "questionNum": float(number(row.get("questionNum"))),
        "reviewReason": str(row.get("preprocessReviewReason") or row.get("robustOverride") or "none"),
        "inkPixels": number(raw.quality.get("inkPixels")) / 140.0,
        "inkW": number(raw.quality.get("inkW")) / 28.0,
        "inkH": number(raw.quality.get("inkH")) / 28.0,
        "density": number(raw.quality.get("density")),
        "maxRowCount": number(raw.quality.get("maxRowCount")) / 28.0,
        "maxColCount": number(raw.quality.get("maxColCount")) / 28.0,
        "edgeInkRatio": number(raw.quality.get("edgeInkRatio")),
        "qualityScore": number(raw.quality.get("qualityScore")) / 1400.0,
        "qualityOk": bool(raw.quality.get("ok")),
        "lineArtifactLikely": bool(raw.quality.get("lineArtifactLikely")),
        "horizontalArtifactLikely": bool(raw.quality.get("horizontalArtifactLikely")),
        "verticalEdgeArtifactLikely": bool(raw.quality.get("verticalEdgeArtifactLikely")),
        "edgeArtifactLikely": bool(raw.quality.get("edgeArtifactLikely")),
    }
    if use_answer_key_context:
        features["expectedSlotDigit"] = str(exp_digit if exp_digit is not None else "none")
        features["sameAsExpectedSlotDigit"] = digit is not None and exp_digit is not None and digit == exp_digit
        features["expectedLeadingOne"] = exp_digit == 1 and int(row.get("digitIndex") or 0) == 0
        features["expectedDigitCurrentMismatch"] = exp_digit is not None and current_digit is not None and exp_digit != current_digit
    if layout_features:
        features["layoutId"] = str(row.get("layoutId") or "unknown")
    return features


def collect_rows_and_tensors(rows: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[list[float]], list[tuple[int, str]], dict[str, Any]]:
    debug_cache: dict[str, dict[str, Any]] = {}
    item_records: list[dict[str, Any]] = []
    all_tensors: list[list[float]] = []
    tensor_refs: list[tuple[int, str]] = []
    skipped: Counter[str] = Counter()

    for row in rows:
        if not row_allowed(row):
            continue
        debug_path = row.get("debugPath")
        if not debug_path:
            skipped["missing-debug-path"] += 1
            continue
        if debug_path not in debug_cache:
            debug_cache[debug_path] = unwrap_debug(read_json(project_path(debug_path)))
        debug = debug_cache[debug_path]
        detail_id = int(row.get("detailId", -999))
        tensor_row = next((item for item in debug.get("tensors", []) if int(item.get("id", -1)) == detail_id), None)
        if not tensor_row:
            skipped["missing-tensor-row"] += 1
            continue

        tensors_by_name: dict[str, list[float]] = {}
        if isinstance(tensor_row.get("tensor"), list) and len(tensor_row["tensor"]) == 784:
            tensors_by_name["base"] = tensor_row["tensor"]
        for variant in tensor_row.get("tensorVariants") or []:
            if isinstance(variant.get("tensor"), list) and len(variant["tensor"]) == 784:
                tensors_by_name[str(variant.get("name") or f"variant-{len(tensors_by_name)}")] = variant["tensor"]
        if not tensors_by_name:
            skipped["missing-tensors"] += 1
            continue

        item_index = len(item_records)
        for variant_name, tensor in tensors_by_name.items():
            tensor_refs.append((item_index, variant_name))
            all_tensors.append(tensor)
        item_records.append({
            "row": row,
            "truth": int(row["truthDigit"]),
            "tensorsByName": tensors_by_name,
        })

    return item_records, all_tensors, tensor_refs, {
        "skipped": dict(skipped),
        "debugFileCount": len(debug_cache),
    }


def collect_model_predictions(
    item_records: list[dict[str, Any]],
    all_tensors: list[list[float]],
    tensor_refs: list[tuple[int, str]],
    model_paths: list[Path],
) -> tuple[list[list[RawCandidate]], dict[str, Any]]:
    raw_by_item: list[list[RawCandidate]] = [[] for _ in item_records]
    skipped_models: dict[str, str] = {}

    for item_index, record in enumerate(item_records):
        row = record["row"]
        base_tensor = record["tensorsByName"].get("base")
        quality = tensor_quality(base_tensor, "base")
        raw_by_item[item_index].append(
            RawCandidate(
                name="__current__",
                source="current",
                model_name="__current__",
                variant_name="__current__",
                digit=normalize_digit(row.get("detailDigit")),
                confidence=number(row.get("detailConfidence")),
                top_gap=number(row.get("detailTopGap")),
                quality=quality,
            )
        )

    for model_path in model_paths:
        alias = model_alias(model_path)
        try:
            session = load_session(model_path)
            probs = model_probs(session, all_tensors)
        except Exception as exc:  # pragma: no cover - lab robustness
            skipped_models[model_path.name] = str(exc)
            continue
        for probs_row, (item_index, variant_name) in zip(probs, tensor_refs):
            digit, confidence, gap = classify_probs(probs_row)
            tensor = item_records[item_index]["tensorsByName"].get(variant_name)
            raw_by_item[item_index].append(
                RawCandidate(
                    name=f"{alias}:{variant_name}",
                    source="model",
                    model_name=alias,
                    variant_name=variant_name,
                    digit=digit,
                    confidence=confidence,
                    top_gap=gap,
                    quality=tensor_quality(tensor, variant_name),
                )
            )

    return raw_by_item, {"modelCount": len(model_paths) - len(skipped_models), "skippedModels": skipped_models}


def build_items(
    item_records: list[dict[str, Any]],
    raw_by_item: list[list[RawCandidate]],
    use_answer_key_context: bool,
    layout_features: bool,
) -> list[Item]:
    items: list[Item] = []
    for record, raw_candidates in zip(item_records, raw_by_item):
        row = record["row"]
        truth = int(record["truth"])
        digit_counts: Counter[int] = Counter()
        model_digit_counts: Counter[str] = Counter()
        variant_digit_counts: Counter[str] = Counter()
        same_digit_conf: defaultdict[int, float] = defaultdict(float)
        max_conf = 0.0
        for raw in raw_candidates:
            if raw.digit is None:
                continue
            digit_counts[raw.digit] += 1
            model_digit_counts[f"{raw.model_name}:{raw.digit}"] += 1
            variant_digit_counts[f"{raw.variant_name}:{raw.digit}"] += 1
            same_digit_conf[raw.digit] = max(same_digit_conf[raw.digit], raw.confidence)
            max_conf = max(max_conf, raw.confidence)
        total_candidates = sum(digit_counts.values())
        candidates: list[Candidate] = []
        for raw in raw_candidates:
            features = build_candidate_features(
                row=row,
                raw=raw,
                digit_counts=digit_counts,
                model_digit_counts=model_digit_counts,
                variant_digit_counts=variant_digit_counts,
                total_candidates=total_candidates,
                same_digit_best_conf=same_digit_conf[raw.digit] if raw.digit is not None else 0.0,
                max_conf=max_conf,
                use_answer_key_context=use_answer_key_context,
                layout_features=layout_features,
            )
            candidates.append(
                Candidate(
                    name=raw.name,
                    digit=raw.digit,
                    confidence=raw.confidence,
                    top_gap=raw.top_gap,
                    quality=raw.quality,
                    features=features,
                    correct=raw.digit == truth,
                )
            )
        items.append(Item(row=row, truth=truth, candidates=candidates))
    return items


def tune_gated_by_mode(
    validation_items: list[Item],
    validation_scores: list[list[float]],
    mode: str,
) -> tuple[dict[str, float], dict[str, Any]]:
    best_params: dict[str, float] = {}
    best_report: dict[str, Any] | None = None
    for min_delta in [0.00, 0.03, 0.06, 0.10, 0.14, 0.18, 0.22, 0.28, 0.34, 0.42]:
        for min_alt_score in [0.00, 0.45, 0.52, 0.58, 0.64, 0.70, 0.76, 0.82]:
            for min_alt_conf in [0.00, 0.55, 0.70, 0.82, 0.90, 0.95, 0.98]:
                for min_alt_gap in [0.00, 0.10, 0.20, 0.45, 0.70, 0.88]:
                    params = {
                        "min_delta": min_delta,
                        "min_alt_score": min_alt_score,
                        "min_alt_conf": min_alt_conf,
                        "min_alt_gap": min_alt_gap,
                    }
                    report = score_items(validation_items, validation_scores, "gated", params)
                    if mode == "safety":
                        key = (
                            -report["harmed"],
                            report["selector"]["correct"],
                            report["rescued"],
                            -report["switched"],
                        )
                    else:
                        key = (
                            report["selector"]["correct"],
                            -report["harmed"],
                            report["rescued"],
                            -report["switched"],
                        )
                    if best_report is None:
                        best_report = report
                        best_params = params
                        best_key = key
                        continue
                    if key > best_key:
                        best_report = report
                        best_params = params
                        best_key = key
    assert best_report is not None
    return best_params, best_report


def score_simple_digit_votes(items: list[Item]) -> dict[str, Any]:
    vote_items: list[Item] = []
    for item in items:
        counts: Counter[int] = Counter(candidate.digit for candidate in item.candidates if candidate.digit is not None)
        best_digit = None
        best_count = -1
        best_conf = -1.0
        for digit, count in counts.items():
            conf = max((candidate.confidence for candidate in item.candidates if candidate.digit == digit), default=0.0)
            if count > best_count or (count == best_count and conf > best_conf):
                best_digit = digit
                best_count = count
                best_conf = conf
        current_index = next((idx for idx, cand in enumerate(item.candidates) if cand.name == "__current__"), 0)
        current = item.candidates[current_index]
        synthetic = Candidate(
            name="majority-vote",
            digit=best_digit,
            confidence=best_conf,
            top_gap=0.0,
            quality={},
            features={},
            correct=best_digit == item.truth,
        )
        vote_items.append(Item(row=item.row, truth=item.truth, candidates=[current, synthetic]))
    scores = [[0.0, 1.0] for _ in vote_items]
    return score_items(vote_items, scores, "model")


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
    for l2 in [0.0, 0.0003, 0.001, 0.003, 0.01, 0.03, 0.10, 0.30]:
        weights = train_logistic(x_train, y_train, seed=seed, l2=l2, epochs=1000, lr=0.07)
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

    gated_params, gated_validation = tune_gated_by_mode(val_items, val_scores, "accuracy")
    safe_params, safe_validation = tune_gated_by_mode(val_items, val_scores, "safety")

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
                "majorityVote": score_simple_digit_votes(train_items),
            },
            "validation": {
                "current": score_items(val_items, val_scores, "current"),
                "bestConfidence": score_items(val_items, val_scores, "best-confidence"),
                "majorityVote": score_simple_digit_votes(val_items),
            },
            "holdout": {
                "current": score_items(holdout_items, hold_scores, "current"),
                "bestConfidence": score_items(holdout_items, hold_scores, "best-confidence"),
                "majorityVote": score_simple_digit_votes(holdout_items),
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
        "safetyGatedSelector": {
            "params": safe_params,
            "calibration": score_items(train_items, train_scores, "gated", safe_params),
            "validation": safe_validation,
            "holdout": score_items(holdout_items, hold_scores, "gated", safe_params),
        },
    }


def compact_split(report: dict[str, Any], split: str) -> dict[str, Any]:
    current = report["baselines"][split]["current"]
    best_conf = report["baselines"][split]["bestConfidence"]
    majority = report["baselines"][split]["majorityVote"]
    model = report["modelSelector"][split]
    gated = report["gatedSelector"][split]
    safe = report["safetyGatedSelector"][split]
    return {
        "current": current["selector"],
        "oracle": current["oracle"],
        "bestConfidence": best_conf["selector"],
        "majorityVote": majority["selector"],
        "modelSelector": model["selector"],
        "gatedSelector": {
            **gated["selector"],
            "switched": gated["switched"],
            "rescued": gated["rescued"],
            "harmed": gated["harmed"],
        },
        "safetyGatedSelector": {
            **safe["selector"],
            "switched": safe["switched"],
            "rescued": safe["rescued"],
            "harmed": safe["harmed"],
        },
    }


def main() -> None:
    args = parse_args()
    rows = read_json(Path(args.rows))
    model_args = args.model or DEFAULT_MODELS
    model_paths = [Path(model) for model in model_args]
    model_paths = [path if path.is_absolute() else PROJECT_ROOT / path for path in model_paths]
    item_records, all_tensors, tensor_refs, collect_summary = collect_rows_and_tensors(rows)
    raw_by_item, model_summary = collect_model_predictions(item_records, all_tensors, tensor_refs, model_paths)
    items = build_items(
        item_records,
        raw_by_item,
        use_answer_key_context=args.use_answer_key_context,
        layout_features=args.layout_features,
    )
    result = train_and_score(items, seed=args.seed)
    report = {
        "generatedAt": datetime.datetime.now(datetime.UTC).isoformat(),
        "rows": str(Path(args.rows)),
        "useAnswerKeyContext": bool(args.use_answer_key_context),
        "layoutFeatures": bool(args.layout_features),
        "itemCount": len(items),
        "modelPaths": [str(path) for path in model_paths],
        **collect_summary,
        **model_summary,
        **result,
    }
    report["compact"] = {
        "calibration": compact_split(report, "calibration"),
        "validation": compact_split(report, "validation"),
        "holdout": compact_split(report, "holdout"),
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2))
    print(json.dumps({
        "out": str(out),
        "itemCount": report["itemCount"],
        "modelCount": report["modelCount"],
        "compact": report["compact"],
        "gatedParams": report["gatedSelector"]["params"],
        "safetyGatedParams": report["safetyGatedSelector"]["params"],
        "skippedModels": report["skippedModels"],
    }, indent=2))


if __name__ == "__main__":
    main()
