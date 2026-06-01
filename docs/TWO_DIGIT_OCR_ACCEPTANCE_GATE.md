# Two-Digit OCR Acceptance Gate

Created 2026-06-01 after Tony's first newly printed student subtraction scan failed in the live app.

## Purpose

Use this gate before accepting or pushing OCR, crop-preprocessing, homography, or model changes for the current Grade 2 two-digit worksheets.

The goal is not to make one photo pass. The goal is to avoid shipping a change that improves one worksheet while weakening teacher trust elsewhere.

## Current Evidence Set

Minimum gate:

- Tony 2026-06-01 Subtraction Within 20 student scan.
- Tony 2026-05-30 three-sheet benchmark:
  - Addition Within 20
  - Subtraction Within 20
  - Mixed Within 50

Current baseline:

| Evidence | Current result | Notes |
| --- | ---: | --- |
| 2026-06-01 Subtraction scan | 5/10 | Sheet and box detection work; thin pencil `2`s and `7`s often read as `1` or `9`. |
| 2026-05-30 three-sheet set | 18/30 | Subtraction 10/10, Mixed 3/10, Addition 5/10. |

## Repro Commands

Run the newest failed subtraction scan with answer-level scoring:

```bash
SG_EXPECTED_ANSWERS=17,15,12,12,12,12,12,12,14,11 \
node scripts/eval_uploaded_worksheets.mjs \
  --url https://localhost:5174 \
  --model /models/mnist-model.onnx \
  --out benchmarks/uploaded_student_samples/results-20260601-sean-subtraction-v3 \
  /tmp/codex-remote-attachments/019e760b-4e8f-7751-be8b-40baddcb8e58/B72FD2B7-43D1-48CC-8C7D-D1959F2F10A9/1-Photo-1.jpg
```

Run the May 30 benchmark:

```bash
node scripts/eval_tony_20260530_samples.mjs
```

## Pass Criteria For A Narrow OCR Patch

A candidate patch may move forward to review only if:

- It improves the 2026-06-01 subtraction scan above 5/10.
- It does not reduce the May 30 three-sheet benchmark below 18/30.
- It does not turn low-confidence wrong answers into confident wrong answers.
- It preserves correct sheet/layout detection.
- It leaves app UI and worksheet design unchanged unless Tony explicitly asked for those changes.

## Preferred Fix Order

Try the least risky fix first:

1. Better review flags or clearer refusal when confidence is weak.
2. Narrow crop-preprocessing changes that improve thin pencil `2` and `7` inputs.
3. Candidate-selection changes backed by debug crop evidence.
4. A labeled real-handwriting training set and model update.

Do not jump to broad homography or model changes if the debug overlay already shows the crop boxes over the intended handwriting.

## Failure Interpretation

For Tony's 2026-06-01 scan:

- The app found the page.
- The app found the answer boxes.
- The crop overlay was generally on the intended digits.
- The weak point was the model input and recognition of faint pencil strokes.

Teacher-language summary:

```text
ScanGrade saw the worksheet but could not reliably read several thin pencil answers. This is an OCR trust issue, not a worksheet-loading issue.
```

## Guardrails

- Do not call the app classroom-ready from this evidence.
- Do not push OCR changes as improvements without the gate result.
- Do not train only on the failed photo and claim general reliability.
- Preserve all debug artifacts locally; do not commit private student photos unless Tony explicitly approves a selected/redacted fixture.
