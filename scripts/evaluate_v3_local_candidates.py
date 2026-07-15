#!/usr/bin/env python3
"""Evaluate key-blind top-k candidates from compact larger-grayscale readers."""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from torch import nn


ROOT = Path(__file__).resolve().parents[1]
HEIGHT, WIDTH = 64, 192


class ExistingWholeAnswerNet(nn.Module):
    def __init__(self):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(1, 32, 3, padding=1), nn.BatchNorm2d(32), nn.ReLU(),
            nn.Conv2d(32, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(32, 64, 3, padding=1), nn.BatchNorm2d(64), nn.ReLU(),
            nn.Conv2d(64, 64, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(64, 96, 3, padding=1), nn.BatchNorm2d(96), nn.ReLU(), nn.MaxPool2d(2),
            nn.AdaptiveAvgPool2d((4, 12)),
        )
        self.shared = nn.Sequential(nn.Flatten(), nn.Linear(96 * 4 * 12, 256), nn.ReLU(), nn.Dropout(0.18))
        self.length_head = nn.Linear(256, 2)
        self.tens_head = nn.Linear(256, 10)
        self.ones_head = nn.Linear(256, 10)

    def forward(self, images):
        features = self.shared(self.features(images))
        return self.length_head(features), self.tens_head(features), self.ones_head(features)


class SyntheticWholeAnswerNet(nn.Module):
    def __init__(self):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(1, 32, 3, padding=1), nn.BatchNorm2d(32), nn.SiLU(),
            nn.Conv2d(32, 32, 3, padding=1), nn.SiLU(), nn.MaxPool2d(2),
            nn.Conv2d(32, 64, 3, padding=1), nn.BatchNorm2d(64), nn.SiLU(),
            nn.Conv2d(64, 64, 3, padding=1), nn.SiLU(), nn.MaxPool2d(2),
            nn.Conv2d(64, 96, 3, padding=1), nn.BatchNorm2d(96), nn.SiLU(),
            nn.Conv2d(96, 96, 3, padding=1), nn.SiLU(), nn.MaxPool2d(2),
            nn.AdaptiveAvgPool2d((4, 12)),
        )
        self.shared = nn.Sequential(nn.Flatten(), nn.Linear(96 * 4 * 12, 320), nn.SiLU(), nn.Dropout(0.16))
        self.length_head = nn.Linear(320, 2)
        self.tens_head = nn.Linear(320, 10)
        self.ones_head = nn.Linear(320, 10)

    def forward(self, images):
        features = self.shared(self.features(images))
        return self.length_head(features), self.tens_head(features), self.ones_head(features)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--architecture", choices=("existing", "synthetic"), required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--top-k", type=int, default=5)
    return parser.parse_args()


def resolve(path):
    return path if path.is_absolute() else ROOT / path


def prepare(path):
    image = Image.open(resolve(Path(path))).convert("L")
    scale = min(WIDTH / image.width, HEIGHT / image.height)
    resized = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), Image.Resampling.BILINEAR)
    canvas = Image.new("L", (WIDTH, HEIGHT), 255)
    canvas.paste(resized, ((WIDTH - resized.width) // 2, (HEIGHT - resized.height) // 2))
    return torch.from_numpy((1.0 - np.asarray(canvas, dtype=np.float32) / 255.0).astype(np.float32)).unsqueeze(0)


def candidate_rows(outputs, top_k):
    length, tens, ones = (value.softmax(-1)[0] for value in outputs)
    candidates = []
    for digit in range(10):
        components = [float(length[0]), float(ones[digit])]
        candidates.append({"read": str(digit), "jointProbability": components[0] * components[1], "minComponentProbability": min(components)})
    for left in range(1, 10):
        for right in range(10):
            components = [float(length[1]), float(tens[left]), float(ones[right])]
            candidates.append({"read": f"{left}{right}", "jointProbability": components[0] * components[1] * components[2], "minComponentProbability": min(components)})
    candidates.sort(key=lambda row: (row["jointProbability"], row["minComponentProbability"]), reverse=True)
    normalized = [{**row, "jointProbability": round(row["jointProbability"], 8), "minComponentProbability": round(row["minComponentProbability"], 6)} for row in candidates]
    return (
        normalized[:top_k],
        next(row for row in normalized if len(row["read"]) == 1),
        next(row for row in normalized if len(row["read"]) == 2),
    )


def summarize(rows):
    output = {"total": len(rows)}
    for k in range(1, 6):
        output[f"truthInTop{k}"] = sum(row["truth"] in [candidate["read"] for candidate in row["candidates"][:k]] for row in rows)
    return output


def main():
    opts = parse_args()
    source = json.loads(resolve(opts.manifest).read_text())
    entries = [entry for entry in source["entries"] if str(entry.get("truth", "")).isdigit() and 1 <= len(str(entry["truth"])) <= 2 and entry.get("truthState") != "overwritten"]
    model = ExistingWholeAnswerNet() if opts.architecture == "existing" else SyntheticWholeAnswerNet()
    checkpoint = torch.load(resolve(opts.model), map_location="cpu", weights_only=False)
    model.load_state_dict(checkpoint.get("state_dict", checkpoint))
    model.eval()
    rows = []
    with torch.inference_mode():
        for entry in entries:
            image_path = entry.get("recognitionPath") or entry.get("imagePath")
            candidates, best_single, best_double = candidate_rows(model(prepare(image_path).unsqueeze(0)), opts.top_k)
            rows.append({
                "uid": entry.get("uid"), "packetId": entry.get("packetId"), "captureId": entry.get("captureId"),
                "layoutId": entry.get("layoutId"), "questionNum": entry.get("questionNum"), "split": entry.get("split"),
                "truthStatus": entry.get("truthStatus"), "truth": str(entry["truth"]), "candidates": candidates,
                "bestSingleDigit": best_single, "bestTwoDigit": best_double,
            })
    by_split = defaultdict(list)
    for row in rows:
        by_split[row.get("split")].append(row)
    report = {
        "schemaVersion": 1, "answerKeyProvidedToModel": False, "model": str(opts.model), "architecture": opts.architecture,
        "manifest": str(opts.manifest), "topK": opts.top_k, "overall": summarize(rows),
        "bySplit": {key: summarize(value) for key, value in sorted(by_split.items())}, "rows": rows,
    }
    opts.out.parent.mkdir(parents=True, exist_ok=True)
    opts.out.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"destination": str(opts.out), "overall": report["overall"], "bySplit": report["bySplit"]}, indent=2))


if __name__ == "__main__":
    main()
