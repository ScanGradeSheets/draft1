#!/usr/bin/env python3
"""Key-blind multi-crop probe for Candidate 3's 38 yellow answers.

The recognizer receives only image crops and opaque identifiers. Handwritten
truth is joined after inference for scoring. This is a retrospective research
experiment and cannot by itself validate a production promotion rule because
the saved primary zone represents one retained frame, not a fresh burst.
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import urllib.request
from collections import Counter
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SCORE = ROOT / "private-evidence/reports/nonrow-combined-private-candidate-score-20260715.json"
DEFAULT_OUT = ROOT / "private-evidence/reports/candidate3-yellow-multicrop-20260715.json"


def digits(value):
    value = "".join(char for char in str(value or "") if char.isdigit())
    return value or None


def decode_data_url(value: str) -> Image.Image:
    return Image.open(io.BytesIO(base64.b64decode(value.split(",", 1)[1]))).convert("RGB")


def encode_data_url(image: Image.Image) -> str:
    buffer = io.BytesIO()
    image.save(buffer, "PNG")
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")


def variants(image: Image.Image) -> dict[str, Image.Image]:
    width, height = image.size

    def trim(x_fraction: float, y_fraction: float) -> Image.Image:
        dx = max(1, round(width * x_fraction)) if x_fraction else 0
        dy = max(1, round(height * y_fraction)) if y_fraction else 0
        return image.crop((dx, dy, width - dx, height - dy))

    dx4, dy4 = max(1, round(width * .04)), max(1, round(height * .04))
    return {
        "original": image.copy(),
        "trim_all_0.02": trim(.02, .02),
        "trim_all_0.04": trim(.04, .04),
        "trim_all_0.06": trim(.06, .06),
        "trim_horizontal_0.04": trim(.04, 0),
        "trim_vertical_0.04": trim(0, .04),
        "shift_left_0.04": image.crop((0, dy4, width - 2 * dx4, height - dy4)),
        "shift_right_0.04": image.crop((2 * dx4, dy4, width, height - dy4)),
        "shift_up_0.04": image.crop((dx4, 0, width - dx4, height - 2 * dy4)),
        "shift_down_0.04": image.crop((dx4, 2 * dy4, width - dx4, height)),
        "pad_white_0.04": ImageOps.expand(image, border=(dx4, dy4), fill="white"),
    }


def post(url: str, origin: str, items: list[dict], engine: str) -> list[dict]:
    output = []
    for start in range(0, len(items), 24):
        batch = items[start:start + 24]
        if engine == "compact":
            batch = [{
                "id": item["id"],
                "questionNum": item["questionNum"],
                "continuousImageDataUrl": item["imageDataUrl"],
            } for item in batch]
        request = urllib.request.Request(
            url.rstrip("/") + ("/v3/recognize" if engine == "compact" else "/recognize"),
            data=json.dumps({"items": batch}).encode("utf-8"),
            headers={"Content-Type": "application/json", "Origin": origin},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=180) as response:
            payload = json.load(response)
        if engine == "large" and payload.get("answerKeyUsed") is not False:
            raise RuntimeError("Recognizer did not confirm key-blind inference")
        output.extend(payload.get("results", []))
    return output


def summary(rows: list[dict]) -> dict:
    return {
        "answers": len(rows),
        "correct": sum(bool(row["correct"]) for row in rows),
        "wrong": sum(not bool(row["correct"]) for row in rows),
        "meanMinTokenProbability": round(
            sum(float(row.get("minTokenProbability") or 0) for row in rows) / max(1, len(rows)), 6
        ),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8766")
    parser.add_argument("--origin", default="https://localhost:5174")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--engine", choices=("large", "compact"), default="large")
    options = parser.parse_args()
    if not options.out.is_absolute():
        options.out = ROOT / options.out

    score = json.loads(SCORE.read_text())
    yellows = [row for row in score["rows"] if row.get("scorable") and not row.get("automatic")]
    items, evidence, truth = [], {}, {}
    debug_cache = {}
    for row in yellows:
        debug_file = ROOT / row["debugFile"]
        debug = debug_cache.setdefault(debug_file, json.loads(debug_file.read_text()))
        question_num = int(row["questionNum"])
        zone = next(item for item in debug.get("v3AnswerZones", []) if int(item["questionNum"]) == question_num)
        promotion = next(
            item for item in debug["v3Shadow"]["consensusPromotionDecisions"]
            if int(item["questionNum"]) == question_num
        )
        image = decode_data_url(zone["imageDataUrl"])
        row_id = f"{row['packetId']}|{row['layoutId']}|q{question_num}"
        truth[row_id] = digits(row["truthText"])
        for variant, transformed in variants(image).items():
            item_id = f"{row_id}|{variant}"
            items.append({
                "id": item_id,
                "questionNum": question_num,
                "imageDataUrl": encode_data_url(transformed),
            })
            evidence[item_id] = {
                "rowId": row_id,
                "packetId": row["packetId"],
                "layoutId": row["layoutId"],
                "layoutFamily": row["layoutFamily"],
                "questionNum": question_num,
                "policyReason": promotion["reason"],
                "variant": variant,
                "width": transformed.width,
                "height": transformed.height,
            }

    # No truth or answer-key data is present in items or recognizer requests.
    reads = post(options.url, options.origin, items, options.engine)
    rows = []
    for read in reads:
        metadata = evidence[read["id"]]
        row = {
            **metadata,
            "read": digits(read.get("read")),
            "minTokenProbability": float(
                read.get("minTokenProbability")
                or read.get("minComponentProbability")
                or 0
            ),
        }
        row["truth"] = truth[row["rowId"]]
        row["correct"] = row["read"] == row["truth"]
        rows.append(row)

    variant_names = sorted({row["variant"] for row in rows})
    by_variant = {
        variant: summary([row for row in rows if row["variant"] == variant])
        for variant in variant_names
    }
    by_row = {}
    for row_id in sorted(truth):
        subset = [row for row in rows if row["rowId"] == row_id]
        counts = Counter(row["read"] for row in subset if row["read"])
        majority_read, majority_count = counts.most_common(1)[0] if counts else (None, 0)
        original = next(row for row in subset if row["variant"] == "original")
        core = [row for row in subset if row["variant"] in {"original", "trim_all_0.02", "trim_all_0.04"}]
        core_reads = {row["read"] for row in core}
        by_row[row_id] = {
            "packetId": original["packetId"],
            "layoutId": original["layoutId"],
            "layoutFamily": original["layoutFamily"],
            "questionNum": original["questionNum"],
            "policyReason": original["policyReason"],
            "truth": original["truth"],
            "originalRead": original["read"],
            "originalCorrect": original["correct"],
            "coreThreeExact": len(core_reads) == 1 and None not in core_reads,
            "coreThreeRead": next(iter(core_reads)) if len(core_reads) == 1 else None,
            "coreThreeCorrect": len(core_reads) == 1 and next(iter(core_reads)) == original["truth"],
            "majorityRead": majority_read,
            "majorityCount": majority_count,
            "variantCount": len(subset),
            "majorityCorrect": majority_read == original["truth"],
            "reads": {row["variant"]: {
                "read": row["read"],
                "minTokenProbability": row["minTokenProbability"],
                "correct": row["correct"],
            } for row in subset},
        }

    compact_veto = [row for row in by_row.values() if row["policyReason"] == "whole-answer-compact-model-does-not-support-consensus"]
    browser_conflict = [row for row in by_row.values() if row["policyReason"] == "browser-preprocessing-stably-conflicts"]
    report = {
        "schemaVersion": 1,
        "generatedAt": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        "status": "retrospective single-saved-frame multicrop experiment; production unchanged",
        "source": str(SCORE.relative_to(ROOT)),
        "answerKeyProvidedToRecognizer": False,
        "engine": options.engine,
        "truthJoinedOnlyAfterInference": True,
        "limitation": "Each primary zone is from one saved retained frame; prospective multi-frame validation is still required.",
        "answers": len(yellows),
        "variantCountPerAnswer": len(variant_names),
        "byVariant": by_variant,
        "compactVeto": {
            "answers": len(compact_veto),
            "coreThreeExact": sum(bool(row["coreThreeExact"]) for row in compact_veto),
            "coreThreeExactCorrect": sum(bool(row["coreThreeExact"] and row["coreThreeCorrect"]) for row in compact_veto),
            "coreThreeExactWrong": sum(bool(row["coreThreeExact"] and not row["coreThreeCorrect"]) for row in compact_veto),
            "majorityCorrect": sum(bool(row["majorityCorrect"]) for row in compact_veto),
        },
        "browserConflict": {
            "answers": len(browser_conflict),
            "coreThreeExact": sum(bool(row["coreThreeExact"]) for row in browser_conflict),
            "coreThreeExactCorrect": sum(bool(row["coreThreeExact"] and row["coreThreeCorrect"]) for row in browser_conflict),
            "coreThreeExactWrong": sum(bool(row["coreThreeExact"] and not row["coreThreeCorrect"]) for row in browser_conflict),
        },
        "rows": list(by_row.values()),
        "rawRows": rows,
    }
    options.out.parent.mkdir(parents=True, exist_ok=True)
    options.out.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({
        "out": str(options.out.relative_to(ROOT)),
        "answers": report["answers"],
        "variantCountPerAnswer": report["variantCountPerAnswer"],
        "byVariant": by_variant,
        "compactVeto": report["compactVeto"],
        "browserConflict": report["browserConflict"],
    }, indent=2))


if __name__ == "__main__":
    main()
