#!/usr/bin/env python3
"""Train a small key-blind whole-answer reader from larger grayscale crops.

The model is first taught generic digit/box structure with locally available
MNIST and EMNIST digits, then fine-tuned only on the historical development
split. Validation and holdout crops are never used for gradient updates.
"""

from __future__ import annotations

import argparse
import copy
import json
import random
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter
from torch import nn
from torch.utils.data import DataLoader, Dataset
from torchvision.datasets import EMNIST, MNIST


ROOT = Path(__file__).resolve().parents[1]
HEIGHT, WIDTH = 64, 192


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=ROOT / "private-evidence/v3/live-continuous-answer-zones-manifest.json")
    parser.add_argument("--recent-manifest", type=Path, default=ROOT / "private-evidence/v3/four-packet-sequence-20260714/manifest.json")
    parser.add_argument("--model-out", type=Path, required=True)
    parser.add_argument("--onnx-out", type=Path, required=True)
    parser.add_argument("--report-out", type=Path, required=True)
    parser.add_argument("--seed", type=int, default=17)
    parser.add_argument("--synthetic-samples", type=int, default=24000)
    parser.add_argument("--synthetic-epochs", type=int, default=4)
    parser.add_argument("--finetune-epochs", type=int, default=70)
    parser.add_argument("--patience", type=int, default=14)
    parser.add_argument("--batch-size", type=int, default=48)
    parser.add_argument("--device", choices=("auto", "cpu", "mps"), default="auto")
    return parser.parse_args()


def resolve(path):
    path = Path(path)
    return path if path.is_absolute() else ROOT / path


def choose_device(requested):
    if requested != "auto":
        return requested
    return "mps" if torch.backends.mps.is_available() else "cpu"


def prepare_image(image, augment=False, rng=None):
    image = image.convert("L")
    if augment:
        rng = rng or random
        image = ImageEnhance.Contrast(image).enhance(rng.uniform(0.78, 1.28))
        image = ImageEnhance.Brightness(image).enhance(rng.uniform(0.90, 1.08))
        image = image.rotate(rng.uniform(-1.8, 1.8), resample=Image.Resampling.BILINEAR, fillcolor=255)
        if rng.random() < 0.35:
            image = image.filter(ImageFilter.GaussianBlur(rng.uniform(0.0, 0.55)))
    scale = min(WIDTH / image.width, HEIGHT / image.height)
    resized = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), Image.Resampling.BILINEAR)
    canvas = Image.new("L", (WIDTH, HEIGHT), 255)
    canvas.paste(resized, ((WIDTH - resized.width) // 2, (HEIGHT - resized.height) // 2))
    values = 1.0 - np.asarray(canvas, dtype=np.float32) / 255.0
    if augment:
        noise = np.random.default_rng(rng.randrange(2**32)).normal(0, rng.uniform(0.0, 0.012), values.shape)
        values = np.clip(values + noise, 0, 1)
    return torch.from_numpy(values.astype(np.float32)).unsqueeze(0)


class WholeAnswerNet(nn.Module):
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


def decode(outputs):
    length_logits, tens_logits, ones_logits = outputs
    length_probs, tens_probs, ones_probs = (value.softmax(-1) for value in outputs)
    lengths, tens, ones = length_probs.argmax(-1), tens_probs.argmax(-1), ones_probs.argmax(-1)
    rows = []
    for index in range(len(lengths)):
        if int(lengths[index]) == 1:
            read = f"{int(tens[index])}{int(ones[index])}"
            probabilities = [length_probs[index, 1], tens_probs[index, tens[index]], ones_probs[index, ones[index]]]
        else:
            read = str(int(ones[index]))
            probabilities = [length_probs[index, 0], ones_probs[index, ones[index]]]
        rows.append((read, float(torch.stack(probabilities).min()), float(torch.stack(probabilities).mean())))
    return rows


class AuthenticDataset(Dataset):
    def __init__(self, entries, augment=False, seed=0):
        self.entries = entries
        self.augment = augment
        self.seed = seed

    def __len__(self):
        return len(self.entries)

    def __getitem__(self, index):
        entry = self.entries[index]
        text = str(entry["truth"])
        rng = random.Random((self.seed * 1_000_003) + index + random.randrange(1_000_000) if self.augment else index)
        image_path = entry.get("recognitionPath") or entry.get("imagePath")
        image = prepare_image(Image.open(resolve(image_path)), augment=self.augment, rng=rng)
        return image, len(text) - 1, int(text[-2]) if len(text) == 2 else -100, int(text[-1]), entry


class SyntheticDataset(Dataset):
    def __init__(self, count, seed, mnist, emnist):
        self.count, self.seed, self.mnist, self.emnist = count, seed, mnist, emnist
        self.by_digit = []
        for source in (mnist, emnist):
            buckets = defaultdict(list)
            for index, label in enumerate(source.targets.tolist()):
                if 0 <= int(label) <= 9:
                    buckets[int(label)].append(index)
            self.by_digit.append(buckets)

    def __len__(self):
        return self.count

    def digit_image(self, digit, rng):
        source_index = rng.randrange(2)
        source = self.mnist if source_index == 0 else self.emnist
        index = rng.choice(self.by_digit[source_index][digit])
        image = source[index][0].convert("L")
        if source_index == 1:
            image = image.transpose(Image.Transpose.ROTATE_90).transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        return image

    def __getitem__(self, index):
        rng = random.Random(self.seed * 10_000_019 + index)
        two_digit = rng.random() < 0.58
        text = str(rng.randint(10, 50)) if two_digit else str(rng.randint(0, 9))
        canvas = Image.new("L", (WIDTH, HEIGHT), rng.randint(218, 250))
        pixels = np.asarray(canvas, dtype=np.int16).copy()
        yy, xx = np.mgrid[:HEIGHT, :WIDTH]
        gradient = ((xx - WIDTH / 2) * rng.uniform(-0.025, 0.025) + (yy - HEIGHT / 2) * rng.uniform(-0.08, 0.08))
        noise = np.random.default_rng(self.seed + index).normal(0, rng.uniform(0.5, 3.0), pixels.shape)
        canvas = Image.fromarray(np.clip(pixels + gradient + noise, 0, 255).astype(np.uint8), "L")
        draw = ImageDraw.Draw(canvas)
        box_width = rng.randint(88, 108) if two_digit else rng.randint(47, 61)
        left = (WIDTH - box_width) // 2 + rng.randint(-5, 5)
        top = rng.randint(2, 8)
        bottom = HEIGHT - rng.randint(2, 8)
        border = rng.randint(25, 105)
        line_width = rng.randint(1, 2)
        draw.rectangle((left, top, left + box_width, bottom), outline=border, width=line_width)
        if two_digit:
            divider = left + box_width // 2 + rng.randint(-2, 2)
            gap = rng.randint(5, 11)
            draw.line((divider, top, divider, top + gap), fill=border, width=line_width)
            draw.line((divider, bottom - gap, divider, bottom), fill=border, width=line_width)
        cell_width = box_width / len(text)
        for position, char in enumerate(text):
            digit = int(char)
            source = self.digit_image(digit, rng)
            bbox = source.getbbox() or (0, 0, source.width, source.height)
            source = source.crop(bbox)
            target_h = rng.randint(34, 54)
            target_w = max(10, round(source.width * target_h / source.height * rng.uniform(0.78, 1.10)))
            source = source.resize((target_w, target_h), Image.Resampling.BILINEAR)
            source = source.rotate(rng.uniform(-8, 8), resample=Image.Resampling.BILINEAR, expand=True, fillcolor=0)
            alpha = np.asarray(source, dtype=np.float32) / 255.0
            pencil = rng.randint(45, 155)
            glyph = Image.fromarray(np.clip(255 - alpha * (255 - pencil), 0, 255).astype(np.uint8), "L")
            x_center = left + cell_width * (position + 0.5) + rng.uniform(-cell_width * 0.14, cell_width * 0.14)
            y_center = (top + bottom) / 2 + rng.uniform(-5, 6)
            x = round(x_center - glyph.width / 2)
            y = round(y_center - glyph.height / 2)
            mask = Image.fromarray(np.clip(alpha * 255, 0, 255).astype(np.uint8), "L")
            canvas.paste(glyph, (x, y), mask)
        image = prepare_image(canvas, augment=rng.random() < 0.45, rng=rng)
        return image, len(text) - 1, int(text[-2]) if len(text) == 2 else -100, int(text[-1]), {"truth": text}


def collate(batch):
    images, lengths, tens, ones, entries = zip(*batch)
    return torch.stack(images), torch.tensor(lengths), torch.tensor(tens), torch.tensor(ones), entries


def train_epoch(model, loader, optimizer, device):
    model.train()
    losses = []
    cross_entropy = nn.CrossEntropyLoss()
    for images, lengths, tens, ones, _ in loader:
        images, lengths, tens, ones = images.to(device), lengths.to(device), tens.to(device), ones.to(device)
        optimizer.zero_grad(set_to_none=True)
        length_logits, tens_logits, ones_logits = model(images)
        loss = cross_entropy(length_logits, lengths) + cross_entropy(ones_logits, ones)
        two_digit = tens >= 0
        if bool(two_digit.any()):
            loss = loss + cross_entropy(tens_logits[two_digit], tens[two_digit])
        loss.backward()
        nn.utils.clip_grad_norm_(model.parameters(), 2.0)
        optimizer.step()
        losses.append(float(loss.detach().cpu()))
    return sum(losses) / len(losses)


def evaluate(model, entries, batch_size, device):
    loader = DataLoader(AuthenticDataset(entries), batch_size=batch_size, shuffle=False, collate_fn=collate)
    rows = []
    model.eval()
    started = time.time()
    with torch.inference_mode():
        for images, _, _, _, batch_entries in loader:
            decoded = decode(model(images.to(device)))
            for entry, (read, minimum, mean) in zip(batch_entries, decoded):
                truth = str(entry["truth"])
                rows.append({
                    "uid": entry.get("uid"), "packetId": entry.get("packetId"), "captureId": entry.get("captureId"),
                    "layoutId": entry.get("layoutId"), "questionNum": entry.get("questionNum"), "split": entry.get("split"),
                    "truth": truth, "read": read, "correct": read == truth,
                    "minComponentProbability": round(minimum, 6), "meanComponentProbability": round(mean, 6),
                })
    return rows, round(time.time() - started, 3)


def summary(rows):
    return {"total": len(rows), "correct": sum(row["correct"] for row in rows), "accuracyPct": round(100 * sum(row["correct"] for row in rows) / len(rows), 1) if rows else 0}


def main():
    opts = parse_args()
    random.seed(opts.seed)
    np.random.seed(opts.seed)
    torch.manual_seed(opts.seed)
    device = choose_device(opts.device)
    source = json.loads(resolve(opts.manifest).read_text())
    entries = [entry for entry in source["entries"] if str(entry.get("truth", "")).isdigit() and 1 <= len(str(entry["truth"])) <= 2]
    groups = defaultdict(list)
    for entry in entries:
        groups[entry["split"]].append(entry)
    recent_source = json.loads(resolve(opts.recent_manifest).read_text())
    recent = [entry for entry in recent_source["entries"] if entry.get("truthState") == "value" and str(entry.get("truth", "")).isdigit() and len(str(entry["truth"])) <= 2]

    mnist = MNIST(ROOT / "datasets/external", train=True, download=False)
    emnist = EMNIST(ROOT / "datasets/external", split="digits", train=True, download=False)
    model = WholeAnswerNet().to(device)
    synthetic = SyntheticDataset(opts.synthetic_samples, opts.seed, mnist, emnist)
    synthetic_loader = DataLoader(synthetic, batch_size=opts.batch_size, shuffle=True, collate_fn=collate, num_workers=0)
    optimizer = torch.optim.AdamW(model.parameters(), lr=8e-4, weight_decay=2e-4)
    synthetic_history = []
    for epoch in range(1, opts.synthetic_epochs + 1):
        started = time.time()
        loss = train_epoch(model, synthetic_loader, optimizer, device)
        record = {"epoch": epoch, "loss": round(loss, 5), "seconds": round(time.time() - started, 2)}
        synthetic_history.append(record)
        print(json.dumps({"phase": "synthetic", **record}), flush=True)

    train_loader = DataLoader(AuthenticDataset(groups["development"], augment=True, seed=opts.seed), batch_size=min(opts.batch_size, 32), shuffle=True, collate_fn=collate)
    optimizer = torch.optim.AdamW(model.parameters(), lr=2.5e-4, weight_decay=3e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=opts.finetune_epochs)
    best_state, best_accuracy, best_epoch, stale, history = None, -1, None, 0, []
    for epoch in range(1, opts.finetune_epochs + 1):
        started = time.time()
        loss = train_epoch(model, train_loader, optimizer, device)
        scheduler.step()
        validation_rows, _ = evaluate(model, groups["validation"], opts.batch_size, device)
        result = summary(validation_rows)
        record = {"epoch": epoch, "loss": round(loss, 5), "validation": result, "seconds": round(time.time() - started, 2)}
        history.append(record)
        print(json.dumps({"phase": "authentic", **record}), flush=True)
        if result["correct"] > best_accuracy:
            best_accuracy, best_epoch, stale = result["correct"], epoch, 0
            best_state = copy.deepcopy(model.state_dict())
        else:
            stale += 1
            if stale >= opts.patience:
                break

    model.load_state_dict(best_state)
    validation_rows, validation_seconds = evaluate(model, groups["validation"], opts.batch_size, device)
    holdout_rows, holdout_seconds = evaluate(model, groups["holdout"], opts.batch_size, device)
    recent_rows, recent_seconds = evaluate(model, recent, opts.batch_size, device)
    opts.model_out.parent.mkdir(parents=True, exist_ok=True)
    torch.save({"state_dict": model.cpu().state_dict(), "height": HEIGHT, "width": WIDTH, "seed": opts.seed, "maxDigits": 2}, opts.model_out)
    dummy = torch.randn(1, 1, HEIGHT, WIDTH)
    torch.onnx.export(model.cpu(), dummy, opts.onnx_out, input_names=["image"], output_names=["length", "tens", "ones"], dynamic_axes={"image": {0: "batch"}, "length": {0: "batch"}, "tens": {0: "batch"}, "ones": {0: "batch"}}, opset_version=17, dynamo=False)
    report = {
        "schemaVersion": 1, "generatedAt": datetime.now(timezone.utc).isoformat(),
        "purpose": "Key-blind local larger-grayscale reader pretrained on locally available synthetic boxed MNIST/EMNIST answers.",
        "answerKeyProvidedToModel": False, "device": device, "seed": opts.seed,
        "trainingBoundary": "Only historical development entries were used for authentic gradient updates. Historical validation/holdout and all four recent packets were evaluation-only.",
        "historicalManifest": str(opts.manifest), "recentManifest": str(opts.recent_manifest),
        "syntheticSamples": opts.synthetic_samples, "syntheticHistory": synthetic_history, "authenticHistory": history, "selectedEpoch": best_epoch,
        "parameters": sum(parameter.numel() for parameter in model.parameters()), "modelPath": str(opts.model_out), "onnxPath": str(opts.onnx_out),
        "validation": summary(validation_rows), "holdout": summary(holdout_rows), "recent": summary(recent_rows),
        "validationSeconds": validation_seconds, "holdoutSeconds": holdout_seconds, "recentSeconds": recent_seconds,
        "validationRows": validation_rows, "holdoutRows": holdout_rows, "recentRows": recent_rows,
    }
    opts.report_out.parent.mkdir(parents=True, exist_ok=True)
    opts.report_out.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"selectedEpoch": best_epoch, "validation": report["validation"], "holdout": report["holdout"], "recent": report["recent"], "parameters": report["parameters"]}, indent=2))


if __name__ == "__main__":
    main()
