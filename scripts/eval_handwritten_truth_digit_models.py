#!/usr/bin/env python3
"""Evaluate ONNX digit models against ScanGrade handwritten-truth slot labels."""

from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import onnxruntime as ort


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ROWS = PROJECT_ROOT / "private-evidence/reports/digit-failure-dataset-20260705-current/digit-rows.json"
DEFAULT_OUT = PROJECT_ROOT / "private-evidence/reports/digit-failure-dataset-20260705-current/model-eval-summary.json"
DEFAULT_MODELS = [
    "public/models/worksheet-digit-tony-generalist-noaug-20260601.onnx",
    "public/models/worksheet-digit-live-trusted-temp.onnx",
    "public/models/worksheet-digit-generalist.onnx",
    "public/models/worksheet-digit-tony-generalist-aug-strong-20260601.onnx",
    "public/models/worksheet-digit-tony-generalist-noaug-lite-20260601.onnx",
]

WEIGHTS = {
    "base": 1.0,
    "strict": 1.08,
    "edge-clean": 1.0,
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
    "base": ["base"],
    "cleanup-quad": ["strict", "edge-clean", "no-rule-cleanup", "no-component-cleanup"],
    "slot-family": ["gentle", "center-safe-slot", "expected-slot", "edge-band-slot", "wide-slot", "no-side-erase"],
    "expected-edge": ["expected-slot", "edge-band-slot"],
    "center-edge": ["center-safe-slot", "edge-band-slot"],
    "box-safe": ["center-safe-slot", "expected-slot", "edge-band-slot"],
    "all-weighted": None,
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rows", default=str(DEFAULT_ROWS))
    parser.add_argument("--out", default=str(DEFAULT_OUT))
    parser.add_argument("--model", action="append", default=[])
    parser.add_argument(
        "--label-sources",
        default="direct-length-match,inferred-from-app-slot-underscores",
        help="Comma-separated truthSlotSource values to include, or 'all'.",
    )
    return parser.parse_args()


def read_json(path: Path) -> object:
    return json.loads(path.read_text())


def unwrap_debug(raw: dict) -> dict:
    return raw.get("debug") if isinstance(raw.get("debug"), dict) else raw


def softmax(logits: np.ndarray) -> np.ndarray:
    logits = logits.astype(np.float32)
    logits -= np.max(logits, axis=1, keepdims=True)
    exp = np.exp(logits)
    return exp / np.sum(exp, axis=1, keepdims=True)


def top_gap(probs: np.ndarray) -> float:
    ranked = np.sort(probs)[::-1]
    return float(ranked[0] - ranked[1]) if len(ranked) > 1 else 1.0


def load_session(model_path: Path) -> ort.InferenceSession:
    return ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])


def model_probs(session: ort.InferenceSession, tensors: list[list[float]], batch: int = 512) -> list[np.ndarray]:
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name
    arr = np.asarray(tensors, dtype=np.float32).reshape((-1, 1, 28, 28))
    out: list[np.ndarray] = []
    for start in range(0, arr.shape[0], batch):
        logits = session.run([output_name], {input_name: arr[start:start + batch]})[0]
        out.extend(softmax(logits))
    return out


def avg_probs(variant_probs: dict[str, np.ndarray], names: list[str] | None) -> np.ndarray | None:
    selected = [(name, probs) for name, probs in variant_probs.items() if names is None or name in names]
    if not selected:
        return None
    summed = np.zeros(10, dtype=np.float32)
    total = 0.0
    for name, probs in selected:
        weight = WEIGHTS.get(name, 0.9)
        summed += probs * weight
        total += weight
    return summed / max(total, 1e-6)


def best_confidence_probs(variant_probs: dict[str, np.ndarray]) -> tuple[str | None, np.ndarray | None]:
    best_name = None
    best_probs = None
    best_conf = -1.0
    for name, probs in variant_probs.items():
        conf = float(np.max(probs))
        if conf > best_conf:
            best_name = name
            best_probs = probs
            best_conf = conf
    return best_name, best_probs


def classify(probs: np.ndarray | None) -> tuple[int | None, float, float]:
    if probs is None:
      return None, 0.0, 0.0
    digit = int(np.argmax(probs))
    return digit, float(np.max(probs)), top_gap(probs)


def row_allowed(row: dict, allowed_sources: set[str] | None) -> bool:
    if row.get("truthDigit") is None:
        return False
    if allowed_sources is None:
        return True
    return row.get("truthSlotSource") in allowed_sources


def collect_items(rows: list[dict], allowed_sources: set[str] | None) -> tuple[list[dict], dict[str, dict]]:
    debug_cache: dict[str, dict] = {}
    items: list[dict] = []
    skipped = Counter()
    for row in rows:
        if not row_allowed(row, allowed_sources):
            continue
        debug_path = row.get("debugPath")
        if not debug_path:
            skipped["missing-debug-path"] += 1
            continue
        if debug_path not in debug_cache:
            raw = read_json(PROJECT_ROOT / debug_path)
            debug_cache[debug_path] = unwrap_debug(raw)
        debug = debug_cache[debug_path]
        tensor_row = next(
            (candidate for candidate in debug.get("tensors", []) if int(candidate.get("id", -1)) == int(row.get("detailId", -2))),
            None,
        )
        if not tensor_row:
            skipped["missing-tensor-row"] += 1
            continue
        variants = []
        if isinstance(tensor_row.get("tensor"), list) and len(tensor_row["tensor"]) == 784:
            variants.append({"name": "base", "tensor": tensor_row["tensor"]})
        for variant in tensor_row.get("tensorVariants") or []:
            if isinstance(variant.get("tensor"), list) and len(variant["tensor"]) == 784:
                variants.append({"name": variant.get("name") or f"variant-{len(variants)}", "tensor": variant["tensor"]})
        if not variants:
            skipped["missing-variants"] += 1
            continue
        items.append({
            "row": row,
            "truth": int(row["truthDigit"]),
            "variants": variants,
        })
    return items, {"skipped": dict(skipped), "debugFileCount": len(debug_cache)}


def score_predictions(items: list[dict], item_probs: list[dict[str, np.ndarray]], model_id: str) -> dict:
    policies = dict(POLICIES)
    policies["best-confidence"] = ["__best_confidence__"]
    results = {}

    for policy_name, names in policies.items():
        correct = 0
        by_family = defaultdict(lambda: [0, 0])
        by_layout = defaultdict(lambda: [0, 0])
        by_slot = defaultdict(lambda: [0, 0])
        by_digit = defaultdict(lambda: [0, 0])
        confusions = Counter()
        confidence_correct = []
        confidence_wrong = []
        best_variant_names = Counter()

        for item, probs_by_name in zip(items, item_probs):
            if names == ["__best_confidence__"]:
                variant_name, probs = best_confidence_probs(probs_by_name)
                if variant_name:
                    best_variant_names[variant_name] += 1
            else:
                probs = avg_probs(probs_by_name, names)
            pred, conf, gap = classify(probs)
            truth = item["truth"]
            row = item["row"]
            ok = pred == truth
            correct += int(ok)
            if ok:
                confidence_correct.append(conf)
            else:
                confidence_wrong.append(conf)
                confusions[f"{truth}->{pred}"] += 1
            for bucket, key in [
                (by_family, row.get("family")),
                (by_layout, row.get("layoutId")),
                (by_slot, row.get("slotName")),
                (by_digit, str(truth)),
            ]:
                bucket[key][0] += int(ok)
                bucket[key][1] += 1

        total = len(items)
        results[policy_name] = {
            "model": model_id,
            "policy": policy_name,
            "correct": correct,
            "total": total,
            "accuracyPct": round(correct / max(total, 1) * 100, 1),
            "meanConfidenceCorrect": round(float(np.mean(confidence_correct)), 4) if confidence_correct else 0,
            "meanConfidenceWrong": round(float(np.mean(confidence_wrong)), 4) if confidence_wrong else 0,
            "byFamily": {key: {"correct": val[0], "total": val[1], "accuracyPct": round(val[0] / val[1] * 100, 1)} for key, val in sorted(by_family.items())},
            "byLayout": {key: {"correct": val[0], "total": val[1], "accuracyPct": round(val[0] / val[1] * 100, 1)} for key, val in sorted(by_layout.items())},
            "bySlot": {key: {"correct": val[0], "total": val[1], "accuracyPct": round(val[0] / val[1] * 100, 1)} for key, val in sorted(by_slot.items())},
            "byTruthDigit": {key: {"correct": val[0], "total": val[1], "accuracyPct": round(val[0] / val[1] * 100, 1)} for key, val in sorted(by_digit.items())},
            "confusions": [{"key": key, "count": count} for key, count in confusions.most_common(20)],
            "bestVariantNames": [{"key": key, "count": count} for key, count in best_variant_names.most_common(20)],
        }
    return results


def main(args: argparse.Namespace) -> None:
    rows = read_json(Path(args.rows))
    allowed_sources = None if args.label_sources == "all" else set(part.strip() for part in args.label_sources.split(",") if part.strip())
    items, collect_summary = collect_items(rows, allowed_sources)
    model_paths = [Path(model) for model in (args.model or DEFAULT_MODELS)]
    model_paths = [path if path.is_absolute() else PROJECT_ROOT / path for path in model_paths]

    all_tensors = []
    item_variant_ranges = []
    for item in items:
        start = len(all_tensors)
        all_tensors.extend(variant["tensor"] for variant in item["variants"])
        item_variant_ranges.append((start, len(all_tensors), [variant["name"] for variant in item["variants"]]))

    report = {
        "rows": str(Path(args.rows)),
        "labelSources": "all" if allowed_sources is None else sorted(allowed_sources),
        "itemCount": len(items),
        **collect_summary,
        "models": {},
        "topPolicies": [],
    }

    for model_path in model_paths:
        session = load_session(model_path)
        probs = model_probs(session, all_tensors)
        item_probs = []
        for start, end, names in item_variant_ranges:
            item_probs.append({name: probs[start + index] for index, name in enumerate(names)})
        model_id = model_path.name
        report["models"][model_id] = score_predictions(items, item_probs, model_id)

    for model_id, policies in report["models"].items():
        for policy_name, result in policies.items():
            report["topPolicies"].append({
                "model": model_id,
                "policy": policy_name,
                "correct": result["correct"],
                "total": result["total"],
                "accuracyPct": result["accuracyPct"],
            })
    report["topPolicies"].sort(key=lambda item: (-item["accuracyPct"], item["model"], item["policy"]))

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2))
    print(json.dumps({
        "out": str(out),
        "itemCount": report["itemCount"],
        "topPolicies": report["topPolicies"][:12],
    }, indent=2))


if __name__ == "__main__":
    main(parse_args())
