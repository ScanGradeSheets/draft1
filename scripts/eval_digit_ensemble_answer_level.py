#!/usr/bin/env python3
"""Score digit-ensemble choices at the whole-answer level.

This is an offline lab script. It uses the saved classroom truth labels and the
existing digit ensemble evaluator to answer the product question directly:
would a candidate recognition policy improve auto-graded answers, yellow review
suggestions, or whole-answer read accuracy?
"""

from __future__ import annotations

import argparse
import datetime
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from eval_digit_model_ensemble import (
    DEFAULT_MODELS,
    DEFAULT_ROWS,
    build_items,
    collect_model_predictions,
    collect_rows_and_tensors,
    read_json,
    tune_gated_by_mode,
)
from eval_digit_variant_selector import (
    candidate_current_index,
    candidate_scores,
    choose_candidate,
    feature_keys,
    normalize_digit,
    score_items,
    scores_grouped,
    split_items,
    train_logistic,
    vectorize_candidates,
)


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_TRUTH = PROJECT_ROOT / "private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json"
DEFAULT_OUT = PROJECT_ROOT / "private-evidence/reports/digit-ensemble-answer-level-20260705/no-key/summary.json"
SKIP_TRUTH_STATUSES = {"unclear", "needs-label"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rows", default=str(DEFAULT_ROWS))
    parser.add_argument("--truth", default=str(DEFAULT_TRUTH))
    parser.add_argument("--out", default=str(DEFAULT_OUT))
    parser.add_argument("--model", action="append", default=[])
    parser.add_argument("--use-answer-key-context", action="store_true")
    parser.add_argument("--layout-features", action="store_true")
    parser.add_argument("--seed", type=int, default=419)
    return parser.parse_args()


def normalize_answer(value: Any) -> str:
    return "".join(ch for ch in str(value or "").replace("_", "").strip() if ch.isdigit())


def question_key(capture_id: Any, label: Any) -> str:
    return f"{str(capture_id or '').strip()}::{str(label or '').strip()}"


def slot_key(row: dict[str, Any]) -> str:
    return "::".join([
        str(row.get("captureId") or "").strip(),
        str(row.get("questionLabel") or "").strip(),
        str(row.get("digitIndex") if row.get("digitIndex") is not None else "").strip(),
        str(row.get("slotName") or "").strip(),
    ])


def layout_family(layout_id: Any) -> str:
    text = str(layout_id or "")
    if text.startswith("sg-g1-lw-0") and any(text.startswith(f"sg-g1-lw-0{i}-") for i in range(1, 6)):
        return "row"
    if any(text.startswith(prefix) for prefix in [
        "sg-g1-lw-06-",
        "sg-g1-lw-07-",
        "sg-g1-lw-08-",
        "sg-g1-lw-09-",
        "sg-g1-lw-10-",
    ]):
        return "non-row"
    return "other"


def pct(numerator: int, denominator: int) -> float:
    return round(numerator / max(1, denominator) * 100, 1)


def empty_bucket() -> dict[str, int]:
    return {
        "total": 0,
        "answerCorrect": 0,
        "answerWrong": 0,
        "auto": 0,
        "autoCorrect": 0,
        "autoWrong": 0,
        "yellow": 0,
        "yellowLeaningCorrect": 0,
        "yellowLeaningWrong": 0,
        "predictionRescued": 0,
        "predictionHarmed": 0,
        "autoRescued": 0,
        "autoHarmed": 0,
        "yellowSuggestionRescued": 0,
        "yellowSuggestionHarmed": 0,
        "studentMathCorrect": 0,
        "studentMathWrong": 0,
    }


def add_percentages(bucket: dict[str, int]) -> dict[str, Any]:
    return {
        **bucket,
        "answerAccuracyPct": pct(bucket["answerCorrect"], bucket["total"]),
        "autoCoveragePct": pct(bucket["auto"], bucket["total"]),
        "autoAccuracyPct": pct(bucket["autoCorrect"], bucket["auto"]),
        "yellowPct": pct(bucket["yellow"], bucket["total"]),
        "yellowLeaningMatchesTruthPct": pct(bucket["yellowLeaningCorrect"], bucket["yellow"]),
    }


def answer_from_policy_rows(rows: list[dict[str, Any]], selected_digits: dict[str, dict[str, Any]] | None) -> tuple[str, list[dict[str, Any]]]:
    chars: list[str] = []
    changes: list[dict[str, Any]] = []
    for row in sorted(rows, key=lambda item: (int(item.get("digitIndex") or 0), str(item.get("slotName") or ""))):
        current_char = str(row.get("policySlotChar") if row.get("policySlotChar") is not None else "")
        selected = (selected_digits or {}).get(slot_key(row))
        if selected and selected.get("digit") is not None:
            next_char = str(selected["digit"])
            if next_char != current_char:
                changes.append({
                    "digitIndex": row.get("digitIndex"),
                    "slotName": row.get("slotName"),
                    "truthDigit": row.get("truthDigit"),
                    "current": current_char,
                    "selected": next_char,
                    "candidate": selected.get("candidate"),
                    "score": selected.get("score"),
                    "confidence": selected.get("confidence"),
                })
            chars.append(next_char)
        else:
            chars.append(current_char)
    return normalize_answer("".join(chars)), changes


def current_answer_from_rows(rows: list[dict[str, Any]], fallback: str) -> tuple[str, bool]:
    first = rows[0] if rows else {}
    predicted = first.get("groupPredictedNormalized")
    if predicted is None:
        predicted = first.get("groupPredicted")
    review = bool(first.get("groupReview")) if rows else False
    return normalize_answer(predicted if predicted is not None else fallback), review


def choose_l2_and_scores(items: list[Any], seed: int) -> dict[str, Any]:
    splits = split_items(items)
    train_items = splits["calibration"]
    val_items = splits["validation"]
    holdout_items = splits["holdout"]
    numeric_keys, categorical_keys = feature_keys(train_items)
    x_train, y_train, train_refs, mean, std = vectorize_candidates(train_items, numeric_keys, categorical_keys)
    x_val, _y_val, val_refs, _mean, _std = vectorize_candidates(val_items, numeric_keys, categorical_keys, mean, std)
    x_hold, _y_hold, hold_refs, _mean, _std = vectorize_candidates(holdout_items, numeric_keys, categorical_keys, mean, std)

    best: tuple[tuple[int, int, int], float, Any] | None = None
    by_l2: list[dict[str, Any]] = []
    for l2 in [0.0, 0.0003, 0.001, 0.003, 0.01, 0.03, 0.10, 0.30]:
        weights = train_logistic(x_train, y_train, seed=seed, l2=l2, epochs=1000, lr=0.07)
        val_scores = scores_grouped(val_items, val_refs, candidate_scores(x_val, weights))
        report = score_items(val_items, val_scores, "model")
        by_l2.append({"l2": l2, "validation": report})
        key = (report["selector"]["correct"], -report["harmed"], report["rescued"])
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
        "splits": splits,
        "scores": {
            "calibration": train_scores,
            "validation": val_scores,
            "holdout": hold_scores,
        },
        "selectedL2": selected_l2,
        "validationByL2": by_l2,
        "featureCounts": {"numeric": len(numeric_keys), "categorical": len(categorical_keys)},
        "gatedParams": gated_params,
        "safetyGatedParams": safe_params,
        "gatedValidation": gated_validation,
        "safetyGatedValidation": safe_validation,
    }


def selected_digit_maps(selector: dict[str, Any]) -> dict[str, dict[str, dict[str, Any]]]:
    out: dict[str, dict[str, dict[str, Any]]] = {
        "modelSelectorKeepReview": {},
        "gatedSelectorKeepReview": {},
        "safetyGatedSelectorKeepReview": {},
    }
    strategies = {
        "modelSelectorKeepReview": ("model", {}),
        "gatedSelectorKeepReview": ("gated", selector["gatedParams"]),
        "safetyGatedSelectorKeepReview": ("gated", selector["safetyGatedParams"]),
    }
    for split, items in selector["splits"].items():
        scores_by_item = selector["scores"][split]
        for item, scores in zip(items, scores_by_item):
            current_index = candidate_current_index(item)
            for name, (strategy, params) in strategies.items():
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
                current = item.candidates[current_index]
                out[name][slot_key(item.row)] = {
                    "digit": chosen.digit,
                    "candidate": chosen.name,
                    "score": round(float(scores[chosen_index]), 4),
                    "confidence": round(float(chosen.confidence), 4),
                    "topGap": round(float(chosen.top_gap), 4),
                    "switched": chosen_index != current_index,
                    "currentDigit": current.digit,
                    "split": split,
                }
    return out


def bucket_update(
    bucket: dict[str, int],
    truth: str,
    expected: str,
    current_pred: str,
    review: bool,
    candidate_pred: str,
) -> None:
    current_ok = current_pred == truth
    candidate_ok = candidate_pred == truth
    math_ok = truth == expected
    bucket["total"] += 1
    bucket["answerCorrect"] += int(candidate_ok)
    bucket["answerWrong"] += int(not candidate_ok)
    if review:
        bucket["yellow"] += 1
        bucket["yellowLeaningCorrect"] += int(candidate_ok)
        bucket["yellowLeaningWrong"] += int(not candidate_ok)
        bucket["yellowSuggestionRescued"] += int(candidate_ok and not current_ok)
        bucket["yellowSuggestionHarmed"] += int(current_ok and not candidate_ok)
    else:
        bucket["auto"] += 1
        bucket["autoCorrect"] += int(candidate_ok)
        bucket["autoWrong"] += int(not candidate_ok)
        bucket["autoRescued"] += int(candidate_ok and not current_ok)
        bucket["autoHarmed"] += int(current_ok and not candidate_ok)
    bucket["predictionRescued"] += int(candidate_ok and not current_ok)
    bucket["predictionHarmed"] += int(current_ok and not candidate_ok)
    bucket["studentMathCorrect"] += int(math_ok)
    bucket["studentMathWrong"] += int(not math_ok)


def score_answer_strategy(
    entries: list[dict[str, Any]],
    rows_by_question: dict[str, list[dict[str, Any]]],
    selected_digits: dict[str, dict[str, Any]] | None,
    *,
    apply_only_review: bool = False,
) -> dict[str, Any]:
    buckets = {
        "overall": empty_bucket(),
        "row": empty_bucket(),
        "non-row": empty_bucket(),
        "other": empty_bucket(),
    }
    by_layout: dict[str, dict[str, int]] = defaultdict(empty_bucket)
    by_split: dict[str, dict[str, int]] = defaultdict(empty_bucket)
    examples: dict[str, list[dict[str, Any]]] = {
        "predictionRescued": [],
        "predictionHarmed": [],
        "autoWrong": [],
        "yellowSuggestionRescued": [],
        "changed": [],
    }
    items: list[dict[str, Any]] = []
    missing_rows = 0
    for entry in entries:
        key = question_key(entry.get("captureId"), entry.get("questionLabel"))
        rows = rows_by_question.get(key, [])
        if not rows:
            missing_rows += 1
        truth = normalize_answer(entry.get("truth"))
        expected = normalize_answer(entry.get("expected"))
        current_pred, current_review = current_answer_from_rows(rows, entry.get("appPrediction"))
        if not rows:
            current_review = bool(entry.get("review"))
        if apply_only_review and not current_review:
            candidate_pred = current_pred
            changes = []
        else:
            candidate_pred, changes = answer_from_policy_rows(rows, selected_digits)
            if not candidate_pred:
                candidate_pred = current_pred
        split = str(rows[0].get("split") if rows else "unknown")
        family = layout_family(entry.get("layoutId"))

        for bucket in [
            buckets["overall"],
            buckets[family],
            by_layout[str(entry.get("layoutId") or "unknown")],
            by_split[split],
        ]:
            bucket_update(bucket, truth, expected, current_pred, current_review, candidate_pred)

        current_ok = current_pred == truth
        candidate_ok = candidate_pred == truth
        example = {
            "captureId": entry.get("captureId"),
            "layoutId": entry.get("layoutId"),
            "split": split,
            "questionLabel": entry.get("questionLabel"),
            "problem": entry.get("problem"),
            "expected": entry.get("expected"),
            "truth": entry.get("truth"),
            "currentPrediction": current_pred,
            "candidatePrediction": candidate_pred,
            "review": current_review,
            "changes": changes,
            "cropPath": entry.get("cropPath"),
        }
        if candidate_ok and not current_ok and len(examples["predictionRescued"]) < 40:
            examples["predictionRescued"].append(example)
        if current_ok and not candidate_ok and len(examples["predictionHarmed"]) < 40:
            examples["predictionHarmed"].append(example)
        if not current_review and not candidate_ok and len(examples["autoWrong"]) < 40:
            examples["autoWrong"].append(example)
        if current_review and candidate_ok and not current_ok and len(examples["yellowSuggestionRescued"]) < 40:
            examples["yellowSuggestionRescued"].append(example)
        if changes and len(examples["changed"]) < 60:
            examples["changed"].append(example)
        items.append({
            "key": key,
            "captureId": entry.get("captureId"),
            "layoutId": entry.get("layoutId"),
            "family": family,
            "split": split,
            "questionLabel": entry.get("questionLabel"),
            "problem": entry.get("problem"),
            "expected": expected,
            "truth": truth,
            "currentPrediction": current_pred,
            "candidatePrediction": candidate_pred,
            "review": current_review,
            "currentCorrect": current_ok,
            "candidateCorrect": candidate_ok,
            "predictionRescued": candidate_ok and not current_ok,
            "predictionHarmed": current_ok and not candidate_ok,
            "yellowSuggestionRescued": current_review and candidate_ok and not current_ok,
            "yellowSuggestionHarmed": current_review and current_ok and not candidate_ok,
            "autoHarmed": (not current_review) and current_ok and not candidate_ok,
            "autoRescued": (not current_review) and candidate_ok and not current_ok,
            "changed": bool(changes),
            "changes": changes,
            "cropPath": entry.get("cropPath"),
        })

    return {
        "missingRowGroups": missing_rows,
        "overall": add_percentages(buckets["overall"]),
        "byFamily": {
            "row": add_percentages(buckets["row"]),
            "non-row": add_percentages(buckets["non-row"]),
            "other": add_percentages(buckets["other"]),
        },
        "bySplit": {split: add_percentages(bucket) for split, bucket in sorted(by_split.items())},
        "byLayout": {layout: add_percentages(bucket) for layout, bucket in sorted(by_layout.items())},
        "applyOnlyReview": apply_only_review,
        "examples": examples,
        "items": items,
    }


def compact_strategy(report: dict[str, Any]) -> dict[str, Any]:
    overall = report["overall"]
    return {
        "answerCorrect": overall["answerCorrect"],
        "total": overall["total"],
        "answerAccuracyPct": overall["answerAccuracyPct"],
        "auto": overall["auto"],
        "autoCorrect": overall["autoCorrect"],
        "autoWrong": overall["autoWrong"],
        "autoAccuracyPct": overall["autoAccuracyPct"],
        "yellow": overall["yellow"],
        "yellowLeaningCorrect": overall["yellowLeaningCorrect"],
        "yellowLeaningMatchesTruthPct": overall["yellowLeaningMatchesTruthPct"],
        "predictionRescued": overall["predictionRescued"],
        "predictionHarmed": overall["predictionHarmed"],
        "autoRescued": overall["autoRescued"],
        "autoHarmed": overall["autoHarmed"],
        "yellowSuggestionRescued": overall["yellowSuggestionRescued"],
        "yellowSuggestionHarmed": overall["yellowSuggestionHarmed"],
    }


def main() -> None:
    args = parse_args()
    rows = read_json(Path(args.rows))
    truth_doc = read_json(Path(args.truth))
    entries = [
        entry for entry in truth_doc.get("entries", [])
        if entry.get("truthStatus") not in SKIP_TRUTH_STATUSES
    ]
    rows_by_question: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        rows_by_question[question_key(row.get("captureId"), row.get("questionLabel"))].append(row)

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
    selector = choose_l2_and_scores(items, seed=args.seed)
    selections = selected_digit_maps(selector)

    current = score_answer_strategy(entries, rows_by_question, None)
    selected_strategies: dict[str, dict[str, Any]] = {}
    for name, selected in selections.items():
        selected_strategies[name] = score_answer_strategy(entries, rows_by_question, selected)
        selected_strategies[f"{name}YellowOnly"] = score_answer_strategy(
            entries,
            rows_by_question,
            selected,
            apply_only_review=True,
        )
    strategies = {
        "current": current,
        **selected_strategies,
    }
    compact = {name: compact_strategy(report) for name, report in strategies.items()}

    report = {
        "generatedAt": datetime.datetime.now(datetime.UTC).isoformat(),
        "rows": str(Path(args.rows)),
        "truth": str(Path(args.truth)),
        "useAnswerKeyContext": bool(args.use_answer_key_context),
        "layoutFeatures": bool(args.layout_features),
        "truthEntryCount": len(entries),
        "digitItemCount": len(items),
        "modelPaths": [str(path) for path in model_paths],
        **collect_summary,
        **model_summary,
        "selector": {
            "selectedL2": selector["selectedL2"],
            "featureCounts": selector["featureCounts"],
            "gatedParams": selector["gatedParams"],
            "safetyGatedParams": selector["safetyGatedParams"],
            "gatedValidation": selector["gatedValidation"],
            "safetyGatedValidation": selector["safetyGatedValidation"],
        },
        "compact": compact,
        "strategies": strategies,
    }

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2))
    print(json.dumps({
        "out": str(out),
        "truthEntryCount": report["truthEntryCount"],
        "digitItemCount": report["digitItemCount"],
        "useAnswerKeyContext": report["useAnswerKeyContext"],
        "layoutFeatures": report["layoutFeatures"],
        "compact": compact,
        "skippedModels": report["skippedModels"],
    }, indent=2))


if __name__ == "__main__":
    main()
