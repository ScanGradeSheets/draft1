#!/usr/bin/env python3
"""
Verify ONNX model with the same 28x28 tensors the browser uses.
Run after exporting tensors from the app (npx playwright test export-crops-debug.spec.js -g "export tensors").
Usage: python scripts/verify_onnx_python.py
"""
import argparse
import json
import os
import sys
import numpy as np
import onnxruntime as ort

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TENSORS_PATH = os.path.join(PROJECT_ROOT, "debug-tensors.json")
MODEL_PATH = os.path.join(PROJECT_ROOT, "public", "models", "mnist-model.onnx")
ANSWER_KEY = [7, 2, 9, 3, 5, 1, 8, 4, 6, 0]


def softmax(x):
    e = np.exp(x - np.max(x))
    return e / e.sum()


def run_first_tensor_debug():
    """Print first tensor input stats and raw logits for browser comparison."""
    if not os.path.isfile(TENSORS_PATH):
        print(f"Missing {TENSORS_PATH}", file=sys.stderr)
        return 1
    if not os.path.isfile(MODEL_PATH):
        print(f"Missing {MODEL_PATH}", file=sys.stderr)
        return 1
    with open(TENSORS_PATH) as f:
        data = json.load(f)
    first = next(item for item in sorted(data, key=lambda x: x["id"]) if item["id"] == 0)
    t = np.array(first["tensor"], dtype=np.float32)
    print("Python first tensor (id=0) input min:", float(np.min(t)), "max:", float(np.max(t)), "mean:", float(np.mean(t)))
    session = ort.InferenceSession(MODEL_PATH, providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name
    arr = t.reshape(1, 1, 28, 28)
    logits = session.run([output_name], {input_name: arr})[0][0]
    print("Python first tensor raw logits (length 10):", json.dumps([float(x) for x in logits]))
    return 0


def main():
    if not os.path.isfile(TENSORS_PATH):
        print(f"Missing {TENSORS_PATH}. Run: npx playwright test export-crops-debug.spec.js -g 'export tensors'")
        return 1
    if not os.path.isfile(MODEL_PATH):
        print(f"Missing {MODEL_PATH}")
        return 1

    with open(TENSORS_PATH) as f:
        data = json.load(f)
    tensors = [item["tensor"] for item in sorted(data, key=lambda x: x["id"])]
    if len(tensors) != 10:
        print(f"Expected 10 tensors, got {len(tensors)}")
        return 1

    session = ort.InferenceSession(MODEL_PATH, providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name

    predictions = []
    for i, t in enumerate(tensors):
        arr = np.array(t, dtype=np.float32).reshape(1, 1, 28, 28)
        logits = session.run([output_name], {input_name: arr})[0][0]
        probs = softmax(logits)
        digit = int(np.argmax(probs))
        conf = float(probs[digit])
        predictions.append(digit)
        correct = "✓" if digit == ANSWER_KEY[i] else "✗"
        print(f"  Box {i}: predicted={digit}, confidence={conf:.2%}, expected={ANSWER_KEY[i]} {correct}")

    print()
    print(f"Python predictions: {predictions}")
    print(f"Expected (answer_key): {ANSWER_KEY}")
    match = sum(1 for a, b in zip(predictions, ANSWER_KEY) if a == b)
    print(f"Match: {match}/10")
    varied = len(set(predictions)) > 2
    if varied:
        print("→ Python inference works (varied predictions, not all same digit); browser ONNX path is the blocker.")
    elif match >= 8:
        print("→ Python inference works; browser path is the blocker.")
    else:
        print("→ Python also wrong; model file or input format may be the issue.")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Verify ONNX on exported tensors")
    parser.add_argument("--first-only", action="store_true", help="Print first tensor input stats and logits for browser comparison")
    args = parser.parse_args()
    if args.first_only:
        exit(run_first_tensor_debug())
    exit(main())
