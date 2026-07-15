#!/usr/bin/env python3
"""Evaluate ScanGrade live OCR tensor exports without launching a browser.

This is intentionally a model/variant bake-off helper. It reads the downloaded
`scangrade-live-ocr-debug-*.json` files, runs ONNX models directly on the
exported 28x28 tensors, and scores simple slot/variant policies against either
the answer key or Tony's saved/manual predictions.
"""

from __future__ import annotations

import argparse
import glob
import json
import math
from collections import Counter
from pathlib import Path

import numpy as np
import onnxruntime as ort


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MODELS = [
    "public/models/worksheet-digit-tony-generalist-aug-strong-noaug-touch-20260601.onnx",
    "public/models/worksheet-digit-generalist.onnx",
    "public/models/worksheet-digit-live-trusted-temp.onnx",
    "public/models/worksheet-digit-live-manual-temp.onnx",
    "public/models/worksheet-digit-tony-generalist-aug-strong-20260601.onnx",
    "public/models/worksheet-digit-tony-generalist-extra-20260601.onnx",
    "public/models/worksheet-digit-tony-generalist-noaug-20260601.onnx",
    "public/models/worksheet-digit-tony-generalist-noaug-lite-20260601.onnx",
    "public/models/worksheet-digit-generalist-final.onnx",
    "public/models/worksheet-digit-wide-cnn-local-rerun.onnx",
]

WEIGHTS = {
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
    parser.add_argument("files", nargs="+", help="Debug JSON files or globs")
    parser.add_argument("--model", action="append", default=[], help="ONNX model path, repeatable")
    parser.add_argument("--label-mode", choices=["answerKey", "savedPredictions", "trusted"], default="savedPredictions")
    parser.add_argument("--dump-items", default="", help="Optional output JSON with per-item model/policy details")
    parser.add_argument("--top", type=int, default=30)
    return parser.parse_args()


def expand_files(patterns: list[str]) -> list[Path]:
    out: list[Path] = []
    for pattern in patterns:
        matches = [Path(p) for p in glob.glob(pattern)]
        out.extend(matches if matches else [Path(pattern)])
    return sorted(dict.fromkeys(out))


def softmax(logits: np.ndarray) -> np.ndarray:
    logits = logits.astype(np.float32)
    logits -= np.max(logits, axis=1, keepdims=True)
    exp = np.exp(logits)
    return exp / np.sum(exp, axis=1, keepdims=True)


def top_gap(probs: np.ndarray) -> float:
    ranked = np.sort(probs)[::-1]
    return float(ranked[0] - ranked[1]) if len(ranked) > 1 else 1.0


def is_manual(prediction: dict | None) -> bool:
    return bool(prediction and (prediction.get("manualCorrected") or "originalDigit" in prediction))


def item_label(answer_key: int | None, prediction: dict | None, mode: str) -> tuple[int | None, bool]:
    saved = prediction.get("digit") if isinstance(prediction, dict) else None
    manual = is_manual(prediction)
    if mode == "answerKey":
        return int(answer_key) if answer_key is not None else None, manual
    if mode == "savedPredictions":
        return int(saved) if isinstance(saved, int) else None, manual
    if mode == "trusted":
        if isinstance(saved, int) and manual:
            return int(saved), manual
        if isinstance(saved, int) and answer_key is not None and int(saved) == int(answer_key):
            return int(answer_key), manual
        return None, manual
    raise ValueError(mode)


def load_items(files: list[Path], label_mode: str) -> list[dict]:
    items: list[dict] = []
    for file in files:
        debug = json.loads(file.read_text())
        answer_key = debug.get("answerKey") or []
        predictions = debug.get("predictions") or []
        tensors = debug.get("tensors") or []
        for index, tensor_row in enumerate(tensors):
            label, manual = item_label(
                answer_key[index] if index < len(answer_key) else None,
                predictions[index] if index < len(predictions) else None,
                label_mode,
            )
            if label is None:
                continue
            variants = []
            if isinstance(tensor_row.get("tensor"), list) and len(tensor_row["tensor"]) == 784:
                variants.append({"name": "base", "tensor": tensor_row["tensor"]})
            for variant in tensor_row.get("tensorVariants") or []:
                if isinstance(variant.get("tensor"), list) and len(variant["tensor"]) == 784:
                    variants.append({"name": variant.get("name") or f"variant-{len(variants)}", "tensor": variant["tensor"]})
            if not variants:
                continue
            items.append({
                "file": file.name,
                "index": index + 1,
                "questionNum": tensor_row.get("questionNum"),
                "digitIndex": tensor_row.get("digitIndex"),
                "expected": label,
                "manual": manual,
                "variants": variants,
            })
    return items


def load_session(path: Path) -> ort.InferenceSession:
    return ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])


def model_probs(session: ort.InferenceSession, tensors: list[list[float]], batch: int = 512) -> list[np.ndarray]:
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name
    out: list[np.ndarray] = []
    arr = np.asarray(tensors, dtype=np.float32).reshape((-1, 1, 28, 28))
    for start in range(0, arr.shape[0], batch):
        logits = session.run([output_name], {input_name: arr[start:start + batch]})[0]
        out.extend(softmax(logits))
    return out


def average_probs(variant_probs: dict[str, np.ndarray], names: list[str] | None, weighted: bool = True) -> np.ndarray | None:
    selected = [(name, probs) for name, probs in variant_probs.items() if names is None or name in names]
    if not selected:
        return None
    summed = np.zeros(10, dtype=np.float32)
    total = 0.0
    for name, probs in selected:
        weight = WEIGHTS.get(name, 0.9) if weighted else 1.0
        summed += probs * weight
        total += weight
    return summed / max(total, 1e-6)


def digit_from_probs(probs: np.ndarray | None) -> int | None:
    if probs is None:
        return None
    return int(np.argmax(probs))


def score(items: list[dict], choices: list[int | None]) -> dict:
    total = len(items)
    correct = 0
    non_manual_total = 0
    non_manual_correct = 0
    confusion = Counter()
    misses = []
    for item, choice in zip(items, choices):
        if choice is None:
            choice = -1
        ok = int(choice) == int(item["expected"])
        correct += int(ok)
        if not item.get("manual"):
            non_manual_total += 1
            non_manual_correct += int(ok)
        if not ok:
            confusion[f"{item['expected']}->{choice}"] += 1
            if len(misses) < 80:
                misses.append({
                    "file": item["file"],
                    "index": item["index"],
                    "questionNum": item["questionNum"],
                    "digitIndex": item["digitIndex"],
                    "expected": item["expected"],
                    "predicted": choice,
                    "manual": item["manual"],
                })
    return {
        "correct": correct,
        "total": total,
        "nonManualCorrect": non_manual_correct,
        "nonManualTotal": non_manual_total,
        "confusion": confusion.most_common(12),
        "misses": misses,
    }


def policy_choices(items: list[dict], item_probs: list[dict[str, np.ndarray]]) -> dict[str, list[int | None]]:
    choices: dict[str, list[int | None]] = {}
    for name, variants in POLICIES.items():
        choices[name] = [digit_from_probs(average_probs(probs, variants)) for probs in item_probs]

    for variant_name in sorted({variant["name"] for item in items for variant in item["variants"]}):
        choices[f"variant:{variant_name}"] = [
            digit_from_probs(probs.get(variant_name)) if variant_name in probs else None
            for probs in item_probs
        ]

    choices["slot-mixed-clean-left-slot-right"] = [
        digit_from_probs(average_probs(
            probs,
            POLICIES["cleanup-quad"] if item.get("digitIndex") == 0 else POLICIES["slot-family"],
        ))
        for item, probs in zip(items, item_probs)
    ]
    choices["slot-mixed-box-left-slot-right"] = [
        digit_from_probs(average_probs(
            probs,
            POLICIES["box-safe"] if item.get("digitIndex") == 0 else POLICIES["slot-family"],
        ))
        for item, probs in zip(items, item_probs)
    ]
    choices["slot-mixed-gentle-left-slot-right"] = [
        digit_from_probs(average_probs(
            probs,
            POLICIES["gentle-center"] if item.get("digitIndex") == 0 else POLICIES["slot-family"],
        ))
        for item, probs in zip(items, item_probs)
    ]
    return choices


def main() -> int:
    args = parse_args()
    files = expand_files(args.files)
    models = [Path(model) for model in (args.model or DEFAULT_MODELS)]
    models = [model if model.is_absolute() else PROJECT_ROOT / model for model in models]
    items = load_items(files, args.label_mode)
    print(f"Loaded {len(items)} labeled digits from {len(files)} files, label={args.label_mode}")
    if not items:
        return 2

    flat_tensors = []
    item_variant_names: list[list[str]] = []
    for item in items:
        names = []
        for variant in item["variants"]:
            names.append(variant["name"])
            flat_tensors.append(variant["tensor"])
        item_variant_names.append(names)

    results = []
    dump = []
    for model_path in models:
        if not model_path.exists():
            print(f"skip missing {model_path}")
            continue
        session = load_session(model_path)
        probs_flat = model_probs(session, flat_tensors)
        item_probs: list[dict[str, np.ndarray]] = []
        cursor = 0
        for names in item_variant_names:
            row = {}
            for name in names:
                row[name] = probs_flat[cursor]
                cursor += 1
            item_probs.append(row)
        choices_by_policy = policy_choices(items, item_probs)
        for policy, choices in choices_by_policy.items():
            scored = score(items, choices)
            results.append({
                "model": model_path.name,
                "policy": policy,
                **scored,
            })
        if args.dump_items:
            for item, probs in zip(items, item_probs):
                dump.append({
                    **{k: item[k] for k in ["file", "index", "questionNum", "digitIndex", "expected", "manual"]},
                    "model": model_path.name,
                    "variants": {
                        name: {
                            "digit": int(np.argmax(prob)),
                            "confidence": float(np.max(prob)),
                            "gap": top_gap(prob),
                            "probs": [float(value) for value in prob],
                            "top3": [
                                {"digit": int(d), "confidence": float(prob[d])}
                                for d in np.argsort(prob)[::-1][:3]
                            ],
                        }
                        for name, prob in probs.items()
                    }
                })

    results.sort(key=lambda row: (row["correct"], row["nonManualCorrect"]), reverse=True)
    for row in results[:args.top]:
        nm = f"{row['nonManualCorrect']}/{row['nonManualTotal']}"
        print(
            f"{row['correct']}/{row['total']} nonmanual={nm} "
            f"{row['model']} {row['policy']} confusions={row['confusion'][:5]}"
        )
    if args.dump_items:
        Path(args.dump_items).write_text(json.dumps(dump, indent=2))
        print(f"wrote {args.dump_items}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
