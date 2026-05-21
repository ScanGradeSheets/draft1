#!/usr/bin/env python3
"""Replay saved ScanGrade live-camera OCR debug tensors against the PyTorch checkpoint."""

from __future__ import annotations

import argparse
import glob
import json
import os
from pathlib import Path

import torch

from train_worksheet_digits import WorksheetDigitCNN, WorksheetDigitMLP, WorksheetDigitWideCNN


DEFAULT_PATTERN = "/Users/teecush/Downloads/scangrade-live-ocr-debug-*.json"
DEFAULT_CHECKPOINT = "models/worksheet-digit-cnn.pt"
DEFAULT_EXCLUDED_IDS = {"1777087500592"}


def debug_id(path: str) -> str:
    name = Path(path).stem
    return name.removeprefix("scangrade-live-ocr-debug-")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Replay saved live OCR debug tensors.")
    parser.add_argument("files", nargs="*", help="Debug JSON files. Defaults to Downloads glob.")
    parser.add_argument("--checkpoint", default=DEFAULT_CHECKPOINT, help="PyTorch checkpoint path")
    parser.add_argument(
        "--include-known-bad",
        action="store_true",
        help="Include captures that are known to be too low-quality to grade.",
    )
    return parser.parse_args()


def build_model(checkpoint: dict) -> torch.nn.Module:
    arch = checkpoint.get("arch", "WorksheetDigitCNN")
    hidden_dim = int(checkpoint.get("hidden_dim", 512) or 512)
    if arch == "WorksheetDigitMLP":
        return WorksheetDigitMLP(hidden_dim=hidden_dim)
    if arch == "WorksheetDigitWideCNN":
        return WorksheetDigitWideCNN()
    return WorksheetDigitCNN()


def main() -> None:
    args = parse_args()
    files = sorted(args.files or glob.glob(DEFAULT_PATTERN))
    excluded_ids = set() if args.include_known_bad else DEFAULT_EXCLUDED_IDS

    checkpoint = torch.load(args.checkpoint, map_location="cpu", weights_only=False)
    model = build_model(checkpoint)
    model.load_state_dict(checkpoint["state_dict"])
    model.eval()

    rows = []
    correct_cells = 0
    total_cells = 0
    perfect = 0
    skipped = 0

    for file in files:
        did = debug_id(file)
        if did in excluded_ids:
            skipped += 1
            rows.append((os.path.basename(file), "SKIP", "known_bad_capture", None, None))
            continue

        with open(file, "r", encoding="utf-8") as fh:
            debug = json.load(fh)
        tensors = debug.get("tensors") or []
        answer_key = debug.get("answerKey") or [8, 4, 1, 9, 2, 7, 0, 5, 3, 6]
        if len(tensors) < 10:
            skipped += 1
            rows.append((os.path.basename(file), "SKIP", "missing_tensors", None, None))
            continue

        xs = torch.tensor([item["tensor"] for item in tensors[:10]], dtype=torch.float32).view(-1, 1, 28, 28)
        with torch.no_grad():
            probs = torch.softmax(model(xs), dim=1)
            preds = probs.argmax(dim=1).tolist()
            min_conf = float(probs.max(dim=1).values.min().item())

        correct = sum(int(pred == expected) for pred, expected in zip(preds, answer_key))
        correct_cells += correct
        total_cells += len(answer_key)
        perfect += int(correct == len(answer_key))
        rows.append((os.path.basename(file), f"{correct}/10", preds, min_conf, answer_key))

    for name, score, detail, min_conf, _answer_key in rows:
        if score == "SKIP":
            print(f"{name}: SKIP {detail}")
        else:
            print(f"{name}: {score} pred={detail} min_conf={min_conf:.3f}")

    accuracy = correct_cells / total_cells if total_cells else 0.0
    tested = len(files) - skipped
    print("")
    print(f"Tested captures: {tested}")
    print(f"Skipped captures: {skipped}")
    print(f"Perfect captures: {perfect}/{tested}")
    print(f"Cell accuracy: {correct_cells}/{total_cells} ({accuracy:.2%})")

    if tested and (perfect != tested or correct_cells != total_cells):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
