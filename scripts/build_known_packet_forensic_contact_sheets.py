#!/usr/bin/env python3
"""Build prediction-blind contact sheets for the 2026-08-15 known-packet audit.

This script is intentionally analysis-only. It reads the saved Debug Scan
bundles, applies the frozen canonical/repeat rules for this batch, and renders
raw answer crops without OCR predictions or answer-key values.

Run with the Codex bundled Python runtime because it includes Pillow:

  /Users/openclaw/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 \
    scripts/build_known_packet_forensic_contact_sheets.py
"""

from __future__ import annotations

import argparse
import base64
import io
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFont, ImageOps


IN_SCOPE_PACKETS = (
    "A",
    "B1",
    "B2",
    "B3",
    "B4",
    "B5",
    "P02",
    "P03",
    "P05",
    "P08",
    "P09",
    "G2-9",
)

LAYOUT_ORDER = (
    "sg-g1-lw-01-add-1digit",
    "sg-g1-lw-02-add-2digit",
    "sg-g1-lw-03-sub-1digit",
    "sg-g1-lw-04-sub-2digit",
    "sg-g1-lw-05-mixed-20",
    "sg-g1-lw-06-ten-frames",
    "sg-g1-lw-07-dot-collections",
    "sg-g1-lw-08-number-bonds",
    "sg-g1-lw-09-number-patterns",
    "sg-g1-lw-10-place-value-50",
)


def load_bundle(path: Path) -> dict:
    payload = json.loads(path.read_text())
    debug = payload.get("debug", payload)
    return {
        "dir": str(path.parent),
        "receivedAt": payload.get("receivedAt", debug.get("receivedAt")),
        "uploadReason": payload.get("upload", {}).get(
            "uploadReason", payload.get("uploadReason")
        ),
        "debug": debug,
    }


def representative_upload(uploads: list[dict]) -> dict:
    priority = {
        "accepted-answer-safety-shadow-complete": 3,
        "ocr-complete": 2,
        "ocr-error": 1,
    }
    return max(
        uploads,
        key=lambda row: (
            priority.get(row["uploadReason"], 0),
            row["receivedAt"] or "",
        ),
    )


def collect_sessions(raw_root: Path) -> list[dict]:
    by_session: dict[str, list[dict]] = {}
    for path in sorted(raw_root.glob("*/debug.json")):
        row = load_bundle(path)
        debug = row["debug"]
        session_id = debug.get("scanSessionId")
        if not session_id or debug.get("packetId") not in IN_SCOPE_PACKETS:
            continue
        by_session.setdefault(session_id, []).append(row)

    sessions = []
    for session_id, uploads in by_session.items():
        row = representative_upload(uploads)
        debug = row["debug"]
        sessions.append(
            {
                **row,
                "scanSessionId": session_id,
                "packetId": debug.get("packetId"),
                "layoutId": debug.get("layoutId"),
                "success": bool(debug.get("predictions")),
                "error": debug.get("digitEngineError") or debug.get("error"),
                "uploadDirs": [upload["dir"] for upload in uploads],
            }
        )
    return sorted(sessions, key=lambda row: row["receivedAt"] or "")


def classify_sessions(sessions: list[dict]) -> None:
    for row in sessions:
        row["auditRole"] = "canonical-success" if row["success"] else "error"

    a_repeats = [
        row
        for row in sessions
        if row["packetId"] == "A"
        and row["layoutId"] == "sg-g1-lw-06-ten-frames"
        and row["success"]
    ]
    a_repeats.sort(key=lambda row: row["receivedAt"] or "")
    if len(a_repeats) != 2:
        raise RuntimeError(f"Expected two successful A ten-frame sessions, found {len(a_repeats)}")
    a_repeats[1]["auditRole"] = "extra-success-repeat"

    p02_repeats = [
        row
        for row in sessions
        if row["packetId"] == "P02"
        and row["layoutId"] == "sg-g1-lw-02-add-2digit"
        and row["success"]
    ]
    p02_repeats.sort(key=lambda row: row["receivedAt"] or "")
    if len(p02_repeats) != 3:
        raise RuntimeError(
            f"Expected three successful P02 add-two-digit sessions, found {len(p02_repeats)}"
        )
    # The final successful session is the documented fully terminated/reopened
    # Safari run. The preceding two successful retries followed the error in the
    # same processing session and remain diagnostic-only.
    for row in p02_repeats[:-1]:
        row["auditRole"] = "extra-success-session-contaminated-retry"
    p02_repeats[-1]["auditRole"] = "canonical-success"


def decode_data_url(value: str) -> Image.Image:
    encoded = value.split(",", 1)[1]
    return Image.open(io.BytesIO(base64.b64decode(encoded))).convert("RGB")


def font(size: int) -> ImageFont.ImageFont:
    candidates = (
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Helvetica.ttf",
    )
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size=size)
    return ImageFont.load_default()


def fit_crop(image: Image.Image, target_w: int, target_h: int) -> Image.Image:
    gray = ImageOps.grayscale(image)
    gray = ImageEnhance.Contrast(gray).enhance(1.25)
    contained = ImageOps.contain(gray, (target_w, target_h), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (target_w, target_h), "white")
    x = (target_w - contained.width) // 2
    y = (target_h - contained.height) // 2
    canvas.paste(ImageOps.colorize(contained, "black", "white"), (x, y))
    return canvas


def render_packet(packet: str, pages: list[dict], out_path: Path) -> dict:
    page_by_layout = {row["layoutId"]: row for row in pages}
    missing = [layout for layout in LAYOUT_ORDER if layout not in page_by_layout]
    if missing:
        raise RuntimeError(f"{packet} is missing canonical layouts: {missing}")

    margin = 24
    label_w = 255
    cell_w = 208
    cell_h = 154
    header_h = 92
    questions_across = 8
    width = margin * 2 + label_w + cell_w * questions_across
    height = header_h + cell_h * len(LAYOUT_ORDER) + margin
    sheet = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(sheet)
    title_font = font(28)
    label_font = font(18)
    small_font = font(15)
    draw.text((margin, 18), f"Packet {packet} — prediction-blind raw answer crops", fill="black", font=title_font)
    draw.text(
        (margin, 55),
        "Visible handwriting only; no OCR prediction or answer key is shown.",
        fill="#444444",
        font=small_font,
    )

    index_rows = []
    for layout_index, layout_id in enumerate(LAYOUT_ORDER):
        row = page_by_layout[layout_id]
        debug = row["debug"]
        y0 = header_h + layout_index * cell_h
        shade = "#f4f6f8" if layout_index % 2 == 0 else "#ffffff"
        draw.rectangle((0, y0, width, y0 + cell_h), fill=shade)
        draw.line((0, y0, width, y0), fill="#ccd2d8", width=1)
        short_layout = layout_id.replace("sg-g1-lw-", "")
        draw.text((margin, y0 + 18), short_layout, fill="black", font=label_font)
        draw.text(
            (margin, y0 + 48),
            row["scanSessionId"][:8],
            fill="#555555",
            font=small_font,
        )

        raw_crops = [decode_data_url(value) for value in debug.get("rawCropDataUrls", [])]
        groups = sorted(debug.get("answerGroups", []), key=lambda group: group["questionNum"])
        for question_index, group in enumerate(groups):
            x0 = margin + label_w + question_index * cell_w
            draw.rectangle(
                (x0 + 4, y0 + 8, x0 + cell_w - 5, y0 + cell_h - 9),
                outline="#b7bec6",
                width=1,
            )
            draw.text(
                (x0 + 12, y0 + 15),
                f"Q{group['questionNum']}",
                fill="#333333",
                font=small_font,
            )
            crop_ids = group.get("digitBoxIds", [])
            crop_y = y0 + 42
            if len(crop_ids) == 1:
                crop_w = 112
                crop = fit_crop(raw_crops[crop_ids[0]], crop_w, 94)
                sheet.paste(crop, (x0 + (cell_w - crop_w) // 2, crop_y))
            else:
                crop_w = 82
                gap = 7
                total_w = crop_w * len(crop_ids) + gap * (len(crop_ids) - 1)
                crop_x = x0 + (cell_w - total_w) // 2
                for digit_index, crop_id in enumerate(crop_ids):
                    crop = fit_crop(raw_crops[crop_id], crop_w, 94)
                    sheet.paste(crop, (crop_x + digit_index * (crop_w + gap), crop_y))
                    if digit_index + 1 < len(crop_ids):
                        divider_x = crop_x + crop_w + gap // 2 + digit_index * (crop_w + gap)
                        draw.line((divider_x, crop_y, divider_x, crop_y + 94), fill="#7f8790", width=1)

        index_rows.append(
            {
                "packetId": packet,
                "layoutId": layout_id,
                "scanSessionId": row["scanSessionId"],
                "evidenceDir": row["dir"],
                "questionCount": len(groups),
            }
        )

    sheet.save(out_path, optimize=True)
    return {"packetId": packet, "path": str(out_path), "pages": index_rows}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--raw-root",
        type=Path,
        default=Path("private-evidence/debug-scans/2026-08-15"),
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(
            "private-evidence/reports/known-packet-forensic-20260815/contact-sheets"
        ),
    )
    args = parser.parse_args()

    sessions = collect_sessions(args.raw_root)
    classify_sessions(sessions)
    canonical = [row for row in sessions if row["auditRole"] == "canonical-success"]

    counts = {
        "distinctSessions": len(sessions),
        "canonicalSuccesses": len(canonical),
        "extraSuccesses": sum(row["auditRole"].startswith("extra-success") for row in sessions),
        "errors": sum(row["auditRole"] == "error" for row in sessions),
    }
    expected = {
        "distinctSessions": 125,
        "canonicalSuccesses": 119,
        "extraSuccesses": 3,
        "errors": 3,
    }
    if counts != expected:
        raise RuntimeError(f"Corpus reconciliation failed: observed={counts}, expected={expected}")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    rendered = []
    for packet in IN_SCOPE_PACKETS:
        if packet == "G2-9":
            continue
        pages = [row for row in canonical if row["packetId"] == packet]
        rendered.append(render_packet(packet, pages, args.output_dir / f"{packet}-answer-crops.png"))

    index = {
        "schemaVersion": 1,
        "purpose": "Prediction-blind raw-crop contact sheets for handwriting-truth QA",
        "forbiddenPacketsRead": [],
        "reconciliation": counts,
        "sheets": rendered,
    }
    (args.output_dir / "index.json").write_text(json.dumps(index, indent=2) + "\n")
    print(json.dumps(index, indent=2))


if __name__ == "__main__":
    main()
