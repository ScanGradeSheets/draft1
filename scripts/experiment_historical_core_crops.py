#!/usr/bin/env python3
"""Falsify the Candidate 3 core-crop idea on older labelled captures.

Only historical answers rejected for compact-model disagreement or stable
browser conflict are included. The recognizer sees three image variants and
opaque IDs; handwritten truth is joined only after inference. Historical
artifacts contain one retained frame, so this can reject a crop rule but cannot
prove the required three-frame gate.
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import urllib.request
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "private-evidence/reports/consensus-historical-single-frame-stress-20260714.json"
DEFAULT_OUT = ROOT / "private-evidence/reports/candidate3-historical-core-crop-stress-20260715.json"
TARGET_REASONS = {
    "whole-answer-compact-model-does-not-support-consensus",
    "browser-preprocessing-stably-conflicts",
}


def digits(value):
    value = "".join(character for character in str(value or "") if character.isdigit())
    return value or None


def decode(value: str) -> Image.Image:
    return Image.open(io.BytesIO(base64.b64decode(value.split(",", 1)[1]))).convert("RGB")


def encode(image: Image.Image) -> str:
    buffer = io.BytesIO()
    image.save(buffer, "PNG")
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")


def trim(image: Image.Image, fraction: float) -> Image.Image:
    dx = max(1, round(image.width * fraction))
    dy = max(1, round(image.height * fraction))
    return image.crop((dx, dy, image.width - dx, image.height - dy))


def recognize(url: str, items: list[dict]) -> list[dict]:
    output = []
    for start in range(0, len(items), 24):
        request = urllib.request.Request(
            url.rstrip("/") + "/recognize",
            data=json.dumps({"items": items[start:start + 24]}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=180) as response:
            payload = json.load(response)
        if payload.get("answerKeyUsed") is not False:
            raise RuntimeError("Recognizer did not confirm key-blind inference")
        output.extend(payload.get("results", []))
    return output


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8870")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    options = parser.parse_args()

    source = json.loads(SOURCE.read_text())
    target = [
        row for row in source["rows"]
        if row.get("scorable") and not row.get("candidateAutomatic") and row.get("promotionReason") in TARGET_REASONS
    ]
    items, metadata, truth = [], {}, {}
    for row in target:
        debug = json.loads((ROOT / row["debugFile"]).read_text())
        question_num = int(row["questionNum"])
        zone = next(
            (item for item in debug.get("v3AnswerZones", []) if int(item.get("questionNum", -1)) == question_num),
            None,
        )
        if not zone or not zone.get("imageDataUrl"):
            continue
        row_id = f"{row['captureId']}|q{question_num}"
        truth[row_id] = digits(row["truth"])
        image = decode(zone["imageDataUrl"])
        for variant, variant_image in {
            "original": image,
            "trim_all_0.02": trim(image, .02),
            "trim_all_0.04": trim(image, .04),
        }.items():
            item_id = f"{row_id}|{variant}"
            items.append({"id": item_id, "questionNum": question_num, "imageDataUrl": encode(variant_image)})
            metadata[item_id] = {
                "rowId": row_id,
                "captureId": row["captureId"],
                "split": row["split"],
                "layoutId": row["layoutId"],
                "layoutFamily": row["layoutFamily"],
                "questionNum": question_num,
                "policyReason": row["promotionReason"],
                "variant": variant,
            }

    # The inference request contains no truth or answer-key fields.
    model_rows = []
    for result in recognize(options.url, items):
        row = {**metadata[result["id"]], "read": digits(result.get("read"))}
        row["truth"] = truth[row["rowId"]]
        row["correct"] = row["read"] == row["truth"]
        row["minTokenProbability"] = float(result.get("minTokenProbability") or 0)
        model_rows.append(row)

    result_rows = []
    for row_id in sorted({row["rowId"] for row in model_rows}):
        subset = [row for row in model_rows if row["rowId"] == row_id]
        reads = {row["variant"]: row["read"] for row in subset}
        exact = len(set(reads.values())) == 1 and None not in reads.values()
        first = subset[0]
        result_rows.append({
            "rowId": row_id,
            "captureId": first["captureId"],
            "split": first["split"],
            "layoutId": first["layoutId"],
            "layoutFamily": first["layoutFamily"],
            "questionNum": first["questionNum"],
            "policyReason": first["policyReason"],
            "truth": first["truth"],
            "coreThreeExact": exact,
            "coreThreeRead": next(iter(reads.values())) if exact else None,
            "coreThreeCorrect": exact and next(iter(reads.values())) == first["truth"],
            "reads": reads,
        })

    selected = [row for row in result_rows if row["coreThreeExact"]]
    by_reason = {}
    for reason in sorted(TARGET_REASONS):
        reason_rows = [row for row in result_rows if row["policyReason"] == reason]
        reason_selected = [row for row in reason_rows if row["coreThreeExact"]]
        by_reason[reason] = {
            "answers": len(reason_rows),
            "selected": len(reason_selected),
            "correct": sum(bool(row["coreThreeCorrect"]) for row in reason_selected),
            "wrong": sum(not bool(row["coreThreeCorrect"]) for row in reason_selected),
        }
    report = {
        "schemaVersion": 1,
        "status": "historical single-frame falsification stress; production unchanged",
        "source": str(SOURCE.relative_to(ROOT)),
        "answerKeyProvidedToRecognizer": False,
        "truthJoinedOnlyAfterInference": True,
        "limitation": "Historical records contain one retained frame, so this tests crop stability but not the required three-frame stability gate.",
        "eligibleRows": len(target),
        "rowsWithSavedZones": len(result_rows),
        "selected": len(selected),
        "selectedCorrect": sum(bool(row["coreThreeCorrect"]) for row in selected),
        "selectedWrong": sum(not bool(row["coreThreeCorrect"]) for row in selected),
        "byReason": by_reason,
        "wrongRows": [row for row in selected if not row["coreThreeCorrect"]],
        "rows": result_rows,
        "rawRows": model_rows,
    }
    options.out.parent.mkdir(parents=True, exist_ok=True)
    options.out.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({key: value for key, value in report.items() if key not in {"rows", "rawRows"}}, indent=2))


if __name__ == "__main__":
    main()
