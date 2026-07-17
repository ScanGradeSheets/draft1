#!/usr/bin/env python3
"""Render the repaired P05 review set with matched grayscale evidence."""

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "private-evidence/v3/p05-strong-evidence-20260717/manifest.json"
REPORT = ROOT / "private-evidence/reports/p05-strong-evidence-view-benchmark-20260717.json"
SOURCE = ROOT / "private-evidence/debug-scans/2026-07-17"
OUT = ROOT / "private-evidence/reports/p05-repaired-residual-contact-sheet-20260717.png"


def fit(image, width=360, height=210):
    copy = image.convert("RGB")
    copy.thumbnail((width, height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (width, height), "white")
    canvas.paste(copy, ((width - copy.width) // 2, (height - copy.height) // 2))
    return canvas


def main():
    manifest = json.loads(MANIFEST.read_text())
    report = json.loads(REPORT.read_text())
    reads = {row["uid"]: row for row in report["rows"]}
    latest = {}
    for debug_path in sorted(SOURCE.glob("*/debug.json")):
        wrapped = json.loads(debug_path.read_text())
        debug = wrapped.get("debug", wrapped)
        if str(debug.get("layoutId", "")).startswith("sg-g1-lw-"):
            latest[debug["layoutId"]] = debug

    rows = []
    for item in manifest["entries"]:
        debug = latest[item["layoutId"]]
        question = int(item["questionNum"])
        group = debug["answerGroups"][question - 1]
        # Beta 7 additionally demotes the demonstrated row-04 Q6 promotion.
        repaired_review = group.get("reviewNeeded") is True or (
            item["layoutId"] == "sg-g1-lw-04-sub-2digit" and question == 6
        )
        if not repaired_review:
            continue
        decision = next((entry for entry in debug.get("v3Shadow", {}).get("decisions", [])
                         if int(entry.get("questionNum", -1)) == question), {})
        strong = decision.get("sequenceFrameConsensus") or {}
        matched = reads[item["uid"]]["reads"]
        rows.append((item, group, strong, matched))

    cell_w, cell_h, header_h = 390, 210, 84
    columns, row_h = 4, header_h + cell_h * 2
    canvas = Image.new("RGB", (cell_w * columns, row_h * len(rows)), "white")
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default(size=18)
    small = ImageFont.load_default(size=15)
    for index, (item, group, strong, matched) in enumerate(rows):
        y = index * row_h
        label = item["layoutId"].replace("sg-g1-lw-", "")
        title = (f"{label} Q{item['questionNum']}  truth={item['truth']}  "
                 f"browser={group.get('answerText')}  seq={strong.get('text', '-')} "
                 f"({strong.get('count', 0)}/{strong.get('usableFrameCount', 0)})")
        draw.text((12, y + 8), title, fill="black", font=font)
        draw.text((12, y + 38),
                  f"continuous={matched['continuous']['read'] or 'blank'}  stitched={matched['stitched']['read'] or 'blank'}",
                  fill="#444444", font=small)
        continuous = fit(Image.open(ROOT / item["paths"]["continuous"]))
        stitched = fit(Image.open(ROOT / item["paths"]["stitched"]))
        canvas.paste(continuous, (0, y + header_h))
        canvas.paste(stitched, (cell_w, y + header_h))
        draw.text((12, y + header_h + 8), "continuous answer zone", fill="#245aa4", font=small)
        draw.text((cell_w + 12, y + header_h + 8), "stitched physical slots", fill="#245aa4", font=small)
        # Repeat at 2x nearest-neighbour scale so faint pencil and clipping are
        # inspectable without altering the source images above.
        canvas.paste(fit(Image.open(ROOT / item["paths"]["continuous"]).resize((720, 420))),
                     (cell_w * 2, y + header_h))
        canvas.paste(fit(Image.open(ROOT / item["paths"]["stitched"]).resize((720, 420))),
                     (cell_w * 3, y + header_h))
        draw.line((0, y + row_h - 1, canvas.width, y + row_h - 1), fill="#cccccc", width=1)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUT, optimize=True)
    print(OUT)


if __name__ == "__main__":
    main()
