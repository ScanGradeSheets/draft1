#!/usr/bin/env python3
"""Create a private, visual audit pack for every remaining consensus review answer."""

from __future__ import annotations

import base64
import io
import json
import os
from collections import Counter, defaultdict
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SCORE = ROOT / "private-evidence/reports/consensus-integration-four-packet-score-20260714.json"
SCORE = ROOT / os.environ.get("SG_YELLOW_SCORE", str(DEFAULT_SCORE.relative_to(ROOT)))
OUT = ROOT / os.environ.get("SG_YELLOW_OUT", "private-evidence/reports/consensus-yellow-audit-20260714")
NONROW_ONLY = os.environ.get("SG_NONROW_ONLY") == "1"
PANEL_W = 1500
PANEL_H = 430
ROWS_PER_SHEET = 7

# Visual classification made from the primary grayscale, expanded context,
# browser cell crops, and 28x28 model inputs on the generated contact sheets.
# Indices are stable because SCORE is the frozen four-packet candidate report.
VISUAL_CLASSES = {
    "crop_or_registration_failure": {1, 6, 7, 10, 29, 50},
    "layout_or_slot_contract_failure": {9, 13, 24, 27, 49},
    "genuinely_ambiguous_handwriting": {25, 32, 51},
    "readable_crop_but_frame_instability": {3, 4, 11, 22, 23, 26, 30, 38, 40, 42, 45},
    "browser_preprocessing_conflict": {2, 21},
    "confidence_safety_veto": {31},
}


def visual_class(index: int) -> str:
    if SCORE != DEFAULT_SCORE or NONROW_ONLY:
        return "unclassified"
    for name, indices in VISUAL_CLASSES.items():
        if index in indices:
            return name
    return "readable_crop_compact_28x28_bottleneck"


def load_json(path: Path):
    return json.loads(path.read_text())


def data_image(value: str | None) -> Image.Image | None:
    if not value or "," not in value:
        return None
    try:
        return Image.open(io.BytesIO(base64.b64decode(value.split(",", 1)[1]))).convert("RGB")
    except Exception:
        return None


def font(size: int, bold: bool = False):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            pass
    return ImageFont.load_default()


FONT = font(24)
SMALL = font(19)
BOLD = font(26, True)


def fit(image: Image.Image | None, size: tuple[int, int], enhance: bool = False) -> Image.Image:
    if image is None:
        blank = Image.new("RGB", size, "#eeeeee")
        ImageDraw.Draw(blank).text((12, 12), "missing", fill="#777777", font=SMALL)
        return blank
    work = image.convert("L")
    if enhance:
        work = ImageOps.autocontrast(work, cutoff=0.5)
        work = ImageEnhance.Contrast(work).enhance(1.7)
    work = work.convert("RGB")
    work.thumbnail(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", size, "white")
    canvas.paste(work, ((size[0] - work.width) // 2, (size[1] - work.height) // 2))
    return canvas


def prediction_summary(debug: dict, question_num: int) -> str:
    group = next((g for g in debug.get("answerGroups", []) if int(g.get("questionNum", -1)) == question_num), {})
    ids = set(int(value) for value in group.get("digitBoxIds", []))
    bits = []
    for pred in debug.get("predictions", []):
        if int(pred.get("id", -1)) not in ids:
            continue
        top = "/".join(f"{item.get('digit')}:{item.get('confidence', 0):.2f}" for item in pred.get("topK", [])[:3])
        bits.append(f"d{pred.get('digit')} c{pred.get('confidence', 0):.2f} [{top}]")
    return " | ".join(bits)


def draw_wrapped(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, width: int, *, fill="#222222", face=SMALL, line=25):
    words = str(text).split()
    lines, current = [], ""
    for word in words:
        trial = f"{current} {word}".strip()
        if draw.textlength(trial, font=face) <= width or not current:
            current = trial
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    x, y = xy
    for item in lines:
        draw.text((x, y), item, fill=fill, font=face)
        y += line
    return y


def render_panel(index: int, row: dict, debug: dict, promotion: dict, decision: dict) -> Image.Image:
    panel = Image.new("RGB", (PANEL_W, PANEL_H), "white")
    draw = ImageDraw.Draw(panel)
    draw.rectangle((0, 0, PANEL_W - 1, PANEL_H - 1), outline="#b7bdc7", width=2)
    short_layout = row["layoutId"].replace("sg-g1-lw-", "")
    draw.text((18, 12), f"{index:02d}. {row['packetId']}  {short_layout}  Q{row['questionNum']}", fill="#111827", font=BOLD)
    draw.text(
        (18, 48),
        f"truth {row['truthText']}   browser {row['readText']}   large {decision.get('sequenceRead')}   compact {decision.get('compactRead')}",
        fill="#111827",
        font=FONT,
    )
    reason = promotion.get("reason", "unknown")
    draw_wrapped(draw, (18, 80), f"blocked: {reason}", 530, fill="#9a3412", face=SMALL)
    consensus = decision.get("sequenceFrameConsensus") or {}
    draw_wrapped(
        draw,
        (18, 135),
        f"large frames {consensus.get('count', 0)}/{consensus.get('usableFrameCount', 0)}; min {consensus.get('minConfidence', 0):.3f}; "
        f"browser evidence: {prediction_summary(debug, row['questionNum'])}",
        530,
        face=SMALL,
    )

    primary_record = next((z for z in debug.get("v3AnswerZones", []) if int(z.get("questionNum", -1)) == row["questionNum"]), {})
    context_record = next((z for z in debug.get("v3ContextAnswerZones", []) if int(z.get("questionNum", -1)) == row["questionNum"]), {})
    primary = data_image(primary_record.get("imageDataUrl"))
    context = data_image(context_record.get("imageDataUrl"))
    group = next((g for g in debug.get("answerGroups", []) if int(g.get("questionNum", -1)) == row["questionNum"]), {})
    ids = [int(value) for value in group.get("digitBoxIds", [])]
    raw_images = [data_image(debug.get("rawCropDataUrls", [])[box_id]) for box_id in ids if box_id < len(debug.get("rawCropDataUrls", []))]
    model_images = [data_image(debug.get("modelInputDataUrls", [])[box_id]) for box_id in ids if box_id < len(debug.get("modelInputDataUrls", []))]

    columns = [
        (570, "primary grayscale", fit(primary, (210, 260), True)),
        (800, "expanded context", fit(context, (210, 260), True)),
        (1030, "browser raw cells", fit(join_images(raw_images), (210, 260), True)),
        (1260, "28×28 model input", fit(join_images(model_images), (210, 260), False)),
    ]
    for x, label, image in columns:
        draw.text((x, 96), label, fill="#374151", font=SMALL)
        panel.paste(image, (x, 128))
        draw.rectangle((x, 128, x + 210, 388), outline="#d1d5db", width=1)
    return panel


def join_images(images: list[Image.Image | None]) -> Image.Image | None:
    images = [image for image in images if image is not None]
    if not images:
        return None
    target_h = max(image.height for image in images)
    normalized = []
    for image in images:
        scale = target_h / max(1, image.height)
        normalized.append(image.resize((max(1, round(image.width * scale)), target_h), Image.Resampling.NEAREST))
    canvas = Image.new("RGB", (sum(image.width for image in normalized) + 8 * (len(normalized) - 1), target_h), "white")
    x = 0
    for image in normalized:
        canvas.paste(image, (x, 0))
        x += image.width + 8
    return canvas


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    score = load_json(SCORE)
    rows = [
        row for row in score["rows"]
        if row.get("scorable")
        and not row.get("automatic")
        and (not NONROW_ONLY or row.get("layoutFamily") == "non-row")
    ]
    records = []
    panels = []
    reason_counts = Counter()
    layout_counts = Counter()
    evidence_counts = Counter()
    visual_counts = Counter()
    for index, row in enumerate(rows, 1):
        debug = load_json(ROOT / row["debugFile"])
        promotion = next(item for item in debug["v3Shadow"]["consensusPromotionDecisions"] if int(item["questionNum"]) == row["questionNum"])
        decision = next(item for item in debug["v3Shadow"]["decisions"] if int(item["questionNum"]) == row["questionNum"])
        large_truth = decision.get("sequenceRead") == row["truthText"]
        compact_truth = decision.get("compactRead") == row["truthText"]
        browser_truth = row["readText"] == row["truthText"]
        reason_counts[promotion["reason"]] += 1
        layout_counts[row["layoutId"]] += 1
        evidence_counts[f"large={large_truth}|compact={compact_truth}|browser={browser_truth}"] += 1
        classification = visual_class(index)
        visual_counts[classification] += 1
        records.append({
            **row,
            "visualClassification": classification,
            "promotionReason": promotion["reason"],
            "promotionEvidence": promotion.get("evidence", {}),
            "ambiguityReasons": promotion.get("ambiguity", {}).get("reasons", []),
            "slotRead": decision.get("slotRead"),
            "largeRead": decision.get("sequenceRead"),
            "compactRead": decision.get("compactRead"),
            "largeConsensus": decision.get("sequenceFrameConsensus"),
            "compactConsensus": decision.get("compactFrameConsensus"),
            "largeMatchesTruth": large_truth,
            "compactMatchesTruth": compact_truth,
            "browserMatchesTruth": browser_truth,
        })
        panels.append(render_panel(index, row, debug, promotion, decision))

    for sheet_index in range(0, len(panels), ROWS_PER_SHEET):
        page_panels = panels[sheet_index:sheet_index + ROWS_PER_SHEET]
        page = Image.new("RGB", (PANEL_W, PANEL_H * len(page_panels)), "#eef1f5")
        for row_index, panel in enumerate(page_panels):
            page.paste(panel, (0, row_index * PANEL_H))
        page.save(OUT / f"yellow-contact-{sheet_index // ROWS_PER_SHEET + 1:02d}.jpg", quality=92)

    summary = {
        "schemaVersion": 1,
        "purpose": "Private visual and evidence inventory of every scorable answer left for review by the deployed consensus candidate.",
        "answerKeyUsedForRecognition": False,
        "truthUsedOnlyForAudit": True,
        "remainingReview": len(records),
        "reasonCounts": dict(reason_counts),
        "layoutCounts": dict(layout_counts),
        "evidenceCounts": dict(evidence_counts),
        "visualClassificationCounts": dict(visual_counts),
        "rows": records,
    }
    (OUT / "yellow-audit.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps({key: value for key, value in summary.items() if key != "rows"}, indent=2))


if __name__ == "__main__":
    main()
