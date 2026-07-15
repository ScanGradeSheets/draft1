#!/usr/bin/env python3
"""Render full canonical-page context for the six visual crop failures."""

from __future__ import annotations

import base64
import io
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
AUDIT = ROOT / "private-evidence/reports/consensus-yellow-audit-20260714/yellow-audit.json"
OUT = ROOT / "private-evidence/reports/crop-failure-geometry-audit-20260714"
INDICES = [1, 6, 7, 10, 29, 50]


def load(path: Path):
    return json.loads(path.read_text())


def image_from_data_url(value: str):
    return Image.open(io.BytesIO(base64.b64decode(value.split(",", 1)[1]))).convert("RGB")


def font(size=24):
    for path in ["/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Helvetica.ttc"]:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            pass
    return ImageFont.load_default()


def expand(rect, factor, width, height):
    cx, cy = rect["x"] + rect["w"] / 2, rect["y"] + rect["h"] / 2
    w, h = rect["w"] * factor, rect["h"] * factor
    x0, y0 = max(0, int(cx - w / 2)), max(0, int(cy - h / 2))
    x1, y1 = min(width, int(cx + w / 2)), min(height, int(cy + h / 2))
    return x0, y0, x1, y1


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rows = load(AUDIT)["rows"]
    panels, records = [], []
    face, small = font(26), font(20)
    for index in INDICES:
        row = rows[index - 1]
        debug = load(ROOT / row["debugFile"])
        question = int(row["questionNum"])
        primary = next(item for item in debug["v3AnswerZones"] if int(item["questionNum"]) == question)
        context = next(item for item in debug["v3ContextAnswerZones"] if int(item["questionNum"]) == question)
        page = image_from_data_url(debug["warpedDataUrl"])
        marked = page.copy()
        draw = ImageDraw.Draw(marked)
        pr, cr = primary["rect"], context["rect"]
        draw.rectangle((pr["x"], pr["y"], pr["x"] + pr["w"], pr["y"] + pr["h"]), outline="#e11d48", width=5)
        draw.rectangle((cr["x"], cr["y"], cr["x"] + cr["w"], cr["y"] + cr["h"]), outline="#2563eb", width=4)
        window = expand(pr, 5.0, page.width, page.height)
        local = marked.crop(window)
        local.thumbnail((720, 560), Image.Resampling.LANCZOS)
        primary_image = image_from_data_url(primary["imageDataUrl"])
        context_image = image_from_data_url(context["imageDataUrl"])
        primary_image.thumbnail((300, 360), Image.Resampling.LANCZOS)
        context_image.thumbnail((430, 360), Image.Resampling.LANCZOS)
        panel = Image.new("RGB", (1500, 660), "white")
        pd = ImageDraw.Draw(panel)
        pd.text((20, 14), f"#{index} {row['packetId']} {row['layoutId']} Q{question} truth {row['truthText']}", fill="#111827", font=face)
        pd.text((20, 52), "red = primary crop; blue = existing expanded context", fill="#374151", font=small)
        panel.paste(local, (20, 88))
        panel.paste(primary_image, (770, 150))
        panel.paste(context_image, (1060, 150))
        pd.text((770, 112), "primary", fill="#111827", font=small)
        pd.text((1060, 112), "context", fill="#111827", font=small)
        panels.append(panel)
        records.append({
            "index": index,
            "packetId": row["packetId"],
            "layoutId": row["layoutId"],
            "questionNum": question,
            "truthText": row["truthText"],
            "primaryRect": pr,
            "contextRect": cr,
            "warpedSize": {"width": page.width, "height": page.height},
            "debugFile": row["debugFile"],
        })
    sheet = Image.new("RGB", (1500, 660 * len(panels)), "#e5e7eb")
    for offset, panel in enumerate(panels):
        sheet.paste(panel, (0, offset * 660))
    sheet.save(OUT / "crop-failure-full-context.jpg", quality=94)
    (OUT / "geometry.json").write_text(json.dumps({"schemaVersion": 1, "rows": records}, indent=2) + "\n")
    print(json.dumps({"out": str(OUT.relative_to(ROOT)), "answers": len(records)}, indent=2))


if __name__ == "__main__":
    main()
