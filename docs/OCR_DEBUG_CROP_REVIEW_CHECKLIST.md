# OCR Debug Crop Review Checklist

Created 2026-06-01 for the current two-digit worksheet reliability work.

## Purpose

Use this checklist before changing OCR, crop preprocessing, homography, candidate selection, or model training.

The goal is to decide what actually failed:

- the app cropped the wrong area
- the crop is right but preprocessing damaged the handwriting
- the model saw a reasonable crop but chose the wrong digit
- the app should have routed the answer to review instead of treating it as readable

## Review Inputs

Use the evaluator/debug artifacts from:

- `scripts/eval_uploaded_worksheets.mjs`
- `scripts/eval_tony_20260530_samples.mjs`
- local debug crop folders under `benchmarks/uploaded_student_samples/`

Do not commit student-identifiable crop images without Tony's explicit approval.

## Per-Answer Checklist

For each wrong or low-confidence answer, record:

```text
Sheet:
Question:
Expected answer:
Predicted answer:
Confidence / margin if available:
Crop alignment: good / shifted / clipped / wrong box
Digit visibility: clear / faint / erased / overwritten / outside box
Preprocessing issue: none / stroke lost / border noise / divider noise / heavy shadow
Likely category:
Next action:
```

## Categories

### Good Crop, Wrong Digit

Use this when the crop is centered on the intended handwriting and the digit is readable by a person.

Likely next actions:

- inspect top candidate probabilities
- test narrow preprocessing variants
- add the crop to a labeled training/holdout set
- improve review flagging if the margin is low

### Good Crop, Low Confidence

Use this when the predicted answer may be right or wrong, but the model is uncertain.

Likely next actions:

- route to teacher review
- avoid changing grading confidence upward
- preserve crop for threshold/candidate review work

### Shifted Or Clipped Crop

Use this when the intended digit is partly missing or the crop includes the wrong box area.

Likely next actions:

- inspect answer-box assignment
- inspect row/column mapping
- compare to worksheet layout coordinates
- do not retrain the model on bad crops as if they were normal handwriting

### Preprocessing Damaged The Digit

Use this when the raw crop is readable but the model input loses thin pencil strokes, merges marks, or keeps too much border/divider noise.

Likely next actions:

- test a narrow preprocessing variant against the acceptance gate
- compare raw crop, cleaned crop, and 28x28 model input
- reject the patch if it only improves one image or increases confident wrong answers

### Student Writing Outside The Box

Use this when the student answer crosses the box boundary, divider, or neighboring content enough that a normal crop cannot contain it cleanly.

Likely next actions:

- classify as student writing behavior or worksheet affordance issue
- ask Tony before changing worksheet design
- preserve as a real classroom edge case

## Minimum Evidence Before A Patch

Before accepting an OCR-related patch, the report should include:

- at least one before/after result on Tony's 2026-06-01 failed subtraction scan
- the May 30 three-sheet benchmark result
- a short note on whether wrong answers became more or less review-worthy
- crop-category counts for the changed samples

Use `docs/TWO_DIGIT_OCR_ACCEPTANCE_GATE.md` as the pass/fail gate.

## Teacher-Language Summary

Translate debug findings into teacher language:

```text
ScanGrade found the worksheet and answer boxes. Several answers need review because the pencil marks were too faint for the current OCR model to read reliably.
```

Avoid saying:

```text
The model failed.
The tensor was ambiguous.
The crop-preprocessor needs tuning.
```
