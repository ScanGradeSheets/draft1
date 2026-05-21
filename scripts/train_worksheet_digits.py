#!/usr/bin/env python3
"""
Train the worksheet digit OCR model and export ONNX for ScanGrade.

Default mode trains on the browser-exported labeled crops in:
  datasets/worksheet_digits/raw/0 ... 9/*.png

That matches the recipe that currently reproduces the green bake-off result:
  - resize exported debug PNGs back to 28x28
  - train a small full-batch MLP on all labeled samples
  - export to public/models/mnist-model.onnx

Optional split mode is still available for sanity checks against:
  datasets/worksheet_digits/train/0 ... 9/*.png
  datasets/worksheet_digits/val/0 ... 9/*.png
"""

from __future__ import annotations

import argparse
import json
import os
from dataclasses import asdict, dataclass

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image


PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_DATASET_ROOT = os.path.join(PROJECT_ROOT, "datasets", "worksheet_digits")
DEFAULT_ONNX_PATH = os.path.join(PROJECT_ROOT, "public", "models", "mnist-model.onnx")
DEFAULT_CHECKPOINT_PATH = os.path.join(PROJECT_ROOT, "models", "worksheet-digit-cnn.pt")
DEFAULT_METADATA_PATH = os.path.join(PROJECT_ROOT, "models", "worksheet-digit-training-metadata.json")


class WorksheetDigitMLP(nn.Module):
    def __init__(self, hidden_dim: int = 128) -> None:
        super().__init__()
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(28 * 28, hidden_dim),
            nn.ReLU(inplace=True),
            nn.Linear(hidden_dim, 10),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.classifier(x)


class WorksheetDigitCNN(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(1, 16, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),
            nn.Conv2d(16, 32, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),
        )
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(32 * 7 * 7, 128),
            nn.ReLU(inplace=True),
            nn.Linear(128, 10),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.classifier(self.features(x))


class WorksheetDigitWideCNN(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(1, 24, kernel_size=3, padding=1),
            nn.BatchNorm2d(24),
            nn.ReLU(inplace=True),
            nn.Conv2d(24, 24, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),
            nn.Conv2d(24, 48, kernel_size=3, padding=1),
            nn.BatchNorm2d(48),
            nn.ReLU(inplace=True),
            nn.Conv2d(48, 48, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),
        )
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(48 * 7 * 7, 192),
            nn.ReLU(inplace=True),
            nn.Dropout(p=0.10),
            nn.Linear(192, 10),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.classifier(self.features(x))


@dataclass
class DatasetBundle:
    images: torch.Tensor
    labels: torch.Tensor
    names: list[str]


@dataclass
class EpochStats:
    loss: float
    acc: float


def load_png_tensor(path: str) -> np.ndarray:
    img = Image.open(path).convert("L").resize((28, 28), Image.Resampling.NEAREST)
    arr = np.asarray(img, dtype=np.float32) / 255.0
    return arr


def load_labeled_dir(root: str) -> DatasetBundle:
    images: list[np.ndarray] = []
    labels: list[int] = []
    names: list[str] = []

    expected = {str(i) for i in range(10)}
    found = {name for name in os.listdir(root) if os.path.isdir(os.path.join(root, name))}
    if found != expected:
        raise ValueError(f"Expected class folders 0..9 in {root}. Found: {sorted(found)}")

    for label in map(str, range(10)):
        class_dir = os.path.join(root, label)
        for filename in sorted(os.listdir(class_dir)):
            if not filename.endswith(".png"):
                continue
            path = os.path.join(class_dir, filename)
            images.append(load_png_tensor(path))
            labels.append(int(label))
            names.append(filename)

    if not images:
        raise ValueError(f"No PNG training samples found in {root}")

    image_tensor = torch.tensor(np.stack(images), dtype=torch.float32).unsqueeze(1)
    label_tensor = torch.tensor(labels, dtype=torch.long)
    return DatasetBundle(images=image_tensor, labels=label_tensor, names=names)


def load_dataset(dataset_root: str, source: str) -> tuple[DatasetBundle, DatasetBundle | None]:
    if source == "raw":
        raw_dir = os.path.join(dataset_root, "raw")
        if not os.path.isdir(raw_dir):
            raise FileNotFoundError(f"Missing raw directory: {raw_dir}")
        return load_labeled_dir(raw_dir), None

    train_dir = os.path.join(dataset_root, "train")
    val_dir = os.path.join(dataset_root, "val")
    if not os.path.isdir(train_dir):
        raise FileNotFoundError(f"Missing train directory: {train_dir}")
    if not os.path.isdir(val_dir):
        raise FileNotFoundError(f"Missing val directory: {val_dir}")
    return load_labeled_dir(train_dir), load_labeled_dir(val_dir)


def make_camera_variant(images: torch.Tensor, generator: torch.Generator) -> torch.Tensor:
    """Simulate low-contrast live camera crops while preserving the 28x28 app contract."""
    n = images.shape[0]
    device = images.device
    x = images.clone()

    angle = (torch.rand(n, generator=generator, device=device) - 0.5) * np.deg2rad(12.0)
    scale = 0.88 + torch.rand(n, generator=generator, device=device) * 0.24
    tx = (torch.rand(n, generator=generator, device=device) - 0.5) * 0.18
    ty = (torch.rand(n, generator=generator, device=device) - 0.5) * 0.18
    cos_a = torch.cos(angle) * scale
    sin_a = torch.sin(angle) * scale
    theta = torch.zeros(n, 2, 3, dtype=x.dtype, device=device)
    theta[:, 0, 0] = cos_a
    theta[:, 0, 1] = -sin_a
    theta[:, 1, 0] = sin_a
    theta[:, 1, 1] = cos_a
    theta[:, 0, 2] = tx
    theta[:, 1, 2] = ty
    grid = F.affine_grid(theta, x.size(), align_corners=False)
    x = F.grid_sample(x, grid, mode="bilinear", padding_mode="zeros", align_corners=False)

    blur_mask = (torch.rand(n, 1, 1, 1, generator=generator, device=device) < 0.55).float()
    blurred = F.avg_pool2d(x, kernel_size=3, stride=1, padding=1)
    x = x * (1.0 - blur_mask) + blurred * blur_mask

    # MacBook webcam frames often wash pencil strokes into a narrow gray band.
    contrast = 0.45 + torch.rand(n, 1, 1, 1, generator=generator, device=device) * 0.95
    brightness = (torch.rand(n, 1, 1, 1, generator=generator, device=device) - 0.5) * 0.20
    fade = 0.50 + torch.rand(n, 1, 1, 1, generator=generator, device=device) * 0.70
    x = ((x - 0.5) * contrast + 0.5 + brightness) * fade

    gamma = 0.75 + torch.rand(n, 1, 1, 1, generator=generator, device=device) * 0.90
    x = torch.clamp(x, 0.0, 1.0).pow(gamma)

    noise = torch.randn(x.shape, generator=generator, device=device, dtype=x.dtype) * 0.035
    x = torch.clamp(x + noise, 0.0, 1.0)

    # Real webcam crops sometimes include portions of the printed answer-box border
    # or a neighboring cell edge. Teach the classifier that these edge artifacts are
    # not part of the handwritten digit.
    line_mask = torch.rand(n, 1, 1, 1, generator=generator, device=device) < 0.45
    for idx in range(n):
        if not bool(line_mask[idx].item()):
            continue
        value = 0.38 + float(torch.rand((), generator=generator, device=device).item()) * 0.55
        thickness = 1 + int(torch.randint(0, 2, (), generator=generator, device=device).item())
        if bool(torch.rand((), generator=generator, device=device).item() < 0.70):
            y = int(torch.randint(0, 28, (), generator=generator, device=device).item())
            x[idx, :, max(0, y - thickness):min(28, y + thickness + 1), :] = value
        if bool(torch.rand((), generator=generator, device=device).item() < 0.70):
            col = int(torch.randint(0, 28, (), generator=generator, device=device).item())
            x[idx, :, :, max(0, col - thickness):min(28, col + thickness + 1)] = value

    return x


def augment_for_camera(bundle: DatasetBundle, copies: int, seed: int) -> DatasetBundle:
    if copies <= 0:
        return bundle

    generator = torch.Generator(device=bundle.images.device).manual_seed(seed + 41_000)
    images = [bundle.images]
    labels = [bundle.labels]
    names = list(bundle.names)

    for copy_idx in range(copies):
        images.append(make_camera_variant(bundle.images, generator))
        labels.append(bundle.labels.clone())
        names.extend(f"{name}__camera_aug_{copy_idx + 1:03d}" for name in bundle.names)

    return DatasetBundle(
        images=torch.cat(images, dim=0),
        labels=torch.cat(labels, dim=0),
        names=names,
    )


def evaluate(model: nn.Module, bundle: DatasetBundle, device: torch.device, criterion: nn.Module) -> EpochStats:
    model.eval()
    with torch.no_grad():
        images = bundle.images.to(device)
        labels = bundle.labels.to(device)
        logits = model(images)
        loss = criterion(logits, labels).item()
        preds = logits.argmax(dim=1)
        acc = (preds == labels).float().mean().item()
    return EpochStats(loss=loss, acc=acc)


def train_full_batch(
    model: nn.Module,
    train_bundle: DatasetBundle,
    eval_bundle: DatasetBundle | None,
    device: torch.device,
    epochs: int,
    lr: float,
) -> tuple[nn.Module, dict]:
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)

    train_images = train_bundle.images.to(device)
    train_labels = train_bundle.labels.to(device)

    best_state = None
    best_score = -1.0
    history: list[dict] = []

    for epoch in range(1, epochs + 1):
        model.train(True)
        optimizer.zero_grad()
        logits = model(train_images)
        loss = criterion(logits, train_labels)
        loss.backward()
        optimizer.step()

        train_preds = logits.argmax(dim=1)
        train_acc = (train_preds == train_labels).float().mean().item()

        eval_stats = None
        score = train_acc
        if eval_bundle is not None:
            eval_stats = evaluate(model, eval_bundle, device, criterion)
            score = eval_stats.acc

        if score >= best_score:
            best_score = score
            best_state = {
                key: value.detach().cpu().clone()
                for key, value in model.state_dict().items()
            }

        row = {
            "epoch": epoch,
            "train_loss": loss.item(),
            "train_acc": train_acc,
        }
        if eval_stats is not None:
            row["eval_loss"] = eval_stats.loss
            row["eval_acc"] = eval_stats.acc
        history.append(row)

        if epoch == 1 or epoch % max(1, epochs // 10) == 0 or epoch == epochs:
            msg = (
                f"epoch {epoch:04d}/{epochs} "
                f"train_loss={loss.item():.4f} train_acc={train_acc:.2%}"
            )
            if eval_stats is not None:
                msg += f" eval_loss={eval_stats.loss:.4f} eval_acc={eval_stats.acc:.2%}"
            print(msg, flush=True)

    if best_state is None:
        raise RuntimeError("Training did not produce a valid model state.")

    model.load_state_dict(best_state)
    model.eval()

    train_stats = evaluate(model, train_bundle, device, criterion)
    final_eval_stats = evaluate(model, eval_bundle, device, criterion) if eval_bundle is not None else None
    return model, {
        "history": history,
        "train_stats": asdict(train_stats),
        "eval_stats": asdict(final_eval_stats) if final_eval_stats is not None else None,
        "selection_metric": "eval_acc" if eval_bundle is not None else "train_acc",
        "selection_score": best_score,
    }


def ensure_parent(path: str) -> None:
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)


def export_model(model: nn.Module, device: torch.device, checkpoint_path: str, onnx_path: str, metadata_path: str, metadata: dict) -> None:
    ensure_parent(checkpoint_path)
    ensure_parent(onnx_path)
    ensure_parent(metadata_path)

    torch.save(metadata | {"state_dict": model.state_dict()}, checkpoint_path)

    dummy = torch.randn(1, 1, 28, 28, device=device)
    torch.onnx.export(
        model,
        dummy,
        onnx_path,
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={"input": {0: "batch"}, "output": {0: "batch"}},
        opset_version=13,
        external_data=False,
        dynamo=False,
    )

    with open(metadata_path, "w", encoding="utf-8") as fh:
        json.dump(metadata, fh, indent=2)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train worksheet digit OCR model and export ONNX.")
    parser.add_argument("--dataset", default=DEFAULT_DATASET_ROOT, help="Dataset root")
    parser.add_argument(
        "--source",
        choices=("raw", "split"),
        default="raw",
        help="Use raw exported crops (default) or train/val split directories",
    )
    parser.add_argument("--epochs", type=int, default=1800, help="Number of training epochs")
    parser.add_argument("--lr", type=float, default=2e-3, help="Learning rate")
    parser.add_argument(
        "--arch",
        choices=("cnn", "wide-cnn", "mlp"),
        default="cnn",
        help="Model architecture to train",
    )
    parser.add_argument(
        "--augment-copies",
        type=int,
        default=12,
        help="Camera-style synthetic copies per labeled crop",
    )
    parser.add_argument("--hidden-dim", type=int, default=512, help="MLP hidden layer width")
    parser.add_argument("--seed", type=int, default=11, help="Random seed")
    parser.add_argument("--cpu", action="store_true", help="Force CPU even if CUDA is available")
    parser.add_argument(
        "--init-checkpoint",
        default="",
        help="Optional checkpoint to initialize matching model weights before training",
    )
    parser.add_argument("--checkpoint", default=DEFAULT_CHECKPOINT_PATH, help="Checkpoint output path")
    parser.add_argument("--onnx-out", default=DEFAULT_ONNX_PATH, help="ONNX output path")
    parser.add_argument("--metadata-out", default=DEFAULT_METADATA_PATH, help="Training metadata output path")
    return parser.parse_args()


def main(args: argparse.Namespace) -> None:
    torch.manual_seed(args.seed)
    np.random.seed(args.seed)
    device = torch.device("cuda" if torch.cuda.is_available() and not args.cpu else "cpu")

    train_bundle, eval_bundle = load_dataset(args.dataset, args.source)
    fit_bundle = augment_for_camera(train_bundle, copies=args.augment_copies, seed=args.seed)
    fit_eval_bundle = eval_bundle if eval_bundle is not None else train_bundle
    if args.arch == "cnn":
        model = WorksheetDigitCNN()
    elif args.arch == "wide-cnn":
        model = WorksheetDigitWideCNN()
    else:
        model = WorksheetDigitMLP(hidden_dim=args.hidden_dim)
    model = model.to(device)

    if args.init_checkpoint:
        checkpoint = torch.load(args.init_checkpoint, map_location=device)
        state_dict = checkpoint.get("state_dict", checkpoint)
        model.load_state_dict(state_dict)
        print(f"Initialized model weights from: {args.init_checkpoint}", flush=True)

    model, stats = train_full_batch(
        model=model,
        train_bundle=fit_bundle,
        eval_bundle=fit_eval_bundle,
        device=device,
        epochs=args.epochs,
        lr=args.lr,
    )

    metadata = {
        "arch": {
            "cnn": "WorksheetDigitCNN",
            "wide-cnn": "WorksheetDigitWideCNN",
            "mlp": "WorksheetDigitMLP",
        }[args.arch],
        "dataset": os.path.abspath(args.dataset),
        "source": args.source,
        "seed": args.seed,
        "epochs": args.epochs,
        "lr": args.lr,
        "hidden_dim": args.hidden_dim,
        "augment_copies": args.augment_copies,
        "init_checkpoint": os.path.abspath(args.init_checkpoint) if args.init_checkpoint else "",
        "camera_augmented": args.augment_copies > 0,
        "device": str(device),
        "train_samples": int(fit_bundle.labels.numel()),
        "base_train_samples": int(train_bundle.labels.numel()),
        "eval_samples": int(eval_bundle.labels.numel()) if eval_bundle is not None else 0,
        "fit_eval_samples": int(fit_eval_bundle.labels.numel()),
        **stats,
    }

    export_model(
        model=model,
        device=device,
        checkpoint_path=args.checkpoint,
        onnx_path=args.onnx_out,
        metadata_path=args.metadata_out,
        metadata=metadata,
    )

    print("")
    print(f"Training source: {args.source}")
    print(f"Train accuracy: {stats['train_stats']['acc']:.2%}")
    if stats["eval_stats"] is not None:
        print(f"Eval accuracy: {stats['eval_stats']['acc']:.2%}")
    print(f"Checkpoint: {args.checkpoint}")
    print(f"ONNX exported: {args.onnx_out}")
    print(f"Metadata: {args.metadata_out}")


if __name__ == "__main__":
    main(parse_args())
