#!/usr/bin/env python3
"""Experiment with OCR directly from saved raw answer-box crops.

This is intentionally separate from the production 28x28 model. It lets us test
whether using a larger, less-destructive crop representation would generalize to
new MacBook/iPad captures better than the current tensor path.
"""

from __future__ import annotations

import argparse
import base64
import glob
import io
import json
import math
import os
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image, ImageFilter, ImageOps
from torch.utils.data import DataLoader, TensorDataset


DEFAULT_PATTERN = str(Path.home() / "Downloads" / "scangrade-live-ocr-debug-*.json")
DEFAULT_EXCLUDED_IDS = {"1777087500592"}
DEFAULT_LATEST_HOLDOUT_IDS = {
    "1777290129497",
    "1777290161926",
    "1777290180431",
    "1777290209455",
}


@dataclass(frozen=True)
class Sample:
    image: np.ndarray
    label: int
    capture_id: str
    question: int


class RawCropCNN(nn.Module):
    def __init__(self, size: int) -> None:
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(1, 16, 3, padding=1),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),
            nn.Conv2d(16, 32, 3, padding=1),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),
            nn.Conv2d(32, 48, 3, padding=1),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),
        )
        side = size // 8
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(48 * side * side, 128),
            nn.ReLU(inplace=True),
            nn.Linear(128, 10),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.classifier(self.features(x))


def capture_id(path: str) -> str:
    return Path(path).stem.removeprefix("scangrade-live-ocr-debug-")


def decode_data_url(data_url: str) -> Image.Image:
    payload = data_url.split(",", 1)[1] if "," in data_url else data_url
    return Image.open(io.BytesIO(base64.b64decode(payload))).convert("L")


def preprocess_raw_crop(img: Image.Image, size: int) -> np.ndarray:
    # Keep more spatial detail than the production 28x28 path, while still
    # making pencil strokes bright-on-dark for the classifier.
    img = ImageOps.invert(img)
    img = img.filter(ImageFilter.MedianFilter(size=3))
    img = ImageOps.autocontrast(img, cutoff=1)
    img = img.resize((size, size), Image.Resampling.BILINEAR)
    arr = np.asarray(img, dtype=np.float32) / 255.0
    return arr


def load_samples(files: list[str], size: int, excluded_ids: set[str]) -> list[Sample]:
    samples: list[Sample] = []
    for file in files:
        cid = capture_id(file)
        if cid in excluded_ids:
            continue
        with open(file, "r", encoding="utf-8") as fh:
            debug = json.load(fh)
        answer_key = debug.get("answerKey") or [8, 4, 1, 9, 2, 7, 0, 5, 3, 6]
        crops = debug.get("rawCropDataUrls") or []
        if len(crops) < 10:
            continue
        for idx in range(10):
            samples.append(
                Sample(
                    image=preprocess_raw_crop(decode_data_url(crops[idx]), size=size),
                    label=int(answer_key[idx]),
                    capture_id=cid,
                    question=idx + 1,
                )
            )
    return samples


def augment_batch(x: torch.Tensor) -> torch.Tensor:
    n = x.shape[0]
    device = x.device
    angle = (torch.rand(n, device=device) - 0.5) * math.radians(8.0)
    scale = 0.92 + torch.rand(n, device=device) * 0.16
    tx = (torch.rand(n, device=device) - 0.5) * 0.10
    ty = (torch.rand(n, device=device) - 0.5) * 0.10
    theta = torch.zeros(n, 2, 3, device=device, dtype=x.dtype)
    theta[:, 0, 0] = torch.cos(angle) * scale
    theta[:, 0, 1] = -torch.sin(angle) * scale
    theta[:, 1, 0] = torch.sin(angle) * scale
    theta[:, 1, 1] = torch.cos(angle) * scale
    theta[:, 0, 2] = tx
    theta[:, 1, 2] = ty
    grid = F.affine_grid(theta, x.shape, align_corners=False)
    x = F.grid_sample(x, grid, mode="bilinear", padding_mode="zeros", align_corners=False)
    if torch.rand((), device=device) < 0.65:
        x = 0.65 * x + 0.35 * F.avg_pool2d(x, 3, stride=1, padding=1)
    contrast = 0.70 + torch.rand(n, 1, 1, 1, device=device) * 0.70
    fade = 0.65 + torch.rand(n, 1, 1, 1, device=device) * 0.50
    noise = torch.randn_like(x) * 0.025
    return torch.clamp(((x - 0.5) * contrast + 0.5) * fade + noise, 0.0, 1.0)


def make_tensor(samples: list[Sample]) -> tuple[torch.Tensor, torch.Tensor]:
    xs = torch.tensor(np.stack([s.image for s in samples]), dtype=torch.float32).unsqueeze(1)
    ys = torch.tensor([s.label for s in samples], dtype=torch.long)
    return xs, ys


def evaluate(model: nn.Module, samples: list[Sample], size: int, title: str) -> tuple[int, int]:
    if not samples:
        print(f"{title}: no samples")
        return 0, 0
    x, y = make_tensor(samples)
    model.eval()
    with torch.no_grad():
        probs = torch.softmax(model(x), dim=1)
        pred = probs.argmax(dim=1)
    correct = (pred == y).sum().item()
    total = y.numel()
    by_capture: dict[str, list[tuple[int, int, int, float]]] = {}
    for sample, p, yy, conf in zip(samples, pred.tolist(), y.tolist(), probs.max(dim=1).values.tolist(), strict=True):
        by_capture.setdefault(sample.capture_id, []).append((sample.question, yy, p, conf))
    print(f"{title}: {correct}/{total} ({correct / total:.2%})")
    for cid in sorted(by_capture):
        rows = by_capture[cid]
        got = [p for _q, _yy, p, _conf in sorted(rows)]
        score = sum(1 for _q, yy, p, _conf in rows if yy == p)
        min_conf = min(conf for _q, _yy, _p, conf in rows)
        print(f"  {cid}: {score}/10 pred={got} min_conf={min_conf:.3f}")
    return correct, total


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--size", type=int, default=56)
    parser.add_argument("--epochs", type=int, default=500)
    parser.add_argument("--seed", type=int, default=23)
    parser.add_argument("--holdout-latest", action="store_true")
    parser.add_argument("--pattern", default=DEFAULT_PATTERN)
    args = parser.parse_args()

    torch.manual_seed(args.seed)
    np.random.seed(args.seed)

    files = sorted(glob.glob(args.pattern))
    samples = load_samples(files, size=args.size, excluded_ids=DEFAULT_EXCLUDED_IDS)
    holdout_ids = DEFAULT_LATEST_HOLDOUT_IDS if args.holdout_latest else set()
    train_samples = [s for s in samples if s.capture_id not in holdout_ids]
    test_samples = [s for s in samples if s.capture_id in holdout_ids]
    if not test_samples:
        # Deterministic capture-level split for a quick generalization check.
        ids = sorted({s.capture_id for s in samples})
        holdout_ids = set(ids[-4:])
        train_samples = [s for s in samples if s.capture_id not in holdout_ids]
        test_samples = [s for s in samples if s.capture_id in holdout_ids]

    train_x, train_y = make_tensor(train_samples)
    loader = DataLoader(TensorDataset(train_x, train_y), batch_size=64, shuffle=True)
    model = RawCropCNN(size=args.size)
    opt = torch.optim.Adam(model.parameters(), lr=2e-3)

    for epoch in range(1, args.epochs + 1):
        model.train()
        for xb, yb in loader:
            xb = augment_batch(xb)
            opt.zero_grad()
            loss = F.cross_entropy(model(xb), yb)
            loss.backward()
            opt.step()
        if epoch == 1 or epoch % max(1, args.epochs // 5) == 0 or epoch == args.epochs:
            print(f"epoch {epoch:04d}/{args.epochs} loss={loss.item():.4f}", flush=True)

    print("")
    print(f"size={args.size} train_captures={len(set(s.capture_id for s in train_samples))} holdout={sorted(holdout_ids)}")
    evaluate(model, train_samples, args.size, "train")
    evaluate(model, test_samples, args.size, "holdout")


if __name__ == "__main__":
    main()
