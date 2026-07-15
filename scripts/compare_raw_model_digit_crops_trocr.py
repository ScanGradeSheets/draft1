#!/usr/bin/env python3
"""Compare raw digit crops with the 28x28 classifier inputs using one recognizer."""

import argparse
import json
from pathlib import Path

import torch
from peft import PeftModel
from PIL import Image, ImageOps
from torch.utils.data import DataLoader, Dataset
from transformers import TrOCRProcessor, VisionEncoderDecoderModel


ROWS = Path("private-evidence/reports/digit-failure-dataset-20260705-current/digit-rows.json")
ADAPTER = Path("private-evidence/models/trocr-lora-calibrated-2epoch-20260709")


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="microsoft/trocr-base-handwritten")
    parser.add_argument("--adapter", type=Path, default=ADAPTER)
    parser.add_argument("--out", type=Path, default=Path("private-evidence/reports/raw-vs-model-digit-crops-trocr-20260709.json"))
    parser.add_argument("--batch-size", type=int, default=8)
    return parser.parse_args()


def image_path(row, kind):
    directory = Path(row["debugPath"]).parent
    index = int(row["detailId"]) + 1
    if kind == "raw":
        return directory / "raw-crops" / f"raw-{index:02d}.png"
    return directory / "model-inputs" / f"model-{index:02d}.png"


def load_image(row, kind):
    image = Image.open(image_path(row, "raw" if kind == "raw" else "model")).convert("RGB")
    if kind == "model_inverted":
        image = ImageOps.invert(image)
    return image


class Digits(Dataset):
    def __init__(self, rows, kind):
        self.rows = rows
        self.kind = kind

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, index):
        row = self.rows[index]
        return load_image(row, self.kind), row


def collator(processor):
    def make(batch):
        images, rows = zip(*batch)
        return processor(images=list(images), return_tensors="pt").pixel_values, rows
    return make


def evaluate(model, processor, rows, kind, batch_size, device):
    loader = DataLoader(Digits(rows, kind), batch_size=batch_size, shuffle=False, collate_fn=collator(processor))
    results = []
    model.eval()
    with torch.inference_mode():
        for pixels, batch_rows in loader:
            generated = model.generate(pixel_values=pixels.to(device), max_new_tokens=5, num_beams=1)
            reads = processor.batch_decode(generated, skip_special_tokens=True)
            for row, raw_read in zip(batch_rows, reads):
                read = "".join(character for character in raw_read if character.isdigit())
                truth = str(row["truthDigit"])
                results.append({
                    "uid": row["uid"],
                    "split": row["split"],
                    "family": row["family"],
                    "slotName": row["slotName"],
                    "truth": truth,
                    "currentDigit": str(row["detailDigit"]),
                    "rawRead": raw_read,
                    "read": read,
                    "correct": read == truth,
                })
    return results


def summary(rows):
    total = len(rows)
    correct = sum(row["correct"] for row in rows)
    return {"total": total, "correct": correct, "accuracyPct": round(100 * correct / total, 1)}


def main():
    opts = parse_args()
    rows = json.loads(ROWS.read_text())
    rows = [
        row for row in rows
        if row.get("truthDigit") is not None
        and row.get("split") in ("validation", "holdout")
        and image_path(row, "raw").exists()
        and image_path(row, "model").exists()
    ]
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    processor = TrOCRProcessor.from_pretrained(opts.model)
    base = VisionEncoderDecoderModel.from_pretrained(opts.model)
    model = PeftModel.from_pretrained(base, opts.adapter).to(device)

    conditions = {}
    for kind in ("raw", "model_black", "model_inverted"):
        print(kind, flush=True)
        result_rows = evaluate(model, processor, rows, kind, opts.batch_size, device)
        conditions[kind] = {
            "overall": summary(result_rows),
            "validation": summary([row for row in result_rows if row["split"] == "validation"]),
            "holdout": summary([row for row in result_rows if row["split"] == "holdout"]),
            "rows": result_rows,
        }
        print(json.dumps(conditions[kind]["overall"]), flush=True)

    transitions = {}
    raw_by_uid = {row["uid"] + ":" + row["slotName"]: row for row in conditions["raw"]["rows"]}
    for kind in ("model_black", "model_inverted"):
        became_wrong = became_right = 0
        for row in conditions[kind]["rows"]:
            prior = raw_by_uid[row["uid"] + ":" + row["slotName"]]
            became_wrong += int(prior["correct"] and not row["correct"])
            became_right += int(not prior["correct"] and row["correct"])
        transitions[kind] = {"rawCorrectBecameWrong": became_wrong, "rawWrongBecameCorrect": became_right}

    report = {
        "device": device,
        "answerKeyProvidedToModel": False,
        "methodWarning": "The adapter was trained on whole grey answer crops, so this comparison favors raw-like inputs. It nevertheless measures whether recognizable information survives normalization.",
        "conditions": conditions,
        "transitionsFromRaw": transitions,
    }
    opts.out.parent.mkdir(parents=True, exist_ok=True)
    opts.out.write_text(json.dumps(report, indent=2) + "\n")
    print(opts.out)


if __name__ == "__main__":
    main()
