#!/usr/bin/env python3
"""Train identical small CNNs on raw and production-normalized digit crops."""

import argparse
import copy
import json
import random
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from torch import nn
from torch.utils.data import DataLoader, Dataset


ROWS = Path("private-evidence/reports/digit-failure-dataset-20260705-current/digit-rows.json")


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=Path("private-evidence/reports/raw-vs-model-digit-information-20260709.json"))
    parser.add_argument("--epochs", type=int, default=40)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--seed", type=int, default=23)
    return parser.parse_args()


def path_for(row, representation):
    directory = Path(row["debugPath"]).parent
    index = int(row["detailId"]) + 1
    folder, prefix = ("raw-crops", "raw") if representation == "raw" else ("model-inputs", "model")
    return directory / folder / f"{prefix}-{index:02d}.png"


def tensor_for(row, representation):
    image = Image.open(path_for(row, representation)).convert("L").resize((28, 28), Image.Resampling.BILINEAR)
    values = np.asarray(image, dtype=np.float32) / 255.0
    if representation == "raw":
        values = 1.0 - values
        # Remove the grey paper pedestal without binarizing the handwriting.
        border = np.concatenate((values[0], values[-1], values[:, 0], values[:, -1]))
        values = np.clip(values - float(np.median(border)), 0.0, 1.0)
        maximum = float(values.max())
        if maximum > 0:
            values /= maximum
    return torch.from_numpy(values[None, :, :])


class Digits(Dataset):
    def __init__(self, rows, representation, augment=False):
        self.rows = rows
        self.representation = representation
        self.augment = augment

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, index):
        row = self.rows[index]
        image = tensor_for(row, self.representation)
        if self.augment:
            dx, dy = random.randint(-2, 2), random.randint(-2, 2)
            image = torch.roll(image, (dy, dx), (1, 2))
            if dy > 0: image[:, :dy, :] = 0
            elif dy < 0: image[:, dy:, :] = 0
            if dx > 0: image[:, :, :dx] = 0
            elif dx < 0: image[:, :, dx:] = 0
        return image, int(row["truthDigit"])


class DigitCNN(nn.Module):
    def __init__(self):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(1, 24, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(24, 48, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(48, 64, 3, padding=1), nn.ReLU(), nn.AdaptiveAvgPool2d((4, 4)),
        )
        self.classifier = nn.Sequential(nn.Flatten(), nn.Linear(64 * 4 * 4, 96), nn.ReLU(), nn.Dropout(0.15), nn.Linear(96, 10))

    def forward(self, inputs):
        return self.classifier(self.features(inputs))


def accuracy(model, loader, device):
    model.eval()
    correct = total = 0
    with torch.inference_mode():
        for images, labels in loader:
            predictions = model(images.to(device)).argmax(1).cpu()
            correct += int((predictions == labels).sum())
            total += len(labels)
    return correct, total


def train(rows, representation, opts, device):
    random.seed(opts.seed)
    torch.manual_seed(opts.seed)
    development = [row for row in rows if row["split"] == "calibration"]
    validation = [row for row in rows if row["split"] == "validation"]
    holdout = [row for row in rows if row["split"] == "holdout"]
    train_loader = DataLoader(Digits(development, representation, True), batch_size=opts.batch_size, shuffle=True)
    validation_loader = DataLoader(Digits(validation, representation), batch_size=opts.batch_size)
    holdout_loader = DataLoader(Digits(holdout, representation), batch_size=opts.batch_size)
    model = DigitCNN().to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
    loss_fn = nn.CrossEntropyLoss()
    best_state = None
    best_validation = -1
    best_epoch = None
    curve = []
    for epoch in range(1, opts.epochs + 1):
        model.train()
        losses = []
        for images, labels in train_loader:
            optimizer.zero_grad(set_to_none=True)
            loss = loss_fn(model(images.to(device)), labels.to(device))
            loss.backward()
            optimizer.step()
            losses.append(float(loss.detach().cpu()))
        val_correct, val_total = accuracy(model, validation_loader, device)
        val_accuracy = val_correct / val_total
        curve.append({"epoch": epoch, "loss": round(sum(losses) / len(losses), 4), "validationCorrect": val_correct, "validationTotal": val_total, "validationAccuracyPct": round(100 * val_accuracy, 1)})
        if val_accuracy > best_validation:
            best_validation = val_accuracy
            best_epoch = epoch
            best_state = copy.deepcopy(model.state_dict())
    model.load_state_dict(best_state)
    val_correct, val_total = accuracy(model, validation_loader, device)
    hold_correct, hold_total = accuracy(model, holdout_loader, device)
    return {
        "bestEpoch": best_epoch,
        "validation": {"total": val_total, "correct": val_correct, "accuracyPct": round(100 * val_correct / val_total, 1)},
        "holdout": {"total": hold_total, "correct": hold_correct, "accuracyPct": round(100 * hold_correct / hold_total, 1)},
        "curve": curve,
    }


def main():
    opts = parse_args()
    rows = json.loads(ROWS.read_text())
    rows = [row for row in rows if row.get("truthDigit") is not None and path_for(row, "raw").exists() and path_for(row, "model").exists()]
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    results = {}
    for representation in ("raw", "model_input"):
        results[representation] = train(rows, representation, opts, device)
        print(representation, json.dumps({"bestEpoch": results[representation]["bestEpoch"], "validation": results[representation]["validation"], "holdout": results[representation]["holdout"]}), flush=True)
    for split in ("validation", "holdout"):
        split_rows = [row for row in rows if row["split"] == split]
        current_correct = sum(bool(row["currentDigitCorrect"]) for row in split_rows)
        results[f"currentProduction_{split}"] = {"total": len(split_rows), "correct": current_correct, "accuracyPct": round(100 * current_correct / len(split_rows), 1)}
    report = {
        "device": device,
        "seed": opts.seed,
        "splitWarning": "Historical page-block R&D splits; no durable student IDs.",
        "comparison": "Identical architecture, initialization seed, training rows, augmentation, optimizer, and epoch selection; only image representation differs.",
        "results": results,
    }
    opts.out.parent.mkdir(parents=True, exist_ok=True)
    opts.out.write_text(json.dumps(report, indent=2) + "\n")
    print(opts.out)


if __name__ == "__main__":
    main()
