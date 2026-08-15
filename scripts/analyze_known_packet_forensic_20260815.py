#!/usr/bin/env python3
"""Reproduce the 2026-08-15 known-packet forensic audit.

Analysis only: reads saved Debug Scan bundles and the prediction-blind manual
truth decisions, then writes manifests, ledgers, metrics, case classifications,
and repeat/error diagnostics. It never reads sealed P01/P04/P06/P07 evidence.

Run with the bundled Python runtime (Pillow is used for repeat comparisons):

  /Users/openclaw/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 \
    scripts/analyze_known_packet_forensic_20260815.py
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import statistics
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable

from PIL import Image, ImageChops, ImageOps, ImageStat

from build_known_packet_forensic_contact_sheets import (
    IN_SCOPE_PACKETS,
    LAYOUT_ORDER,
    classify_sessions,
    collect_sessions,
)


STARTING_COMMIT = "80a0cc20f852b8fcc59bddd88929d69ecd8a16c3"
PRIMARY_PACKETS = ("A", "B1", "B2", "B3", "B4", "B5", "P02", "P03", "P05", "P08", "P09")
SEALED_PACKETS = ("P01", "P04", "P06", "P07")
EXPECTED_RECONCILIATION = {
    "distinctSessions": 125,
    "canonicalSuccesses": 119,
    "extraSuccesses": 3,
    "errors": 3,
}
G2_SESSION_TO_PHOTO = {
    "21eda17e-ece2-4fb3-b586-c6382f6ca87a": "5-Photo-5.jpg",
    "07a44a21-d291-4085-82e4-f8ce4f1f7e10": "4-Photo-4.jpg",
    "4fc30c21-3789-4ae7-b2c0-491f3c965688": "8-Photo-8.jpg",
    "9eaff19a-5f47-43de-829a-37260cb800f0": "1-Photo-1.jpg",
    "3fd8e0b1-d6f0-4956-b75d-4f7877630ea0": "9-Photo-9.jpg",
    "2359c44b-6c9a-4470-9ce9-39b4328c268e": "6-Photo-6.jpg",
    "59e4962b-d598-4d44-a18a-907dfa02d3e1": "2-Photo-2.jpg",
    "d7c55cba-19d8-4461-ac0a-784cb7a9f948": "7-Photo-7.jpg",
    "9c59e80d-2d91-42b0-b568-b88e6a0fc589": "3-Photo-3.jpg",
}


def read_json(path: Path) -> Any:
    return json.loads(path.read_text())


def write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, indent=2, sort_keys=False) + "\n")


def write_jsonl(path: Path, rows: Iterable[dict]) -> None:
    path.write_text("".join(json.dumps(row, sort_keys=False) + "\n" for row in rows))


def iso_ms(value: str | None) -> float | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp() * 1000


def pct(numerator: int | float, denominator: int | float) -> float | None:
    return round(100 * numerator / denominator, 3) if denominator else None


def quantile(values: list[float], q: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = (len(ordered) - 1) * q
    low = math.floor(index)
    high = math.ceil(index)
    if low == high:
        return round(ordered[low], 3)
    return round(ordered[low] * (high - index) + ordered[high] * (index - low), 3)


def distribution(values: list[float]) -> dict:
    return {
        "n": len(values),
        "median": quantile(values, 0.5),
        "p10": quantile(values, 0.1),
        "p90": quantile(values, 0.9),
        "min": round(min(values), 3) if values else None,
        "max": round(max(values), 3) if values else None,
    }


def capture_band(debug: dict) -> str:
    quality = debug.get("captureQuality") or {}
    geometry = quality.get("sheetGeometry") or {}
    focus = quality.get("focusScore")
    if not quality:
        return "legacy-no-capture-gate"
    if quality.get("sheetOk") is False or geometry.get("perspectiveOkay") is False:
        return "quality-gate-concern"
    if focus is None:
        return "accepted-unknown-focus"
    if focus < 650:
        return "accepted-focus-under-650"
    if focus < 800:
        return "accepted-focus-650-799"
    return "accepted-focus-800-plus"


def registration_band(debug: dict) -> str:
    registration = debug.get("answerBoxRegistration") or {}
    coherence = registration.get("coherence") or {}
    if not registration:
        return "legacy-or-unavailable"
    if not coherence.get("coherent"):
        return "incoherent"
    residual = coherence.get("maxResidual")
    if residual is None:
        return "coherent-residual-unavailable"
    if residual <= 3:
        return "coherent-max-residual-0-3px"
    if residual <= 6:
        return "coherent-max-residual-3-6px"
    return "coherent-max-residual-over-6px"


def session_manifest(sessions: list[dict]) -> list[dict]:
    packet_rows: dict[str, list[dict]] = defaultdict(list)
    for session in sessions:
        packet_rows[session["packetId"]].append(session)
    ordinals: dict[str, dict[str, int]] = {}
    for packet, rows in packet_rows.items():
        rows.sort(key=lambda row: row.get("receivedAt") or "")
        ordinals[packet] = {row["scanSessionId"]: index + 1 for index, row in enumerate(rows)}

    canonical_ordinals: dict[str, dict[str, int]] = defaultdict(dict)
    for packet in IN_SCOPE_PACKETS:
        rows = sorted(
            [row for row in sessions if row["packetId"] == packet and row["auditRole"] == "canonical-success"],
            key=lambda row: row.get("receivedAt") or "",
        )
        canonical_ordinals[packet] = {row["scanSessionId"]: index + 1 for index, row in enumerate(rows)}

    manifest = []
    for row in sessions:
        debug = row["debug"]
        reasons = []
        for directory in row["uploadDirs"]:
            payload = read_json(Path(directory) / "debug.json")
            reasons.append(payload.get("upload", {}).get("uploadReason", payload.get("uploadReason")))
        manifest.append(
            {
                "scanSessionId": row["scanSessionId"],
                "packetId": row["packetId"],
                "cohort": "legacy-g2" if row["packetId"] == "G2-9" else "primary-grade1",
                "layoutId": row["layoutId"],
                "auditRole": row["auditRole"],
                "success": row["success"],
                "receivedAt": row["receivedAt"],
                "packetSessionOrdinal": ordinals[row["packetId"]][row["scanSessionId"]],
                "canonicalPageOrdinal": canonical_ordinals[row["packetId"]].get(row["scanSessionId"]),
                "uploadSnapshotCount": len(row["uploadDirs"]),
                "uploadReasons": sorted(set(reason for reason in reasons if reason)),
                "representativeEvidenceDir": row["dir"],
                "allEvidenceDirs": row["uploadDirs"],
                "capturedImage": str(Path(row["dir"]) / "captured.png"),
                "warpedImage": str(Path(row["dir"]) / "warped.png") if (Path(row["dir"]) / "warped.png").exists() else None,
                "markedImage": str(Path(row["dir"]) / "marked-sheet.jpg") if (Path(row["dir"]) / "marked-sheet.jpg").exists() else None,
                "error": row.get("error"),
                "captureQualityBand": capture_band(debug),
                "registrationQualityBand": registration_band(debug),
                "forcedFallbackReason": debug.get("forcedFallbackReviewReason"),
                "runtime": debug.get("runtime"),
            }
        )
    return manifest


def build_g2_truth(scorecard: dict) -> dict[str, dict]:
    photos = {row["file"]: row for row in scorecard["photos"]}
    truth = {}
    for session_id, photo_file in G2_SESSION_TO_PHOTO.items():
        photo = photos[photo_file]
        truth[session_id] = {
            "photoFile": photo_file,
            "templateId": photo["template_id"],
            "values": [str(value) for value in photo["handwritten_truth"]],
            "expected": [str(value) for value in scorecard["templates"][photo["template_id"]]["answer_key"]],
            "notes": photo.get("notes"),
        }
    return truth


def physical_slot_truth(
    packet: str,
    layout: str,
    question_num: int,
    truth: str,
    slot_count: int,
    decisions: dict,
) -> tuple[list[str | None], list[bool], str | None]:
    question_key = f"{packet}|{layout}|{question_num}"
    question_ambiguous = question_key in decisions["ambiguousQuestions"]
    if slot_count == 1:
        return [truth if truth else None], [question_ambiguous], None
    if slot_count != 2:
        raise RuntimeError(f"Unexpected slot count {slot_count} for {question_key}")
    if not truth:
        return [None, None], [question_ambiguous, question_ambiguous], "blank"
    if len(truth) == 2:
        return [truth[0], truth[1]], [question_ambiguous, question_ambiguous], "two-character"
    if len(truth) != 1:
        raise RuntimeError(f"Cannot map truth {truth!r} into two slots for {question_key}")
    placement = decisions["oneDigitTwoSlotPlacements"].get(question_key)
    if placement == "left":
        return [truth, None], [question_ambiguous, question_ambiguous], placement
    if placement == "right":
        return [None, truth], [question_ambiguous, question_ambiguous], placement
    if placement == "spans-divider":
        return [f"fragment-of-{truth}", f"fragment-of-{truth}"], [True, True], placement
    raise RuntimeError(f"Missing one-digit/two-slot placement for {question_key}")


def column_for(question_num: int, question_count: int) -> str:
    return "left" if question_num <= math.ceil(question_count / 2) else "right"


def layout_family(layout_id: str) -> str:
    return layout_id.replace("sg-g1-lw-", "") if layout_id.startswith("sg-g1-lw-") else layout_id


def build_ledgers(sessions: list[dict], decisions: dict, g2_truth: dict[str, dict]) -> tuple[list[dict], list[dict], list[dict]]:
    questions = []
    slots = []
    truth_ledger = []
    canonical = [row for row in sessions if row["auditRole"] == "canonical-success"]
    page_ordinals: dict[str, dict[str, int]] = defaultdict(dict)
    for packet in IN_SCOPE_PACKETS:
        rows = sorted([row for row in canonical if row["packetId"] == packet], key=lambda row: row.get("receivedAt") or "")
        page_ordinals[packet] = {row["scanSessionId"]: index + 1 for index, row in enumerate(rows)}

    layout_index = {layout: index for index, layout in enumerate(LAYOUT_ORDER)}
    for session in canonical:
        debug = session["debug"]
        packet = session["packetId"]
        layout = session["layoutId"]
        groups = sorted(debug.get("answerGroups", []), key=lambda group: group["questionNum"])
        predictions = {prediction["id"]: prediction for prediction in debug.get("predictions", [])}
        if packet == "G2-9":
            source = g2_truth[session["scanSessionId"]]
            truth_values = source["values"]
            expected_values = source["expected"]
            provenance = f"locked SG3-9 scorecard {source['photoFile']}; vector identity reproduced"
        else:
            truth_values = decisions["questionTruthByPacket"][packet][layout_index[layout]]
            expected_values = [str(group["answer"]) for group in groups]
            provenance = decisions["packetProvenance"][packet]
        if len(truth_values) != len(groups):
            raise RuntimeError(f"Truth/group count mismatch for {packet} {layout}")

        question_count = len(groups)
        for index, group in enumerate(groups):
            qn = int(group["questionNum"])
            truth = str(truth_values[index])
            expected = str(expected_values[index])
            decision_key = f"{packet}|{layout}|{qn}"
            # The legacy cohort contains three distinct pages per layout, so
            # include its session ID to keep ledger/case identifiers unique.
            question_key = (
                decision_key
                if packet != "G2-9"
                else f"{packet}|{layout}|{session['scanSessionId']}|{qn}"
            )
            ambiguity_note = decisions.get("ambiguousQuestions", {}).get(decision_key) if packet != "G2-9" else None
            notable_note = decisions.get("legibleButNotableQuestions", {}).get(decision_key) if packet != "G2-9" else None
            slot_count = len(group.get("digitBoxIds", []))
            if packet == "G2-9":
                slot_truth = list(truth)
                slot_ambiguous = [False] * slot_count
                placement = "two-character"
            else:
                slot_truth, slot_ambiguous, placement = physical_slot_truth(packet, layout, qn, truth, slot_count, decisions)
            if len(slot_truth) != slot_count:
                raise RuntimeError(f"Slot truth count mismatch for {question_key}")

            display_digits = group.get("displayDigits", [])
            slot_statuses = group.get("slotStatuses", [])
            suggestion = str(group.get("answerText") or "")
            # reviewOnlyFallback is an operational page-level decision. Some
            # saved per-question/per-slot status fields retain their pre-
            # fallback value, but the rendered/public result is all yellow.
            page_forced_review = bool(debug.get("reviewOnlyFallback") or debug.get("forcedFallbackReviewReason"))
            reviewed = bool(group.get("reviewNeeded")) or page_forced_review
            scorable = ambiguity_note is None
            question_row = {
                "id": question_key,
                "cohort": "legacy-g2" if packet == "G2-9" else "primary-grade1",
                "packetId": packet,
                "layoutId": layout,
                "layoutFamily": layout_family(layout),
                "questionNum": qn,
                "questionPositionFraction": round(qn / question_count, 4),
                "pageColumn": column_for(qn, question_count),
                "canonicalScanSessionId": session["scanSessionId"],
                "canonicalPageOrdinal": page_ordinals[packet][session["scanSessionId"]],
                "physicalSlotCount": slot_count,
                "visibleResponseCharacterCount": len(truth),
                "visibleInscription": truth,
                "mathematicalExpectedAnswer": expected,
                "mathematicalAnswerCorrect": scorable and truth == expected,
                "labelProvenance": provenance,
                "ambiguityFlag": not scorable,
                "ambiguityNote": ambiguity_note,
                "notableCondition": notable_note,
                "slotPlacement": placement,
                "suggestedTranscription": suggestion,
                "automatic": not reviewed,
                "reviewed": reviewed,
                "ocrScorable": scorable,
                "ocrCorrect": scorable and suggestion == truth,
                "engineReportedMathCorrect": bool(group.get("correct")),
                "preFallbackQuestionReviewField": bool(group.get("reviewNeeded")),
                "slotStatuses": slot_statuses,
                "forcedFallbackReason": debug.get("forcedFallbackReviewReason"),
                "captureQualityBand": capture_band(debug),
                "captureFocusScore": (debug.get("captureQuality") or {}).get("focusScore"),
                "captureLumaMean": (debug.get("captureQuality") or {}).get("lumaMean"),
                "registrationQualityBand": registration_band(debug),
                "registrationMaxResidualPx": ((debug.get("answerBoxRegistration") or {}).get("coherence") or {}).get("maxResidual"),
                "evidence": {
                    "debugJson": str(Path(session["dir"]) / "debug.json"),
                    "capturedPage": str(Path(session["dir"]) / "captured.png"),
                    "warpedPage": str(Path(session["dir"]) / "warped.png"),
                    "rawCrops": [str(Path(session["dir"]) / "raw-crops" / f"raw-{box_id + 1:02d}.png") for box_id in group["digitBoxIds"]],
                    "modelInputs": [str(Path(session["dir"]) / "model-inputs" / f"model-{box_id + 1:02d}.png") for box_id in group["digitBoxIds"]],
                },
            }
            questions.append(question_row)

            truth_ledger.append(
                {
                    "recordType": "question",
                    **{key: question_row[key] for key in (
                        "id", "cohort", "packetId", "layoutId", "questionNum", "canonicalScanSessionId",
                        "visibleInscription", "mathematicalExpectedAnswer", "labelProvenance", "ambiguityFlag",
                        "ambiguityNote", "notableCondition", "evidence",
                    )},
                }
            )

            for slot_index, box_id in enumerate(group["digitBoxIds"]):
                displayed = display_digits[slot_index] if slot_index < len(display_digits) else None
                status = slot_statuses[slot_index] if slot_index < len(slot_statuses) else "review"
                prediction = predictions.get(box_id, {})
                truth_slot = slot_truth[slot_index]
                slot_scorable = scorable and not slot_ambiguous[slot_index]
                if slot_count == 1:
                    semantic = "single-physical-slot"
                elif len(truth) == 2:
                    semantic = "tens" if slot_index == 0 else "ones"
                else:
                    semantic = "left-optional" if slot_index == 0 else "right-optional"
                slot_row = {
                    "id": f"{question_key}|slot-{slot_index}",
                    "questionId": question_key,
                    "cohort": question_row["cohort"],
                    "packetId": packet,
                    "layoutId": layout,
                    "layoutFamily": question_row["layoutFamily"],
                    "questionNum": qn,
                    "questionPositionFraction": question_row["questionPositionFraction"],
                    "pageColumn": question_row["pageColumn"],
                    "canonicalScanSessionId": session["scanSessionId"],
                    "canonicalPageOrdinal": question_row["canonicalPageOrdinal"],
                    "physicalSlotCount": slot_count,
                    "slotIndex": slot_index,
                    "physicalSide": "single" if slot_count == 1 else ("left" if slot_index == 0 else "right"),
                    "slotSemantic": semantic,
                    "visibleSlotInscription": truth_slot,
                    "truthDigitClass": truth_slot if truth_slot is not None and len(truth_slot) == 1 else ("blank" if truth_slot is None else "multi-or-fragment"),
                    "displayedDigit": None if displayed is None else str(displayed),
                    "automatic": status != "review" and not page_forced_review,
                    "reviewed": status == "review" or page_forced_review,
                    "ocrScorable": slot_scorable,
                    "ocrCorrect": slot_scorable and (None if displayed is None else str(displayed)) == truth_slot,
                    "engineSlotStatus": status,
                    "pageForcedReview": page_forced_review,
                    "ambiguityFlag": not slot_scorable,
                    "labelProvenance": provenance,
                    "forcedFallbackReason": question_row["forcedFallbackReason"],
                    "captureQualityBand": question_row["captureQualityBand"],
                    "registrationQualityBand": question_row["registrationQualityBand"],
                    "prediction": {
                        "digit": prediction.get("digit"),
                        "confidence": prediction.get("confidence"),
                        "topGap": prediction.get("topGap"),
                        "reviewNeeded": prediction.get("reviewNeeded"),
                        "preprocessDisagreement": prediction.get("preprocessDisagreement"),
                        "preprocessReviewReason": prediction.get("preprocessReviewReason"),
                        "structuralReview": prediction.get("structuralReview"),
                        "unexpectedLeadingDigitReview": prediction.get("unexpectedLeadingDigitReview"),
                        "highRiskMismatchReview": prediction.get("highRiskMismatchReview"),
                        "topK": prediction.get("topK"),
                    },
                    "evidence": {
                        "rawCrop": str(Path(session["dir"]) / "raw-crops" / f"raw-{box_id + 1:02d}.png"),
                        "modelInput": str(Path(session["dir"]) / "model-inputs" / f"model-{box_id + 1:02d}.png"),
                        "debugJson": str(Path(session["dir"]) / "debug.json"),
                    },
                }
                slots.append(slot_row)
                truth_ledger.append(
                    {
                        "recordType": "digit-slot",
                        **{key: slot_row[key] for key in (
                            "id", "questionId", "cohort", "packetId", "layoutId", "questionNum", "slotIndex",
                            "physicalSide", "slotSemantic", "visibleSlotInscription", "labelProvenance",
                            "ambiguityFlag", "canonicalScanSessionId", "evidence",
                        )},
                        "mathematicalExpectedAnswer": expected,
                    }
                )
    return questions, slots, truth_ledger


def summarize(rows: list[dict]) -> dict:
    total = len(rows)
    scorable = [row for row in rows if row["ocrScorable"]]
    automatic = [row for row in rows if row["automatic"]]
    automatic_scorable = [row for row in automatic if row["ocrScorable"]]
    reviewed = [row for row in rows if row["reviewed"]]
    reviewed_scorable = [row for row in reviewed if row["ocrScorable"]]
    automatic_correct = [row for row in automatic_scorable if row["ocrCorrect"]]
    automatic_wrong = [row for row in automatic_scorable if not row["ocrCorrect"]]
    reviewed_correct = [row for row in reviewed_scorable if row["ocrCorrect"]]
    return {
        "total": total,
        "scorable": len(scorable),
        "ambiguous": total - len(scorable),
        "automatic": len(automatic),
        "automaticCoveragePct": pct(len(automatic), total),
        "automaticScorable": len(automatic_scorable),
        "automaticCorrect": len(automatic_correct),
        "automaticWrong": len(automatic_wrong),
        "automaticPrecisionPct": pct(len(automatic_correct), len(automatic_scorable)),
        "reviewed": len(reviewed),
        "reviewRatePct": pct(len(reviewed), total),
        "reviewedScorable": len(reviewed_scorable),
        "reviewedSuggestionCorrect": len(reviewed_correct),
        "reviewedSuggestionCorrectPct": pct(len(reviewed_correct), len(reviewed_scorable)),
    }


def grading_integrity(rows: list[dict]) -> dict:
    scorable = [row for row in rows if row["ocrScorable"]]
    automatic = [row for row in scorable if row["automatic"]]
    agree = [row for row in automatic if bool(row["engineReportedMathCorrect"]) == bool(row["mathematicalAnswerCorrect"])]
    false_correct = [row for row in automatic if row["engineReportedMathCorrect"] and not row["mathematicalAnswerCorrect"]]
    false_incorrect = [row for row in automatic if not row["engineReportedMathCorrect"] and row["mathematicalAnswerCorrect"]]
    return {
        "scorableQuestions": len(scorable),
        "visibleMathCorrect": sum(bool(row["mathematicalAnswerCorrect"]) for row in scorable),
        "visibleMathWrongOrBlank": sum(not bool(row["mathematicalAnswerCorrect"]) for row in scorable),
        "automaticQuestions": len(automatic),
        "automaticGradeAgreement": len(agree),
        "automaticGradeAgreementPct": pct(len(agree), len(automatic)),
        "automaticFalseCorrect": len(false_correct),
        "automaticFalseIncorrect": len(false_incorrect),
        "falseCorrectIds": [row["id"] for row in false_correct],
        "falseIncorrectIds": [row["id"] for row in false_incorrect],
    }


def stratify(rows: list[dict], key: str) -> dict[str, dict]:
    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        grouped[str(row.get(key))].append(row)
    return {value: summarize(group) for value, group in sorted(grouped.items())}


def macro_rates(rows: list[dict], key: str) -> dict:
    strata = stratify(rows, key)
    coverages = [row["automaticCoveragePct"] for row in strata.values() if row["automaticCoveragePct"] is not None]
    precisions = [row["automaticPrecisionPct"] for row in strata.values() if row["automaticPrecisionPct"] is not None]
    return {
        "grouping": key,
        "groupCount": len(strata),
        "meanAutomaticCoveragePct": round(statistics.mean(coverages), 3) if coverages else None,
        "minAutomaticCoveragePct": round(min(coverages), 3) if coverages else None,
        "maxAutomaticCoveragePct": round(max(coverages), 3) if coverages else None,
        "meanAutomaticPrecisionPct": round(statistics.mean(precisions), 3) if precisions else None,
        "minAutomaticPrecisionPct": round(min(precisions), 3) if precisions else None,
        "maxAutomaticPrecisionPct": round(max(precisions), 3) if precisions else None,
    }


def confusion_pair(truth: str | None, suggestion: str | None) -> bool:
    return truth is not None and suggestion is not None and {str(truth), str(suggestion)} == {"1", "7"}


def classify_reviewed_question(row: dict, slot_rows: list[dict]) -> tuple[str, list[str], str]:
    fallback = row.get("forcedFallbackReason")
    truth = row["visibleInscription"]
    suggestion = row["suggestedTranscription"]
    secondary = []
    if fallback:
        return "whole-answer-forced-fallback", [fallback], "Page-level safety fallback forced every answer to review."
    if row["ambiguityFlag"]:
        return "ambiguous-or-overwritten-handwriting", [], "Handwriting truth is genuinely ambiguous/overwritten."
    if row["ocrCorrect"]:
        if any(slot["prediction"].get("preprocessDisagreement") for slot in slot_rows):
            secondary.append("preprocessing-variant-disagreement")
        return "correct-suggestion-held-by-policy", secondary, "Suggested transcription matches visible handwriting but policy held the question."
    if truth == "":
        return "blank-or-printed-artifact-hallucination", ["worksheet-layout-geometry"], "Visible response is blank but printed box/divider material produced digits."
    blank_companion = any(slot["visibleSlotInscription"] is None and slot["displayedDigit"] is not None for slot in slot_rows)
    if blank_companion:
        return "blank-divider-border-as-companion-digit", ["two-digit-composition"], "A physically blank companion slot/divider was composed as an extra digit."
    mismatches = [(slot["visibleSlotInscription"], slot["displayedDigit"]) for slot in slot_rows if slot["ocrScorable"] and not slot["ocrCorrect"]]
    if any(confusion_pair(a, b) for a, b in mismatches):
        secondary.append("model-class-ambiguity")
        return "digit-confusion-1-vs-7", secondary, "At least one mismatched physical slot is a 1/7 confusion."
    if len(suggestion) != len(truth) or any(slot["displayedDigit"] is None and slot["visibleSlotInscription"] is not None for slot in slot_rows):
        return "leading-missing-or-two-digit-composition", ["model-class-ambiguity"], "Suggested answer has a missing/extra digit or a composition-length mismatch."
    if any(slot["prediction"].get("preprocessDisagreement") for slot in slot_rows):
        return "preprocessing-variant-disagreement", ["model-class-ambiguity", "retained-multiview-unavailable"], "Preprocessing variants disagree and the held suggestion is wrong; no retained independent capture view is available."
    return "model-class-ambiguity", [], "The held digit class differs from visible handwriting without a stronger upstream failure signal."


def classify_reviewed_slot(row: dict) -> tuple[str, list[str], str]:
    if row.get("forcedFallbackReason"):
        return "whole-answer-forced-fallback", [row["forcedFallbackReason"]], "Page-level fallback forced the slot to review."
    if row["ambiguityFlag"]:
        return "ambiguous-or-overwritten-handwriting", [], "Slot truth is ambiguous or the digit spans the divider."
    if row["ocrCorrect"]:
        return "correct-suggestion-held-by-policy", [], "Displayed digit/blank matches the visible physical slot."
    truth = row["visibleSlotInscription"]
    displayed = row["displayedDigit"]
    if truth is None and displayed is not None:
        return "blank-divider-border-as-digit", ["worksheet-layout-geometry"], "Blank physical slot produced a digit suggestion."
    if truth is not None and displayed is None:
        return "missing-digit", ["two-digit-composition"], "Visible handwriting was omitted from the composed answer."
    if confusion_pair(truth, displayed):
        return "digit-confusion-1-vs-7", ["model-class-ambiguity"], "Visible 1/7 was suggested as the other class."
    if row["prediction"].get("preprocessDisagreement"):
        return "preprocessing-variant-disagreement", ["model-class-ambiguity", "retained-multiview-unavailable"], "Preprocessing variants disagree and the displayed digit is wrong; no retained independent capture view is available."
    return "model-class-ambiguity", [], "Displayed class differs from visible slot truth."


def build_review_taxonomy(questions: list[dict], slots: list[dict]) -> dict:
    slots_by_question: dict[str, list[dict]] = defaultdict(list)
    for slot in slots:
        slots_by_question[slot["questionId"]].append(slot)
    question_cases = []
    for row in questions:
        if not row["reviewed"]:
            continue
        category, secondary, rationale = classify_reviewed_question(row, slots_by_question[row["id"]])
        question_cases.append(
            {
                "id": row["id"],
                "cohort": row["cohort"],
                "packetId": row["packetId"],
                "layoutId": row["layoutId"],
                "questionNum": row["questionNum"],
                "scanSessionId": row["canonicalScanSessionId"],
                "truth": row["visibleInscription"],
                "suggestion": row["suggestedTranscription"],
                "suggestionCorrect": row["ocrCorrect"] if row["ocrScorable"] else None,
                "primaryCategory": category,
                "secondaryCategories": secondary,
                "rationale": rationale,
                "evidence": row["evidence"],
            }
        )
    slot_cases = []
    for row in slots:
        if not row["reviewed"]:
            continue
        category, secondary, rationale = classify_reviewed_slot(row)
        slot_cases.append(
            {
                "id": row["id"],
                "questionId": row["questionId"],
                "cohort": row["cohort"],
                "packetId": row["packetId"],
                "layoutId": row["layoutId"],
                "questionNum": row["questionNum"],
                "slotIndex": row["slotIndex"],
                "scanSessionId": row["canonicalScanSessionId"],
                "truth": row["visibleSlotInscription"],
                "suggestion": row["displayedDigit"],
                "suggestionCorrect": row["ocrCorrect"] if row["ocrScorable"] else None,
                "primaryCategory": category,
                "secondaryCategories": secondary,
                "rationale": rationale,
                "evidence": row["evidence"],
            }
        )

    def category_summary(cases: list[dict]) -> list[dict]:
        counts = Counter(case["primaryCategory"] for case in cases)
        rows = []
        for category, count in counts.most_common():
            examples = [case for case in cases if case["primaryCategory"] == category][:5]
            rows.append(
                {
                    "category": category,
                    "count": count,
                    "percentOfReviewed": pct(count, len(cases)),
                    "representativeIds": [case["id"] for case in examples],
                }
            )
        return rows

    def by_cohort(cases: list[dict]) -> dict:
        grouped = defaultdict(list)
        for case in cases:
            grouped[case["cohort"]].append(case)
        return {
            cohort: {"reviewed": len(rows), "summary": category_summary(rows)}
            for cohort, rows in sorted(grouped.items())
        }

    return {
        "questionLevel": {
            "reviewed": len(question_cases),
            "summary": category_summary(question_cases),
            "summaryByCohort": by_cohort(question_cases),
            "cases": question_cases,
        },
        "digitSlotLevel": {
            "reviewed": len(slot_cases),
            "summary": category_summary(slot_cases),
            "summaryByCohort": by_cohort(slot_cases),
            "cases": slot_cases,
        },
    }


def image_similarity(path_a: Path, path_b: Path) -> float | None:
    if not path_a.exists() or not path_b.exists():
        return None
    with Image.open(path_a) as a, Image.open(path_b) as b:
        a = ImageOps.fit(ImageOps.grayscale(a), (128, 128), method=Image.Resampling.BILINEAR)
        b = ImageOps.fit(ImageOps.grayscale(b), (128, 128), method=Image.Resampling.BILINEAR)
        mean_abs = ImageStat.Stat(ImageChops.difference(a, b)).mean[0]
        return round(1 - mean_abs / 255, 6)


def file_sha256(path: Path) -> str | None:
    if not path.exists():
        return None
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def compare_success(a: dict, b: dict) -> dict:
    debug_a, debug_b = a["debug"], b["debug"]
    preds_a = sorted(debug_a.get("predictions", []), key=lambda row: row["id"])
    preds_b = sorted(debug_b.get("predictions", []), key=lambda row: row["id"])
    common = min(len(preds_a), len(preds_b))
    confidence_deltas = [abs(preds_a[i].get("confidence", 0) - preds_b[i].get("confidence", 0)) for i in range(common)]
    crop_paths_a = sorted((Path(a["dir"]) / "raw-crops").glob("raw-*.png"))
    crop_paths_b = sorted((Path(b["dir"]) / "raw-crops").glob("raw-*.png"))
    crop_similarities = [image_similarity(x, y) for x, y in zip(crop_paths_a, crop_paths_b)]
    crop_similarities = [value for value in crop_similarities if value is not None]
    groups_a = sorted(debug_a.get("answerGroups", []), key=lambda row: row["questionNum"])
    groups_b = sorted(debug_b.get("answerGroups", []), key=lambda row: row["questionNum"])
    return {
        "sessionA": a["scanSessionId"],
        "sessionB": b["scanSessionId"],
        "roleA": a["auditRole"],
        "roleB": b["auditRole"],
        "capturedPixelSimilarity": image_similarity(Path(a["dir"]) / "captured.png", Path(b["dir"]) / "captured.png"),
        "warpedPixelSimilarity": image_similarity(Path(a["dir"]) / "warped.png", Path(b["dir"]) / "warped.png"),
        "meanRawCropPixelSimilarity": round(statistics.mean(crop_similarities), 6) if crop_similarities else None,
        "minRawCropPixelSimilarity": round(min(crop_similarities), 6) if crop_similarities else None,
        "predictionDigitAgreement": sum(preds_a[i].get("digit") == preds_b[i].get("digit") for i in range(common)),
        "predictionDigitDenominator": common,
        "medianConfidenceAbsDelta": round(statistics.median(confidence_deltas), 6) if confidence_deltas else None,
        "maxConfidenceAbsDelta": round(max(confidence_deltas), 6) if confidence_deltas else None,
        "questionSuggestionAgreement": sum(groups_a[i].get("answerText") == groups_b[i].get("answerText") for i in range(min(len(groups_a), len(groups_b)))),
        "questionDenominator": min(len(groups_a), len(groups_b)),
        "questionReviewAgreement": sum(groups_a[i].get("reviewNeeded") == groups_b[i].get("reviewNeeded") for i in range(min(len(groups_a), len(groups_b)))),
        "forcedFallbackA": debug_a.get("forcedFallbackReviewReason"),
        "forcedFallbackB": debug_b.get("forcedFallbackReviewReason"),
        "evidenceA": a["dir"],
        "evidenceB": b["dir"],
    }


def build_repeatability(sessions: list[dict]) -> dict:
    by_id = {row["scanSessionId"]: row for row in sessions}
    a_rows = sorted(
        [row for row in sessions if row["packetId"] == "A" and row["layoutId"].endswith("ten-frames") and row["success"]],
        key=lambda row: row["receivedAt"],
    )
    p02_rows = sorted(
        [row for row in sessions if row["packetId"] == "P02" and row["layoutId"].endswith("add-2digit") and row["success"]],
        key=lambda row: row["receivedAt"],
    )
    canonical_p02 = next(row for row in p02_rows if row["auditRole"] == "canonical-success")
    comparisons = [
        {"case": "A-ten-frame-deliberate-repeat", **compare_success(a_rows[0], a_rows[1])},
        *[
            {"case": "P02-add-two-digit-success-retry-vs-fresh-canonical", **compare_success(row, canonical_p02)}
            for row in p02_rows
            if row is not canonical_p02
        ],
    ]
    error_recovery_specs = [
        ("dbe548d7-ae04-42c2-94f5-87304f44be96", "B2", "sg-g1-lw-05-mixed-20"),
        ("fd02b3a0-203a-4db9-bd85-0356ca870c20", "P02", "sg-g1-lw-02-add-2digit"),
        ("13f7a9e7-3e14-4f7a-8d91-4d5dfb36fc73", "P09", "sg-g1-lw-01-add-1digit"),
    ]
    error_recoveries = []
    for error_id, packet, layout in error_recovery_specs:
        error = by_id[error_id]
        successes = sorted(
            [row for row in sessions if row["packetId"] == packet and row["layoutId"] == layout and row["success"]],
            key=lambda row: abs((iso_ms(row["receivedAt"]) or 0) - (iso_ms(error["receivedAt"]) or 0)),
        )
        recovery = successes[0]
        error_recoveries.append(
            {
                "case": f"{packet}-{layout_family(layout)}-error-to-nearest-success",
                "errorSessionId": error_id,
                "recoverySessionId": recovery["scanSessionId"],
                "capturedPixelSimilarity": image_similarity(Path(error["dir"]) / "captured.png", Path(recovery["dir"]) / "captured.png"),
                "elapsedBetweenBundlesMs": round(abs((iso_ms(recovery["receivedAt"]) or 0) - (iso_ms(error["receivedAt"]) or 0))),
                "errorEvidence": error["dir"],
                "recoveryEvidence": recovery["dir"],
            }
        )
    return {"successComparisons": comparisons, "errorRecoveryComparisons": error_recoveries}


def build_error_sessions(sessions: list[dict]) -> list[dict]:
    rows = []
    for session in sessions:
        if session["auditRole"] != "error":
            continue
        debug = session["debug"]
        ocr_trace = debug.get("ocrStageTrace") or []
        worksheet_trace = debug.get("worksheetStageTrace") or []
        rows.append(
            {
                "packetId": session["packetId"],
                "layoutId": session["layoutId"],
                "scanSessionId": session["scanSessionId"],
                "numericException": (debug.get("error") or {}).get("message"),
                "lastOcrStage": ocr_trace[-1] if ocr_trace else None,
                "lastWorksheetStage": worksheet_trace[-1] if worksheet_trace else None,
                "captureQualityBand": capture_band(debug),
                "focusScore": (debug.get("captureQuality") or {}).get("focusScore"),
                "answerBoxRegistrationPersisted": debug.get("answerBoxRegistration") is not None,
                "digitInferenceStarted": debug.get("digitEngineTrace") is not None,
                "observedPipelineLayer": "9-browser-runtime/WASM-state-during-layer-3-answer-box-registration",
                "mostLikelyClass": "OpenCV.js/WASM resource-lifetime or exception-marshalling failure inside answer-box registration",
                "evidenceStrength": "moderate: identical terminal stage and numeric-only exception shape across three layouts; no stack or heap telemetry",
                "notDemonstrated": [
                    "a six-page endurance threshold",
                    "a recognition-model failure",
                    "bad capture as the trigger",
                    "the exact leaking or double-freed object",
                ],
                "smallestRepro": "Replay the saved chronological page prefix into a registration-only harness in persistent Mobile Safari/WebKit state, then cold-run the failing page; instrument cv.Mat/delete ownership, WASM heap size, stage entry/exit, and thrown values. Assert identical output and stable heap over 50 loops and after an injected registration failure.",
                "evidence": {
                    "debugJson": str(Path(session["dir"]) / "debug.json"),
                    "capturedPage": str(Path(session["dir"]) / "captured.png"),
                },
            }
        )
    return rows


def build_annotation_findings(sessions: list[dict]) -> dict:
    rows = []
    for session in sessions:
        if session["auditRole"] != "canonical-success" or session["packetId"] != "P02":
            continue
        if not (session["layoutId"].endswith("add-2digit") or session["layoutId"].endswith("sub-2digit")):
            continue
        debug = session["debug"]
        coherence = ((debug.get("answerBoxRegistration") or {}).get("coherence") or {})
        geometry = debug.get("annotationGeometry") or {}
        crop_offsets = []
        for crop in geometry.get("crops", []):
            expected = crop.get("expectedRect") or {}
            annotation = crop.get("annotationRect") or {}
            if expected and annotation:
                crop_offsets.append(
                    {
                        "id": crop.get("id"),
                        "dx": round(annotation.get("x", 0) - expected.get("x", 0), 3),
                        "dy": round(annotation.get("y", 0) - expected.get("y", 0), 3),
                        "dw": round(annotation.get("w", 0) - expected.get("w", 0), 3),
                        "dh": round(annotation.get("h", 0) - expected.get("h", 0), 3),
                    }
                )
        rows.append(
            {
                "scanSessionId": session["scanSessionId"],
                "layoutId": session["layoutId"],
                "forcedFallbackReason": debug.get("forcedFallbackReviewReason"),
                "recognitionRegistrationCoherent": coherence.get("coherent"),
                "recognitionRegistrationMaxResidualPx": coherence.get("maxResidual"),
                "recognitionRegistrationMedianResidualPx": coherence.get("medianResidual"),
                "annotationBaseMode": (debug.get("overlayDebug") or {}).get("annotationBaseMode"),
                "annotationRectSourceCounts": dict(Counter(crop.get("annotationRectSource") for crop in geometry.get("crops", []))),
                "annotationMinusExpectedRect": crop_offsets,
                "observedMarkedImageFinding": "Yellow fill rectangles are visibly partial/offset against printed answer frames on the saved marked sheet.",
                "layerAttribution": "layer 8 annotation rendering/registration, downstream of coherent layer-3 recognition registration",
                "evidence": {
                    "markedImage": str(Path(session["dir"]) / "marked-sheet.jpg"),
                    "overlayDebug": str(Path(session["dir"]) / "overlay-debug.json"),
                    "debugJson": str(Path(session["dir"]) / "debug.json"),
                },
            }
        )
    return {"cases": rows, "interpretation": "The yellow drawing defect must not be counted as an OCR miss or as the cause of the all-yellow recognition fallback."}


def timing_metrics(sessions: list[dict]) -> dict:
    by_cohort: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    for session in sessions:
        if session["auditRole"] != "canonical-success":
            continue
        debug = session["debug"]
        cohort = "legacy-g2" if session["packetId"] == "G2-9" else "primary-grade1"
        capture = ((debug.get("captureQuality") or {}).get("captureGateTelemetry") or {}).get("elapsedMs")
        if capture is not None:
            by_cohort[cohort]["captureGateMs"].append(float(capture))
        trace = debug.get("ocrStageTrace") or []
        completed = [float(row["atMs"] + row["durationMs"]) for row in trace if row.get("durationMs") is not None]
        if completed:
            by_cohort[cohort]["ocrTraceMs"].append(max(completed))
        capture_completed = ((debug.get("captureQuality") or {}).get("captureGateTelemetry") or {}).get("completedAt")
        received_latency = (iso_ms(session.get("receivedAt")) or 0) - (iso_ms(capture_completed) or 0) if capture_completed else None
        if received_latency is not None and received_latency >= 0:
            by_cohort[cohort]["acceptedCaptureToRepresentativeReceiptMs"].append(received_latency)
    return {cohort: {name: distribution(values) for name, values in metrics.items()} for cohort, metrics in by_cohort.items()}


def operational_signals(sessions: list[dict], slots: list[dict]) -> dict:
    canonical = [row for row in sessions if row["auditRole"] == "canonical-success"]
    fallback_pages = []
    capture_rejections = Counter()
    capture_attempts = 0
    for session in canonical:
        debug = session["debug"]
        telemetry = ((debug.get("captureQuality") or {}).get("captureGateTelemetry") or {})
        capture_attempts += int(telemetry.get("attempts") or 0)
        capture_rejections.update(telemetry.get("rejectionCounts") or {})
        if debug.get("reviewOnlyFallback") or debug.get("forcedFallbackReviewReason"):
            fallback_pages.append(
                {
                    "packetId": session["packetId"],
                    "layoutId": session["layoutId"],
                    "scanSessionId": session["scanSessionId"],
                    "reason": debug.get("forcedFallbackReviewReason"),
                    "focusScore": (debug.get("captureQuality") or {}).get("focusScore"),
                    "registrationQualityBand": registration_band(debug),
                    "evidence": session["dir"],
                }
            )
    reviewed_slots = [row for row in slots if row["reviewed"]]
    preprocess_reasons = Counter(
        row["prediction"].get("preprocessReviewReason") or "none-recorded"
        for row in reviewed_slots
    )
    return {
        "canonicalPageCount": len(canonical),
        "pageLevelForcedFallbacks": fallback_pages,
        "pageLevelForcedFallbackReasonCounts": dict(Counter(row["reason"] for row in fallback_pages)),
        "captureGateAttempts": capture_attempts,
        "captureGateRejectionCounts": dict(capture_rejections),
        "reviewedSlotPreprocessReasonCounts": dict(preprocess_reasons.most_common()),
    }


def reference_truth_qa(decisions: dict, reference_path: Path) -> dict:
    data = read_json(reference_path)
    rows = data["engines"][0]["rows"]
    reference = {(row["packetId"], row["layoutId"], int(row["questionNum"])): str(row["truth"]) for row in rows}
    layout_index = {layout: index for index, layout in enumerate(LAYOUT_ORDER)}
    differences = []
    compared = 0
    for packet in ("P02", "P03", "P05", "P08", "P09"):
        for layout in LAYOUT_ORDER:
            for qn, truth in enumerate(decisions["questionTruthByPacket"][packet][layout_index[layout]], start=1):
                key = (packet, layout, qn)
                if key not in reference:
                    continue
                compared += 1
                if str(truth) != reference[key]:
                    differences.append(
                        {"packetId": packet, "layoutId": layout, "questionNum": qn, "currentTruth": str(truth), "priorTruth": reference[key]}
                    )
    return {
        "referencePath": str(reference_path),
        "comparedRows": compared,
        "matchingRows": compared - len(differences),
        "differences": differences,
        "interpretation": "Differences are retained when the August visible inscription controls; prior truth is not silently substituted.",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw-root", type=Path, default=Path("private-evidence/debug-scans/2026-08-15"))
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("private-evidence/reports/known-packet-forensic-20260815"),
    )
    parser.add_argument(
        "--truth-decisions",
        type=Path,
        default=Path("private-evidence/reports/known-packet-forensic-20260815/manual-truth-decisions.json"),
    )
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    sessions = collect_sessions(args.raw_root)
    classify_sessions(sessions)
    counts = {
        "distinctSessions": len(sessions),
        "canonicalSuccesses": sum(row["auditRole"] == "canonical-success" for row in sessions),
        "extraSuccesses": sum(row["auditRole"].startswith("extra-success") for row in sessions),
        "errors": sum(row["auditRole"] == "error" for row in sessions),
    }
    if counts != EXPECTED_RECONCILIATION:
        raise RuntimeError(f"Corpus reconciliation failed: observed={counts}; expected={EXPECTED_RECONCILIATION}")

    decisions = read_json(args.truth_decisions)
    g2_truth = build_g2_truth(read_json(Path("docs/SG3_9_PHOTO_OCR_SCORECARD.json")))
    questions, slots, truth_ledger = build_ledgers(sessions, decisions, g2_truth)
    if len(questions) != 860 or len(slots) != 1500:
        raise RuntimeError(f"Ledger cardinality failed: questions={len(questions)}, slots={len(slots)}")
    primary_questions = [row for row in questions if row["cohort"] == "primary-grade1"]
    primary_slots = [row for row in slots if row["cohort"] == "primary-grade1"]
    g2_questions = [row for row in questions if row["cohort"] == "legacy-g2"]
    g2_slots = [row for row in slots if row["cohort"] == "legacy-g2"]
    if len(primary_questions) != 770 or len(primary_slots) != 1320 or len(g2_questions) != 90 or len(g2_slots) != 180:
        raise RuntimeError("Cohort cardinality failed")

    question_strata_keys = [
        "packetId", "layoutId", "physicalSlotCount", "visibleResponseCharacterCount", "pageColumn",
        "questionNum", "captureQualityBand", "registrationQualityBand", "forcedFallbackReason",
        "canonicalPageOrdinal",
    ]
    slot_strata_keys = [
        "packetId", "layoutId", "truthDigitClass", "physicalSide", "slotSemantic", "pageColumn",
        "questionNum", "captureQualityBand", "registrationQualityBand", "forcedFallbackReason",
        "canonicalPageOrdinal",
    ]
    metrics = {
        "schemaVersion": 1,
        "startingCommit": STARTING_COMMIT,
        "publicBuild": "2026.08.15-known-packet-batch-beta-15-112",
        "reconciliation": counts,
        "questionLevel": {
            "primaryGrade1": summarize(primary_questions),
            "legacyG2": summarize(g2_questions),
            "combinedDescriptiveOnly": summarize(questions),
            "primaryMacro": {
                "byPacket": macro_rates(primary_questions, "packetId"),
                "byLayout": macro_rates(primary_questions, "layoutId"),
            },
            "primaryStrata": {key: stratify(primary_questions, key) for key in question_strata_keys},
            "legacyStrata": {key: stratify(g2_questions, key) for key in question_strata_keys},
            "gradingIntegrity": {
                "primaryGrade1": grading_integrity(primary_questions),
                "legacyG2": grading_integrity(g2_questions),
            },
        },
        "digitSlotLevel": {
            "primaryGrade1": summarize(primary_slots),
            "legacyG2": summarize(g2_slots),
            "combinedDescriptiveOnly": summarize(slots),
            "primaryMacro": {
                "byPacket": macro_rates(primary_slots, "packetId"),
                "byLayout": macro_rates(primary_slots, "layoutId"),
            },
            "primaryStrata": {key: stratify(primary_slots, key) for key in slot_strata_keys},
            "legacyStrata": {key: stratify(g2_slots, key) for key in slot_strata_keys},
        },
        "timing": timing_metrics(sessions),
        "operationalSignals": operational_signals(sessions, slots),
    }
    g2_q = metrics["questionLevel"]["legacyG2"]
    g2_d = metrics["digitSlotLevel"]["legacyG2"]
    if not (
        g2_q["automatic"] == 66
        and g2_q["automaticCorrect"] == 66
        and g2_q["automaticWrong"] == 0
        and g2_d["automatic"] == 151
        and g2_d["automaticCorrect"] == 151
        and g2_d["automaticWrong"] == 0
    ):
        raise RuntimeError(f"Locked G2 reproduction failed: q={g2_q}, d={g2_d}")

    taxonomy = build_review_taxonomy(questions, slots)
    automatic_errors = {
        "questionLevel": [row for row in questions if row["automatic"] and row["ocrScorable"] and not row["ocrCorrect"]],
        "digitSlotLevel": [row for row in slots if row["automatic"] and row["ocrScorable"] and not row["ocrCorrect"]],
    }
    error_sessions = build_error_sessions(sessions)
    repeatability = build_repeatability(sessions)
    annotation = build_annotation_findings(sessions)
    prior_truth_qa = reference_truth_qa(
        decisions,
        Path("private-evidence/reports/browser-local-trocr60-all-uniform-layout-affine-webkit-20260723.json"),
    )
    qa = {
        "schemaVersion": 1,
        "hardChecks": {
            "reconciliation": {"passed": counts == EXPECTED_RECONCILIATION, "observed": counts, "expected": EXPECTED_RECONCILIATION},
            "forbiddenPacketsRead": [],
            "questionCount": {"passed": len(questions) == 860, "observed": len(questions), "expected": 860},
            "slotCount": {"passed": len(slots) == 1500, "observed": len(slots), "expected": 1500},
            "primaryQuestionCount": {"passed": len(primary_questions) == 770, "observed": len(primary_questions), "expected": 770},
            "primarySlotCount": {"passed": len(primary_slots) == 1320, "observed": len(primary_slots), "expected": 1320},
            "g2LockedReproduction": {"passed": True, "question": g2_q, "digitSlot": g2_d},
            "reviewQuestionClassificationComplete": {
                "passed": taxonomy["questionLevel"]["reviewed"] == sum(row["reviewed"] for row in questions),
                "classified": taxonomy["questionLevel"]["reviewed"],
                "expected": sum(row["reviewed"] for row in questions),
            },
            "reviewSlotClassificationComplete": {
                "passed": taxonomy["digitSlotLevel"]["reviewed"] == sum(row["reviewed"] for row in slots),
                "classified": taxonomy["digitSlotLevel"]["reviewed"],
                "expected": sum(row["reviewed"] for row in slots),
            },
            "automaticErrorEnumerationComplete": {
                "passed": len(automatic_errors["questionLevel"]) == metrics["questionLevel"]["combinedDescriptiveOnly"]["automaticWrong"],
                "questionErrors": len(automatic_errors["questionLevel"]),
                "slotErrors": len(automatic_errors["digitSlotLevel"]),
            },
        },
        "truthAmbiguity": {
            "questionCount": sum(row["ambiguityFlag"] for row in questions),
            "slotCount": sum(row["ambiguityFlag"] for row in slots),
            "questionIds": [row["id"] for row in questions if row["ambiguityFlag"]],
        },
        "priorTruthConsistency": prior_truth_qa,
        "secondPassMethod": [
            "Every current Grade 1 question was read on prediction-blind raw-crop contact sheets.",
            "All prior-packet disagreements, blanks, overwritten labels, single-digit/two-slot placements, and every current automatic mismatch were checked against the current warped page/raw crops.",
            "Deterministic checks enforce corpus, page/question/slot cardinality, placement completeness, G2 locked-result reproduction, review taxonomy completeness, and automatic-error enumeration completeness.",
        ],
    }

    manifest_rows = session_manifest(sessions)
    manifest = {
        "schemaVersion": 1,
        "startingCommit": STARTING_COMMIT,
        "rawRoot": str(args.raw_root),
        "deduplicationKey": "scanSessionId",
        "representativeSnapshotRule": "accepted-answer-safety-shadow-complete > ocr-complete > ocr-error; snapshots sharing scanSessionId are one physical scan session",
        "canonicalRules": {
            "A-ten-frame": "earlier of two successful sessions canonical; later deliberate repeat diagnostic-only",
            "P02-add-two-digit": "last/fresh-restart successful session canonical; preceding two successful retries diagnostic-only",
            "allOtherSuccesses": "one canonical success per expected packet/layout",
            "errors": "retained diagnostic-only and outside accuracy denominator",
        },
        "reconciliation": counts,
        "expectedReconciliation": EXPECTED_RECONCILIATION,
        "inclusions": list(IN_SCOPE_PACKETS),
        "forbiddenPacketsRead": [],
        "exclusions": [
            "unrelated receiver/private-gateway smoke bundles",
            "no-packet debug/manual-correction sessions",
            "sealed P01/P04/P06/P07 evidence",
        ],
        "sessions": manifest_rows,
    }

    write_json(args.output_dir / "evidence-manifest.json", manifest)
    write_jsonl(args.output_dir / "truth-ledger.jsonl", truth_ledger)
    write_jsonl(args.output_dir / "question-metrics.jsonl", questions)
    write_jsonl(args.output_dir / "digit-slot-metrics.jsonl", slots)
    write_json(args.output_dir / "metrics.json", metrics)
    write_json(args.output_dir / "review-classifications.json", taxonomy)
    write_json(args.output_dir / "automatic-errors.json", automatic_errors)
    write_json(args.output_dir / "repeatability.json", repeatability)
    write_json(args.output_dir / "error-sessions.json", error_sessions)
    write_json(args.output_dir / "annotation-findings.json", annotation)
    write_json(args.output_dir / "qa.json", qa)
    print(json.dumps({
        "reconciliation": counts,
        "primaryQuestions": metrics["questionLevel"]["primaryGrade1"],
        "primaryDigitSlots": metrics["digitSlotLevel"]["primaryGrade1"],
        "legacyQuestions": g2_q,
        "legacyDigitSlots": g2_d,
        "automaticQuestionErrors": len(automatic_errors["questionLevel"]),
        "automaticDigitErrors": len(automatic_errors["digitSlotLevel"]),
        "ambiguities": qa["truthAmbiguity"],
    }, indent=2))


if __name__ == "__main__":
    main()
