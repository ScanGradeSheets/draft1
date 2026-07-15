#!/usr/bin/env python3
"""Small key-blind LoRA feasibility test for ScanGrade answer crops.

The page-block holdout is evaluated only once, after selecting the best epoch on
the page-block validation set. This is still an R&D split because student IDs are
missing from the historical corpus.
"""

import argparse
import copy
import json
import random
import re
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import torch
from peft import LoraConfig, PeftModel, get_peft_model, get_peft_model_state_dict, set_peft_model_state_dict
from PIL import Image, ImageEnhance, ImageOps
from torch.utils.data import DataLoader, Dataset
from transformers import TrOCRProcessor, VisionEncoderDecoderModel


TRUTH = Path("private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json")


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=TRUTH)
    parser.add_argument("--image-field", default="cropPath")
    parser.add_argument("--model", default="microsoft/trocr-base-handwritten")
    parser.add_argument("--out", type=Path, default=Path("private-evidence/reports/trocr-lora-feasibility-20260709.json"))
    parser.add_argument("--adapter-out", type=Path, default=Path("private-evidence/models/trocr-lora-feasibility-20260709"))
    parser.add_argument("--epochs", type=int, default=8)
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--learning-rate", type=float, default=5e-4)
    parser.add_argument("--rank", type=int, default=8)
    parser.add_argument("--init-adapter", type=Path, help="Continue training an existing compatible LoRA adapter.")
    parser.add_argument("--seed", type=int, default=17)
    parser.add_argument("--device", choices=("auto", "cpu", "mps"), default="auto")
    parser.add_argument("--skip-holdout", action="store_true", help="Select using validation only and leave the holdout untouched.")
    return parser.parse_args()


def normalize(value):
    return "".join(re.findall(r"\d", str(value or "")))


def research_split(entry):
    if entry.get("split") in ("development", "validation", "holdout"):
        return entry["split"]
    packet_index = max(0, int(entry.get("pageIndex") or 0) // 10)
    if packet_index >= 7:
        return "holdout"
    if packet_index >= 5:
        return "validation"
    return "development"


def layout_family(layout_id):
    return "row" if re.search(r"sg-g1-lw-0[1-5]-", layout_id or "") else "non-row"


def read_image(path, augment=False):
    image = Image.open(path).convert("RGB")
    if augment and random.random() < 0.5:
        gray = ImageOps.grayscale(image)
        gray = ImageEnhance.Contrast(gray).enhance(random.uniform(1.2, 1.9))
        image = Image.merge("RGB", (gray, gray, gray))
    return image


class CropDataset(Dataset):
    def __init__(self, entries, augment=False):
        self.entries = entries
        self.augment = augment

    def __len__(self):
        return len(self.entries)

    def __getitem__(self, index):
        entry = self.entries[index]
        return read_image(entry["cropPath"], self.augment), normalize(entry.get("truth")), entry


def collator(processor):
    pad_id = processor.tokenizer.pad_token_id

    def make(batch):
        images, texts, entries = zip(*batch)
        pixels = processor(images=list(images), return_tensors="pt").pixel_values
        tokens = processor.tokenizer(list(texts), padding=True, max_length=8, truncation=True, return_tensors="pt")
        labels = tokens.input_ids
        labels[labels == pad_id] = -100
        return pixels, labels, entries

    return make


def summarize(rows):
    total = len(rows)
    correct = sum(row["correct"] for row in rows)
    return {"total": total, "correct": correct, "exactAccuracyPct": round(100 * correct / total, 1) if total else 0}


def evaluate(model, processor, entries, batch_size, device):
    loader = DataLoader(CropDataset(entries), batch_size=batch_size, shuffle=False, collate_fn=collator(processor))
    rows = []
    model.eval()
    started = time.time()
    with torch.inference_mode():
        for pixels, _, batch_entries in loader:
            generated = model.generate(
                pixel_values=pixels.to(device), max_new_tokens=8, num_beams=1,
                return_dict_in_generate=True, output_scores=True,
            )
            sequences = generated.sequences
            outputs = processor.batch_decode(sequences, skip_special_tokens=True)
            step_probabilities = []
            for step, scores in enumerate(generated.scores):
                chosen = sequences[:, step + 1]
                step_probabilities.append(torch.softmax(scores.float(), dim=-1).gather(1, chosen[:, None]).squeeze(1).cpu())
            probability_matrix = torch.stack(step_probabilities, dim=1) if step_probabilities else torch.empty((len(outputs), 0))
            for row_index, (entry, raw) in enumerate(zip(batch_entries, outputs)):
                truth = normalize(entry.get("truth"))
                read = normalize(raw)
                token_probs = probability_matrix[row_index].tolist()
                rows.append({
                    "captureId": entry.get("captureId"),
                    "pageIndex": entry.get("pageIndex"),
                    "questionLabel": entry.get("questionLabel"),
                    "layoutId": entry.get("layoutId"),
                    "layoutFamily": layout_family(entry.get("layoutId")),
                    "truthStatus": entry.get("truthStatus"),
                    "cropPath": entry.get("cropPath"),
                    "handwrittenTruth": truth,
                    "answerKey": normalize(entry.get("expected")),
                    "appPrediction": normalize(entry.get("appPrediction")),
                    "appReview": bool(entry.get("review")),
                    "rawModelOutput": raw,
                    "modelRead": read,
                    "meanTokenProbability": round(sum(token_probs) / len(token_probs), 6) if token_probs else 0,
                    "minTokenProbability": round(min(token_probs), 6) if token_probs else 0,
                    "correct": read == truth,
                })
    return rows, round(time.time() - started, 2)


def device_for(requested):
    if requested != "auto":
        return requested
    return "mps" if torch.backends.mps.is_available() else "cpu"


def main():
    opts = parse_args()
    random.seed(opts.seed)
    torch.manual_seed(opts.seed)
    device = device_for(opts.device)

    source = json.loads(opts.source.read_text())
    entries = []
    for original in source.get("entries", []):
        entry = dict(original)
        if entry.get(opts.image_field):
            entry["cropPath"] = entry[opts.image_field]
        elif not entry.get("cropPath") and entry.get("imagePath"):
            entry["cropPath"] = entry["imagePath"]
        if entry.get("cropPath") and entry.get("truthStatus") not in ("needs-label", "unclear", "blank"):
            entries.append(entry)
    groups = defaultdict(list)
    for entry in entries:
        groups[research_split(entry)].append(entry)

    processor = TrOCRProcessor.from_pretrained(opts.model)
    base = VisionEncoderDecoderModel.from_pretrained(opts.model)
    # Generation config carries these in the published checkpoint, while the
    # training forward pass reads them from the model config.
    base.config.decoder_start_token_id = processor.tokenizer.cls_token_id
    base.config.pad_token_id = processor.tokenizer.pad_token_id
    base.config.eos_token_id = processor.tokenizer.sep_token_id
    base.config.vocab_size = base.config.decoder.vocab_size
    if opts.init_adapter:
        model = PeftModel.from_pretrained(base, str(opts.init_adapter), is_trainable=True).to(device)
    else:
        config = LoraConfig(
            r=opts.rank,
            lora_alpha=opts.rank * 2,
            lora_dropout=0.05,
            target_modules=["q_proj", "v_proj"],
            bias="none",
        )
        model = get_peft_model(base, config).to(device)
    trainable = sum(parameter.numel() for parameter in model.parameters() if parameter.requires_grad)
    total = sum(parameter.numel() for parameter in model.parameters())
    optimizer = torch.optim.AdamW((p for p in model.parameters() if p.requires_grad), lr=opts.learning_rate, weight_decay=0.01)
    train_loader = DataLoader(
        CropDataset(groups["development"], augment=True),
        batch_size=opts.batch_size,
        shuffle=True,
        collate_fn=collator(processor),
    )

    epochs = []
    best_accuracy = -1
    best_epoch = None
    best_state = None
    for epoch in range(1, opts.epochs + 1):
        model.train()
        losses = []
        started = time.time()
        for step, (pixels, labels, _) in enumerate(train_loader, 1):
            optimizer.zero_grad(set_to_none=True)
            result = model(pixel_values=pixels.to(device), labels=labels.to(device))
            result.loss.backward()
            torch.nn.utils.clip_grad_norm_((p for p in model.parameters() if p.requires_grad), 1.0)
            optimizer.step()
            losses.append(float(result.loss.detach().cpu()))
            if step % 20 == 0:
                print(f"epoch={epoch} step={step}/{len(train_loader)} loss={sum(losses[-20:]) / len(losses[-20:]):.4f}", flush=True)
        validation_rows, validation_seconds = evaluate(model, processor, groups["validation"], opts.batch_size, device)
        validation = summarize(validation_rows)
        epoch_row = {
            "epoch": epoch,
            "meanTrainLoss": round(sum(losses) / len(losses), 4),
            "trainSeconds": round(time.time() - started - validation_seconds, 2),
            "validationSeconds": validation_seconds,
            "validation": validation,
        }
        epochs.append(epoch_row)
        print(json.dumps(epoch_row), flush=True)
        if validation["exactAccuracyPct"] > best_accuracy:
            best_accuracy = validation["exactAccuracyPct"]
            best_epoch = epoch
            best_state = copy.deepcopy(get_peft_model_state_dict(model))

    set_peft_model_state_dict(model, best_state)
    opts.adapter_out.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(opts.adapter_out)
    validation_rows, validation_seconds = evaluate(model, processor, groups["validation"], opts.batch_size, device)
    # The holdout is touched exactly once, after validation-based epoch selection,
    # unless this is a validation-only candidate search.
    holdout_rows, holdout_seconds = ([], 0)
    if not opts.skip_holdout:
        holdout_rows, holdout_seconds = evaluate(model, processor, groups["holdout"], opts.batch_size, device)

    report = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "baseModel": opts.model,
        "method": "LoRA on decoder q_proj/v_proj",
        "answerKeyProvidedToModel": False,
        "source": str(opts.source),
        "imageField": opts.image_field,
        "splitWarning": source.get("splitWarning", "Page-block R&D split only; corpus has no durable student or packet identifier."),
        "holdoutEvaluated": not opts.skip_holdout,
        "device": device,
        "seed": opts.seed,
        "rank": opts.rank,
        "initialAdapter": str(opts.init_adapter) if opts.init_adapter else None,
        "learningRate": opts.learning_rate,
        "trainableParameters": trainable,
        "totalParameters": total,
        "splitCounts": {key: len(value) for key, value in groups.items()},
        "epochs": epochs,
        "selectedEpoch": best_epoch,
        "validation": summarize(validation_rows),
        "validationSeconds": validation_seconds,
        "holdout": summarize(holdout_rows),
        "holdoutSeconds": holdout_seconds,
        "adapterPath": str(opts.adapter_out),
        "validationRows": validation_rows,
        "holdoutRows": holdout_rows,
    }
    opts.out.parent.mkdir(parents=True, exist_ok=True)
    opts.out.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"selectedEpoch": best_epoch, "validation": report["validation"], "holdout": report["holdout"]}, indent=2))
    print(opts.out)


if __name__ == "__main__":
    main()
