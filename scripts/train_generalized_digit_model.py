#!/usr/bin/env python3
"""Train a generalized handwritten digit model for ScanGrade.

This script intentionally separates model selection from the older
worksheet-only recipe. It trains on:

  - allowed worksheet raw answer-box crops,
  - MNIST,
  - EMNIST Digits,

and evaluates on an internal worksheet validation split plus the separately
provided strict holdout crops when available. The holdout paths are read-only
evaluation inputs and are never added to the training set.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import random
import re
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image, ImageOps
from torch.utils.data import DataLoader, TensorDataset
from torchvision import datasets


PROJECT_ROOT = Path(__file__).resolve().parents[1]
ANSWER_KEY = [8, 4, 1, 9, 2, 7, 0, 5, 3, 6]
DEFAULT_WORKSHEET_SOURCES = [
    PROJECT_ROOT / "datasets" / "worksheet_digits_current_pipeline" / "debug",
    PROJECT_ROOT / "benchmarks" / "uploaded_student_samples" / "results-student-bakeoff-final-default" / "debug",
    PROJECT_ROOT / "benchmarks" / "worksheet_bakeoff" / "results-final-default-debug" / "debug",
]
DEFAULT_HOLDOUT_DEBUG = PROJECT_ROOT / "benchmarks" / "holdout_student_samples_2026-05-15" / "results" / "debug"
DEFAULT_EXTERNAL_ROOT = PROJECT_ROOT / "datasets" / "external"
DEFAULT_ONNX_OUT = PROJECT_ROOT / "public" / "models" / "worksheet-digit-generalist.onnx"
DEFAULT_CHECKPOINT_OUT = PROJECT_ROOT / "models" / "worksheet-digit-generalist.pt"
DEFAULT_METADATA_OUT = PROJECT_ROOT / "models" / "worksheet-digit-generalist-metadata.json"
DEFAULT_INTERNAL_VAL_GROUPS = {
    "AFAA58CF-6-Photo-6",
    "AFAA58CF-9-Photo-9",
    "F0613532-7-Photo-7",
    "71D954DC-5-Photo-5",
    "71D954DC-8-Photo-8",
}
STRICT_HOLDOUT_TOKEN = "7DE72F2C"


@dataclass(frozen=True)
class WorksheetSample:
    image: np.ndarray
    label: int
    group: str
    name: str
    source: str


@dataclass
class EvalStats:
    correct: int
    total: int
    accuracy: float
    confusions: list[dict]
    misses: list[dict]


class ScanGradeDigitCNN(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(1, 32, 3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.Conv2d(32, 32, 3, padding=1),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),
            nn.Conv2d(32, 64, 3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.Conv2d(64, 64, 3, padding=1),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),
            nn.Conv2d(64, 96, 3, padding=1),
            nn.BatchNorm2d(96),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),
        )
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(96 * 3 * 3, 192),
            nn.ReLU(inplace=True),
            nn.Dropout(p=0.15),
            nn.Linear(192, 10),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.classifier(self.features(x))


def percentile(values: np.ndarray, p: float) -> float:
    if values.size == 0:
        return 0.0
    return float(np.quantile(values, p, method="nearest"))


def remove_long_edge_lines(ink: np.ndarray) -> np.ndarray:
    out = ink.copy()
    h, w = out.shape
    threshold = 0.35
    row_limit = w * 0.55
    col_limit = h * 0.55
    for y in range(h):
        count = int(np.count_nonzero(out[y, :] > threshold))
        if count >= row_limit and (y < h * 0.18 or y > h * 0.82):
            out[max(0, y - 1):min(h, y + 2), :] = 0.0
    for x in range(w):
        count = int(np.count_nonzero(out[:, x] > threshold))
        if count >= col_limit and (x < w * 0.18 or x > w * 0.82):
            out[:, max(0, x - 1):min(w, x + 2)] = 0.0
    return out


def center_ink_to_28(ink: np.ndarray, threshold: float = 0.16, target_extent: float = 20.0) -> np.ndarray:
    h, w = ink.shape
    ys, xs = np.nonzero(ink > threshold)
    out = np.zeros((28, 28), dtype=np.float32)
    if xs.size == 0:
        return out

    min_x, max_x = int(xs.min()), int(xs.max())
    min_y, max_y = int(ys.min()), int(ys.max())
    box_w = max_x - min_x + 1
    box_h = max_y - min_y + 1
    pad_x = max(2, round(box_w * 0.18))
    pad_y = max(2, round(box_h * 0.18))
    min_x = max(0, min_x - pad_x)
    max_x = min(w - 1, max_x + pad_x)
    min_y = max(0, min_y - pad_y)
    max_y = min(h - 1, max_y + pad_y)
    box_w = max_x - min_x + 1
    box_h = max_y - min_y + 1
    scale = min(target_extent / box_w, target_extent / box_h)
    draw_w = max(1.0, box_w * scale)
    draw_h = max(1.0, box_h * scale)
    offset_x = (28.0 - draw_w) / 2.0
    offset_y = (28.0 - draw_h) / 2.0

    for oy in range(28):
        for ox in range(28):
            sx = min_x + (ox + 0.5 - offset_x) / scale
            sy = min_y + (oy + 0.5 - offset_y) / scale
            if sx < min_x or sx > max_x or sy < min_y or sy > max_y:
                continue
            x0 = int(np.clip(math.floor(sx), 0, w - 1))
            y0 = int(np.clip(math.floor(sy), 0, h - 1))
            x1 = min(w - 1, x0 + 1)
            y1 = min(h - 1, y0 + 1)
            fx = sx - x0
            fy = sy - y0
            out[oy, ox] = (
                ink[y0, x0] * (1 - fx) * (1 - fy)
                + ink[y0, x1] * fx * (1 - fy)
                + ink[y1, x0] * (1 - fx) * fy
                + ink[y1, x1] * fx * fy
            )
    return np.clip(out, 0.0, 1.0)


def worksheet_crop_to_tensor(path: Path) -> np.ndarray:
    img = Image.open(path).convert("RGB")
    arr = np.asarray(img, dtype=np.float32)
    r = arr[:, :, 0]
    g = arr[:, :, 1]
    b = arr[:, :, 2]
    maxc = np.maximum(np.maximum(r, g), b)
    minc = np.minimum(np.minimum(r, g), b)
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    sat = maxc - minc
    bg = percentile(lum.reshape(-1), 0.82)
    darkness = np.maximum(0.0, bg - lum) + np.maximum(0.0, sat - 18.0) * 0.25
    positives = darkness[darkness > 2.0]
    scale = max(10.0, percentile(positives, 0.96))
    ink = np.clip(darkness / scale, 0.0, 1.0).astype(np.float32)
    h, w = ink.shape
    if h >= 5 and w >= 5:
        edge = np.zeros_like(ink, dtype=bool)
        edge[:2, :] = True
        edge[-2:, :] = True
        edge[:, :2] = True
        edge[:, -2:] = True
        ink[edge & (ink > 0.75)] = 0.0
    ink = remove_long_edge_lines(ink)
    return center_ink_to_28(ink)


def external_digit_to_tensor(img: Image.Image, source: str) -> np.ndarray:
    if source == "emnist":
        img = ImageOps.mirror(img.rotate(-90, expand=False))
    img = img.convert("L").resize((28, 28), Image.Resampling.BILINEAR)
    arr = np.asarray(img, dtype=np.float32) / 255.0
    if arr.max() > 1e-6:
        arr = arr / arr.max()
    return arr.astype(np.float32)


def sheet_group_from_path(path: Path) -> str:
    return path.parent.name


def question_from_path(path: Path) -> int | None:
    match = re.search(r"raw-q(\d+)\.png$", path.name)
    if not match:
        return None
    q = int(match.group(1))
    return q if 1 <= q <= 10 else None


def load_worksheet_samples(source_roots: list[Path], excluded_token: str = STRICT_HOLDOUT_TOKEN) -> list[WorksheetSample]:
    samples: list[WorksheetSample] = []
    seen: set[tuple[str, int, str]] = set()
    for root in source_roots:
        if not root.exists():
            continue
        for file in sorted(root.glob("**/raw-q*.png")):
            if excluded_token and excluded_token in str(file):
                continue
            q = question_from_path(file)
            if q is None:
                continue
            group = sheet_group_from_path(file)
            key = (group, q, str(root))
            if key in seen:
                continue
            seen.add(key)
            label = ANSWER_KEY[q - 1]
            samples.append(
                WorksheetSample(
                    image=worksheet_crop_to_tensor(file),
                    label=label,
                    group=group,
                    name=f"{group}-q{q}",
                    source=str(root.relative_to(PROJECT_ROOT) if file.is_relative_to(PROJECT_ROOT) else root),
                )
            )
    return samples


def load_external_balanced(root: Path, per_digit: int, seed: int) -> tuple[np.ndarray, np.ndarray, dict]:
    rng = random.Random(seed)
    arrays: list[np.ndarray] = []
    labels: list[int] = []
    counts = {"mnist": 0, "emnist": 0}

    def add_dataset(dataset, source: str, limit_per_digit: int) -> None:
        by_label: dict[int, list[int]] = {d: [] for d in range(10)}
        for idx in range(len(dataset)):
            _img, label = dataset[idx]
            label = int(label)
            if 0 <= label <= 9:
                by_label[label].append(idx)
        for digit in range(10):
            idxs = by_label[digit]
            rng.shuffle(idxs)
            for idx in idxs[:limit_per_digit]:
                img, label = dataset[idx]
                arrays.append(external_digit_to_tensor(img, source))
                labels.append(int(label))
                counts[source] += 1

    mnist = datasets.MNIST(root=str(root), train=True, download=False)
    emnist = datasets.EMNIST(root=str(root), split="digits", train=True, download=False)
    add_dataset(mnist, "mnist", max(1, per_digit // 3))
    add_dataset(emnist, "emnist", per_digit)
    return np.stack(arrays).astype(np.float32), np.asarray(labels, dtype=np.int64), counts


def make_tensor_dataset(images: np.ndarray, labels: np.ndarray) -> TensorDataset:
    x = torch.tensor(images, dtype=torch.float32).unsqueeze(1)
    y = torch.tensor(labels, dtype=torch.long)
    return TensorDataset(x, y)


def augment_batch(x: torch.Tensor, generator: torch.Generator) -> torch.Tensor:
    n = x.shape[0]
    device = x.device
    angle = (torch.rand(n, generator=generator, device=device) - 0.5) * math.radians(16.0)
    scale = 0.82 + torch.rand(n, generator=generator, device=device) * 0.34
    tx = (torch.rand(n, generator=generator, device=device) - 0.5) * 0.24
    ty = (torch.rand(n, generator=generator, device=device) - 0.5) * 0.24
    theta = torch.zeros(n, 2, 3, dtype=x.dtype, device=device)
    theta[:, 0, 0] = torch.cos(angle) * scale
    theta[:, 0, 1] = -torch.sin(angle) * scale
    theta[:, 1, 0] = torch.sin(angle) * scale
    theta[:, 1, 1] = torch.cos(angle) * scale
    theta[:, 0, 2] = tx
    theta[:, 1, 2] = ty
    grid = F.affine_grid(theta, x.size(), align_corners=False)
    x = F.grid_sample(x, grid, mode="bilinear", padding_mode="zeros", align_corners=False)

    blur_mask = (torch.rand(n, 1, 1, 1, generator=generator, device=device) < 0.45).float()
    blurred = F.avg_pool2d(x, kernel_size=3, stride=1, padding=1)
    x = x * (1.0 - blur_mask) + blurred * blur_mask

    contrast = 0.48 + torch.rand(n, 1, 1, 1, generator=generator, device=device) * 1.10
    brightness = (torch.rand(n, 1, 1, 1, generator=generator, device=device) - 0.5) * 0.18
    fade = 0.44 + torch.rand(n, 1, 1, 1, generator=generator, device=device) * 0.76
    x = ((x - 0.5) * contrast + 0.5 + brightness) * fade
    gamma = 0.70 + torch.rand(n, 1, 1, 1, generator=generator, device=device) * 1.00
    x = torch.clamp(x, 0.0, 1.0).pow(gamma)
    noise = torch.randn(x.shape, generator=generator, device=device, dtype=x.dtype) * 0.035
    x = torch.clamp(x + noise, 0.0, 1.0)

    # Teach the model that stray answer-box remnants are not digits.
    line_mask = torch.rand(n, generator=generator, device=device) < 0.20
    for idx in range(n):
        if not bool(line_mask[idx].item()):
            continue
        value = 0.18 + float(torch.rand((), generator=generator, device=device).item()) * 0.38
        thickness = 1
        if bool(torch.rand((), generator=generator, device=device).item() < 0.5):
            y = int(torch.randint(0, 28, (), generator=generator, device=device).item())
            x[idx, :, max(0, y - thickness):min(28, y + thickness + 1), :] = value
        else:
            col = int(torch.randint(0, 28, (), generator=generator, device=device).item())
            x[idx, :, :, max(0, col - thickness):min(28, col + thickness + 1)] = value
    return x


def evaluate_model(model: nn.Module, images: np.ndarray, labels: np.ndarray, names: list[str], device: torch.device) -> EvalStats:
    if labels.size == 0:
        return EvalStats(0, 0, 0.0, [], [])
    x = torch.tensor(images, dtype=torch.float32).unsqueeze(1).to(device)
    y = torch.tensor(labels, dtype=torch.long).to(device)
    model.eval()
    with torch.no_grad():
        logits = model(x)
        probs = torch.softmax(logits, dim=1)
        conf, pred = probs.max(dim=1)
    pred_np = pred.cpu().numpy()
    labels_np = labels.astype(np.int64)
    conf_np = conf.cpu().numpy()
    correct = int((pred_np == labels_np).sum())
    confusion_counts: dict[str, int] = {}
    misses: list[dict] = []
    for idx, (expected, got) in enumerate(zip(labels_np, pred_np, strict=True)):
        if int(expected) == int(got):
            continue
        key = f"{int(expected)}->{int(got)}"
        confusion_counts[key] = confusion_counts.get(key, 0) + 1
        if len(misses) < 40:
            top = torch.topk(probs[idx], k=3)
            misses.append({
                "name": names[idx],
                "expected": int(expected),
                "predicted": int(got),
                "confidence": float(conf_np[idx]),
                "topK": [
                    {"digit": int(d), "confidence": float(c)}
                    for c, d in zip(top.values.cpu().tolist(), top.indices.cpu().tolist(), strict=True)
                ],
            })
    confusions = [
        {"pair": pair, "count": count}
        for pair, count in sorted(confusion_counts.items(), key=lambda item: (-item[1], item[0]))
    ]
    return EvalStats(correct, int(labels.size), correct / max(1, int(labels.size)), confusions, misses)


def sample_external_eval(root: Path, per_digit: int, seed: int) -> tuple[np.ndarray, np.ndarray, list[str]]:
    rng = random.Random(seed)
    arrays: list[np.ndarray] = []
    labels: list[int] = []
    names: list[str] = []
    datasets_to_use = [
        ("mnist-test", datasets.MNIST(root=str(root), train=False, download=False), "mnist"),
        ("emnist-test", datasets.EMNIST(root=str(root), split="digits", train=False, download=False), "emnist"),
    ]
    for title, ds, source in datasets_to_use:
        by_label: dict[int, list[int]] = {d: [] for d in range(10)}
        for idx in range(len(ds)):
            _img, label = ds[idx]
            label = int(label)
            if 0 <= label <= 9:
                by_label[label].append(idx)
        for digit in range(10):
            idxs = by_label[digit]
            rng.shuffle(idxs)
            for idx in idxs[:per_digit]:
                img, label = ds[idx]
                arrays.append(external_digit_to_tensor(img, source))
                labels.append(int(label))
                names.append(f"{title}-{idx}")
    return np.stack(arrays).astype(np.float32), np.asarray(labels, dtype=np.int64), names


def load_holdout_samples(root: Path) -> tuple[np.ndarray, np.ndarray, list[str]]:
    samples = load_worksheet_samples([root], excluded_token="")
    samples = [sample for sample in samples if STRICT_HOLDOUT_TOKEN in sample.group]
    if not samples:
        return np.zeros((0, 28, 28), dtype=np.float32), np.zeros((0,), dtype=np.int64), []
    return (
        np.stack([sample.image for sample in samples]).astype(np.float32),
        np.asarray([sample.label for sample in samples], dtype=np.int64),
        [sample.name for sample in samples],
    )


def export_onnx(model: nn.Module, onnx_out: Path) -> None:
    onnx_out.parent.mkdir(parents=True, exist_ok=True)
    model_cpu = model.to(torch.device("cpu")).eval()
    dummy = torch.randn(1, 1, 28, 28)
    torch.onnx.export(
        model_cpu,
        dummy,
        str(onnx_out),
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={"input": {0: "batch"}, "output": {0: "batch"}},
        opset_version=13,
        external_data=False,
        dynamo=False,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train generalized ScanGrade digit OCR model.")
    parser.add_argument("--epochs", type=int, default=14)
    parser.add_argument("--batch-size", type=int, default=256)
    parser.add_argument("--lr", type=float, default=8e-4)
    parser.add_argument("--seed", type=int, default=51)
    parser.add_argument("--external-per-digit", type=int, default=2200)
    parser.add_argument("--worksheet-repeat", type=int, default=16)
    parser.add_argument("--external-root", default=str(DEFAULT_EXTERNAL_ROOT))
    parser.add_argument("--holdout-debug", default=str(DEFAULT_HOLDOUT_DEBUG))
    parser.add_argument("--onnx-out", default=str(DEFAULT_ONNX_OUT))
    parser.add_argument("--checkpoint-out", default=str(DEFAULT_CHECKPOINT_OUT))
    parser.add_argument("--metadata-out", default=str(DEFAULT_METADATA_OUT))
    parser.add_argument("--include-internal-val", action="store_true", help="Train on the internal worksheet validation groups too.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)
    device = torch.device("cpu")

    worksheet_samples = load_worksheet_samples(DEFAULT_WORKSHEET_SOURCES)
    train_ws = [
        sample for sample in worksheet_samples
        if args.include_internal_val or sample.group not in DEFAULT_INTERNAL_VAL_GROUPS
    ]
    val_ws = [
        sample for sample in worksheet_samples
        if sample.group in DEFAULT_INTERNAL_VAL_GROUPS
    ]
    if not train_ws:
        raise RuntimeError("No worksheet training samples found.")

    ws_train_images = np.stack([sample.image for sample in train_ws]).astype(np.float32)
    ws_train_labels = np.asarray([sample.label for sample in train_ws], dtype=np.int64)
    ws_train_names = [sample.name for sample in train_ws]
    ws_val_images = np.stack([sample.image for sample in val_ws]).astype(np.float32) if val_ws else np.zeros((0, 28, 28), dtype=np.float32)
    ws_val_labels = np.asarray([sample.label for sample in val_ws], dtype=np.int64)
    ws_val_names = [sample.name for sample in val_ws]

    ext_images, ext_labels, external_counts = load_external_balanced(
        Path(args.external_root),
        per_digit=args.external_per_digit,
        seed=args.seed,
    )
    ext_eval_images, ext_eval_labels, ext_eval_names = sample_external_eval(Path(args.external_root), per_digit=160, seed=args.seed + 1)

    repeated_ws_images = np.repeat(ws_train_images, args.worksheet_repeat, axis=0)
    repeated_ws_labels = np.repeat(ws_train_labels, args.worksheet_repeat, axis=0)
    train_images = np.concatenate([ext_images, repeated_ws_images], axis=0).astype(np.float32)
    train_labels = np.concatenate([ext_labels, repeated_ws_labels], axis=0).astype(np.int64)

    permutation = np.random.default_rng(args.seed).permutation(train_labels.size)
    train_images = train_images[permutation]
    train_labels = train_labels[permutation]

    loader = DataLoader(
        make_tensor_dataset(train_images, train_labels),
        batch_size=args.batch_size,
        shuffle=True,
        drop_last=False,
    )
    model = ScanGradeDigitCNN().to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=max(1, args.epochs))
    aug_generator = torch.Generator(device=device).manual_seed(args.seed + 7000)

    best_state = None
    best_score = -1.0
    history: list[dict] = []
    for epoch in range(1, args.epochs + 1):
        model.train()
        running_loss = 0.0
        seen = 0
        for xb, yb in loader:
            xb = augment_batch(xb.to(device), aug_generator)
            yb = yb.to(device)
            optimizer.zero_grad(set_to_none=True)
            logits = model(xb)
            loss = F.cross_entropy(logits, yb, label_smoothing=0.02)
            loss.backward()
            optimizer.step()
            running_loss += float(loss.item()) * int(yb.numel())
            seen += int(yb.numel())
        scheduler.step()
        train_eval = evaluate_model(model, ws_train_images, ws_train_labels, ws_train_names, device)
        val_eval = evaluate_model(model, ws_val_images, ws_val_labels, ws_val_names, device)
        ext_eval = evaluate_model(model, ext_eval_images, ext_eval_labels, ext_eval_names, device)
        score = (val_eval.accuracy if val_eval.total else train_eval.accuracy) * 0.75 + ext_eval.accuracy * 0.25
        row = {
            "epoch": epoch,
            "loss": running_loss / max(1, seen),
            "worksheetTrainAcc": train_eval.accuracy,
            "worksheetValAcc": val_eval.accuracy,
            "externalEvalAcc": ext_eval.accuracy,
            "score": score,
            "lr": scheduler.get_last_lr()[0],
        }
        history.append(row)
        if score >= best_score:
            best_score = score
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
        if epoch == 1 or epoch % max(1, args.epochs // 7) == 0 or epoch == args.epochs:
            print(
                f"epoch {epoch:03d}/{args.epochs} loss={row['loss']:.4f} "
                f"ws_train={train_eval.accuracy:.2%} ws_val={val_eval.accuracy:.2%} "
                f"ext={ext_eval.accuracy:.2%}",
                flush=True,
            )

    if best_state is None:
        raise RuntimeError("Training did not produce a model state.")
    model.load_state_dict(best_state)
    model.eval()

    final_train = evaluate_model(model, ws_train_images, ws_train_labels, ws_train_names, device)
    final_val = evaluate_model(model, ws_val_images, ws_val_labels, ws_val_names, device)
    final_ext = evaluate_model(model, ext_eval_images, ext_eval_labels, ext_eval_names, device)
    holdout_images, holdout_labels, holdout_names = load_holdout_samples(Path(args.holdout_debug))
    holdout_eval = evaluate_model(model, holdout_images, holdout_labels, holdout_names, device)

    checkpoint_out = Path(args.checkpoint_out)
    checkpoint_out.parent.mkdir(parents=True, exist_ok=True)
    torch.save(
        {
            "state_dict": model.state_dict(),
            "arch": "ScanGradeDigitCNN",
            "args": vars(args),
        },
        checkpoint_out,
    )
    export_onnx(model, Path(args.onnx_out))

    metadata = {
        "generatedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "arch": "ScanGradeDigitCNN",
        "preprocessing": "worksheet RGB darkness/saturation ink extraction + centered 28x28 digit normalization",
        "strictHoldoutPolicy": f"Paths containing {STRICT_HOLDOUT_TOKEN} are excluded from training and used only for evaluation.",
        "args": vars(args),
        "worksheetSources": [str(path) for path in DEFAULT_WORKSHEET_SOURCES],
        "worksheetSamples": {
            "train": len(train_ws),
            "internalVal": len(val_ws),
            "groupsTrain": sorted({sample.group for sample in train_ws}),
            "groupsInternalVal": sorted({sample.group for sample in val_ws}),
        },
        "externalCounts": external_counts,
        "expandedTrainSamples": int(train_labels.size),
        "history": history,
        "eval": {
            "worksheetTrain": asdict(final_train),
            "worksheetInternalVal": asdict(final_val),
            "externalEval": asdict(final_ext),
            "strictHoldout": asdict(holdout_eval),
        },
        "checkpoint": str(checkpoint_out),
        "onnx": str(Path(args.onnx_out)),
    }
    metadata_out = Path(args.metadata_out)
    metadata_out.parent.mkdir(parents=True, exist_ok=True)
    metadata_out.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    print("")
    print(f"Worksheet train: {final_train.correct}/{final_train.total} ({final_train.accuracy:.2%})")
    print(f"Worksheet internal val: {final_val.correct}/{final_val.total} ({final_val.accuracy:.2%})")
    print(f"External eval: {final_ext.correct}/{final_ext.total} ({final_ext.accuracy:.2%})")
    print(f"Strict holdout: {holdout_eval.correct}/{holdout_eval.total} ({holdout_eval.accuracy:.2%})")
    if holdout_eval.confusions:
        print("Holdout confusions:", ", ".join(f"{item['pair']} ({item['count']})" for item in holdout_eval.confusions[:12]))
    print(f"ONNX exported: {args.onnx_out}")
    print(f"Metadata: {args.metadata_out}")


if __name__ == "__main__":
    main()
