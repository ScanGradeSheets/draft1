#!/usr/bin/env python3
"""Simulate capture-quality changes against the saved ScanGrade TrOCR adapter.

The existing crop is the best available reference. Synthetic degradation can
measure sensitivity but cannot prove the gain from a genuinely better recapture.
"""

import argparse
import io
import json
import re
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import torch
from peft import PeftModel
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
from torch.utils.data import DataLoader, Dataset
from torchvision.transforms.functional import InterpolationMode, perspective
from transformers import TrOCRProcessor, VisionEncoderDecoderModel


TRUTH = Path("private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json")
DEFAULT_ADAPTER = Path("private-evidence/models/trocr-lora-calibrated-2epoch-20260709")


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="microsoft/trocr-base-handwritten")
    parser.add_argument("--adapter", type=Path, default=DEFAULT_ADAPTER)
    parser.add_argument("--out", type=Path, default=Path("private-evidence/reports/capture-quality-simulation-20260709.json"))
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--device", choices=("auto", "cpu", "mps"), default="auto")
    parser.add_argument("--conditions", nargs="*")
    return parser.parse_args()


def normalize(value):
    return "".join(re.findall(r"\d", str(value or "")))


def split_for(entry):
    packet = max(0, int(entry.get("pageIndex") or 0) // 10)
    if packet >= 7:
        return "holdout"
    if packet >= 5:
        return "validation"
    return "development"


def layout_family(layout_id):
    return "row" if re.search(r"sg-g1-lw-0[1-5]-", layout_id or "") else "non-row"


def rgb_gray(gray):
    return Image.merge("RGB", (gray, gray, gray))


def transform(image, condition):
    image = image.convert("RGB")
    width, height = image.size
    if condition == "original":
        return image
    if condition == "enhanced":
        gray = ImageOps.autocontrast(ImageOps.grayscale(image), cutoff=1)
        gray = ImageEnhance.Contrast(gray).enhance(1.25)
        gray = ImageEnhance.Sharpness(gray).enhance(1.6)
        return rgb_gray(gray)
    if condition == "mild_blur":
        return image.filter(ImageFilter.GaussianBlur(0.7))
    if condition == "strong_blur":
        return image.filter(ImageFilter.GaussianBlur(1.4))
    if condition == "half_resolution":
        small = image.resize((max(1, width // 2), max(1, height // 2)), Image.Resampling.BILINEAR)
        return small.resize((width, height), Image.Resampling.BILINEAR)
    if condition == "shadow":
        values = np.asarray(image).astype(np.float32)
        gradient = np.linspace(0.48, 1.0, width, dtype=np.float32)[None, :, None]
        values = 255 - (255 - values) * gradient
        return Image.fromarray(np.clip(values, 0, 255).astype(np.uint8), "RGB")
    if condition == "jpeg35":
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=35, optimize=False)
        buffer.seek(0)
        return Image.open(buffer).convert("RGB")
    if condition == "local_perspective":
        start = [[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]]
        end = [[7, 3], [width - 4, 0], [width - 1, height - 5], [2, height - 1]]
        return perspective(image, start, end, InterpolationMode.BILINEAR, fill=255)
    if condition == "combined_poor":
        image = transform(image, "half_resolution")
        image = image.filter(ImageFilter.GaussianBlur(0.9))
        image = transform(image, "shadow")
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=40, optimize=False)
        buffer.seek(0)
        return Image.open(buffer).convert("RGB")
    raise ValueError(f"Unknown condition: {condition}")


class Crops(Dataset):
    def __init__(self, entries, condition):
        self.entries = entries
        self.condition = condition

    def __len__(self):
        return len(self.entries)

    def __getitem__(self, index):
        entry = self.entries[index]
        image = Image.open(entry["cropPath"])
        return transform(image, self.condition), entry


def make_collator(processor):
    def collate(batch):
        images, entries = zip(*batch)
        pixels = processor(images=list(images), return_tensors="pt").pixel_values
        return pixels, entries
    return collate


def summarize(rows):
    total = len(rows)
    correct = sum(row["correct"] for row in rows)
    return {"total": total, "correct": correct, "accuracyPct": round(100 * correct / total, 1) if total else 0}


def evaluate(model, processor, entries, condition, batch_size, device):
    loader = DataLoader(Crops(entries, condition), batch_size=batch_size, shuffle=False, collate_fn=make_collator(processor))
    rows = []
    started = time.time()
    model.eval()
    with torch.inference_mode():
        for pixels, batch_entries in loader:
            generated = model.generate(
                pixel_values=pixels.to(device),
                max_new_tokens=8,
                num_beams=1,
                return_dict_in_generate=True,
                output_scores=True,
            )
            reads = processor.batch_decode(generated.sequences, skip_special_tokens=True)
            step_probabilities = []
            for step, scores in enumerate(generated.scores):
                chosen = generated.sequences[:, step + 1]
                step_probabilities.append(
                    torch.softmax(scores.float(), dim=-1).gather(1, chosen[:, None]).squeeze(1).cpu()
                )
            probability_matrix = (
                torch.stack(step_probabilities, dim=1)
                if step_probabilities
                else torch.empty((len(batch_entries), 0))
            )
            for batch_index, (entry, raw) in enumerate(zip(batch_entries, reads)):
                truth = normalize(entry.get("truth"))
                read = normalize(raw)
                probabilities = probability_matrix[batch_index].tolist()
                rows.append({
                    "captureId": entry.get("captureId"),
                    "questionLabel": entry.get("questionLabel"),
                    "split": split_for(entry),
                    "layoutFamily": layout_family(entry.get("layoutId")),
                    "answerLength": len(truth),
                    "truth": truth,
                    "read": read,
                    "meanTokenProbability": round(sum(probabilities) / len(probabilities), 6) if probabilities else 0,
                    "minTokenProbability": round(min(probabilities), 6) if probabilities else 0,
                    "correct": read == truth,
                })
    elapsed = time.time() - started
    by_split = defaultdict(list)
    by_family = defaultdict(list)
    by_length = defaultdict(list)
    for row in rows:
        by_split[row["split"]].append(row)
        by_family[row["layoutFamily"]].append(row)
        by_length[str(row["answerLength"])].append(row)
    return {
        "overall": summarize(rows),
        "bySplit": {key: summarize(value) for key, value in sorted(by_split.items())},
        "byLayoutFamily": {key: summarize(value) for key, value in sorted(by_family.items())},
        "byAnswerLength": {key: summarize(value) for key, value in sorted(by_length.items())},
        "elapsedSeconds": round(elapsed, 2),
        "averageMsPerCrop": round(1000 * elapsed / len(rows), 1),
        "rows": rows,
    }


def main():
    opts = parse_args()
    conditions = opts.conditions or [
        "original", "enhanced", "mild_blur", "strong_blur", "half_resolution",
        "shadow", "jpeg35", "local_perspective", "combined_poor",
    ]
    device = opts.device if opts.device != "auto" else ("mps" if torch.backends.mps.is_available() else "cpu")
    source = json.loads(TRUTH.read_text())
    entries = [
        entry for entry in source.get("entries", [])
        if entry.get("cropPath")
        and entry.get("truthStatus") not in ("needs-label", "unclear", "blank")
        and split_for(entry) in ("validation", "holdout")
    ]

    processor = TrOCRProcessor.from_pretrained(opts.model)
    base = VisionEncoderDecoderModel.from_pretrained(opts.model)
    model = PeftModel.from_pretrained(base, opts.adapter).to(device)
    results = {}
    for condition in conditions:
        print(f"condition={condition}", flush=True)
        results[condition] = evaluate(model, processor, entries, condition, opts.batch_size, device)
        print(json.dumps(results[condition]["overall"]), flush=True)

    original_rows = results["original"]["rows"] if "original" in results else []
    original_by_key = {(row["captureId"], row["questionLabel"]): row for row in original_rows}
    transitions = {}
    for condition, result in results.items():
        if condition == "original" or not original_rows:
            continue
        changed_to_wrong = changed_to_right = unchanged = 0
        for row in result["rows"]:
            prior = original_by_key[(row["captureId"], row["questionLabel"])]
            if prior["correct"] and not row["correct"]:
                changed_to_wrong += 1
            elif not prior["correct"] and row["correct"]:
                changed_to_right += 1
            else:
                unchanged += 1
        transitions[condition] = {
            "originalCorrectBecameWrong": changed_to_wrong,
            "originalWrongBecameCorrect": changed_to_right,
            "unchangedCorrectness": unchanged,
        }

    report = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "model": opts.model,
        "adapter": str(opts.adapter),
        "device": device,
        "answerKeyProvidedToModel": False,
        "simulationWarning": "The original crop is the best available proxy, not a new high-quality recapture. Degradation measures sensitivity; enhancement cannot restore information absent from the source.",
        "conditions": results,
        "transitionsFromOriginal": transitions,
    }
    opts.out.parent.mkdir(parents=True, exist_ok=True)
    opts.out.write_text(json.dumps(report, indent=2) + "\n")
    print(opts.out)


if __name__ == "__main__":
    main()
