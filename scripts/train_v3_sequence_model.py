#!/usr/bin/env python3
"""Train a compact key-blind whole-answer reader on V3 continuous zones."""

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
from PIL import Image, ImageEnhance
from torch import nn
from torch.utils.data import DataLoader, Dataset

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = ROOT / "private-evidence/v3/continuous-answer-zones/manifest.json"
DEFAULT_MODEL = ROOT / "private-evidence/models/v3-sequence/model.pt"
DEFAULT_ONNX = ROOT / "private-evidence/models/v3-sequence/model.onnx"
DEFAULT_REPORT = ROOT / "private-evidence/reports/v3-sequence.json"
DEFAULT_INIT = ROOT / "models/worksheet-digit-generalist-final.pt"
HEIGHT, WIDTH = 64, 192


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--model-out", type=Path, default=DEFAULT_MODEL)
    parser.add_argument("--onnx-out", type=Path, default=DEFAULT_ONNX)
    parser.add_argument("--report-out", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--init-checkpoint", type=Path, default=DEFAULT_INIT)
    parser.add_argument("--image-field", default="recognitionPath")
    parser.add_argument("--epochs", type=int, default=55)
    parser.add_argument("--batch-size", type=int, default=24)
    parser.add_argument("--learning-rate", type=float, default=7e-4)
    parser.add_argument("--patience", type=int, default=12)
    parser.add_argument("--seed", type=int, default=31)
    parser.add_argument("--device", choices=("auto", "cpu", "mps"), default="auto")
    parser.add_argument("--skip-holdout", action="store_true", help="Select a candidate using validation only; do not touch the holdout.")
    return parser.parse_args()


def resolve(path):
    return path if path.is_absolute() else ROOT / path


def prepare_image(path, augment=False):
    image = Image.open(path).convert("L")
    if augment:
        if random.random() < .8:
            image = ImageEnhance.Contrast(image).enhance(random.uniform(.76, 1.35))
        if random.random() < .7:
            image = ImageEnhance.Brightness(image).enhance(random.uniform(.86, 1.12))
        if random.random() < .65:
            image = image.rotate(random.uniform(-2.5, 2.5), resample=Image.Resampling.BILINEAR, fillcolor=255)
    scale = min(WIDTH / image.width, HEIGHT / image.height)
    resized = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), Image.Resampling.BILINEAR)
    canvas = Image.new("L", (WIDTH, HEIGHT), 255)
    canvas.paste(resized, ((WIDTH - resized.width) // 2, (HEIGHT - resized.height) // 2))
    values = 1.0 - np.asarray(canvas, dtype=np.float32) / 255.0
    if augment and random.random() < .6:
        values = np.clip(values * random.uniform(.8, 1.22) + np.random.normal(0, random.uniform(0, .018), values.shape), 0, 1)
    return torch.from_numpy(values.astype(np.float32)).unsqueeze(0)


class AnswerDataset(Dataset):
    def __init__(self, entries, augment=False, image_field="recognitionPath"):
        self.entries = entries
        self.augment = augment
        self.image_field = image_field

    def __len__(self):
        return len(self.entries)

    def __getitem__(self, index):
        entry = self.entries[index]
        text = str(entry["truth"])
        tens = int(text[-2]) if len(text) == 2 else -100
        ones = int(text[-1])
        return prepare_image(resolve(Path(entry[self.image_field])), self.augment), len(text) - 1, tens, ones, entry


def collate(batch):
    images, lengths, tens, ones, entries = zip(*batch)
    return torch.stack(images), torch.tensor(lengths), torch.tensor(tens), torch.tensor(ones), entries


class WholeAnswerNet(nn.Module):
    """Current worksheet contract supports one- and two-digit answers."""

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
        self.shared = nn.Sequential(nn.Flatten(), nn.Linear(96 * 4 * 12, 256), nn.ReLU(), nn.Dropout(.18))
        self.length_head = nn.Linear(256, 2)
        self.tens_head = nn.Linear(256, 10)
        self.ones_head = nn.Linear(256, 10)

    def forward(self, images):
        features = self.shared(self.features(images))
        return self.length_head(features), self.tens_head(features), self.ones_head(features)


def decode(outputs):
    length_logits, tens_logits, ones_logits = outputs
    length_probs, tens_probs, ones_probs = (item.softmax(-1) for item in (length_logits, tens_logits, ones_logits))
    lengths = length_probs.argmax(-1)
    tens = tens_probs.argmax(-1)
    ones = ones_probs.argmax(-1)
    rows = []
    for index in range(len(lengths)):
        if int(lengths[index]) == 1:
            read = f"{int(tens[index])}{int(ones[index])}"
            probabilities = [float(length_probs[index, 1]), float(tens_probs[index, tens[index]]), float(ones_probs[index, ones[index]])]
        else:
            read = str(int(ones[index]))
            probabilities = [float(length_probs[index, 0]), float(ones_probs[index, ones[index]])]
        rows.append((read, probabilities))
    return rows


def summarize(rows):
    total = len(rows)
    correct = sum(row["correct"] for row in rows)
    return {"total": total, "correct": correct, "exactAccuracyPct": round(100 * correct / total, 1) if total else 0}


def evaluate(model, entries, batch_size, device, image_field="recognitionPath"):
    loader = DataLoader(AnswerDataset(entries, image_field=image_field), batch_size=batch_size, shuffle=False, collate_fn=collate)
    rows = []
    model.eval()
    started = time.time()
    with torch.inference_mode():
        for images, _, _, _, batch_entries in loader:
            decoded = decode(model(images.to(device)))
            for entry, (read, probabilities) in zip(batch_entries, decoded):
                truth = str(entry["truth"])
                rows.append({
                    "uid": entry.get("uid"), "captureId": entry.get("captureId"), "pageIndex": entry.get("pageIndex"),
                    "layoutId": entry.get("layoutId"), "questionNum": entry.get("questionNum"), "split": entry.get("split"),
                    "truth": truth, "modelRead": read, "correct": read == truth,
                    "meanComponentProbability": round(sum(probabilities) / len(probabilities), 6),
                    "minComponentProbability": round(min(probabilities), 6),
                    "imagePath": entry.get("imagePath"), "quality": entry.get("quality"),
                })
    return rows, round(time.time() - started, 3)


def choose_device(requested):
    if requested != "auto":
        return requested
    return "mps" if torch.backends.mps.is_available() else "cpu"


def main():
    opts = parse_args()
    random.seed(opts.seed)
    np.random.seed(opts.seed)
    torch.manual_seed(opts.seed)
    device = choose_device(opts.device)
    source = json.loads(opts.manifest.read_text())
    entries = [entry for entry in source["entries"] if str(entry.get("truth", "")).isdigit() and 1 <= len(str(entry["truth"])) <= 2]
    groups = defaultdict(list)
    for entry in entries:
        groups[entry["split"]].append(entry)

    model = WholeAnswerNet().to(device)
    initialized_layers = []
    if opts.init_checkpoint and opts.init_checkpoint.exists():
        checkpoint = torch.load(opts.init_checkpoint, map_location="cpu", weights_only=False)
        source_state = checkpoint.get("state_dict", checkpoint)
        model_state = model.state_dict()
        for name, value in source_state.items():
            if name.startswith("features.") and name in model_state and model_state[name].shape == value.shape:
                model_state[name] = value
                initialized_layers.append(name)
        model.load_state_dict(model_state)
    optimizer = torch.optim.AdamW(model.parameters(), lr=opts.learning_rate, weight_decay=2e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=opts.epochs)
    cross_entropy = nn.CrossEntropyLoss()
    train_loader = DataLoader(AnswerDataset(groups["development"], augment=True, image_field=opts.image_field), batch_size=opts.batch_size, shuffle=True, collate_fn=collate)
    history, best_state, best_accuracy, best_epoch, stale = [], None, -1, None, 0
    for epoch in range(1, opts.epochs + 1):
        model.train()
        losses = []
        started = time.time()
        for images, lengths, tens, ones, _ in train_loader:
            optimizer.zero_grad(set_to_none=True)
            length_logits, tens_logits, ones_logits = model(images.to(device))
            loss = cross_entropy(length_logits, lengths.to(device)) + cross_entropy(ones_logits, ones.to(device))
            two_digit = tens >= 0
            if bool(two_digit.any()):
                loss = loss + cross_entropy(tens_logits[two_digit.to(device)], tens[two_digit].to(device))
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 2.0)
            optimizer.step()
            losses.append(float(loss.detach().cpu()))
        scheduler.step()
        validation_rows, validation_seconds = evaluate(model, groups["validation"], opts.batch_size, device, opts.image_field)
        validation = summarize(validation_rows)
        record = {"epoch": epoch, "meanLoss": round(sum(losses) / len(losses), 5), "trainSeconds": round(time.time() - started - validation_seconds, 2), "validation": validation}
        history.append(record)
        print(json.dumps(record), flush=True)
        if validation["exactAccuracyPct"] > best_accuracy:
            best_accuracy, best_epoch, stale = validation["exactAccuracyPct"], epoch, 0
            best_state = copy.deepcopy(model.state_dict())
        else:
            stale += 1
            if stale >= opts.patience:
                break

    model.load_state_dict(best_state)
    validation_rows, validation_seconds = evaluate(model, groups["validation"], opts.batch_size, device, opts.image_field)
    holdout_rows, holdout_seconds = ([], 0)
    if not opts.skip_holdout:
        holdout_rows, holdout_seconds = evaluate(model, groups["holdout"], opts.batch_size, device, opts.image_field)
    opts.model_out.parent.mkdir(parents=True, exist_ok=True)
    torch.save({"state_dict": model.cpu().state_dict(), "height": HEIGHT, "width": WIDTH, "seed": opts.seed, "maxDigits": 2}, opts.model_out)
    dummy = torch.randn(1, 1, HEIGHT, WIDTH)
    torch.onnx.export(model.cpu(), dummy, opts.onnx_out, input_names=["image"], output_names=["length", "tens", "ones"], dynamic_axes={"image": {0: "batch"}, "length": {0: "batch"}, "tens": {0: "batch"}, "ones": {0: "batch"}}, opset_version=17, dynamo=False)
    by_layout, by_length = defaultdict(list), defaultdict(list)
    for row in holdout_rows:
        by_layout[row["layoutId"]].append(row)
        by_length[str(len(row["truth"]))].append(row)
    report = {
        "generatedAt": datetime.now(timezone.utc).isoformat(), "architecture": "compact continuous-image CNN with length/tens/ones heads", "answerKeyProvidedToModel": False,
        "manifest": str(opts.manifest), "splitWarning": source.get("splitWarning"), "device": device, "seed": opts.seed,
        "parameters": sum(parameter.numel() for parameter in model.parameters()), "splitCounts": {key: len(value) for key, value in groups.items()},
        "initialCheckpoint": str(opts.init_checkpoint), "initializedFeatureTensors": initialized_layers,
        "imageField": opts.image_field,
        "holdoutEvaluated": not opts.skip_holdout,
        "history": history, "selectedEpoch": best_epoch, "validation": summarize(validation_rows), "validationSeconds": validation_seconds,
        "holdout": summarize(holdout_rows), "holdoutSeconds": holdout_seconds,
        "holdoutByLayout": {key: summarize(value) for key, value in sorted(by_layout.items())},
        "holdoutByAnswerLength": {key: summarize(value) for key, value in sorted(by_length.items())},
        "modelPath": str(opts.model_out), "onnxPath": str(opts.onnx_out), "validationRows": validation_rows, "holdoutRows": holdout_rows,
    }
    opts.report_out.parent.mkdir(parents=True, exist_ok=True)
    opts.report_out.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"selectedEpoch": best_epoch, "validation": report["validation"], "holdout": report["holdout"], "parameters": report["parameters"]}, indent=2))


if __name__ == "__main__":
    main()
